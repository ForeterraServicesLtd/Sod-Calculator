const g = id => document.getElementById(id);
const fmt = n => '$' + Math.round(n).toLocaleString();
const num = id => parseFloat(g(id).value) || 0;

const EQUIPMENT = [
  { id:'eq-compact', label:'Compact skid steer', phase:'removal' },
  { id:'eq-tiller',  label:'Rototiller',         phase:'grade'   },
  { id:'eq-grader',  label:'Box grader',          phase:'grade'   },
  { id:'eq-loader',  label:'Skid steer loader',   phase:'grade'   },
  { id:'eq-cutter',  label:'Sod cutter',          phase:'removal' },
  { id:'eq-roller',  label:'Sod roller',          phase:'install' },
  { id:'eq-dump',    label:'Dump trailer',        phase:'removal' },
  { id:'eq-sweeper', label:'Power sweeper',       phase:'cleanup' },
];

// Build equipment list
const equipList = g('equip-list');
EQUIPMENT.forEach(eq => {
  const item = document.createElement('div');
  item.className = 'equip-item';
  item.innerHTML = `
    <label class="equip-check-label">
      <input type="checkbox" id="${eq.id}-tog">
      <div class="equip-check-box"></div>
      <span class="equip-label-text">${eq.label}</span>
    </label>
    <div id="${eq.id}-inputs" class="equip-inputs">
      <div class="equip-rate-row">
        <span>$/hr</span>
        <input class="equip-small-input" type="number" id="${eq.id}-rate" min="0" step="5" placeholder="0">
        <span>hrs</span>
        <input class="equip-small-input" type="number" id="${eq.id}-hrs" min="0" step="0.5" placeholder="0">
      </div>
    </div>`;
  equipList.appendChild(item);
  g(eq.id+'-tog').addEventListener('change', () => {
    g(eq.id+'-inputs').classList.toggle('open', g(eq.id+'-tog').checked);
    calc();
  });
  g(eq.id+'-rate').addEventListener('input', calc);
  g(eq.id+'-hrs').addEventListener('input', calc);
});

// Slider bindings
[['sb-burden','sb-burden-out',v=>v+'%'],
 ['sb-labmargin','sb-labmargin-out',v=>v+'%'],
 ['sb-waste','sb-waste-out',v=>v+'%'],
 ['sb-rr','sb-rr-out',v=>v],
 ['sb-gr','sb-gr-out',v=>v],
 ['sb-ir','sb-ir-out',v=>v],
 ['sb-fh','sb-fh-out',v=>parseFloat(v).toFixed(1)],
 ['sb-ch','sb-ch-out',v=>parseFloat(v).toFixed(1)],
 ['sb-margin','sb-margin-out',v=>v+'%'],
 ['sb-disc','sb-disc-out',v=>v+'%'],
].forEach(([id,outId,fn])=>{
  const el=g(id), out=g(outId);
  if(out) out.textContent=fn(el.value);
  el.addEventListener('input',()=>{ if(out) out.textContent=fn(el.value); calc(); });
});

['sb-area','sb-crew','sb-wage','sb-sodp','sb-del','sb-top','sb-topp','sb-mob','sb-disp']
  .forEach(id=>g(id).addEventListener('input',calc));
['sb-gst','tog-removal','tog-grade','tog-install','tog-final','tog-cleanup']
  .forEach(id=>g(id).addEventListener('change',calc));

function row(name, chip, chipClass, subText, val, valClass) {
  return `<div class="q-line">
    <div class="q-line-left">
      <div class="q-line-name">${name}<span class="chip ${chipClass}">${chip}</span></div>
      ${subText ? `<div class="q-line-sub">${subText}</div>` : ''}
    </div>
    <div class="q-line-val ${valClass}">${val}</div>
  </div>`;
}

function section(label) {
  return `<div class="q-section-row"><span>${label}</span></div>`;
}

