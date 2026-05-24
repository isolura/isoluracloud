# Iso's Art Commissions — Project Status

**Repo:** https://github.com/isolura/isoluracloud  
**Live site:** https://isolura.github.io/isoluracloud/  
**Firebase project:** isoluracloud  
**Last updated:** 2026-05-23 (May 2026 feature batch)

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
- **Welcome tab** — set/update display name; commission loyalty punch card (configurable tiers + rewards, shown when Iso configures it); top commissioners leaderboard
- **My Commissions tab** — submit commission requests (title + description, optional discount code); view status, delivered art (images + file download links), message thread with Iso; payment received badge (read-only); archive button to move commission out of main view
- **Old Commissions tab** — archived commissions with unarchive button; keeps dashboard tidy
- **Queue tab** — anonymous numbered list showing your position; own entries highlighted with "You" tag and position summary
- **Portfolio tab** — browse Iso's portfolio gallery
- **Prices tab** — view Iso's price list with example image thumbnails; discount code input (applied at commission submit, decrements available uses)
- **Light/Mid/Dark theme toggle** — saved to localStorage

### Admin Dashboard (admin.html / admin.js)
- **All Commissions tab** — filterable by status; searchable; commission detail panel shows client info, status dropdown, payment received checkbox, admin-only notes textarea (private, per-client), art gallery, file links, message thread; paid/unpaid badge on commission rows
- **Queue tab** — numbered live list of active commissions; writes `settings/queueOrder` on every change so client queue tab stays live
- **Portfolio tab** — add/delete portfolio items via ImgBB upload or URL paste
- **Prices tab** — add/remove price items; per-item example image upload; discount code generator (code name, discount text, number of uses) with live list showing remaining uses and delete button
- **Manage Admins tab** — add/remove admins; loyalty card tier/reward configuration (tier 1 and tier 2 thresholds and reward text)
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
| `paid` | boolean | Default false; admin toggles |
| `archived` | boolean | Default false/absent; client toggles |
| `discountCode` | string | Optional; set at submit time |
| `discountText` | string | Optional; human-readable discount description |
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
| `items` | array | `[{id, name, description, price, exampleImageUrl?}]` |

### `settings/queueInfo`
| Field | Type | Notes |
|-------|------|-------|
| `totalPending` | number | Updated by admin.js on every commission change |
| `totalInProgress` | number | |

### `settings/queueOrder`
| Field | Type | Notes |
|-------|------|-------|
| `entries` | array | `[{uid, position, status}]` active commissions in order |

### `settings/loyaltyCard`
| Field | Type | Notes |
|-------|------|-------|
| `tier1Count` | number | Commissions needed for tier 1 reward |
| `tier1Reward` | string | |
| `tier2Count` | number | Commissions needed for tier 2 reward |
| `tier2Reward` | string | |

### `settings/leaderboard`
| Field | Type | Notes |
|-------|------|-------|
| `entries` | array | `[{uid, displayName, doneCount}]` top 10 by done count |
| `updatedAt` | timestamp | |

### `adminNotes/{uid}`
| Field | Type | Notes |
|-------|------|-------|
| `notes` | string | Admin-only; never exposed to clients |

### `discountCodes/{code}`
| Field | Type | Notes |
|-------|------|-------|
| `discount` | string | Human-readable description, e.g. "10% off" |
| `usesLeft` | number | Decremented atomically (transaction) at commission submit |
| `totalUses` | number | Original total for display |
| `createdAt` | timestamp | |

---

## Things That Still Need Configuring

### 1. Firestore Rules — REQUIRED
The rules file must be manually published to Firebase after each update. Iso needs to:
1. Open `firestore.rules` in the repo
2. Copy the contents
3. Firebase Console → Firestore Database → Rules → paste → **Publish**

Current rules cover: `users`, `admins`, `commissions`, `commissions/messages`, `portfolio`, `settings/*`, `adminNotes`, `discountCodes`.

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
