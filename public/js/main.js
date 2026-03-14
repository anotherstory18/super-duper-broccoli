const timeEl = document.getElementById('liveTime');
if (timeEl) setInterval(() => (timeEl.textContent = new Date().toLocaleString()), 1000);

if (window.adminStats && document.getElementById('adminChart')) {
  new Chart(document.getElementById('adminChart'), {
    type: 'bar',
    data: { labels: ['Patients','Revenue','Doctors','Avail Beds','Queue','Emergency'], datasets: [{ label:'Today', data:[window.adminStats.patientsToday, window.adminStats.totalRevenueToday, window.adminStats.activeDoctors, window.adminStats.availableBeds, window.adminStats.opdQueueLoad, window.adminStats.emergencyCount], backgroundColor:'#1f5fa8' }] }
  });
}

if (window.reportData) {
  new Chart(document.getElementById('deptChart'), {
    type: 'pie',
    data: { labels: window.reportData.deptLoad.map(d=>d.department), datasets: [{ data: window.reportData.deptLoad.map(d=>d.count) }] }
  });
  new Chart(document.getElementById('workloadChart'), {
    type: 'bar',
    data: { labels: window.reportData.doctorWorkload.map(d=>d.name), datasets: [{ label:'Completed Consultations', data: window.reportData.doctorWorkload.map(d=>d.completed), backgroundColor:'#16a34a' }] }
  });
}

const socket = io();
socket.on('data:updated', () => {
  if (location.pathname === '/live-dashboard' || location.pathname.includes('dashboard')) location.reload();
});

if (window.liveData && document.getElementById('liveBoard')) {
  const db = window.liveData;
  const waiting = db.queue.filter(q=>q.status==='waiting').length;
  const admitted = db.beds.filter(b=>b.status==='occupied').length;
  const availableBeds = db.beds.filter(b=>b.status==='available').length;
  const currentByDept = {};
  db.queue.forEach(q => { if (q.status !== 'completed' && !currentByDept[q.department]) currentByDept[q.department] = q.token; });
  const cards = [
    ['Waiting Patients', waiting],
    ['Available Doctors', db.doctors.filter(d=>d.status==='Available').length],
    ['Emergency Beds Available', db.beds.filter(b=>b.type==='Emergency'&&b.status==='available').length],
    ['ICU Beds Available', db.beds.filter(b=>b.type==='ICU'&&b.status==='available').length],
    ['General Ward Beds Available', db.beds.filter(b=>b.type==='General Ward'&&b.status==='available').length],
    ['Admitted Patients', admitted],
    ['Discharged Patients', Math.max(0, db.receipts.length-admitted)]
  ];
  document.getElementById('liveBoard').innerHTML = cards.map(c=>`<div class='card'>${c[0]} <strong>${c[1]}</strong></div>`).join('') +
    `<div class='card'><h4>Current Tokens by Department</h4>${Object.entries(currentByDept).map(([d,t])=>`<p>${d}: <strong>${t}</strong></p>`).join('')}</div>`;

  const alert = document.getElementById('liveAlert');
  if (waiting > 8) alert.textContent = '⚠️ Queue load is high. Please open additional OPD counters.';
  if (availableBeds <= 2) alert.textContent += ' ⚠️ Beds are nearly full.';
}
