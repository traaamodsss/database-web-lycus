const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require("path");
const app = express();

require('dotenv').config();

// === Konfigurasi GitHub ===
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const FILE_PATH = process.env.FILE_PATH;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;

const ADMIN_PASSWORD = process.env.PW_ADMIN_LOGIN;
const USER_PASSWORD = process.env.PW_USER_LOGIN;

const settings = {
  contact_whatsapp: process.env.CONTACT_OWNER,
  api_title: process.env.API_TITLE
};

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Penting untuk Session di Vercel
app.set('trust proxy', 1); 
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// --- Helper Functions ---
async function fetchData() {
  const res = await fetch(GITHUB_API_URL, {
    headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
  });
  const json = await res.json();
  if (!json.content) return [];
  const content = Buffer.from(json.content, 'base64').toString('utf-8');
  return JSON.parse(content);
}

async function updateData(newData) {
  try {
    // 1. Ambil data terbaru untuk mendapatkan SHA terbaru
    const res = await fetch(GITHUB_API_URL, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
    });
    const current = await res.json();

    if (!current.sha) {
      console.error("Gagal mendapatkan SHA file:", current.message);
      return;
    }

    // 2. Encode konten baru ke Base64
    const base64Content = Buffer.from(JSON.stringify(newData, null, 2)).toString('base64');

    // 3. Kirim update ke GitHub
    const updateRes = await fetch(GITHUB_API_URL, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Update database via Web Dashboard',
        content: base64Content,
        sha: current.sha // SHA wajib disertakan untuk update
      })
    });

    const result = await updateRes.json();
    if (result.content) {
      console.log("Database berhasil diperbarui di GitHub");
    } else {
      console.error("Gagal update GitHub:", result.message);
    }
  } catch (err) {
    console.error("Error pada fungsi updateData:", err);
  }
}

function authMiddleware(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/login-admin');
}

function authMiddlewareUser(req, res, next) {
  if (req.session && req.session.isUser) return next();
  res.redirect('/login');
}

// === ROUTES ===
app.get('/set', (req, res) => res.json(settings));

app.get('/', authMiddlewareUser, async (req, res) => {
  const message = req.session.message;
  req.session.message = null;
  const data = await fetchData();
  res.render('user', { message, data });
});

app.post('/add', authMiddlewareUser, async (req, res) => {
  let { number } = req.body;
  cconst express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require("path");
const app = express();

require('dotenv').config();

// Config
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
  secret: 'exofloods-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// --- FUNGSI AMBIL DATA (FETCH) ---
async function fetchData() {
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    const result = await response.json();
    if (!result.content) return [];
    const content = Buffer.from(result.content, 'base64').toString('utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error("Error Fetch:", e);
    return [];
  }
}

// --- FUNGSI UPDATE DATA (PUT) ---
async function updateData(newData) {
  try {
    // 1. Ambil SHA terbaru (Wajib buat update GitHub)
    const getRes = await fetch(GITHUB_API_URL, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
    });
    const getData = await getRes.json();
    
    if (!getData.sha) {
        console.error("Gagal dapet SHA. Cek GITHUB_TOKEN atau FILE_PATH lo!");
        return false;
    }

    const base64Content = Buffer.from(JSON.stringify(newData, null, 2)).toString('base64');

    // 2. Kirim data baru
    const putRes = await fetch(GITHUB_API_URL, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Update via Web',
        content: base64Content,
        sha: getData.sha // ID versi file
      })
    });

    const finalResult = await putRes.json();
    return !!finalResult.content;
  } catch (e) {
    console.error("Error Update:", e);
    return false;
  }
}

// --- ROUTES ---
app.get('/set', (req, res) => {
    res.json({
        contact_whatsapp: process.env.CONTACT_OWNER,
        api_title: process.env.API_TITLE
    });
});

app.get('/', async (req, res) => {
  if (!req.session.isUser) return res.redirect('/login');
  const data = await fetchData();
  res.render('user', { data, message: req.session.message });
  req.session.message = null;
});

