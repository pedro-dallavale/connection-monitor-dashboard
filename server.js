/**
 * C9 Monitor Enterprise - Server (Node.js/Express)
 * Design: baseado no sistema C9 Digital (verde + laranja)
 * Fix: sidebar usa CSS Grid — não quebra o layout ao abrir
 */

const express = require('express');

const app = express();
const PORT = 8000;

app.use(express.json());

// ==========================================
// ESTADO COMPARTILHADO
// ==========================================
const state = {
  eventsSnapshot: [],
  pendingConnections: [],
  alerts: [],
  perHour: {},
};

function addAlert(msg) {
  state.alerts.push(msg);
  if (state.alerts.length > 500) state.alerts.shift();
}

// ==========================================
// HELPERS
// ==========================================
function nowStr() {
  const now = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
}

function extractHour(timestamp) {
  if (!timestamp) return '00:00';
  const parts = timestamp.trim().split(' ');
  const timePart = parts[parts.length - 1];
  const hour = timePart.length >= 2 && /^\d+/.test(timePart) ? timePart.slice(0, 2) : '00';
  return `${hour}:00`;
}

function counter(arr) {
  return arr.reduce((acc, val) => { acc[val] = (acc[val] || 0) + 1; return acc; }, {});
}

function mostCommon(obj, n = 10) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
}

// Sincroniza métricas a cada 10s
setInterval(() => {
  state.perHour = {};
  for (const e of state.eventsSnapshot) {
    const k = extractHour(e.timestamp || '');
    state.perHour[k] = (state.perHour[k] || 0) + 1;
  }
}, 10_000);


