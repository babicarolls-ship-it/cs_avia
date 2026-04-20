require('dotenv').config();
const express = require('express');
const https   = require('https');
const path    = require('path');
const db      = require('./database');

const app    = express();
const PORT   = process.env.PORT || 3000;
const WEBHOOK_SECRET   = process.env.WEBHOOK_SECRET   || '';
const CHATGURU_URL     = process.env.CHATGURU_URL     || 'https://s18.chatguru.app';
const CHATGURU_COOKIE  = process.env.CHATGURU_COOKIE  || '';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ──────────────────────────────────────────────────────────────────
function cgFetch(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(CHATGURU_URL + path);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: { Cookie: CHATGURU_COOKIE, 'User-Agent': 'Mozilla/5.0' },
    };
    https.get(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode === 302) return resolve(null);
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    }).on('error', reject);
  });
}

function dateDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

// ── Webhook receiver ─────────────────────────────────────────────────────────
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

// ── Proxy ChatGuru histórico ──────────────────────────────────────────────────
app.get('/api/historico', async (req, res) => {
  const from = req.query.from || dateDaysAgo(30);
  const to   = req.query.to   || dateDaysAgo(0);
  const phone = req.query.phone || '';

  if (!CHATGURU_COOKIE)
    return res.status(503).json({ error: 'CHATGURU_COOKIE não configurado' });

  const data = await cgFetch(
    `/charts/data?date_from=${from}&date_to=${to}&sunday=undefined&saturday=undefined&phone_id=${phone}`
  );

  if (!data) return res.status(502).json({ error: 'Sessão expirada — atualize o cookie' });
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

// Dados de teste
app.post('/api/teste', (req, res) => {
  const atendentes = ['Carolina Suzarte','Bruna','Isabella','Julia','Anderson','Caroline Vieira'];
  const equipes    = ['Suporte ao aluno','Renovação','Financeiro','Abby','Outros assuntos'];
  const statuses   = ['encerramento','delegacao'];

  for (let i = 0; i < 20; i++) {
    db.insert({
      phone_id:    '69dd57b8e026e4843d55b5eb',
      chat_number: `5519${Math.floor(Math.random() * 900000000 + 100000000)}`,
      atendente:   atendentes[Math.floor(Math.random() * atendentes.length)],
      equipe:      equipes[Math.floor(Math.random() * equipes.length)],
      status_chat: statuses[Math.floor(Math.random() * statuses.length)],
      event_type:  'encerramento',
      raw:         JSON.stringify({ teste: true }),
    });
  }
  res.json({ ok: true, inseridos: 20 });
});

app.listen(PORT, () => {
  console.log(`✓ http://localhost:${PORT}`);
  console.log(`  Cookie: ${CHATGURU_COOKIE ? 'configurado' : 'NÃO configurado'}`);
});
