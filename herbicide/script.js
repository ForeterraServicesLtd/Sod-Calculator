const g = id => document.getElementById(id);
const fmt = n => '$' + Math.round(n).toLocaleString('en-CA');
const fmtD = (n, d) => '$' + n.toFixed(d);
const num = id => parseFloat(g(id).value) || 0;
const roundHalf = n => n > 0 ? Math.ceil(n * 2) / 2 : 0;
const fmtHrs = h => h === 0.5 ? '0.5 hr' : h % 1 === 0 ? h + ' hrs' : h + ' hrs';

const HERBS = [
  { id: 'curtailm', label: 'Curtail M',           pcp: 'Group 4 · PCP# 30914', chip: 'chip-chem' },
  { id: 'roundup',  label: 'Roundup Transorb HC', pcp: 'Group 9 · PCP# 28198 · spot spray', chip: 'chip-chem' },
  { id: 'par3',     label: 'PAR III',              pcp: 'Group 4 · PCP# 27884 · lawn', chip: 'chip-chem' },
  { id: 'custom',   label: null,                   pcp: '', chip: 'chip-custom' },
];

const METHOD_LABELS = {
  flatfan: 'Flat-fan foliar spray', boom: 'Boom sprayer',
  spot: 'Spot spray', backpack: 'Backpack / hand sprayer'
};

// wire sliders
[['sb-burden','sb-burden-out', v => v+'%'],
 ['sb-labmargin','sb-labmargin-out', v => v+'%'],
 ['sb-apprate','sb-apprate-out', v => Number(v).toLocaleString()],
 ['sb-margin','sb-margin-out', v => v+'%'],
 ['sb-disc','sb-disc-out', v => v+'%'],
].forEach(([id, outId, fn]) => {
  const el = g(id), out = g(outId);
  if (out) out.textContent = fn(el.value);
  el.addEventListener('input', () => { if (out) out.textContent = fn(el.value); calc(); });
});

// wire text/number inputs
['sb-area','sb-wage','sb-applicators','sb-passes',
 'sb-setup','sb-mob',
 'h-curtailm-rate','h-curtailm-flat',
 'h-roundup-rate','h-roundup-flat',
 'h-par3-rate','h-par3-flat',
 'h-custom-rate','h-custom-flat','h-custom-name',
].forEach(id => g(id).addEventListener('input', calc));

['sb-gst','sb-method',
 'h-curtailm-tog','h-roundup-tog','h-par3-tog','h-custom-tog',
].forEach(id => g(id).addEventListener('change', calc));

