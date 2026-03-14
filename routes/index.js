const express = require('express');
const path = require('path');
const { readDB, updateDB } = require('../utils/db');
const { generateReceiptPdf } = require('../utils/pdf');

const router = express.Router();
const departments = ['General OPD', 'Pediatrics', 'ENT', 'Orthopedics', 'Neurology', 'Cardiology'];

function ensureAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

router.get('/', (req, res) => {
  res.render('home', { user: req.session.user || null });
});

router.get('/login', (req, res) => res.render('login', { error: null }));
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find((u) => u.username === username && u.password === password);
  if (!user) return res.render('login', { error: 'Invalid credentials' });

  req.session.user = user;
  if (user.role === 'admin') return res.redirect('/admin/dashboard');
  if (user.role === 'receptionist') return res.redirect('/reception/dashboard');
  return res.redirect('/doctor/dashboard');
});

router.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

router.get('/admin/dashboard', ensureAuth, (req, res) => {
  const db = readDB();
  const today = new Date().toISOString().slice(0, 10);
  const patientsToday = db.patients.filter((p) => (p.createdAt || '').startsWith(today));
  const receiptsToday = db.receipts.filter((r) => (r.paymentDate || '').startsWith(today));
  const totalRevenueToday = receiptsToday.reduce((s, r) => s + Number(r.amountPaid || 0), 0);
  const availableBeds = db.beds.filter((b) => b.status === 'available').length;
  const occupiedBeds = db.beds.filter((b) => b.status === 'occupied').length;
  const activeDoctors = db.doctors.filter((d) => d.status === 'Available' || d.status === 'Busy').length;
  const emergencyCount = db.queue.filter((q) => q.emergency && q.status !== 'completed').length;
  res.render('admin-dashboard', {
    user: req.session.user,
    stats: {
      patientsToday: patientsToday.length,
      totalRevenueToday,
      activeDoctors,
      availableBeds,
      occupiedBeds,
      opdQueueLoad: db.queue.filter((q) => q.status !== 'completed').length,
      emergencyCount,
      receiptsToday: receiptsToday.length
    },
    departments
  });
});

router.get('/reception/dashboard', ensureAuth, (req, res) => {
  const db = readDB();
  res.render('reception-dashboard', { user: req.session.user, patients: db.patients.slice(-5), queue: db.queue.slice(-5) });
});

router.get('/doctor/dashboard', ensureAuth, (req, res) => {
  const db = readDB();
  const doctor = db.doctors.find((d) => d.name === req.session.user.name) || db.doctors[0];
  const queue = db.queue.filter((q) => q.department === doctor.department && q.status !== 'completed');
  const completedToday = db.queue.filter((q) => q.department === doctor.department && q.status === 'completed').length;
  res.render('doctor-dashboard', { user: req.session.user, doctor, queue, completedToday });
});

router.post('/doctor/queue/:id/status', ensureAuth, (req, res) => {
  const { status, note } = req.body;
  updateDB((db) => {
    const item = db.queue.find((q) => q.id === req.params.id);
    if (item) {
      item.status = status;
      if (note) item.note = note;
    }
    return db;
  });
  req.app.get('io').emit('data:updated');
  res.redirect('/doctor/dashboard');
});

router.get('/patients/register', ensureAuth, (req, res) => res.render('patient-register', { user: req.session.user, departments }));
router.post('/patients/register', ensureAuth, (req, res) => {
  const body = req.body;
  const db = updateDB((data) => {
    const nextPatientNum = 1000 + data.patients.length + 1;
    const patientId = `P${nextPatientNum}`;
    const departmentCode = body.department.split(' ')[0][0] || 'X';
    const deptTokens = data.queue.filter((q) => q.department === body.department).length + 1;
    const token = `${departmentCode.toUpperCase()}-${String(deptTokens).padStart(3, '0')}`;

    const patient = {
      id: patientId,
      name: body.name,
      age: Number(body.age),
      gender: body.gender,
      phone: body.phone,
      address: body.address,
      symptoms: body.symptoms,
      department: body.department,
      emergency: body.emergency === 'yes',
      createdAt: new Date().toISOString()
    };
    data.patients.push(patient);
    data.queue.push({
      id: `Q${Date.now()}`,
      patientId,
      patientName: patient.name,
      department: body.department,
      token,
      status: 'waiting',
      emergency: patient.emergency,
      estimatedWait: Math.max(5, data.queue.filter((q) => q.department === body.department && q.status !== 'completed').length * 7),
      note: ''
    });
    data.lastSlip = { patientId, token, department: body.department, createdAt: new Date().toISOString() };
    return data;
  });

  req.app.get('io').emit('data:updated');
  res.redirect(`/opd-slip/${db.lastSlip.patientId}`);
});

