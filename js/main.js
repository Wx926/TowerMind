const API = window.location.port === '5000' ? '' : 'http://localhost:5000';
const COLORS = ['#166534', '#22C55E', '#4ADE80', '#86EFAC', '#EAB308'];

async function apiFetch(path, opts) {
  try {
    const r = await fetch(API + path, opts);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function fmtRM(val) {
  if (!val && val !== 0) return '—';
  if (val >= 1000) return 'RM' + (val / 1000).toFixed(1) + 'k';
  return 'RM' + Math.round(val);
}

function trendLabel(pct, unit) {
  if (Math.abs(pct) > 60) return 'Partial day reading';
  const dir = pct < 0 ? '↓' : '↑';
  const cls = pct < 0 ? 'positive' : 'negative';
  return `<span class="${cls}">${dir} ${Math.abs(pct).toFixed(1)}% ${unit}</span>`;
}

function makeChart(id, opt) {
  const el = document.getElementById(id);
  if (!el) return null;
  const c = echarts.init(el);
  c.setOption(opt);
  window.addEventListener('resize', () => c.resize());
  return c;
}

// ── KPI Cards ────────────────────────────────────────────────
async function loadDashboard() {
  const [summary, kpi] = await Promise.all([
    apiFetch('/api/resources/summary'),
    apiFetch('/api/kpi/current')
  ]);

  const cards = document.querySelectorAll('.kpi-card');
  if (!cards.length) return;

  if (summary) {
    cards[0].querySelector('h3').textContent =
      summary.electricity_today != null ? Math.round(summary.electricity_today) + ' kWh' : '—';
    cards[0].querySelector('p').innerHTML =
      summary.electricity_trend != null
        ? trendLabel(summary.electricity_trend, 'from yesterday') : 'No trend data';

    cards[1].querySelector('h3').textContent =
      summary.water_today != null ? Math.round(summary.water_today) + ' L' : '—';
    cards[1].querySelector('p').innerHTML =
      summary.water_trend != null
        ? trendLabel(summary.water_trend, 'this week') : 'No trend data';

    const occ = summary.current_occupancy;
    cards[2].querySelector('h3').textContent = occ != null ? Math.round(occ) + '%' : '—';
    cards[2].querySelector('p').innerHTML =
      occ != null
        ? (occ > 80
            ? '<span class="negative">Peak usage detected</span>'
            : occ > 50
              ? '<span class="warning">Moderate occupancy</span>'
              : '<span class="positive">Low occupancy</span>')
        : 'No occupancy data';

    const co2 = summary.carbon_today ?? summary.carbon_emission_today;
    cards[3].querySelector('h3').textContent = co2 != null ? Math.round(co2) + ' kg' : '—';
    cards[3].querySelector('p').textContent = 'CO₂e this week';
  }

  if (kpi) {
    const totalCost = kpi.total_cost_today ?? kpi.monthly_cost;
    const monthlyCostEst = totalCost ? totalCost * 30 : null;
    cards[4].querySelector('h3').textContent = monthlyCostEst ? fmtRM(monthlyCostEst) : '—';
    cards[4].querySelector('p').textContent = 'Estimated from today\'s usage';
  }
}

// ── Energy Chart ──────────────────────────────────────────────
async function loadEnergyChart() {
  const data = await apiFetch('/api/resources/trend?days=7&resource_type=electricity');
  if (!data || !data.trend) {
    makeChart('energyChart', {
      color: COLORS, tooltip: { trigger: 'axis' },
      grid: { left: 45, right: 20, top: 30, bottom: 35 },
      xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      yAxis: { type: 'value' },
      series: [{ name: 'Energy kWh', type: 'line', smooth: true, symbolSize: 8,
        lineStyle: { width: 4 }, areaStyle: { opacity: 0.18 },
        data: [0, 0, 0, 0, 0, 0, 0] }]
    });
    return;
  }
  const labels = data.trend.map(p => {
    const d = new Date(p.date || p.timestamp);
    return d.toLocaleDateString('en-MY', { weekday: 'short' });
  });
  const values = data.trend.map(p => parseFloat((p.value || p.amount || 0).toFixed(1)));
  makeChart('energyChart', {
    color: COLORS, tooltip: { trigger: 'axis' },
    grid: { left: 45, right: 20, top: 30, bottom: 35 },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value' },
    series: [{ name: 'Energy kWh', type: 'line', smooth: true, symbolSize: 8,
      lineStyle: { width: 4 }, areaStyle: { opacity: 0.18 }, data: values }]
  });
}

// ── Room Utilization Chart ────────────────────────────────────
async function loadRoomChart() {
  const summary = await apiFetch('/api/resources/summary');
  const occ = summary?.current_occupancy ?? 52;
  const avail = Math.max(0, 100 - occ - 15);
  const idle = Math.max(0, 100 - occ - avail);
  makeChart('roomChart', {
    color: ['#22C55E', '#86EFAC', '#EAB308'],
    tooltip: { trigger: 'item' }, legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: ['48%', '72%'], center: ['50%', '43%'],
      data: [
        { value: Math.round(occ), name: 'Used' },
        { value: Math.round(avail), name: 'Available' },
        { value: Math.round(idle), name: 'Idle' }
      ]
    }]
  });
}

