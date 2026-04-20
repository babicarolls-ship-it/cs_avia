require('dotenv').config();
const express = require('express');
const path    = require('path');
const db      = require('./database');
const auth    = require('./auth');

const app  = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar sessão ao subir
(async () => {
  const cookie = auth.loadCookie();
  if (cookie) {
    console.log('[init] Cookie carregado do arquivo/env.');
  } else if (process.env.CHATGURU_EMAIL && process.env.CHATGURU_PASS) {
    console.log('[init] Sem cookie — tentando login...');
    await auth.login(process.env.CHATGURU_EMAIL, process.env.CHATGURU_PASS);
  }
})();

// Renovar sessão a cada 6h
setInterval(async () => {
  if (process.env.CHATGURU_EMAIL && process.env.CHATGURU_PASS) {
    console.log('[cron] Renovando sessão...');
    await auth.login(process.env.CHATGURU_EMAIL, process.env.CHATGURU_PASS);
  }
}, 6 * 60 * 60 * 1000);

function dateDaysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

// ── Webhook receiver ──────────────────────────────────────────────────────────
app.post('/webhook', (req, res) => {
  const b = req.body;
  if (WEBHOOK_SECRET && b.secret !== WEBHOOK_SECRET)
    return res.status(401).json({ error: 'unauthorized' });

  db.insert({
    phone_id:    b.phone_id    || null,
    chat_number: b.chat_number || b.numero || null,
    atendente:   b.atendente   || b.operador || b.operator || null,
    equipe:      b.equipe      || b.team || b.nome_campanha || b.campanha_nome || null,
    status_chat: b.status      || b.status_chat || null,
    event_type:  b.campanha_id || b.tipo || b.type || null,
    campanha_id: b.campanha_id || null,
    tags:        b.tags        || null,
    raw:         JSON.stringify(b),
  });

  res.json({ ok: true });
});

// ── Proxy histórico ChatGuru ──────────────────────────────────────────────────
app.get('/api/historico', async (req, res) => {
  const from  = req.query.from  || dateDaysAgo(30);
  const to    = req.query.to    || dateDaysAgo(0);
  const phone = req.query.phone || '';

  const data = await auth.fetch(
    `/charts/data?date_from=${from}&date_to=${to}&sunday=undefined&saturday=undefined&phone_id=${phone}`
  );

  if (!data) return res.status(502).json({ error: 'Sessão expirada — clique em Atualizar Cookie' });
  res.json(data);
});

// ── Cookie manual ─────────────────────────────────────────────────────────────
app.post('/api/cookie', (req, res) => {
  const { cookie } = req.body;
  if (!cookie || !cookie.includes('session='))
    return res.status(400).json({ error: 'Cookie inválido — deve conter session=' });
  auth.setCookie(cookie.trim());
  res.json({ ok: true });
});

app.get('/api/cookie-status', (req, res) => {
  const c = auth.loadCookie();
  res.json({ configurado: !!c, tamanho: c.length });
});

// ── API webhooks ──────────────────────────────────────────────────────────────
app.get('/api/resumo',           (req, res) => res.json(db.resumo()));
app.get('/api/por-atendente',    (req, res) => res.json(db.groupBy('atendente')));
app.get('/api/por-equipe',       (req, res) => res.json(db.groupBy('equipe')));
app.get('/api/por-status',       (req, res) => res.json(db.groupBy('status_chat')));
app.get('/api/volume-diario',    (req, res) => res.json(db.volumeDiario()));
app.get('/api/volume-horario',   (req, res) => res.json(db.volumeHorario()));
app.get('/api/eventos-recentes', (req, res) => res.json(db.recentes()));

app.listen(PORT, () => {
  console.log(`✓ http://localhost:${PORT}`);
});