router.get('/patients', ensureAuth, (req, res) => {
  const db = readDB();
  const { search } = req.query;
  let patients = db.patients;
  if (search) patients = patients.filter((p) => p.id.includes(search) || p.phone.includes(search));
  res.render('patient-list', { user: req.session.user, patients, search: search || '' });
});

router.get('/opd-slip/:patientId', ensureAuth, (req, res) => {
  const db = readDB();
  const patient = db.patients.find((p) => p.id === req.params.patientId);
  const queueItem = db.queue.find((q) => q.patientId === req.params.patientId);
  res.render('opd-slip', { user: req.session.user, patient, queueItem });
});

router.get('/queue', ensureAuth, (req, res) => {
  const db = readDB();
  const department = req.query.department || '';
  let queue = db.queue;
  if (department) queue = queue.filter((q) => q.department === department);
  queue = queue.sort((a, b) => (b.emergency - a.emergency) || a.token.localeCompare(b.token));
  res.render('queue', { user: req.session.user, queue, departments, selectedDepartment: department });
});

router.post('/queue/:id/next', ensureAuth, (req, res) => {
  updateDB((db) => {
    const item = db.queue.find((q) => q.id === req.params.id);
    if (item) item.status = 'called';
    return db;
  });
  req.app.get('io').emit('data:updated');
  res.redirect('/queue');
});

router.get('/live-dashboard', ensureAuth, (req, res) => {
  const db = readDB();
  res.render('live-dashboard', { user: req.session.user, db, departments });
});

router.get('/doctors', ensureAuth, (req, res) => {
  const db = readDB();
  const status = req.query.status || '';
  let doctors = db.doctors;
  if (status) doctors = doctors.filter((d) => d.status === status);
  res.render('doctors', { user: req.session.user, doctors, status });
});

router.post('/doctors/:id/status', ensureAuth, (req, res) => {
  updateDB((db) => {
    const doc = db.doctors.find((d) => d.id === req.params.id);
    if (doc) doc.status = req.body.status;
    return db;
  });
  req.app.get('io').emit('data:updated');
  res.redirect('/doctors');
});

router.get('/beds', ensureAuth, (req, res) => {
  const db = readDB();
  res.render('beds', { user: req.session.user, beds: db.beds, threshold: db.settings.bedAlertThreshold });
});

router.post('/beds/add', ensureAuth, (req, res) => {
  updateDB((db) => {
    db.beds.push({ id: `B${Date.now()}`, label: req.body.label, type: req.body.type, status: req.body.status });
    return db;
  });
  req.app.get('io').emit('data:updated');
  res.redirect('/beds');
});

router.post('/beds/:id/status', ensureAuth, (req, res) => {
  updateDB((db) => {
    const bed = db.beds.find((b) => b.id === req.params.id);
    if (bed) bed.status = req.body.status;
    return db;
  });
  req.app.get('io').emit('data:updated');
  res.redirect('/beds');
});

router.get('/billing', ensureAuth, (req, res) => {
  const db = readDB();
  res.render('billing', { user: req.session.user, patients: db.patients, bill: null });
});