// ── Forecast Cards ────────────────────────────────────────────
async function loadForecast() {
  const f = await apiFetch('/api/forecast/next-month');
  const cards = document.querySelectorAll('.forecast-card');
  if (!cards.length || !f) return;
  cards[0].querySelector('h3').textContent = f.predicted_cost ? fmtRM(f.predicted_cost) : '—';
  cards[0].querySelector('p').textContent =
    f.cost_change_pct != null
      ? (f.cost_change_pct > 0 ? '+' : '') + f.cost_change_pct.toFixed(1) + '% vs current month'
      : 'Forecast unavailable';
  cards[1].querySelector('h3').textContent =
    f.predicted_kwh != null ? Math.round(f.predicted_kwh) + ' kWh' : '—';
  cards[1].querySelector('p').textContent = f.energy_driver || 'Based on current usage trends';
  cards[2].querySelector('h3').textContent =
    f.budget_risk ? (f.budget_risk === true ? 'High' : f.budget_risk) : 'Low';
  cards[2].querySelector('p').textContent =
    f.budget_risk_message || (f.budget_risk ? 'Cost trending above budget.' : 'Spending within range.');
}

// ── Forecast Chart ────────────────────────────────────────────
async function loadForecastChart() {
  const data = await apiFetch('/api/forecast/trend?days=30');
  const fallbackBase = Array.from({ length: 30 }, (_, i) => 35 + i * 0.7);
  const fallbackDays = Array.from({ length: 30 }, (_, i) => 'D' + (i + 1));

  if (!data || !data.trend) {
    makeChart('forecastChart', {
      color: ['#166534', '#22C55E', '#22C55E'], tooltip: { trigger: 'axis' }, legend: { top: 0 },
      grid: { left: 45, right: 20, top: 45, bottom: 35 },
      xAxis: { type: 'category', data: fallbackDays },
      yAxis: { type: 'value', name: 'RM x1000' },
      series: [
        { name: 'Forecast', type: 'line', smooth: true, data: fallbackBase, lineStyle: { width: 4 }, areaStyle: { opacity: 0.12 } },
        { name: 'Upper Band', type: 'line', smooth: true, data: fallbackBase.map(v => v + 3), lineStyle: { type: 'dashed' }, symbol: 'none' },
        { name: 'Lower Band', type: 'line', smooth: true, data: fallbackBase.map(v => v - 3), lineStyle: { type: 'dashed' }, symbol: 'none' }
      ]
    });
    return;
  }
  const vals = data.trend.map(p => parseFloat((p.value || p.amount || 0).toFixed(1)));
  const labels = data.trend.map((_, i) => 'D' + (i + 1));
  makeChart('forecastChart', {
    color: ['#166534', '#22C55E', '#22C55E'], tooltip: { trigger: 'axis' }, legend: { top: 0 },
    grid: { left: 45, right: 20, top: 45, bottom: 35 },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value', name: 'RM x1000' },
    series: [
      { name: 'Forecast', type: 'line', smooth: true, data: vals, lineStyle: { width: 4 }, areaStyle: { opacity: 0.12 } },
      { name: 'Upper Band', type: 'line', smooth: true, data: vals.map(v => +(v + 3).toFixed(1)), lineStyle: { type: 'dashed' }, symbol: 'none' },
      { name: 'Lower Band', type: 'line', smooth: true, data: vals.map(v => +(v - 3).toFixed(1)), lineStyle: { type: 'dashed' }, symbol: 'none' }
    ]
  });
}

// ── Anomalies & Recommendations ───────────────────────────────
async function loadAnomalies() {
  const grid = document.querySelector('.insight-grid');
  if (!grid) return;
  const [anomalies, recs] = await Promise.all([
    apiFetch('/api/anomalies?limit=50&status=pending'),
    apiFetch('/api/recommendations?limit=1')
  ]);
  const badgeClass = s => s === 'critical' || s === 'high' ? 'danger' : s === 'medium' ? 'warning' : 'success';
  const badgeLabel = s => s === 'critical' ? 'Critical' : s === 'high' ? 'High' : s === 'medium' ? 'Medium' : 'Low';
  const items = (anomalies || []).slice(0, 4).map(a => ({
    badge: badgeClass(a.severity), label: badgeLabel(a.severity),
    title: a.title || a.description?.slice(0, 40) || 'Anomaly Detected',
    desc: a.description || '', btn: 'View Details'
  }));
  if (recs && recs.length) {
    const r = recs[0];
    items.push({ badge: 'success', label: 'High Impact',
      title: r.title || 'Optimisation Opportunity', desc: r.description || '', btn: 'Implement' });
  }
  if (!items.length) {
    grid.innerHTML = '<div class="insight-card"><p>No active alerts.</p></div>';
    return;
  }
  grid.innerHTML = items.map(i => `
    <div class="insight-card">
      <div class="alert-badge ${i.badge}">${i.label}</div>
      <h3>${i.title}</h3><p>${i.desc}</p>
      <button>${i.btn}</button>
    </div>`).join('');
}

