# GCA Golden Triangle website

Website and committee admin panel for the Gujarati Cultural Association of the Golden Triangle (Kitchener · Waterloo · Cambridge).

It is a plain static site: HTML, CSS and vanilla JavaScript with no build step and no dependencies. It runs on GitHub Pages, Netlify, Vercel or any web host, and also works when `index.html` is opened directly from disk.

## Pages

| Page | File | What it does |
| --- | --- | --- |
| Home | `index.html` | Hero with next event, what's on, programs, darshan, gallery, membership, sponsors |
| Events | `events.html` | Featured event, upcoming events by category, past events |
| Event | `event.html?id=…` | Details, map link, add to calendar (.ics), ticket selection |
| Shop | `shop.html` | Tickets for upcoming events and merchandise |
| Checkout | `checkout.html` | Bag review, contact details, Interac e-Transfer or pay-at-event |
| Membership | `membership.html` | Plans and application form |
| About | `about.html` | Mission, story, programs, committee, sponsorship tiers |
| Gallery | `gallery.html` | Albums with a lightbox |
| Contact | `contact.html` | Contact form (`?topic=Sponsorship` preselects a topic) |
| Admin | `admin/` | Committee admin panel |

## Running locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Admin panel

Open `/admin/` (there is also a "Committee login" link in the footer).

* **First login:** the default password is `gca-admin`. You must choose a new one before continuing.
* **Content:** events, tickets & shop items, gallery photos (including bulk upload), darshan, membership plans, sponsors, committee, announcements, all page text and site settings (contact details, e-Transfer email, social links, logo).
* **Community:** orders (mark paid, notes, email customer, CSV export), members (activate, renew, add manually, CSV export), contact-form messages, and newsletter subscribers (copy all emails for BCC, CSV export).
* **Dashboard:** upcoming events, money awaiting payment, amount collected, members, unread messages and ticket sales per event.

### How publishing works

Published content lives in **`data/content.js`**; that file is what every visitor sees.

1. Edits in the admin are saved as a **draft** in your browser. While a draft exists, the public site shows your changes *in your browser only*, with a yellow "previewing unpublished changes" bar.
2. When you're happy, go to **Publish & backup → Download content.js**.
3. Replace `data/content.js` in this repository with the downloaded file (on GitHub: open the `data` folder → *Add file* → *Upload files* → commit).
4. Once the site has redeployed, click **Clear draft**.

**Images:** uploaded images are compressed and embedded in `content.js`. That's convenient for a handful of photos, but for a large gallery put the files in `assets/uploads/` and use **Use a link** with a path such as `assets/uploads/navratri-01.jpg`.

**Backups:** *Publish & backup → Download backup* saves everything (content plus orders, members, messages and subscribers) as JSON, and *Restore from file* loads it back.

## Current limitations (read before going live)

The site ships with a **local storage adapter**. Until a shared backend is connected:

* **Visitor submissions stay in the visitor's own browser.** Orders, membership applications, contact messages and newsletter sign-ups are saved where they were made, so the committee will **not** see them in the admin. Don't take real orders until a backend is connected.
* **The admin login only keeps out casual visitors.** The password is a salted SHA-256 hash stored in the browser, and anyone with developer tools can get past it. That is harmless today because the admin can only edit a local draft; publishing still requires write access to this repository. Use real server-side authentication once a backend is connected.
* Each browser has its own admin password and draft.

## Connecting your own storage

All reads and writes go through one object, `GCA.data.adapter`. To use a real database (Supabase, Firebase, your own API…), write an adapter with these methods and assign it **after** `assets/js/core.js` loads and **before** `site.js` / `admin.js`:

```js
// assets/js/adapter.js — include after core.js on every page and in admin/index.html
GCA.data.adapter = {
  name: 'remote',

  // Content: return { content, isDraft }. Merge with the defaults via GCA.data.normalize().
  async loadContent() { /* … */ },
  async saveDraft(content) { /* … */ },
  async discardDraft() { /* … */ },

  // Records: type is 'orders' | 'members' | 'messages' | 'subscribers'.
  async list(type) { /* return newest first */ },
  async add(type, record) { /* record already has id + createdAt */ },
  async update(type, id, patch) { /* … */ },
  async remove(type, id) { /* … */ },
  async replace(type, records) { /* used by restore / delete-all */ },

  // Admin auth (replace with your provider's real auth).
  async getAuth() { /* … */ },
  async setAuth(value) { /* … */ },
};
```

With a remote adapter, `saveDraft` can write straight to the live content, which removes the download-and-upload publishing step. See `LocalAdapter` in `assets/js/core.js` for a complete reference implementation.

## Brand

* **Logo:** `assets/img/logo-mark.svg`, a diya whose flame is a three-petal lotus (one petal per city), inside a bandhani dot ring. `favicon.svg` is the same mark. A replacement logo can be uploaded under *Settings → Branding*.
* **Colours:** kumkum red `#9f2a1f`, deep red `#4f140f`, marigold `#d8962b`, ink `#1d1814`, paper `#f7f2e9`. Placeholder artwork uses textile patterns (bandhani, patola, Kutch mirror work) in red, marigold, indigo and green.
* **Type:** Newsreader (headings), Hind Vadodara (text; designed for Gujarati and Latin), Noto Serif Gujarati (Gujarati display lines). All three load from Google Fonts.

## Files

```
index.html, events.html, event.html, shop.html, checkout.html,
membership.html, about.html, gallery.html, contact.html
admin/index.html          admin panel shell
data/content.js           published content (replace to publish)
assets/css/site.css       public site styles
assets/css/admin.css      admin styles
assets/js/core.js         storage adapter, utilities, cart, pattern art
assets/js/site.js         public site rendering
assets/js/admin.js        admin panel
assets/img/               logo and favicon
```

## Sample content

Events, dates, venues, prices, membership fees, sponsorship tiers, the e-Transfer address and the statistics on the home page are **placeholders**. Replace them with the association's real details in the admin, then publish.
