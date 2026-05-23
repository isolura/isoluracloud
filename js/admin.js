import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, updateDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, arrayUnion, increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig, imgbbApiKey } from "./firebase-config.js";

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser         = null;
let currentCommissionId = null;
let allCommissions      = [];
let activeFilter        = "all";
let searchQuery         = "";
let unsubMessages       = null;
let pfPendingImageUrl   = "";

// ── Auth guard ──────────────────────────────────────────────────────────────

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  const adminDoc = await getDoc(doc(db, "admins", user.uid));
  if (!adminDoc.exists()) { window.location.href = "client.html"; return; }
  currentUser = user;
  document.getElementById("admin-email").textContent = user.email;
  initPage();
});

// ── Page initialization ─────────────────────────────────────────────────────

function initPage() {
  initTheme();
  document.getElementById("btn-signout").addEventListener("click", () => signOut(auth));

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => { t.hidden = true; });
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).hidden = false;
    });
  });

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.status;
      renderCommissions();
    });
  });

  document.getElementById("commission-search").addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderCommissions();
  });

  document.getElementById("btn-close-detail").addEventListener("click", closeDetail);

  document.getElementById("detail-status").addEventListener("change", async () => {
    if (!currentCommissionId) return;
    await updateDoc(doc(db, "commissions", currentCommissionId), {
      status: document.getElementById("detail-status").value,
      updatedAt: serverTimestamp()
    });
  });

  document.getElementById("detail-paid").addEventListener("change", async () => {
    if (!currentCommissionId) return;
    const paid = document.getElementById("detail-paid").checked;
    await updateDoc(doc(db, "commissions", currentCommissionId), { paid, updatedAt: serverTimestamp() });
    const statusEl = document.getElementById("detail-paid-status");
    statusEl.textContent = "Saved";
    setTimeout(() => { statusEl.textContent = ""; }, 1500);
  });

  const artUploadInput = document.getElementById("input-art-upload");
  const artUploadLabel = document.getElementById("art-upload-label");

  artUploadInput.addEventListener("change", async (e) => {
    if (!currentCommissionId) return;
    const files = Array.from(e.target.files);
    if (!files.length) return;
    artUploadLabel.textContent = "Uploading…";
    artUploadInput.disabled = true;
    for (const file of files) {
      const url = await uploadToImgbb(file);
      if (url) {
        await updateDoc(doc(db, "commissions", currentCommissionId), {
          artUrls: arrayUnion(url), updatedAt: serverTimestamp()
        });
      }
    }
    artUploadLabel.textContent = "Upload image(s)";
    artUploadInput.disabled = false;
    e.target.value = "";
  });

  document.getElementById("btn-add-url").addEventListener("click", async () => {
    if (!currentCommissionId) return;
    const input = document.getElementById("input-art-url");
    const url = input.value.trim();
    if (!url) return;
    await updateDoc(doc(db, "commissions", currentCommissionId), {
      artUrls: arrayUnion(url), updatedAt: serverTimestamp()
    });
    input.value = "";
  });

  document.getElementById("btn-add-psd").addEventListener("click", async () => {
    if (!currentCommissionId) return;
    const input = document.getElementById("input-psd-url");
    const url = input.value.trim();
    if (!url) return;
    await updateDoc(doc(db, "commissions", currentCommissionId), {
      fileUrls: arrayUnion(url), updatedAt: serverTimestamp()
    });
    input.value = "";
  });

  document.getElementById("btn-send-message").addEventListener("click", sendAdminMessage);
  document.getElementById("input-message").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendAdminMessage();
  });

  initNewCommissionModal();
  initManageAdmins();
  initPortfolio();
  initPrices();
  subscribeCommissions();
}

// ── Theme ───────────────────────────────────────────────────────────────────

