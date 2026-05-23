import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, updateDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig, imgbbApiKey } from "./firebase-config.js";

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser         = null;
let currentCommissionId = null;
let allCommissions      = [];
let activeFilter        = "all";
let unsubMessages       = null;

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
  document.getElementById("btn-signout").addEventListener("click", () => signOut(auth));

  // Tab switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => { t.hidden = true; });
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).hidden = false;
    });
  });

  // Status filters
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.status;
      renderCommissions();
    });
  });

  // Detail panel controls
  document.getElementById("btn-close-detail").addEventListener("click", closeDetail);

  document.getElementById("detail-status").addEventListener("change", async () => {
    if (!currentCommissionId) return;
    await updateDoc(doc(db, "commissions", currentCommissionId), {
      status: document.getElementById("detail-status").value,
      updatedAt: serverTimestamp()
    });
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
      const formData = new FormData();
      formData.append("image", file);
      try {
        const res  = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, { method: "POST", body: formData });
        const data = await res.json();
        if (!data.success) throw new Error(data.error?.message || "Upload failed");
        await updateDoc(doc(db, "commissions", currentCommissionId), {
          artUrls: arrayUnion(data.data.url),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.error("ImgBB upload error:", err);
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
      artUrls: arrayUnion(url),
      updatedAt: serverTimestamp()
    });
    input.value = "";
  });

  document.getElementById("btn-send-message").addEventListener("click", sendAdminMessage);
  document.getElementById("input-message").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendAdminMessage();
  });

  initNewCommissionModal();
  initManageAdmins();
  subscribeCommissions();
}

// ── Commission list ─────────────────────────────────────────────────────────

function subscribeCommissions() {
  onSnapshot(collection(db, "commissions"), (snap) => {
    allCommissions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    allCommissions.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
    renderCommissions();
    // Keep detail panel art fresh when commission data changes
    if (currentCommissionId) {
      const c = allCommissions.find(c => c.id === currentCommissionId);
      if (c) renderArtGallery(c.artUrls || []);
    }
  });
}

function renderCommissions() {
  const list = document.getElementById("commission-list");
  const visible = activeFilter === "all"
    ? allCommissions
    : allCommissions.filter(c => c.status === activeFilter);

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
        <span class="status-badge status-${c.status}">${statusLabel(c.status)}</span>
        <button class="btn-view" data-id="${c.id}">View →</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".btn-view").forEach(btn => {
    btn.addEventListener("click", () => openDetail(btn.dataset.id));
  });
}

// ── Commission detail panel ─────────────────────────────────────────────────

function openDetail(id) {
  const c = allCommissions.find(c => c.id === id);
  if (!c) return;
  currentCommissionId = id;

  document.getElementById("detail-title").textContent       = c.title;
  document.getElementById("detail-client").textContent      = "Client: " + c.clientEmail;
  document.getElementById("detail-description").textContent = c.description || "";
  document.getElementById("detail-status").value            = c.status;
  renderArtGallery(c.artUrls || []);

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
    authorUID:   currentUser.uid,
    authorEmail: currentUser.email,
    isAdmin:     true,
    text,
    createdAt:   serverTimestamp()
  });
  await updateDoc(doc(db, "commissions", currentCommissionId), { updatedAt: serverTimestamp() });
}

// ── New Commission Modal ────────────────────────────────────────────────────

function initNewCommissionModal() {
  const modal   = document.getElementById("modal-new-commission");
  const errorEl = document.getElementById("nc-error");

  document.getElementById("btn-new-commission").addEventListener("click", () => {
    modal.hidden = false;
  });

  document.getElementById("btn-nc-cancel").addEventListener("click", () => {
    modal.hidden = true;
    errorEl.textContent = "";
  });

  document.getElementById("btn-nc-submit").addEventListener("click", async () => {
    const email       = document.getElementById("nc-client-email").value.trim();
    const title       = document.getElementById("nc-title").value.trim();
    const description = document.getElementById("nc-description").value.trim();
    errorEl.textContent = "";

    if (!email || !title) {
      errorEl.textContent = "Client email and title are required.";
      return;
    }

    const usersSnap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
    if (usersSnap.empty) {
      errorEl.textContent = "No account found for this email. Ask the client to sign up first.";
      return;
    }

    const clientUID = usersSnap.docs[0].id;
    await addDoc(collection(db, "commissions"), {
      clientUID,
      clientEmail: email,
      title,
      description,
      status:    "pending",
      artUrls:   [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    modal.hidden = true;
    document.getElementById("nc-client-email").value = "";
    document.getElementById("nc-title").value        = "";
    document.getElementById("nc-description").value  = "";
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
    if (usersSnap.empty) {
      errorEl.textContent = "No account found for this email. They need to sign up first.";
      return;
    }

    const uid = usersSnap.docs[0].id;
    await setDoc(doc(db, "admins", uid), { email });
    document.getElementById("input-admin-email").value = "";
  });
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
