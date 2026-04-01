const g = id => document.getElementById(id);
const fmt = n => '$' + Math.round(n).toLocaleString('en-CA');
const num = id => parseFloat(g(id).value) || 0;
const roundHalf = n => n > 0 ? Math.ceil(n * 2) / 2 : 0;
const fmtHrs = h => h === 0 ? '0 hrs' : h === 0.5 ? '0.5 hr' : h % 1 === 0 ? h + ' hrs' : h + ' hrs';

function toggleSvc(id, cb) {
  const lbl = g('lbl-' + id);
  const det = g('det-' + id);
  if (lbl) lbl.classList.toggle('active', cb.checked);
  if (det) det.classList.toggle('open', cb.checked);
  calc();
}

// sliders
[['sb-burden','sb-burden-out', v => v+'%'],
 ['sb-labmargin','sb-labmargin-out', v => v+'%'],
 ['sb-margin','sb-margin-out', v => v+'%'],
 ['sb-disc','sb-disc-out', v => v+'%'],
].forEach(([id, outId, fn]) => {
  const el = g(id), out = g(outId);
  if (out) out.textContent = fn(el.value);
  el.addEventListener('input', () => { if (out) out.textContent = fn(el.value); calc(); });
});

['sb-area','sb-crew','sb-visits','sb-wage','sb-labhrs','sb-mob',
 'eq-walkbehind','eq-rideon',
 'edge-lft','edge-rate','trim-hrs','trim-rate',
 'blow-hrs','blow-rate','fert-mat','fert-labour',
 'seed-mat','seed-labour','dethatch-equip','dethatch-labour',
].forEach(id => { const el = g(id); if(el) el.addEventListener('input', calc); });

['sb-gst','tog-mow','tog-edge','tog-trim','tog-blow',
 'tog-fert','tog-seed','tog-dethatch',
].forEach(id => g(id).addEventListener('change', calc));

