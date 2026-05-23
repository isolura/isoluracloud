# Feature Design: May 2026 Batch

**Date:** 2026-05-23  
**Repo:** isolura/isoluracloud  
**Live site:** https://isolura.github.io/isoluracloud/

---

## Overview

Seven new features added to the Iso's Art Commissions site:

1. Price item example images (admin upload, client view)
2. Queue position for clients (anonymous numbered list with "You" highlighted)
3. Admin notes per user (admin-only, stored on user doc)
4. Commission loyalty card (punch card with configurable tiers and rewards)
5. Discount codes (admin generates, client applies at commission submit)
6. Leaderboard (top clients by completed commissions, on welcome page)
7. Payment status checkbox (admin toggles, client sees read-only badge)

---

## Architecture: Option A — Extend Existing Patterns

All new data fits into the existing Firestore structure. Admin.js maintains cached docs under `settings/` (consistent with existing `settings/queueInfo`). Clients read minimal data — their own commissions snapshot (already subscribed) plus a few settings docs.

---

## Data Model Changes

### Extend `settings/prices` items array
Each item gains an optional field:
```
exampleImageUrl: string  // ImgBB URL, optional
```

### Extend `commissions/{id}`
```
paid: boolean           // default false; toggled by admin
discountCode: string    // optional; set at commission submit time
discountText: string    // the human-readable discount description
```

### New `discountCodes/{code}` collection
Doc ID = the code string itself (case-insensitive lookup done by normalizing to lowercase).
```
discount: string     // e.g. "10% off" or "$5 off"
usesLeft: number     // decremented when a commission using this code is submitted
totalUses: number    // original total, for display only
createdAt: timestamp
```

### New `adminNotes/{uid}` collection
Admin-only read/write. Single field:
```
notes: string
```

### New `settings/queueOrder`
Written by admin.js alongside `settings/queueInfo`. Read by client.js.
```
entries: [{ uid: string, position: number, status: string }]
```

### New `settings/loyaltyCard`
```
tier1Count:  number  // commissions needed for first reward (default 5)
tier1Reward: string  // reward description
tier2Count:  number  // commissions needed for second reward (default 10)
tier2Reward: string  // reward description
```

### New `settings/leaderboard`
Maintained by admin.js every time the commissions snapshot fires.
```
entries: [{ uid: string, displayName: string, doneCount: number }]
updatedAt: timestamp
```
Maximum 10 entries, sorted by `doneCount` descending. Only users with at least 1 done commission appear.

---

## Feature Details

### 1. Price Item Example Images

**Admin (admin.html / admin.js — Prices tab)**
- Each row in the price table gains an image upload button (same ImgBB flow as portfolio/art uploads).
- On upload success, `exampleImageUrl` is saved back into that item in the `settings/prices` items array.
- Rows with an image show a small thumbnail; rows without show nothing extra.

**Client (client.html / client.js — Prices tab)**
- Price rows with `exampleImageUrl` render a thumbnail that opens the full image in a new tab.
- Rows without an image render exactly as before.

---

### 2. Queue Position for Clients

**Client (client.html / client.js — Queue tab)**
- Replaces the three plain stat cards.
- Fetches the ordered queue by subscribing to `settings/queueInfo` (already subscribed) plus reading the ordered list from a new `settings/queueOrder` doc (see below).
- Actually: admin.js writes a `settings/queueOrder` doc containing the ordered array of `{ uid, position }` entries alongside `settings/queueInfo`. Client.js reads this to find the client's position.
- Renders an ordered list: each row shows `#N — [status badge]`. The client's own row(s) are highlighted and labeled "You."
- A summary line at the top: "You are #N in the queue" (or "You have no active commissions in the queue" if none).
- Other clients' display names are NOT shown — rows are anonymous except for the current user's own entries.

**New Firestore doc: `settings/queueOrder`**
```
entries: [{ uid: string, position: number, status: string }]
```
Written by admin.js whenever the commissions snapshot fires (same place `queueInfo` is written).

---

### 3. Admin Notes Per User

**Admin (admin.html / admin.js — Commission detail panel)**
- Below the display name line in the detail panel, add a "Client Notes" textarea.
- When the detail panel opens, load `users/{clientUID}.adminNotes` and populate the textarea.
- Save on blur (not on every keystroke). Show a brief "Saved" confirmation.
- Notes are never sent to client.html.

**Firestore rules**
- `users/{uid}.adminNotes` is writable only by admins (check `admins/{request.auth.uid}` exists).
- Clients can read their own user doc but the `adminNotes` field should be excluded. Since Firestore field-level rules aren't supported, the cleanest approach is to store admin notes in a separate path: `adminNotes/{uid}` (a separate collection, admin read/write only).

