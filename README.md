# SmartStore v2 – Inventory & Purchase Manager

Firebase Firestore backend · Vite bundled · Dark theme · Mobile-first · Android WebView ready.

---

## Quick Start

```bash
# 1. Install dependencies (Vite + Firebase)
npm install

# 2. Start dev server
npm run dev
# → Opens at http://localhost:5173
```

> **No backend, no login needed** – data lives in your Firestore project.

---

## Build for Production / Android WebView

```bash
npm run build
# Output: dist/
```

The `vite.config.js` sets `base: './'` so all asset paths are relative —  
required for `file://` URLs inside a Capacitor/Cordova Android WebView.

---

## Project Structure

```
d:\app\
├── index.html          ← Vite entry (references src/app.js)
├── vite.config.js      ← base: './' for WebView
├── package.json
├── src/
│   ├── firebase.js     ← Firebase init, exports db
│   ├── app.js          ← All UI + Firestore logic
│   └── style.css       ← Dark theme (all tokens in :root)
└── dist/               ← Production build output (after npm run build)
```

---

## Full Workflow Walk-through

### Scenario
> "A4 Copy Paper is below minimum stock. Raise a PR → approve → create PO for 20 →  
> receive 18 first (partial), then the remaining 2."

1. **Dashboard → "📦 Load Sample Data"**  
   Creates 3 suppliers + 6 products. A4 Copy Paper: stock **3**, min **20** → red Low Stock alert.

2. **Dashboard → "Create PR"** (next to A4 Copy Paper)  
   Material pre-fills. Enter Qty **20**, Reason *Stock replenishment* → Save.  
   PR-0001 created → status **Pending**.

3. **PR tab → ✓ Approve PR-0001**  
   Status becomes **Approved**.

4. **PO tab → "+ Create PO"**  
   Select PR-0001. Material, qty (20), supplier and price auto-fill.  
   Set expected date → Save. PO-0001 status: **Created**, Recv: 0.

5. **GRN tab → "+ Record GRN"** (partial)  
   Select PO-0001. Remaining = **20**.  
   Enter Received **18**, Damaged **0** → Save.  
   ✅ A4 Copy Paper stock: 3 + 18 = **21** | PO: **Partially Received**

6. **GRN tab → "+ Record GRN"** (final)  
   Select PO-0001. Remaining = **2**.  
   Enter Received **2**, Damaged **0** → Save.  
   ✅ A4 Copy Paper stock: 21 + 2 = **23** | PO: **Completed**

7. **Dashboard** — Low Stock section now shows ✅ "All products are well-stocked."

---

## Firestore Collections

| Collection | Key Fields |
|---|---|
| `materials` | id, name, category, unit, stock, minStock, price, supplierId |
| `suppliers` | id, name, phone, email |
| `purchaseRequisitions` | id, materialId, qty, reason, status, date |
| `purchaseOrders` | id, prId, supplierId, materialId, orderedQty, receivedQty, price, expectedDate, status |
| `goodsReceipts` | id, poId, receivedQty, damagedQty, date |
| `stockMovements` | id, materialId, type, qty, refId, date, balanceAfter |
| `counters` | one document per collection → `{ count: N }` |

Sequential IDs (M001, S001, PR-0001 …) are generated via atomic Firestore transactions on the `counters` collection.  
GRN save uses a **single `runTransaction`** that reads the PO + material, validates, then writes the GRN, updates PO and material stock atomically.

---

## Retheme

All design tokens live in `src/style.css` → `:root {}`.  
Change `--accent`, `--bg`, `--surface` etc. in one place to retheme the whole app.

---

## Not Included (by design)

Login, user roles, sales tracking, PDF export, charts, notifications.
