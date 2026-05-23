# May 2026 Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 features to isolura.github.io/isoluracloud: payment status, price example images, admin user notes, client queue position, discount codes, loyalty card, and leaderboard.

**Architecture:** Option A — extend existing patterns. Admin.js maintains cached `settings/*` docs (same pattern as `settings/queueInfo`). Clients read their own data plus settings docs. No new files; all changes go into the 4 existing source files plus firestore.rules and style.css.

**Tech Stack:** Vanilla JS ES modules, Firebase 10.12.0 CDN (Firestore), ImgBB API, GitHub Pages.

---

## File Map

| File | What changes |
|------|-------------|
| `firestore.rules` | Add rules for `adminNotes`, `discountCodes`, new `settings/*` docs |
| `css/style.css` | Styles for all new UI: paid badge, price thumb, queue position, notes textarea, loyalty card, discount section, leaderboard |
| `admin.html` | Payment checkbox in detail panel; admin notes textarea; discount codes section in Prices tab; loyalty card settings in Admins tab |
| `js/admin.js` | Payment toggle; admin notes load/save; price image upload per row; queue order write; discount code management; loyalty card settings; leaderboard computation |
| `client.html` | Queue position list; discount code input in Prices tab; loyalty card + leaderboard on Welcome tab |
| `js/client.js` | Payment badge; queue position render; price thumbnails; discount code apply + commission submit integration; loyalty card widget; leaderboard display |

---

### Task 1: Update Firestore Rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Replace firestore.rules with the updated version**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    match /users/{uid} {
      allow read:  if isSignedIn() && (request.auth.uid == uid || isAdmin());
      allow write: if isSignedIn() && request.auth.uid == uid;
    }

    match /admins/{uid} {
      allow get:         if isSignedIn() && request.auth.uid == uid;
      allow list, write: if isAdmin();
    }

    match /commissions/{commissionId} {
      allow read:           if isAdmin() ||
                               (isSignedIn() && resource.data.clientUID == request.auth.uid);
      allow create:         if isSignedIn();
      allow update, delete: if isAdmin();

      match /messages/{messageId} {
        allow read, create: if isAdmin() ||
          (isSignedIn() &&
            get(/databases/$(database)/documents/commissions/$(commissionId))
              .data.clientUID == request.auth.uid);
        allow update, delete: if isAdmin();
      }
    }

    match /settings/{doc} {
      allow read:  if isSignedIn();
      allow write: if isAdmin();
    }

    match /portfolio/{item} {
      allow read:  if isSignedIn();
      allow write: if isAdmin();
    }

    match /adminNotes/{uid} {
      allow read, write: if isAdmin();
    }

    match /discountCodes/{code} {
      allow read:  if isSignedIn();
      allow write: if isAdmin();
    }
  }
}
```

- [ ] **Step 2: Publish rules to Firebase**

Copy the file contents and paste into Firebase Console → Firestore Database → Rules → Publish.

- [ ] **Step 3: Commit**

```bash
cd /var/home/bazzite/isoluracloud
git add firestore.rules
git commit -m "feat: update Firestore rules for new collections"
```

---

### Task 2: CSS for All New UI Elements

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Append new styles to the end of style.css**

```css
/* ── Payment Status ───────────────────────────────────────── */
.paid-badge {
  border-radius: 20px;
  padding: 3px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  background: #e8f5e9;
  color: #2e7d32;
}

[data-theme="middle"] .paid-badge,
[data-theme="dark"]   .paid-badge { background: #1a3a24; color: #5ecf7a; }

.unpaid-badge {
  border-radius: 20px;
  padding: 3px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  background: #fff3e0;
  color: #e67e22;
}

[data-theme="middle"] .unpaid-badge,
[data-theme="dark"]   .unpaid-badge { background: #3d2f1a; color: #e8a53e; }

.payment-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--text-light);
}

.payment-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent);
}

/* ── Price Example Thumbnail ──────────────────────────────── */
.price-example-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border);
  cursor: pointer;
  display: block;
}

.price-img-upload-btn {
  background: none;
  border: 1px dashed var(--accent);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 0.75rem;
  color: var(--accent);
  cursor: pointer;
  white-space: nowrap;
}

