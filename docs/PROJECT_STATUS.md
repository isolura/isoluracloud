# Iso's Art Commissions — Project Status

**Repo:** https://github.com/isolura/isoluracloud  
**Live site:** https://isolura.github.io/isoluracloud/  
**Firebase project:** isoluracloud  
**Last updated:** 2026-05-23

---

## What This Site Is

A GitHub Pages + Firebase art commission site for Iso. Clients sign up, request commissions, message Iso, and view their delivered art. Iso manages everything from an admin dashboard.

---

## Tech Stack

| Layer | Service |
|-------|---------|
| Hosting | GitHub Pages (main branch) |
| Auth | Firebase Authentication (email/password + Google) |
| Database | Firestore |
| Image hosting | ImgBB (free API, key in firebase-config.js) |
| Email notifications | EmailJS (optional, needs setup) |

No build step — plain HTML/CSS/JS using Firebase CDN modules.

---

## File Structure

```
index.html              ← Login page (email/password, Google, forgot password)
client.html             ← Client dashboard (5 tabs)
admin.html              ← Admin dashboard (5 tabs)
css/style.css           ← Shared styles + light/mid/dark theme variables
js/firebase-config.js   ← All config keys (Firebase, ImgBB, EmailJS)
js/auth.js              ← Auth logic, routing, forgot password
js/client.js            ← Client dashboard logic
js/admin.js             ← Admin dashboard logic
firestore.rules         ← Firestore security rules
storage.rules           ← Firebase Storage rules (not in use — uses ImgBB instead)
```

---

## Features Built

### Auth (index.html / auth.js)
- Email/password sign in and sign up
- Google sign-in (OAuth popup)
- Forgot password (sends Firebase reset email)
- Post-login routing: admins → admin.html, everyone else → client.html

### Client Dashboard (client.html / client.js)
- **Welcome tab** — set/update display name (alias shown to Iso); greeting updates with name
- **My Commissions tab** — submit commission requests (title + description); view status, delivered art (images + PSD download links), message thread with Iso
- **Queue tab** — shows live count of Iso's pending and in-progress commissions
- **Portfolio tab** — browse Iso's portfolio gallery
- **Prices tab** — view Iso's price list
- **Light/Mid/Dark theme toggle** — saved to localStorage

### Admin Dashboard (admin.html / admin.js)
- **All Commissions tab** — filterable by status (All/Pending/In Progress/Done); searchable by title, email, display name, or description keyword; commission detail panel shows client info, display name, status dropdown, art gallery, PSD/file links, message thread
- **Queue tab** — numbered live list of all active (pending + in_progress) commissions sorted by creation date; stat cards for counts
- **Portfolio tab** — add portfolio items (title, description, image via ImgBB upload or paste URL); delete items
- **Prices tab** — add/remove price list items (type, description, price); table view
- **Manage Admins tab** — add admin by email, remove admins
- **Light/Mid/Dark theme toggle** — saved to localStorage

### Image / File Delivery
- Images uploaded via ImgBB API (PNG, GIF, JPG, WEBP)
- PSD/source files attached via URL paste (Google Drive, Dropbox, etc.) — shown as download links to clients

### Email Notifications (client.js)
- Notifies Iso's email when a client submits a new commission
- Notifies Iso's email when a client sends a message
- Uses EmailJS REST API — silently skipped if not configured

---

## Firestore Data Model

### `users/{uid}`
| Field | Type | Notes |
|-------|------|-------|
| `email` | string | Written on every login |
| `displayName` | string | Set by user on Welcome tab |

### `admins/{uid}`
| Field | Type | Notes |
|-------|------|-------|
| `email` | string | For display in admin list |

### `commissions/{id}`
| Field | Type | Notes |
|-------|------|-------|
| `clientUID` | string | Firebase Auth UID |
| `clientEmail` | string | |
| `displayName` | string | Client's display name at time of request |
| `title` | string | |
| `description` | string | |
| `status` | string | `pending` / `in_progress` / `done` |
| `artUrls` | string[] | Image URLs (from ImgBB) |
| `fileUrls` | string[] | PSD/source file URLs |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `commissions/{id}/messages/{id}`
| Field | Type | Notes |
|-------|------|-------|
| `authorUID` | string | |
| `authorEmail` | string | |
| `isAdmin` | boolean | true = Iso's message |
| `text` | string | |
| `createdAt` | timestamp | |

### `portfolio/{id}`
| Field | Type | Notes |
|-------|------|-------|
| `title` | string | |
| `description` | string | |
| `imageUrl` | string | |
| `createdAt` | timestamp | |

### `settings/prices`
| Field | Type | Notes |
|-------|------|-------|
| `items` | array | `[{id, name, description, price}]` |

### `settings/queueInfo`
| Field | Type | Notes |
|-------|------|-------|
| `totalPending` | number | Updated by admin.js on every commission change |
| `totalInProgress` | number | |

---

## Things That Still Need Configuring

### 1. Firestore Rules — REQUIRED
The updated rules file hasn't been published yet. Iso needs to:
1. Open `firestore.rules` in the repo
2. Copy the contents
3. Firebase Console → Firestore Database → Rules → paste → **Publish**

(Adds read/write access for `/settings` and `/portfolio` collections)

### 2. Making Iso an Admin — REQUIRED
Iso needs to be in the `admins` Firestore collection to access admin.html:
1. Firebase Console → Authentication → Users → find Iso's email → copy UID
2. Firebase Console → Firestore → create collection `admins` → document ID = Iso's UID → field: `email` = her email

### 3. EmailJS Notifications — OPTIONAL
To receive email notifications when clients submit commissions or send messages:
1. Sign up at emailjs.com (free)
2. Add Email Service → connect Gmail (or other)
3. Create Email Template — use variables: `{{subject}}`, `{{message}}`, `{{from_email}}`
4. Collect: Service ID, Template ID, Public Key (Account → General tab), Iso's email
5. Paste all four into `js/firebase-config.js` → commit

Until configured, everything works — notifications are just silently skipped.

---

## Known Issues / Things to Watch

- **Google sign-in** requires `isolura.github.io` to be in Firebase Console → Authentication → Settings → Authorized Domains (already added)
- **ImgBB API key** is hardcoded in `js/firebase-config.js` — public in the repo, which is acceptable for a free image host but worth noting
- **Firebase Storage** not in use (requires Blaze/paid plan) — ImgBB used instead; images are "unlisted" (not publicly searchable, but URL is public if shared)
- **Self-hosting** was discussed but not set up — currently on GitHub Pages

---

## Collaborators

- **Dehlia24** (Dehlia) — developer, has push access to isolura/isoluracloud
- **isolura** (Iso) — site owner, repo owner