// ── Volt Buddy ────────────────────────────────────────────────
async function loadVoltBuddy() {
  const kpi = await apiFetch('/api/kpi/current');
  if (!kpi) return;
  const score = kpi.efficiency_score ?? 65;
  const fill = document.querySelector('.vb-fill');
  const val = document.querySelector('.vb-value');
  const pill = document.querySelector('.vb-status-pill');
  if (fill) fill.style.height = score + '%';
  if (val) val.textContent = score + '%';
  if (pill) {
    pill.textContent = score >= 80 ? 'Optimal' : score >= 60 ? 'Good' : 'Needs Attention';
    pill.className = 'vb-status-pill ' + (score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red');
  }
  const head = document.querySelector('.vb-head');
  if (head) head.textContent = score >= 80 ? '😎' : score >= 60 ? '🙂' : '😟';
}

// ── Simulation ────────────────────────────────────────────────
async function runSimulation() {
  const input = document.getElementById('simulationInput');
  const grid = document.getElementById('scenarioGrid');
  const riskBox = document.querySelector('.risk-box');
  if (!input || !grid) return;
  const query = input.value.trim();
  if (!query) return;

  grid.innerHTML = '<div class="scenario-card" style="grid-column:1/-1;text-align:center;padding:2rem"><p>Simulating…</p></div>';
  if (riskBox) riskBox.style.display = 'none';

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
  }

  if (data && (data.scenario_a || data.scenario_b || data.scenario_c)) {
    renderSimulation(data);
  } else {
    grid.innerHTML = '<div class="scenario-card" style="grid-column:1/-1;text-align:center;padding:2rem"><p>Could not generate scenarios. Please try again.</p></div>';
  }
}

function renderSimulation(data) {
  const grid = document.getElementById('scenarioGrid');
  const riskBox = document.querySelector('.risk-box');
  if (!grid) return;

  const rec = data.recommended ? data[data.recommended] : data.scenario_c || data.scenario_b || data.scenario_a;
  grid.innerHTML = [
    { key: 'scenario_a', label: 'Scenario A' },
    { key: 'scenario_b', label: 'Scenario B' },
    { key: 'scenario_c', label: 'Scenario C' }
  ].map(({ key, label }) => {
    const s = data[key];
    if (!s) return '';
    const isRec = data.recommended === key;
    return `<div class="scenario-card${isRec ? ' recommended' : ''}">
      <span>${label}${isRec ? ' ★ Recommended' : ''}</span>
      <h3>${s.name || label}</h3><p>${s.description || ''}</p>
      <ul>
        <li>Savings: <strong>${fmtRM(s.savings)}/month</strong></li>
        <li>Carbon Reduction: <strong>${s.carbon_reduction || 0}%</strong></li>
        <li>Effort: <strong>${s.effort || '—'}</strong></li>
        <li>Comfort Score: <strong>${s.comfort_score || 0}%</strong></li>
      </ul>
    </div>`;
  }).join('');

  if (riskBox && rec) {
    riskBox.style.display = '';
    const cs = rec.comfort_score || 75;
    const comfortImpact = cs >= 86 ? ['Low', 'good'] : cs >= 75 ? ['Moderate', 'warn'] : ['High', 'bad'];
    const bizImpact = rec.effort === 'Low' ? ['Low', 'good'] : rec.effort === 'Medium' ? ['Moderate', 'warn'] : ['High', 'bad'];
    const cr = rec.carbon_reduction || 0;
    const roi = cr >= 25 ? ['Very High', 'good'] : cr >= 12 ? ['High', 'good'] : cr >= 6 ? ['Medium', 'warn'] : ['Low', 'bad'];
    const riskGrid = riskBox.querySelector('.risk-grid');
    if (riskGrid) {
      riskGrid.innerHTML = `
        <div><strong>Comfort Impact</strong><span class="risk-val ${comfortImpact[1]}">${comfortImpact[0]}</span></div>
        <div><strong>Business Impact</strong><span class="risk-val ${bizImpact[1]}">${bizImpact[0]}</span></div>
        <div><strong>ROI</strong><span class="risk-val ${roi[1]}">${roi[0]}</span></div>
        <div><strong>Payback</strong><span class="risk-val neutral">${rec.timeline || '—'}</span></div>`;
    }
  }
}

// ── Nav Scroll Spy ────────────────────────────────────────────
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

// ── Boot ──────────────────────────────────────────────────────
loadDashboard();
loadEnergyChart();
loadRoomChart();
loadForecast();
loadForecastChart();
loadAnomalies();
loadVoltBuddy();
