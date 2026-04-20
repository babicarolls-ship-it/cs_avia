require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Webhook receiver ────────────────────────────────────────────────────────
app.post('/webhook', (req, res) => {
  const body = req.body;

  if (WEBHOOK_SECRET && body.secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  db.insert({
    phone_id:    body.phone_id    || body.phoneId    || null,
    chat_number: body.chat_number || body.numero     || null,
    atendente:   body.atendente   || body.operador   || body.operator || null,
    equipe:      body.equipe      || body.team       || null,
    status_chat: body.status      || body.status_chat || null,
    event_type:  body.tipo        || body.type       || body.event_type || null,
    campanha_id: body.campanha_id || null,
    tags:        body.tags        || null,
    raw:         JSON.stringify(body),
  });

  res.json({ ok: true });
});

// ── API para o dashboard ─────────────────────────────────────────────────────

app.get('/api/resumo',         (req, res) => res.json(db.resumo()));
app.get('/api/por-atendente',  (req, res) => res.json(db.groupBy('atendente')));
app.get('/api/por-equipe',     (req, res) => res.json(db.groupBy('equipe')));
app.get('/api/por-status',     (req, res) => res.json(db.groupBy('status_chat')));
app.get('/api/volume-diario',  (req, res) => res.json(db.volumeDiario()));
app.get('/api/volume-horario', (req, res) => res.json(db.volumeHorario()));
app.get('/api/eventos-recentes', (req, res) => res.json(db.recentes()));

// Injetar dados de teste
app.post('/api/teste', (req, res) => {
  const atendentes = ['Ana','Carlos','Juliana','Pedro','Marcia'];
  const equipes    = ['Vendas','Suporte','Financeiro'];
  const statuses   = ['aberto','fechado','pendente'];

  for (let i = 0; i < 20; i++) {
    db.insert({
      phone_id:    '69dd57b8e026e4843d55b5eb',
      chat_number: `5519${Math.floor(Math.random() * 900000000 + 100000000)}`,
      atendente:   atendentes[Math.floor(Math.random() * atendentes.length)],
      equipe:      equipes[Math.floor(Math.random() * equipes.length)],
      status_chat: statuses[Math.floor(Math.random() * statuses.length)],
      event_type:  'mensagem',
      raw:         JSON.stringify({ teste: true }),
    });
  }

  res.json({ ok: true, inseridos: 20 });
});

app.listen(PORT, () => {
  console.log(`✓ Servidor rodando em http://localhost:${PORT}`);
  console.log(`  Webhook:   POST http://localhost:${PORT}/webhook`);
  console.log(`  Dashboard: http://localhost:${PORT}`);
});
