const g = id => document.getElementById(id);
const fmt = n => '$' + Math.round(n).toLocaleString('en-CA');
const num = id => parseFloat(g(id).value) || 0;
const fmtHrs = h => h === 0 ? '0 hrs' : h === 0.5 ? '0.5 hr' : h + ' hrs';

function toggleSvc(id, cb) {
  const lbl = g('lbl-' + id);
  const det = g('det-' + id);
  if (lbl) lbl.classList.toggle('active', cb.checked);
  if (det) det.classList.toggle('open', cb.checked);
  calc();
}

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

// Input bindings
[
  'sb-area','sb-crew','sb-labhrs','sb-wage',
  'sb-mob','sb-disposal','sb-permits',
  'grade-area','grade-eqrate','grade-eqhrs',
  'topsoil-yards','topsoil-rate','topsoil-del',
  'sod-area','sod-rate','sod-del',
  'seed-area','seed-rate',
  'gravel-area','gravel-depth','gravel-rate','gravel-del',
  'mulch-area','mulch-depth','mulch-rate','mulch-del',
  'retwall-lf','retwall-ht','retwall-rate',
  'paver-area','paver-rate','paver-gravel',
  'trees-qty','trees-cost','trees-hrs',
  'shrubs-qty','shrubs-cost','shrubs-hrs',
  'irrig-zones','irrig-ctrl','irrig-matzone','irrig-labhrs',
  'drain-lf','drain-rate','drain-mat',
  'edging-lf','edging-rate',
].forEach(id => { const el = g(id); if (el) el.addEventListener('input', calc); });

['sb-gst'].forEach(id => g(id).addEventListener('change', calc));

