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
  secret: 'raza-mods-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

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

async function updateData(newData) {
  try {
    const getRes = await fetch(GITHUB_API_URL, { headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Cache-Control': 'no-cache' } });
    const getData = await getRes.json();
    if (!getData.sha) return false;
    const base64Content = Buffer.from(JSON.stringify(newData, null, 2)).toString('base64');
    const putRes = await fetch(GITHUB_API_URL, {
      method: 'PUT',
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Update via Web', content: base64Content, sha: getData.sha })
    });
    return putRes.ok;
  } catch (e) { return false; }
}

// -- ROUTES --

app.get('/set', (req, res) => {
  res.json({ 
    contact_whatsapp: process.env.CONTACT_OWNER || "https://wa.me/6283840240138",
    api_title: process.env.API_TITLE || "Ochobot Database",
    channel_link: "https://whatsapp.com/channel/0029Vb6KMNq7IUYLgWR6KY0C"
  });
});

// Halaman Tabel Admin
app.get('/admin', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login-admin');
  const data = await fetchData();
  const msg = req.session.message; req.session.message = null;
  res.render('admin', { data, message: msg });
});

// PROSES TAMBAH NOMOR (Ubah action ke sini)
app.post('/aksi-tambah', async (req, res) => {
  let { number } = req.body;
  if (!number) return res.redirect('/admin');
  let data = await fetchData();
  number = number.replace(/[^0-9]/g, "");
  if (!data.find(i => i.number === number)) {
    data.push({ number, status: 'active' });
    await updateData(data);
    req.session.message = "Berhasil Menambah Nomor! ✓";
  } else {
    req.session.message = "Nomor Sudah Ada!";
  }
  res.redirect('/admin');
});

// PROSES HAPUS
app.post('/aksi-hapus', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).send('Forbidden');
  let data = await fetchData();
  data = data.filter(i => i.number !== req.body.number);
  await updateData(data);
  req.session.message = "Nomor Berhasil Dihapus!";
  res.redirect('/admin');
});

// Login Admin
app.get('/login-admin', (req, res) => res.render('login-admin', { message: null }));
app.post('/login-admin', (req, res) => {
  if (req.body.password === process.env.PW_ADMIN_LOGIN) {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.redirect('/login-admin');
  }
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login-admin'); });

module.exports = app;
