const g = id => document.getElementById(id);
const fmt = n => '$' + Math.round(n).toLocaleString('en-CA');
const num = id => parseFloat(g(id).value) || 0;
const roundHalf = n => n > 0 ? Math.ceil(n * 2) / 2 : 0;
const fmtHrs = h => {
  if (h === 0) return '0 hrs';
  if (h === 0.5) return '0.5 hr';
  return h % 1 === 0 ? h + ' hrs' : h + ' hrs';
};

[['sb-burden','sb-burden-out', v => v+'%'],
 ['sb-labmargin','sb-labmargin-out', v => v+'%'],
 ['sb-skid-rate','sb-skid-rate-out', v => Number(v).toLocaleString()],
 ['sb-push-rate','sb-push-rate-out', v => Number(v).toLocaleString()],
 ['sb-margin','sb-margin-out', v => v+'%'],
 ['sb-disc','sb-disc-out', v => v+'%'],
].forEach(([id, outId, fn]) => {
  const el = g(id), out = g(outId);
  if (out) out.textContent = fn(el.value);
  el.addEventListener('input', () => { if (out) out.textContent = fn(el.value); calc(); });
});

['sb-area','sb-wage','eq-skid-rate','eq-push-rate',
 'sb-truck','sb-tip','sb-mob']
  .forEach(id => g(id).addEventListener('input', calc));
['sb-gst','tog-push'].forEach(id => g(id).addEventListener('change', calc));

function calc() {
  const area       = num('sb-area');
  const wage       = num('sb-wage');
  const burden     = num('sb-burden') / 100;
  const labMarg    = num('sb-labmargin') / 100;
  const skidRate   = num('sb-skid-rate');
  const pushRate   = num('sb-push-rate');
  const eqSkidRate = num('eq-skid-rate');
  const eqPushRate = num('eq-push-rate');
  const truck      = num('sb-truck');
  const tip        = num('sb-tip');
  const mob        = num('sb-mob');
  const jobMarg    = num('sb-margin') / 100;
  const disc       = num('sb-disc') / 100;
  const gst        = g('sb-gst').checked;
  const doPush     = g('tog-push').checked;

  // Hours derived from sweep rate, rounded to nearest 0.5
  const skidHrs = skidRate > 0 && area > 0 ? roundHalf(area / skidRate) : 0;
  const pushHrs = doPush && pushRate > 0 && area > 0 ? roundHalf(area / pushRate) : 0;

  // Update sidebar hour displays
  g('skid-hrs-display').textContent = skidRate > 0 && area > 0 ? fmtHrs(skidHrs) : '—';
  g('push-hrs-display').textContent = doPush && pushRate > 0 && area > 0 ? fmtHrs(pushHrs) : '—';

  // Toggle push row opacity
  const pushEl = g('sb-push-rate').closest('.sb-field');
  if (pushEl) pushEl.style.opacity = doPush ? '1' : '0.4';

  const loadedWage = wage * (1 + burden);
  const billedRate = loadedWage * (1 + labMarg);

  g('sb-crewrate').textContent = '$' + billedRate.toFixed(2) + '/hr';
  g('sb-crewrate-sub').textContent = '$' + loadedWage.toFixed(2) + ' loaded + ' + Math.round(labMarg * 100) + '% margin';

  const skidLabCost = skidHrs * loadedWage;
  const skidLabBill = skidHrs * billedRate;
  const pushLabCost = pushHrs * loadedWage;
  const pushLabBill = pushHrs * billedRate;
  const totalLabCost   = skidLabCost + pushLabCost;
  const totalLabBilled = skidLabBill + pushLabBill;

  const eqSkidCost  = eqSkidRate * skidHrs;
  const eqPushCost  = eqPushRate * pushHrs;
  const fixedCost   = truck + tip + mob;
  const equipAndFixed = eqSkidCost + eqPushCost + fixedCost;
  const equipBilled   = jobMarg < 1 ? equipAndFixed / (1 - jobMarg) : equipAndFixed * 2;

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
  if (skidHrs > 0) {
    html += `<div class="q-line">
      <div class="q-line-left">
        <div class="q-line-label">Skid steer operator <span class="chip chip-labour">labour</span></div>
        <div class="q-line-sub">${fmtHrs(skidHrs)} · $${billedRate.toFixed(2)}/hr · ${Number(skidRate).toLocaleString()} sq ft/hr sweep rate</div>
      </div>
      <div class="q-line-val" style="color:var(--blue);">${fmt(skidLabBill)}</div>
    </div>`;
  }
  if (doPush && pushHrs > 0) {
    html += `<div class="q-line">
      <div class="q-line-left">
        <div class="q-line-label">Push sweeper operator <span class="chip chip-labour">labour</span></div>
        <div class="q-line-sub">${fmtHrs(pushHrs)} · $${billedRate.toFixed(2)}/hr · ${Number(pushRate).toLocaleString()} sq ft/hr sweep rate</div>
      </div>
      <div class="q-line-val" style="color:var(--blue);">${fmt(pushLabBill)}</div>
    </div>`;
  }
  if (skidHrs === 0 && pushHrs === 0) {
    html += `<div class="q-line">
      <div class="q-line-left"><div class="q-line-label" style="color:var(--slate-light);">Set lot size and sweep rate to calculate labour</div></div>
      <div class="q-line-val">$0</div>
    </div>`;
  }

  // Equipment
  const hasEquip = eqSkidCost > 0 || eqPushCost > 0;
  if (hasEquip) {
    html += `<div class="invoice-section-head">Equipment</div>`;
    if (eqSkidCost > 0) html += `<div class="q-line">
      <div class="q-line-left">
        <div class="q-line-label">Skid steer w/ sweeper attachment <span class="chip chip-equip">equip</span></div>
        <div class="q-line-sub">${fmtHrs(skidHrs)} × $${eqSkidRate}/hr</div>
      </div>
      <div class="q-line-val" style="color:var(--amber);">${fmt(eqSkidCost)}</div>
    </div>`;
    if (doPush && eqPushCost > 0) html += `<div class="q-line">
      <div class="q-line-left">
        <div class="q-line-label">Push / walk-behind sweeper <span class="chip chip-equip">equip</span></div>
        <div class="q-line-sub">${fmtHrs(pushHrs)} × $${eqPushRate}/hr</div>
      </div>
      <div class="q-line-val" style="color:var(--amber);">${fmt(eqPushCost)}</div>
    </div>`;
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

  g('time-bar').textContent =
    `Lot: ${area > 0 ? Number(area).toLocaleString() : '—'} sq ft  ·  ` +
    `Skid steer: ${fmtHrs(skidHrs)} @ ${Number(skidRate).toLocaleString()} sq ft/hr` +
    (doPush ? `  ·  Push sweeper: ${fmtHrs(pushHrs)} @ ${Number(pushRate).toLocaleString()} sq ft/hr` : '') +
    `  ·  $${area > 0 ? perSqft.toFixed(2) : '—'}/sq ft to client`;
}

calc();
