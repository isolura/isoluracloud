import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, getDoc, onSnapshot,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig, emailjsConfig } from "./firebase-config.js";

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser   = null;
let messageUnsubs = {};

// ── Auth guard ──────────────────────────────────────────────────────────────

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  currentUser = user;
  await setDoc(doc(db, "users", user.uid), { email: user.email }, { merge: true });
  document.getElementById("client-email").textContent = user.email;
  initPage();
});

// ── Page initialization ─────────────────────────────────────────────────────

function initPage() {
  initTheme();
  document.getElementById("btn-signout").addEventListener("click", () => signOut(auth));

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll(".tab-nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.target));
  });

  initWelcome();
  initCommissions();
  initQueue();
  initPortfolio();
  initPrices();
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(t => { t.hidden = true; });
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (btn) btn.classList.add("active");
  const content = document.getElementById("tab-" + tabName);
  if (content) content.hidden = false;
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

// ── Welcome tab ─────────────────────────────────────────────────────────────

async function initWelcome() {
  const userSnap = await getDoc(doc(db, "users", currentUser.uid));
  const displayName = userSnap.exists() ? (userSnap.data().displayName || "") : "";

  const greeting = document.getElementById("welcome-greeting");
  const input    = document.getElementById("input-display-name");
  const status   = document.getElementById("name-status");

  greeting.textContent = displayName ? `Welcome, ${displayName}!` : "Welcome!";
  input.value = displayName;

  document.getElementById("btn-save-name").addEventListener("click", async () => {
    const name = input.value.trim();
    if (!name) return;
    await setDoc(doc(db, "users", currentUser.uid), { displayName: name }, { merge: true });
    greeting.textContent = `Welcome, ${name}!`;
    status.textContent = "Saved!";
    setTimeout(() => { status.textContent = ""; }, 2000);
  });
}

// ── My Commissions tab ──────────────────────────────────────────────────────

function initCommissions() {
  document.getElementById("btn-request").addEventListener("click", () => {
    document.getElementById("request-form").hidden = false;
  });

  document.getElementById("btn-rf-cancel").addEventListener("click", () => {
    document.getElementById("request-form").hidden = true;
    document.getElementById("rf-error").textContent = "";
  });

  document.getElementById("btn-rf-submit").addEventListener("click", async () => {
    const title       = document.getElementById("rf-title").value.trim();
    const description = document.getElementById("rf-description").value.trim();
    const errorEl     = document.getElementById("rf-error");
    errorEl.textContent = "";
    if (!title) { errorEl.textContent = "Please enter a title for your commission."; return; }

    const userSnap    = await getDoc(doc(db, "users", currentUser.uid));
    const displayName = userSnap.exists() ? (userSnap.data().displayName || "") : "";

    await addDoc(collection(db, "commissions"), {
      clientUID: currentUser.uid, clientEmail: currentUser.email,
      displayName, title, description,
      status: "pending", artUrls: [], fileUrls: [], paid: false,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });

    notifyAdmin("New commission request", `${displayName || currentUser.email} submitted: "${title}"\n\n${description}`);

    document.getElementById("request-form").hidden = true;
    document.getElementById("rf-title").value       = "";
    document.getElementById("rf-description").value = "";
  });

  const q = query(collection(db, "commissions"), where("clientUID", "==", currentUser.uid));
  onSnapshot(q, (snap) => {
    const commissions = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
    renderCommissions(commissions);
  });
}

