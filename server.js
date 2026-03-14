const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const { Server } = require('socket.io');
const routes = require('./routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('io', io);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data/receipts', express.static(path.join(__dirname, 'data', 'receipts')));
app.use(
  session({
    secret: 'mediflow-secret',
    resave: false,
    saveUninitialized: false
  })
);

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPath = req.path;
  next();
});

app.use(routes);

io.on('connection', (socket) => {
  socket.emit('message', 'Connected to MediFlow live updates');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`MediFlow app running on http://localhost:${PORT}`);
});
