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

[['sb-rate','sb-rate-out', v => '$' + parseFloat(v).toFixed(2) + '/in'],
 ['sb-burden','sb-burden-out', v => v+'%'],
 ['sb-labmargin','sb-labmargin-out', v => v+'%'],
 ['sb-grindtime','sb-grindtime-out', v => v],
 ['sb-margin','sb-margin-out', v => v+'%'],
 ['sb-disc','sb-disc-out', v => v+'%'],
].forEach(([id, outId, fn]) => {
  const el = g(id), out = g(outId);
  if (out) out.textContent = fn(el.value);
  el.addEventListener('input', () => { if (out) out.textContent = fn(el.value); calc(); });
});

['sb-min','sb-mob','sb-wage',
 'grind-sm-qty','grind-sm-dia','grind-md-qty','grind-md-dia','grind-lg-qty','grind-lg-dia',
 'debris-fee','backfill-yds','backfill-rate','backfill-labour',
 'seed-mat','seed-labour','restore-mat','restore-labour',
].forEach(id => { const el = g(id); if (el) el.addEventListener('input', calc); });

['sb-gst','tog-debris','tog-backfill','tog-seed','tog-restore']
  .forEach(id => g(id).addEventListener('change', calc));

const SIZES = [
  { id: 'sm', label: 'Small', range: '6\u201312"' },
  { id: 'md', label: 'Medium', range: '12\u201324"' },
  { id: 'lg', label: 'Large', range: '24"+' },
];

function stumpPrice(dia, ratePerIn, minCharge) {
  return Math.max(dia * ratePerIn, minCharge);
}