function renderCommissions(commissions) {
  const list = document.getElementById("commission-list");
  Object.values(messageUnsubs).forEach(unsub => unsub());
  messageUnsubs = {};

  if (commissions.length === 0) {
    list.innerHTML = '<p class="empty-state">No commissions yet. Click "+ Request Commission" to get started!</p>';
    return;
  }

  list.innerHTML = commissions.map(c => `
    <div class="commission-card" data-id="${c.id}">
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
      ${c.artUrls && c.artUrls.length ? `
        <div class="art-gallery" style="padding:10px 16px;background:var(--surface-2);border-bottom:1px solid var(--border-light);">
          ${c.artUrls.map(url => `
            <a href="${esc(url)}" target="_blank" rel="noopener">
              <img src="${esc(url)}" alt="Commission art" class="art-thumb"
                   onerror="this.parentElement.style.display='none'" />
            </a>`).join("")}
        </div>` : ""}
      ${c.fileUrls && c.fileUrls.length ? `
        <div class="file-links" style="padding:8px 16px;border-bottom:1px solid var(--border-light);">
          ${c.fileUrls.map(url => {
            const name = url.split("/").pop().split("?")[0] || "File";
            return `<a href="${esc(url)}" target="_blank" rel="noopener" class="file-link-btn">📎 ${esc(name)}</a>`;
          }).join("")}
        </div>` : ""}
      <div class="messages-section" style="padding:12px 16px;">
        <div class="message-thread" id="thread-${c.id}"></div>
        <div class="message-input-row" style="margin-top:8px;">
          <input class="input-message" data-id="${c.id}" type="text" placeholder="Write a message…" />
          <button class="btn-send btn-primary" data-id="${c.id}" style="padding:6px 12px;">Send</button>
        </div>
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".btn-send").forEach(btn => {
    btn.addEventListener("click", () => sendMessage(btn.dataset.id));
  });
  list.querySelectorAll(".input-message").forEach(input => {
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(input.dataset.id); });
  });

  commissions.forEach(c => {
    const q = query(collection(db, "commissions", c.id, "messages"), orderBy("createdAt", "asc"));
    messageUnsubs[c.id] = onSnapshot(q, (snap) => {
      const thread = document.getElementById("thread-" + c.id);
      if (!thread) return;
      const msgs = snap.docs.map(d => d.data());
      thread.innerHTML = msgs.length
        ? msgs.map(m => `
            <div class="message-bubble ${m.isAdmin ? "admin" : "client"}">
              <span class="message-author">${m.isAdmin ? "Iso" : "You"}</span>
              ${esc(m.text)}
            </div>`).join("")
        : '<p class="empty-state">No messages yet.</p>';
      thread.scrollTop = thread.scrollHeight;
    });
  });
}

async function sendMessage(commissionId) {
  const input = document.querySelector(`.input-message[data-id="${commissionId}"]`);
  const text  = input.value.trim();
  if (!text) return;
  input.value = "";
  await addDoc(collection(db, "commissions", commissionId, "messages"), {
    authorUID: currentUser.uid, authorEmail: currentUser.email,
    isAdmin: false, text, createdAt: serverTimestamp()
  });
  await setDoc(doc(db, "commissions", commissionId), { updatedAt: serverTimestamp() }, { merge: true });
  notifyAdmin("New message from client", `${currentUser.email} sent a message:\n\n"${text}"`);
}

// ── Queue tab ───────────────────────────────────────────────────────────────

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

// ── Portfolio tab ───────────────────────────────────────────────────────────

function initPortfolio() {
  onSnapshot(collection(db, "portfolio"), (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    const list = document.getElementById("portfolio-list");
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
      </div>
    `).join("");
  });
}

// ── Prices tab ──────────────────────────────────────────────────────────────

function initPrices() {
  onSnapshot(doc(db, "settings", "prices"), (snap) => {
    const items = snap.exists() ? (snap.data().items || []) : [];
    const tbody = document.getElementById("price-rows");
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No prices listed yet.</td></tr>';
      return;
    }
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
  });
}

// ── Email notifications ─────────────────────────────────────────────────────

function notifyAdmin(subject, message) {
  const { serviceId, templateId, publicKey, adminEmail } = emailjsConfig;
  if ([serviceId, templateId, publicKey, adminEmail].some(v => v.startsWith("PASTE-"))) return;
  fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id:  serviceId,
      template_id: templateId,
      user_id:     publicKey,
      template_params: { to_email: adminEmail, subject, message, from_email: currentUser.email }
    })
  }).catch(() => {});
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
