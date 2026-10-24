// ============================================================
// SmartStore v3 – src/app.js
// Material Design 3 dark UI · Firebase Firestore · Firebase Auth
// ============================================================
import './style.css';
import { db, auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { renderAuthPage } from './auth.js';
import {
  collection, doc, getDoc, getDocs,
  setDoc, updateDoc, deleteDoc,
  runTransaction,
} from 'firebase/firestore';

// ── Helpers ───────────────────────────────────────────────────
const fmt    = n => Number(n).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
const fmtQty = n => Number(n).toLocaleString();
const today  = () => new Date().toISOString().slice(0,10);
const esc    = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function showInlineErr(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }
function getSupName(id)  { const s=_c.suppliers.find(x=>x.id===id); return s?s.name:'—'; }
function getMatName(id)  { const m=_c.materials.find(x=>x.id===id); return m?m.name:'—'; }

// ── User Profile & Invoice Recipient State ────────────────────
let _user = null;
let _appReady = false;
let _currentInvoicePoId = null;
let _userProfile = {
  name: '',
  shopName: '',
  phone: '',
  address1: '',
  address2: '',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  gstin: '',
  pan: 'AABCN1929K'
};

async function loadUserProfile(user) {
  try {
    const cached = localStorage.getItem('smartstore_user_profile');
    if (cached) {
      const parsed = JSON.parse(cached);
      // Clean up legacy hardcoded sample name if it was cached previously
      if (parsed.name === 'Nikhil Sonar' || (parsed.address1 && parsed.address1.includes('Pratibha chs'))) {
        parsed.name = user?.displayName || user?.email?.split('@')[0] || 'Store Owner';
        parsed.address1 = 'Commercial Complex, Main Market';
        parsed.address2 = '';
        parsed.city = 'Mumbai';
        parsed.state = 'Maharashtra';
        parsed.pincode = '400001';
        parsed.phone = '';
        parsed.shopName = '';
        localStorage.setItem('smartstore_user_profile', JSON.stringify(parsed));
      }
      _userProfile = { ..._userProfile, ...parsed };
    }
  } catch (_) {}

  if (user?.uid) {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.name === 'Nikhil Sonar') {
          data.name = user.displayName || user.email?.split('@')[0] || 'Store Owner';
        }
        _userProfile = { ..._userProfile, ...data };
        localStorage.setItem('smartstore_user_profile', JSON.stringify(_userProfile));
      } else if (!_userProfile.name) {
        _userProfile.name = user.displayName || user.email?.split('@')[0] || 'Store Owner';
      }
    } catch (e) {
      console.warn('Profile sync:', e);
    }
  }

  if (!_userProfile.name && user) {
    _userProfile.name = user.displayName || user.email?.split('@')[0] || 'Store Owner';
  }
}

// ── Auth gate ─────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  try {
    _user = user;
    if (user) {
      // Immediately switch views to prevent any blank/black frame
      document.getElementById('auth-page').classList.add('hidden');
      const mainApp = document.getElementById('main-app');
      mainApp.classList.remove('hidden');
      mainApp.classList.add('flex');

      // Soft email check without kicking user out
      const isPasswordUser = user.providerData?.some(p => p.providerId === 'password');
      if (isPasswordUser) {
        try {
          await user.reload();
        } catch (_) {}
      }

      // Load profile without blocking initial view transition
      loadUserProfile(user).then(() => {
        const avatarEl = document.getElementById('user-avatar');
        if (avatarEl && _user) {
          const displayName = _userProfile.name || _user.displayName || _user.email || 'User';
          if (_user.photoURL) {
            avatarEl.innerHTML =
              `<img src="${_user.photoURL}" alt="Profile" class="w-10 h-10 rounded-full object-cover cursor-pointer" onclick="openUserProfileModal()" title="${esc(displayName)} (Invoice Profile & Settings)">`;
          } else {
            const initial = displayName.charAt(0).toUpperCase();
            avatarEl.innerHTML =
              `<div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary-container flex items-center justify-center font-bold text-on-primary text-[13px] cursor-pointer" onclick="openUserProfileModal()" title="${esc(displayName)} (Invoice Profile & Settings)">${initial}</div>`;
          }
        }
      }).catch(e => console.warn('Profile load:', e));

      if (!_appReady) {
        _appReady = true;
        initApp();
      } else {
        navigate('dashboard');
      }
    } else {
      document.getElementById('main-app').classList.add('hidden');
      document.getElementById('main-app').classList.remove('flex');
      document.getElementById('auth-page').classList.remove('hidden');
      _appReady = false;
      renderAuthPage();
    }
  } catch (err) {
    console.error('onAuthStateChanged error:', err);
  }
});

window.signOutUser = () => {
  showConfirm('Sign Out', 'You will be logged out of SmartStore.', () => signOut(auth));
};

function openUserProfileModal() {
  document.getElementById('modal-title').textContent = 'User Profile & Invoice Details';
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div class="space-y-4">
      <div class="p-3.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary-container flex items-center justify-center font-bold text-on-primary text-[15px] flex-shrink-0">
          ${(_userProfile.name || _user?.email || 'U').charAt(0).toUpperCase()}
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-bold text-on-surface text-[14px] truncate">${esc(_userProfile.name || 'Store Owner')}</div>
          <div class="text-[12px] text-on-surface-variant truncate">${esc(_user?.email || '')}</div>
        </div>
        <button type="button" onclick="signOutUser()" class="px-2.5 py-1 rounded-lg bg-error/15 text-error text-[11px] font-bold border border-error/30 hover:bg-error/25 transition-colors">
          Logout
        </button>
      </div>

      <div class="text-[12px] text-on-surface-variant leading-relaxed">
        These recipient details will appear on all generated <strong>Tax Invoices</strong> and downloaded PDF bills as the <strong>Bill To</strong> and <strong>Ship To</strong> party.
      </div>

      <div class="space-y-3">
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Full Name (Invoice Recipient) *</label>
          <input id="prof-name" type="text" class="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-on-surface text-[13px] focus:outline-none focus:border-primary"
            value="${esc(_userProfile.name || '')}" placeholder="e.g. Rajesh Sharma">
        </div>
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Business / Store Name (Optional)</label>
          <input id="prof-shop" type="text" class="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-on-surface text-[13px] focus:outline-none focus:border-primary"
            value="${esc(_userProfile.shopName || '')}" placeholder="e.g. Apex Hardware & Electricals">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Phone / Mobile</label>
            <input id="prof-phone" type="tel" class="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-on-surface text-[13px] focus:outline-none focus:border-primary"
              value="${esc(_userProfile.phone || '')}" placeholder="e.g. 9820012345">
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">PIN Code</label>
            <input id="prof-pincode" type="text" class="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-on-surface text-[13px] focus:outline-none focus:border-primary"
              value="${esc(_userProfile.pincode || '')}" placeholder="e.g. 400001">
          </div>
        </div>
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Local Address (Line 1)</label>
          <input id="prof-addr1" type="text" class="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-on-surface text-[13px] focus:outline-none focus:border-primary"
            value="${esc(_userProfile.address1 || '')}" placeholder="e.g. Shop No. 12, Commercial Plaza">
        </div>
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Address Line 2 / Landmark</label>
          <input id="prof-addr2" type="text" class="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-on-surface text-[13px] focus:outline-none focus:border-primary"
            value="${esc(_userProfile.address2 || '')}" placeholder="e.g. Station Road, Near Central Bank">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">City</label>
            <input id="prof-city" type="text" class="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-on-surface text-[13px] focus:outline-none focus:border-primary"
              value="${esc(_userProfile.city || '')}" placeholder="e.g. Mumbai">
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">State</label>
            <input id="prof-state" type="text" class="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-on-surface text-[13px] focus:outline-none focus:border-primary"
              value="${esc(_userProfile.state || '')}" placeholder="e.g. Maharashtra">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">GSTIN (Optional)</label>
            <input id="prof-gstin" type="text" class="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-on-surface text-[13px] uppercase focus:outline-none focus:border-primary"
              value="${esc(_userProfile.gstin || '')}" placeholder="e.g. 27AAAAA0000A1Z5">
          </div>
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">PAN (Optional)</label>
            <input id="prof-pan" type="text" class="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-on-surface text-[13px] uppercase focus:outline-none focus:border-primary"
              value="${esc(_userProfile.pan || '')}" placeholder="e.g. AABCN1929K">
          </div>
        </div>
      </div>
    </div>
  `;

  openModal();
  document.getElementById('modal-save').onclick = async () => {
    const updated = {
      name: document.getElementById('prof-name').value.trim() || _user?.displayName || 'Store Owner',
      shopName: document.getElementById('prof-shop').value.trim(),
      phone: document.getElementById('prof-phone').value.trim(),
      address1: document.getElementById('prof-addr1').value.trim(),
      address2: document.getElementById('prof-addr2').value.trim(),
      city: document.getElementById('prof-city').value.trim() || 'Mumbai',
      state: document.getElementById('prof-state').value.trim() || 'Maharashtra',
      pincode: document.getElementById('prof-pincode').value.trim() || '400001',
      gstin: document.getElementById('prof-gstin').value.trim().toUpperCase(),
      pan: document.getElementById('prof-pan').value.trim().toUpperCase(),
      email: _user?.email || '',
      updatedAt: new Date().toISOString()
    };
    _userProfile = updated;
    localStorage.setItem('smartstore_user_profile', JSON.stringify(updated));
    if (_user?.uid) {
      try {
        await setDoc(doc(db, 'users', _user.uid), updated, { merge: true });
      } catch (err) {
        console.warn('Could not save profile to firestore:', err);
      }
    }
    // Update avatar display name
    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl && !_user?.photoURL) {
      avatarEl.innerHTML =
        `<div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary-container flex items-center justify-center font-bold text-on-primary text-[13px] cursor-pointer" onclick="openUserProfileModal()" title="${esc(updated.name)} (Invoice Profile & Settings)">${updated.name.charAt(0).toUpperCase()}</div>`;
    }
    closeModal();
    toast('✓ Profile & Invoice Address saved!');
    // If invoice is currently open, refresh it with new details immediately!
    if (!document.getElementById('invoice-overlay').classList.contains('hidden') && _currentInvoicePoId) {
      viewInvoice(_currentInvoicePoId);
    }
  };
}

// ── In-memory cache ───────────────────────────────────────────
const _c = { materials:[], suppliers:[], prs:[], pos:[], grns:[] };

// ── Firestore helpers ─────────────────────────────────────────
async function getAllDocs(colName) {
  const snap = await getDocs(collection(db, colName));
  return snap.docs.map(d => d.data());
}

async function nextSeqId(colName, prefix, pad) {
  const counterRef = doc(db, 'counters', colName);
  let newId;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const n = (snap.exists() ? snap.data().count : 0) + 1;
    tx.set(counterRef, { count: n });
    newId = prefix + String(n).padStart(pad, '0');
  });
  return newId;
}

// ── Loading ───────────────────────────────────────────────────
let _loadDepth = 0;
let _loadSafetyTimer = null;
function showLoading() {
  _loadDepth++;
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.remove('hidden');
  clearTimeout(_loadSafetyTimer);
  _loadSafetyTimer = setTimeout(() => {
    _loadDepth = 0;
    if (el) el.classList.add('hidden');
  }, 8000);
}
function hideLoading() {
  if (--_loadDepth <= 0) {
    _loadDepth = 0;
    clearTimeout(_loadSafetyTimer);
    const el = document.getElementById('loading-overlay');
    if (el) el.classList.add('hidden');
  }
}

// ── Toast ─────────────────────────────────────────────────────
let _toastTimer;
function toast(msg) {
  const el    = document.getElementById('toast');
  const inner = el.querySelector('span');
  inner.textContent = msg;
  el.classList.remove('opacity-0','translate-y-4','pointer-events-none');
  el.classList.add('opacity-100','translate-y-0');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.add('opacity-0','translate-y-4','pointer-events-none');
    el.classList.remove('opacity-100','translate-y-0');
  }, 2800);
}

// ── Confirm dialog ────────────────────────────────────────────
function showConfirm(title, text, onOk) {
  const ov = document.getElementById('confirm-overlay');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent  = text;
  const okBtn = document.getElementById('confirm-ok');
  okBtn.className = 'flex-1 py-2.5 rounded-xl bg-error text-white font-bold';
  okBtn.innerHTML = 'Confirm';
  const cancelBtn = document.getElementById('confirm-cancel');
  cancelBtn.textContent = 'Cancel';
  ov.classList.remove('hidden');
  const close = () => ov.classList.add('hidden');
  okBtn.onclick     = () => { close(); onOk(); };
  cancelBtn.onclick = close;
}

// ── Modal ─────────────────────────────────────────────────────
function openModal() {
  const ov = document.getElementById('modal-overlay');
  ov.classList.remove('hidden');
  const btn = document.getElementById('modal-save');
  btn.disabled    = false;
  btn.textContent = 'Save';
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  _grnSaving = false;
}


function catIcon(cat='') {
  const c = cat.toLowerCase();
  if (c.includes('electron') || c.includes('micro') || c.includes('circuit') || c.includes('chip') || c.includes('ic')) return 'memory';
  if (c.includes('sensor')) return 'sensors';
  if (c.includes('station') || c.includes('paper') || c.includes('pen') || c.includes('print')) return 'description';
  if (c.includes('3d') || c.includes('filament') || c.includes('resin')) return 'view_in_ar';
  if (c.includes('pack') || c.includes('box') || c.includes('wrap')) return 'inventory_2';
  if (c.includes('tool') || c.includes('solder') || c.includes('hardware') || c.includes('consum')) return 'build';
  if (c.includes('mechan') || c.includes('bolt') || c.includes('nut')) return 'settings';
  return 'category';
}

function stockPct(stock, minStock) {
  const s = Number(stock), m = Number(minStock);
  if (m === 0) return 100;
  return Math.min(100, Math.round((s / (m * 2)) * 100));
}

function statusChip(status) {
  const map = {
    'Pending':            'bg-tertiary/15 text-tertiary border border-tertiary/30',
    'Approved':           'bg-primary/15 text-primary border border-primary/30',
    'Rejected':           'bg-error/15 text-error border border-error/30',
    'Created':            'bg-secondary/15 text-secondary border border-secondary/30',
    'Partially Received': 'bg-secondary/15 text-secondary border border-secondary/30',
    'Completed':          'bg-primary/15 text-primary border border-primary/30',
  };
  return map[status] || 'bg-outline/20 text-on-surface-variant';
}

// ── Navigation ────────────────────────────────────────────────
const PAGE_SUBTITLES = {
  dashboard:'Dashboard', products:'Items & Stock', suppliers:'Suppliers',
  pr:'Item Requests', po:'Supplier Orders', grn:'Delivery Check'
};

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.add('hidden');
    p.classList.remove('flex');
  });
  const el = document.getElementById('page-'+page);
  el.classList.remove('hidden');
  el.classList.add('flex');

  document.querySelectorAll('.nav-btn').forEach(b => {
    const active = b.dataset.page === page;
    b.classList.toggle('text-primary', active);
    b.classList.toggle('font-semibold', active);
    b.classList.toggle('text-on-surface-variant', !active);
  });

  document.getElementById('page-subtitle').textContent = PAGE_SUBTITLES[page] || '';

  const renders = { dashboard:renderDashboard, products:renderProducts,
    suppliers:renderSuppliers, pr:renderPR, po:renderPO, grn:renderGRN };
  renders[page]?.();
}

