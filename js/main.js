const API = window.location.port === '5000' ? '' : 'http://localhost:5000';
const COLORS = ['#166534', '#22C55E', '#4ADE80', '#86EFAC', '#EAB308'];
const charts = {};

async function apiFetch(path, opts) {
  const res = await fetch(API + path, opts);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function fmtRM(val) {
  if (!val && val !== 0) return '—';
  if (val >= 1000) return 'RM' + (val / 1000).toFixed(1) + 'k';
  return 'RM' + Math.round(val);
}

function trendLabel(pct) {
  if (Math.abs(pct) > 60) return { text: 'Partial day reading', cls: '' };
  const dir = pct <= 0 ? '↓' : '↑';
  return { text: dir + ' ' + Math.abs(pct).toFixed(1) + '% from yesterday', cls: pct <= 0 ? 'positive' : 'warning' };
}

function timeSince(isoStr) {
  const diff = (Date.now() - new Date(isoStr)) / 1000;
  if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
  return Math.floor(diff / 86400) + ' days ago';
}

function makeChart(id, opt) {
  const el = document.getElementById(id);
  if (!el) return null;
  const c = echarts.init(el);
  c.setOption(opt);
  window.addEventListener('resize', () => c.resize());
  return c;
}

// ── Charts — init with placeholder then update with real data ─────────────────
function initCharts() {
  charts.energy = makeChart('energyChart', {
    color: COLORS, tooltip: { trigger: 'axis' },
    grid: { left: 45, right: 20, top: 30, bottom: 35 },
    xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
    yAxis: { type: 'value', name: 'kWh' },
    series: [{ name: 'Energy kWh', type: 'line', smooth: true, symbolSize: 8,
      lineStyle: { width: 4 }, areaStyle: { opacity: 0.18 },
      data: [1200, 1350, 1280, 1420, 1500, 1100, 980] }]
  });

  charts.room = makeChart('roomChart', {
    color: ['#22C55E', '#86EFAC', '#EAB308'],
    tooltip: { trigger: 'item', formatter: p => `${p.name}<br/><b>${p.value}%</b>` },
    legend: { bottom: 0 },
    series: [{ type: 'pie', radius: ['48%', '72%'], center: ['50%', '43%'],
      data: [{ value: 52, name: 'Used' }, { value: 28, name: 'Available' }, { value: 20, name: 'Idle' }] }]
  });

  const days30 = Array.from({ length: 30 }, (_, i) => 'D' + (i + 1));
  const base = [35,36,36,37,38,37,39,40,40,41,42,41,43,44,45,44,46,47,46,48,49,50,50,51,52,51,53,54,55,56];
  charts.forecast = makeChart('forecastChart', {
    color: ['#166534', '#22C55E', '#22C55E'], tooltip: { trigger: 'axis' }, legend: { top: 0 },
    grid: { left: 45, right: 20, top: 45, bottom: 35 },
    xAxis: { type: 'category', data: days30 },
    yAxis: { type: 'value', name: 'RM x1000' },
    series: [
      { name: 'Forecast', type: 'line', smooth: true, data: base, lineStyle: { width: 4 }, areaStyle: { opacity: 0.12 } },
      { name: 'Upper Band', type: 'line', smooth: true, data: base.map(v => v + 3), lineStyle: { type: 'dashed' }, symbol: 'none' },
      { name: 'Lower Band', type: 'line', smooth: true, data: base.map(v => v - 3), lineStyle: { type: 'dashed' }, symbol: 'none' }
    ]
  });
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  const cards = document.querySelectorAll('.kpi-card');
  if (!cards.length) return;
  try {
    const [summary, kpi] = await Promise.all([
      apiFetch('/api/resources/summary'),
      apiFetch('/api/kpi/current').catch(() => null)
    ]);

    const elec = summary.electricity || {};
    const water = summary.water || {};

    cards[0].querySelector('h3').textContent = (elec.value || 0).toLocaleString() + ' kWh';
    const et = trendLabel(elec.trend_pct || 0);
    const ep = cards[0].querySelector('p');
    ep.textContent = et.text; ep.className = et.cls;

    cards[1].querySelector('h3').textContent = (water.value || 0).toLocaleString() + ' L';
    const wt = trendLabel(water.trend_pct || 0);
    const wp = cards[1].querySelector('p');
    wp.textContent = wt.text; wp.className = wt.cls;

    if (kpi?.avg_occupancy_rate != null) {
      cards[2].querySelector('h3').textContent = kpi.avg_occupancy_rate.toFixed(0) + '%';
      cards[2].querySelector('p').textContent =
        kpi.avg_occupancy_rate > 70 ? 'Peak usage detected' : 'Normal occupancy';
    }

    if (kpi?.carbon_footprint != null) {
      cards[3].querySelector('h3').textContent = kpi.carbon_footprint.toFixed(0) + ' kg';
      cards[3].querySelector('p').textContent = 'CO₂e this week';
    }

    const totalCost = (elec.cost || 0) + (water.cost || 0);
    if (totalCost > 0) {
      cards[4].querySelector('h3').textContent = fmtRM(totalCost * 30);
      cards[4].querySelector('p').textContent = 'Estimated from today\'s usage';
    }

    // Volt Buddy — update from efficiency score
    if (kpi) loadVoltBuddy(kpi);
  } catch (e) { console.warn('Dashboard load failed:', e); }
}

// ── Energy Chart ──────────────────────────────────────────────────────────────
async function loadEnergyChart() {
  try {
    const data = await apiFetch('/api/resources/trend?days=7&resource_type=electricity');
    if (!data.length) return;
    charts.energy?.setOption({
      xAxis: { data: data.map(d => d.date.slice(5)) },
      series: [{ data: data.map(d => d.value) }]
    });
  } catch (e) { console.warn('Energy chart failed:', e); }
}

// ── Room Chart ────────────────────────────────────────────────────────────────
async function loadRoomChart() {
  try {
    const kpi = await apiFetch('/api/kpi/current');
    const used = Math.max(0, Math.round(kpi.avg_occupancy_rate || 52));
    const rem = 100 - used;
    charts.room?.setOption({
      series: [{
        data: [
          { value: used, name: 'Used' },
          { value: Math.round(rem * 0.6), name: 'Available' },
          { value: Math.round(rem * 0.4), name: 'Idle' }
        ]
      }]
    });
  } catch (e) { console.warn('Room chart failed:', e); }
}

// ── Forecast Cards ────────────────────────────────────────────────────────────
async function loadForecast() {
  try {
    const f = await apiFetch('/api/forecast/next-month');
    const cards = document.querySelectorAll('.forecast-card');
    if (!cards.length) return;

    if (f.projected_cost != null) {
      cards[0].querySelector('h3').textContent = fmtRM(f.projected_cost);
      const sign = f.growth_percentage >= 0 ? '+' : '';
      const driver = f.drivers?.[0] || '';
      cards[0].querySelector('p').textContent =
        sign + (f.growth_percentage || 0).toFixed(1) + '% predicted change. ' + driver;
    }

    if (f.projected_cost) {
      cards[1].querySelector('h3').textContent = Math.round(f.projected_cost / 0.51).toLocaleString() + ' kWh';
      cards[1].querySelector('p').textContent = 'Predicted electricity demand for next month.';
    }

    if (f.budget_risk != null) {
      const riskEl = cards[2].querySelector('h3');
      riskEl.textContent = f.budget_risk ? 'High' : 'Low';
      riskEl.style.color = f.budget_risk ? '#dc2626' : '#16a34a';
      cards[2].querySelector('p').textContent =
        f.budget_risk_message || (f.budget_risk ? 'Cost trending above budget.' : 'Spending within expected range.');
    }
  } catch (e) { console.warn('Forecast cards failed:', e); }
}

// ── Forecast Chart ────────────────────────────────────────────────────────────
async function loadForecastChart() {
  try {
    const data = await apiFetch('/api/forecast/trend?days=30');
    if (!data.length) return;
    charts.forecast?.setOption({
      xAxis: { data: data.map((_, i) => 'D' + (i + 1)) },
      series: [
        { data: data.map(d => d.estimated) },
        { data: data.map(d => d.high) },
        { data: data.map(d => d.low) }
      ]
    });
  } catch (e) { console.warn('Forecast chart failed:', e); }
}

// ── Anomalies & Recommendations ───────────────────────────────────────────────
async function loadAnomalies() {
  try {
    const [allAnomalies, recs] = await Promise.all([
      apiFetch('/api/anomalies?limit=50&status=pending'),
      apiFetch('/api/recommendations?limit=1')
    ]);
    const seenSigs = new Set();
    const anomalies = allAnomalies.filter(a => {
      const sig = `${a.floor}|${a.anomaly_type}`;
      if (seenSigs.has(sig)) return false;
      seenSigs.add(sig);
      return true;
    }).slice(0, 2);

    const grid = document.querySelector('.insight-grid');
    if (!grid) return;
    grid.innerHTML = '';

    anomalies.forEach(a => {
      const badgeCls = a.severity === 'critical' ? 'danger' : 'warning';
      const badgeTxt = a.severity === 'critical' ? 'Critical' : 'Medium';
      const timeAgo = a.created_at ? timeSince(a.created_at) : '';
      grid.insertAdjacentHTML('beforeend', `
        <div class="insight-card" id="anomaly-${a.id}">
          <div class="alert-badge ${badgeCls}">${badgeTxt}</div>
          <h3>${a.floor} — ${a.anomaly_type.replace(/_/g, ' ')}</h3>
          <p>${a.message}</p>
          ${timeAgo ? `<small style="color:#888;font-size:12px">${timeAgo}</small>` : ''}
          <br><br>
          <button type="button" onclick="acknowledgeAnomaly(${a.id}, this)">Acknowledge</button>
        </div>`);
    });

    if (recs.length) {
      const r = recs[0];
      const saving = r.estimated_savings ? ` Estimated savings: ${fmtRM(r.estimated_savings)}/month.` : '';
      grid.insertAdjacentHTML('beforeend', `
        <div class="insight-card" id="rec-${r.id}">
          <div class="alert-badge success">High Impact</div>
          <h3>${r.title}</h3>
          <p>${r.description}${saving}</p>
          ${r.carbon_impact ? `<small style="color:#888;font-size:12px">Carbon saved: ${r.carbon_impact.toFixed(0)} kg CO₂/month</small>` : ''}
          <br><br>
          <button type="button" onclick="implementRec(${r.id}, this)">Implement</button>
        </div>`);
    }

    if (!anomalies.length && !recs.length) {
      grid.innerHTML = '<div class="insight-card"><p>No active alerts.</p></div>';
    }
  } catch (e) { console.warn('Anomalies failed:', e); }
}

const acknowledgedIds = new Set();

async function acknowledgeAnomaly(id, btn) {
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    await apiFetch(`/api/anomalies/${id}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acknowledged' })
    });
    acknowledgedIds.add(id);
    btn.textContent = 'Acknowledged ✓';
    const card = document.getElementById('anomaly-' + id);
    if (card) { card.style.opacity = '0'; setTimeout(() => card.remove(), 420); }
  } catch { btn.textContent = 'Acknowledge'; btn.disabled = false; }
}

async function implementRec(id, btn) {
  btn.disabled = true; btn.textContent = 'Applying…';
  try {
    await apiFetch(`/api/recommendations/${id}/implement`, { method: 'PUT' });
    btn.textContent = 'Implemented ✓';
  } catch { btn.textContent = 'Implement'; btn.disabled = false; }
}

// ── Volt Buddy ────────────────────────────────────────────────────────────────
function loadVoltBuddy(kpi) {
  const score = kpi?.efficiency_score ?? 65;
  const fill = document.querySelector('.vb-fill');
  const val = document.querySelector('.vb-value');
  const pill = document.querySelector('.vb-status-pill');
  const head = document.querySelector('.vb-head');
  if (fill) fill.style.height = score + '%';
  if (val) val.textContent = score + '%';
  if (pill) {
    pill.textContent = score >= 80 ? 'Optimal' : score >= 60 ? 'Good' : 'Needs Attention';
    pill.className = 'vb-status-pill ' + (score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red');
  }
  if (head) head.textContent = score >= 80 ? '😎' : score >= 60 ? '🙂' : '😟';
}

// ── Simulation ────────────────────────────────────────────────────────────────
async function runSimulation() {
  const input = document.getElementById('simulationInput');
  const query = input?.value?.trim();
  if (!query) return;
  const btn = document.querySelector('.input-row button');
  const grid = document.getElementById('scenarioGrid');
  if (btn) { btn.textContent = 'Simulating…'; btn.disabled = true; }
  if (grid) {
    grid.innerHTML = ['A', 'B', 'C'].map(l => `
      <div class="scenario-card" style="opacity:0.5">
        <span>Scenario ${l}</span>
        <h3 style="background:#e2e8f0;color:transparent;border-radius:6px">Generating…</h3>
        <p style="background:#f1f5f9;color:transparent;border-radius:4px">Analysing building data…</p>
        <ul><li>Savings: <strong>—</strong></li><li>Carbon Reduction: <strong>—</strong></li>
        <li>Effort: <strong>—</strong></li><li>Comfort Score: <strong>—</strong></li></ul>
      </div>`).join('');
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);
    let data;
    try {
      data = await apiFetch('/api/simulation/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }), signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch {
      clearTimeout(timeoutId);
      data = await apiFetch('/api/simulation/fallback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (data) data.used_gemini = false;
    }
    if (data && (data.scenario_a || data.scenario_b || data.scenario_c)) {
      renderSimulation(data);
    } else {
      throw new Error('Empty response');
    }
  } catch (e) {
    console.warn('Simulation failed:', e);
    if (grid) grid.innerHTML = `<div class="scenario-card" style="grid-column:1/-1;text-align:center;padding:40px">
      <h3>Simulation unavailable</h3><p>Make sure Flask backend is running on port 5000.</p></div>`;
  } finally {
    if (btn) { btn.textContent = 'Simulate'; btn.disabled = false; }
  }
}

function renderSimulation(data) {
  const grid = document.getElementById('scenarioGrid');
  if (!grid) return;
  const keys = ['scenario_a', 'scenario_b', 'scenario_c'];
  const labels = ['Scenario A', 'Scenario B', 'Scenario C'];
  const recommended = data.recommended || 'scenario_c';
  grid.innerHTML = keys.map((key, i) => {
    const s = data[key];
    if (!s) return '';
    const isRec = key === recommended;
    return `<div class="scenario-card${isRec ? ' recommended' : ''}">
      <span>${labels[i]}${isRec ? ' ★ Recommended' : ''}</span>
      <h3>${s.name || labels[i]}</h3><p>${s.description || ''}</p>
      <ul>
        <li>Savings: <strong>${s.savings != null ? 'RM' + Number(s.savings).toLocaleString() + '/month' : '—'}</strong></li>
        <li>Carbon Reduction: <strong>${s.carbon_reduction != null ? s.carbon_reduction + '%' : '—'}</strong></li>
        <li>Effort: <strong>${s.effort || '—'}</strong></li>
        <li>Comfort Score: <strong>${s.comfort_score != null ? s.comfort_score + '%' : '—'}</strong></li>
        ${s.timeline ? `<li>Timeline: <strong>${s.timeline}</strong></li>` : ''}
      </ul>
    </div>`;
  }).join('');

  const riskBox = document.querySelector('.risk-box');
  if (riskBox) {
    const rec = data[recommended];
    if (rec) {
      const cs = rec.comfort_score || 75;
      const comfortImpact = cs >= 86 ? ['Low', 'good'] : cs >= 75 ? ['Moderate', 'warn'] : ['High', 'bad'];
      const bizImpact = rec.effort === 'Low' ? ['Low', 'good'] : rec.effort === 'Medium' ? ['Moderate', 'warn'] : ['High', 'bad'];
      const cr = rec.carbon_reduction || 0;
      const roi = cr >= 25 ? ['Very High', 'good'] : cr >= 12 ? ['High', 'good'] : cr >= 6 ? ['Medium', 'warn'] : ['Low', 'bad'];
      const riskGrid = riskBox.querySelector('.risk-grid');
      if (riskGrid) {
        riskGrid.innerHTML = [
          ['Comfort Impact', comfortImpact],
          ['Business Impact', bizImpact],
          ['ROI', roi],
          ['Payback', [rec.timeline || '—', 'neutral']]
        ].map(([label, [val, cls]]) =>
          `<div><strong>${label}</strong><span class="risk-val ${cls}">${val}</span></div>`
        ).join('');
      }
    }
  }
}

// ── Nav Scroll Spy ────────────────────────────────────────────────────────────
(function navScrollSpy() {
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
  if (!navLinks.length) return;
  const sections = Array.from(navLinks)
    .map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  function setActive() {
    const scrollPos = window.scrollY + 110;
    let current = sections[0];
    sections.forEach(sec => { if (sec.offsetTop <= scrollPos) current = sec; });
    navLinks.forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + current.id);
    });
  }
  window.addEventListener('scroll', setActive, { passive: true });
  setActive();
})();

// ── Boot ──────────────────────────────────────────────────────────────────────
initCharts();
loadDashboard();
loadEnergyChart();
loadRoomChart();
loadForecast();
loadForecastChart();
loadAnomalies();