router.post('/billing', ensureAuth, (req, res) => {
  const body = req.body;
  const values = ['consultationFee', 'labCharges', 'medicineCharges', 'bedCharges', 'emergencyCharges', 'otherCharges']
    .map((k) => Number(body[k] || 0));
  const subtotal = values.reduce((a, b) => a + b, 0);
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  const db = updateDB((data) => {
    const bill = {
      id: `BL${Date.now()}`,
      patientId: body.patientId,
      patientName: body.patientName,
      ...Object.fromEntries(['consultationFee', 'labCharges', 'medicineCharges', 'bedCharges', 'emergencyCharges', 'otherCharges'].map((k) => [k, Number(body[k] || 0)])),
      subtotal,
      tax,
      total,
      date: new Date().toISOString()
    };
    data.bills.push(bill);
    data.lastBillId = bill.id;
    return data;
  });

  req.app.get('io').emit('data:updated');
  res.redirect(`/receipt/new/${db.lastBillId}`);
});

router.get('/receipt/new/:billId', ensureAuth, (req, res) => {
  const db = readDB();
  const bill = db.bills.find((b) => b.id === req.params.billId);
  res.render('receipt', { user: req.session.user, bill, receipt: null });
});

router.post('/receipt/new/:billId', ensureAuth, (req, res) => {
  const body = req.body;
  const db = updateDB((data) => {
    const bill = data.bills.find((b) => b.id === req.params.billId);
    const receipt = {
      id: `R${Date.now()}`,
      receiptNumber: `RCPT-${Date.now()}`,
      billId: bill.id,
      patientId: bill.patientId,
      patientName: bill.patientName,
      servicesSummary: `Consultation + Lab + Medicine + Bed + Emergency + Other`,
      amountPaid: bill.total,
      paymentMode: body.paymentMode,
      paymentDate: new Date().toISOString(),
      paymentStatus: body.paymentStatus
    };
    receipt.pdfPath = path.relative(path.join(__dirname, '..'), generateReceiptPdf(receipt));
    data.receipts.push(receipt);
    data.lastReceipt = receipt;
    return data;
  });

  req.app.get('io').emit('data:updated');
  res.render('receipt', { user: req.session.user, bill: db.bills.find((b) => b.id === req.params.billId), receipt: db.lastReceipt });
});

router.get('/receipt/pdf/:receiptId', ensureAuth, (req, res) => {
  const db = readDB();
  const receipt = db.receipts.find((r) => r.id === req.params.receiptId);
  if (!receipt) return res.status(404).send('Not found');
  return res.download(path.join(__dirname, '..', receipt.pdfPath));
});

router.get('/reports', ensureAuth, (req, res) => {
  const db = readDB();
  const deptLoad = departments.map((d) => ({ department: d, count: db.queue.filter((q) => q.department === d).length }));
  const doctorWorkload = db.doctors.map((d) => ({ name: d.name, completed: db.queue.filter((q) => q.department === d.department && q.status === 'completed').length }));
  const occupied = db.beds.filter((b) => b.status === 'occupied').length;
  res.render('reports', {
    user: req.session.user,
    report: {
      patientCount: db.patients.length,
      emergencyCases: db.patients.filter((p) => p.emergency).length,
      revenue: db.receipts.reduce((s, r) => s + Number(r.amountPaid || 0), 0),
      deptLoad,
      doctorWorkload,
      bedUtilization: db.beds.length ? Math.round((occupied / db.beds.length) * 100) : 0
    }
  });
});

router.get('/settings', ensureAuth, (req, res) => {
  const db = readDB();
  res.render('settings', { user: req.session.user, settings: db.settings });
});

router.post('/settings', ensureAuth, (req, res) => {
  updateDB((db) => {
    db.settings.bedAlertThreshold = Number(req.body.bedAlertThreshold || db.settings.bedAlertThreshold);
    db.settings.queueAlertThreshold = Number(req.body.queueAlertThreshold || db.settings.queueAlertThreshold);
    return db;
  });
  req.app.get('io').emit('data:updated');
  res.redirect('/settings');
});

router.get('/api/live-stats', ensureAuth, (req, res) => {
  const db = readDB();
  const waiting = db.queue.filter((q) => q.status === 'waiting').length;
  const called = db.queue.filter((q) => q.status === 'called').length;
  const inConsultation = db.queue.filter((q) => q.status === 'in consultation').length;
  const availableDoctors = db.doctors.filter((d) => d.status === 'Available').length;
  const availableBeds = db.beds.filter((b) => b.status === 'available').length;

  res.json({ db, waiting, called, inConsultation, availableDoctors, availableBeds });
});

module.exports = router;