function initTheme() {
  const saved = localStorage.getItem("iso-theme") || "light";
  applyTheme(saved);
  document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.addEventListener("click", () => applyTheme(btn.dataset.themeVal));
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "light" ? "" : theme);
  localStorage.setItem("iso-theme", theme);
  document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.themeVal === theme);
  });
}

// ── Commission list ─────────────────────────────────────────────────────────

function subscribeCommissions() {
  onSnapshot(collection(db, "commissions"), async (snap) => {
    allCommissions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    allCommissions.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
    renderCommissions();
    renderQueue();

    const pending    = allCommissions.filter(c => c.status === "pending").length;
    const inProgress = allCommissions.filter(c => c.status === "in_progress").length;
    await setDoc(doc(db, "settings", "queueInfo"), {
      totalPending: pending, totalInProgress: inProgress
    });

    if (currentCommissionId) {
      const c = allCommissions.find(c => c.id === currentCommissionId);
      if (c) { renderArtGallery(c.artUrls || []); renderFileLinks(c.fileUrls || []); }
    }
  });
}

function renderCommissions() {
  const list = document.getElementById("commission-list");
  let visible = activeFilter === "all"
    ? allCommissions
    : allCommissions.filter(c => c.status === activeFilter);

  if (searchQuery) {
    visible = visible.filter(c =>
      (c.title        || "").toLowerCase().includes(searchQuery) ||
      (c.clientEmail  || "").toLowerCase().includes(searchQuery) ||
      (c.displayName  || "").toLowerCase().includes(searchQuery) ||
      (c.description  || "").toLowerCase().includes(searchQuery)
    );
  }

  if (visible.length === 0) {
    list.innerHTML = '<p class="empty-state">No commissions found.</p>';
    return;
  }

  list.innerHTML = visible.map(c => `
    <div class="commission-row">
      <div class="commission-row-info">
        <div class="commission-row-title">${esc(c.title)}</div>
        <div class="commission-row-meta">${esc(c.clientEmail)} · ${fmtDate(c.updatedAt)}</div>
      </div>
      <div class="commission-row-right">
        <span class="${c.paid ? 'paid-badge' : 'unpaid-badge'}">${c.paid ? 'Paid ✓' : 'Unpaid'}</span>
        <span class="status-badge status-${c.status}">${statusLabel(c.status)}</span>
        <button class="btn-view" data-id="${c.id}">View →</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".btn-view").forEach(btn => {
    btn.addEventListener("click", () => openDetail(btn.dataset.id));
  });
}

// ── Queue tab ───────────────────────────────────────────────────────────────

function renderQueue() {
  const active = allCommissions
    .filter(c => c.status === "pending" || c.status === "in_progress")
    .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));

  const pending    = active.filter(c => c.status === "pending").length;
  const inProgress = active.filter(c => c.status === "in_progress").length;

  document.getElementById("q-pending").textContent    = pending;
  document.getElementById("q-inprogress").textContent = inProgress;
  document.getElementById("q-total").textContent      = active.length;

  const queueOrder = active.map((c, i) => ({ uid: c.clientUID, position: i + 1, status: c.status }));
  setDoc(doc(db, "settings", "queueOrder"), { entries: queueOrder });

  const list = document.getElementById("queue-list");
  if (active.length === 0) {
    list.innerHTML = '<p class="empty-state">Queue is empty!</p>';
    return;
  }

  list.innerHTML = active.map((c, i) => `
    <div class="queue-row">
      <div class="queue-number">#${i + 1}</div>
      <div class="queue-info">
        <div class="queue-title">${esc(c.title)}</div>
        <div class="queue-meta">${esc(c.clientEmail)} · Requested ${fmtDate(c.createdAt)}</div>
      </div>
      <span class="status-badge status-${c.status}">${statusLabel(c.status)}</span>
      <button class="btn-view" data-id="${c.id}">View →</button>
    </div>
  `).join("");

  list.querySelectorAll(".btn-view").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => { t.hidden = true; });
      document.querySelector('[data-tab="commissions"]').classList.add("active");
      document.getElementById("tab-commissions").hidden = false;
      openDetail(btn.dataset.id);
    });
  });
}

// ── Commission detail panel ─────────────────────────────────────────────────

async function openDetail(id) {
  const c = allCommissions.find(c => c.id === id);
  if (!c) return;
  currentCommissionId = id;

  document.getElementById("detail-title").textContent       = c.title;
  document.getElementById("detail-client").textContent      = "Client: " + c.clientEmail;
  document.getElementById("detail-description").textContent = c.description || "";
  document.getElementById("detail-status").value            = c.status;
  document.getElementById("detail-paid").checked = c.paid === true;
  document.getElementById("detail-paid-status").textContent = "";
  document.getElementById("detail-display-name").textContent = "";
  renderArtGallery(c.artUrls || []);
  renderFileLinks(c.fileUrls || []);

  const userSnap = await getDoc(doc(db, "users", c.clientUID));
  if (userSnap.exists() && userSnap.data().displayName) {
    document.getElementById("detail-display-name").textContent =
      "Display name: " + userSnap.data().displayName;
  }

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

  if (unsubMessages) unsubMessages();
  unsubMessages = onSnapshot(
    query(collection(db, "commissions", id, "messages"), orderBy("createdAt", "asc")),
    (snap) => renderMessages(snap.docs.map(d => d.data()))
  );

  document.getElementById("detail-panel").hidden = false;
  document.getElementById("tab-commissions").classList.add("panel-open");
}

function closeDetail() {
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  currentCommissionId = null;
  document.getElementById("detail-panel").hidden = true;
  document.getElementById("tab-commissions").classList.remove("panel-open");
}

function renderArtGallery(urls) {
  const gallery = document.getElementById("art-gallery");
  gallery.innerHTML = urls.length
    ? urls.map(url => `
        <a href="${esc(url)}" target="_blank" rel="noopener">
          <img src="${esc(url)}" alt="Commission art" class="art-thumb"
               onerror="this.parentElement.style.display='none'" />
        </a>`).join("")
    : '<p class="empty-state">No art yet.</p>';
}

function renderFileLinks(urls) {
  const el = document.getElementById("file-links");
  el.innerHTML = urls.map(url => {
    const name = url.split("/").pop().split("?")[0] || "File";
    return `<a href="${esc(url)}" target="_blank" rel="noopener" class="file-link-btn">📎 ${esc(name)}</a>`;
  }).join("");
}

function renderMessages(msgs) {
  const el = document.getElementById("detail-messages");
  el.innerHTML = msgs.length
    ? msgs.map(m => `
        <div class="message-bubble ${m.isAdmin ? "admin" : "client"}">
          <span class="message-author">${m.isAdmin ? "Iso" : esc(m.authorEmail)}</span>
          ${esc(m.text)}
        </div>`).join("")
    : '<p class="empty-state">No messages yet.</p>';
  el.scrollTop = el.scrollHeight;
}

async function sendAdminMessage() {
  if (!currentCommissionId) return;
  const input = document.getElementById("input-message");
  const text  = input.value.trim();
  if (!text) return;
  input.value = "";
  await addDoc(collection(db, "commissions", currentCommissionId, "messages"), {
    authorUID: currentUser.uid, authorEmail: currentUser.email,
    isAdmin: true, text, createdAt: serverTimestamp()
  });
  await updateDoc(doc(db, "commissions", currentCommissionId), { updatedAt: serverTimestamp() });
}

// ── New Commission Modal ────────────────────────────────────────────────────

function initNewCommissionModal() {
  const modal   = document.getElementById("modal-new-commission");
  const errorEl = document.getElementById("nc-error");

  document.getElementById("btn-new-commission").addEventListener("click", () => { modal.hidden = false; });
  document.getElementById("btn-nc-cancel").addEventListener("click", () => { modal.hidden = true; errorEl.textContent = ""; });

  document.getElementById("btn-nc-submit").addEventListener("click", async () => {
    const email       = document.getElementById("nc-client-email").value.trim();
    const title       = document.getElementById("nc-title").value.trim();
    const description = document.getElementById("nc-description").value.trim();
    errorEl.textContent = "";
    if (!email || !title) { errorEl.textContent = "Client email and title are required."; return; }

    const usersSnap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
    if (usersSnap.empty) { errorEl.textContent = "No account found for this email. Ask the client to sign up first."; return; }

    const clientUID = usersSnap.docs[0].id;
    await addDoc(collection(db, "commissions"), {
      clientUID, clientEmail: email, title, description,
      status: "pending", artUrls: [], fileUrls: [],
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });

    modal.hidden = true;
    document.getElementById("nc-client-email").value = "";
    document.getElementById("nc-title").value        = "";
    document.getElementById("nc-description").value  = "";
  });
}

// ── Portfolio ───────────────────────────────────────────────────────────────

function initPortfolio() {
  const uploadInput = document.getElementById("pf-image-upload");
  const uploadLabel = document.getElementById("pf-upload-label");
  const urlInput    = document.getElementById("pf-image-url");
  const previewEl   = document.getElementById("pf-preview-label");

  uploadInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    uploadLabel.textContent = "Uploading…";
    const url = await uploadToImgbb(file);
    uploadLabel.textContent = "Upload Image";
    if (url) {
      pfPendingImageUrl = url;
      urlInput.value = url;
      previewEl.textContent = "Image ready: " + url.split("/").pop();
    }
    e.target.value = "";
  });

  urlInput.addEventListener("input", () => {
    pfPendingImageUrl = urlInput.value.trim();
    previewEl.textContent = pfPendingImageUrl ? "URL set" : "";
  });

  document.getElementById("btn-pf-submit").addEventListener("click", async () => {
    const title       = document.getElementById("pf-title").value.trim();
    const description = document.getElementById("pf-description").value.trim();
    const errorEl     = document.getElementById("pf-error");
    errorEl.textContent = "";

    if (!title)             { errorEl.textContent = "Title is required."; return; }
    if (!pfPendingImageUrl) { errorEl.textContent = "Please upload or paste an image."; return; }

    await addDoc(collection(db, "portfolio"), {
      title, description, imageUrl: pfPendingImageUrl, createdAt: serverTimestamp()
    });

    document.getElementById("pf-title").value       = "";
    document.getElementById("pf-description").value = "";
    urlInput.value    = "";
    pfPendingImageUrl = "";
    previewEl.textContent = "";
  });

  onSnapshot(collection(db, "portfolio"), (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    renderPortfolio(items, true);
  });
}

function renderPortfolio(items, isAdmin = false) {
  const list = document.getElementById(isAdmin ? "portfolio-list" : "portfolio-list");
  if (items.length === 0) {
    list.innerHTML = '<p class="empty-state">No portfolio items yet.</p>';
    return;
  }
  list.innerHTML = items.map(item => `
    <div class="portfolio-card">
      <img src="${esc(item.imageUrl)}" alt="${esc(item.title)}" loading="lazy"
           onerror="this.style.display='none'" />
      <div class="portfolio-card-body">
        <div class="portfolio-card-title">${esc(item.title)}</div>
        ${item.description ? `<div class="portfolio-card-desc">${esc(item.description)}</div>` : ""}
      </div>
      ${isAdmin ? `
      <div class="portfolio-card-actions">
        <button class="btn-remove-admin" data-id="${item.id}">Delete</button>
      </div>` : ""}
    </div>
  `).join("");

  if (isAdmin) {
    list.querySelectorAll(".btn-remove-admin").forEach(btn => {
      btn.addEventListener("click", () => deleteDoc(doc(db, "portfolio", btn.dataset.id)));
    });
  }
}

// ── Prices ──────────────────────────────────────────────────────────────────

let priceItems = [];

function initPrices() {
  onSnapshot(doc(db, "settings", "prices"), (snap) => {
    priceItems = snap.exists() ? (snap.data().items || []) : [];
    renderAdminPrices();
  });

  document.getElementById("btn-pr-submit").addEventListener("click", async () => {
    const name        = document.getElementById("pr-name").value.trim();
    const description = document.getElementById("pr-description").value.trim();
    const price       = document.getElementById("pr-price").value.trim();
    const errorEl     = document.getElementById("pr-error");
    errorEl.textContent = "";

    if (!name || !price) { errorEl.textContent = "Name and price are required."; return; }

    const newItems = [...priceItems, { id: Date.now().toString(), name, description, price }];
    await setDoc(doc(db, "settings", "prices"), { items: newItems });

    document.getElementById("pr-name").value        = "";
    document.getElementById("pr-description").value = "";
    document.getElementById("pr-price").value       = "";
  });
}

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
      input.disabled = true;
      const label = input.parentElement;
      const origText = label.childNodes[0].textContent.trim();
      label.childNodes[0].textContent = " Uploading…";
      const url = await uploadToImgbb(file);
      label.childNodes[0].textContent = " " + origText;
      input.disabled = false;
      e.target.value = "";
      if (!url) {
        const errEl = document.createElement("p");
        errEl.className = "error-msg";
        errEl.textContent = "Upload failed. Please try again.";
        label.after(errEl);
        setTimeout(() => errEl.remove(), 3000);
        return;
      }
      const updated = priceItems.map(p =>
        p.id === input.dataset.itemId ? { ...p, exampleImageUrl: url } : p
      );
      await setDoc(doc(db, "settings", "prices"), { items: updated });
    });
  });
}

// ── Manage Admins ───────────────────────────────────────────────────────────

function initManageAdmins() {
  onSnapshot(collection(db, "admins"), (snap) => {
    const list   = document.getElementById("admin-list");
    const admins = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    list.innerHTML = admins.length
      ? admins.map(a => `
          <div class="admin-row">
            <span>${esc(a.email)}</span>
            ${a.uid === currentUser.uid
              ? '<span class="you-label">(you)</span>'
              : `<button class="btn-remove-admin" data-uid="${a.uid}">Remove</button>`}
          </div>`).join("")
      : '<p class="empty-state">No admins found.</p>';

    list.querySelectorAll(".btn-remove-admin").forEach(btn => {
      btn.addEventListener("click", () => deleteDoc(doc(db, "admins", btn.dataset.uid)));
    });
  });

  const errorEl = document.getElementById("admin-error");

  document.getElementById("btn-add-admin").addEventListener("click", async () => {
    const email = document.getElementById("input-admin-email").value.trim();
    errorEl.textContent = "";
    if (!email) return;
    const usersSnap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
    if (usersSnap.empty) { errorEl.textContent = "No account found for this email."; return; }
    const uid = usersSnap.docs[0].id;
    await setDoc(doc(db, "admins", uid), { email });
    document.getElementById("input-admin-email").value = "";
  });
}

// ── ImgBB upload helper ─────────────────────────────────────────────────────

async function uploadToImgbb(file) {
  const formData = new FormData();
  formData.append("image", file);
  try {
    const res  = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || "Upload failed");
    return data.data.url;
  } catch (err) {
    console.error("ImgBB upload error:", err);
    return null;
  }
}

// ── Utilities ───────────────────────────────────────────────────────────────

function esc(str) {
  if (!str) return "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function statusLabel(s) {
  return { pending: "Pending", in_progress: "In Progress", done: "Done" }[s] || s;
}

function fmtDate(ts) {
  if (!ts) return "—";
  return (ts.toDate ? ts.toDate() : new Date(ts))
    .toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
