const https = require('https');
const fs    = require('fs');
const path  = require('path');

const DATA_DIR    = path.join(__dirname, 'data');
const COOKIE_FILE = path.join(DATA_DIR, 'session.txt');
const BASE_HOST   = new URL(process.env.CHATGURU_URL || 'https://s18.chatguru.app').hostname;

let sessionCookie = '';

function loadCookie() {
  const env = process.env.CHATGURU_COOKIE || '';
  if (env) return env;
  try { return fs.readFileSync(COOKIE_FILE, 'utf8').trim(); } catch { return ''; }
}

function saveCookie(val) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(COOKIE_FILE, val.trim());
}

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function login(email, password) {
  console.log('[auth] Iniciando login em', BASE_HOST);

  // 1. GET /login para pegar cookie inicial
  const get = await request({
    hostname: BASE_HOST, path: '/login', method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'pt-BR,pt;q=0.9' }
  });

  const initialCookies = (get.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');

  // Extrair UUID do browser_session do localStorage (simulado)
  const browserUUID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });

  // 2. POST /login com headers completos de browser
  const body = new URLSearchParams({ email, password, browser_session: browserUUID }).toString();

  const post = await request({
    hostname: BASE_HOST, path: '/login', method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'Referer': `https://${BASE_HOST}/login`,
      'Origin': `https://${BASE_HOST}`,
      'Cookie': initialCookies,
    }
  }, body);

  const location = post.headers['location'] || '';
  const setCookies = post.headers['set-cookie'] || [];
  const sessionPart = (setCookies.find(c => c.includes('session=')) || '').split(';')[0];

  if (post.status !== 302 || location.includes('/login')) {
    console.log('[auth] Login falhou — status:', post.status, 'location:', location);
    return false;
  }

  // Combinar cookies do GET + POST
  const allCookies = [
    ...initialCookies.split('; ').filter(c => !c.startsWith('session=')),
    sessionPart,
  ].filter(Boolean).join('; ');

  // Seguir redirect para estabelecer contexto completo da sessão
  const redirectPath = location.startsWith('http') ? new URL(location).pathname : location;
  const dashRes = await request({
    hostname: BASE_HOST, path: redirectPath, method: 'GET',
    headers: {
      'Cookie': allCookies,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': `https://${BASE_HOST}/login`,
    }
  });

  // Pegar cookie atualizado após navegar no dashboard
  const dashCookies = (dashRes.headers['set-cookie'] || []);
  const newSession = (dashCookies.find(c => c.includes('session=')) || '').split(';')[0];
  const finalSession = newSession || sessionPart;

  const otherCookies = initialCookies.split('; ').filter(c => !c.startsWith('session=')).join('; ');
  sessionCookie = [otherCookies, finalSession].filter(Boolean).join('; ');
  saveCookie(sessionCookie);
  console.log('[auth] Login OK — sessão completa salva.');
  return true;
}

async function fetch(urlPath, retried = false) {
  if (!sessionCookie) sessionCookie = loadCookie();

  const res = await request({
    hostname: BASE_HOST,
    path: urlPath,
    method: 'GET',
    headers: {
      'Cookie': sessionCookie,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json, text/javascript, */*',
      'Referer': `https://${BASE_HOST}/`,
    }
  });

  // Sessão expirou
  if (res.status === 302 && !retried) {
    const email = process.env.CHATGURU_EMAIL;
    const pass  = process.env.CHATGURU_PASS;
    if (email && pass) {
      const ok = await login(email, pass);
      if (ok) return fetch(urlPath, true);
    }
    return null;
  }

  try { return JSON.parse(res.body); } catch { return null; }
}

function setCookie(val) {
  sessionCookie = val.trim();
  saveCookie(sessionCookie);
}

module.exports = { login, fetch, setCookie, loadCookie };