function calc() {
  const area     = num('sb-area');
  const crew     = num('sb-crew') || 1;
  const visits   = num('sb-visits') || 1;
  const wage     = num('sb-wage');
  const burden   = num('sb-burden') / 100;
  const labMarg  = num('sb-labmargin') / 100;
  const labHrs   = num('sb-labhrs');
  const mob      = num('sb-mob');
  const jobMarg  = num('sb-margin') / 100;
  const disc     = num('sb-disc') / 100;
  const gst      = g('sb-gst').checked;

  const loadedWage = wage * (1 + burden);
  const billedRate = loadedWage * (1 + labMarg);

  // Labour from manual hours input
  const totalLabHrs = labHrs * crew;
  const mowLabCost   = totalLabHrs * loadedWage;
  const mowLabBilled = totalLabHrs * billedRate;

  g('sb-billedrate-display').textContent = '$' + billedRate.toFixed(2) + '/hr';

  // Equipment cost (mow hrs)
  const eqWalkCost  = num('eq-walkbehind') * labHrs;
  const eqRideCost  = num('eq-rideon') * labHrs;
  const eqCost      = eqWalkCost + eqRideCost;

  // Extra services
  const services = [];

  if (g('tog-mow').checked) {
    const matAndEquip = eqCost;
    const eqBilled = jobMarg < 1 ? matAndEquip / (1 - jobMarg) : matAndEquip * 2;
    services.push({
      label: 'Lawn mowing',
      chip: 'chip-labour',
      billed: mowLabBilled + eqBilled,
      cost: mowLabCost + eqCost,
      labBilled: mowLabBilled,
      sub: `${fmtHrs(totalLabHrs)} · ${crew} worker${crew > 1 ? 's' : ''} × $${billedRate.toFixed(2)}/hr`,
      eqCost, isMow: true
    });
  }

  if (g('tog-edge').checked) {
    const lft = num('edge-lft');
    const rate = num('edge-rate');
    const billed = lft * rate;
    const cost = lft * rate * (loadedWage / billedRate);
    services.push({ label: 'Lawn edging', chip: 'chip-labour', billed, cost, labBilled: billed, sub: `${lft} lineal ft × $${rate}/ft`, isMow: false });
  }

  if (g('tog-trim').checked) {
    const hrs = num('trim-hrs');
    const rate = num('trim-rate');
    const billed = hrs * rate;
    const cost = hrs * loadedWage * crew;
    services.push({ label: 'String trimming', chip: 'chip-labour', billed, cost, labBilled: billed, sub: `${fmtHrs(hrs)} × $${rate}/hr`, isMow: false });
  }

  if (g('tog-blow').checked) {
    const hrs = num('blow-hrs');
    const rate = num('blow-rate');
    const billed = hrs * rate;
    const cost = hrs * loadedWage * crew;
    services.push({ label: 'Blowing / site cleanup', chip: 'chip-labour', billed, cost, labBilled: billed, sub: `${fmtHrs(hrs)} × $${rate}/hr`, isMow: false });
  }

  if (g('tog-fert').checked) {
    const mat = num('fert-mat');
    const lab = num('fert-labour');
    const matB = jobMarg < 1 ? mat / (1 - jobMarg) : mat * 2;
    services.push({ label: 'Fertilizing', chip: 'chip-mat', billed: matB + lab, cost: mat + lab, labBilled: lab, sub: `Material: $${mat} · Labour: $${lab}`, isMow: false, hasMat: true });
  }

  if (g('tog-seed').checked) {
    const mat = num('seed-mat');
    const lab = num('seed-labour');
    const matB = jobMarg < 1 ? mat / (1 - jobMarg) : mat * 2;
    services.push({ label: 'Overseeding', chip: 'chip-mat', billed: matB + lab, cost: mat + lab, labBilled: lab, sub: `Seed material: $${mat} · Labour: $${lab}`, isMow: false, hasMat: true });
  }

  if (g('tog-dethatch').checked) {
    const equip = num('dethatch-equip');
    const lab = num('dethatch-labour');
    const equipB = jobMarg < 1 ? equip / (1 - jobMarg) : equip * 2;
    services.push({ label: 'De-thatching / aerating', chip: 'chip-equip', billed: equipB + lab, cost: equip + lab, labBilled: lab, sub: `Equipment: $${equip} · Labour: $${lab}`, isMow: false });
  }

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
  g('m-season').textContent = fmt(afterDisc * visits) + ' season (' + visits + ' visits)';
  g('f-cost').textContent   = fmt(trueCostPerVisit);
  g('f-lab').textContent    = fmt(totalLabBilled);
  g('f-visits').textContent = visits + ' visits';
  g('f-season').textContent = fmt(clientTotal * visits);
  g('q-total').textContent  = fmt(clientTotal);
  g('q-gst-note').textContent = gst ? '(incl. GST)' : '(no GST)';

  let html = '';

  if (services.length === 0) {
    html = `<div class="q-line"><div class="q-line-left"><div class="q-line-label" style="color:var(--slate-light);">Select at least one service from the sidebar</div></div><div class="q-line-val">$0</div></div>`;
  } else {
    html += `<div class="invoice-section-head">Services \u2014 ${Number(area).toLocaleString()} sq ft</div>`;
    services.forEach(s => {
      html += `<div class="q-line">
        <div class="q-line-left">
          <div class="q-line-label">${s.label} <span class="chip ${s.chip}">${s.isMow ? 'mow' : s.hasMat ? 'material' : 'service'}</span></div>
          <div class="q-line-sub">${s.sub}</div>
        </div>
        <div class="q-line-val" style="color:${s.chip === 'chip-labour' ? 'var(--blue)' : s.chip === 'chip-mat' ? 'var(--green)' : 'var(--amber)'};">${fmt(s.billed)}</div>
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
  g('time-bar').textContent =
    `${area > 0 ? Number(area).toLocaleString() : '\u2014'} sq ft  \u00b7  ` +
    `Labour: ${fmtHrs(totalLabHrs)} (${crew} worker${crew > 1 ? 's' : ''})  \u00b7  ` +
    `${visits} visits/season  \u00b7  ` +
    `Season total: ${fmt(clientTotal * visits)}` +
    (gst ? ' (incl. GST)' : '');
}

calc();
