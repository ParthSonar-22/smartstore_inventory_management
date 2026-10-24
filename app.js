// ============================================================
// SmartStore – app.js  (vanilla JS, no dependencies)
// ============================================================

'use strict';

// ─── DB helpers ──────────────────────────────────────────────
const DB = {
  get(key)        { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
  set(key, val)   { localStorage.setItem(key, JSON.stringify(val)); },
  materials()     { return DB.get('materials'); },
  suppliers()     { return DB.get('suppliers'); },
  prs()           { return DB.get('purchaseRequisitions'); },
  pos()           { return DB.get('purchaseOrders'); },
  grns()          { return DB.get('goodsReceipts'); },
  movements()     { return DB.get('stockMovements'); },
  saveMaterials(d)  { DB.set('materials', d); },
  saveSuppliers(d)  { DB.set('suppliers', d); },
  savePRs(d)        { DB.set('purchaseRequisitions', d); },
  savePOs(d)        { DB.set('purchaseOrders', d); },
  saveGRNs(d)       { DB.set('goodsReceipts', d); },
  saveMovements(d)  { DB.set('stockMovements', d); },
};

// ─── ID generators ───────────────────────────────────────────
function nextId(prefix, list, field = 'id') {
  let max = 0;
  list.forEach(i => {
    const n = parseInt(i[field].replace(/\D/g, ''), 10);
    if (n > max) max = n;
  });
  const num = String(max + 1).padStart(prefix === 'M' ? 3 : 4, '0');
  return `${prefix}${num}`;
}
function newMaterialId()   { return nextId('M',    DB.materials()); }
function newSupplierId()   { return nextId('S',    DB.suppliers()); }
function newPRId()         { return nextId('PR-',  DB.prs()); }
function newPOId()         { return nextId('PO-',  DB.pos()); }
function newGRNId()        { return nextId('GRN-', DB.grns()); }
function newMovementId()   { return nextId('MOV-', DB.movements()); }

// ─── Toast ───────────────────────────────────────────────────
const toast = (() => {
  const el = document.getElementById('toast');
  let timer;
  return function show(msg, type = '') {
    el.textContent = msg;
    el.className = 'toast' + (type ? ' ' + type : '');
    void el.offsetWidth; // reflow
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), 2600);
  };
})();

// ─── Confirm dialog ──────────────────────────────────────────
function showConfirm(title, text, onOk) {
  const ov = document.getElementById('confirm-overlay');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent  = text;
  ov.classList.add('open');
  const ok  = document.getElementById('confirm-ok');
  const can = document.getElementById('confirm-cancel');
  const close = () => ov.classList.remove('open');
  ok.onclick  = () => { close(); onOk(); };
  can.onclick = close;
}

// ─── Navigation ──────────────────────────────────────────────
const pages    = ['dashboard','products','suppliers','pr','po','grn'];
const pageNames= ['Dashboard','Products','Suppliers','Requisitions','Orders','Receipts'];
let currentPage = 'dashboard';

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
  });
  document.getElementById('page-title').textContent = pageNames[pages.indexOf(page)];
  renderPage(page);
}

function renderPage(page) {
  const renderers = {
    dashboard: renderDashboard,
    products:  renderProducts,
    suppliers: renderSuppliers,
    pr:        renderPR,
    po:        renderPO,
    grn:       renderGRN,
  };
  renderers[page]?.();
}

