const g = id => document.getElementById(id);
const fmt = n => '$' + Math.round(n).toLocaleString('en-CA');
const num = id => parseFloat(g(id).value) || 0;
const roundHalf = n => n > 0 ? Math.ceil(n * 2) / 2 : 0;
const fmtHrs = h => h === 0 ? '0 hrs' : h === 0.5 ? '0.5 hr' : h + ' hrs';

function toggleSvc(id, cb) {
  const lbl = g('lbl-' + id);
  const det = g('det-' + id);
  if (lbl) lbl.classList.toggle('active', cb.checked);
  if (det) det.classList.toggle('open', cb.checked);
  calc();
}

// Service definitions
const SERVICES = [
  { id: 'mow',      label: 'Lawn mowing',            defaultRate: 5000,  hasMat: false, matId: null,            equipId: null },
  { id: 'edge',     label: 'Lawn edging',             defaultRate: 3000,  hasMat: false, matId: null,            equipId: null },
  { id: 'trim',     label: 'String trimming',         defaultRate: 2000,  hasMat: false, matId: null,            equipId: null },
  { id: 'blow',     label: 'Blowing / cleanup',       defaultRate: 4000,  hasMat: false, matId: null,            equipId: null },
  { id: 'fert',     label: 'Fertilizing',             defaultRate: 5000,  hasMat: true,  matId: 'fert-mat',      equipId: null },
  { id: 'seed',     label: 'Overseeding',             defaultRate: 3000,  hasMat: true,  matId: 'seed-mat',      equipId: null },
  { id: 'dethatch', label: 'De-thatching / aerating', defaultRate: 2000,  hasMat: false, matId: null,            equipId: 'dethatch-equip' },
];

// Wire efficiency sliders
SERVICES.forEach(svc => {
  const slider = g(svc.id + '-rate');
  const out = g(svc.id + '-rate-out');
  if (slider && out) {
    out.textContent = Number(slider.value).toLocaleString();
    slider.addEventListener('input', () => {
      out.textContent = Number(slider.value).toLocaleString();
      calc();
    });
  }
});

// Wire other sliders
[['sb-burden','sb-burden-out', v => v+'%'],
 ['sb-labmargin','sb-labmargin-out', v => v+'%'],
 ['sb-margin','sb-margin-out', v => v+'%'],
 ['sb-disc','sb-disc-out', v => v+'%'],
].forEach(([id, outId, fn]) => {
  const el = g(id), out = g(outId);
  if (out) out.textContent = fn(el.value);
  el.addEventListener('input', () => { if (out) out.textContent = fn(el.value); calc(); });
});

// Wire inputs
['sb-area','sb-crew','sb-visits','sb-wage','sb-labhrs','sb-mob',
 'eq-walkbehind','eq-rideon',
 'fert-mat','seed-mat','dethatch-equip',
].forEach(id => { const el = g(id); if(el) el.addEventListener('input', calc); });

['sb-gst','tog-mow','tog-edge','tog-trim','tog-blow',
 'tog-fert','tog-seed','tog-dethatch',
].forEach(id => g(id).addEventListener('change', calc));