app.post('/add', async (req, res) => {
  let { number } = req.body;
  if (!number) return res.redirect('/');

  const data = await fetchData();
  number = number.replace(/[^0-9]/g, "");

  if (data.find(i => i.number === number)) {
    req.session.message = "Nomor sudah ada!";
  } else {
    data.push({ number, status: 'active' });
    const success = await updateData(data);
    req.session.message = success ? "Berhasil disimpan! ✓" : "Gagal simpan ke GitHub! ❌";
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
  secret: 'exofloods-secret-admin',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// --- FUNGSI AMBIL DATA ---
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

// --- FUNGSI UPDATE DATA (DENGAN SHA CHECK) ---
async function updateData(newData) {
  try {
    const getRes = await fetch(GITHUB_API_URL, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
    });
    const getData = await getRes.json();
    if (!getData.sha) return false;

    const base64Content = Buffer.from(JSON.stringify(newData, null, 2)).toString('base64');
    const putRes = await fetch(GITHUB_API_URL, {
      method: 'PUT',
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Admin Update via Web',
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

// --- ROUTES ADMIN ---
app.get('/admin', async (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/login-admin');
  const data = await fetchData();
  const message = req.session.message;
  req.session.message = null;
  res.render('admin', { data, message });
});

app.post('/delete', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).send('Unauthorized');
  const { number } = req.body;
  let data = await fetchData();
  data = data.filter(item => item.number !== number);
  const success = await updateData(data);
  req.session.message = success ? "Nomor dihapus! ✓" : "Gagal hapus! ❌";
  res.redirect('/admin');
});

app.post('/blacklist', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).send('Unauthorized');
  const { number } = req.body;
  let data = await fetchData();
  data = data.map(item => item.number === number ? { ...item, status: 'blacklist' } : item);
  const success = await updateData(data);
  req.session.message = success ? "Berhasil Blacklist! ✓" : "Gagal! ❌";
  res.redirect('/admin');
});

app.post('/whitelist', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).send('Unauthorized');
  const { number } = req.body;
  let data = await fetchData();
  data = data.map(item => item.number === number ? { ...item, status: 'active' } : item);
  const success = await updateData(data);
  req.session.message = success ? "Berhasil Whitelist! ✓" : "Gagal! ❌";
  res.redirect('/admin');
});

// --- LOGIN ROUTES ---
app.get('/login-admin', (req, res) => {
  res.render('login-admin', { message: req.session.message });
  req.session.message = null;
});

app.post('/login-admin', (req, res) => {
  if (req.body.password === process.env.PW_ADMIN_LOGIN) {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    req.session.message = "Sandi Admin Salah!";
    res.redirect('/login-admin');
  }
});

// Route lainnya (Set, User login, Add) tetep sama kayak sebelumnya...
app.get('/set', (req, res) => res.json({ contact_whatsapp: process.env.CONTACT_OWNER, api_title: process.env.API_TITLE }));

app.get('/', async (req, res) => {
  if (!req.session.isUser) return res.redirect('/login');
  const data = await fetchData();
  res.render('user', { data, message: req.session.message });
  req.session.message = null;
});

app.post('/add', async (req, res) => {
  let { number } = req.body;
  if (!number) return res.redirect('/');
  const data = await fetchData();
  number = number.replace(/[^0-9]/g, "");
  if (data.find(i => i.number === number)) {
    req.session.message = "Nomor sudah ada!";
  } else {
    data.push({ number, status: 'active' });
    const success = await updateData(data);
    req.session.message = success ? "Berhasil disimpan! ✓" : "Gagal simpan! ❌";
  }
  res.redirect('/');
});

app.get('/login', (req, res) => {
    res.render('login', { message: req.session.message });
    req.session.message = null;
});

app.post('/login', (req, res) => {
  if (req.body.password === process.env.PW_USER_LOGIN) {
    req.session.isUser = true;
    res.redirect('/');
  } else {
    req.session.message = "Sandi Salah!";
    res.redirect('/login');
  }
});

module.exports = app;

// Jalankan lokal
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