// ─── Helpers ─────────────────────────────────────────────────
function fmt(n) { return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtQty(n) { return Number(n).toLocaleString(); }
function today() { return new Date().toISOString().slice(0,10); }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function getSupplierName(id) {
  const s = DB.suppliers().find(x => x.id === id);
  return s ? s.name : '—';
}
function getMaterialName(id) {
  const m = DB.materials().find(x => x.id === id);
  return m ? m.name : '—';
}

// ─── Stock Movement recorder ─────────────────────────────────
function recordMovement(materialId, type, qty, refId) {
  const mats = DB.materials();
  const mat  = mats.find(m => m.id === materialId);
  if (!mat) return;
  const movs = DB.movements();
  movs.push({
    id: newMovementId(),
    materialId,
    type,
    qty: Number(qty),
    refId,
    date: today(),
    balanceAfter: mat.stock,
  });
  DB.saveMovements(movs);
}

// ─── DASHBOARD ───────────────────────────────────────────────
function renderDashboard() {
  const mats = DB.materials();
  const sups = DB.suppliers();
  const pos  = DB.pos();
  const grns = DB.grns();

  const totalStock = mats.reduce((s,m) => s + Number(m.stock), 0);
  const lowStock   = mats.filter(m => Number(m.stock) <= Number(m.minStock));
  const invValue   = mats.reduce((s,m) => s + Number(m.stock)*Number(m.price), 0);

  // recent activity: last 5 POs + GRNs merged and sorted
  const activity = [
    ...pos.map(p => ({ ...p, _type: 'PO', _date: p.expectedDate||'' })),
    ...grns.map(g => ({ ...g, _type: 'GRN', _date: g.date||'' })),
  ].sort((a,b) => b._date.localeCompare(a._date)).slice(0,5);

  document.getElementById('page-dashboard').innerHTML = `
    <div class="card-grid">
      <div class="stat-card accent">
        <span class="stat-label">Products</span>
        <span class="stat-value">${mats.length}</span>
        <span class="stat-sub">total SKUs</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Total Stock</span>
        <span class="stat-value">${fmtQty(totalStock)}</span>
        <span class="stat-sub">units on hand</span>
      </div>
      <div class="stat-card ${lowStock.length ? 'danger' : ''}">
        <span class="stat-label">Low Stock</span>
        <span class="stat-value">${lowStock.length}</span>
        <span class="stat-sub">below minimum</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Suppliers</span>
        <span class="stat-value">${sups.length}</span>
        <span class="stat-sub">active</span>
      </div>
    </div>
    <div class="card mb-12" style="border-left:3px solid var(--accent)">
      <div class="flex-between">
        <span class="stat-label">Inventory Value</span>
      </div>
      <div style="font-size:1.6rem;font-weight:700;margin-top:4px;">₹ ${fmt(invValue)}</div>
      <div class="stat-sub">estimated (stock × price)</div>
    </div>

    <div class="section-header">
      <h2>⚠️ Low Stock Alerts</h2>
    </div>
    ${lowStock.length === 0
      ? `<div class="empty-state"><div class="es-icon">✅</div><p>All products are well-stocked.</p></div>`
      : lowStock.map(m => `
        <div class="list-item low-stock">
          <div class="list-item-header">
            <div>
              <div class="list-item-title">${escHtml(m.name)}</div>
              <div class="list-item-sub">${m.id} · ${m.category}</div>
            </div>
            <span class="badge badge-low">Low</span>
          </div>
          <div style="font-size:.8rem;">
            Stock: <strong class="text-danger">${fmtQty(m.stock)} ${m.unit}</strong>
            &nbsp;|&nbsp; Min: ${fmtQty(m.minStock)} ${m.unit}
          </div>
          <div class="list-item-actions">
            <button class="btn btn-primary btn-sm" onclick="openPRFormForMaterial('${m.id}')">+ Create PR</button>
          </div>
        </div>`).join('')
    }

    <hr class="divider">
    <div class="section-header">
      <h2>📋 Recent Activity</h2>
    </div>
    ${activity.length === 0
      ? `<div class="empty-state"><div class="es-icon">📭</div><p>No recent POs or GRNs yet.</p></div>`
      : activity.map(a => `
        <div class="list-item">
          <div class="list-item-header">
            <div>
              <div class="list-item-title">${a._type}: ${a.id}</div>
              <div class="list-item-sub">
                ${a._type === 'PO'
                  ? `Material: ${getMaterialName(a.materialId)} · Supplier: ${getSupplierName(a.supplierId)}`
                  : `PO: ${a.poId} · Recv: ${a.receivedQty} | Dmg: ${a.damagedQty}`}
              </div>
            </div>
            ${a._type === 'PO' ? `<span class="badge badge-${(a.status||'').toLowerCase().replace(' ','-') || 'created'}">${a.status}</span>` : ''}
          </div>
          <div style="font-size:.76rem;color:var(--neutral-400);">Date: ${a._date}</div>
        </div>`).join('')
    }

    <hr class="divider">
    <div class="flex gap-8" style="margin-top:4px;">
      <button class="btn btn-ghost btn-sm" onclick="loadSampleData()">📦 Load Sample Data</button>
      <button class="btn btn-danger btn-sm" onclick="resetData()">🗑 Reset Data</button>
    </div>
  `;
}

// ─── PRODUCTS ────────────────────────────────────────────────
function renderProducts() {
  const mats = DB.materials();
  const sups = DB.suppliers();

  document.getElementById('page-products').innerHTML = `
    <div class="section-header">
      <h2>Products (${mats.length})</h2>
      <button class="btn btn-primary btn-sm" onclick="openProductModal()">+ Add</button>
    </div>
    ${mats.length === 0
      ? `<div class="empty-state"><div class="es-icon">📦</div><p>No products yet. Add one!</p></div>`
      : mats.map(m => {
          const low = Number(m.stock) <= Number(m.minStock);
          const sup = sups.find(s => s.id === m.supplierId);
          return `
            <div class="list-item ${low ? 'low-stock' : ''}">
              <div class="list-item-header">
                <div>
                  <div class="list-item-title">${escHtml(m.name)}</div>
                  <div class="list-item-sub">${m.id} · ${m.category} · ${m.unit}</div>
                </div>
                <span class="badge ${low ? 'badge-low' : 'badge-ok'}">${low ? 'Low' : 'OK'}</span>
              </div>
              <div style="font-size:.82rem;" class="flex-between">
                <span>Stock: <strong ${low?'class="text-danger"':''}>${fmtQty(m.stock)}</strong> / Min: ${fmtQty(m.minStock)}</span>
                <span class="text-muted">₹ ${fmt(m.price)}</span>
              </div>
              <div style="font-size:.75rem;color:var(--neutral-400);">Supplier: ${sup ? escHtml(sup.name) : '—'}</div>
              <div class="list-item-actions">
                <button class="btn btn-ghost btn-sm" onclick="openProductModal('${m.id}')">✏️ Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct('${m.id}')">🗑 Delete</button>
              </div>
            </div>`;
        }).join('')
    }
  `;
}

let _editProductId = null;
function openProductModal(id) {
  _editProductId = id || null;
  const mats = DB.materials();
  const sups = DB.suppliers();
  const m    = id ? mats.find(x => x.id === id) : null;

  const supOptions = sups.map(s =>
    `<option value="${s.id}" ${m && m.supplierId===s.id?'selected':''}>${escHtml(s.name)}</option>`
  ).join('');

  document.getElementById('modal-title').textContent = m ? 'Edit Product' : 'Add Product';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Name *</label>
      <input id="p-name" class="form-control" placeholder="e.g. Wireless Mouse" value="${escHtml(m?.name||'')}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Category *</label>
        <input id="p-cat" class="form-control" placeholder="Electronics" value="${escHtml(m?.category||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Unit *</label>
        <input id="p-unit" class="form-control" placeholder="pcs" value="${escHtml(m?.unit||'')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Stock *</label>
        <input id="p-stock" type="number" min="0" class="form-control" value="${m?.stock??''}">
      </div>
      <div class="form-group">
        <label class="form-label">Min Stock *</label>
        <input id="p-minstock" type="number" min="0" class="form-control" value="${m?.minStock??''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Unit Price (₹) *</label>
      <input id="p-price" type="number" min="0.01" step="0.01" class="form-control" value="${m?.price??''}">
    </div>
    <div class="form-group">
      <label class="form-label">Supplier</label>
      <select id="p-sup" class="form-control">
        <option value="">— Select Supplier —</option>
        ${supOptions}
      </select>
    </div>
    <div class="inline-error" id="p-err"></div>
  `;
  document.getElementById('modal-save').onclick = saveProduct;
  openModal();
}

function saveProduct() {
  const name     = document.getElementById('p-name').value.trim();
  const cat      = document.getElementById('p-cat').value.trim();
  const unit     = document.getElementById('p-unit').value.trim();
  const stock    = parseFloat(document.getElementById('p-stock').value);
  const minStock = parseFloat(document.getElementById('p-minstock').value);
  const price    = parseFloat(document.getElementById('p-price').value);
  const supId    = document.getElementById('p-sup').value;
  const errEl    = document.getElementById('p-err');

  if (!name || !cat || !unit) return showErr(errEl, 'Please fill in all required fields.');
  if (isNaN(stock) || stock < 0) return showErr(errEl, 'Stock must be 0 or more.');
  if (isNaN(minStock) || minStock < 0) return showErr(errEl, 'Min Stock must be 0 or more.');
  if (isNaN(price) || price <= 0) return showErr(errEl, 'Price must be greater than 0.');

  const mats = DB.materials();
  if (_editProductId) {
    const idx = mats.findIndex(x => x.id === _editProductId);
    const oldStock = Number(mats[idx].stock);
    const diff     = stock - oldStock;
    mats[idx] = { ...mats[idx], name, category: cat, unit, stock, minStock, price, supplierId: supId };
    DB.saveMaterials(mats);
    if (diff !== 0) recordMovement(_editProductId, diff > 0 ? 'IN' : 'OUT', Math.abs(diff), 'EDIT');
    toast('Product updated ✓', 'success');
  } else {
    const id = newMaterialId();
    mats.push({ id, name, category: cat, unit, stock, minStock, price, supplierId: supId });
    DB.saveMaterials(mats);
    if (stock > 0) recordMovement(id, 'IN', stock, 'INITIAL');
    toast('Product added ✓', 'success');
  }
  closeModal();
  renderProducts();
}

function deleteProduct(id) {
  showConfirm('Delete Product', 'Are you sure you want to delete this product? This cannot be undone.', () => {
    const mats = DB.materials().filter(m => m.id !== id);
    DB.saveMaterials(mats);
    toast('Product deleted.', '');
    renderProducts();
  });
}

// ─── SUPPLIERS ───────────────────────────────────────────────
function renderSuppliers() {
  const sups = DB.suppliers();
  document.getElementById('page-suppliers').innerHTML = `
    <div class="section-header">
      <h2>Suppliers (${sups.length})</h2>
      <button class="btn btn-primary btn-sm" onclick="openSupplierModal()">+ Add</button>
    </div>
    ${sups.length === 0
      ? `<div class="empty-state"><div class="es-icon">🏭</div><p>No suppliers yet. Add one!</p></div>`
      : sups.map(s => `
          <div class="list-item">
            <div class="list-item-header">
              <div>
                <div class="list-item-title">${escHtml(s.name)}</div>
                <div class="list-item-sub">${s.id}</div>
              </div>
            </div>
            <div style="font-size:.8rem;">📞 ${escHtml(s.phone)} &nbsp;·&nbsp; ✉️ ${escHtml(s.email)}</div>
            <div class="list-item-actions">
              <button class="btn btn-ghost btn-sm" onclick="openSupplierModal('${s.id}')">✏️ Edit</button>
            </div>
          </div>`).join('')
    }
  `;
}

let _editSuppId = null;
function openSupplierModal(id) {
  _editSuppId = id || null;
  const sups = DB.suppliers();
  const s    = id ? sups.find(x => x.id === id) : null;

  document.getElementById('modal-title').textContent = s ? 'Edit Supplier' : 'Add Supplier';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Name *</label>
      <input id="s-name" class="form-control" placeholder="Supplier Co. Ltd." value="${escHtml(s?.name||'')}">
    </div>
    <div class="form-group">
      <label class="form-label">Phone *</label>
      <input id="s-phone" class="form-control" placeholder="+91 98765 43210" value="${escHtml(s?.phone||'')}">
    </div>
    <div class="form-group">
      <label class="form-label">Email *</label>
      <input id="s-email" class="form-control" type="email" placeholder="contact@supplier.com" value="${escHtml(s?.email||'')}">
    </div>
    <div class="inline-error" id="s-err"></div>
  `;
  document.getElementById('modal-save').onclick = saveSupplier;
  openModal();
}

function saveSupplier() {
  const name  = document.getElementById('s-name').value.trim();
  const phone = document.getElementById('s-phone').value.trim();
  const email = document.getElementById('s-email').value.trim();
  const errEl = document.getElementById('s-err');

  if (!name || !phone || !email) return showErr(errEl, 'All fields are required.');
  if (!/\S+@\S+\.\S+/.test(email)) return showErr(errEl, 'Enter a valid email address.');

  const sups = DB.suppliers();
  if (_editSuppId) {
    const idx = sups.findIndex(x => x.id === _editSuppId);
    sups[idx] = { ...sups[idx], name, phone, email };
    DB.saveSuppliers(sups);
    toast('Supplier updated ✓', 'success');
  } else {
    sups.push({ id: newSupplierId(), name, phone, email });
    DB.saveSuppliers(sups);
    toast('Supplier added ✓', 'success');
  }
  closeModal();
  renderSuppliers();
}

// ─── PURCHASE REQUISITION ─────────────────────────────────────
let _prPrefillMatId = null;

function renderPR() {
  const prs  = DB.prs();
  const mats = DB.materials();

  const sortedPRs = [...prs].sort((a,b) => b.id.localeCompare(a.id));

  document.getElementById('page-pr').innerHTML = `
    <div class="section-header">
      <h2>Requisitions (${prs.length})</h2>
      <button class="btn btn-primary btn-sm" onclick="openPRModal()">+ Create PR</button>
    </div>
    ${sortedPRs.length === 0
      ? `<div class="empty-state"><div class="es-icon">📋</div><p>No purchase requisitions yet.</p></div>`
      : sortedPRs.map(pr => {
          const mat = mats.find(m => m.id === pr.materialId);
          const statusClass = { Pending:'pending', Approved:'approved', Rejected:'rejected' }[pr.status] || 'pending';
          return `
            <div class="list-item">
              <div class="list-item-header">
                <div>
                  <div class="list-item-title">${pr.id}</div>
                  <div class="list-item-sub">${mat ? escHtml(mat.name) : pr.materialId} · ${pr.qty} ${mat?.unit||'units'}</div>
                </div>
                <span class="badge badge-${statusClass}">${pr.status}</span>
              </div>
              <div style="font-size:.78rem;color:var(--neutral-500);">Reason: ${escHtml(pr.reason)}</div>
              <div style="font-size:.75rem;color:var(--neutral-400);">Date: ${pr.date}</div>
              ${pr.status === 'Pending' ? `
                <div class="list-item-actions">
                  <button class="btn btn-success btn-sm" onclick="updatePRStatus('${pr.id}','Approved')">✓ Approve</button>
                  <button class="btn btn-danger  btn-sm" onclick="updatePRStatus('${pr.id}','Rejected')">✗ Reject</button>
                </div>` : ''}
            </div>`;
        }).join('')
    }
  `;
}

function openPRFormForMaterial(matId) {
  _prPrefillMatId = matId;
  navigate('pr');
  setTimeout(() => openPRModal(matId), 80);
}

function openPRModal(prefillMatId) {
  const mats   = DB.materials();
  const fillId = prefillMatId || _prPrefillMatId || null;
  _prPrefillMatId = null;

  const matOptions = mats.map(m =>
    `<option value="${m.id}" ${fillId===m.id?'selected':''}>${escHtml(m.name)} (${m.id})</option>`
  ).join('');

  document.getElementById('modal-title').textContent = 'Create Purchase Requisition';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Material *</label>
      <select id="pr-mat" class="form-control">
        <option value="">— Select Material —</option>
        ${matOptions}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Quantity *</label>
      <input id="pr-qty" type="number" min="1" class="form-control" placeholder="e.g. 50">
    </div>
    <div class="form-group">
      <label class="form-label">Reason *</label>
      <input id="pr-reason" class="form-control" placeholder="e.g. Stock replenishment">
    </div>
    <div class="inline-error" id="pr-err"></div>
  `;
  document.getElementById('modal-save').onclick = savePR;
  openModal();
}

function savePR() {
  const matId  = document.getElementById('pr-mat').value;
  const qty    = parseFloat(document.getElementById('pr-qty').value);
  const reason = document.getElementById('pr-reason').value.trim();
  const errEl  = document.getElementById('pr-err');

  if (!matId)             return showErr(errEl, 'Please select a material.');
  if (isNaN(qty)||qty<1)  return showErr(errEl, 'Quantity must be at least 1.');
  if (!reason)            return showErr(errEl, 'Please enter a reason.');

  const prs = DB.prs();
  prs.push({ id: newPRId(), materialId: matId, qty, reason, status: 'Pending', date: today() });
  DB.savePRs(prs);
  toast('PR created ✓', 'success');
  closeModal();
  renderPR();
}

function updatePRStatus(id, status) {
  const prs = DB.prs();
  const pr  = prs.find(x => x.id === id);
  if (!pr) return;
  pr.status = status;
  DB.savePRs(prs);
  toast(`PR ${status} ✓`, status === 'Approved' ? 'success' : '');
  renderPR();
}

// ─── PURCHASE ORDER ──────────────────────────────────────────
function renderPO() {
  const pos  = DB.pos();
  const prs  = DB.prs();
  const mats = DB.materials();
  const sups = DB.suppliers();

  // PRs approved with no PO
  const availPRs = prs.filter(pr =>
    pr.status === 'Approved' && !pos.some(po => po.prId === pr.id)
  );

  const sortedPOs = [...pos].sort((a,b) => b.id.localeCompare(a.id));

  document.getElementById('page-po').innerHTML = `
    <div class="section-header">
      <h2>Purchase Orders (${pos.length})</h2>
      <button class="btn btn-primary btn-sm" onclick="openPOModal()" ${availPRs.length===0?'disabled title="No approved PRs available"':''}>+ Create PO</button>
    </div>
    ${availPRs.length > 0 ? `
      <div class="card" style="background:var(--accent-light);border:1px solid #BFDBFE;">
        <span style="font-size:.8rem;font-weight:600;color:var(--accent);">
          ${availPRs.length} approved PR(s) ready to be converted to PO
        </span>
      </div>` : ''}
    ${sortedPOs.length === 0
      ? `<div class="empty-state"><div class="es-icon">🛒</div><p>No purchase orders yet.</p></div>`
      : sortedPOs.map(po => {
          const mat = mats.find(m => m.id === po.materialId);
          const sup = sups.find(s => s.id === po.supplierId);
          const remaining = Number(po.orderedQty) - Number(po.receivedQty);
          const stClass = po.status === 'Completed' ? 'completed'
                        : po.status === 'Partially Received' ? 'partial' : 'created';
          return `
            <div class="list-item">
              <div class="list-item-header">
                <div>
                  <div class="list-item-title">${po.id}</div>
                  <div class="list-item-sub">PR: ${po.prId} · ${mat ? escHtml(mat.name) : po.materialId}</div>
                </div>
                <span class="badge badge-${stClass}">${po.status}</span>
              </div>
              <div style="font-size:.8rem;" class="flex-between">
                <span>Ordered: ${fmtQty(po.orderedQty)} | Recv: ${fmtQty(po.receivedQty)} | Rem: ${fmtQty(remaining)}</span>
              </div>
              <div style="font-size:.78rem;color:var(--neutral-500);">
                Supplier: ${sup ? escHtml(sup.name) : '—'} · ₹${fmt(po.price)}/unit · Due: ${po.expectedDate||'—'}
              </div>
            </div>`;
        }).join('')
    }
  `;
}

function openPOModal() {
  const prs  = DB.prs();
  const pos  = DB.pos();
  const mats = DB.materials();
  const sups = DB.suppliers();

  const availPRs = prs.filter(pr =>
    pr.status === 'Approved' && !pos.some(po => po.prId === pr.id)
  );

  if (availPRs.length === 0) {
    toast('No approved PRs available.', 'error'); return;
  }

  const prOptions = availPRs.map(pr => {
    const mat = mats.find(m => m.id === pr.materialId);
    return `<option value="${pr.id}" data-mat="${pr.materialId}" data-qty="${pr.qty}">${pr.id} – ${mat ? escHtml(mat.name) : pr.materialId} (${pr.qty} units)</option>`;
  }).join('');

  const supOptions = sups.map(s =>
    `<option value="${s.id}">${escHtml(s.name)}</option>`
  ).join('');

  document.getElementById('modal-title').textContent = 'Create Purchase Order';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Approved PR *</label>
      <select id="po-pr" class="form-control" onchange="onPOPrChange()">
        <option value="">— Select PR —</option>
        ${prOptions}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Material</label>
      <input id="po-mat" class="form-control" readonly style="background:var(--neutral-50)" placeholder="Auto-filled">
    </div>
    <div class="form-group">
      <label class="form-label">Ordered Quantity *</label>
      <input id="po-qty" type="number" min="1" class="form-control">
    </div>
    <div class="form-group">
      <label class="form-label">Supplier *</label>
      <select id="po-sup" class="form-control">
        <option value="">— Select Supplier —</option>
        ${supOptions}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Unit Price (₹) *</label>
        <input id="po-price" type="number" min="0.01" step="0.01" class="form-control">
      </div>
      <div class="form-group">
        <label class="form-label">Expected Date *</label>
        <input id="po-date" type="date" class="form-control">
      </div>
    </div>
    <div class="inline-error" id="po-err"></div>
  `;
  document.getElementById('modal-save').onclick = savePO;
  openModal();
}

function onPOPrChange() {
  const sel  = document.getElementById('po-pr');
  const opt  = sel.options[sel.selectedIndex];
  if (!opt.value) return;
  const matId = opt.dataset.mat;
  const qty   = opt.dataset.qty;
  const mats  = DB.materials();
  const mat   = mats.find(m => m.id === matId);
  document.getElementById('po-mat').value   = mat ? `${mat.name} (${matId})` : matId;
  document.getElementById('po-qty').value   = qty;
  // default price from material
  if (mat) document.getElementById('po-price').value = mat.price;
  // default supplier
  if (mat && mat.supplierId) {
    const supSel = document.getElementById('po-sup');
    for (const o of supSel.options) if (o.value === mat.supplierId) { o.selected = true; break; }
  }
}

function savePO() {
  const prId    = document.getElementById('po-pr').value;
  const supId   = document.getElementById('po-sup').value;
  const qty     = parseFloat(document.getElementById('po-qty').value);
  const price   = parseFloat(document.getElementById('po-price').value);
  const expDate = document.getElementById('po-date').value;
  const errEl   = document.getElementById('po-err');

  if (!prId)               return showErr(errEl, 'Please select a PR.');
  if (!supId)              return showErr(errEl, 'Please select a supplier.');
  if (isNaN(qty)||qty<1)   return showErr(errEl, 'Quantity must be at least 1.');
  if (isNaN(price)||price<=0) return showErr(errEl, 'Price must be greater than 0.');
  if (!expDate)            return showErr(errEl, 'Please enter an expected delivery date.');

  const prs = DB.prs();
  const pr  = prs.find(x => x.id === prId);
  if (!pr)  return showErr(errEl, 'PR not found.');

  const pos = DB.pos();
  pos.push({
    id: newPOId(),
    prId,
    supplierId: supId,
    materialId: pr.materialId,
    orderedQty: qty,
    receivedQty: 0,
    price,
    expectedDate: expDate,
    status: 'Created',
  });
  DB.savePOs(pos);
  toast('PO created ✓', 'success');
  closeModal();
  renderPO();
}

// ─── GOODS RECEIPT ───────────────────────────────────────────
function renderGRN() {
  const grns = DB.grns();
  const pos  = DB.pos();
  const mats = DB.materials();

  // POs not yet completed
  const openPOs = pos.filter(po => po.status !== 'Completed');

  const sortedGRNs = [...grns].sort((a,b) => b.id.localeCompare(a.id));

  document.getElementById('page-grn').innerHTML = `
    <div class="section-header">
      <h2>Goods Receipts (${grns.length})</h2>
      <button class="btn btn-primary btn-sm" onclick="openGRNModal()" ${openPOs.length===0?'disabled title="No open POs"':''}>+ Record GRN</button>
    </div>
    ${sortedGRNs.length === 0
      ? `<div class="empty-state"><div class="es-icon">📬</div><p>No goods receipts yet.</p></div>`
      : sortedGRNs.map(g => {
          const po  = pos.find(p => p.id === g.poId);
          const mat = po ? mats.find(m => m.id === po.materialId) : null;
          return `
            <div class="list-item">
              <div class="list-item-header">
                <div>
                  <div class="list-item-title">${g.id}</div>
                  <div class="list-item-sub">PO: ${g.poId} · ${mat ? escHtml(mat.name) : '—'}</div>
                </div>
              </div>
              <div style="font-size:.8rem;">
                Received: <strong class="text-success">${fmtQty(g.receivedQty)}</strong>
                &nbsp;|&nbsp; Damaged: <strong class="text-danger">${fmtQty(g.damagedQty)}</strong>
                &nbsp;|&nbsp; Net: <strong>${fmtQty(Number(g.receivedQty)-Number(g.damagedQty))}</strong>
              </div>
              <div style="font-size:.75rem;color:var(--neutral-400);">Date: ${g.date}</div>
            </div>`;
        }).join('')
    }
  `;
}

function openGRNModal() {
  const pos  = DB.pos();
  const mats = DB.materials();

  const openPOs = pos.filter(po => po.status !== 'Completed');
  if (openPOs.length === 0) {
    toast('No open purchase orders.', 'error'); return;
  }

  const poOptions = openPOs.map(po => {
    const mat = mats.find(m => m.id === po.materialId);
    const rem = Number(po.orderedQty) - Number(po.receivedQty);
    return `<option value="${po.id}" data-rem="${rem}">${po.id} – ${mat ? escHtml(mat.name) : po.materialId} (Rem: ${rem})</option>`;
  }).join('');

  document.getElementById('modal-title').textContent = 'Record Goods Receipt';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Purchase Order *</label>
      <select id="grn-po" class="form-control" onchange="onGRNPoChange()">
        <option value="">— Select PO —</option>
        ${poOptions}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Remaining Quantity</label>
      <input id="grn-rem" class="form-control" readonly style="background:var(--neutral-50)" placeholder="Select a PO first">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Received Qty *</label>
        <input id="grn-recv" type="number" min="1" class="form-control" placeholder="0">
      </div>
      <div class="form-group">
        <label class="form-label">Damaged Qty *</label>
        <input id="grn-dmg" type="number" min="0" class="form-control" placeholder="0" value="0">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Receipt Date *</label>
      <input id="grn-date" type="date" class="form-control" value="${today()}">
    </div>
    <div class="inline-error" id="grn-err"></div>
  `;
  document.getElementById('modal-save').onclick = saveGRN;
  openModal();
}

function onGRNPoChange() {
  const sel = document.getElementById('grn-po');
  const opt = sel.options[sel.selectedIndex];
  document.getElementById('grn-rem').value = opt.value ? opt.dataset.rem : '';
}

let _grnSaving = false;

function saveGRN() {
  if (_grnSaving) return;

  const poId    = document.getElementById('grn-po').value;
  const recvQty = parseFloat(document.getElementById('grn-recv').value);
  const dmgQty  = parseFloat(document.getElementById('grn-dmg').value);
  const date    = document.getElementById('grn-date').value;
  const errEl   = document.getElementById('grn-err');
  const saveBtn = document.getElementById('modal-save');

  if (!poId)                  return showErr(errEl, 'Please select a purchase order.');
  if (isNaN(recvQty)||recvQty<=0) return showErr(errEl, 'Received quantity must be greater than 0.');
  if (isNaN(dmgQty)||dmgQty<0)    return showErr(errEl, 'Damaged quantity cannot be negative.');
  if (dmgQty > recvQty)       return showErr(errEl, 'Damaged quantity cannot exceed received quantity.');
  if (!date)                  return showErr(errEl, 'Please enter the receipt date.');

  const pos = DB.pos();
  const po  = pos.find(p => p.id === poId);
  if (!po)  return showErr(errEl, 'Purchase order not found.');

  const remaining = Number(po.orderedQty) - Number(po.receivedQty);
  if (recvQty > remaining) return showErr(errEl, `Received qty (${recvQty}) exceeds remaining qty (${remaining}).`);

  // Disable save button immediately
  _grnSaving = true;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  // Net increase to stock
  const netQty = recvQty - dmgQty;

  // Update material stock
  const mats = DB.materials();
  const matIdx = mats.findIndex(m => m.id === po.materialId);
  if (matIdx === -1) {
    showErr(errEl, 'Material not found.'); _grnSaving = false; saveBtn.disabled = false; return;
  }
  mats[matIdx].stock = Number(mats[matIdx].stock) + netQty;
  DB.saveMaterials(mats);

  // Create GRN record
  const grnId = newGRNId();
  const grns  = DB.grns();
  grns.push({ id: grnId, poId, receivedQty: recvQty, damagedQty: dmgQty, date });
  DB.saveGRNs(grns);

  // Record movement
  recordMovement(po.materialId, 'IN', netQty, grnId);

  // Update PO
  po.receivedQty = Number(po.receivedQty) + recvQty;
  po.status      = po.receivedQty >= po.orderedQty ? 'Completed' : 'Partially Received';
  DB.savePOs(pos);

  toast(`GRN saved ✓ · Stock +${netQty} units`, 'success');
  closeModal();
  renderGRN();
  _grnSaving = false;
}

// ─── Modal helpers ───────────────────────────────────────────
function openModal() {
  document.getElementById('modal-overlay').classList.add('open');
  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled    = false;
  saveBtn.textContent = 'Save';
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  _grnSaving = false;
}

function showErr(el, msg) {
  el.textContent = msg;
  el.classList.add('visible');
}

// ─── SAMPLE DATA ─────────────────────────────────────────────
function loadSampleData() {
  if (DB.materials().length > 0 || DB.suppliers().length > 0) {
    showConfirm('Load Sample Data', 'This will ADD sample data on top of your existing data. Continue?', _doLoadSample);
  } else {
    _doLoadSample();
  }
}

function _doLoadSample() {
  const sups = DB.suppliers();
  let s1, s2, s3;
  s1 = nextId('S', sups); sups.push({ id: s1, name: 'TechParts Pvt Ltd', phone: '+91 98001 12345', email: 'sales@techparts.in' });
  s2 = nextId('S', sups); sups.push({ id: s2, name: 'OfficeWorld Supplies', phone: '+91 80234 56789', email: 'orders@officeworld.in' });
  s3 = nextId('S', sups); sups.push({ id: s3, name: 'GreenEarth Packaging', phone: '+91 97765 43210', email: 'info@greenearth.co' });
  DB.saveSuppliers(sups);

  const mats = DB.materials();
  const samples = [
    { name: 'Wireless Keyboard',  category: 'Electronics',  unit: 'pcs',  stock: 45, minStock: 10, price: 850,  supplierId: s1 },
    { name: 'A4 Copy Paper (Ream)',category: 'Stationery',   unit: 'ream', stock: 3,  minStock: 20, price: 320,  supplierId: s2 },  // ← LOW
    { name: 'USB-C Hub 7-Port',   category: 'Electronics',  unit: 'pcs',  stock: 22, minStock: 5,  price: 1250, supplierId: s1 },
    { name: 'Sticky Notes (Pack)',category: 'Stationery',   unit: 'pack', stock: 60, minStock: 15, price: 85,   supplierId: s2 },
    { name: 'Bubble Wrap Roll 5m',category: 'Packaging',    unit: 'roll', stock: 30, minStock: 10, price: 180,  supplierId: s3 },
    { name: 'Gel Pen Box (12pcs)',category: 'Stationery',   unit: 'box',  stock: 18, minStock: 8,  price: 120,  supplierId: s2 },
  ];
  samples.forEach(s => {
    const id = nextId('M', mats);
    mats.push({ id, ...s });
    const movs = DB.movements();
    movs.push({ id: nextId('MOV-', movs), materialId: id, type: 'IN', qty: s.stock, refId: 'SAMPLE', date: today(), balanceAfter: s.stock });
    DB.saveMovements(movs);
  });
  DB.saveMaterials(mats);
  toast('Sample data loaded ✓', 'success');
  navigate('dashboard');
}

function resetData() {
  showConfirm('Reset All Data', 'This will permanently delete ALL data. This cannot be undone!', () => {
    ['materials','suppliers','purchaseRequisitions','purchaseOrders','goodsReceipts','stockMovements']
      .forEach(k => localStorage.removeItem(k));
    toast('All data cleared.', '');
    navigate('dashboard');
  });
}

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Nav button clicks
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Start on dashboard
  navigate('dashboard');
});