function calc() {
  const area        = num('sb-area');
  const wage        = num('sb-wage');
  const applicators = num('sb-applicators') || 1;
  const passes      = num('sb-passes') || 1;
  const burden      = num('sb-burden') / 100;
  const labMarg     = num('sb-labmargin') / 100;
  const appRate     = num('sb-apprate') || 1;
  const setup       = num('sb-setup');
  const mob         = num('sb-mob');
  const jobMarg     = num('sb-margin') / 100;
  const disc        = num('sb-disc') / 100;
  const gst         = g('sb-gst').checked;
  const method      = g('sb-method').value;

  // Labour hours: area / rate x passes, rounded to 0.5, x applicators
  const rawHrs    = area > 0 ? (area / appRate) * passes : 0;
  const hrs       = roundHalf(rawHrs);
  const totalHrs  = hrs * applicators;
  const loadedWage = wage * (1 + burden);
  const billedRate = loadedWage * (1 + labMarg);
  const labCost    = totalHrs * loadedWage;
  const labBilled  = totalHrs * billedRate;

  g('sb-labhrs-display').textContent = area > 0 ? fmtHrs(totalHrs) + (applicators > 1 ? ' (' + applicators + ' applicators)' : '') : '—';
  g('sb-billedrate').textContent = '$' + billedRate.toFixed(2) + '/hr';
  g('sb-labhrs-sub').innerHTML = `labour hours &nbsp;·&nbsp; <span id="sb-billedrate">$${billedRate.toFixed(2)}/hr billed</span>`;

  // Herbicide costs
  let totalChemCost = 0;
  const herbLines = [];

  HERBS.forEach(h => {
    const tog = g('h-' + h.id + '-tog');
    if (!tog.checked) {
      g('h-' + h.id + '-total').textContent = '—';
      return;
    }
    const rate = parseFloat(g('h-' + h.id + '-rate').value) || 0;
    const flat = parseFloat(g('h-' + h.id + '-flat').value) || 0;
    const sqftCost = rate * area * passes;
    const total = sqftCost + flat;
    totalChemCost += total;
    const name = h.id === 'custom' ? (g('h-custom-name').value.trim() || 'Custom product') : h.label;
    const pcp  = h.id === 'custom' ? '' : h.pcp;
    g('h-' + h.id + '-total').textContent = total > 0 ? fmt(total) : '$0';
    herbLines.push({ name, pcp, rate, flat, sqftCost, total, chip: h.chip });
  });

  const fixedCost     = setup + mob;
  const chemAndFixed  = totalChemCost + fixedCost;
  const chemBilled    = jobMarg < 1 ? chemAndFixed / (1 - jobMarg) : chemAndFixed * 2;

  const subtotal    = labBilled + chemBilled;
  const afterDisc   = subtotal * (1 - disc);
  const gstAmt      = gst ? afterDisc * 0.05 : 0;
  const clientTotal = afterDisc + gstAmt;
  const trueCost    = labCost + chemAndFixed;
  const profit      = afterDisc - trueCost;
  const perSqft     = area > 0 ? afterDisc / area : 0;

  g('m-quote').textContent   = fmt(afterDisc);
  g('m-sqft').textContent    = area > 0 ? '$' + perSqft.toFixed(3) + ' per sq ft' : '—';
  g('m-cost').textContent    = fmt(trueCost);
  g('m-profit').textContent  = fmt(profit);
  g('m-margin-sub').textContent = Math.round(labMarg*100) + '% labour · ' + Math.round(jobMarg*100) + '% job';
  g('f-cost').textContent    = fmt(trueCost);
  g('f-lab').textContent     = fmt(labBilled);
  g('f-chem').textContent    = fmt(chemBilled);
  g('f-profit').textContent  = fmt(profit);
  g('q-total').textContent   = fmt(clientTotal);
  g('q-gst-note').textContent = gst ? '(incl. GST)' : '(no GST)';

  let html = '';

  // Herbicides
  html += `<div class="invoice-section-head">Herbicide application</div>`;
  herbLines.forEach(h => {
    if (h.total === 0) return;
    let sub = [];
    if (h.rate > 0 && area > 0) sub.push(Number(area).toLocaleString() + ' sq ft \u00d7 $' + h.rate.toFixed(3) + '/sq ft' + (passes > 1 ? ' \u00d7 ' + passes + ' passes' : ''));
    if (h.flat > 0) sub.push('flat: $' + h.flat.toLocaleString('en-CA'));
    if (h.pcp) sub.push(h.pcp);
    html += `<div class="q-line">
      <div class="q-line-left">
        <div class="q-line-label">${h.name} <span class="chip ${h.chip}">chemical</span></div>
        <div class="q-line-sub">${sub.join(' \u00b7 ')}</div>
      </div>
      <div class="q-line-val" style="color:var(--green);">${fmt(h.total)}</div>
    </div>`;
  });
  if (herbLines.filter(h => h.total > 0).length === 0) {
    html += `<div class="q-line"><div class="q-line-left"><div class="q-line-label" style="color:var(--slate-light);">No herbicide products selected</div></div><div class="q-line-val">$0</div></div>`;
  }

  // Labour
  html += `<div class="invoice-section-head">Labour</div>`;
  html += `<div class="q-line">
    <div class="q-line-left">
      <div class="q-line-label">Licensed herbicide applicator${applicators > 1 ? 's' : ''} <span class="chip chip-labour">labour</span></div>
      <div class="q-line-sub">${fmtHrs(totalHrs)} total \u00b7 ${applicators} applicator${applicators>1?'s':''} \u00b7 $${billedRate.toFixed(2)}/hr billed \u00b7 ${METHOD_LABELS[method]} \u00b7 ${Number(appRate).toLocaleString()} sq ft/hr${passes > 1 ? ' \u00b7 ' + passes + ' passes' : ''}</div>
    </div>
    <div class="q-line-val" style="color:var(--blue);">${fmt(labBilled)}</div>
  </div>`;

  // Fixed
  html += `<div class="invoice-section-head">Fixed fees</div>`;
  if (setup > 0) html += `<div class="q-line">
    <div class="q-line-left">
      <div class="q-line-label">Equipment setup fee <span class="chip chip-fixed">fixed</span></div>
      <div class="q-line-sub">Calibration \u00b7 chemical dosage \u00b7 pump setup \u00b7 records \u2014 non-negotiable</div>
    </div>
    <div class="q-line-val" style="color:#5a3ab0;">${fmt(setup)}</div>
  </div>`;
  if (mob > 0) html += `<div class="q-line">
    <div class="q-line-left"><div class="q-line-label">Mobilization <span class="chip chip-fixed">fixed</span></div></div>
    <div class="q-line-val" style="color:#5a3ab0;">${fmt(mob)}</div>
  </div>`;

  // Margin
  if (jobMarg > 0) {
    html += `<div class="invoice-section-head">Margin</div>`;
    html += `<div class="q-line">
      <div class="q-line-left">
        <div class="q-line-label">Job margin \u2014 chemical &amp; fixed <span class="chip chip-margin">margin</span></div>
        <div class="q-line-sub">${Math.round(jobMarg*100)}% applied to $${Math.round(chemAndFixed).toLocaleString('en-CA')} cost</div>
      </div>
      <div class="q-line-val" style="color:var(--amber);">${fmt(chemBilled - chemAndFixed)}</div>
    </div>`;
  }

  // Discount
  if (disc > 0) html += `<div class="q-line disc">
    <div class="q-line-left"><div class="q-line-label">Client discount (${Math.round(disc*100)}%) <span class="chip chip-disc">discount</span></div></div>
    <div class="q-line-val">-${fmt(subtotal * disc)}</div>
  </div>`;

  // GST
  if (gst) {
    html += `<div class="invoice-section-head">Tax</div>`;
    html += `<div class="q-line">
      <div class="q-line-left"><div class="q-line-label">GST (5%) <span class="chip chip-tax">tax</span></div></div>
      <div class="q-line-val">${fmt(gstAmt)}</div>
    </div>`;
  }

  g('q-invoice-body').innerHTML = html;
  g('time-bar').textContent =
    `Area: ${area > 0 ? Number(area).toLocaleString() : '\u2014'} sq ft  \u00b7  ` +
    `Method: ${METHOD_LABELS[method]}  \u00b7  ` +
    `Passes: ${passes}  \u00b7  ` +
    `Labour: ${fmtHrs(totalHrs)} (${applicators} applicator${applicators>1?'s':''})  \u00b7  ` +
    `$${area > 0 ? perSqft.toFixed(3) : '\u2014'}/sq ft to client`;
}

calc();
