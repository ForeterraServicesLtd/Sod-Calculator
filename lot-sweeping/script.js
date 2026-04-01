const g = id => document.getElementById(id);
const fmt = n => '$' + Math.round(n).toLocaleString('en-CA');
const num = id => parseFloat(g(id).value) || 0;
const roundHalf = n => n > 0 ? Math.ceil(n * 2) / 2 : 0;
const fmtHrs = h => {
  if (h === 0) return '0 hrs';
  if (h === 0.5) return '0.5 hr';
  return h + ' hrs';
};

const EQUIPMENT = [
  { id: 'eq-skid',   label: 'Skid steer w/ sweeper', defaultRate: 150, defaultSweep: 2500 },
  { id: 'eq-push',   label: 'Push / walk-behind sweeper', defaultRate: 0, defaultSweep: 1000 },
  { id: 'eq-vac',    label: 'Parking lot vacuum', defaultRate: 0, defaultSweep: 3000 },
  { id: 'eq-blow',   label: 'Backpack blower', defaultRate: 0, defaultSweep: 2000 },
];

// Build equipment list
const equipList = g('equip-list');
EQUIPMENT.forEach(eq => {
  const item = document.createElement('div');
  item.className = 'sb-field';
  item.innerHTML = `
    <label class="phase-check">
      <input type="checkbox" id="${eq.id}-tog">
      ${eq.label}
    </label>
    <div id="${eq.id}-inputs" class="equip-inputs">
      <div class="sb-field" style="margin-top:8px;">
        <div class="sb-label">Rate ($/hr)</div>
        <input class="sb-input" type="number" id="${eq.id}-rate" value="${eq.defaultRate}" min="0" step="5" placeholder="$/hr">
      </div>
      <div class="sb-field" style="margin-top:8px;">
        <div class="sb-label">Sweep rate (sq ft/hr) <strong id="${eq.id}-sweep-out">${Number(eq.defaultSweep).toLocaleString()}</strong></div>
        <input type="range" id="${eq.id}-sweep" min="250" max="10000" step="250" value="${eq.defaultSweep}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
          <span style="font-size:10px;color:var(--slate-light);">Calculated hrs:</span>
          <span class="hrs-pill" id="${eq.id}-hrs-display">—</span>
        </div>
      </div>
    </div>`;
  equipList.appendChild(item);

  g(eq.id + '-tog').addEventListener('change', () => {
    g(eq.id + '-inputs').classList.toggle('open', g(eq.id + '-tog').checked);
    calc();
  });
  g(eq.id + '-rate').addEventListener('input', calc);

  const sweepEl = g(eq.id + '-sweep');
  const sweepOut = g(eq.id + '-sweep-out');
  sweepEl.addEventListener('input', () => {
    sweepOut.textContent = Number(sweepEl.value).toLocaleString();
    calc();
  });
});

// Slider bindings
[['sb-burden','sb-burden-out', v => v+'%'],
 ['sb-labmargin','sb-labmargin-out', v => v+'%'],
 ['sb-margin','sb-margin-out', v => v+'%'],
 ['sb-disc','sb-disc-out', v => v+'%'],
].forEach(([id, outId, fn]) => {
  const el = g(id), out = g(outId);
  if (out) out.textContent = fn(el.value);
  el.addEventListener('input', () => { if (out) out.textContent = fn(el.value); calc(); });
});

['sb-area','sb-crew','sb-wage','sb-labhrs','sb-truck','sb-tip','sb-mob']
  .forEach(id => g(id).addEventListener('input', calc));
['sb-gst'].forEach(id => g(id).addEventListener('change', calc));

