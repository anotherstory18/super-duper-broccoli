# Smart Hospital Management, Live Queue & Emergency Bed Dashboard

A full-stack laptop-friendly hospital web app built with **Node.js + Express + EJS + Socket.io + local JSON data storage**.

## ✅ Runs with only VS Code + Node.js
No MongoDB, MySQL, PostgreSQL, Firebase, Docker, or cloud account required.

## Features
- Role-based login (Admin, Receptionist, Doctor)
- Admin dashboard with KPI cards + Chart.js
- Reception dashboard
- Doctor dashboard with queue actions and consultation notes
- Patient registration with auto Patient ID + OPD token + printable OPD slip
- Smart OPD queue with emergency prioritization and status tracking
- Doctor availability management
- Emergency/ICU/Ward bed dashboard with live status
- Billing and receipt generation
- PDF receipt download (PDFKit)
- Reports page with charts and utilization metrics
- Live hospital monitor page with Socket.io updates
- Search/filter tools for patients, queue, doctors
- Settings page for alert thresholds

## Folder Structure
```
hospital-management-system/
  package.json
  server.js
  README.md
  routes/
  controllers/
  models/
  views/
  public/
  data/
  utils/
```

## Setup (Local Laptop)
```bash
npm install
npm start
```
Then open: `http://localhost:3000`

## Demo Login Credentials
- **Admin**: `admin` / `admin123`
- **Receptionist**: `reception` / `recep123`
- **Doctor**: `doctor1` / `doc123`

## Core Modules
1. **Authentication**: simple local user check from JSON file.
2. **Patient Registration**: captures details, generates patient ID and token.
3. **Queue Engine**: department queue, emergency priority, waiting statuses.
4. **Doctor Module**: per-department queue, status updates, consultation notes.
5. **Bed Management**: ICU/Emergency/Ward statuses with threshold warning.
6. **Billing + Receipts**: fee breakdown, total with tax, printable receipt + PDF.
7. **Dashboards**: admin analytics + live hospital monitor with Socket.io.
8. **Reports**: department load, doctor workload, bed utilization.

## Data Storage
- Single file local DB: `data/db.json`
- PDF receipts generated into: `data/receipts/`

## Notes for Exhibition Demo
- Use **Live Dashboard** on a large screen to show real-time hospital status.
- Use **Patient Registration → Queue → Doctor Dashboard → Billing → Receipt** flow for an end-to-end demo.
- Project branding uses hospital name: **MediFlow City Hospital**.