function calc() {
  const ratePerIn   = num('sb-rate');
  const minCharge   = num('sb-min');
  const mob         = num('sb-mob');
  const wage        = num('sb-wage');
  const burden      = num('sb-burden') / 100;
  const labMarg     = num('sb-labmargin') / 100;
  const grindMin    = num('sb-grindtime');
  const jobMarg     = num('sb-margin') / 100;
  const disc        = num('sb-disc') / 100;
  const gst         = g('sb-gst').checked;

  const loadedWage  = wage * (1 + burden);
  const billedRate  = loadedWage * (1 + labMarg);

  g('sb-billedrate-display').textContent = '$' + billedRate.toFixed(2);

  // Calculate stumps
  let totalGrindBilled = 0;
  let totalInches = 0;
  let totalStumps = 0;
  const grindLines = [];

  SIZES.forEach(sz => {
    const qty = num('grind-' + sz.id + '-qty');
    const dia = num('grind-' + sz.id + '-dia');
    if (qty <= 0 || dia <= 0) {
      g('grind-' + sz.id + '-each').textContent = '\u2014';
      g('grind-' + sz.id + '-total').textContent = '$\u2014';
      return;
    }
    const priceEach = stumpPrice(dia, ratePerIn, minCharge);
    const lineTotal = priceEach * qty;
    totalGrindBilled += lineTotal;
    totalInches += dia * qty;
    totalStumps += qty;
    g('grind-' + sz.id + '-each').textContent = fmt(priceEach);
    g('grind-' + sz.id + '-total').textContent = fmt(lineTotal);
    grindLines.push({ label: sz.label + ' stumps (' + sz.range + ')', qty, dia, priceEach, lineTotal });
  });

  // Labour hours from total inches x grind rate
  const rawHrs   = totalInches > 0 ? (totalInches * grindMin) / 60 : 0;
  const labHrs   = roundHalf(rawHrs);
  const labCost  = labHrs * loadedWage;
  const labBilled= labHrs * billedRate;

  g('sb-labhrs-pill').textContent = totalInches > 0 ? fmtHrs(labHrs) : '\u2014';

  // Additional services
  let matCost = 0;
  let matBilledExtra = 0;
  let labCostExtra = 0;
  let labBilledExtra = 0;
  let fixedCost = mob;
  const svcLines = [];

  if (g('tog-debris').checked) {
    const fee = num('debris-fee');
    fixedCost += fee;
    svcLines.push({ label: 'Chip / debris removal', chip: 'chip-fixed', val: fee, sub: 'Flat fee \u2014 haul off site', isFixed: true });
  }

  if (g('tog-backfill').checked) {
    const yds = num('backfill-yds');
    const rate = num('backfill-rate');
    const lab  = num('backfill-labour');
    const mat  = yds * rate;
    const matB = jobMarg < 1 ? mat / (1 - jobMarg) : mat * 2;
    matCost += mat;
    matBilledExtra += matB;
    labCostExtra += lab * 0.65;
    labBilledExtra += lab;
    svcLines.push({ label: 'Backfill \u2014 topsoil', chip: 'chip-mat', val: matB + lab, sub: yds + ' yds \u00d7 $' + rate + '/yd + $' + lab + ' labour', isFixed: false });
  }

  if (g('tog-seed').checked) {
    const mat  = num('seed-mat');
    const lab  = num('seed-labour');
    const matB = jobMarg < 1 ? mat / (1 - jobMarg) : mat * 2;
    matCost += mat;
    matBilledExtra += matB;
    labCostExtra += lab * 0.65;
    labBilledExtra += lab;
    svcLines.push({ label: 'Overseeding', chip: 'chip-mat', val: matB + lab, sub: 'Seed material: $' + mat + ' + $' + lab + ' labour', isFixed: false });
  }

  if (g('tog-restore').checked) {
    const mat  = num('restore-mat');
    const lab  = num('restore-labour');
    const matB = jobMarg < 1 ? mat / (1 - jobMarg) : mat * 2;
    matCost += mat;
    matBilledExtra += matB;
    labCostExtra += lab * 0.65;
    labBilledExtra += lab;
    svcLines.push({ label: 'Full site restoration', chip: 'chip-mat', val: matB + lab, sub: 'Materials: $' + mat + ' \u00b7 Labour: $' + lab, isFixed: false });
  }

  const fixedBilled = jobMarg < 1 ? fixedCost / (1 - jobMarg) : fixedCost * 2;
  const subtotal    = totalGrindBilled + labBilled + matBilledExtra + labBilledExtra + fixedBilled;
  const afterDisc   = subtotal * (1 - disc);
  const gstAmt      = gst ? afterDisc * 0.05 : 0;
  const clientTotal = afterDisc + gstAmt;
  const trueCost    = labCost + labCostExtra + matCost + fixedCost;
  const profit      = afterDisc - trueCost;

  g('m-quote').textContent   = fmt(afterDisc);
  g('m-stumps').textContent  = totalStumps + ' stump' + (totalStumps !== 1 ? 's' : '') + ' \u00b7 ' + totalInches + ' total inches';
  g('m-cost').textContent    = fmt(trueCost);
  g('m-profit').textContent  = fmt(profit);
  g('m-margin-sub').textContent = Math.round(labMarg*100) + '% labour \u00b7 ' + Math.round(jobMarg*100) + '% job';
  g('f-cost').textContent    = fmt(trueCost);
  g('f-grind').textContent   = fmt(totalGrindBilled);
  g('f-lab').textContent     = fmt(labBilled);
  g('f-profit').textContent  = fmt(profit);
  g('q-total').textContent   = fmt(clientTotal);
  g('q-gst-note').textContent = gst ? '(incl. GST)' : '(no GST)';

  let html = '';

  // Grinding lines
  html += `<div class="invoice-section-head">Stump grinding \u2014 $${ratePerIn.toFixed(2)}/inch \u00b7 $${minCharge} minimum per stump</div>`;
  if (grindLines.length === 0) {
    html += `<div class="q-line"><div class="q-line-left"><div class="q-line-label" style="color:var(--slate-light);">Enter stump quantities above</div></div><div class="q-line-val">$0</div></div>`;
  } else {
    grindLines.forEach(l => {
      const minApplied = l.priceEach === minCharge && l.dia * ratePerIn < minCharge;
      html += `<div class="q-line">
        <div class="q-line-left">
          <div class="q-line-label">${l.label} <span class="chip chip-grind">grind</span></div>
          <div class="q-line-sub">${l.qty} \u00d7 ${l.dia}" dia \u00b7 $${ratePerIn.toFixed(2)}/in = ${minApplied ? '<span style="color:var(--amber)">min charge applied</span>' : fmt(l.dia * ratePerIn) + ' \u2192 '} $${Math.round(l.priceEach).toLocaleString('en-CA')}/stump</div>
        </div>
        <div class="q-line-val" style="color:#5a3010;">${fmt(l.lineTotal)}</div>
      </div>`;
    });
  }

  // Labour
  html += `<div class="invoice-section-head">Labour</div>`;
  html += `<div class="q-line">
    <div class="q-line-left">
      <div class="q-line-label">Grinder operator <span class="chip chip-labour">labour</span></div>
      <div class="q-line-sub">${fmtHrs(labHrs)} \u00b7 ${totalInches} total inches \u00b7 ${grindMin} min/inch \u00b7 $${billedRate.toFixed(2)}/hr billed</div>
    </div>
    <div class="q-line-val" style="color:var(--blue);">${fmt(labBilled)}</div>
  </div>`;

  // Additional services
  if (svcLines.length > 0) {
    html += `<div class="invoice-section-head">Additional services</div>`;
    svcLines.forEach(s => {
      const col = s.chip === 'chip-mat' ? 'var(--green)' : s.chip === 'chip-labour' ? 'var(--blue)' : '#5a3ab0';
      html += `<div class="q-line">
        <div class="q-line-left">
          <div class="q-line-label">${s.label} <span class="chip ${s.chip}">${s.isFixed ? 'fixed' : 'material'}</span></div>
          <div class="q-line-sub">${s.sub}</div>
        </div>
        <div class="q-line-val" style="color:${col};">${fmt(s.val)}</div>
      </div>`;
    });
  }

  // Fixed
  if (mob > 0) {
    html += `<div class="invoice-section-head">Fixed</div>`;
    html += `<div class="q-line">
      <div class="q-line-left"><div class="q-line-label">Mobilization <span class="chip chip-fixed">fixed</span></div></div>
      <div class="q-line-val" style="color:#5a3ab0;">${fmt(mob)}</div>
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
    `Stumps: ${totalStumps}  \u00b7  Total inches: ${totalInches}"  \u00b7  ` +
    `Grinding time: ${fmtHrs(labHrs)}  \u00b7  Rate: $${ratePerIn.toFixed(2)}/in  \u00b7  ` +
    `Min charge: $${minCharge}  \u00b7  Profit: ${fmt(profit)}`;
}

calc();
