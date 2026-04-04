// Shared vendor lookup component for all calculators
// Include this script + the modal HTML in any calculator page

let vlTargetInput = null;
let vlCache = {};

function openVendorLookup(inputId, searchHint) {
  vlTargetInput = inputId;
  document.getElementById('vl-modal').classList.add('open');
  document.getElementById('vl-search').value = searchHint || '';
  document.getElementById('vl-results').innerHTML = '<div style="text-align:center;padding:20px;color:var(--slate-light);font-size:12px;">Loading vendors...</div>';
  loadVendorProducts(searchHint);
}

function closeVendorLookup() {
  document.getElementById('vl-modal').classList.remove('open');
}

async function loadVendorProducts(query) {
  const vendors = ['kakwastone', 'klonservices', 'bulkdirect', 'raintech'];
  let allItems = [];

  for (const v of vendors) {
    try {
      let data = vlCache[v];
      if (!data) {
        const res = await fetch('/api/vendor-prices?vendor=' + v);
        data = await res.json();
        vlCache[v] = data;
      }
      if (data.products) {
        data.products.forEach(p => {
          if (p.price) allItems.push({ ...p, vendor: data.vendor });
        });
      }
    } catch (e) {}
  }

  window._vlAllItems = allItems;
  filterVendorResults();
}

function filterVendorResults() {
  const query = document.getElementById('vl-search').value.toLowerCase();
  const items = (window._vlAllItems || []).filter(p =>
    p.name.toLowerCase().includes(query) ||
    p.category.toLowerCase().includes(query) ||
    p.vendor.toLowerCase().includes(query) ||
    (p.description && p.description.toLowerCase().includes(query))
  ).slice(0, 30);

  const container = document.getElementById('vl-results');
  if (items.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--slate-light);font-size:12px;">No matching products.</div>';
    return;
  }

  container.innerHTML = items.map(p => {
    const price = parseFloat(p.price).toFixed(2);
    const variants = p.variants && p.variants.length > 1
      ? '<div style="font-size:9px;color:var(--slate-light);margin-top:2px;">' + p.variants.map(v => v.name + ': $' + parseFloat(v.price).toFixed(2)).join(' · ') + '</div>'
      : '';
    return `<div class="vl-item" onclick="pickVendorPrice(${price})">
      <div class="vl-item-left">
        <div class="vl-item-name">${p.name}</div>
        <div class="vl-item-meta">${p.vendor} · ${p.category}</div>
        ${variants}
      </div>
      <div class="vl-item-price">$${price}</div>
    </div>`;
  }).join('');
}

function pickVendorPrice(price) {
  if (vlTargetInput) {
    document.getElementById(vlTargetInput).value = price;
    document.getElementById(vlTargetInput).dispatchEvent(new Event('input'));
  }
  closeVendorLookup();
}