function calc() {
  const area    = num('sb-area');
  const crew    = num('sb-crew') || 1;
  const labHrs  = num('sb-labhrs');
  const wage    = num('sb-wage');
  const burden  = num('sb-burden') / 100;
  const labMarg = num('sb-labmargin') / 100;
  const mob     = num('sb-mob');
  const disposal= num('sb-disposal');
  const permits = num('sb-permits');
  const jobMarg = num('sb-margin') / 100;
  const disc    = num('sb-disc') / 100;
  const gst     = g('sb-gst').checked;

  const loadedWage = wage * (1 + burden);
  const billedRate = loadedWage * (1 + labMarg);

  g('sb-billedrate-display').textContent = '$' + billedRate.toFixed(2) + '/hr';

  // General labour
  const generalLabCost   = labHrs * crew * loadedWage;
  const generalLabBilled = labHrs * crew * billedRate;

  // Track totals
  let totalMatCost = 0;   // true material/equipment cost
  let totalExtraLabCost = 0;
  let totalExtraLabBilled = 0;
  const invoiceLines = [];
  const activeServices = [];

  // Helper: markup materials
  const markup = cost => jobMarg < 1 ? cost / (1 - jobMarg) : cost * 2;

  // --- GRADING ---
  if (g('tog-grade').checked) {
    const eqRate = num('grade-eqrate');
    const eqHrs  = num('grade-eqhrs');
    const eqCost = eqRate * eqHrs;
    totalMatCost += eqCost;
    g('grade-cost-display').textContent = fmt(eqCost);
    invoiceLines.push({ section: 'Grading & Excavation', label: 'Equipment rental', chip: 'chip-equip', chipLabel: 'equip', sub: `${fmtHrs(eqHrs)} x $${eqRate}/hr`, cost: eqCost, billed: markup(eqCost), color: 'var(--amber)' });
    activeServices.push('Grading');
  }

  // --- TOPSOIL ---
  if (g('tog-topsoil').checked) {
    const yards = num('topsoil-yards');
    const rate  = num('topsoil-rate');
    const del   = num('topsoil-del');
    const cost  = yards * rate + del;
    totalMatCost += cost;
    invoiceLines.push({ section: 'Topsoil / Fill', label: 'Topsoil supply + delivery', chip: 'chip-mat', chipLabel: 'material', sub: `${yards} yd x $${rate}/yd + $${del} delivery`, cost, billed: markup(cost), color: 'var(--green)' });
    activeServices.push('Topsoil');
  }

  // --- SOD ---
  if (g('tog-sod').checked) {
    const sodArea = num('sod-area');
    const rate    = num('sod-rate');
    const del     = num('sod-del');
    const cost    = sodArea * rate + del;
    totalMatCost += cost;
    invoiceLines.push({ section: 'Sod Installation', label: 'Sod supply + delivery', chip: 'chip-mat', chipLabel: 'material', sub: `${Number(sodArea).toLocaleString()} sq ft x $${rate}/sq ft + $${del} delivery`, cost, billed: markup(cost), color: 'var(--green)' });
    activeServices.push('Sod');
  }

  // --- SEEDING ---
  if (g('tog-seed').checked) {
    const seedArea = num('seed-area');
    const rate     = num('seed-rate');
    const cost     = seedArea * rate;
    totalMatCost += cost;
    invoiceLines.push({ section: 'Seeding', label: 'Seed material', chip: 'chip-mat', chipLabel: 'material', sub: `${Number(seedArea).toLocaleString()} sq ft x $${rate}/sq ft`, cost, billed: markup(cost), color: 'var(--green)' });
    activeServices.push('Seeding');
  }

  // --- GRAVEL ---
  if (g('tog-gravel').checked) {
    const a = num('gravel-area');
    const d = num('gravel-depth');
    const r = num('gravel-rate');
    const del = num('gravel-del');
    const yards = a * d / 12 / 27;
    const cost = yards * r + del;
    totalMatCost += cost;
    invoiceLines.push({ section: 'Rock / Gravel Beds', label: 'Gravel supply + delivery', chip: 'chip-mat', chipLabel: 'material', sub: `${yards.toFixed(1)} yd (${Number(a).toLocaleString()} sq ft x ${d}" deep) x $${r}/yd + $${del} del`, cost, billed: markup(cost), color: 'var(--green)' });
    activeServices.push('Gravel');
  }

  // --- MULCH ---
  if (g('tog-mulch').checked) {
    const a = num('mulch-area');
    const d = num('mulch-depth');
    const r = num('mulch-rate');
    const del = num('mulch-del');
    const yards = a * d / 12 / 27;
    const cost = yards * r + del;
    totalMatCost += cost;
    invoiceLines.push({ section: 'Mulch Beds', label: 'Mulch supply + delivery', chip: 'chip-mat', chipLabel: 'material', sub: `${yards.toFixed(1)} yd (${Number(a).toLocaleString()} sq ft x ${d}" deep) x $${r}/yd + $${del} del`, cost, billed: markup(cost), color: 'var(--green)' });
    activeServices.push('Mulch');
  }

  // --- RETAINING WALLS ---
  if (g('tog-retwall').checked) {
    const lf   = num('retwall-lf');
    const ht   = num('retwall-ht');
    const rate = num('retwall-rate');
    const sqft = lf * ht;
    const cost = sqft * rate;
    totalMatCost += cost;
    invoiceLines.push({ section: 'Retaining Walls', label: 'Wall block material', chip: 'chip-mat', chipLabel: 'material', sub: `${lf} lf x ${ht} ft = ${Number(sqft).toLocaleString()} sq ft x $${rate}/sq ft`, cost, billed: markup(cost), color: 'var(--green)' });
    activeServices.push('Retaining Walls');
  }

  // --- PAVERS ---
  if (g('tog-paver').checked) {
    const a     = num('paver-area');
    const rate  = num('paver-rate');
    const grRate= num('paver-gravel');
    // Estimate base gravel: 4" base = area * 4/12/27 yards
    const baseYards = a * 4 / 12 / 27;
    const cost  = a * rate + baseYards * grRate;
    totalMatCost += cost;
    invoiceLines.push({ section: 'Pathways / Pavers', label: 'Pavers + base gravel', chip: 'chip-mat', chipLabel: 'material', sub: `${Number(a).toLocaleString()} sq ft x $${rate}/sq ft + ${baseYards.toFixed(1)} yd base x $${grRate}/yd`, cost, billed: markup(cost), color: 'var(--green)' });
    activeServices.push('Pavers');
  }

  // --- TREES ---
  if (g('tog-trees').checked) {
    const qty      = num('trees-qty');
    const costEach = num('trees-cost');
    const hrsEach  = num('trees-hrs');
    const matCost  = qty * costEach;
    const labCostT = qty * hrsEach * loadedWage;
    const labBillT = qty * hrsEach * billedRate;
    totalMatCost += matCost;
    totalExtraLabCost += labCostT;
    totalExtraLabBilled += labBillT;
    invoiceLines.push({ section: 'Planting — Trees', label: 'Trees (material)', chip: 'chip-mat', chipLabel: 'material', sub: `${qty} trees x $${costEach}/ea`, cost: matCost, billed: markup(matCost), color: 'var(--green)' });
    invoiceLines.push({ section: null, label: 'Tree planting labour', chip: 'chip-labour', chipLabel: 'labour', sub: `${qty} x ${fmtHrs(hrsEach)} x $${billedRate.toFixed(2)}/hr`, cost: labCostT, billed: labBillT, color: 'var(--blue)' });
    activeServices.push('Trees');
  }

  // --- SHRUBS ---
  if (g('tog-shrubs').checked) {
    const qty      = num('shrubs-qty');
    const costEach = num('shrubs-cost');
    const hrsEach  = num('shrubs-hrs');
    const matCost  = qty * costEach;
    const labCostS = qty * hrsEach * loadedWage;
    const labBillS = qty * hrsEach * billedRate;
    totalMatCost += matCost;
    totalExtraLabCost += labCostS;
    totalExtraLabBilled += labBillS;
    invoiceLines.push({ section: 'Planting — Shrubs', label: 'Shrubs (material)', chip: 'chip-mat', chipLabel: 'material', sub: `${qty} shrubs x $${costEach}/ea`, cost: matCost, billed: markup(matCost), color: 'var(--green)' });
    invoiceLines.push({ section: null, label: 'Shrub planting labour', chip: 'chip-labour', chipLabel: 'labour', sub: `${qty} x ${fmtHrs(hrsEach)} x $${billedRate.toFixed(2)}/hr`, cost: labCostS, billed: labBillS, color: 'var(--blue)' });
    activeServices.push('Shrubs');
  }

  // --- IRRIGATION ---
  if (g('tog-irrig').checked) {
    const zones   = num('irrig-zones');
    const ctrl    = num('irrig-ctrl');
    const matZone = num('irrig-matzone');
    const labZone = num('irrig-labhrs');
    const matCost = ctrl + zones * matZone;
    const labCostI = zones * labZone * loadedWage;
    const labBillI = zones * labZone * billedRate;
    totalMatCost += matCost;
    totalExtraLabCost += labCostI;
    totalExtraLabBilled += labBillI;
    invoiceLines.push({ section: 'Irrigation', label: 'Controller + zone materials', chip: 'chip-mat', chipLabel: 'material', sub: `$${ctrl} controller + ${zones} zones x $${matZone}/zone`, cost: matCost, billed: markup(matCost), color: 'var(--green)' });
    invoiceLines.push({ section: null, label: 'Irrigation labour', chip: 'chip-labour', chipLabel: 'labour', sub: `${zones} zones x ${fmtHrs(labZone)} x $${billedRate.toFixed(2)}/hr`, cost: labCostI, billed: labBillI, color: 'var(--blue)' });
    activeServices.push('Irrigation');
  }

  // --- DRAINAGE ---
  if (g('tog-drain').checked) {
    const lf   = num('drain-lf');
    const rate = num('drain-rate');
    const mat  = num('drain-mat');
    const cost = lf * rate + mat;
    totalMatCost += cost;
    invoiceLines.push({ section: 'Drainage', label: 'Drainage installation + materials', chip: 'chip-mat', chipLabel: 'material', sub: `${lf} lf x $${rate}/lf + $${mat} materials`, cost, billed: markup(cost), color: 'var(--green)' });
    activeServices.push('Drainage');
  }

  // --- EDGING ---
  if (g('tog-edging').checked) {
    const lf   = num('edging-lf');
    const rate = num('edging-rate');
    const cost = lf * rate;
    totalMatCost += cost;
    invoiceLines.push({ section: 'Edging / Borders', label: 'Edging material', chip: 'chip-mat', chipLabel: 'material', sub: `${lf} lf x $${rate}/lf`, cost, billed: markup(cost), color: 'var(--green)' });
    activeServices.push('Edging');
  }

  // Fixed costs
  const fixedCost = mob + disposal + permits;
  const fixedBilled = markup(fixedCost);

  // Totals
  const totalLabBilled = generalLabBilled + totalExtraLabBilled;
  const totalLabCost   = generalLabCost + totalExtraLabCost;
  const totalMatBilled = invoiceLines.filter(l => l.chip !== 'chip-labour').reduce((a, l) => a + l.billed, 0);

  const subtotal  = totalLabBilled + totalMatBilled + fixedBilled;
  const afterDisc = subtotal * (1 - disc);
  const gstAmt    = gst ? afterDisc * 0.05 : 0;
  const clientTotal = afterDisc + gstAmt;

  const trueCost = totalLabCost + totalMatCost + fixedCost;
  const profit   = afterDisc - trueCost;
  const perSqft  = area > 0 ? afterDisc / area : 0;

  // Update displays
  g('m-quote').textContent  = fmt(afterDisc);
  g('m-sqft').textContent   = area > 0 ? '$' + perSqft.toFixed(2) + ' per sq ft' : '—';
  g('m-cost').textContent   = fmt(trueCost);
  g('m-profit').textContent = fmt(profit);
  g('m-margin-sub').textContent = Math.round(labMarg * 100) + '% labour · ' + Math.round(jobMarg * 100) + '% job';
  g('f-cost').textContent   = fmt(trueCost);
  g('f-lab').textContent    = fmt(totalLabBilled);
  g('f-mat').textContent    = fmt(totalMatBilled + fixedBilled);
  g('f-profit').textContent = fmt(profit);
  g('q-total').textContent  = fmt(clientTotal);
  g('q-gst-note').textContent = gst ? '(incl. GST)' : '(no GST)';

  // Build invoice HTML
  let html = '';

  // General labour
  html += `<div class="invoice-section-head">General Labour</div>`;
  if (labHrs > 0) {
    html += `<div class="q-line">
      <div class="q-line-left">
        <div class="q-line-label">General labour <span class="chip chip-labour">labour</span></div>
        <div class="q-line-sub">${fmtHrs(labHrs)} x ${crew} worker${crew > 1 ? 's' : ''} x $${billedRate.toFixed(2)}/hr</div>
      </div>
      <div class="q-line-val" style="color:var(--blue);">${fmt(generalLabBilled)}</div>
    </div>`;
  } else {
    html += `<div class="q-line">
      <div class="q-line-left"><div class="q-line-label" style="color:var(--slate-light);">Set labour hours above</div></div>
      <div class="q-line-val">$0</div>
    </div>`;
  }

  // Service lines grouped by section
  let lastSection = null;
  invoiceLines.forEach(line => {
    if (line.section && line.section !== lastSection) {
      html += `<div class="invoice-section-head">${line.section}</div>`;
      lastSection = line.section;
    }
    html += `<div class="q-line">
      <div class="q-line-left">
        <div class="q-line-label">${line.label} <span class="chip ${line.chip}">${line.chipLabel}</span></div>
        <div class="q-line-sub">${line.sub}</div>
      </div>
      <div class="q-line-val" style="color:${line.color};">${fmt(line.billed)}</div>
    </div>`;
  });

  // Fixed costs
  if (fixedCost > 0) {
    html += `<div class="invoice-section-head">Fixed costs</div>`;
    if (mob > 0) html += `<div class="q-line"><div class="q-line-left"><div class="q-line-label">Mobilization <span class="chip chip-fixed">fixed</span></div></div><div class="q-line-val" style="color:#5a3ab0;">${fmt(markup(mob))}</div></div>`;
    if (disposal > 0) html += `<div class="q-line"><div class="q-line-left"><div class="q-line-label">Disposal / hauling <span class="chip chip-fixed">fixed</span></div></div><div class="q-line-val" style="color:#5a3ab0;">${fmt(markup(disposal))}</div></div>`;
    if (permits > 0) html += `<div class="q-line"><div class="q-line-left"><div class="q-line-label">Permits / other <span class="chip chip-fixed">fixed</span></div></div><div class="q-line-val" style="color:#5a3ab0;">${fmt(markup(permits))}</div></div>`;
  }

  // Margin note
  if (jobMarg > 0 && (totalMatCost + fixedCost) > 0) {
    html += `<div class="invoice-section-head">Margin</div>`;
    const matAndFixed = totalMatCost + fixedCost;
    html += `<div class="q-line">
      <div class="q-line-left">
        <div class="q-line-label">Job margin — materials &amp; fixed <span class="chip chip-margin">margin</span></div>
        <div class="q-line-sub">${Math.round(jobMarg * 100)}% applied to $${Math.round(matAndFixed).toLocaleString('en-CA')} cost</div>
      </div>
      <div class="q-line-val" style="color:var(--amber);">${fmt(markup(matAndFixed) - matAndFixed)}</div>
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

  // Time bar
  g('time-bar').textContent =
    `Project: ${area > 0 ? Number(area).toLocaleString() : '—'} sq ft  ·  ` +
    `${activeServices.length} service${activeServices.length !== 1 ? 's' : ''}  ·  ` +
    `${crew} worker${crew > 1 ? 's' : ''} x ${fmtHrs(labHrs)} general  ·  ` +
    `$${area > 0 ? perSqft.toFixed(2) : '—'}/sq ft to client`;
}

calc();