/* ── Admin Notes ──────────────────────────────────────────── */
.admin-notes-section {
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.admin-notes-section textarea {
  width: 100%;
  min-height: 80px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 7px 10px;
  font-size: 0.85rem;
  font-family: inherit;
  resize: vertical;
  background: var(--surface);
  color: var(--text);
  outline: none;
}

.notes-saved {
  font-size: 0.75rem;
  color: var(--accent);
  min-height: 1em;
  margin-top: 4px;
}

/* ── Client Queue Position ────────────────────────────────── */
.queue-position-summary {
  background: var(--surface);
  border: 2px solid var(--accent);
  border-radius: 10px;
  padding: 14px 20px;
  margin-bottom: 20px;
  font-size: 0.95rem;
  color: var(--text);
}

.client-queue-row {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 0.88rem;
  color: var(--text-muted);
}

.client-queue-row.is-me {
  border-color: var(--accent);
  background: var(--surface-2);
  color: var(--text);
  font-weight: 600;
}

.client-queue-number {
  font-weight: 700;
  color: var(--accent);
  min-width: 28px;
  font-size: 1rem;
}

.client-queue-row.is-me .client-queue-number { color: var(--pink); }

.you-tag {
  font-size: 0.72rem;
  background: var(--pink);
  color: #fff;
  border-radius: 10px;
  padding: 1px 7px;
  margin-left: auto;
}

/* ── Discount Codes ───────────────────────────────────────── */
.discount-section {
  margin-top: 20px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}

.discount-section h3 {
  font-size: 0.85rem;
  color: var(--accent);
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.discount-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.discount-input-row input {
  flex: 1;
  min-width: 140px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 7px 10px;
  font-size: 0.9rem;
  background: var(--surface);
  color: var(--text);
  outline: none;
}

.discount-result {
  margin-top: 8px;
  font-size: 0.85rem;
  min-height: 1.2em;
}

.discount-result.valid   { color: #2e7d32; }
.discount-result.invalid { color: var(--pink); }

[data-theme="middle"] .discount-result.valid,
[data-theme="dark"]   .discount-result.valid { color: #5ecf7a; }

.discount-code-row {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.85rem;
  flex-wrap: wrap;
  gap: 6px;
}

.discount-code-name { font-weight: 600; color: var(--text); font-family: monospace; }
.discount-code-meta { color: var(--text-muted); font-size: 0.78rem; }

/* ── Loyalty Card ─────────────────────────────────────────── */
.loyalty-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.loyalty-card h3 {
  font-size: 0.85rem;
  color: var(--accent);
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.loyalty-punches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.punch {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--accent);
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.punch.filled {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.punch.milestone {
  border-color: var(--pink);
}

.punch.filled.milestone {
  background: var(--pink);
  border-color: var(--pink);
}

.loyalty-reward-text {
  font-size: 0.82rem;
  color: var(--text-light);
  margin-top: 6px;
}

.loyalty-reward-text strong { color: var(--pink); }

/* ── Loyalty Settings (admin) ─────────────────────────────── */
.loyalty-settings {
  margin-top: 24px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}

.loyalty-settings h3 {
  font-size: 0.85rem;
  color: var(--accent);
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.loyalty-settings input {
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 7px 10px;
  font-size: 0.9rem;
  background: var(--surface);
  color: var(--text);
  outline: none;
  width: 100%;
  margin-bottom: 8px;
}

.loyalty-saved {
  font-size: 0.78rem;
  color: var(--accent);
  min-height: 1em;
  margin-top: 4px;
}

/* ── Leaderboard ──────────────────────────────────────────── */
.leaderboard-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.leaderboard-card h3 {
  font-size: 0.85rem;
  color: var(--accent);
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.leaderboard-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid var(--border-light);
  font-size: 0.88rem;
  color: var(--text);
}

.leaderboard-row:last-child { border-bottom: none; }
.leaderboard-row.is-me { color: var(--accent); font-weight: 600; }

.leaderboard-rank {
  font-weight: 700;
  color: var(--text-muted);
  min-width: 24px;
  font-size: 0.8rem;
}

.leaderboard-row.is-me .leaderboard-rank { color: var(--accent); }

.leaderboard-count {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.leaderboard-row.is-me .leaderboard-count { color: var(--accent); }
```

- [ ] **Step 2: Commit**

```bash
cd /var/home/bazzite/isoluracloud
git add css/style.css
git commit -m "feat: add CSS for all May 2026 features"
```

---

### Task 3: Payment Status

**Files:**
- Modify: `admin.html` (detail panel — add checkbox)
- Modify: `js/admin.js` (renderCommissions, openDetail, wire checkbox)
- Modify: `client.js` (renderCommissions — add paid badge on card header)

- [ ] **Step 1: Add payment checkbox to admin.html detail panel**

In `admin.html`, find the `<div>` block containing the status dropdown (around line 137) and add the payment row immediately after it:

```html
    <div>
      <div class="field-label">Status</div>
      <select id="detail-status">
        <option value="pending">Pending</option>
        <option value="in_progress">In Progress</option>
        <option value="done">Done</option>
      </select>
    </div>

    <div class="payment-row">
      <input type="checkbox" id="detail-paid" />
      <label for="detail-paid" style="cursor:pointer;font-size:0.85rem;color:var(--text-light);">Payment received</label>
      <span id="detail-paid-status" style="font-size:0.75rem;color:var(--accent);"></span>
    </div>
```

- [ ] **Step 2: Wire payment checkbox in admin.js initPage()**

In `js/admin.js`, inside `initPage()`, after the `detail-status` change listener (around line 63), add:

```js
  document.getElementById("detail-paid").addEventListener("change", async () => {
    if (!currentCommissionId) return;
    const paid = document.getElementById("detail-paid").checked;
    await updateDoc(doc(db, "commissions", currentCommissionId), { paid, updatedAt: serverTimestamp() });
    const statusEl = document.getElementById("detail-paid-status");
    statusEl.textContent = "Saved";
    setTimeout(() => { statusEl.textContent = ""; }, 1500);
  });
```

- [ ] **Step 3: Load paid state when opening detail in admin.js**

In `js/admin.js`, inside `openDetail()`, after the line that sets `detail-status` value (around line 258), add:

```js
  document.getElementById("detail-paid").checked = c.paid === true;
  document.getElementById("detail-paid-status").textContent = "";
```

- [ ] **Step 4: Add paid badge to admin commission rows in renderCommissions()**

In `js/admin.js`, inside `renderCommissions()`, replace the `commission-row-right` div template string so it includes a paid badge:

Find:
```js
      <div class="commission-row-right">
        <span class="status-badge status-${c.status}">${statusLabel(c.status)}</span>
        <button class="btn-view" data-id="${c.id}">View →</button>
      </div>
```

Replace with:
```js
      <div class="commission-row-right">
        <span class="${c.paid ? 'paid-badge' : 'unpaid-badge'}">${c.paid ? 'Paid ✓' : 'Unpaid'}</span>
        <span class="status-badge status-${c.status}">${statusLabel(c.status)}</span>
        <button class="btn-view" data-id="${c.id}">View →</button>
      </div>
```

- [ ] **Step 5: Add paid badge to client commission cards in client.js renderCommissions()**

In `js/client.js`, inside the `renderCommissions()` template string, find the `.card-header` div and add a paid badge after the status badge:

Find:
```js
        <div class="card-header">
          <div>
            <div class="card-title">${esc(c.title)}</div>
            <div class="card-meta">Requested ${fmtDate(c.createdAt)} · Updated ${fmtDate(c.updatedAt)}</div>
          </div>
          <span class="status-badge status-${c.status}">${statusLabel(c.status)}</span>
        </div>
```

Replace with:
```js
        <div class="card-header">
          <div>
            <div class="card-title">${esc(c.title)}</div>
            <div class="card-meta">Requested ${fmtDate(c.createdAt)} · Updated ${fmtDate(c.updatedAt)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            <span class="status-badge status-${c.status}">${statusLabel(c.status)}</span>
            ${c.paid ? '<span class="paid-badge">Payment received ✓</span>' : ''}
          </div>
        </div>
```

- [ ] **Step 6: Verify**

Open admin.html → open a commission detail panel → confirm "Payment received" checkbox appears. Check it → confirm Firestore updates `paid: true`. Open client.html → confirm "Payment received ✓" badge shows on that commission card.

- [ ] **Step 7: Commit**

```bash
cd /var/home/bazzite/isoluracloud
git add admin.html js/admin.js js/client.js
git commit -m "feat: add payment status checkbox (admin) and badge (client)"
```

---

### Task 4: Price Item Example Images

**Files:**
- Modify: `js/admin.js` (renderAdminPrices — per-row upload button and handler)
- Modify: `js/client.js` (initPrices — show thumbnail if exampleImageUrl exists)

- [ ] **Step 1: Update renderAdminPrices() in admin.js to show upload button per row**

The Prices table in admin.html currently has 4 columns (Type, Description, Price, remove button). Add an Image column.

In `admin.html`, find the prices table header:
```html
      <thead>
        <tr>
          <th>Type</th>
          <th>Description</th>
          <th>Price</th>
          <th></th>
        </tr>
      </thead>
```

Replace with:
```html
      <thead>
        <tr>
          <th>Type</th>
          <th>Description</th>
          <th>Price</th>
          <th>Example</th>
          <th></th>
        </tr>
      </thead>
```

- [ ] **Step 2: Update renderAdminPrices() in admin.js**

Find the full `renderAdminPrices()` function and replace it with:

```js
function renderAdminPrices() {
  const tbody = document.getElementById("price-rows");
  if (priceItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No prices added yet.</td></tr>';
    return;
  }
  tbody.innerHTML = priceItems.map(item => `
    <tr>
      <td>${esc(item.name)}</td>
      <td class="price-desc">${esc(item.description)}</td>
      <td class="price-amount">${esc(item.price)}</td>
      <td>
        ${item.exampleImageUrl
          ? `<a href="${esc(item.exampleImageUrl)}" target="_blank" rel="noopener">
               <img src="${esc(item.exampleImageUrl)}" class="price-example-thumb" alt="example" />
             </a>`
          : ''}
        <label class="price-img-upload-btn" style="display:inline-block;margin-top:4px;cursor:pointer;">
          ${item.exampleImageUrl ? 'Replace' : '+ Image'}
          <input type="file" accept=".png,.gif,.jpg,.jpeg,.webp" data-item-id="${item.id}"
                 class="price-img-input" style="display:none;" />
        </label>
      </td>
      <td><button class="btn-remove-admin" data-id="${item.id}">Remove</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".btn-remove-admin").forEach(btn => {
    btn.addEventListener("click", async () => {
      const updated = priceItems.filter(p => p.id !== btn.dataset.id);
      await setDoc(doc(db, "settings", "prices"), { items: updated });
    });
  });

  tbody.querySelectorAll(".price-img-input").forEach(input => {
    input.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const label = input.parentElement;
      const origText = label.childNodes[0].textContent.trim();
      label.childNodes[0].textContent = " Uploading…";
      const url = await uploadToImgbb(file);
      label.childNodes[0].textContent = " " + origText;
      if (!url) return;
      const updated = priceItems.map(p =>
        p.id === input.dataset.itemId ? { ...p, exampleImageUrl: url } : p
      );
      await setDoc(doc(db, "settings", "prices"), { items: updated });
      e.target.value = "";
    });
  });
}
```

- [ ] **Step 3: Update client.js initPrices() to show thumbnail**

Find the `initPrices()` function in `js/client.js` and replace the tbody innerHTML template:

Find:
```js
    tbody.innerHTML = items.map(item => `
      <tr>
        <td>${esc(item.name)}</td>
        <td class="price-desc">${esc(item.description)}</td>
        <td class="price-amount">${esc(item.price)}</td>
      </tr>
    `).join("");
```

Replace with:
```js
    tbody.innerHTML = items.map(item => `
      <tr>
        <td>${esc(item.name)}</td>
        <td class="price-desc">${esc(item.description)}</td>
        <td class="price-amount">${esc(item.price)}</td>
        <td>${item.exampleImageUrl
          ? `<a href="${esc(item.exampleImageUrl)}" target="_blank" rel="noopener">
               <img src="${esc(item.exampleImageUrl)}" class="price-example-thumb" alt="example" />
             </a>`
          : ''}</td>
      </tr>
    `).join("");
```

Also update the client prices table header in `client.html`:

Find:
```html
        <thead>
          <tr>
            <th>Type</th>
            <th>Description</th>
            <th>Price</th>
          </tr>
        </thead>
```

Replace with:
```html
        <thead>
          <tr>
            <th>Type</th>
            <th>Description</th>
            <th>Price</th>
            <th>Example</th>
          </tr>
        </thead>
```

- [ ] **Step 4: Verify**

Open admin.html → Prices tab → confirm "+ Image" button appears per row. Upload an image → confirm thumbnail appears and Firestore updates. Open client.html → Prices tab → confirm thumbnail shows next to the item.

- [ ] **Step 5: Commit**

```bash
cd /var/home/bazzite/isoluracloud
git add admin.html client.html js/admin.js js/client.js
git commit -m "feat: add example image upload to price items"
```

---

### Task 5: Admin User Notes

**Files:**
- Modify: `admin.html` (add notes section to detail panel)
- Modify: `js/admin.js` (load/save adminNotes in openDetail/closeDetail)

- [ ] **Step 1: Add notes section to detail panel in admin.html**

In `admin.html`, find the `detail-display-name` paragraph and add the notes section immediately after it:

Find:
```html
    <p id="detail-display-name" style="font-size:0.8rem;color:var(--accent);"></p>
```

Replace with:
```html
    <p id="detail-display-name" style="font-size:0.8rem;color:var(--accent);"></p>

    <div class="admin-notes-section">
      <div class="field-label">Admin Notes (private)</div>
      <textarea id="detail-admin-notes" placeholder="Notes about this client — only visible to admins…"></textarea>
      <div class="notes-saved" id="notes-saved-msg"></div>
    </div>
```

- [ ] **Step 2: Load notes when opening detail panel in admin.js**

In `js/admin.js`, add the `adminNotes` collection import — find the Firestore import line at the top:

Find:
```js
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, updateDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
```

Replace with:
```js
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, updateDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, arrayUnion, increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
```

(Adding `increment` here for use in Task 7 discount code decrement.)

- [ ] **Step 3: Load notes in openDetail() in admin.js**

In `openDetail()`, after the existing `userSnap` block (after the lines that set `detail-display-name`), add:

```js
  const notesSnap = await getDoc(doc(db, "adminNotes", c.clientUID));
  const notesEl   = document.getElementById("detail-admin-notes");
  notesEl.value   = notesSnap.exists() ? (notesSnap.data().notes || "") : "";
  document.getElementById("notes-saved-msg").textContent = "";

  notesEl.onblur = async () => {
    await setDoc(doc(db, "adminNotes", c.clientUID), { notes: notesEl.value });
    const msg = document.getElementById("notes-saved-msg");
    msg.textContent = "Saved";
    setTimeout(() => { msg.textContent = ""; }, 1500);
  };
```

- [ ] **Step 4: Verify**

Open admin.html → open any commission detail → confirm "Admin Notes" textarea appears. Type a note, click elsewhere → confirm "Saved" flash and Firestore `adminNotes/{uid}` doc created. Reload page, reopen same client's commission → note persists.

- [ ] **Step 5: Commit**

```bash
cd /var/home/bazzite/isoluracloud
git add admin.html js/admin.js
git commit -m "feat: add admin-only notes per client user"
```

---

### Task 6: Client Queue Position

**Files:**
- Modify: `js/admin.js` (write settings/queueOrder in subscribeCommissions)
- Modify: `client.html` (update queue tab markup)
- Modify: `js/client.js` (rewrite initQueue to show position list)

- [ ] **Step 1: Write settings/queueOrder in admin.js subscribeCommissions()**

In `js/admin.js`, find the `subscribeCommissions()` function. After the two lines that write `settings/queueInfo`, add:

```js
    const queueOrder = active.map((c, i) => ({
      uid: c.clientUID,
      position: i + 1,
      status: c.status
    }));
    await setDoc(doc(db, "settings", "queueOrder"), { entries: queueOrder });
```

The `active` variable already exists in `renderQueue()`. Since `subscribeCommissions` calls `renderQueue()`, move this write into `renderQueue()` or duplicate the `active` computation. The cleanest change: add the write at the end of `renderQueue()` after the list renders.

Find in `renderQueue()`:
```js
  list.querySelectorAll(".btn-view").forEach(btn => {
```

And add before that block (after the `list.innerHTML = ...` assignment):

```js
  const queueOrder = active.map((c, i) => ({ uid: c.clientUID, position: i + 1, status: c.status }));
  setDoc(doc(db, "settings", "queueOrder"), { entries: queueOrder });
```

- [ ] **Step 2: Update client.html queue tab markup**

In `client.html`, replace the entire `tab-queue` div with:

```html
  <!-- Queue Tab -->
  <div id="tab-queue" class="tab-content" hidden>
    <p class="section-heading">Commission Queue</p>
    <div id="cq-position-summary" class="queue-position-summary" hidden></div>
    <div id="cq-list"></div>
    <p style="color:var(--text-muted);font-size:0.82rem;margin-top:16px;text-align:center;">
      This shows how many commissions Iso is currently working through.
    </p>
  </div>
```

- [ ] **Step 3: Rewrite initQueue() in client.js**

Replace the entire `initQueue()` function with:

```js
function initQueue() {
  onSnapshot(doc(db, "settings", "queueOrder"), (snap) => {
    const summaryEl = document.getElementById("cq-position-summary");
    const listEl    = document.getElementById("cq-list");

    if (!snap.exists()) {
      summaryEl.hidden = true;
      listEl.innerHTML = '<p class="empty-state">Queue is empty!</p>';
      return;
    }

    const entries = snap.data().entries || [];

    if (entries.length === 0) {
      summaryEl.hidden = true;
      listEl.innerHTML = '<p class="empty-state">Queue is empty!</p>';
      return;
    }

    const myEntries = entries.filter(e => e.uid === currentUser.uid);
    if (myEntries.length > 0) {
      const first = myEntries[0];
      summaryEl.hidden = false;
      summaryEl.textContent = myEntries.length === 1
        ? `You are #${first.position} in the queue.`
        : `You have ${myEntries.length} commissions in the queue (positions ${myEntries.map(e => '#' + e.position).join(', ')}).`;
    } else {
      summaryEl.hidden = false;
      summaryEl.textContent = "You have no active commissions in the queue.";
    }

    listEl.innerHTML = entries.map(e => {
      const isMe = e.uid === currentUser.uid;
      return `
        <div class="client-queue-row${isMe ? ' is-me' : ''}">
          <span class="client-queue-number">#${e.position}</span>
          <span class="status-badge status-${e.status}">${statusLabel(e.status)}</span>
          ${isMe ? '<span class="you-tag">You</span>' : ''}
        </div>`;
    }).join("");
  });
}
```

- [ ] **Step 4: Verify**

Open admin.html → confirm commissions exist in queue. Open client.html → Queue tab → confirm numbered list appears, your entries are highlighted with "You" tag, and the summary line shows your position.

- [ ] **Step 5: Commit**

```bash
cd /var/home/bazzite/isoluracloud
git add client.html js/admin.js js/client.js
git commit -m "feat: show client queue position with anonymous numbered list"
```

---

### Task 7: Discount Codes

**Files:**
- Modify: `admin.html` (discount codes section in Prices tab)
- Modify: `js/admin.js` (initDiscountCodes)
- Modify: `client.html` (discount code input in Prices tab)
- Modify: `js/client.js` (apply code, consume on submit)

- [ ] **Step 1: Add discount codes section to admin.html Prices tab**

In `admin.html`, find the closing `</div>` of the `tab-prices` content div (after the `.price-add-form` closing tag) and add before it:

```html
    <div class="discount-section" style="margin-top:24px;">
      <h3>Discount Codes</h3>
      <div id="discount-code-list"></div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 20px;">
        <div style="font-size:0.85rem;color:var(--accent);font-weight:600;text-transform:uppercase;">Generate New Code</div>
        <input type="text"   id="dc-code"     placeholder="Code (e.g. FRIEND10)" style="border:1px solid var(--accent);border-radius:4px;padding:7px 10px;font-size:0.9rem;background:var(--surface);color:var(--text);outline:none;" />
        <input type="text"   id="dc-discount" placeholder="Discount text (e.g. 10% off)" style="border:1px solid var(--accent);border-radius:4px;padding:7px 10px;font-size:0.9rem;background:var(--surface);color:var(--text);outline:none;" />
        <input type="number" id="dc-uses"     placeholder="Number of uses" min="1" style="border:1px solid var(--accent);border-radius:4px;padding:7px 10px;font-size:0.9rem;background:var(--surface);color:var(--text);outline:none;" />
        <div style="display:flex;gap:8px;align-items:center;">
          <button id="btn-dc-generate" class="btn-primary">Generate</button>
          <p id="dc-error" class="error-msg" style="text-align:left;margin:0;"></p>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Add initDiscountCodes() to admin.js and call it from initPage()**

At the end of `initPage()` in `js/admin.js`, add a call to `initDiscountCodes()`.

Then add the function before the `uploadToImgbb` helper:

```js
function initDiscountCodes() {
  onSnapshot(collection(db, "discountCodes"), (snap) => {
    const list = document.getElementById("discount-code-list");
    if (!list) return;
    const codes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    if (codes.length === 0) {
      list.innerHTML = '<p class="empty-state" style="padding:8px 0;">No codes yet.</p>';
      return;
    }
    list.innerHTML = codes.map(c => `
      <div class="discount-code-row">
        <span class="discount-code-name">${esc(c.id)}</span>
        <span class="discount-code-meta">${esc(c.discount)} · ${c.usesLeft} / ${c.totalUses} uses left</span>
      </div>
    `).join("");
  });

  const errorEl = document.getElementById("dc-error");
  document.getElementById("btn-dc-generate").addEventListener("click", async () => {
    const code     = document.getElementById("dc-code").value.trim().toLowerCase();
    const discount = document.getElementById("dc-discount").value.trim();
    const uses     = parseInt(document.getElementById("dc-uses").value.trim(), 10);
    errorEl.textContent = "";
    if (!code)            { errorEl.textContent = "Code is required."; return; }
    if (!discount)        { errorEl.textContent = "Discount text is required."; return; }
    if (!uses || uses < 1){ errorEl.textContent = "Enter a valid number of uses."; return; }

    await setDoc(doc(db, "discountCodes", code), {
      discount, usesLeft: uses, totalUses: uses, createdAt: serverTimestamp()
    });

    document.getElementById("dc-code").value     = "";
    document.getElementById("dc-discount").value = "";
    document.getElementById("dc-uses").value     = "";
  });
}
```

- [ ] **Step 3: Add discount code input to client.html Prices tab**

In `client.html`, find the closing `</div>` of `tab-prices` and add before it:

```html
    <div class="discount-section">
      <h3>Have a Discount Code?</h3>
      <div class="discount-input-row">
        <input type="text" id="discount-code-input" placeholder="Enter code…" />
        <button id="btn-apply-discount" class="btn-secondary">Apply</button>
      </div>
      <div class="discount-result" id="discount-result"></div>
    </div>
```

- [ ] **Step 4: Add activeDiscount variable and initDiscountCode() to client.js**

At the top of `js/client.js`, after `let messageUnsubs = {};`, add:

```js
let activeDiscount = null;
```

Add the following import — find the Firestore import line:

```js
import {
  getFirestore, collection, doc, addDoc, setDoc, getDoc, onSnapshot,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
```

Replace with:

```js
import {
  getFirestore, collection, doc, addDoc, setDoc, getDoc, onSnapshot,
  query, where, orderBy, serverTimestamp, increment, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
```

At the end of `initPage()` in `js/client.js`, add a call to `initDiscountCode()`.

Then add the function before the `notifyAdmin` helper:

```js
function initDiscountCode() {
  const resultEl = document.getElementById("discount-result");
  document.getElementById("btn-apply-discount").addEventListener("click", async () => {
    const raw  = document.getElementById("discount-code-input").value.trim();
    const code = raw.toLowerCase();
    resultEl.className = "discount-result";
    resultEl.textContent = "Checking…";
    if (!code) { resultEl.textContent = ""; return; }

    const snap = await getDoc(doc(db, "discountCodes", code));
    if (!snap.exists() || snap.data().usesLeft <= 0) {
      resultEl.className = "discount-result invalid";
      resultEl.textContent = "Invalid or expired code.";
      activeDiscount = null;
      return;
    }
    activeDiscount = { code, discountText: snap.data().discount };
    resultEl.className = "discount-result valid";
    resultEl.textContent = `Code applied: ${snap.data().discount}`;
  });
}
```

- [ ] **Step 5: Consume discount code when submitting a commission in client.js**

In `js/client.js`, find `btn-rf-submit` click handler. Replace the `await addDoc(...)` call and everything after it (up to the form reset) with a batch write that also decrements usesLeft:

Find:
```js
    await addDoc(collection(db, "commissions"), {
      clientUID: currentUser.uid, clientEmail: currentUser.email,
      displayName, title, description,
      status: "pending", artUrls: [], fileUrls: [],
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });

    notifyAdmin("New commission request", `${displayName || currentUser.email} submitted: "${title}"\n\n${description}`);
```

Replace with:
```js
    const commissionData = {
      clientUID: currentUser.uid, clientEmail: currentUser.email,
      displayName, title, description,
      status: "pending", artUrls: [], fileUrls: [], paid: false,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    };
    if (activeDiscount) {
      commissionData.discountCode = activeDiscount.code;
      commissionData.discountText = activeDiscount.discountText;
    }

    const batch = writeBatch(db);
    const newRef = doc(collection(db, "commissions"));
    batch.set(newRef, commissionData);
    if (activeDiscount) {
      batch.update(doc(db, "discountCodes", activeDiscount.code), { usesLeft: increment(-1) });
    }
    await batch.commit();

    activeDiscount = null;
    document.getElementById("discount-result").textContent = "";
    document.getElementById("discount-code-input").value   = "";

    notifyAdmin("New commission request", `${displayName || currentUser.email} submitted: "${title}"\n\n${description}`);
```

- [ ] **Step 6: Show applied discount on client commission cards**

In `js/client.js` `renderCommissions()`, find the `.card-meta` line and add discount text below it:

Find:
```js
            <div class="card-meta">Requested ${fmtDate(c.createdAt)} · Updated ${fmtDate(c.updatedAt)}</div>
```

Replace with:
```js
            <div class="card-meta">Requested ${fmtDate(c.createdAt)} · Updated ${fmtDate(c.updatedAt)}</div>
            ${c.discountText ? `<div class="card-meta" style="color:var(--accent);">Discount applied: ${esc(c.discountText)}</div>` : ''}
```

- [ ] **Step 7: Verify**

Open admin.html → Prices tab → generate a code "TEST10" with "10% off" and 3 uses. Open client.html → Prices tab → enter "TEST10" → confirm "Code applied: 10% off". Submit a commission → confirm Firestore `discountCodes/test10` has `usesLeft: 2`. Confirm commission doc has `discountCode` and `discountText` fields.

- [ ] **Step 8: Commit**

```bash
cd /var/home/bazzite/isoluracloud
git add admin.html client.html js/admin.js js/client.js
git commit -m "feat: add discount codes (admin generates, client applies at submit)"
```

---

### Task 8: Loyalty Card

**Files:**
- Modify: `admin.html` (loyalty card settings section in Admins tab)
- Modify: `js/admin.js` (initLoyaltyCardSettings)
- Modify: `client.html` (loyalty card widget in Welcome tab)
- Modify: `js/client.js` (initLoyaltyCard)

- [ ] **Step 1: Add loyalty card settings to admin.html Admins tab**

In `admin.html`, find the closing `</div>` of `tab-admins` and add before it:

```html
    <div class="loyalty-settings">
      <h3>Loyalty Card Settings</h3>
      <label style="font-size:0.8rem;color:var(--text-muted);">Tier 1 — commissions needed</label>
      <input type="number" id="lc-tier1-count" min="1" placeholder="e.g. 5" />
      <label style="font-size:0.8rem;color:var(--text-muted);">Tier 1 reward description</label>
      <input type="text" id="lc-tier1-reward" placeholder="e.g. Free sketch add-on" />
      <label style="font-size:0.8rem;color:var(--text-muted);">Tier 2 — commissions needed</label>
      <input type="number" id="lc-tier2-count" min="1" placeholder="e.g. 10" />
      <label style="font-size:0.8rem;color:var(--text-muted);">Tier 2 reward description</label>
      <input type="text" id="lc-tier2-reward" placeholder="e.g. Free full-body commission" />
      <button id="btn-lc-save" class="btn-primary" style="margin-top:4px;">Save</button>
      <div class="loyalty-saved" id="lc-saved-msg"></div>
    </div>
```

- [ ] **Step 2: Add initLoyaltyCardSettings() to admin.js and call from initPage()**

At the end of `initPage()` in `js/admin.js`, add `initLoyaltyCardSettings();`.

Then add the function before `uploadToImgbb`:

```js
function initLoyaltyCardSettings() {
  getDoc(doc(db, "settings", "loyaltyCard")).then(snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    document.getElementById("lc-tier1-count").value  = d.tier1Count  || "";
    document.getElementById("lc-tier1-reward").value = d.tier1Reward || "";
    document.getElementById("lc-tier2-count").value  = d.tier2Count  || "";
    document.getElementById("lc-tier2-reward").value = d.tier2Reward || "";
  });

  document.getElementById("btn-lc-save").addEventListener("click", async () => {
    const tier1Count  = parseInt(document.getElementById("lc-tier1-count").value,  10);
    const tier1Reward = document.getElementById("lc-tier1-reward").value.trim();
    const tier2Count  = parseInt(document.getElementById("lc-tier2-count").value,  10);
    const tier2Reward = document.getElementById("lc-tier2-reward").value.trim();
    const msgEl = document.getElementById("lc-saved-msg");

    if (!tier1Count || !tier1Reward || !tier2Count || !tier2Reward) {
      msgEl.textContent = "All four fields are required.";
      msgEl.style.color = "var(--pink)";
      return;
    }

    await setDoc(doc(db, "settings", "loyaltyCard"), { tier1Count, tier1Reward, tier2Count, tier2Reward });
    msgEl.style.color = "var(--accent)";
    msgEl.textContent = "Saved!";
    setTimeout(() => { msgEl.textContent = ""; }, 2000);
  });
}
```

- [ ] **Step 3: Add loyalty card widget to client.html Welcome tab**

In `client.html`, find the `.welcome-links` div and add the loyalty card HTML before it:

```html
      <div id="loyalty-card-widget"></div>
```

- [ ] **Step 4: Add initLoyaltyCard() to client.js and call from initWelcome()**

At the end of `initWelcome()` in `js/client.js`, add `initLoyaltyCard();`.

Then add the function before `initCommissions`:

```js
function initLoyaltyCard() {
  let loyaltyConfig  = null;
  let doneCount      = 0;

  function renderLoyalty() {
    const el = document.getElementById("loyalty-card-widget");
    if (!loyaltyConfig || (!loyaltyConfig.tier1Count && !loyaltyConfig.tier2Count)) {
      el.innerHTML = "";
      return;
    }

    const { tier1Count, tier1Reward, tier2Count, tier2Reward } = loyaltyConfig;
    const target = doneCount < tier1Count ? tier1Count : doneCount < tier2Count ? tier2Count : tier2Count;
    const progress = Math.min(doneCount, target);

    const punches = Array.from({ length: target }, (_, i) => {
      const filled = i < progress;
      const milestone = (i + 1 === tier1Count) || (i + 1 === tier2Count);
      return `<div class="punch${filled ? ' filled' : ''}${milestone ? ' milestone' : ''}" title="${i + 1}">${filled ? '★' : ''}</div>`;
    }).join("");

    let rewardMsg = "";
    if (doneCount >= tier2Count) {
      rewardMsg = `<div class="loyalty-reward-text">🎉 You've unlocked the special reward: <strong>${esc(tier2Reward)}</strong></div>`;
    } else if (doneCount >= tier1Count) {
      rewardMsg = `<div class="loyalty-reward-text">🎁 You've unlocked: <strong>${esc(tier1Reward)}</strong> · ${tier2Count - doneCount} more for the special reward!</div>`;
    } else {
      const next = tier1Count - doneCount;
      rewardMsg = `<div class="loyalty-reward-text">${next} more commission${next !== 1 ? 's' : ''} to unlock: <strong>${esc(tier1Reward)}</strong></div>`;
    }

    el.innerHTML = `
      <div class="loyalty-card">
        <h3>Commission Card</h3>
        <div class="loyalty-punches">${punches}</div>
        ${rewardMsg}
      </div>`;
  }

  onSnapshot(doc(db, "settings", "loyaltyCard"), (snap) => {
    loyaltyConfig = snap.exists() ? snap.data() : null;
    renderLoyalty();
  });

  const q = query(collection(db, "commissions"), where("clientUID", "==", currentUser.uid));
  onSnapshot(q, (snap) => {
    doneCount = snap.docs.filter(d => d.data().status === "done").length;
    renderLoyalty();
  });
}
```

- [ ] **Step 5: Verify**

Open admin.html → Admins tab → scroll down → confirm Loyalty Card Settings form appears. Set Tier 1 = 3 / "Free sketch", Tier 2 = 6 / "Free full body" → Save. Open client.html → Welcome tab → confirm the punch card widget shows. Mark a couple of commissions as "done" in admin → confirm punch card fills.

- [ ] **Step 6: Commit**

```bash
cd /var/home/bazzite/isoluracloud
git add admin.html client.html js/admin.js js/client.js
git commit -m "feat: add commission loyalty card with admin-configurable tiers"
```

---

### Task 9: Leaderboard

**Files:**
- Modify: `js/admin.js` (compute and write settings/leaderboard in subscribeCommissions)
- Modify: `client.html` (leaderboard card in Welcome tab)
- Modify: `js/client.js` (initLeaderboard, subscribe and render)

- [ ] **Step 1: Compute and write leaderboard in admin.js subscribeCommissions()**

In `js/admin.js`, find `subscribeCommissions()`. After the existing `setDoc` calls (queueInfo and queueOrder writes), add:

```js
    const doneCounts = {};
    const displayNames = {};
    allCommissions
      .filter(c => c.status === "done")
      .forEach(c => {
        doneCounts[c.clientUID]   = (doneCounts[c.clientUID] || 0) + 1;
        if (c.displayName) displayNames[c.clientUID] = c.displayName;
      });

    const leaderboard = Object.entries(doneCounts)
      .map(([uid, count]) => ({ uid, displayName: displayNames[uid] || "Anonymous", doneCount: count }))
      .sort((a, b) => b.doneCount - a.doneCount)
      .slice(0, 10);

    await setDoc(doc(db, "settings", "leaderboard"), {
      entries: leaderboard, updatedAt: serverTimestamp()
    });
```

- [ ] **Step 2: Add leaderboard card to client.html Welcome tab**

In `client.html`, after the `loyalty-card-widget` div, add:

```html
      <div id="leaderboard-widget"></div>
```

- [ ] **Step 3: Add initLeaderboard() to client.js and call from initWelcome()**

At the end of `initWelcome()`, add `initLeaderboard();`.

Add the function after `initLoyaltyCard`:

```js
function initLeaderboard() {
  onSnapshot(doc(db, "settings", "leaderboard"), (snap) => {
    const el = document.getElementById("leaderboard-widget");
    if (!snap.exists()) { el.innerHTML = ""; return; }

    const entries = snap.data().entries || [];
    if (entries.length === 0) { el.innerHTML = ""; return; }

    const rows = entries.map((e, i) => {
      const isMe = e.uid === currentUser.uid;
      return `
        <div class="leaderboard-row${isMe ? ' is-me' : ''}">
          <span class="leaderboard-rank">#${i + 1}</span>
          <span>${esc(e.displayName)}</span>
          <span class="leaderboard-count">${e.doneCount} commission${e.doneCount !== 1 ? 's' : ''}</span>
        </div>`;
    }).join("");

    el.innerHTML = `
      <div class="leaderboard-card">
        <h3>Top Commissioners</h3>
        ${rows}
      </div>`;
  });
}
```

- [ ] **Step 4: Verify**

Mark several commissions as "done" for different clients in admin. Open client.html → Welcome tab → confirm leaderboard appears with those clients ranked by done count. Confirm current user's row is highlighted if they appear.

- [ ] **Step 5: Commit**

```bash
cd /var/home/bazzite/isoluracloud
git add client.html js/admin.js js/client.js
git commit -m "feat: add leaderboard on welcome page (top commissioners by done count)"
```

---

### Task 10: Push to Remote

- [ ] **Step 1: Push all commits**

```bash
cd /var/home/bazzite/isoluracloud
git push origin main
```

- [ ] **Step 2: Update PROJECT_STATUS.md**

In `docs/PROJECT_STATUS.md`, update the "Features Built" section to include all new features, and update `Last updated: 2026-05-23`.

Add under Client Dashboard:
```
- **Queue tab** — anonymous numbered list; client's position highlighted with "You" tag
- **Prices tab** — example image thumbnails per price item; discount code input (applied at commission submit)
- **Welcome tab** — commission loyalty card (punch card, configurable tiers/rewards); top commissioners leaderboard
- **Commission cards** — payment received badge (read-only); applied discount code shown
```

Add under Admin Dashboard:
```
- **Prices tab** — example image upload per price item; discount code generator with use-count tracking
- **Queue tab** — writes settings/queueOrder for client queue position display
- **Admins tab** — loyalty card tier/reward configuration
- **Commission detail panel** — admin notes per client (private); payment received checkbox
```

Add to Firestore Data Model — new collections:
```
### `adminNotes/{uid}`
| Field | Type | Notes |
|-------|------|-------|
| `notes` | string | Admin-only; never exposed to clients |

### `discountCodes/{code}`
| Field | Type | Notes |
|-------|------|-------|
| `discount` | string | Human-readable description, e.g. "10% off" |
| `usesLeft` | number | Decremented at commission submit |
| `totalUses` | number | Original total |
| `createdAt` | timestamp | |

### `settings/loyaltyCard`
| Field | Type | Notes |
|-------|------|-------|
| `tier1Count` | number | Commissions needed for tier 1 |
| `tier1Reward` | string | |
| `tier2Count` | number | |
| `tier2Reward` | string | |

### `settings/leaderboard`
| Field | Type | Notes |
|-------|------|-------|
| `entries` | array | `[{uid, displayName, doneCount}]` top 10 |
| `updatedAt` | timestamp | |

### `settings/queueOrder`
| Field | Type | Notes |
|-------|------|-------|
| `entries` | array | `[{uid, position, status}]` active commissions in order |
```

Also extend `commissions/{id}` model:
```
| `paid` | boolean | Default false; admin toggles |
| `discountCode` | string | Optional; set at submit |
| `discountText` | string | Optional; human-readable discount |
```

- [ ] **Step 3: Commit and push**

```bash
cd /var/home/bazzite/isoluracloud
git add docs/PROJECT_STATUS.md
git commit -m "docs: update PROJECT_STATUS for May 2026 features"
git push origin main
```
