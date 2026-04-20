const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const LOG_FILE = path.join(DATA_DIR, 'events.ndjson');

fs.mkdirSync(DATA_DIR, { recursive: true });

let _idCounter = 0;

function loadAll() {
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs.readFileSync(LOG_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function insert(row) {
  _idCounter++;
  const event = {
    id: Date.now() * 1000 + _idCounter,
    received_at: new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace('T', ' '),
    ...row,
  };
  fs.appendFileSync(LOG_FILE, JSON.stringify(event) + '\n');
  return event;
}

function query(filterFn) {
  return loadAll().filter(filterFn || (() => true));
}

// ── Agregações ───────────────────────────────────────────────────────────────

function resumo() {
  const all = loadAll();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now - 7 * 86400000);
  const monthStr = now.toISOString().slice(0, 7);

  return {
    hoje:   all.filter(e => e.received_at.startsWith(todayStr)).length,
    semana: all.filter(e => new Date(e.received_at) >= weekAgo).length,
    mes:    all.filter(e => e.received_at.startsWith(monthStr)).length,
  };
}

function groupBy(field, days = 30) {
  const since = new Date(Date.now() - days * 86400000);
  const map = {};
  loadAll()
    .filter(e => new Date(e.received_at) >= since)
    .forEach(e => {
      const key = e[field] || `Sem ${field}`;
      map[key] = (map[key] || 0) + 1;
    });
  return Object.entries(map)
    .map(([k, total]) => ({ [field]: k, total }))
    .sort((a, b) => b.total - a.total);
}

function volumeDiario(days = 30) {
  const since = new Date(Date.now() - days * 86400000);
  const map = {};
  loadAll()
    .filter(e => new Date(e.received_at) >= since)
    .forEach(e => {
      const dia = e.received_at.slice(0, 10);
      map[dia] = (map[dia] || 0) + 1;
    });
  return Object.entries(map).sort().map(([dia, total]) => ({ dia, total }));
}

function volumeHorario() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const map = {};
  loadAll()
    .filter(e => e.received_at.startsWith(todayStr))
    .forEach(e => {
      const hora = e.received_at.slice(11, 13);
      map[hora] = (map[hora] || 0) + 1;
    });
  return Object.entries(map).sort().map(([hora, total]) => ({ hora, total }));
}

function recentes(limit = 50) {
  return loadAll().slice(-limit).reverse();
}

module.exports = { insert, query, resumo, groupBy, volumeDiario, volumeHorario, recentes };