function calc() {
  const area    = num('sb-area');
  const crew    = num('sb-crew') || 1;
  const wage    = num('sb-wage');
  const burden  = num('sb-burden') / 100;
  const labMarg = num('sb-labmargin') / 100;
  const sodP    = num('sb-sodp');
  const waste   = num('sb-waste') / 100;
  const delivery= num('sb-del');
  const topYds  = num('sb-top');
  const topPrice= num('sb-topp');
  const mob     = num('sb-mob');
  const disp    = num('sb-disp');
  const rr      = num('sb-rr') || 1;
  const gr      = num('sb-gr') || 1;
  const ir      = num('sb-ir') || 1;
  const fh      = num('sb-fh');
  const ch      = num('sb-ch');
  const jobMarg = num('sb-margin') / 100;
  const disc    = num('sb-disc') / 100;
  const gst     = g('sb-gst').checked;
  const doR     = g('tog-removal').checked;
  const doG     = g('tog-grade').checked;
  const doI     = g('tog-install').checked;
  const doF     = g('tog-final').checked;
  const doC     = g('tog-cleanup').checked;

  const loadedWage     = wage * (1 + burden);
  const crewCostRate   = crew * loadedWage;
  const billedCrewRate = crewCostRate * (1 + labMarg);

  const billedPerWorker = loadedWage * (1 + labMarg);
  g('sb-crewrate').textContent = '$' + billedPerWorker.toFixed(2) + '/hr';
  g('sb-crewrate-sub').textContent = 'billed rate per worker';

  let totalHrs = 0;
  if (doR) totalHrs += area / rr;
  if (doG) totalHrs += area / gr;
  if (doI) totalHrs += area / ir;
  if (doF) totalHrs += fh;
  if (doC) totalHrs += ch;

  const labourCost   = totalHrs * crewCostRate;
  const labourBilled = totalHrs * billedCrewRate;

  const sodSqft = area * (1 + waste);
  const sodMat  = doI ? sodP * sodSqft : 0;
  const topCost = doG ? topYds * topPrice : 0;
  const dispCost= doR ? disp : 0;

  let totalEquipCost = 0;
  const equipLines = [];
  EQUIPMENT.forEach(eq => {
    if (g(eq.id+'-tog').checked) {
      const rate = parseFloat(g(eq.id+'-rate').value) || 0;
      const hrs  = parseFloat(g(eq.id+'-hrs').value)  || 0;
      const cost = rate * hrs;
      totalEquipCost += cost;
      if (cost > 0) equipLines.push({ label: eq.label, rate, hrs, cost });
    }
  });

  const matAndFixed = sodMat + topCost + dispCost + delivery + mob + totalEquipCost;
  const matBilled   = jobMarg < 1 ? matAndFixed / (1 - jobMarg) : matAndFixed * 2;
  const subtotal    = labourBilled + matBilled;
  const afterDisc   = subtotal * (1 - disc);
  const gstAmt      = gst ? afterDisc * 0.05 : 0;
  const clientTotal = afterDisc + gstAmt;
  const trueCost    = labourCost + matAndFixed;
  const profit      = afterDisc - trueCost;
  const perSqft     = area > 0 ? afterDisc / area : 0;

  // Metrics
  g('m-quote').textContent  = fmt(afterDisc);
  g('m-sqft').textContent   = '$' + perSqft.toFixed(2) + ' per sq ft';
  g('m-cost').textContent   = fmt(trueCost);
  g('m-profit').textContent = fmt(profit);
  g('m-margin-sub').textContent =
    Math.round(labMarg*100) + '% labour · ' + Math.round(jobMarg*100) + '% job';

  // Build invoice HTML
  let html = '';

  // Labour
  html += section('Labour');
  html += row(
    'Labour',
    'labour', 'chip-labour',
    totalHrs.toFixed(1) + ' crew hrs · ' + crew + '-person crew · $' + Math.round(billedCrewRate) + '/hr billed',
    fmt(labourBilled),
    'labour'
  );

  // Materials & Fixed
  html += section('Materials &amp; Fixed');
  if (doI) html += row('Sod material','material','chip-mat',
    Math.round(sodSqft)+' sq ft @ $'+sodP.toFixed(2)+' (incl. '+Math.round(waste*100)+'% waste)',
    fmt(sodMat),'material');
  if (doG && topCost > 0) html += row('Topsoil','material','chip-mat',
    topYds+' yds @ $'+topPrice+'/yd', fmt(topCost),'material');
  if (delivery > 0) html += row('Sod delivery','fixed','chip-fixed','',fmt(delivery),'fixed');
  if (mob > 0) html += row('Mobilization / setup','fixed','chip-fixed','',fmt(mob),'fixed');
  if (doR && disp > 0) html += row('Disposal fee','fixed','chip-fixed','',fmt(disp),'fixed');

  // Equipment
  if (equipLines.length > 0) {
    html += section('Equipment');
    equipLines.forEach(e => {
      html += row(e.label,'equip','chip-equip',
        e.hrs+'hr × $'+e.rate+'/hr', fmt(e.cost),'equip');
    });
  }

  // Job margin
  if (jobMarg > 0) {
    html += section('Job Margin');
    html += row('Materials &amp; equipment markup','margin','chip-margin',
      Math.round(jobMarg*100)+'% on $'+Math.round(matAndFixed).toLocaleString()+' cost',
      fmt(matBilled - matAndFixed),'margin-line');
  }

  // Discount
  if (disc > 0) {
    html += section('Client Discount');
    html += `<div class="q-line">
      <div class="q-line-left"><div class="q-line-name">Client discount (${Math.round(disc*100)}%)</div></div>
      <div class="q-line-val discount">-${fmt(subtotal*disc)}</div>
    </div>`;
  }

  // GST
  if (gst) {
    html += section('Tax');
    html += `<div class="q-line">
      <div class="q-line-left"><div class="q-line-name">GST (5%)</div></div>
      <div class="q-line-val gst">${fmt(gstAmt)}</div>
    </div>`;
  }

  // Total row
  html += `<div class="q-total-row">
    <span class="q-total-label">Total invoice to client <span class="q-total-badge">${gst?'(incl. GST)':'(no GST)'}</span></span>
    <span class="q-total-val">${fmt(clientTotal)}</span>
  </div>`;

  g('quote-block').innerHTML = html;

  g('q-footer').textContent =
    'True cost: ' + fmt(trueCost) +
    '   ·   Labour cost: ' + fmt(labourCost) +
    '   ·   Labour billed: ' + fmt(labourBilled) +
    '   ·   Materials cost: ' + fmt(matAndFixed) +
    '   ·   Materials billed: ' + fmt(matBilled) +
    '   ·   Profit: ' + fmt(profit);

  g('time-summary').textContent =
    'Field time: ' + totalHrs.toFixed(1) + ' crew hrs   ·   ' +
    Math.ceil(totalHrs / 10) + ' × 10-hr day(s)   ·   ' +
    crew + '-person crew   ·   ' +
    '$' + perSqft.toFixed(2) + '/sq ft billed to client';
}

calc();