// ── Init ──────────────────────────────────────────────────────
function initApp() {
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.addEventListener('click', () => navigate(btn.dataset.page)));

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  navigate('dashboard');
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════
async function renderDashboard() {
  const pg = document.getElementById('page-dashboard');
  pg.innerHTML = `<div class="flex items-center justify-center h-40"><div class="w-8 h-8 rounded-full border-[3px] border-outline-variant border-t-primary animate-spin"></div></div>`;
  showLoading();
  try {
    const [mats, sups, pos, grns, prs] = await Promise.all([
      getAllDocs('materials'), getAllDocs('suppliers'),
      getAllDocs('purchaseOrders'), getAllDocs('goodsReceipts'),
      getAllDocs('purchaseRequisitions'),
    ]);
    Object.assign(_c, { materials:mats, suppliers:sups, pos, grns, prs });

    const totalItems  = mats.length;
    const totalStock  = mats.reduce((s,m) => s + Number(m.stock), 0);
    const lowStock    = mats.filter(m => Number(m.stock) <= Number(m.minStock));
    const invValue    = mats.reduce((s,m) => s + Number(m.stock)*Number(m.price), 0);
    const pendingPRs  = prs.filter(p => p.status === 'Pending').length;
    const activePOs   = pos.filter(p => p.status !== 'Completed').length;

    const activity = [
      ...pos.map(p =>({...p, _type:'PO',  _date:p.expectedDate||p.id, _label:'Supplier Order'})),
      ...grns.map(g=>({...g, _type:'GRN', _date:g.date||g.id,         _label:'Delivery Checked'})),
    ].sort((a,b)=>b._date.localeCompare(a._date)).slice(0,5);

    pg.innerHTML = `
      <!-- ── Store header card ──────────────────────────── -->
      <div class="relative overflow-hidden rounded-xl bg-surface-container-high p-space-md shadow-xl">
        <div class="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-primary/10 blur-2xl pointer-events-none"></div>
        <div class="flex items-start justify-between gap-space-sm relative z-10">
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-space-xs mb-1">
              <span class="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-surface-variant text-primary">
                <span class="material-symbols-outlined text-[16px]">warehouse</span>
              </span>
              <span class="font-label-metric text-label-metric text-on-surface-variant uppercase tracking-wider">SmartStore Inventory</span>
            </div>
            <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">${totalItems} Items Being Tracked</h2>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Welcome back! Here's your store overview.</p>
          </div>
          <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low shadow-sm active:scale-95 transition-transform" onclick="navigate('dashboard')">
            <span class="relative flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span></span>
            <span class="font-label-metric text-label-metric text-on-surface font-medium whitespace-nowrap">Live</span>
            <span class="material-symbols-outlined text-[14px] text-primary">sync</span>
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-4 pt-3 bg-surface-container/60 rounded-lg p-2.5">
          <div class="flex flex-col">
            <span class="font-label-code text-[10px] text-on-surface-variant uppercase tracking-wider">Today</span>
            <span class="font-headline-sm text-[13px] text-on-surface font-semibold">${today()}</span>
          </div>
          <div class="flex flex-col">
            <span class="font-label-code text-[10px] text-on-surface-variant uppercase tracking-wider">Pending Requests</span>
            <span class="font-headline-sm text-[13px] ${pendingPRs>0?'text-tertiary':'text-primary'} font-semibold">${pendingPRs > 0 ? pendingPRs+' Waiting' : 'All Clear ✓'}</span>
          </div>
        </div>
      </div>

      <!-- ── 4 KPI cards ───────────────────────────────── -->
      <div class="grid grid-cols-2 gap-gutter">
        <!-- Total Items -->
        <div class="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#063c2c] to-surface-container-high p-3.5 shadow-lg flex flex-col justify-between min-h-[138px]">
          <div class="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-primary/20 blur-xl pointer-events-none"></div>
          <div class="flex items-center justify-between">
            <div class="w-8 h-8 rounded-lg bg-surface-container-lowest/70 flex items-center justify-center text-primary">
              <span class="material-symbols-outlined text-[18px]">inventory</span>
            </div>
            <span class="font-label-metric text-label-metric px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">ITEMS</span>
          </div>
          <div class="mt-3">
            <span class="font-label-metric text-label-metric text-on-surface-variant uppercase tracking-wider block">Total Items</span>
            <div class="flex items-baseline gap-1 mt-0.5">
              <span class="font-headline-lg text-[26px] font-bold text-on-surface">${totalItems}</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">SKUs</span>
            </div>
          </div>
          <div class="w-full h-5 mt-1">
            <svg class="w-full h-full stroke-primary fill-transparent" viewBox="0 0 100 24">
              <path d="M0,18 Q15,22 30,12 T60,10 T85,4 L100,2" stroke-linecap="round" stroke-width="2.5"></path>
            </svg>
          </div>
        </div>

        <!-- Total Stock -->
        <div class="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#092b64] to-surface-container-high p-3.5 shadow-lg flex flex-col justify-between min-h-[138px]">
          <div class="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-secondary/20 blur-xl pointer-events-none"></div>
          <div class="flex items-center justify-between">
            <div class="w-8 h-8 rounded-lg bg-surface-container-lowest/70 flex items-center justify-center text-secondary">
              <span class="material-symbols-outlined text-[18px]">layers</span>
            </div>
            <span class="font-label-metric text-label-metric px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-bold">${activePOs > 0 ? activePOs+' Open' : 'OK'}</span>
          </div>
          <div class="mt-3">
            <span class="font-label-metric text-label-metric text-on-surface-variant uppercase tracking-wider block">Items in Stock</span>
            <div class="flex items-baseline gap-1 mt-0.5">
              <span class="font-headline-lg text-[26px] font-bold text-on-surface">${fmtQty(totalStock)}</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">units</span>
            </div>
          </div>
          <div class="w-full h-5 mt-1 flex items-end gap-1.5 pt-1">
            <div class="h-2 w-full bg-secondary/30 rounded-full"></div>
            <div class="h-3.5 w-full bg-secondary/50 rounded-full"></div>
            <div class="h-5 w-full bg-secondary rounded-full"></div>
            <div class="h-4 w-full bg-secondary/70 rounded-full"></div>
          </div>
        </div>

        <!-- Low Stock -->
        <div class="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#4d1d07] to-surface-container-high p-3.5 shadow-lg flex flex-col justify-between min-h-[138px]">
          <div class="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-tertiary/25 blur-xl pointer-events-none"></div>
          <div class="flex items-center justify-between">
            <div class="w-8 h-8 rounded-lg bg-surface-container-lowest/70 flex items-center justify-center text-tertiary">
              <span class="material-symbols-outlined text-[18px]">crisis_alert</span>
            </div>
            ${lowStock.length > 0 ? `<span class="font-label-metric text-label-metric px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary font-bold animate-pulse">Need to Order!</span>` : `<span class="font-label-metric text-label-metric px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">All Good</span>`}
          </div>
          <div class="mt-3">
            <span class="font-label-metric text-label-metric text-on-surface-variant uppercase tracking-wider block">Running Low</span>
            <div class="flex items-baseline gap-1 mt-0.5">
              <span class="font-headline-lg text-[26px] font-bold ${lowStock.length>0?'text-tertiary':'text-primary'}">${String(lowStock.length).padStart(2,'0')}</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">${lowStock.length>0?'Need Reorder':'Items OK'}</span>
            </div>
          </div>
          <div class="w-full bg-surface-container-lowest rounded-full h-2 mt-2 overflow-hidden">
            <div class="h-full rounded-full ${lowStock.length>0?'bg-tertiary':'bg-primary'}" style="width:${lowStock.length===0?100:Math.min(100,Math.round(lowStock.length/Math.max(1,totalItems)*100)*5)}%"></div>
          </div>
        </div>

        <!-- Inventory Value -->
        <div class="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1b1c3e] to-surface-container-high p-3.5 shadow-lg flex flex-col justify-between min-h-[138px]">
          <div class="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-secondary-fixed/20 blur-xl pointer-events-none"></div>
          <div class="flex items-center justify-between">
            <div class="w-8 h-8 rounded-lg bg-surface-container-lowest/70 flex items-center justify-center text-secondary-fixed">
              <span class="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            </div>
            <span class="font-label-metric text-label-metric px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-bold">INR</span>
          </div>
          <div class="mt-3">
            <span class="font-label-metric text-label-metric text-on-surface-variant uppercase tracking-wider block">Total Stock Value</span>
            <div class="flex items-baseline gap-1 mt-0.5">
              <span class="font-headline-lg text-[22px] font-bold text-on-surface">₹${invValue>=100000?(invValue/100000).toFixed(2)+'L':fmt(invValue)}</span>
            </div>
          </div>
          <div class="flex items-center justify-between text-[10px] font-label-metric text-on-surface-variant mt-1">
            <span>Current Worth</span>
            <span class="text-primary">Stock × Price</span>
          </div>
        </div>
      </div>

      <!-- ── Quick action carousel ──────────────────────── -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="font-label-metric text-label-metric text-on-surface-variant uppercase tracking-wider">Quick Actions</span>
        </div>
        <div class="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
          <button onclick="navigate('pr');setTimeout(() => openPRModal(), 100)" class="flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-variant active:scale-95 transition-all shadow-md group">
            <span class="w-7 h-7 rounded-lg bg-primary/10 group-hover:bg-primary group-hover:text-on-primary text-primary flex items-center justify-center transition-colors">
              <span class="material-symbols-outlined text-[18px]">add_circle</span>
            </span>
            <span class="font-body-md text-body-md font-medium text-on-surface whitespace-nowrap">+ Request Item</span>
          </button>
          <button onclick="navigate('po');setTimeout(() => openPOModal(), 100)" class="flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-variant active:scale-95 transition-all shadow-md group">
            <span class="w-7 h-7 rounded-lg bg-secondary/10 group-hover:bg-secondary group-hover:text-on-secondary text-secondary flex items-center justify-center transition-colors">
              <span class="material-symbols-outlined text-[18px]">receipt_long</span>
            </span>
            <span class="font-body-md text-body-md font-medium text-on-surface whitespace-nowrap">+ Create Order</span>
          </button>
          <button onclick="navigate('grn');setTimeout(() => openGRNModal(), 100)" class="flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-variant active:scale-95 transition-all shadow-md group">
            <span class="w-7 h-7 rounded-lg bg-primary/15 group-hover:bg-primary-container group-hover:text-on-primary-container text-primary flex items-center justify-center transition-colors">
              <span class="material-symbols-outlined text-[18px]">qr_code_scanner</span>
            </span>
            <span class="font-body-md text-body-md font-medium text-on-surface whitespace-nowrap">Check Delivery</span>
          </button>
          <button onclick="navigate('products');setTimeout(() => openProductModal(), 100)" class="flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-variant active:scale-95 transition-all shadow-md group">
            <span class="w-7 h-7 rounded-lg bg-tertiary/10 group-hover:bg-tertiary group-hover:text-on-tertiary text-tertiary flex items-center justify-center transition-colors">
              <span class="material-symbols-outlined text-[18px]">add_box</span>
            </span>
            <span class="font-body-md text-body-md font-medium text-on-surface whitespace-nowrap">Add New Item</span>
          </button>
        </div>
      </div>

      <!-- ── Low stock alert ────────────────────────────── -->
      ${lowStock.length === 0 ? `
      <div class="relative overflow-hidden rounded-xl bg-surface-container-high p-space-md shadow-xl">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
            <span class="material-symbols-outlined text-[22px]">task_alt</span>
          </div>
          <div>
            <div class="font-headline-sm text-[15px] font-bold text-on-surface">All Items Well-Stocked</div>
            <div class="font-body-sm text-[12px] text-on-surface-variant">No items below minimum stock level.</div>
          </div>
        </div>
      </div>` : `
      <div class="relative overflow-hidden rounded-xl bg-gradient-to-r from-surface-container-high via-surface-container to-surface-container-high p-space-md shadow-xl">
        <div class="flex items-center justify-between pb-3">
          <div class="flex items-center gap-2">
            <span class="flex h-3 w-3 relative"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-error"></span></span>
            <h3 class="font-headline-sm text-[15px] font-bold text-on-surface">Items Almost Finished (Low Stock)</h3>
          </div>
          <span class="font-label-metric text-[11px] px-2 py-0.5 rounded-full bg-error-container/60 text-error font-semibold">${lowStock.length} Critical</span>
        </div>
        <div class="flex flex-col gap-2.5">
          ${lowStock.slice(0,4).map(m => {
            const short = Number(m.minStock) - Number(m.stock);
            return `
            <div class="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-lowest/80">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-error-container/30 flex items-center justify-center text-error flex-shrink-0 overflow-hidden">
                  <span class="material-symbols-outlined text-[18px] leading-none select-none">${catIcon(m.category)}</span>
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="font-body-md text-[13px] font-semibold text-on-surface truncate">${esc(m.name)}</span>
                  <span class="font-label-code text-[11px] text-error font-semibold">${fmtQty(m.stock)} ${m.unit} left <span class="text-on-surface-variant font-normal">(Min. ${fmtQty(m.minStock)})</span></span>
                </div>
              </div>
              <span class="font-label-metric text-[11px] text-tertiary font-bold bg-tertiary/10 px-2 py-1 rounded">${m.id}</span>
            </div>`;
          }).join('')}
        </div>
        <button onclick="navigate('po');setTimeout(() => openPOModal('${lowStock[0]?.id||''}'), 100)" class="w-full mt-3 py-2.5 px-3 rounded-lg bg-tertiary-container hover:bg-tertiary text-on-tertiary-fixed font-headline-sm text-[13px] font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all">
          <span class="material-symbols-outlined text-[18px]">bolt</span>
          <span>⚡ Order Needed Items Now</span>
        </button>
      </div>`}

      <!-- ── HOW WE GET NEW STOCK guide ─────────────────── -->
      <div class="rounded-xl bg-surface-container-high p-space-md shadow-xl flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <div class="flex flex-col">
            <span class="font-label-metric text-label-metric text-on-surface-variant uppercase tracking-wider">Step-by-Step Guide</span>
            <h3 class="font-headline-sm text-headline-sm font-bold text-on-surface">HOW WE GET NEW STOCK</h3>
          </div>
          <span class="font-label-code text-label-code text-secondary">Step 1 to 4</span>
        </div>
        <div class="grid grid-cols-4 gap-1.5 relative pt-1">
          <div class="flex flex-col items-center text-center p-2 rounded-lg bg-surface-container-low hover:bg-surface-variant transition-colors">
            <div class="relative w-8 h-8 rounded-full bg-tertiary/20 text-tertiary flex items-center justify-center font-bold font-label-metric text-[13px] mb-1.5">
              1
              ${pendingPRs>0?`<span class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-tertiary text-on-tertiary font-bold text-[9px] flex items-center justify-center">${pendingPRs}</span>`:''}
            </div>
            <span class="font-label-metric text-[11px] font-bold text-on-surface">Request Item</span>
            <span class="font-body-sm text-[10px] text-tertiary">${pendingPRs>0?pendingPRs+' Pending':'Create PR'}</span>
          </div>
          <div class="flex flex-col items-center text-center p-2 rounded-lg bg-surface-container-low hover:bg-surface-variant transition-colors">
            <div class="relative w-8 h-8 rounded-full bg-secondary/20 text-secondary flex items-center justify-center font-bold font-label-metric text-[13px] mb-1.5">
              2
              ${activePOs>0?`<span class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-secondary text-on-secondary font-bold text-[9px] flex items-center justify-center">${activePOs}</span>`:''}
            </div>
            <span class="font-label-metric text-[11px] font-bold text-on-surface">Supplier Order</span>
            <span class="font-body-sm text-[10px] text-secondary">${activePOs>0?activePOs+' Open':'Create PO'}</span>
          </div>
          <div class="flex flex-col items-center text-center p-2 rounded-lg bg-surface-container-low hover:bg-surface-variant transition-colors">
            <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold font-label-metric text-[13px] mb-1.5">3</div>
            <span class="font-label-metric text-[11px] font-bold text-on-surface">Delivery Check</span>
            <span class="font-body-sm text-[10px] text-primary">Record GRN</span>
          </div>
          <div class="flex flex-col items-center text-center p-2 rounded-lg bg-surface-container-low hover:bg-surface-variant transition-colors opacity-80">
            <div class="w-8 h-8 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center font-bold font-label-metric text-[13px] mb-1.5">
              <span class="material-symbols-outlined text-[16px]">check</span>
            </div>
            <span class="font-label-metric text-[11px] font-bold text-on-surface">Put on Shelf</span>
            <span class="font-body-sm text-[10px] text-on-surface-variant">Added to Stock</span>
          </div>
        </div>
        <div class="flex items-center gap-2 p-2 rounded-lg bg-surface-container-lowest text-on-surface-variant text-body-sm text-[11px]">
          <span class="material-symbols-outlined text-primary text-[16px]">verified</span>
          <span>Delivery note matches supplier order — ready to check and update stock.</span>
        </div>
      </div>

      <!-- ── Recent Activity ────────────────────────────── -->
      <div class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-on-surface-variant text-[18px]">history</span>
            <h3 class="font-headline-sm text-[15px] font-bold text-on-surface">Recent Store Activity</h3>
          </div>
          <button class="font-label-metric text-label-metric text-primary uppercase tracking-wider" onclick="navigate('po')">View Orders</button>
        </div>
        ${activity.length===0 ? `
        <div class="p-6 rounded-xl bg-surface-container-high text-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[36px] mb-2 block">inbox</span>
          <p class="font-body-sm text-body-sm">No recent activity. Load sample data to get started!</p>
        </div>` :
        activity.map(a => {
          const mat = _c.materials.find(m=>m.id===a.materialId);
          const sup = _c.suppliers.find(s=>s.id===a.supplierId);
          const isPO = a._type==='PO';
          return `
          <div class="p-3 rounded-xl bg-surface-container-high hover:bg-surface-variant transition-colors flex items-center justify-between gap-space-sm">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-lg ${isPO?'bg-secondary/10 text-secondary':'bg-primary/10 text-primary'} flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-outlined text-[20px]">${isPO?'local_shipping':'inventory'}</span>
              </div>
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-headline-sm text-[13px] font-bold text-on-surface truncate">${isPO?'Supplier Order':'Delivery Checked'}: ${a.id}</span>
                  <span class="font-label-metric text-[9px] uppercase px-1.5 py-0.5 rounded ${statusChip(a.status||'')} font-bold">${a.status||'Done'}</span>
                </div>
                <span class="font-body-sm text-[11px] text-on-surface-variant truncate">${mat?esc(mat.name):'—'} ${sup?'• '+esc(sup.name):''}</span>
              </div>
            </div>
            <span class="font-label-metric text-[10px] text-on-surface-variant flex-shrink-0">${a._date}</span>
          </div>`;
        }).join('')}
      </div>

      <!-- ── Data actions ───────────────────────────────── -->
      <div class="flex gap-3 pt-1">
        <button onclick="loadSampleData()" class="flex-1 py-3 rounded-xl bg-surface-container-high text-on-surface-variant font-label-metric text-[12px] font-semibold flex items-center justify-center gap-2 hover:bg-surface-variant active:scale-95 transition-all border border-outline-variant">
          <span class="material-symbols-outlined text-[16px] text-primary">download</span> Load Sample Data
        </button>
        <button onclick="resetData()" class="py-3 px-4 rounded-xl bg-error-container/30 text-error font-label-metric text-[12px] font-semibold flex items-center justify-center gap-2 hover:bg-error-container/50 active:scale-95 transition-all border border-error/20">
          <span class="material-symbols-outlined text-[16px]">delete_forever</span> Reset
        </button>
      </div>
    `;
  } catch(e) {
    pg.innerHTML = errPage('dashboard', e.message);
  } finally {
    hideLoading();
  }
}

// ══════════════════════════════════════════════════════════════
// PRODUCTS / ITEMS
// ══════════════════════════════════════════════════════════════
async function renderProducts() {
  const pg = document.getElementById('page-products');
  pg.innerHTML = `<div class="flex items-center justify-center h-40 w-full"><div class="w-8 h-8 rounded-full border-[3px] border-outline-variant border-t-primary animate-spin"></div></div>`;
  showLoading();
  try {
    const [mats, sups] = await Promise.all([getAllDocs('materials'), getAllDocs('suppliers')]);
    Object.assign(_c, { materials:mats, suppliers:sups });

    const totalItems = mats.length;
    const lowStockCount = mats.filter(m => Number(m.stock) <= Number(m.minStock)).length;
    const invValue = mats.reduce((s,m) => s + Number(m.stock)*Number(m.price), 0);
    const cats = [...new Set(mats.map(m=>m.category).filter(Boolean))];

    pg.innerHTML = `
      <!-- Hero summary card -->
      <div class="relative w-full px-margin pt-space-md pb-space-md">
        <div class="relative overflow-hidden rounded-xl bg-surface-container-low p-space-md shadow-xl mb-space-md">
          <div class="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-primary/10 blur-3xl pointer-events-none"></div>
          <div class="flex items-center justify-between mb-space-sm">
            <div class="flex items-center gap-space-xs">
              <span class="inline-flex w-2 h-2 rounded-full bg-primary animate-ping"></span>
              <span class="font-label-metric text-label-metric text-primary uppercase tracking-wider">Live Stock Status</span>
            </div>
            <span class="font-label-metric text-label-metric text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">Updated</span>
          </div>
          <div class="grid grid-cols-3 gap-space-xs pt-space-xs">
            <div class="flex flex-col p-2.5 rounded-lg bg-surface-container/60">
              <div class="flex items-center gap-1 text-secondary mb-1">
                <span class="material-symbols-outlined text-[16px]">inventory</span>
                <span class="font-label-metric text-label-metric text-on-surface-variant uppercase text-[9px]">Total Items</span>
              </div>
              <span class="font-headline-sm text-headline-sm text-on-surface font-bold">${totalItems}</span>
              <span class="font-label-code text-label-code text-primary mt-0.5 font-medium">in store</span>
            </div>
            <div class="flex flex-col p-2.5 rounded-lg bg-surface-container/60">
              <div class="flex items-center gap-1 text-primary mb-1">
                <span class="material-symbols-outlined text-[16px]">payments</span>
                <span class="font-label-metric text-label-metric text-on-surface-variant uppercase text-[9px]">Stock Value</span>
              </div>
              <span class="font-headline-sm text-[15px] text-on-surface font-bold">₹${invValue>=100000?(invValue/100000).toFixed(1)+'L':fmt(invValue)}</span>
              <span class="font-label-code text-label-code text-on-surface-variant mt-0.5">Worth</span>
            </div>
            <div class="flex flex-col p-2.5 rounded-lg bg-surface-container/60">
              <div class="flex items-center gap-1 text-tertiary mb-1">
                <span class="material-symbols-outlined text-[16px]">warning</span>
                <span class="font-label-metric text-label-metric text-tertiary uppercase text-[9px]">Running Low</span>
              </div>
              <span class="font-headline-sm text-headline-sm ${lowStockCount>0?'text-tertiary':'text-primary'} font-bold">${lowStockCount}</span>
              <span class="font-label-code text-label-code text-error mt-0.5 font-medium">${lowStockCount>0?'Need to Buy':'All OK'}</span>
            </div>
          </div>
        </div>

        <!-- Search -->
        <div class="relative w-full mb-space-sm">
          <div class="flex items-center bg-surface-container-low rounded-xl px-3.5 py-1.5 shadow-md border border-outline-variant">
            <span class="material-symbols-outlined text-on-surface-variant text-[22px] mr-2">search</span>
            <input class="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none"
              id="prod-search" placeholder="Search items by name or category…" type="text" oninput="filterProducts()">
          </div>
        </div>

        <!-- Filter pills -->
        <div class="flex items-center gap-space-xs overflow-x-auto pb-space-sm pt-0.5 no-scrollbar">
          <button class="filter-pill flex-shrink-0 px-3.5 py-1.5 rounded-full font-label-metric text-label-metric bg-primary text-on-primary font-semibold shadow-sm active:scale-95 transition-all" data-filter="all">
            All Items (${totalItems})
          </button>
          <button class="filter-pill flex-shrink-0 px-3.5 py-1.5 rounded-full font-label-metric text-label-metric bg-surface-container-low text-tertiary font-medium hover:bg-surface-container active:scale-95 transition-colors flex items-center gap-1" data-filter="low">
            <span class="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
            Running Low (${lowStockCount})
          </button>
          ${cats.slice(0,4).map(c=>`
          <button class="filter-pill flex-shrink-0 px-3.5 py-1.5 rounded-full font-label-metric text-label-metric bg-surface-container-low text-on-surface-variant font-medium hover:bg-surface-container active:scale-95 transition-colors" data-filter="${esc(c)}">
            ${esc(c)}
          </button>`).join('')}
        </div>

        <!-- List header -->
        <div class="flex items-center justify-between mt-space-sm mb-space-sm px-0.5">
          <div class="flex items-center gap-1.5">
            <span class="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">Stock List</span>
            <span id="prod-count-badge" class="font-label-metric text-label-metric bg-surface-container-high text-secondary px-2 py-0.5 rounded-full">${totalItems} Items</span>
          </div>
        </div>

        <!-- Item cards -->
        <div class="flex flex-col gap-space-md" id="prod-list">
          ${renderItemCards(mats, sups)}
        </div>
      </div>

      <!-- Floating Add button -->
      <div class="fixed bottom-20 right-4 z-40">
        <button onclick="openProductModal()" class="flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline-sm text-[15px] font-bold shadow-xl shadow-primary/25 active:scale-95 transition-transform">
          <span class="material-symbols-outlined text-[24px]">add</span>
          <span class="tracking-tight">Add New Item</span>
        </button>
      </div>
    `;

    // Filter pills interaction
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => {
          p.classList.remove('bg-primary','text-on-primary','font-semibold','shadow-sm');
          p.classList.add('bg-surface-container-low','text-on-surface-variant','font-medium');
        });
        pill.classList.remove('bg-surface-container-low','text-on-surface-variant','font-medium');
        pill.classList.add('bg-primary','text-on-primary','font-semibold','shadow-sm');
        _activeFilter = pill.dataset.filter;
        filterProducts();
      });
    });

  } catch(e) { pg.innerHTML = errPage('products', e.message); }
  finally    { hideLoading(); }
}

let _activeFilter = 'all';

function filterProducts() {
  const query  = (document.getElementById('prod-search')?.value||'').toLowerCase();
  const filter = _activeFilter;
  const list   = document.getElementById('prod-list');
  if (!list) return;
  const cards = list.querySelectorAll('[data-mat-id]');
  let shown = 0;
  cards.forEach(card => {
    const name  = (card.dataset.matName||'').toLowerCase();
    const cat   = (card.dataset.matCat||'').toLowerCase();
    const isLow = card.dataset.matLow === 'true';
    const matchQ = !query || name.includes(query) || cat.includes(query);
    const matchF = filter === 'all' || (filter === 'low' && isLow) || cat === filter.toLowerCase();
    const visible = matchQ && matchF;
    card.classList.toggle('hidden', !visible);
    if (visible) shown++;
  });
  const badge = document.getElementById('prod-count-badge');
  if (badge) badge.textContent = shown + ' Items';
}
window.filterProducts = filterProducts;

function renderItemCards(mats, sups) {
  if (!mats.length) return `
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <span class="material-symbols-outlined text-[48px] text-on-surface-variant mb-3">inventory_2</span>
      <p class="font-headline-sm text-[16px] text-on-surface-variant">No items yet.</p>
      <p class="font-body-sm text-on-surface-variant mt-1">Tap "Add New Item" to get started.</p>
    </div>`;

  return mats.map(m => {
    const isLow = Number(m.stock) <= Number(m.minStock);
    const pct   = stockPct(m.stock, m.minStock);
    const sup   = sups.find(s=>s.id===m.supplierId);
    return `
    <div class="group relative flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-md ${isLow?'shadow-error/10':'shadow-sm'} transition-all hover:shadow-lg"
      data-mat-id="${m.id}" data-mat-name="${esc(m.name)}" data-mat-cat="${esc(m.category||'')}" data-mat-low="${isLow}">
      <div class="flex items-start justify-between gap-space-sm mb-space-xs">
        <div class="flex items-center gap-space-sm min-w-0">
          <div class="w-12 h-12 rounded-lg bg-surface-container-highest flex-shrink-0 flex items-center justify-center overflow-hidden ${isLow?'bg-error-container/30 text-error':'bg-primary/10 text-primary'}">
            <span class="material-symbols-outlined text-[24px] leading-none select-none">${catIcon(m.category)}</span>
          </div>
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-label-code text-label-code ${isLow?'text-error':'text-primary'} font-bold">${m.id}</span>
              <span class="font-label-metric text-label-metric px-1.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">${esc(m.category||'General')}</span>
            </div>
            <h3 class="font-headline-sm text-headline-sm text-on-surface font-semibold truncate mt-0.5">${esc(m.name)}</h3>
          </div>
        </div>
        <div class="flex items-center gap-1 px-2.5 py-1 rounded-full ${isLow?'bg-error-container/40 text-error':'bg-primary/10 text-primary'} flex-shrink-0">
          ${isLow?'<span class="w-2 h-2 rounded-full bg-error animate-ping"></span>':'<span class="w-1.5 h-1.5 rounded-full bg-primary"></span>'}
          <span class="font-label-metric text-label-metric font-bold uppercase tracking-wider">${isLow?'Almost Finished':'In Stock'}</span>
        </div>
      </div>

      <!-- Stock bar -->
      <div class="my-space-xs p-2.5 rounded-lg ${isLow?'bg-error-container/15':'bg-surface-container/70'}">
        <div class="flex items-center justify-between mb-1.5 font-label-code text-label-code">
          <div class="flex items-center gap-1">
            <span class="${isLow?'text-error font-semibold':'text-on-surface-variant'}">In Stock:</span>
            <span class="${isLow?'text-error font-bold':'text-on-surface font-bold'}">${fmtQty(m.stock)} ${m.unit}</span>
          </div>
          <div class="text-on-surface-variant">Min: <span class="text-on-surface font-semibold">${fmtQty(m.minStock)} ${m.unit}</span></div>
        </div>
        <div class="relative w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
          <div class="h-full rounded-full ${isLow?'bg-error':'bg-gradient-to-r from-primary-container to-primary'}" style="width:${pct}%"></div>
        </div>
        <div class="flex justify-between items-center mt-1 text-[10px] font-label-metric ${isLow?'text-error':'text-on-surface-variant'}">
          <span>${isLow?'Short by '+fmtQty(Number(m.minStock)-Number(m.stock))+' '+m.unit:'Safe — '+fmtQty(Number(m.stock)-Number(m.minStock))+' extra'}</span>
          <span class="text-on-surface-variant">Unit: ${esc(m.unit)}</span>
        </div>
      </div>

      <!-- Supplier & Price -->
      <div class="grid grid-cols-2 gap-space-xs my-space-xs pt-1">
        <div class="flex flex-col">
          <span class="font-label-metric text-label-metric text-on-surface-variant uppercase">Supplier</span>
          <span class="font-body-sm text-body-sm text-on-surface font-medium truncate mt-0.5">${sup?esc(sup.name):'—'}</span>
        </div>
        <div class="flex flex-col text-right">
          <span class="font-label-metric text-label-metric text-on-surface-variant uppercase">Price per ${esc(m.unit)}</span>
          <span class="font-label-code text-label-code text-on-surface font-bold mt-0.5">₹${fmt(m.price)}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between gap-space-xs pt-space-sm mt-space-xs border-t border-outline-variant/30">
        <button onclick="openProductModal('${m.id}')" class="flex items-center justify-center gap-1 flex-1 py-2 rounded-lg bg-surface-container-high text-on-surface text-body-sm font-medium hover:bg-surface-variant active:scale-95 transition-all">
          <span class="material-symbols-outlined text-[16px] text-secondary">edit</span><span>Edit</span>
        </button>
        <button onclick="openPOFormForMaterial('${m.id}')" class="flex items-center justify-center gap-1 flex-1 py-2 rounded-lg bg-primary/15 text-primary hover:bg-primary hover:text-on-primary text-body-sm font-bold active:scale-95 transition-all border border-primary/25">
          <span class="material-symbols-outlined text-[16px]">local_shipping</span><span>Order</span>
        </button>
        ${isLow ? `
        <button onclick="openPRFormForMaterial('${m.id}')" class="flex items-center justify-center gap-1 flex-1 py-2 rounded-lg bg-tertiary/15 text-tertiary hover:bg-tertiary hover:text-on-tertiary text-body-sm font-semibold active:scale-95 transition-all border border-tertiary/25">
          <span class="material-symbols-outlined text-[16px]">bolt</span><span>Request</span>
        </button>` : `
        <button onclick="openPRFormForMaterial('${m.id}')" class="flex items-center justify-center gap-1 flex-1 py-2 rounded-lg bg-surface-container-high text-on-surface text-body-sm font-medium hover:bg-surface-variant active:scale-95 transition-all">
          <span class="material-symbols-outlined text-[16px] text-primary">add_shopping_cart</span><span>Request</span>
        </button>`}
        <button onclick="deleteProduct('${m.id}')" class="flex items-center justify-center w-9 h-9 rounded-lg bg-error-container/20 text-error hover:bg-error-container/40 active:scale-95 transition-all flex-shrink-0">
          <span class="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// SUPPLIERS
// ══════════════════════════════════════════════════════════════
async function renderSuppliers() {
  const pg = document.getElementById('page-suppliers');
  showLoading();
  try {
    const sups = await getAllDocs('suppliers');
    _c.suppliers = sups;
    pg.innerHTML = `
      <div class="flex items-center justify-between">
        <h2 class="font-headline-sm text-headline-sm font-bold">Suppliers <span class="font-label-metric text-label-metric text-on-surface-variant">(${sups.length})</span></h2>
        <button onclick="openSupplierModal()" class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary font-label-metric text-label-metric font-bold active:scale-95 transition-all shadow-md">
          <span class="material-symbols-outlined text-[16px]">add</span> Add Supplier
        </button>
      </div>
      ${sups.length===0 ? `
      <div class="flex flex-col items-center py-16 text-center">
        <span class="material-symbols-outlined text-[48px] text-on-surface-variant mb-3">factory</span>
        <p class="font-body-md text-on-surface-variant">No suppliers yet. Add your first one!</p>
        <button onclick="openSupplierModal()" class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary font-label-metric text-[12px] font-bold mt-4 shadow-md active:scale-95 transition-all">
          <span class="material-symbols-outlined text-[16px]">add</span> Add First Supplier
        </button>
      </div>` :
      sups.map(s=>`
      <div class="relative flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-md">
        <div class="flex items-start justify-between gap-2 mb-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-11 h-11 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary flex-shrink-0">
              <span class="material-symbols-outlined text-[22px]">factory</span>
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-label-code text-label-code text-secondary font-bold">${s.id}</span>
              <h3 class="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">${esc(s.name)}</h3>
            </div>
          </div>
          <button onclick="openSupplierModal('${s.id}')" class="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-variant active:scale-95 transition-all flex-shrink-0">
            <span class="material-symbols-outlined text-[18px]">edit</span>
          </button>
        </div>
        <div class="flex flex-col gap-1.5 p-2.5 rounded-lg bg-surface-container/60">
          <div class="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <span class="material-symbols-outlined text-[16px] text-primary">call</span>
            <span>${esc(s.phone)}</span>
          </div>
          <div class="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <span class="material-symbols-outlined text-[16px] text-secondary">mail</span>
            <span class="truncate">${esc(s.email)}</span>
          </div>
        </div>
      </div>`).join('')}

      <!-- Floating Add button -->
      <div class="fixed bottom-20 right-4 z-40">
        <button onclick="openSupplierModal()" class="flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline-sm text-[15px] font-bold shadow-xl shadow-primary/25 active:scale-95 transition-transform">
          <span class="material-symbols-outlined text-[24px]">add</span>
          <span class="tracking-tight">Add Supplier</span>
        </button>
      </div>
    `;
  } catch(e) { pg.innerHTML = errPage('suppliers', e.message); }
  finally    { hideLoading(); }
}

// ══════════════════════════════════════════════════════════════
// PR / REQUESTS
// ══════════════════════════════════════════════════════════════
async function renderPR() {
  const pg = document.getElementById('page-pr');
  showLoading();
  try {
    const [prs, mats] = await Promise.all([getAllDocs('purchaseRequisitions'), getAllDocs('materials')]);
    Object.assign(_c, { prs, materials:mats });
    const sorted = [...prs].sort((a,b)=>b.id.localeCompare(a.id));

    pg.innerHTML = `
      <div class="flex items-center justify-between">
        <h2 class="font-headline-sm text-headline-sm font-bold">Item Requests <span class="font-label-metric text-label-metric text-on-surface-variant">(${prs.length})</span></h2>
        <button onclick="openPRModal()" class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary font-label-metric text-label-metric font-bold active:scale-95 transition-all shadow-md">
          <span class="material-symbols-outlined text-[16px]">add</span> New Request
        </button>
      </div>

      <!-- Status summary strip -->
      <div class="grid grid-cols-3 gap-2 p-2 rounded-xl bg-surface-container-low">
        ${[
          { label: 'Pending',  cnt: prs.filter(p=>p.status==='Pending').length,  color: 'text-tertiary' },
          { label: 'Approved', cnt: prs.filter(p=>p.status==='Approved').length, color: 'text-primary' },
          { label: 'Rejected', cnt: prs.filter(p=>p.status==='Rejected').length, color: 'text-error' },
        ].map(st => `
          <div class="flex flex-col items-center py-1.5">
            <span class="font-headline-sm text-[22px] font-bold ${st.color} leading-none">${st.cnt}</span>
            <span class="font-label-metric text-[10px] text-on-surface-variant uppercase mt-1 tracking-wider">${st.label}</span>
          </div>
        `).join('')}
      </div>

      ${sorted.length===0 ? `
      <div class="flex flex-col items-center py-16 text-center">
        <span class="material-symbols-outlined text-[48px] text-on-surface-variant mb-3">assignment</span>
        <p class="font-body-md text-on-surface-variant">No requests yet. Create one when stock is low!</p>
        <button onclick="openPRModal()" class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary font-label-metric text-[12px] font-bold mt-4 shadow-md active:scale-95 transition-all">
          <span class="material-symbols-outlined text-[16px]">add</span> Create First Request
        </button>
      </div>` :
      sorted.map(pr => {
        const mat = mats.find(m=>m.id===pr.materialId);
        return `
        <div class="flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-md">
          <div class="flex items-start justify-between gap-2 mb-3">
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-label-code text-label-code text-on-surface-variant font-bold">${pr.id}</span>
                <span class="font-label-metric text-[10px] px-2 py-0.5 rounded-full font-bold ${statusChip(pr.status)}">${pr.status}</span>
              </div>
              <h3 class="font-headline-sm text-[15px] text-on-surface font-semibold">${mat?esc(mat.name):pr.materialId}</h3>
              <p class="font-body-sm text-[12px] text-on-surface-variant mt-0.5">Qty: ${fmtQty(pr.qty)} ${mat?.unit||'units'} · Reason: ${esc(pr.reason)}</p>
            </div>
            <span class="font-label-code text-[10px] text-on-surface-variant flex-shrink-0 mt-1">${pr.date}</span>
          </div>
          ${pr.status==='Pending'?`
          <div class="flex gap-2 pt-2 border-t border-outline-variant/30">
            <button onclick="updatePRStatus('${pr.id}','Approved')" class="flex-1 py-2 rounded-lg bg-primary/15 text-primary font-label-metric text-label-metric font-bold flex items-center justify-center gap-1 hover:bg-primary/25 active:scale-95 transition-all">
              <span class="material-symbols-outlined text-[16px]">check_circle</span> Approve Request
            </button>
            <button onclick="updatePRStatus('${pr.id}','Rejected')" class="flex-1 py-2 rounded-lg bg-error/10 text-error font-label-metric text-label-metric font-bold flex items-center justify-center gap-1 hover:bg-error/20 active:scale-95 transition-all">
              <span class="material-symbols-outlined text-[16px]">cancel</span> Reject
            </button>
          </div>`:
          pr.status==='Approved'?`
          <div class="flex items-center justify-between pt-2 border-t border-outline-variant/30">
            <p class="font-label-metric text-[11px] text-primary flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">check_circle</span>Approved request
            </p>
            <button onclick="openPOModalForPR('${pr.id}')" class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-metric text-[11px] font-bold active:scale-95 transition-all shadow-sm">
              <span class="material-symbols-outlined text-[14px]">local_shipping</span>
              <span>Create Order</span>
            </button>
          </div>`:''
          }
        </div>`;
      }).join('')}

      <!-- Floating New Request button -->
      <div class="fixed bottom-20 right-4 z-40">
        <button onclick="openPRModal()" class="flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline-sm text-[15px] font-bold shadow-xl shadow-primary/25 active:scale-95 transition-transform">
          <span class="material-symbols-outlined text-[24px]">add</span>
          <span class="tracking-tight">New Request</span>
        </button>
      </div>
    `;
  } catch(e) { pg.innerHTML = errPage('pr', e.message); }
  finally    { hideLoading(); }
}

// ══════════════════════════════════════════════════════════════
// PO / ORDERS
// ══════════════════════════════════════════════════════════════
async function renderPO() {
  const pg = document.getElementById('page-po');
  showLoading();
  try {
    const [pos, prs, mats, sups] = await Promise.all([
      getAllDocs('purchaseOrders'), getAllDocs('purchaseRequisitions'),
      getAllDocs('materials'),      getAllDocs('suppliers'),
    ]);
    Object.assign(_c, { pos, prs, materials:mats, suppliers:sups });

    const availPRs = prs.filter(pr=>pr.status==='Approved' && !pos.some(po=>po.prId===pr.id));
    const sorted   = [...pos].sort((a,b)=>b.id.localeCompare(a.id));

    pg.innerHTML = `
      <div class="flex items-center justify-between">
        <h2 class="font-headline-sm text-headline-sm font-bold">Supplier Orders <span class="font-label-metric text-label-metric text-on-surface-variant">(${pos.length})</span></h2>
        <button onclick="openPOModal()" class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary font-label-metric text-label-metric font-bold active:scale-95 transition-all shadow-md shadow-primary/20 hover:opacity-95 cursor-pointer">
          <span class="material-symbols-outlined text-[16px]">add</span> Create Order
        </button>
      </div>

      ${availPRs.length>0?`
      <div class="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/25">
        <span class="material-symbols-outlined text-primary text-[20px]">bolt</span>
        <div class="flex-1 min-w-0">
          <p class="font-label-metric text-[12px] text-on-surface font-bold">${availPRs.length} approved request(s) ready to order from supplier</p>
        </div>
        <button onclick="openPOModal()" class="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-metric text-[11px] font-bold active:scale-95 transition-all flex-shrink-0">Order Now</button>
      </div>`:''}

      ${sorted.length===0 ? `
      <div class="flex flex-col items-center py-16 text-center">
        <div class="w-16 h-16 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center mb-3">
          <span class="material-symbols-outlined text-[32px]">local_shipping</span>
        </div>
        <p class="font-headline-sm text-[16px] text-on-surface font-semibold mb-1">No orders yet</p>
        <p class="font-body-sm text-on-surface-variant mb-4">Tap "Create Order" to place your first supplier order directly or from an approved request.</p>
        <button onclick="openPOModal()" class="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-metric text-[13px] font-bold shadow-md shadow-primary/25 active:scale-95 transition-all">
          <span class="material-symbols-outlined text-[18px]">add</span>
          <span>Create First Order</span>
        </button>
      </div>` :
      sorted.map(po => {
        const mat = mats.find(m=>m.id===po.materialId);
        const sup = sups.find(s=>s.id===po.supplierId);
        const rem = Number(po.orderedQty) - Number(po.receivedQty);
        return `
        <div class="flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-md">
          <div class="flex items-start justify-between gap-2 mb-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary flex-shrink-0">
                <span class="material-symbols-outlined text-[20px]">local_shipping</span>
              </div>
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                  <span class="font-label-code text-label-code text-on-surface-variant font-bold">${po.id}</span>
                  <span class="font-label-metric text-[10px] px-2 py-0.5 rounded-full font-bold ${statusChip(po.status)}">${po.status}</span>
                </div>
                <h3 class="font-headline-sm text-[15px] text-on-surface font-semibold truncate">${mat?esc(mat.name):po.materialId}</h3>
                <p class="font-body-sm text-[12px] text-on-surface-variant">Request: ${po.prId} · ${sup?esc(sup.name):'—'}</p>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-surface-container/60">
            <div class="flex flex-col items-center">
              <span class="font-label-metric text-[10px] text-on-surface-variant uppercase">Ordered</span>
              <span class="font-label-code text-[14px] text-on-surface font-bold">${fmtQty(po.orderedQty)}</span>
            </div>
            <div class="flex flex-col items-center border-x border-outline-variant/30">
              <span class="font-label-metric text-[10px] text-on-surface-variant uppercase">Received</span>
              <span class="font-label-code text-[14px] text-primary font-bold">${fmtQty(po.receivedQty)}</span>
            </div>
            <div class="flex flex-col items-center">
              <span class="font-label-metric text-[10px] text-on-surface-variant uppercase">Remaining</span>
              <span class="font-label-code text-[14px] ${rem>0?'text-tertiary':'text-primary'} font-bold">${fmtQty(rem)}</span>
            </div>
          </div>
          <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-outline-variant/30 font-body-sm text-[11px] text-on-surface-variant flex-wrap gap-2">
            <div>
              <span>₹${fmt(po.price)}/${mat?.unit||'unit'}</span>
              <span class="mx-1 text-on-surface-variant/40">·</span>
              <span class="text-on-surface font-semibold">Total: ₹${fmt(po.price * po.orderedQty)}</span>
            </div>
            <div class="flex items-center gap-2">
              ${rem > 0 ? `
              <button onclick="openGRNModalForPO('${po.id}')" class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary/15 text-secondary hover:bg-secondary hover:text-on-secondary font-label-metric text-[11px] font-bold active:scale-95 transition-all border border-secondary/25">
                <span class="material-symbols-outlined text-[14px]">inventory</span>
                <span>Receive</span>
              </button>` : ''}
              <button onclick="viewInvoice('${po.id}')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary hover:text-on-primary font-label-metric text-[11px] font-bold active:scale-95 transition-all border border-primary/25">
                <span class="material-symbols-outlined text-[15px]">receipt_long</span>
                <span>Tax Invoice</span>
              </button>
            </div>
          </div>
        </div>`;
      }).join('')}

      <!-- Floating Create Order button -->
      <div class="fixed bottom-20 right-4 z-40">
        <button onclick="openPOModal()" class="flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline-sm text-[15px] font-bold shadow-xl shadow-primary/25 active:scale-95 transition-transform">
          <span class="material-symbols-outlined text-[24px]">add</span>
          <span class="tracking-tight">Create Order</span>
        </button>
      </div>
    `;
  } catch(e) { pg.innerHTML = errPage('po', e.message); }
  finally    { hideLoading(); }
}

// ══════════════════════════════════════════════════════════════
// GRN / DELIVER CHECK
// ══════════════════════════════════════════════════════════════
async function renderGRN() {
  const pg = document.getElementById('page-grn');
  showLoading();
  try {
    const [grns, pos, mats] = await Promise.all([
      getAllDocs('goodsReceipts'), getAllDocs('purchaseOrders'), getAllDocs('materials'),
    ]);
    Object.assign(_c, { grns, pos, materials:mats });
    const sorted  = [...grns].sort((a,b)=>b.id.localeCompare(a.id));
    const openPOs = pos.filter(po=>po.status!=='Completed');

    pg.innerHTML = `
      <div class="flex items-center justify-between">
        <h2 class="font-headline-sm text-headline-sm font-bold">Delivery Check <span class="font-label-metric text-label-metric text-on-surface-variant">(${grns.length})</span></h2>
        <button onclick="openGRNModal()" ${openPOs.length===0?'disabled title="No open orders"':''} class="flex items-center gap-1.5 px-4 py-2 rounded-xl ${openPOs.length===0?'bg-surface-container text-on-surface-variant':'bg-primary text-on-primary'} font-label-metric text-label-metric font-bold active:scale-95 transition-all shadow-md">
          <span class="material-symbols-outlined text-[16px]">add</span> Record Delivery
        </button>
      </div>

      <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/40">
        <div class="flex items-center gap-2 font-body-sm text-[12px] text-on-surface-variant">
          <span class="material-symbols-outlined text-primary text-[18px]">info</span>
          When goods arrive from the supplier, record how many you received here. Stock updates automatically.
        </div>
      </div>

      ${sorted.length===0 ? `
      <div class="flex flex-col items-center py-16 text-center">
        <span class="material-symbols-outlined text-[48px] text-on-surface-variant mb-3">inventory</span>
        <p class="font-body-md text-on-surface-variant">No deliveries recorded yet.</p>
        <p class="font-body-sm text-on-surface-variant mt-1 mb-4">Create a Supplier Order first, then record its delivery here.</p>
        <button onclick="navigate('po');setTimeout(() => openPOModal(), 100)" class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary font-label-metric text-[12px] font-bold shadow-md active:scale-95 transition-all">
          <span class="material-symbols-outlined text-[16px]">local_shipping</span> Create Supplier Order
        </button>
      </div>` :
      sorted.map(g => {
        const po  = pos.find(p=>p.id===g.poId);
        const mat = po ? mats.find(m=>m.id===po.materialId) : null;
        const net = Number(g.receivedQty) - Number(g.damagedQty);
        return `
        <div class="flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-md">
          <div class="flex items-start justify-between gap-2 mb-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary flex-shrink-0">
                <span class="material-symbols-outlined text-[20px]">inventory</span>
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-label-code text-label-code text-on-surface-variant font-bold">${g.id}</span>
                <h3 class="font-headline-sm text-[15px] text-on-surface font-semibold truncate">${mat?esc(mat.name):'—'}</h3>
                <p class="font-body-sm text-[12px] text-on-surface-variant">Order: ${g.poId}</p>
              </div>
            </div>
            <span class="font-label-code text-[11px] text-on-surface-variant flex-shrink-0 mt-1">${g.date}</span>
          </div>
          <div class="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-surface-container/60">
            <div class="flex flex-col items-center">
              <span class="font-label-metric text-[10px] text-on-surface-variant uppercase">Received</span>
              <span class="font-label-code text-[14px] text-primary font-bold">${fmtQty(g.receivedQty)}</span>
            </div>
            <div class="flex flex-col items-center border-x border-outline-variant/30">
              <span class="font-label-metric text-[10px] text-on-surface-variant uppercase">Damaged</span>
              <span class="font-label-code text-[14px] ${Number(g.damagedQty)>0?'text-error':'text-on-surface-variant'} font-bold">${fmtQty(g.damagedQty)}</span>
            </div>
            <div class="flex flex-col items-center">
              <span class="font-label-metric text-[10px] text-on-surface-variant uppercase">Added to Stock</span>
              <span class="font-label-code text-[14px] text-on-surface font-bold">${fmtQty(net)}</span>
            </div>
          </div>
          <div class="flex items-center justify-between mt-2.5 pt-2 border-t border-outline-variant/30 text-[11px] text-on-surface-variant font-body-sm">
            <span>Order Ref: <strong class="text-on-surface">${g.poId}</strong></span>
            <button onclick="viewInvoice('${g.poId}')" class="flex items-center gap-1 text-primary hover:underline font-label-metric text-[11px] font-bold">
              <span class="material-symbols-outlined text-[14px]">receipt_long</span>
              <span>View Tax Invoice</span>
            </button>
          </div>
        </div>`;
      }).join('')}

      <!-- Floating Record Delivery button -->
      <div class="fixed bottom-20 right-4 z-40">
        <button onclick="openGRNModal()" class="flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline-sm text-[15px] font-bold shadow-xl shadow-primary/25 active:scale-95 transition-transform">
          <span class="material-symbols-outlined text-[24px]">add</span>
          <span class="tracking-tight">Record Delivery</span>
        </button>
      </div>
    `;
  } catch(e) { pg.innerHTML = errPage('grn', e.message); }
  finally    { hideLoading(); }
}

// ══════════════════════════════════════════════════════════════
// MODAL FORMS (inline-error helper)
// ══════════════════════════════════════════════════════════════
const formErrEl = id => document.getElementById(id);
const showFErr = (id, msg) => {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
};

function formInput(id, label, type='text', placeholder='', value='', extra='') {
  return `
  <div class="mb-4">
    <label class="font-label-metric text-[11px] text-on-surface-variant uppercase tracking-wider block mb-1.5">${label}</label>
    <input id="${id}" type="${type}" placeholder="${placeholder}" value="${esc(value)}" ${extra}
      class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:border-primary focus:bg-surface-container-high transition-all">
  </div>`;
}

function formSelect(id, label, options, selectedVal='') {
  return `
  <div class="mb-4">
    <label class="font-label-metric text-[11px] text-on-surface-variant uppercase tracking-wider block mb-1.5">${label}</label>
    <select id="${id}" class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary focus:bg-surface-container-high transition-all">
      ${options.map(o=>`<option value="${esc(o.value)}" ${o.value===selectedVal?'selected':''}>${esc(o.label)}</option>`).join('')}
    </select>
  </div>`;
}

function errBox(id) {
  return `<div id="${id}" class="hidden mb-4 p-3 rounded-xl bg-error-container/40 border border-error/25 text-error font-body-sm text-[13px]"></div>`;
}

// ══════════════════════════════════════════════════════════════
// PRODUCT MODAL
// ══════════════════════════════════════════════════════════════
let _editProductId = null;
function openProductModal(id) {
  _editProductId = id || null;
  const m   = id ? _c.materials.find(x=>x.id===id) : null;
  const sups = _c.suppliers;
  document.getElementById('modal-title').textContent = m ? 'Edit Item' : 'Add New Item';
  document.getElementById('modal-body').innerHTML = `
    ${formInput('p-name','Item Name *','text','e.g. Wireless Mouse',m?.name||'')}
    <div class="grid grid-cols-2 gap-3 mb-0">
      <div class="mb-4">
        <label class="font-label-metric text-[11px] text-on-surface-variant uppercase tracking-wider block mb-1.5">Category *</label>
        <input id="p-cat" type="text" placeholder="Electronics" value="${esc(m?.category||'')}"
          class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:border-primary transition-all">
      </div>
      <div class="mb-4">
        <label class="font-label-metric text-[11px] text-on-surface-variant uppercase tracking-wider block mb-1.5">Unit *</label>
        <input id="p-unit" type="text" placeholder="pcs" value="${esc(m?.unit||'')}"
          class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none focus:border-primary transition-all">
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3 mb-0">
      <div class="mb-4">
        <label class="font-label-metric text-[11px] text-on-surface-variant uppercase tracking-wider block mb-1.5">Current Stock *</label>
        <input id="p-stock" type="number" min="0" placeholder="0" value="${m?.stock??''}"
          class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary transition-all">
      </div>
      <div class="mb-4">
        <label class="font-label-metric text-[11px] text-on-surface-variant uppercase tracking-wider block mb-1.5">Minimum Needed *</label>
        <input id="p-minstock" type="number" min="0" placeholder="0" value="${m?.minStock??''}"
          class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary transition-all">
      </div>
    </div>
    ${formInput('p-price','Price per Unit (₹) *','number','0.00',m?.price??'','min="0.01" step="0.01"')}
    ${formSelect('p-sup','Linked Supplier',[{value:'',label:'— No Supplier —'},...sups.map(s=>({value:s.id,label:s.name}))], m?.supplierId||'')}
    ${errBox('p-err')}
  `;
  document.getElementById('modal-save').onclick = saveProduct;
  openModal();
}

async function saveProduct() {
  const name     = document.getElementById('p-name').value.trim();
  const cat      = document.getElementById('p-cat').value.trim();
  const unit     = document.getElementById('p-unit').value.trim();
  const stock    = parseFloat(document.getElementById('p-stock').value);
  const minStock = parseFloat(document.getElementById('p-minstock').value);
  const price    = parseFloat(document.getElementById('p-price').value);
  const supId    = document.getElementById('p-sup').value;

  if (!name||!cat||!unit)          return showFErr('p-err','Fill in all required fields.');
  if (isNaN(stock)||stock<0)       return showFErr('p-err','Stock must be 0 or more.');
  if (isNaN(minStock)||minStock<0) return showFErr('p-err','Minimum Needed must be 0 or more.');
  if (isNaN(price)||price<=0)      return showFErr('p-err','Price must be greater than 0.');

  document.getElementById('modal-save').disabled = true;
  showLoading();
  try {
    if (_editProductId) {
      const old = _c.materials.find(x=>x.id===_editProductId);
      const diff = stock - Number(old?.stock||0);
      await updateDoc(doc(db,'materials',_editProductId), { name, category:cat, unit, stock, minStock, price, supplierId:supId });
      if (diff !== 0) await _writeMovement(_editProductId, diff>0?'IN':'OUT', Math.abs(diff), 'EDIT', stock);
      toast('Item updated ✓');
    } else {
      const id = await nextSeqId('materials','M',3);
      await setDoc(doc(db,'materials',id), { id, name, category:cat, unit, stock, minStock, price, supplierId:supId });
      if (stock>0) await _writeMovement(id,'IN',stock,'INITIAL',stock);
      toast('Item added ✓');
    }
    closeModal();
    renderProducts();
  } catch(e) {
    showFErr('p-err', e.message||'Save failed.');
    document.getElementById('modal-save').disabled = false;
  } finally { hideLoading(); }
}

async function _writeMovement(materialId, type, qty, refId, balanceAfter) {
  const movId = await nextSeqId('stockMovements','MOV-',4);
  await setDoc(doc(db,'stockMovements',movId), { id:movId, materialId, type, qty, refId, date:today(), balanceAfter });
}

function deleteProduct(id) {
  showConfirm('Delete Item','This will permanently delete this item. Cannot be undone.', async () => {
    showLoading();
    try {
      await deleteDoc(doc(db,'materials',id));
      toast('Item deleted.');
      renderProducts();
    } catch(e) { toast(e.message); }
    finally    { hideLoading(); }
  });
}

// ══════════════════════════════════════════════════════════════
// SUPPLIER MODAL
// ══════════════════════════════════════════════════════════════
let _editSuppId = null;
function openSupplierModal(id) {
  _editSuppId = id || null;
  const s = id ? _c.suppliers.find(x=>x.id===id) : null;
  document.getElementById('modal-title').textContent = s ? 'Edit Supplier' : 'Add Supplier';
  document.getElementById('modal-body').innerHTML = `
    ${formInput('s-name','Supplier Name *','text','e.g. TechParts Pvt Ltd',s?.name||'')}
    ${formInput('s-phone','Phone Number *','text','+91 98765 43210',s?.phone||'')}
    ${formInput('s-email','Email Address *','email','contact@supplier.com',s?.email||'')}
    ${errBox('s-err')}
  `;
  document.getElementById('modal-save').onclick = saveSupplier;
  openModal();
}

async function saveSupplier() {
  const name  = document.getElementById('s-name').value.trim();
  const phone = document.getElementById('s-phone').value.trim();
  const email = document.getElementById('s-email').value.trim();
  if (!name||!phone||!email)       return showFErr('s-err','All fields are required.');
  if (!/\S+@\S+\.\S+/.test(email)) return showFErr('s-err','Enter a valid email address.');

  document.getElementById('modal-save').disabled = true;
  showLoading();
  try {
    if (_editSuppId) {
      await updateDoc(doc(db,'suppliers',_editSuppId), { name, phone, email });
      toast('Supplier updated ✓');
    } else {
      const id = await nextSeqId('suppliers','S',3);
      await setDoc(doc(db,'suppliers',id), { id, name, phone, email });
      toast('Supplier added ✓');
    }
    closeModal();
    renderSuppliers();
  } catch(e) {
    showFErr('s-err', e.message||'Save failed.');
    document.getElementById('modal-save').disabled = false;
  } finally { hideLoading(); }
}

// ══════════════════════════════════════════════════════════════
// PR MODAL
// ══════════════════════════════════════════════════════════════
let _prPrefillMatId = null;
function openPRFormForMaterial(matId) {
  _prPrefillMatId = matId;
  navigate('pr');
  setTimeout(() => openPRModal(matId), 80);
}

function openPRModal(prefillMatId) {
  const fillId = prefillMatId || _prPrefillMatId || null;
  _prPrefillMatId = null;
  document.getElementById('modal-title').textContent = 'Create Item Request';
  document.getElementById('modal-body').innerHTML = `
    ${formSelect('pr-mat','Which Item do you Need? *',
      [{value:'',label:'— Select Item —'}, ..._c.materials.map(m=>({value:m.id,label:`${m.name} (${m.id})`}))],
      fillId||'')}
    ${formInput('pr-qty','How Many do you Need? *','number','e.g. 50','')}
    ${formInput('pr-reason','Why do you need it? *','text','e.g. Stock is running low','')}
    ${errBox('pr-err')}
  `;
  document.getElementById('modal-save').onclick = savePR;
  openModal();
}

async function savePR() {
  const matId  = document.getElementById('pr-mat').value;
  const qty    = parseFloat(document.getElementById('pr-qty').value);
  const reason = document.getElementById('pr-reason').value.trim();
  if (!matId)            return showFErr('pr-err','Please select an item.');
  if (isNaN(qty)||qty<1) return showFErr('pr-err','Quantity must be at least 1.');
  if (!reason)           return showFErr('pr-err','Please enter a reason.');

  document.getElementById('modal-save').disabled = true;
  showLoading();
  try {
    const id = await nextSeqId('purchaseRequisitions','PR-',4);
    await setDoc(doc(db,'purchaseRequisitions',id), { id, materialId:matId, qty, reason, status:'Pending', date:today() });
    toast('Request created ✓');
    closeModal();
    renderPR();
  } catch(e) {
    showFErr('pr-err', e.message||'Save failed.');
    document.getElementById('modal-save').disabled = false;
  } finally { hideLoading(); }
}

async function updatePRStatus(id, status) {
  showLoading();
  try {
    await updateDoc(doc(db,'purchaseRequisitions',id), { status });
    toast(`Request ${status} ✓`);
    renderPR();
  } catch(e) { toast(e.message); }
  finally    { hideLoading(); }
}

// ══════════════════════════════════════════════════════════════
// PO MODAL & HELPERS
// ══════════════════════════════════════════════════════════════
function openPOFormForMaterial(matId) {
  navigate('po');
  setTimeout(() => openPOModal(matId), 100);
}

function openPOModalForPR(prId) {
  navigate('po');
  setTimeout(() => openPOModal(null, prId), 100);
}

function openGRNModalForPO(poId) {
  navigate('grn');
  setTimeout(() => openGRNModal(poId), 100);
}

async function openPOModal(prefillMatId, prefillPrId) {
  // Ensure cached collections exist
  if (!_c.materials || !_c.materials.length || !_c.suppliers || !_c.suppliers.length) {
    try {
      const [mats, sups, prs, pos] = await Promise.all([
        getAllDocs('materials'), getAllDocs('suppliers'),
        getAllDocs('purchaseRequisitions'), getAllDocs('purchaseOrders')
      ]);
      Object.assign(_c, { materials:mats, suppliers:sups, prs, pos });
    } catch(e) {
      console.warn('Cache refresh in openPOModal:', e);
    }
  }

  const mats = _c.materials || [];
  let sups = _c.suppliers && _c.suppliers.length > 0
    ? _c.suppliers
    : [{ id: 'S001', name: 'BTPL Distribution Private Limited' }];
  _c.suppliers = sups;

  const availPRs = (_c.prs || []).filter(pr => pr.status === 'Approved' && !(_c.pos || []).some(po => po.prId === pr.id));
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  // Determine initial selection
  const targetMatId = prefillMatId || (mats.length > 0 ? mats[0].id : '__NEW__');
  const targetMat = mats.find(m => m.id === targetMatId);
  const defaultSupId = targetMat?.supplierId || sups[0]?.id || '';
  const defaultPrice = targetMat?.price || 150;

  document.getElementById('modal-title').textContent = 'Create Supplier Order';
  document.getElementById('modal-body').innerHTML = `
    ${availPRs.length > 0 ? `
    <div class="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/25">
      <label class="font-label-metric text-[11px] text-primary uppercase tracking-wider block mb-1.5 font-bold">Quick Link from Approved Request (Optional)</label>
      <select id="po-pr-select" class="w-full bg-surface-container border border-outline-variant rounded-xl px-3.5 py-2.5 text-on-surface text-[13px] focus:outline-none focus:border-primary">
        <option value="">— Select an Approved Request or choose item below —</option>
        ${availPRs.map(pr => {
          const m = mats.find(x => x.id === pr.materialId);
          return `<option value="${pr.id}" ${prefillPrId === pr.id ? 'selected' : ''}>${pr.id} · ${m ? esc(m.name) : pr.materialId} (Need: ${pr.qty})</option>`;
        }).join('')}
      </select>
    </div>` : ''}

    <div class="mb-4">
      <div class="flex items-center justify-between mb-1.5">
        <label class="font-label-metric text-[11px] text-on-surface-variant uppercase tracking-wider block">Select Item to Order *</label>
        <button type="button" id="po-toggle-new-item" class="text-primary hover:underline font-label-metric text-[11px] font-bold cursor-pointer">
          ${mats.length === 0 ? 'Entering New Item' : '+ Order New Item'}
        </button>
      </div>
      <select id="po-mat-select" class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary transition-all">
        ${mats.length === 0 ? `<option value="__NEW__">➕ New Item (No inventory items yet)</option>` : `
        <option value="">— Select Item from Inventory —</option>
        ${mats.map(m => `<option value="${m.id}" ${targetMatId === m.id ? 'selected' : ''}>${esc(m.name)} (${m.id}) · Stock: ${m.stock} ${esc(m.unit)}</option>`).join('')}
        <option value="__NEW__">➕ Add & Order New Item...</option>
        `}
      </select>
    </div>

    <!-- Container for new item on-the-fly -->
    <div id="po-new-item-box" class="${targetMatId === '__NEW__' ? '' : 'hidden'} p-3.5 mb-4 rounded-xl bg-surface-container-high/60 border border-primary/30">
      <span class="font-label-metric text-[11px] text-primary uppercase tracking-wider block mb-2 font-bold flex items-center gap-1">
        <span class="material-symbols-outlined text-[15px]">add_box</span> New Item Details
      </span>
      <div class="mb-3">
        <label class="font-label-metric text-[10px] text-on-surface-variant uppercase tracking-wider block mb-1">Item Name *</label>
        <input id="po-new-name" type="text" placeholder="e.g. Wireless Mouse"
          class="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-body-md text-[13px] focus:outline-none focus:border-primary">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="font-label-metric text-[10px] text-on-surface-variant uppercase tracking-wider block mb-1">Category</label>
          <input id="po-new-cat" type="text" placeholder="Electronics" value="General"
            class="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-body-md text-[13px] focus:outline-none focus:border-primary">
        </div>
        <div>
          <label class="font-label-metric text-[10px] text-on-surface-variant uppercase tracking-wider block mb-1">Unit</label>
          <input id="po-new-unit" type="text" placeholder="pcs" value="pcs"
            class="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface font-body-md text-[13px] focus:outline-none focus:border-primary">
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 mb-0">
      <div class="mb-4">
        <label class="font-label-metric text-[11px] text-on-surface-variant uppercase tracking-wider block mb-1.5">Quantity to Order *</label>
        <input id="po-qty" type="number" min="1" step="1" placeholder="e.g. 10" value="10"
          class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary transition-all">
      </div>
      <div class="mb-4">
        <label class="font-label-metric text-[11px] text-on-surface-variant uppercase tracking-wider block mb-1.5">Price per Unit (₹) *</label>
        <input id="po-price" type="number" min="0.01" step="0.01" placeholder="0.00" value="${defaultPrice}"
          class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary transition-all">
      </div>
    </div>

    <div class="mb-4">
      <label class="font-label-metric text-[11px] text-on-surface-variant uppercase tracking-wider block mb-1.5">Select Supplier *</label>
      <select id="po-sup-select" class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary transition-all">
        ${sups.map(s => `<option value="${s.id}" ${s.id === defaultSupId ? 'selected' : ''}>${esc(s.name)} (${s.id})</option>`).join('')}
      </select>
    </div>

    <div class="mb-4">
      <label class="font-label-metric text-[11px] text-on-surface-variant uppercase tracking-wider block mb-1.5">Expected Delivery Date *</label>
      <input id="po-date" type="date" value="${tomorrow}"
        class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary transition-all">
    </div>

    <div id="po-order-summary" class="mb-4 p-3 rounded-xl bg-surface-container border border-outline-variant/40 text-[12px] flex justify-between items-center">
      <span class="text-on-surface-variant font-medium">Estimated Order Total:</span>
      <span id="po-est-total" class="font-bold text-primary text-[15px]">₹${fmt(10 * defaultPrice)}</span>
    </div>

    ${errBox('po-err')}
  `;

  function updateEstTotal() {
    const q = parseFloat(document.getElementById('po-qty')?.value || 0);
    const p = parseFloat(document.getElementById('po-price')?.value || 0);
    const sumEl = document.getElementById('po-order-summary');
    const totEl = document.getElementById('po-est-total');
    if (q > 0 && p > 0) {
      sumEl?.classList.remove('hidden');
      if (totEl) totEl.textContent = '₹' + fmt(q * p);
    } else {
      sumEl?.classList.add('hidden');
    }
  }

  document.getElementById('po-qty')?.addEventListener('input', updateEstTotal);
  document.getElementById('po-price')?.addEventListener('input', updateEstTotal);

  const newBox = document.getElementById('po-new-item-box');
  const matSelect = document.getElementById('po-mat-select');

  document.getElementById('po-toggle-new-item')?.addEventListener('click', () => {
    if (matSelect) {
      matSelect.value = '__NEW__';
      newBox?.classList.remove('hidden');
    }
  });

  matSelect?.addEventListener('change', function() {
    if (this.value === '__NEW__') {
      newBox?.classList.remove('hidden');
      return;
    }
    newBox?.classList.add('hidden');
    const m = mats.find(x => x.id === this.value);
    if (m) {
      if (m.price) document.getElementById('po-price').value = m.price;
      if (m.supplierId) {
        const supSel = document.getElementById('po-sup-select');
        if (supSel) supSel.value = m.supplierId;
      }
      updateEstTotal();
    }
  });

  const prSelect = document.getElementById('po-pr-select');
  prSelect?.addEventListener('change', function() {
    const pr = availPRs.find(x => x.id === this.value);
    if (pr) {
      if (matSelect) matSelect.value = pr.materialId;
      newBox?.classList.add('hidden');
      const m = mats.find(x => x.id === pr.materialId);
      document.getElementById('po-qty').value = pr.qty;
      if (m?.price) document.getElementById('po-price').value = m.price;
      if (m?.supplierId) {
        const supSel = document.getElementById('po-sup-select');
        if (supSel) supSel.value = m.supplierId;
      }
      updateEstTotal();
    }
  });

  if (prefillPrId && prSelect) {
    prSelect.value = prefillPrId;
    prSelect.dispatchEvent(new Event('change'));
  }

  updateEstTotal();
  document.getElementById('modal-save').onclick = savePO;
  openModal();
}

async function savePO() {
  const prIdSelect = document.getElementById('po-pr-select');
  let prId         = prIdSelect ? prIdSelect.value : '';
  let matId        = document.getElementById('po-mat-select').value;
  const supId      = document.getElementById('po-sup-select').value;
  const qty        = parseFloat(document.getElementById('po-qty').value);
  const price      = parseFloat(document.getElementById('po-price').value);
  const expDate    = document.getElementById('po-date').value;

  if (isNaN(qty)||qty<1)  return showFErr('po-err','Quantity must be at least 1.');
  if (isNaN(price)||price<=0) return showFErr('po-err','Price must be greater than 0.');
  if (!supId)             return showFErr('po-err','Please select a supplier.');
  if (!expDate)           return showFErr('po-err','Please enter an expected delivery date.');

  // If ordering a new item on-the-fly, create it in inventory first
  if (matId === '__NEW__' || !matId) {
    const newName = document.getElementById('po-new-name')?.value.trim();
    const newCat  = document.getElementById('po-new-cat')?.value.trim() || 'General';
    const newUnit = document.getElementById('po-new-unit')?.value.trim() || 'pcs';
    if (!newName) return showFErr('po-err','Please enter the name for the new item.');

    try {
      showLoading();
      const newMatId = await nextSeqId('materials', 'M', 3);
      const newMat = {
        id: newMatId,
        name: newName,
        category: newCat,
        unit: newUnit,
        stock: 0,
        minStock: 10,
        price: price,
        supplierId: supId
      };
      await setDoc(doc(db, 'materials', newMatId), newMat);
      _c.materials = [newMat, ...(_c.materials || [])];
      matId = newMatId;
    } catch(e) {
      hideLoading();
      return showFErr('po-err', 'Failed to save new item: ' + e.message);
    }
  }

  // If no PR was selected, auto-create background request so workflow is tracked
  if (!prId) {
    try {
      prId = await nextSeqId('purchaseRequisitions','PR-',4);
      await setDoc(doc(db,'purchaseRequisitions',prId), {
        id: prId,
        materialId: matId,
        qty: qty,
        reason: 'Direct Supplier Order',
        status: 'Approved',
        date: today()
      });
      _c.prs = [{ id: prId, materialId: matId, qty, reason: 'Direct Supplier Order', status: 'Approved', date: today() }, ...(_c.prs || [])];
    } catch (_) {
      prId = 'DIR-' + Math.floor(1000 + Math.random() * 9000);
    }
  }

  document.getElementById('modal-save').disabled = true;
  showLoading();
  try {
    const id = await nextSeqId('purchaseOrders','PO-',4);
    const orderId = 'OD' + Math.floor(100000000000000000 + Math.random() * 900000000000000000);
    const invoiceNumber = 'FAJEMS' + new Date().getFullYear().toString().slice(-2) + String(Math.floor(10000000 + Math.random() * 90000000));
    const invDate = today().split('-').reverse().join('-');
    const newPO = {
      id, prId, supplierId:supId, materialId:matId,
      orderedQty:qty, receivedQty:0, price, expectedDate:expDate, status:'Created',
      orderId, invoiceNumber, invoiceDate:invDate, orderDate:invDate,
      hsn: '85183000',
      fsn: 'ACCH' + Math.random().toString(36).substring(2, 14).toUpperCase(),
    };
    await setDoc(doc(db,'purchaseOrders',id), newPO);
    _c.pos = [newPO, ...(_c.pos || [])];
    toast('Order created ✓');
    closeModal();
    renderPO();
    showOrderSuccessModal(newPO);
  } catch(e) {
    showFErr('po-err', e.message||'Save failed.');
    document.getElementById('modal-save').disabled = false;
  } finally { hideLoading(); }
}

// ══════════════════════════════════════════════════════════════
// GRN MODAL (runTransaction – atomic)
// ══════════════════════════════════════════════════════════════
function openGRNModal(prefillPoId) {
  const openPOs = _c.pos.filter(po=>po.status!=='Completed');
  if (!openPOs.length) { toast('No open orders to receive.'); return; }

  const targetPoId = prefillPoId || (openPOs[0] ? openPOs[0].id : '');
  const targetPo = openPOs.find(p => p.id === targetPoId);
  const initialRem = targetPo ? (Number(targetPo.orderedQty) - Number(targetPo.receivedQty)) : '';

  document.getElementById('modal-title').textContent = 'Record Delivery';
  document.getElementById('modal-body').innerHTML = `
    ${formSelect('grn-po','Which Order Arrived? *',
      [{value:'',label:'— Select Order —'},
       ...openPOs.map(po=>{
         const m = _c.materials.find(x=>x.id===po.materialId);
         const rem = Number(po.orderedQty)-Number(po.receivedQty);
         return {value:po.id, label:`${po.id} – ${m?m.name:po.materialId} (Remaining: ${rem})`};
       })], targetPoId)}
    <div class="mb-4">
      <label class="font-label-metric text-[11px] text-on-surface-variant uppercase tracking-wider block mb-1.5">Quantity Still Expected</label>
      <input id="grn-rem" value="${initialRem}" class="w-full bg-surface-container-highest border border-outline-variant/50 rounded-xl px-4 py-3 text-on-surface-variant font-body-md text-body-md" readonly placeholder="Select order above">
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="mb-4">
        <label class="font-label-metric text-[11px] text-on-surface-variant uppercase tracking-wider block mb-1.5">How Many Arrived? *</label>
        <input id="grn-recv" type="number" min="1" placeholder="0" value="${initialRem || ''}"
          class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary transition-all">
      </div>
      <div class="mb-4">
        <label class="font-label-metric text-[11px] text-on-surface-variant uppercase tracking-wider block mb-1.5">Damaged / Broken *</label>
        <input id="grn-dmg" type="number" min="0" placeholder="0" value="0"
          class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary transition-all">
      </div>
    </div>
    ${formInput('grn-date','Date of Delivery *','date','',today(),'')}
    ${errBox('grn-err')}
  `;

  document.getElementById('grn-po').addEventListener('change', function() {
    const po  = _c.pos.find(p=>p.id===this.value);
    const rem = po ? Number(po.orderedQty)-Number(po.receivedQty) : '';
    document.getElementById('grn-rem').value = rem;
    if (rem) document.getElementById('grn-recv').value = rem;
  });

  document.getElementById('modal-save').onclick = saveGRN;
  openModal();
}

let _grnSaving = false;
async function saveGRN() {
  if (_grnSaving) return;
  const poId    = document.getElementById('grn-po').value;
  const recvQty = parseFloat(document.getElementById('grn-recv').value);
  const dmgQty  = parseFloat(document.getElementById('grn-dmg').value);
  const date    = document.getElementById('grn-date').value;
  const saveBtn = document.getElementById('modal-save');

  if (!poId)                      return showFErr('grn-err','Please select an order.');
  if (isNaN(recvQty)||recvQty<=0) return showFErr('grn-err','Received quantity must be more than 0.');
  if (isNaN(dmgQty)||dmgQty<0)    return showFErr('grn-err','Damaged quantity cannot be negative.');
  if (dmgQty>recvQty)             return showFErr('grn-err','Damaged cannot be more than received.');
  if (!date)                      return showFErr('grn-err','Please enter the delivery date.');

  _grnSaving = true;
  saveBtn.disabled    = true;
  saveBtn.textContent = 'Saving…';
  showLoading();

  try {
    await runTransaction(db, async (tx) => {
      const grnCtrRef = doc(db,'counters','goodsReceipts');
      const movCtrRef = doc(db,'counters','stockMovements');
      const poRef     = doc(db,'purchaseOrders',poId);

      const [gCtr,mCtr,poSnap] = await Promise.all([tx.get(grnCtrRef),tx.get(movCtrRef),tx.get(poRef)]);
      if (!poSnap.exists()) throw new Error('Order not found.');
      const po = poSnap.data();
      if (po.status==='Completed') throw new Error('This order is already fully received.');

      const matRef  = doc(db,'materials',po.materialId);
      const matSnap = await tx.get(matRef);
      if (!matSnap.exists()) throw new Error('Item not found in database.');
      const mat = matSnap.data();

      const remaining = Number(po.orderedQty)-Number(po.receivedQty);
      if (recvQty > remaining) throw new Error(`You can only receive ${remaining} more (you tried ${recvQty}).`);

      const netQty   = recvQty - dmgQty;
      const newStock = Number(mat.stock)+netQty;
      if (newStock < 0) throw new Error('Stock cannot go below zero.');

      const newRecv   = Number(po.receivedQty)+recvQty;
      const newStatus = newRecv >= Number(po.orderedQty) ? 'Completed' : 'Partially Received';

      const grnCount = (gCtr.exists()?gCtr.data().count:0)+1;
      const movCount = (mCtr.exists()?mCtr.data().count:0)+1;
      const grnId    = 'GRN-'+String(grnCount).padStart(4,'0');
      const movId    = 'MOV-'+String(movCount).padStart(4,'0');

      tx.set(grnCtrRef,{count:grnCount});
      tx.set(movCtrRef,{count:movCount});
      tx.set(doc(db,'goodsReceipts',grnId), {id:grnId,poId,receivedQty:recvQty,damagedQty:dmgQty,date});
      tx.update(poRef,  {receivedQty:newRecv,status:newStatus});
      tx.update(matRef, {stock:newStock});
      tx.set(doc(db,'stockMovements',movId), {id:movId,materialId:po.materialId,type:'IN',qty:netQty,refId:grnId,date,balanceAfter:newStock});
    });

    toast('Delivery recorded ✓ · Stock updated!');
    closeModal();
    renderGRN();
  } catch(e) {
    showFErr('grn-err', e.message||'Transaction failed. Please try again.');
    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save';
    _grnSaving = false;
  } finally { hideLoading(); }
}

// ══════════════════════════════════════════════════════════════
// SAMPLE DATA (18 materials, 5 suppliers)
// ══════════════════════════════════════════════════════════════
async function loadSampleData() {
  const existing = await getAllDocs('materials');
  const doLoad = async () => {
    showLoading();
    try {
      const s1 = await nextSeqId('suppliers','S',3);
      await setDoc(doc(db,'suppliers',s1),{id:s1,name:'TechParts Pvt Ltd',phone:'+91 98001 12345',email:'sales@techparts.in'});
      const s2 = await nextSeqId('suppliers','S',3);
      await setDoc(doc(db,'suppliers',s2),{id:s2,name:'OfficeWorld Supplies',phone:'+91 80234 56789',email:'orders@officeworld.in'});
      const s3 = await nextSeqId('suppliers','S',3);
      await setDoc(doc(db,'suppliers',s3),{id:s3,name:'GreenEarth Packaging',phone:'+91 97765 43210',email:'info@greenearth.co'});
      const s4 = await nextSeqId('suppliers','S',3);
      await setDoc(doc(db,'suppliers',s4),{id:s4,name:'ElectroTech Spares Ltd',phone:'+91 91234 56789',email:'support@electrotech.in'});
      const s5 = await nextSeqId('suppliers','S',3);
      await setDoc(doc(db,'suppliers',s5),{id:s5,name:'Fab3D Labs',phone:'+91 88765 12345',email:'hello@fab3d.in'});

      const items = [
        // Electronics
        {name:'Arduino Uno R3',            category:'Electronics',  unit:'pcs',  stock:42, minStock:15, price:850,    supplierId:s1},
        {name:'Raspberry Pi 4 Model B',    category:'Electronics',  unit:'pcs',  stock:8,  minStock:5,  price:4200,   supplierId:s1},
        {name:'ESP32 Development Board',   category:'Electronics',  unit:'pcs',  stock:15, minStock:8,  price:650,    supplierId:s1},
        {name:'Ultrasonic Sensor HC-SR04', category:'Sensors',      unit:'pcs',  stock:85, minStock:25, price:110,    supplierId:s4},
        {name:'16×2 LCD Display',          category:'Electronics',  unit:'pcs',  stock:30, minStock:10, price:180,    supplierId:s4},
        {name:'Servo Motor SG90',          category:'Electronics',  unit:'pcs',  stock:50, minStock:20, price:120,    supplierId:s4},
        {name:'Jumper Wires (40pcs Set)',   category:'Electronics',  unit:'set',  stock:35, minStock:15, price:90,     supplierId:s1},
        {name:'USB-C Data Cable 1m',       category:'Electronics',  unit:'pcs',  stock:20, minStock:10, price:150,    supplierId:s1},
        {name:'PCB Prototype Board',       category:'Electronics',  unit:'pcs',  stock:25, minStock:10, price:60,     supplierId:s4},
        // 3D Printing
        {name:'PLA Filament 1kg (Cyan)',   category:'3D Printing',  unit:'spool',stock:8,  minStock:10, price:1450,   supplierId:s5}, // LOW
        {name:'PETG Filament 1kg (Black)', category:'3D Printing',  unit:'spool',stock:5,  minStock:8,  price:1650,   supplierId:s5}, // LOW
        // Stationery
        {name:'A4 Copy Paper 75GSM',       category:'Stationery',   unit:'ream', stock:3,  minStock:20, price:320,    supplierId:s2}, // CRITICAL
        {name:'Gel Pen Box (12 pcs)',       category:'Stationery',   unit:'box',  stock:18, minStock:8,  price:120,    supplierId:s2},
        {name:'Sticky Notes (Pack of 5)',   category:'Stationery',   unit:'pack', stock:60, minStock:15, price:85,     supplierId:s2},
        {name:'Whiteboard Marker Set',     category:'Stationery',   unit:'set',  stock:12, minStock:5,  price:195,    supplierId:s2},
        // Packaging
        {name:'Bubble Wrap Roll 5m',       category:'Packaging',    unit:'roll', stock:30, minStock:10, price:180,    supplierId:s3},
        {name:'Cardboard Box 12×8×6',      category:'Packaging',    unit:'pcs',  stock:45, minStock:20, price:35,     supplierId:s3},
        // Tools
        {name:'Soldering Wire 60/40 250g', category:'Tools',        unit:'spool',stock:2,  minStock:15, price:280,    supplierId:s4}, // CRITICAL
      ];

      for (const item of items) {
        const id = await nextSeqId('materials','M',3);
        await setDoc(doc(db,'materials',id),{id,...item});
        await _writeMovement(id,'IN',item.stock,'SAMPLE',item.stock);
      }
      toast('Sample data loaded ✓ (18 items, 5 suppliers)');
      navigate('dashboard');
    } catch(e) { toast(e.message); }
    finally    { hideLoading(); }
  };

  if (existing.length>0) {
    showConfirm('Load Sample Data','This adds items on top of existing data. Continue?', doLoad);
  } else {
    doLoad();
  }
}

async function resetData() {
  showConfirm('Reset All Data','⚠ This will permanently delete ALL items, orders, and requests!', async () => {
    showLoading();
    try {
      const cols = ['materials','suppliers','purchaseRequisitions','purchaseOrders','goodsReceipts','stockMovements','counters'];
      for (const col of cols) {
        const snap = await getDocs(collection(db,col));
        await Promise.all(snap.docs.map(d=>deleteDoc(d.ref)));
      }
      toast('All data cleared.');
      navigate('dashboard');
    } catch(e) { toast(e.message); }
    finally    { hideLoading(); }
  });
}

// ── Error page helper ─────────────────────────────────────────
function errPage(page, msg) {
  return `
    <div class="flex flex-col items-center py-16 px-4 text-center w-full">
      <span class="material-symbols-outlined text-[48px] text-tertiary mb-3">wifi_off</span>
      <p class="font-headline-sm text-[16px] text-on-surface font-bold mb-2">Something went wrong</p>
      <p class="font-body-sm text-on-surface-variant mb-5 max-w-xs">${esc(msg)}</p>
      <button onclick="navigate('${page}')" class="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-label-metric text-label-metric font-bold active:scale-95 transition-all">
        Try Again
      </button>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// TAX INVOICE GENERATOR & MODAL
// ══════════════════════════════════════════════════════════════

function showOrderSuccessModal(po) {
  const mat = _c.materials.find(m => m.id === po.materialId);
  const grossAmount = (po.price || 0) * (po.orderedQty || 1);
  const orderId = po.orderId || ('OD' + String(po.id).replace(/\D/g, '').padEnd(16, '33672449856486'));
  const invoiceNo = po.invoiceNumber || ('FAJEMS' + (po.id || 'PO01').replace(/\D/g, '') + '2600202504').slice(0, 18);

  const ov = document.getElementById('confirm-overlay');
  document.getElementById('confirm-title').textContent = '🎉 Order Placed Successfully!';
  document.getElementById('confirm-text').innerHTML = `
    <div class="text-left font-body-sm text-[12px] space-y-2.5 mt-2">
      <p class="text-on-surface-variant leading-relaxed">
        Supplier Order <strong>${po.id}</strong> has been generated and saved. An official GST Tax Invoice has been generated!
      </p>
      <div class="p-3.5 rounded-xl bg-surface-container border border-outline-variant/40 space-y-2">
        <div class="flex justify-between items-center"><span class="text-on-surface-variant">Order ID:</span> <span class="font-mono text-primary font-bold text-[13px]">${orderId}</span></div>
        <div class="flex justify-between items-center"><span class="text-on-surface-variant">Invoice No:</span> <span class="font-mono text-on-surface font-semibold">${invoiceNo}</span></div>
        <div class="flex justify-between items-center"><span class="text-on-surface-variant">Item:</span> <span class="text-on-surface font-medium truncate max-w-[180px]">${mat ? esc(mat.name) : po.materialId}</span></div>
        <div class="flex justify-between items-center"><span class="text-on-surface-variant">Quantity:</span> <span class="text-on-surface font-medium">${po.orderedQty}</span></div>
        <div class="flex justify-between items-center pt-1.5 border-t border-outline-variant/30"><span class="text-on-surface font-bold">Grand Total:</span> <span class="text-primary font-bold text-[15px]">₹${fmt(grossAmount)}</span></div>
      </div>
    </div>
  `;
  ov.classList.remove('hidden');

  const okBtn = document.getElementById('confirm-ok');
  okBtn.className = 'flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-md shadow-primary/25 active:scale-95 transition-all';
  okBtn.innerHTML = '<span class="material-symbols-outlined text-[17px]">receipt_long</span><span>View Tax Invoice</span>';
  okBtn.onclick = () => {
    ov.classList.add('hidden');
    viewInvoice(po.id);
  };

  const cancelBtn = document.getElementById('confirm-cancel');
  cancelBtn.textContent = 'Done';
  cancelBtn.onclick = () => {
    ov.classList.add('hidden');
    renderPO();
  };
}

function numberToWords(amount) {
  const a = ['','One ','Two ','Three ','Four ','Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

  const num = Math.round(Number(amount));
  if (num === 0) return 'INR Zero Only';

  function inWords(n) {
    if ((n = n.toString()).length > 9) return 'overflow';
    const n_array = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n_array) return '';
    let str = '';
    str += (n_array[1] != 0) ? (a[Number(n_array[1])] || b[n_array[1][0]] + ' ' + a[n_array[1][1]]) + 'Crore ' : '';
    str += (n_array[2] != 0) ? (a[Number(n_array[2])] || b[n_array[2][0]] + ' ' + a[n_array[2][1]]) + 'Lakh ' : '';
    str += (n_array[3] != 0) ? (a[Number(n_array[3])] || b[n_array[3][0]] + ' ' + a[n_array[3][1]]) + 'Thousand ' : '';
    str += (n_array[4] != 0) ? (a[Number(n_array[4])] || b[n_array[4][0]] + ' ' + a[n_array[4][1]]) + 'Hundred ' : '';
    str += (n_array[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n_array[5])] || b[n_array[5][0]] + ' ' + a[n_array[5][1]]) : '';
    return str.trim();
  }

  return 'INR ' + inWords(num) + ' Only';
}

async function downloadInvoicePDF(orderId, invoiceNo) {
  const btn = document.getElementById('invoice-download-btn');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined text-[17px] animate-spin">sync</span><span>Generating PDF…</span>`;
  }
  toast('Preparing PDF for local download…');
  try {
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = html2pdfModule.default || html2pdfModule;
    const element = document.getElementById('invoice-printable-sheet');
    const filename = `Tax_Invoice_${invoiceNo || orderId || 'SmartStore'}.pdf`;

    const opt = {
      margin:       [6, 6, 6, 6],
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    await html2pdf().set(opt).from(element).save();
    toast(`✓ Downloaded ${filename} locally!`);
  } catch (err) {
    console.error('PDF generation error:', err);
    toast('Opening print view for direct PDF saving…');
    window.print();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

async function viewInvoice(poId) {
  let po = _c.pos?.find(p => p.id === poId);
  if (!po) {
    showLoading();
    try {
      const snap = await getDocs(collection(db, 'purchaseOrders'));
      _c.pos = snap.docs.map(d => d.data());
      po = _c.pos.find(p => p.id === poId);
    } catch (_) {}
    finally { hideLoading(); }
  }
  if (!po) { toast('Order details not found.'); return; }

  _currentInvoicePoId = poId;

  const mat = _c.materials?.find(m => m.id === po.materialId);
  const sup = _c.suppliers?.find(s => s.id === po.supplierId);

  const orderId = po.orderId || ('OD' + String(po.id).replace(/\D/g, '').padEnd(16, '33672449856486'));
  const invoiceNo = po.invoiceNumber || ('FAJEMS' + (po.id || 'PO01').replace(/\D/g, '') + '2600202504').slice(0, 18);
  const invoiceDate = po.invoiceDate || today().split('-').reverse().join('-');
  const orderDate = po.orderDate || invoiceDate;
  const pan = po.pan || 'AABCN1929K';
  const gstin = sup?.gstin || po.gstin || '27AABCN1929K2ZA';
  const hsn = po.hsn || mat?.hsn || '85183000';
  const fsn = po.fsn || ('ACCH' + (po.id || 'M01').replace(/\D/g, '').padEnd(12, '8HZDDX9GK5H')).slice(0, 16);

  const soldByName = sup ? esc(sup.name) : 'BTPL Distribution Private Limited';
  const soldByAddr = sup?.address || 'Warehouse Building Nos. WE-II, Renaissance Integrated Industrial Area, Village Vashere, Bhiwandi , Thane , Mumbai , Maharashtra - 421302, Bhiwandi , MAHARASHTRA, India - 421302, IN-MH';

  const grossAmount = (po.price || 0) * (po.orderedQty || 1);
  const discount = po.discount || 0;
  const netGross = grossAmount - discount;
  const taxableValue = +(netGross / 1.18).toFixed(2);
  const totalGst = +(netGross - taxableValue).toFixed(2);
  const cgst = +(totalGst / 2).toFixed(2);
  const sgst = +(totalGst - cgst).toFixed(2);
  const grandTotal = netGross;

  // Recipient details (derived dynamically from logged-in user profile, no hardcoded personal data)
  const recipientName = _userProfile.name || _user?.displayName || _user?.email?.split('@')[0] || 'Store Owner';
  const recipientShop = _userProfile.shopName ? esc(_userProfile.shopName) : '';
  const recipientAddr1 = _userProfile.address1 || 'Commercial Complex, Main Market';
  const recipientAddr2 = _userProfile.address2 || '';
  const recipientCity = (_userProfile.city || 'Mumbai') + (_userProfile.pincode ? ' ' + _userProfile.pincode : ' 400001');
  const recipientState = _userProfile.state || 'Maharashtra';
  const recipientPhone = _userProfile.phone || '98XXXXXXXX';
  const recipientGstin = _userProfile.gstin ? `GSTIN: ${_userProfile.gstin}` : '';

  document.getElementById('invoice-bar-subtitle').textContent = `${orderId} · ${invoiceNo}`;

  const sheet = document.getElementById('invoice-printable-sheet');
  sheet.innerHTML = `
    <!-- Top Header -->
    <div class="text-center mb-4">
      <h1 class="text-[20px] font-bold tracking-normal uppercase text-black font-sans">Tax Invoice</h1>
    </div>

    <!-- Sold By & Invoice Box Row -->
    <div class="flex justify-between items-start gap-4 pb-3 border-b border-black">
      <div class="max-w-[62%] text-[10.5px] leading-relaxed text-gray-900">
        <div><strong class="text-black">Sold By:</strong> ${soldByName} ,</div>
        <div class="text-gray-700 mt-0.5"><strong class="text-black">Ship-from Address:</strong> ${soldByAddr} ,</div>
        <div class="mt-1 font-bold text-black">GSTIN - ${gstin}</div>
      </div>
      <div class="flex flex-col items-end gap-2 flex-shrink-0">
        <!-- Authentic SVG QR Code -->
        <svg width="64" height="64" viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg" class="border border-gray-300 p-1 bg-white">
          <rect width="29" height="29" fill="white"/>
          <rect x="2" y="2" width="7" height="7" fill="black"/>
          <rect x="3" y="3" width="5" height="5" fill="white"/>
          <rect x="4" y="4" width="3" height="3" fill="black"/>
          <rect x="20" y="2" width="7" height="7" fill="black"/>
          <rect x="21" y="3" width="5" height="5" fill="white"/>
          <rect x="22" y="4" width="3" height="3" fill="black"/>
          <rect x="2" y="20" width="7" height="7" fill="black"/>
          <rect x="3" y="21" width="5" height="5" fill="white"/>
          <rect x="4" y="22" width="3" height="3" fill="black"/>
          <rect x="10" y="4" width="1" height="1" fill="black"/>
          <rect x="12" y="4" width="1" height="1" fill="black"/>
          <rect x="14" y="4" width="1" height="1" fill="black"/>
          <rect x="16" y="4" width="1" height="1" fill="black"/>
          <rect x="18" y="4" width="1" height="1" fill="black"/>
          <rect x="4" y="10" width="1" height="1" fill="black"/>
          <rect x="4" y="12" width="1" height="1" fill="black"/>
          <rect x="4" y="14" width="1" height="1" fill="black"/>
          <rect x="4" y="16" width="1" height="1" fill="black"/>
          <rect x="4" y="18" width="1" height="1" fill="black"/>
          <rect x="10" y="10" width="2" height="2" fill="black"/>
          <rect x="14" y="10" width="3" height="1" fill="black"/>
          <rect x="12" y="13" width="2" height="2" fill="black"/>
          <rect x="16" y="12" width="2" height="2" fill="black"/>
          <rect x="10" y="16" width="3" height="2" fill="black"/>
          <rect x="15" y="16" width="2" height="1" fill="black"/>
          <rect x="11" y="20" width="2" height="2" fill="black"/>
          <rect x="15" y="21" width="3" height="1" fill="black"/>
          <rect x="12" y="24" width="2" height="2" fill="black"/>
          <rect x="16" y="24" width="1" height="2" fill="black"/>
          <rect x="20" y="11" width="2" height="2" fill="black"/>
          <rect x="24" y="12" width="2" height="1" fill="black"/>
          <rect x="22" y="15" width="3" height="2" fill="black"/>
          <rect x="20" y="19" width="1" height="3" fill="black"/>
          <rect x="23" y="20" width="3" height="2" fill="black"/>
          <rect x="21" y="24" width="2" height="2" fill="black"/>
          <rect x="25" y="24" width="2" height="2" fill="black"/>
        </svg>
        <div class="border border-dashed border-gray-600 px-3 py-1 text-[11px] font-bold text-black whitespace-nowrap bg-white">
          Invoice Number # ${invoiceNo}
        </div>
      </div>
    </div>

    <!-- 3-Column Metadata: Order Details | Bill To | Ship To -->
    <div class="grid grid-cols-3 gap-4 py-3 border-b border-gray-300 text-[10.5px] leading-relaxed">
      <!-- Col 1: Order Details -->
      <div class="space-y-1">
        <div><strong class="text-black">Order ID:</strong><br><span class="font-bold text-[11.5px] text-black break-all">${orderId}</span></div>
        <div><strong class="text-black">Order Date:</strong> ${orderDate}</div>
        <div><strong class="text-black">Invoice Date:</strong> ${invoiceDate}</div>
        <div><strong class="text-black">PAN:</strong> ${pan}</div>
      </div>

      <!-- Col 2: Bill To -->
      <div>
        <strong class="text-black block text-[11px] mb-0.5">Bill To</strong>
        <div class="font-bold text-black text-[11.5px]">${esc(recipientName)}</div>
        ${recipientShop ? `<div class="text-[10px] text-gray-700 font-medium">${recipientShop}</div>` : ''}
        <div class="text-gray-700">${esc(recipientAddr1)}</div>
        ${recipientAddr2 ? `<div class="text-gray-700">${esc(recipientAddr2)}</div>` : ''}
        <div class="text-gray-900 font-medium">${esc(recipientCity)}</div>
        <div class="text-gray-900 font-medium">${esc(recipientState)}</div>
        <div class="text-gray-700">Phone: ${esc(recipientPhone)}</div>
        ${recipientGstin ? `<div class="text-black font-semibold text-[10px] mt-0.5">${esc(recipientGstin)}</div>` : ''}
      </div>

      <!-- Col 3: Ship To -->
      <div class="relative">
        <strong class="text-black block text-[11px] mb-0.5">Ship To</strong>
        <div class="font-bold text-black text-[11.5px]">${esc(recipientName)}</div>
        ${recipientShop ? `<div class="text-[10px] text-gray-700 font-medium">${recipientShop}</div>` : ''}
        <div class="text-gray-700">${esc(recipientAddr1)}</div>
        ${recipientAddr2 ? `<div class="text-gray-700">${esc(recipientAddr2)}</div>` : ''}
        <div class="text-gray-900 font-medium">${esc(recipientCity)}</div>
        <div class="text-gray-900 font-medium">${esc(recipientState)}</div>
        <div class="text-gray-700">Phone: ${esc(recipientPhone)}</div>
        <div class="text-[9px] text-gray-500 italic mt-2 leading-tight">
          *Keep this invoice and manufacturer box for warranty purposes.
        </div>
      </div>
    </div>

    <!-- Total items header -->
    <div class="pt-3 pb-1.5 text-[11px] font-semibold text-black">
      Total items: 1
    </div>

    <!-- GST Table -->
    <div class="overflow-x-auto">
      <table class="w-full text-[10.5px] border-collapse mb-2">
        <thead>
          <tr class="border-t border-b border-black font-semibold text-black">
            <th class="text-left py-1.5 px-1 font-semibold">Product</th>
            <th class="text-left py-1.5 px-2 font-semibold">Title</th>
            <th class="text-center py-1.5 px-1 font-semibold">Qty</th>
            <th class="text-right py-1.5 px-1.5 font-semibold whitespace-nowrap">Gross<br>Amount ₹</th>
            <th class="text-right py-1.5 px-1.5 font-semibold whitespace-nowrap">Discounts<br>/Coupons ₹</th>
            <th class="text-right py-1.5 px-1.5 font-semibold whitespace-nowrap">Taxable<br>Value ₹</th>
            <th class="text-right py-1.5 px-1.5 font-semibold whitespace-nowrap">SGST<br>/UTGST ₹</th>
            <th class="text-right py-1.5 px-1.5 font-semibold whitespace-nowrap">CGST<br>₹</th>
            <th class="text-right py-1.5 px-1.5 font-semibold whitespace-nowrap">Total ₹</th>
          </tr>
        </thead>
        <tbody>
          <tr class="align-top border-b border-gray-300">
            <td class="py-2.5 px-1 text-gray-900">
              <div class="font-bold text-black">${mat?.category || 'Electronics'}</div>
              <div class="text-[9.5px] text-gray-600 mt-1">FSN: ${fsn}</div>
              <div class="text-[9.5px] text-gray-600">HSN/SAC: ${hsn}</div>
            </td>
            <td class="py-2.5 px-2 text-gray-900">
              <div class="font-bold text-black text-[11.5px]">${mat ? esc(mat.name) : 'Component Item'}</div>
              <div class="text-[9px] text-gray-600 mt-0.5">Warranty: 1 Year Warranty from the date of purchase</div>
              <div class="text-[9px] text-gray-600">SGST/UTGST: 9.0 %</div>
              <div class="text-[9px] text-gray-600">CGST: 9.0 %</div>
            </td>
            <td class="py-2.5 px-1 text-center font-bold text-black">${po.orderedQty || 1}</td>
            <td class="py-2.5 px-1.5 text-right font-medium text-black">${fmt(grossAmount)}</td>
            <td class="py-2.5 px-1.5 text-right text-gray-600">${discount ? '-' + fmt(discount) : '0.00'}</td>
            <td class="py-2.5 px-1.5 text-right font-medium text-black">${fmt(taxableValue)}</td>
            <td class="py-2.5 px-1.5 text-right font-medium text-black">${fmt(sgst)}</td>
            <td class="py-2.5 px-1.5 text-right font-medium text-black">${fmt(cgst)}</td>
            <td class="py-2.5 px-1.5 text-right font-bold text-black">${fmt(grandTotal)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t border-b border-black font-bold text-black">
            <td class="py-2 px-1">Total</td>
            <td class="py-2 px-2"></td>
            <td class="py-2 px-1 text-center font-bold">${po.orderedQty || 1}</td>
            <td class="py-2 px-1.5 text-right font-bold">${fmt(grossAmount)}</td>
            <td class="py-2 px-1.5 text-right font-bold">${discount ? '-' + fmt(discount) : '0.00'}</td>
            <td class="py-2 px-1.5 text-right font-bold">${fmt(taxableValue)}</td>
            <td class="py-2 px-1.5 text-right font-bold">${fmt(sgst)}</td>
            <td class="py-2 px-1.5 text-right font-bold">${fmt(cgst)}</td>
            <td class="py-2 px-1.5 text-right font-bold">${fmt(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Grand Total Highlight & Amount in Words -->
    <div class="my-3 pb-3 border-b border-gray-300">
      <div class="flex justify-between items-center flex-wrap gap-2">
        <div class="text-[10px] text-gray-700">
          <div><strong class="text-black">Amount in Words:</strong> ${numberToWords(grandTotal)}</div>
          <div class="mt-0.5">Whether tax is payable on reverse charge: <strong class="text-black">No</strong></div>
        </div>
        <div class="flex items-center gap-8 ml-auto">
          <span class="font-bold text-[14px] text-black">Grand Total</span>
          <span class="font-bold text-[18px] text-black">₹ ${fmt(grandTotal)}</span>
        </div>
      </div>
    </div>

    <!-- Signature Block -->
    <div class="flex justify-end my-4">
      <div class="text-center w-64">
        <div class="text-[11px] font-semibold text-gray-800 mb-1">${soldByName}</div>
        <div class="h-14 flex items-center justify-center">
          <svg width="160" height="48" viewBox="0 0 160 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 34 C32 10, 44 14, 52 25 C60 36, 68 38, 78 18 C88 6, 100 28, 108 26 C118 24, 126 12, 138 22 C146 28, 152 20, 156 18" stroke="#1d4ed8" stroke-width="2.2" stroke-linecap="round" fill="none"/>
            <path d="M42 32 C70 28, 98 29, 136 34" stroke="#1d4ed8" stroke-width="1.8" stroke-linecap="round" fill="none"/>
            <path d="M52 40 C80 36, 110 37, 142 42" stroke="#1d4ed8" stroke-width="1.3" stroke-linecap="round" fill="none"/>
          </svg>
        </div>
        <div class="text-[10.5px] font-semibold text-gray-700 border-t border-gray-300 pt-1">Authorized Signatory</div>
      </div>
    </div>

    <!-- Returns Policy -->
    <div class="text-[9.5px] text-gray-700 leading-normal border-t border-gray-300 pt-2.5 my-3">
      <strong>Returns Policy:</strong> At SmartStore we try to deliver perfectly each and every time. But in the off-chance that you need to return the item, please do so with the <strong>original Brand box/price tag, original packing and invoice</strong> without which it will be really difficult for us to act on your request. Please help us in helping you. Terms and conditions apply.
    </div>

    <!-- Thank You Badge (Flipkart Style) -->
    <div class="flex justify-end my-2">
      <div class="flex items-center gap-2 px-3 py-1.5 rounded border border-gray-300 bg-white text-right">
        <div>
          <div class="font-bold text-[13px] text-blue-700 tracking-tight flex items-center gap-1 justify-end font-sans">
            <span>SmartStore</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#facc15" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3h-6c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z"/>
            </svg>
          </div>
          <div class="text-[9.5px] text-gray-700 font-medium">Thank You! <span class="italic text-gray-500 font-normal">for shopping with us</span></div>
        </div>
      </div>
    </div>

    <!-- Registered Office & Contact Footer -->
    <div class="text-[9px] text-gray-600 border-t border-gray-300 pt-2 space-y-0.5">
      <p>Regd. office: ${soldByName} , First Floor, Cabin No. 7 Plot No. 8D, Ragamalika Towers, Viswas Nagar, Maduravoyal, Chennai, Tamil Nadu - 600095</p>
      <p class="font-semibold text-gray-800">Contact SmartStore: 044-45614700 | 1800 208 9898 || help@smartstore.com || www.smartstore.com/helpcentre</p>
    </div>

    <!-- Sub-footer: E. & O.E. -->
    <div class="flex justify-between items-center text-[9.5px] text-gray-700 border-t border-gray-300 pt-1.5 mt-2">
      <span class="font-bold">E. & O.E.</span>
      <span>page 1 of 1</span>
    </div>
  `;

  const ov = document.getElementById('invoice-overlay');
  ov.classList.remove('hidden');

  document.getElementById('invoice-close-btn').onclick = closeInvoice;
  document.getElementById('invoice-print-btn').onclick = () => window.print();
  document.getElementById('invoice-download-btn').onclick = () => downloadInvoicePDF(orderId, invoiceNo);
  document.getElementById('invoice-edit-profile-btn').onclick = openUserProfileModal;
}

function closeInvoice() {
  document.getElementById('invoice-overlay').classList.add('hidden');
}

// ── Expose to window (used from innerHTML onclick) ────────────
Object.assign(window, {
  navigate,
  openPRFormForMaterial,
  openPOFormForMaterial,
  openPOModalForPR,
  openGRNModalForPO,
  openProductModal, deleteProduct,
  openSupplierModal,
  openPRModal, updatePRStatus,
  openPOModal,
  openGRNModal,
  loadSampleData, resetData,
  filterProducts,
  viewInvoice,
  closeInvoice,
  downloadInvoicePDF,
  openUserProfileModal,
  signOutUser: window.signOutUser,
});


