const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require("path");
const app = express();

require('dotenv').config();

// Config GitHub
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
  secret: 'exofloods-final-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// --- FUNGSI CORE GITHUB ---
async function fetchData() {
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    const result = await response.json();
    if (!result.content) return [];
    const content = Buffer.from(result.content, 'base64').toString('utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Fetch Error:", e);
    return [];
  }
}

async function updateData(newData) {
  try {
    // WAJIB ambil SHA terbaru setiap kali aksi agar tidak Conflict 409
    const getRes = await fetch(GITHUB_API_URL, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Cache-Control': 'no-cache' }
    });
    const getData = await getRes.json();
    
    if (!getData.sha) {
      console.error("Gagal dapet SHA:", getData.message);
      return false;
    }

    const base64Content = Buffer.from(JSON.stringify(newData, null, 2)).toString('base64');
    const putRes = await fetch(GITHUB_API_URL, {
      method: 'PUT',
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Update via Web',
        content: base64Content,
        sha: getData.sha
      })
    });
    
    return putRes.ok;
  } catch (e) {
    console.error("Update Error:", e);
    return false;
  }
}

// --- ROUTES ---

app.get('/set', (req, res) => res.json({ 
    contact_whatsapp: process.env.CONTACT_OWNER, 
    api_title: process.env.API_TITLE 
}));

// Admin & User Dashboard
app.get('/', async (req, res) => {
  if (!req.session.isUser) return res.redirect('/login');
  const data = await fetchData();
  const message = req.session.message;
  req.session.message = null;
  res.render('user', { data, message });
});

app.get('/admin', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login-admin');
  const data = await fetchData();
  const message = req.session.message;
  req.session.message = null;
  res.render('admin', { data, message });
});

// Aksi Tambah Nomor (User)
app.post('/add', async (req, res) => {
  let { number } = req.body;
  if (!number) return res.redirect('/');
  
  let data = await fetchData();
  number = number.replace(/[^0-9]/g, "");
  
  if (data.find(i => i.number === number)) {
    req.session.message = "Nomor sudah terdaftar!";
  } else {
    data.push({ number, status: 'active' });
    const success = await updateData(data);
    req.session.message = success ? "Berhasil menambah nomor ✓" : "Gagal simpan (Cek Token/Repo) ❌";
  }
  res.redirect('/');
});

// Aksi Admin (Hapus/Blacklist/Whitelist)
app.post('/delete', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login-admin');
  let data = await fetchData();
  data = data.filter(item => item.number !== req.body.number);
  const success = await updateData(data);
  req.session.message = success ? "Berhasil dihapus ✓" : "Gagal hapus ❌";
  res.redirect('/admin');
});

app.post('/blacklist', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login-admin');
  let data = await fetchData();
  data = data.map(i => i.number === req.body.number ? { ...i, status: 'blacklist' } : i);
  const success = await updateData(data);
  req.session.message = success ? "Berhasil blacklist ✓" : "Gagal update ❌";
  res.redirect('/admin');
});

app.post('/whitelist', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login-admin');
  let data = await fetchData();
  data = data.map(i => i.number === req.body.number ? { ...i, status: 'active' } : i);
  const success = await updateData(data);
  req.session.message = success ? "Berhasil diaktifkan ✓" : "Gagal update ❌";
  res.redirect('/admin');
});

// Auth
app.get('/login', (req, res) => res.render('login', { message: null }));
app.post('/login', (req, res) => {
  if (req.body.password === process.env.PW_USER_LOGIN) {
    req.session.isUser = true;
    res.redirect('/');
  } else {
    res.render('login', { message: "Sandi Salah!" });
  }
});

app.get('/login-admin', (req, res) => res.render('login-admin', { message: null }));
app.post('/login-admin', (req, res) => {
  if (req.body.password === process.env.PW_ADMIN_LOGIN) {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.render('login-admin', { message: "Sandi Admin Salah!" });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = app;
