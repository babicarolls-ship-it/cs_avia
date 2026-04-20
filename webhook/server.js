require('dotenv').config();
const express = require('express');
const https   = require('https');
const path    = require('path');
const db      = require('./database');

const app   = express();
const PORT  = process.env.PORT || 3000;
const WEBHOOK_SECRET  = process.env.WEBHOOK_SECRET  || '';
const CHATGURU_URL    = process.env.CHATGURU_URL    || 'https://s18.chatguru.app';
const CHATGURU_EMAIL  = process.env.CHATGURU_EMAIL  || '';
const CHATGURU_PASS   = process.env.CHATGURU_PASS   || '';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Session manager ───────────────────────────────────────────────────────────
let sessionCookie = '';
let loginInProgress = false;

async function doLogin() {
  if (loginInProgress) return false;
  loginInProgress = true;
  console.log('[auth] Renovando sessão ChatGuru...');

  return new Promise(resolve => {
    const body = `email=${encodeURIComponent(CHATGURU_EMAIL)}&password=${encodeURIComponent(CHATGURU_PASS)}&browser_session=`;
    const host = new URL(CHATGURU_URL).hostname;

    const req = https.request({
      hostname: host,
      path: '/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Mozilla/5.0',
      }
    }, res => {
      loginInProgress = false;
      if (res.statusCode === 302) {
        const cookies = res.headers['set-cookie'] || [];
        const session = cookies.find(c => c.startsWith('session='));
        if (session) {
          sessionCookie = session.split(';')[0];
          console.log('[auth] Sessão renovada com sucesso.');
          resolve(true);
        } else {
          console.log('[auth] Login falhou — sem cookie de sessão.');
          resolve(false);
        }
      } else {
        console.log('[auth] Login falhou — status:', res.statusCode);
        resolve(false);
      }
    });
    req.on('error', e => { loginInProgress = false; console.log('[auth] Erro:', e.message); resolve(false); });
    req.write(body);
    req.end();
  });
}

async function cgFetch(urlPath, retry = true) {
  if (!sessionCookie) {
    const ok = await doLogin();
    if (!ok) return null;
  }

  return new Promise(async resolve => {
    const url = new URL(CHATGURU_URL + urlPath);
    https.get({
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: { Cookie: sessionCookie, 'User-Agent': 'Mozilla/5.0' },
    }, res => {
      if (res.statusCode === 302 && retry) {
        // Sessão expirou — faz login e tenta de novo
        sessionCookie = '';
        doLogin().then(ok => ok ? cgFetch(urlPath, false).then(resolve) : resolve(null));
        return;
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function dateDaysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

// Renovação preventiva a cada 6h
if (CHATGURU_EMAIL && CHATGURU_PASS) {
  doLogin();
  setInterval(doLogin, 6 * 60 * 60 * 1000);
}

// ── Webhook receiver ──────────────────────────────────────────────────────────
app.post('/webhook', (req, res) => {
  const body = req.body;
  if (WEBHOOK_SECRET && body.secret !== WEBHOOK_SECRET)
    return res.status(401).json({ error: 'unauthorized' });

  db.insert({
    phone_id:    body.phone_id    || null,
    chat_number: body.chat_number || body.numero || null,
    atendente:   body.atendente   || body.operador || body.operator || null,
    equipe:      body.equipe      || body.team || body.nome_campanha || body.campanha_nome || null,
    status_chat: body.status      || body.status_chat || null,
    event_type:  body.campanha_id || body.tipo || body.type || null,
    campanha_id: body.campanha_id || null,
    tags:        body.tags        || null,
    raw:         JSON.stringify(body),
  });

  res.json({ ok: true });
});

// ── Proxy histórico ChatGuru ──────────────────────────────────────────────────
app.get('/api/historico', async (req, res) => {
  if (!CHATGURU_EMAIL || !CHATGURU_PASS)
    return res.status(503).json({ error: 'CHATGURU_EMAIL/PASS não configurados' });

  const from  = req.query.from  || dateDaysAgo(30);
  const to    = req.query.to    || dateDaysAgo(0);
  const phone = req.query.phone || '';

  const data = await cgFetch(
    `/charts/data?date_from=${from}&date_to=${to}&sunday=undefined&saturday=undefined&phone_id=${phone}`
  );

  if (!data) return res.status(502).json({ error: 'Falha ao buscar dados — verifique credenciais' });
  res.json(data);
});

// ── API webhooks em tempo real ────────────────────────────────────────────────
app.get('/api/resumo',           (req, res) => res.json(db.resumo()));
app.get('/api/por-atendente',    (req, res) => res.json(db.groupBy('atendente')));
app.get('/api/por-equipe',       (req, res) => res.json(db.groupBy('equipe')));
app.get('/api/por-status',       (req, res) => res.json(db.groupBy('status_chat')));
app.get('/api/volume-diario',    (req, res) => res.json(db.volumeDiario()));
app.get('/api/volume-horario',   (req, res) => res.json(db.volumeHorario()));
app.get('/api/eventos-recentes', (req, res) => res.json(db.recentes()));

app.post('/api/teste', (req, res) => {
  const atendentes = ['Carolina Suzarte','Bruna','Isabella','Julia','Anderson','Caroline Vieira'];
  const equipes    = ['Suporte ao aluno','Renovação','Financeiro','Abby','Outros assuntos'];
  for (let i = 0; i < 20; i++) {
    db.insert({
      phone_id:    '69dd57b8e026e4843d55b5eb',
      chat_number: `5519${Math.floor(Math.random() * 900000000 + 100000000)}`,
      atendente:   atendentes[Math.floor(Math.random() * atendentes.length)],
      equipe:      equipes[Math.floor(Math.random() * equipes.length)],
      status_chat: ['encerramento','delegacao'][Math.floor(Math.random() * 2)],
      event_type:  'encerramento',
      raw:         JSON.stringify({ teste: true }),
    });
  }
  res.json({ ok: true, inseridos: 20 });
});

app.listen(PORT, () => {
  console.log(`✓ http://localhost:${PORT}`);
  console.log(`  Auth: ${CHATGURU_EMAIL ? CHATGURU_EMAIL : 'NÃO configurado'}`);
});