// ==========================================
// HTML BASE — Design C9 Digital
// ==========================================
function getBaseHtml(pageTitle, content) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle} • C9 Monitor</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --c9-green:      #1a7a4a;
      --c9-green-dark: #145e38;
      --c9-green-lite: #22a060;
      --c9-orange:     #e87722;
      --c9-orange-dk:  #c9600d;
      --sidebar-w:     52px;
      --sidebar-exp:   210px;
      --topbar-h:      48px;
      --bg:            #f0f4f8;
      --card:          #ffffff;
      --border:        #dde3ea;
      --text:          #1e293b;
      --muted:         #64748b;
      --success:       #16a34a;
      --warning:       #d97706;
      --danger:        #dc2626;
      --font:          'Nunito', 'Segoe UI', sans-serif;
    }

    html, body { height: 100%; }

    /*
      LAYOUT PRINCIPAL: CSS Grid de 2 colunas x 2 linhas.
      - row 1: topbar (span 2 colunas)
      - row 2, col 1: sidebar
      - row 2, col 2: conteúdo principal
      A sidebar nunca fica position:fixed no desktop, então
      NUNCA sobrepõe ou empurra o conteúdo de forma errada.
    */
    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      display: grid;
      grid-template-columns: var(--sidebar-w) 1fr;
      grid-template-rows: var(--topbar-h) 1fr;
      min-height: 100vh;
      transition: grid-template-columns 0.25s ease;
    }
    body.sidebar-open {
      grid-template-columns: var(--sidebar-exp) 1fr;
    }

    /* ─── TOPBAR ─────────────────────────────────────── */
    .topbar {
      grid-column: 1 / -1;
      grid-row: 1;
      position: sticky; top: 0; z-index: 200;
      display: flex; align-items: center; gap: 10px;
      background: var(--c9-green);
      color: #fff;
      padding: 0 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      border-bottom: 3px solid var(--c9-orange);
    }

    .topbar-logo { display: flex; align-items: center; gap: 8px; overflow: hidden; flex-shrink: 0; }
    .logo-box {
      width: 30px; height: 30px; background: #fff; border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 14px; color: var(--c9-green); flex-shrink: 0;
    }
    .logo-label {
      font-size: 12px; font-weight: 800; letter-spacing: 0.8px;
      white-space: nowrap; max-width: 0; opacity: 0; overflow: hidden;
      transition: max-width 0.25s ease, opacity 0.2s ease;
    }
    body.sidebar-open .logo-label { max-width: 120px; opacity: 1; }

    .topbar-sep { width: 1px; height: 22px; background: rgba(255,255,255,0.3); margin: 0 2px; flex-shrink: 0; }

    .hamburger {
      background: none; border: none; cursor: pointer;
      display: flex; flex-direction: column; justify-content: center;
      gap: 5px; padding: 5px; border-radius: 5px; flex-shrink: 0;
      transition: background 0.15s;
    }
    .hamburger:hover { background: rgba(255,255,255,0.15); }
    .hamburger span {
      display: block; width: 18px; height: 2px;
      background: #fff; border-radius: 2px;
      transition: transform 0.25s, opacity 0.2s;
      transform-origin: center;
    }
    body.sidebar-open .hamburger span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    body.sidebar-open .hamburger span:nth-child(2) { opacity: 0; transform: scaleX(0); }
    body.sidebar-open .hamburger span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

    .topbar-title {
      font-size: 13px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 1.2px; flex: 1;
    }
    .topbar-time {
      font-size: 11px; color: rgba(255,255,255,0.8);
      font-family: 'Courier New', monospace;
      background: rgba(0,0,0,0.2); padding: 3px 8px; border-radius: 4px; white-space: nowrap;
    }

    /* ─── SIDEBAR ────────────────────────────────────── */
    .sidebar {
      grid-column: 1; grid-row: 2;
      background: var(--c9-green-dark);
      overflow: hidden;
      display: flex; flex-direction: column;
      padding: 8px 0; gap: 2px;
    }

    .nav-link {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px 10px 14px;
      color: rgba(255,255,255,0.72);
      text-decoration: none;
      font-size: 13px; font-weight: 700;
      border-left: 3px solid transparent;
      white-space: nowrap; overflow: hidden;
      border-radius: 0 6px 6px 0; margin-right: 6px;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .nav-link:hover { background: rgba(255,255,255,0.1); color: #fff; border-left-color: var(--c9-orange); }
    .nav-link.active { background: rgba(255,255,255,0.16); color: #fff; border-left-color: var(--c9-orange); }
    .nav-icon { font-size: 15px; flex-shrink: 0; min-width: 18px; text-align: center; }
    .nav-label {
      max-width: 0; opacity: 0; overflow: hidden;
      transition: max-width 0.25s ease, opacity 0.2s ease;
    }
    body.sidebar-open .nav-label { max-width: 160px; opacity: 1; }

    /* ─── MAIN ───────────────────────────────────────── */
    .main { grid-column: 2; grid-row: 2; overflow-y: auto; display: flex; flex-direction: column; }
    .content { padding: 18px; flex: 1; }

    /* ─── METRICS ────────────────────────────────────── */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px; margin-bottom: 18px;
    }
    .metric-card {
      background: var(--card); border: 1px solid var(--border);
      border-top: 3px solid var(--c9-green); border-radius: 6px;
      padding: 14px 16px; transition: box-shadow 0.2s, transform 0.2s;
    }
    .metric-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.09); transform: translateY(-2px); }
    .metric-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 6px; }
    .metric-value { font-size: 26px; font-weight: 800; color: var(--c9-green); line-height: 1; }
    .metric-unit { font-size: 11px; color: var(--muted); margin-top: 4px; }

    /* ─── CARDS ──────────────────────────────────────── */
    .card {
      background: var(--card); border: 1px solid var(--border);
      border-radius: 6px; padding: 16px 18px; margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .card-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px; padding-bottom: 10px;
      border-bottom: 2px solid var(--c9-orange);
    }
    .card-title { font-size: 13px; font-weight: 800; color: var(--text); }

    /* ─── BUTTONS ────────────────────────────────────── */
    .btn {
      background: var(--c9-green); color: #fff; border: none; border-radius: 5px;
      padding: 7px 14px; font-size: 12px; font-weight: 700;
      cursor: pointer; text-decoration: none; display: inline-block;
      font-family: var(--font); transition: background 0.15s, transform 0.15s;
    }
    .btn:hover { background: var(--c9-green-lite); transform: translateY(-1px); }
    .btn-sm { padding: 4px 10px; font-size: 11px; }
    .btn-orange { background: var(--c9-orange); }
    .btn-orange:hover { background: var(--c9-orange-dk); }

    /* ─── TABLES ─────────────────────────────────────── */
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    table thead th {
      background: #f8fafc; padding: 9px 12px; text-align: left;
      font-size: 10px; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.8px; color: var(--c9-green); border-bottom: 2px solid var(--border);
    }
    table tbody td { padding: 9px 12px; border-bottom: 1px solid var(--border); color: var(--text); }
    table tbody tr:hover { background: #f0fdf4; }
    table tbody tr:last-child td { border-bottom: none; }

    /* ─── BADGES ─────────────────────────────────────── */
    .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-warning { background: #fef9c3; color: #854d0e; }
    .badge-danger  { background: #fee2e2; color: #991b1b; }

    /* ─── FILTERS ────────────────────────────────────── */
    .filter-group { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
    .filter-input {
      border: 1px solid var(--border); border-radius: 5px;
      padding: 7px 12px; font-size: 13px; color: var(--text);
      background: #fff; flex: 1; min-width: 160px; font-family: var(--font);
    }
    .filter-input:focus { outline: none; border-color: var(--c9-green); }
    .filter-input::placeholder { color: var(--muted); }

    /* ─── CHART ──────────────────────────────────────── */
    .chart-container { position: relative; height: 250px; }

    /* ─── STATUS BOX ─────────────────────────────────── */
    .status-box {
      background: #f0fdf4; border-left: 4px solid var(--c9-green);
      padding: 9px 14px; border-radius: 4px;
      font-size: 12px; font-weight: 700; color: #166534; margin-bottom: 16px;
    }

    /* ─── TOOLTIP ────────────────────────────────────── */
    .tooltip { position: relative; }
    .tooltip::after {
      content: attr(data-tooltip);
      position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);
      background: #1e293b; color: #fff; padding: 4px 9px; border-radius: 4px; font-size: 11px;
      white-space: nowrap; pointer-events: none; opacity: 0; visibility: hidden;
      transition: opacity 0.2s; z-index: 900;
    }
    .tooltip:hover::after { opacity: 1; visibility: visible; }

    /* ─── MOBILE OVERLAY ─────────────────────────────── */
    .sidebar-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.4); z-index: 150;
    }
    body.sidebar-open .sidebar-overlay { display: block; }

    /* ─── RESPONSIVE ─────────────────────────────────── */
    @media (max-width: 768px) {
      /* No mobile o grid colapsa para 0+1fr.
         A sidebar passa a position:fixed e flutua SOBRE o conteúdo.
         O layout do conteúdo não é afetado. */
      body { grid-template-columns: 0 1fr; }
      body.sidebar-open { grid-template-columns: 0 1fr; }

      .sidebar {
        position: fixed !important;
        top: var(--topbar-h); left: 0; bottom: 0;
        width: 0; z-index: 160;
        transition: width 0.25s ease;
      }
      body.sidebar-open .sidebar { width: var(--sidebar-exp); }
      .main { grid-column: 1 / -1; }
      .content { padding: 12px; }
      .metrics-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 480px) {
      .metrics-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body id="app-body">

  <header class="topbar">
    <div class="topbar-logo">
      <div class="logo-box">C9</div>
      <span class="logo-label">DIGITAL</span>
    </div>
    <div class="topbar-sep"></div>
    <button class="hamburger" id="hamburger-btn" aria-label="Abrir menu">
      <span></span><span></span><span></span>
    </button>
    <div class="topbar-title">${pageTitle}</div>
    <div class="topbar-time" id="current-time">${nowStr()}</div>
  </header>

  <nav class="sidebar" id="sidebar">
    <a href="/" class="nav-link" data-href="/"><span class="nav-icon">📊</span><span class="nav-label">Dashboard</span></a>
    <a href="/conexoes" class="nav-link" data-href="/conexoes"><span class="nav-icon">🔗</span><span class="nav-label">Conexões</span></a>
    <a href="/alertas" class="nav-link" data-href="/alertas"><span class="nav-icon">⚠️</span><span class="nav-label">Alertas</span></a>
    <a href="/relatorios" class="nav-link" data-href="/relatorios"><span class="nav-icon">📈</span><span class="nav-label">Relatórios</span></a>
    <a href="/logs" class="nav-link" data-href="/logs"><span class="nav-icon">📝</span><span class="nav-label">Logs</span></a>
    <a href="/sistema" class="nav-link" data-href="/sistema"><span class="nav-icon">⚙️</span><span class="nav-label">Sistema</span></a>
  </nav>

  <div class="sidebar-overlay" id="sidebar-overlay"></div>

  <main class="main">
    <div class="content">
      ${content}
    </div>
  </main>

  <script>
    (function () {
      const body    = document.getElementById('app-body');
      const btn     = document.getElementById('hamburger-btn');
      const overlay = document.getElementById('sidebar-overlay');

      btn.addEventListener('click', () => body.classList.toggle('sidebar-open'));
      overlay.addEventListener('click', () => body.classList.remove('sidebar-open'));

      document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
          if (window.innerWidth <= 768) body.classList.remove('sidebar-open');
        });
        if (link.getAttribute('data-href') === window.location.pathname) {
          link.classList.add('active');
        }
      });

      setInterval(() => {
        fetch('/api/time').then(r => r.json()).then(d => {
          const el = document.getElementById('current-time');
          if (el) el.textContent = d.time;
        }).catch(() => {});
      }, 5000);
    })();
  </script>
