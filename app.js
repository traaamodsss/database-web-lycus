const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require("path");
const app = express();

require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const FILE_PATH = process.env.FILE_PATH;
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1);
app.use(session({
  secret: 'exofloods-super-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// --- FUNGSI AMBIL DATA ---
async function fetchData() {
  try {
    const res = await fetch(GITHUB_API_URL, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    const json = await res.json();
    if (!json.content) return [];
    const content = Buffer.from(json.content, 'base64').toString('utf-8');
    return JSON.parse(content);
  } catch (e) { return []; }
}

// --- FUNGSI UPDATE DATA ---
async function updateData(newData) {
  try {
    const getRes = await fetch(GITHUB_API_URL, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Cache-Control': 'no-cache' }
    });
    const getData = await getRes.json();
    if (!getData.sha) return false;

    const base64Content = Buffer.from(JSON.stringify(newData, null, 2)).toString('base64');
    const putRes = await fetch(GITHUB_API_URL, {
      method: 'PUT',
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Dashboard Update', content: base64Content, sha: getData.sha })
    });
    return putRes.ok;
  } catch (e) { return false; }
}

// --- ROUTES ---
app.get('/set', (req, res) => res.json({ contact_whatsapp: process.env.CONTACT_OWNER, api_title: process.env.API_TITLE }));

// Dashboard User & Tambah Nomor
app.get('/', async (req, res) => {
  if (!req.session.isUser) return res.redirect('/login');
  const data = await fetchData();
  const msg = req.session.message; req.session.message = null;
  res.render('user', { data, message: msg });
});

app.post('/tambah-nomor', async (req, res) => {
  let { number } = req.body;
  if (!number) return res.redirect('/');
  let data = await fetchData();
  number = number.replace(/[^0-9]/g, "");
  if (data.find(i => i.number === number)) { req.session.message = "Nomor sudah ada!"; }
  else {
    data.push({ number, status: 'active' });
    await updateData(data);
    req.session.message = "Berhasil disimpan!";
  }
  res.redirect('/');
});

// Dashboard Admin & Aksi
app.get('/admin', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login-admin');
  const data = await fetchData();
  const msg = req.session.message; req.session.message = null;
  res.render('admin', { data, message: msg });
});

app.post('/hapus-nomor', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).send('Akses Ditolak');
  let data = await fetchData();
  data = data.filter(i => i.number !== req.body.number);
  await updateData(data);
  req.session.message = "Nomor telah dihapus!";
  res.redirect('/admin');
});

app.post('/status-nomor', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).send('Akses Ditolak');
  let data = await fetchData();
  data = data.map(i => i.number === req.body.number ? { ...i, status: req.body.status } : i);
  await updateData(data);
  req.session.message = "Status diperbarui!";
  res.redirect('/admin');
});

// Auth
app.get('/login', (req, res) => res.render('login', { message: null }));
app.post('/login', (req, res) => {
  if (req.body.password === process.env.PW_USER_LOGIN) { req.session.isUser = true; res.redirect('/'); }
  else { res.render('login', { message: "Sandi Salah!" }); }
});

app.get('/login-admin', (req, res) => res.render('login-admin', { message: null }));
app.post('/login-admin', (req, res) => {
  if (req.body.password === process.env.PW_ADMIN_LOGIN) { req.session.isAdmin = true; res.redirect('/admin'); }
  else { res.render('login-admin', { message: "Sandi Admin Salah!" }); }
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

module.exports = app;