function calc() {
  const area    = num('sb-area');
  const crew    = num('sb-crew') || 1;
  const wage    = num('sb-wage');
  const burden  = num('sb-burden') / 100;
  const labMarg = num('sb-labmargin') / 100;
  const truck   = num('sb-truck');
  const tip     = num('sb-tip');
  const mob     = num('sb-mob');
  const jobMarg = num('sb-margin') / 100;
  const disc    = num('sb-disc') / 100;
  const gst     = g('sb-gst').checked;

  const loadedWage = wage * (1 + burden);
  const billedRate = loadedWage * (1 + labMarg);

  g('sb-crewrate').textContent = '$' + billedRate.toFixed(2) + '/hr';
  g('sb-crewrate-sub').textContent = 'billed rate per worker';

  // Calculate equipment hours and costs
  let totalEquipCost = 0;
  let totalJobHrs = 0;
  const activeEquip = [];

  EQUIPMENT.forEach(eq => {
    const active = g(eq.id + '-tog').checked;
    const eqRate = num(eq.id + '-rate');
    const sweepRate = num(eq.id + '-sweep');
    const hrs = active && sweepRate > 0 && area > 0 ? roundHalf(area / sweepRate) : 0;

    // Update hours display
    g(eq.id + '-hrs-display').textContent = active && sweepRate > 0 && area > 0 ? fmtHrs(hrs) : '—';

    if (active && hrs > 0) {
      const eqCost = eqRate * hrs;
      totalEquipCost += eqCost;
      if (hrs > totalJobHrs) totalJobHrs = hrs;

      activeEquip.push({
        label: eq.label,
        hrs, eqRate, eqCost, sweepRate
      });
    }
  });

  // Labour: independent hours from input
  const labHrs = num('sb-labhrs');
  const totalLabCost = labHrs * loadedWage * crew;
  const totalLabBilled = labHrs * billedRate * crew;

  const fixedCost = truck + tip + mob;
  const equipAndFixed = totalEquipCost + fixedCost;
  const equipBilled = jobMarg < 1 ? equipAndFixed / (1 - jobMarg) : equipAndFixed * 2;

  const subtotal    = totalLabBilled + equipBilled;
  const afterDisc   = subtotal * (1 - disc);
  const gstAmt      = gst ? afterDisc * 0.05 : 0;
  const clientTotal = afterDisc + gstAmt;
  const trueCost    = totalLabCost + equipAndFixed;
  const profit      = afterDisc - trueCost;
  const perSqft     = area > 0 ? afterDisc / area : 0;

  g('m-quote').textContent   = fmt(afterDisc);
  g('m-sqft').textContent    = area > 0 ? '$' + perSqft.toFixed(2) + ' per sq ft' : '—';
  g('m-cost').textContent    = fmt(trueCost);
  g('m-profit').textContent  = fmt(profit);
  g('m-margin-sub').textContent = Math.round(labMarg * 100) + '% labour · ' + Math.round(jobMarg * 100) + '% job';
  g('f-cost').textContent    = fmt(trueCost);
  g('f-lab').textContent     = fmt(totalLabBilled);
  g('f-equip').textContent   = fmt(equipBilled);
  g('f-profit').textContent  = fmt(profit);
  g('q-total').textContent   = fmt(clientTotal);
  g('q-gst-note').textContent = gst ? '(incl. GST)' : '(no GST)';

  let html = '';

  // Labour
  html += `<div class="invoice-section-head">Labour</div>`;
  if (labHrs > 0) {
    html += `<div class="q-line">
      <div class="q-line-left">
        <div class="q-line-label">General labour <span class="chip chip-labour">labour</span></div>
        <div class="q-line-sub">${fmtHrs(labHrs)} · ${crew} worker${crew > 1 ? 's' : ''} × $${billedRate.toFixed(2)}/hr</div>
      </div>
      <div class="q-line-val" style="color:var(--blue);">${fmt(totalLabBilled)}</div>
    </div>`;
  } else {
    html += `<div class="q-line">
      <div class="q-line-left"><div class="q-line-label" style="color:var(--slate-light);">Select equipment to calculate labour</div></div>
      <div class="q-line-val">$0</div>
    </div>`;
  }

  // Equipment
  if (activeEquip.length > 0) {
    html += `<div class="invoice-section-head">Equipment</div>`;
    activeEquip.forEach(e => {
      html += `<div class="q-line">
        <div class="q-line-left">
          <div class="q-line-label">${e.label} <span class="chip chip-equip">equip</span></div>
          <div class="q-line-sub">${fmtHrs(e.hrs)} × $${e.eqRate}/hr · ${Number(e.sweepRate).toLocaleString()} sq ft/hr</div>
        </div>
        <div class="q-line-val" style="color:var(--amber);">${fmt(e.eqCost)}</div>
      </div>`;
    });
  }

  // Fixed
  const hasFixed = truck > 0 || tip > 0 || mob > 0;
  if (hasFixed) {
    html += `<div class="invoice-section-head">Fixed costs</div>`;
    if (truck > 0) html += `<div class="q-line">
      <div class="q-line-left"><div class="q-line-label">Trucking / haul-off <span class="chip chip-fixed">fixed</span></div></div>
      <div class="q-line-val" style="color:#5a3ab0;">${fmt(truck)}</div>
    </div>`;
    if (tip > 0) html += `<div class="q-line">
      <div class="q-line-left"><div class="q-line-label">Tipping / dump fee <span class="chip chip-fixed">fixed</span></div></div>
      <div class="q-line-val" style="color:#5a3ab0;">${fmt(tip)}</div>
    </div>`;
    if (mob > 0) html += `<div class="q-line">
      <div class="q-line-left"><div class="q-line-label">Mobilization / setup <span class="chip chip-fixed">fixed</span></div></div>
      <div class="q-line-val" style="color:#5a3ab0;">${fmt(mob)}</div>
    </div>`;
  }

  // Margin
  if (jobMarg > 0) {
    html += `<div class="invoice-section-head">Margin</div>`;
    html += `<div class="q-line">
      <div class="q-line-left">
        <div class="q-line-label">Job margin — equipment &amp; fixed <span class="chip chip-margin">margin</span></div>
        <div class="q-line-sub">${Math.round(jobMarg * 100)}% applied to $${Math.round(equipAndFixed).toLocaleString('en-CA')} cost</div>
      </div>
      <div class="q-line-val" style="color:var(--amber);">${fmt(equipBilled - equipAndFixed)}</div>
    </div>`;
  }

  // Discount
  if (disc > 0) {
    html += `<div class="q-line disc">
      <div class="q-line-left"><div class="q-line-label">Client discount (${Math.round(disc * 100)}%) <span class="chip chip-disc">discount</span></div></div>
      <div class="q-line-val">-${fmt(subtotal * disc)}</div>
    </div>`;
  }

  // GST
  if (gst) {
    html += `<div class="invoice-section-head">Tax</div>`;
    html += `<div class="q-line">
      <div class="q-line-left"><div class="q-line-label">GST (5%) <span class="chip chip-tax">tax</span></div></div>
      <div class="q-line-val">${fmt(gstAmt)}</div>
    </div>`;
  }

  g('q-invoice-body').innerHTML = html;

  const totalHrs = activeEquip.reduce((sum, e) => sum + e.hrs, 0);
  g('time-bar').textContent =
    `Lot: ${area > 0 ? Number(area).toLocaleString() : '—'} sq ft  ·  ` +
    activeEquip.map(e => `${e.label}: ${fmtHrs(e.hrs)} @ ${Number(e.sweepRate).toLocaleString()} sq ft/hr`).join('  ·  ') +
    (activeEquip.length > 0 ? '  ·  ' : '') +
    `$${area > 0 ? perSqft.toFixed(2) : '—'}/sq ft to client`;
}

calc();