function calc() {
  const area     = num('sb-area');
  const crew     = num('sb-crew') || 1;
  const visits   = num('sb-visits') || 1;
  const wage     = num('sb-wage');
  const labHrs   = num('sb-labhrs');
  const burden   = num('sb-burden') / 100;
  const labMarg  = num('sb-labmargin') / 100;
  const mob      = num('sb-mob');
  const jobMarg  = num('sb-margin') / 100;
  const disc     = num('sb-disc') / 100;
  const gst      = g('sb-gst').checked;

  const loadedWage = wage * (1 + burden);
  const billedRate = loadedWage * (1 + labMarg);

  g('sb-billedrate-display').textContent = '$' + billedRate.toFixed(2) + '/hr';

  // Equipment cost (from general labour hours)
  const eqWalkCost = num('eq-walkbehind') * labHrs;
  const eqRideCost = num('eq-rideon') * labHrs;
  const eqCost = eqWalkCost + eqRideCost;

  // Build services
  const services = [];

  SERVICES.forEach(svc => {
    if (!g('tog-' + svc.id).checked) return;

    const effRate = num(svc.id + '-rate') || 1;
    const hrs = area > 0 ? roundHalf(area / effRate) : 0;
    const totalHrs = hrs * crew;

    // Update hours display
    const hrsDisplay = g(svc.id + '-hrs-display');
    if (hrsDisplay) hrsDisplay.textContent = area > 0 ? fmtHrs(hrs) : '—';

    const labCost = totalHrs * loadedWage;
    const labBilled = totalHrs * billedRate;

    // Material or equipment cost
    let matCost = 0;
    if (svc.matId) matCost = num(svc.matId);
    if (svc.equipId) matCost = num(svc.equipId);

    // Add mowing equipment cost
    let extraEqCost = 0;
    if (svc.id === 'mow') extraEqCost = eqCost;

    const matBilled = jobMarg < 1 ? (matCost + extraEqCost) / (1 - jobMarg) : (matCost + extraEqCost) * 2;
    const totalBilled = labBilled + matBilled;
    const totalCost = labCost + matCost + extraEqCost;

    let sub = `${fmtHrs(hrs)} · ${crew} worker${crew > 1 ? 's' : ''} × $${billedRate.toFixed(2)}/hr · ${Number(effRate).toLocaleString()} sq ft/hr`;
    if (matCost > 0) sub += ` · material: $${matCost}`;
    if (extraEqCost > 0) sub += ` · equip: $${Math.round(extraEqCost)}`;

    services.push({
      label: svc.label,
      chip: svc.matId ? 'chip-mat' : svc.equipId ? 'chip-equip' : 'chip-labour',
      billed: totalBilled,
      cost: totalCost,
      labBilled,
      sub,
      isMow: svc.id === 'mow',
      hasMat: !!svc.matId
    });
  });

  const subtotalServices = services.reduce((a, s) => a + s.billed, 0);
  const fixedBilled = jobMarg < 1 ? mob / (1 - jobMarg) : mob * 2;
  const subtotal  = subtotalServices + fixedBilled;
  const afterDisc = subtotal * (1 - disc);
  const gstAmt    = gst ? afterDisc * 0.05 : 0;
  const clientTotal = afterDisc + gstAmt;

  const trueCostPerVisit = services.reduce((a, s) => a + s.cost, 0) + mob;
  const profit = afterDisc - trueCostPerVisit;
  const perSqft = area > 0 ? afterDisc / area : 0;
  const totalLabBilled = services.reduce((a, s) => a + (s.labBilled || 0), 0);

  g('m-quote').textContent  = fmt(afterDisc);
  g('m-sqft').textContent   = area > 0 ? '$' + perSqft.toFixed(3) + ' per sq ft' : '—';
  g('m-cost').textContent   = fmt(trueCostPerVisit);
  g('m-cost-season').textContent = fmt(trueCostPerVisit * visits) + ' season (' + visits + ' visits)';
  g('m-profit').textContent = fmt(profit);
  g('m-season').textContent = fmt(profit * visits) + ' season (' + visits + ' visits)';
  g('f-cost').textContent   = fmt(trueCostPerVisit);
  g('f-lab').textContent    = fmt(totalLabBilled);
  g('f-visits').textContent = visits + ' visits';
  g('f-season').textContent = fmt(profit * visits);
  g('q-total').textContent  = fmt(clientTotal);
  g('q-gst-note').textContent = gst ? '(incl. GST)' : '(no GST)';
  g('q-season-total').textContent = fmt(clientTotal * visits);
  g('q-season-visits').textContent = '(' + visits + ' visits)';

  let html = '';

  if (services.length === 0) {
    html = `<div class="q-line"><div class="q-line-left"><div class="q-line-label" style="color:var(--slate-light);">Select at least one service from the sidebar</div></div><div class="q-line-val">$0</div></div>`;
  } else {
    html += `<div class="invoice-section-head">Services — ${Number(area).toLocaleString()} sq ft</div>`;
    services.forEach(s => {
      const color = s.chip === 'chip-labour' ? 'var(--blue)' : s.chip === 'chip-mat' ? 'var(--green)' : 'var(--amber)';
      const tag = s.isMow ? 'mow' : s.hasMat ? 'material' : 'service';
      html += `<div class="q-line">
        <div class="q-line-left">
          <div class="q-line-label">${s.label} <span class="chip ${s.chip}">${tag}</span></div>
          <div class="q-line-sub">${s.sub}</div>
        </div>
        <div class="q-line-val" style="color:${color};">${fmt(s.billed)}</div>
      </div>`;
    });
  }

  if (mob > 0) {
    html += `<div class="invoice-section-head">Fixed</div>`;
    html += `<div class="q-line">
      <div class="q-line-left"><div class="q-line-label">Mobilization <span class="chip chip-fixed">fixed</span></div></div>
      <div class="q-line-val" style="color:#5a3ab0;">${fmt(fixedBilled)}</div>
    </div>`;
  }

  if (disc > 0) {
    html += `<div class="q-line disc">
      <div class="q-line-left"><div class="q-line-label">Client discount (${Math.round(disc*100)}%) <span class="chip chip-disc">discount</span></div></div>
      <div class="q-line-val">-${fmt(subtotal * disc)}</div>
    </div>`;
  }

  if (gst) {
    html += `<div class="invoice-section-head">Tax</div>`;
    html += `<div class="q-line">
      <div class="q-line-left"><div class="q-line-label">GST (5%) <span class="chip chip-tax">tax</span></div></div>
      <div class="q-line-val">${fmt(gstAmt)}</div>
    </div>`;
  }

  g('q-invoice-body').innerHTML = html;

  const totalSvcHrs = services.reduce((a, s) => a + (s.labBilled / billedRate / crew || 0), 0);
  g('time-bar').textContent =
    `${area > 0 ? Number(area).toLocaleString() : '—'} sq ft  ·  ` +
    `${services.length} service${services.length !== 1 ? 's' : ''}  ·  ` +
    `${visits} visits/season  ·  ` +
    `Season total: ${fmt(clientTotal * visits)}` +
    (gst ? ' (incl. GST)' : '');
}

calc();