</body>
</html>`;
}


// ==========================================
// ROTAS HTML
// ==========================================

app.get('/', (req, res) => {
  const events = state.eventsSnapshot;
  const totalEvents = events.length;
  const recent = events.slice(-10);
  const byCompany = counter(events.map(e => e.company));
  const hourlyCounts = {};
  for (const e of events) {
    const key = extractHour(e.timestamp || '');
    hourlyCounts[key] = (hourlyCounts[key] || 0) + 1;
  }
  const totalAlerts = state.alerts.length;
  const hourLabels = Object.keys(hourlyCounts).sort((a, b) => parseInt(a) - parseInt(b));
  const hourValues = hourLabels.map(h => hourlyCounts[h] || 0);

  const companyStats = mostCommon(byCompany, 5).map(([company, count]) =>
    `<tr><td>${company}</td><td><strong>${count}</strong></td><td><div style="width:${Math.min(count*10,100)}px;height:14px;background:var(--c9-green);border-radius:3px;"></div></td></tr>`
  ).join('');

  const recentTable = recent.map(e =>
    `<tr><td>${e.company||'N/A'}</td><td>${e.user||'N/A'}</td><td><span class="badge badge-success">${e.timestamp||'N/A'}</span></td></tr>`
  ).join('');

  const content = `
  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-label tooltip" data-tooltip="Total de conexões registradas">Total de Eventos</div>
      <div class="metric-value">${totalEvents}</div>
      <div class="metric-unit">conexões registradas</div>
    </div>
    <div class="metric-card">
      <div class="metric-label tooltip" data-tooltip="Anomalias detectadas">Alertas Gerados</div>
      <div class="metric-value">${totalAlerts}</div>
      <div class="metric-unit">anomalias detectadas</div>
    </div>
    <div class="metric-card">
      <div class="metric-label tooltip" data-tooltip="Clientes únicos conectados">Empresas Únicas</div>
      <div class="metric-value">${Object.keys(byCompany).length}</div>
      <div class="metric-unit">clientes conectados</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Status</div>
      <div class="metric-value" style="color:var(--success);">ONLINE</div>
      <div class="metric-unit">servidor ativo</div>
    </div>
  </div>

  <div class="status-box">✓ Sistema em operação • Dashboard atualizado em tempo real • Webhook Discord agendado</div>

  <div class="card">
    <div class="card-header"><div class="card-title">📊 Eventos por Hora</div></div>
    <div class="chart-container"><canvas id="eventsChart"></canvas></div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title">🏢 Top Empresas</div></div>
    <table>
      <thead><tr><th>Empresa</th><th>Conexões</th><th>Volume</th></tr></thead>
      <tbody>${companyStats || '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:20px;">Sem dados</td></tr>'}</tbody>
    </table>
  </div>

  <div class="card">
    <div class="card-header">
      <div class="card-title">📋 Últimas Conexões</div>
      <a href="/conexoes" class="btn btn-sm">Ver todas →</a>
    </div>
    <table>
      <thead><tr><th>Empresa</th><th>Usuário</th><th>Horário</th></tr></thead>
      <tbody>${recentTable || '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:20px;">Nenhuma conexão</td></tr>'}</tbody>
    </table>
  </div>

  <script>
    const ctx = document.getElementById('eventsChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(hourLabels)},
        datasets: [{
          label: 'Eventos por hora',
          data: ${JSON.stringify(hourValues)},
          borderColor: '#1a7a4a',
          backgroundColor: 'rgba(26,122,74,0.1)',
          fill: true, tension: 0.3,
          pointRadius: 4, pointHoverRadius: 6,
          pointBackgroundColor: '#e87722',
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#64748b', font: { size: 11 } } },
          x: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#64748b', font: { size: 11 } } }
        },
        plugins: { legend: { labels: { color: '#1e293b', font: { size: 12 } } } }
      }
    });
  </script>`;

  res.send(getBaseHtml('Dashboard', content));
});


app.get('/conexoes', (req, res) => {
  let eventos = [...state.eventsSnapshot];
  const { empresa, usuario } = req.query;
  if (empresa) eventos = eventos.filter(e => (e.company||'').toLowerCase().includes(empresa.toLowerCase()));
  if (usuario) eventos = eventos.filter(e => (e.user||'').toLowerCase().includes(usuario.toLowerCase()));

  const tableRows = eventos.slice(-100).map(e =>
    `<tr><td>${e.company||'N/A'}</td><td>${e.user||'N/A'}</td><td>${e.timestamp||'N/A'}</td></tr>`
  ).join('');

  const content = `
  <div class="card">
    <div class="card-header"><div class="card-title">🔗 Gerenciar Conexões</div></div>
    <div class="filter-group">
      <input type="text" class="filter-input" placeholder="Filtrar por empresa..." id="empresa-filter">
      <input type="text" class="filter-input" placeholder="Filtrar por usuário..." id="usuario-filter">
    </div>
    <table>
      <thead><tr><th>Empresa</th><th>Usuário</th><th>Horário</th><th>Ação</th></tr></thead>
      <tbody>${tableRows || '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--muted);">Nenhuma conexão encontrada</td></tr>'}</tbody>
    </table>
  </div>
  <script>
    document.getElementById('empresa-filter').addEventListener('input', e => {
      const v = e.target.value.toLowerCase();
      document.querySelectorAll('table tbody tr').forEach(row => {
        row.style.display = row.cells[0].textContent.toLowerCase().includes(v) ? '' : 'none';
      });
    });
    document.getElementById('usuario-filter').addEventListener('input', e => {
      const v = e.target.value.toLowerCase();
      document.querySelectorAll('table tbody tr').forEach(row => {
        row.style.display = row.cells[1].textContent.toLowerCase().includes(v) ? '' : 'none';
      });
    });
  </script>`;

  res.send(getBaseHtml('Conexões', content));
});


app.get('/alertas', (req, res) => {
  const alertList = state.alerts.slice(-50);
  const alertRows = alertList.map(alert =>
    `<tr><td><span class="badge badge-danger">CRÍTICO</span></td><td>${alert}</td><td>Agora</td></tr>`
  ).join('');

  const content = `
  <div class="card">
    <div class="card-header"><div class="card-title">⚠️ Centro de Alertas</div></div>
    <table>
      <thead><tr><th>Severidade</th><th>Mensagem</th><th>Tempo</th></tr></thead>
      <tbody>${alertRows || '<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--success);">✓ Nenhum alerta gerado</td></tr>'}</tbody>
    </table>
  </div>`;

  res.send(getBaseHtml('Alertas', content));
});


app.get('/relatorios', (req, res) => {
  const events = state.eventsSnapshot;
  const total = events.length;
  const byCompany = counter(events.map(e => e.company));
  const byUser = counter(events.map(e => e.user));
  const companyReport = mostCommon(byCompany, 10).map(([c, cnt]) => `<tr><td>${c}</td><td>${cnt}</td></tr>`).join('');
  const userReport = mostCommon(byUser, 10).map(([u, cnt]) => `<tr><td>${u}</td><td>${cnt}</td></tr>`).join('');

  const content = `
  <div class="metrics-grid">
    <div class="metric-card"><div class="metric-label">Total de Eventos</div><div class="metric-value">${total}</div></div>
    <div class="metric-card"><div class="metric-label">Total de Empresas</div><div class="metric-value">${Object.keys(byCompany).length}</div></div>
    <div class="metric-card"><div class="metric-label">Total de Usuários</div><div class="metric-value">${Object.keys(byUser).length}</div></div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">🏢 Empresas com Mais Acessos</div></div>
    <table><thead><tr><th>Empresa</th><th>Acessos</th></tr></thead><tbody>${companyReport || '<tr><td colspan="2" style="text-align:center;color:var(--muted);">-</td></tr>'}</tbody></table>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">👤 Usuários Mais Ativos</div></div>
    <table><thead><tr><th>Usuário</th><th>Acessos</th></tr></thead><tbody>${userReport || '<tr><td colspan="2" style="text-align:center;color:var(--muted);">-</td></tr>'}</tbody></table>
  </div>`;

  res.send(getBaseHtml('Relatórios', content));
});


app.get('/logs', (req, res) => {
  const pending = state.pendingConnections.slice(-50);
  const logRows = pending.map(e =>
    `<tr><td>${e.company||'N/A'}</td><td>${e.user||'N/A'}</td><td>${e.timestamp||'N/A'}</td><td><span class="badge badge-warning">PENDENTE</span></td></tr>`
  ).join('');

  const content = `
  <div class="card">
    <div class="card-header"><div class="card-title">📝 Logs em Tempo Real</div></div>
    <table>
      <thead><tr><th>Empresa</th><th>Usuário</th><th>Timestamp</th><th>Status</th></tr></thead>
      <tbody>${logRows || '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--muted);">Nenhum log pendente</td></tr>'}</tbody>
    </table>
  </div>`;

  res.send(getBaseHtml('Logs', content));
});


app.get('/sistema', (req, res) => {
  const snapshotCount = state.eventsSnapshot.length;
  const pendingCount = state.pendingConnections.length;

  const content = `
  <div class="metrics-grid">
    <div class="metric-card"><div class="metric-label">Eventos em Cache</div><div class="metric-value">${snapshotCount}</div></div>
    <div class="metric-card"><div class="metric-label">Pendentes Discord</div><div class="metric-value">${pendingCount}</div></div>
    <div class="metric-card"><div class="metric-label">Uptime</div><div class="metric-value" style="color:var(--success);">OK</div></div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">⚙️ Configurações do Sistema</div></div>
    <p style="margin-bottom:10px;color:var(--muted);font-size:13px;">Version: 2.0 Enterprise</p>
    <p style="margin-bottom:10px;font-size:13px;">SSH Status: <span class="badge badge-success">CONECTADO</span></p>
    <p style="margin-bottom:10px;font-size:13px;">Discord Webhook: <span class="badge badge-success">ATIVO</span></p>
    <p style="margin-bottom:14px;font-size:13px;">Monitor PM2: <span class="badge badge-success">RODANDO</span></p>
    <button class="btn btn-orange" onclick="alert('Sincronizar com servidor')">🔄 Sincronizar</button>
  </div>`;

  res.send(getBaseHtml('Sistema', content));
});


// ==========================================
// API JSON
// ==========================================
app.get('/api/time',    (req, res) => res.json({ time: nowStr() }));
app.get('/api/ping',    (req, res) => res.json({ status: 'ok', time: nowStr() }));
app.get('/api/pending', (req, res) => res.json(state.pendingConnections));

app.get('/api/stats', (req, res) => {
  const byCompany = counter(state.eventsSnapshot.map(e => e.company));
  res.json({
    total_connections: state.eventsSnapshot.length,
    total_alerts: state.alerts.length,
    unique_companies: Object.keys(byCompany).length,
  });
});

app.post('/api/events', (req, res) => {
  const event = req.body;
  if (!event || typeof event !== 'object') return res.status(400).json({ error: 'Evento inválido' });
  event.timestamp = event.timestamp || nowStr();
  state.eventsSnapshot.push(event);
  res.json({ ok: true, total: state.eventsSnapshot.length });
});

app.post('/api/alerts', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Campo "message" obrigatório' });
  addAlert(message);
  res.json({ ok: true, total: state.alerts.length });
});


// ==========================================
// INICIALIZAÇÃO
// ==========================================
app.listen(PORT, '127.0.0.1', () => {
  console.log(`
╔══════════════════════════════════════════╗
║     C9 Monitor Enterprise v2.0 (JS)     ║
╠══════════════════════════════════════════╣
║  Dashboard: http://127.0.0.1:${PORT}/      ║
║  API:       http://127.0.0.1:${PORT}/api/  ║
╚══════════════════════════════════════════╝
  `);
});

module.exports = { app, state, addAlert, nowStr, extractHour };