**Revised storage:** `adminNotes/{uid}` collection, single field `notes: string`. Firestore rules: only admins can read or write this collection.

---

### 4. Commission Loyalty Card

**Client (client.html / client.js — Welcome tab)**
- Below the display name card, show a punch card widget.
- Count of done commissions comes from the existing `commissions` snapshot (filtered by `status === "done"`).
- Reads `settings/loyaltyCard` for thresholds and reward text.
- Renders: a row of filled/empty circles up to the next tier, tier label, reward text at each milestone.
- If the client has reached tier 2, show a special congratulations state.
- If `settings/loyaltyCard` doesn't exist yet, show nothing (feature is off until Iso configures it).

**Admin (admin.html / admin.js — new "Settings" section on the Admins tab)**
- Below the existing admin management UI, add a "Loyalty Card Settings" section.
- Four inputs: Tier 1 count, Tier 1 reward text, Tier 2 count, Tier 2 reward text.
- A Save button writes to `settings/loyaltyCard`.
- Loads current values on tab open.

---

### 5. Discount Codes

**Client (client.html / client.js — Prices tab)**
- Below the price table, add a "Have a discount code?" collapsible section with a text input and "Apply" button.
- On Apply: look up `discountCodes/{code.toLowerCase()}` in Firestore.
  - Not found or `usesLeft <= 0`: show "Invalid or expired code."
  - Found and valid: show "Code applied: [discount text]" in green. Store `{ code, discountText }` in a module-level variable `activeDiscount`.
- The applied discount persists in memory until the page reloads; it is not saved to localStorage.
- When a commission is submitted (`btn-rf-submit`): if `activeDiscount` is set, include `discountCode` and `discountText` on the commission doc, then call a Firestore transaction to decrement `usesLeft` on `discountCodes/{code}`.
- After submission, clear `activeDiscount`.

**Admin (admin.html / admin.js — Prices tab)**
- Below the existing price add form, add a "Discount Codes" section.
- Shows a list of existing codes with their remaining uses.
- Form to generate a new code: code string input, discount description input, number of uses input, Generate button.
- Writes to `discountCodes/{code.toLowerCase()}`.
- No delete button needed initially (admin can just set usesLeft to 0 mentally; can add later).

**Commission card (client view)**
- If `discountText` exists on a commission, show it as a small note on the commission card: "Discount applied: [text]".

---

### 6. Leaderboard

**Admin.js maintenance**
- In `subscribeCommissions()`, after computing the queue, also compute the leaderboard:
  - Filter `allCommissions` by `status === "done"`, group by `clientUID`, count per user.
  - Join with display names (already available on the commission docs as `displayName`).
  - Take top 10, write to `settings/leaderboard`.

**Client (client.html / client.js — Welcome tab)**
- Below the loyalty card widget, show a "Top Commissioners" leaderboard card.
- Subscribes to `settings/leaderboard` (single doc read).
- Renders a numbered list: `#1 DisplayName — 12 commissions`, etc.
- If the current user appears in the list, highlight their row.
- If `settings/leaderboard` doesn't exist, show nothing.

---

### 7. Payment Status

**Admin (admin.html / admin.js)**
- Commission detail panel: add a "Payment received" checkbox below the status dropdown. Toggling it updates `commissions/{id}.paid`.
- Commission list rows: show a small "Paid ✓" or "Unpaid" badge alongside the status badge.

**Client (client.html / client.js)**
- Commission cards: show "Payment received ✓" (styled in accent color) when `paid === true`.
- No UI to change it — read-only.

---

## Firestore Rules Changes

New rules needed:
- `adminNotes/{uid}`: read and write only if `request.auth.uid` exists in `admins` collection.
- `discountCodes/{code}`: read by any authenticated user; write only by admins.
- `settings/loyaltyCard`: read by any authenticated user; write only by admins.
- `settings/leaderboard`: read by any authenticated user; write only by admins.
- `settings/queueOrder`: read by any authenticated user; write only by admins.

---

## Files Changed

| File | Changes |
|------|---------|
| `admin.html` | Loyalty card settings section on Admins tab; discount codes section on Prices tab; payment checkbox in detail panel; paid badge on commission rows |
| `client.html` | Queue position list; example image thumbnails in prices; discount code input; loyalty card widget; leaderboard; payment badge on commission cards |
| `js/admin.js` | Price image upload; admin notes load/save; loyalty card settings; discount code management; leaderboard computation; queue order write; payment status toggle |
| `js/client.js` | Queue position rendering; price example thumbnails; discount code apply + commission submit integration; loyalty card widget; leaderboard display; payment badge |
| `firestore.rules` | New rules for `adminNotes`, `discountCodes`, `settings/*` new docs |

No new files needed.
