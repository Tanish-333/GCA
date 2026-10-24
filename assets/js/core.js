/*
 * GCA core: shared by the public site and the admin panel.
 *
 *   GCA.util   formatting, escaping, ids, hashing
 *   GCA.art    textile-pattern artwork used wherever a photo is missing
 *   GCA.data   content + records, behind a swappable storage adapter
 *   GCA.cart   the visitor's bag (localStorage)
 *
 * Storage: everything goes through GCA.data.adapter. The bundled
 * LocalAdapter keeps data in this browser (IndexedDB). To move to a real
 * backend, write an adapter with the same methods and assign it to
 * GCA.data.adapter before GCA.data.load() runs. See README.md.
 */
(function () {
  'use strict';
  const GCA = (window.GCA = window.GCA || {});

  /* ---------------------------------------------------------------- util */

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const util = {
    $: (sel, root) => (root || document).querySelector(sel),
    $$: (sel, root) => Array.from((root || document).querySelectorAll(sel)),

    esc(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /** Plain text with blank-line paragraphs -> <p> elements. */
    paragraphs(text) {
      return String(text || '')
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => '<p>' + util.esc(p).replace(/\n/g, '<br>') + '</p>')
        .join('');
    },

    lines(text) {
      return String(text || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    },

    money(n) {
      const v = Number(n) || 0;
      if (v === 0) return 'Free';
      return '$' + (Number.isInteger(v) ? v.toString() : v.toFixed(2));
    },

    moneyExact(n) {
      return '$' + (Number(n) || 0).toFixed(2);
    },

    /** "2026-11-14" -> Date at local midnight (never shifts across time zones). */
    parseDate(iso) {
      if (!iso) return null;
      const [y, m, d] = String(iso).split('-').map(Number);
      if (!y || !m || !d) return null;
      return new Date(y, m - 1, d);
    },

    todayISO() {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    dateParts(iso) {
      const d = util.parseDate(iso);
      if (!d) return { day: '', dd: '', mon: '', month: '', year: '', weekday: '' };
      return {
        day: DAYS[d.getDay()],
        weekday: DAYS_LONG[d.getDay()],
        dd: String(d.getDate()),
        mon: MONTHS[d.getMonth()],
        month: MONTHS_LONG[d.getMonth()],
        year: String(d.getFullYear()),
      };
    },

    /** "Saturday, November 14, 2026" or a range "October 10 – 18, 2026". */
    dateLong(start, end) {
      const a = util.dateParts(start);
      if (!a.dd) return '';
      if (!end || end === start) return a.weekday + ', ' + a.month + ' ' + a.dd + ', ' + a.year;
      const b = util.dateParts(end);
      if (a.year !== b.year) return a.month + ' ' + a.dd + ', ' + a.year + ' – ' + b.month + ' ' + b.dd + ', ' + b.year;
      if (a.month !== b.month) return a.month + ' ' + a.dd + ' – ' + b.month + ' ' + b.dd + ', ' + a.year;
      return a.month + ' ' + a.dd + ' – ' + b.dd + ', ' + a.year;
    },

    dateShort(iso) {
      const p = util.dateParts(iso);
      return p.dd ? p.mon + ' ' + p.dd + ', ' + p.year : '';
    },

    time(t) {
      if (!t) return '';
      const [h, m] = t.split(':').map(Number);
      const suffix = h >= 12 ? 'pm' : 'am';
      const hh = h % 12 || 12;
      return hh + (m ? ':' + String(m).padStart(2, '0') : '') + ' ' + suffix;
    },

    timeRange(a, b) {
      if (!a) return '';
      return b ? util.time(a) + ' – ' + util.time(b) : util.time(a);
    },

    dateTime(isoString) {
      if (!isoString) return '';
      const d = new Date(isoString);
      if (isNaN(d)) return '';
      return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' · ' +
        util.time(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
    },

    uid(prefix) {
      return (prefix ? prefix + '-' : '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },

    /** Human-friendly reference for orders and registrations, e.g. GCA-261024-7Q4K. */
    reference(prefix) {
      const d = new Date();
      const date = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let tail = '';
      for (let i = 0; i < 4; i++) tail += alphabet[Math.floor(Math.random() * alphabet.length)];
      return (prefix || 'GCA') + '-' + date + '-' + tail;
    },

    param(name) {
      return new URLSearchParams(location.search).get(name);
    },

    hash(str) {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    },

    validEmail(v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
    },

    download(filename, text, type) {
      const blob = new Blob([text], { type: type || 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 0);
    },

    csv(rows, columns) {
      const cell = (v) => {
        const s = String(v == null ? '' : v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      return [columns.map((c) => cell(c.label)).join(',')]
        .concat(rows.map((r) => columns.map((c) => cell(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(',')))
        .join('\n');
    },

    toast(message, kind) {
      let host = document.getElementById('toasts');
      if (!host) {
        host = document.createElement('div');
        host.id = 'toasts';
        host.setAttribute('role', 'status');
        host.setAttribute('aria-live', 'polite');
        document.body.appendChild(host);
      }
      const el = document.createElement('div');
      el.className = 'toast' + (kind ? ' toast--' + kind : '');
      el.textContent = message;
      host.appendChild(el);
      requestAnimationFrame(() => el.classList.add('is-in'));
      setTimeout(() => {
        el.classList.remove('is-in');
        setTimeout(() => el.remove(), 300);
      }, 3200);
    },

    /** SHA-256 hex digest. Pure JS so it also works on plain http and file://. */
    sha256(str) {
      const msg = new TextEncoder().encode(str);
      const K = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
      ]);
      const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
      const len = msg.length;
      const total = ((len + 9 + 63) >> 6) << 6;
      const buf = new Uint8Array(total);
      buf.set(msg);
      buf[len] = 0x80;
      const view = new DataView(buf.buffer);
      view.setUint32(total - 4, (len * 8) >>> 0);
      view.setUint32(total - 8, Math.floor((len * 8) / 4294967296));
      const W = new Uint32Array(64);
      const rotr = (x, n) => (x >>> n) | (x << (32 - n));
      for (let i = 0; i < total; i += 64) {
        for (let t = 0; t < 16; t++) W[t] = view.getUint32(i + t * 4);
        for (let t = 16; t < 64; t++) {
          const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
          const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
          W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
        }
        let [a, b, c, d, e, f, g, h] = H;
        for (let t = 0; t < 64; t++) {
          const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) >>> 0;
          const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
          h = g; g = f; f = e; e = (d + t1) >>> 0;
          d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
      }
      return Array.from(H, (x) => x.toString(16).padStart(8, '0')).join('');
    },
  };
  GCA.util = util;

  /* ----------------------------------------------------------------- art */

  // Colourways drawn from Gujarati textiles: kumkum red, haldi marigold,
  // ajrakh indigo and the deep green of Kutch embroidery.
  const PALETTES = {
    red: { bg: '#9f2a1f', fg: '#f1d9a6', accent: '#e0a33c' },
    marigold: { bg: '#d18b22', fg: '#fff3da', accent: '#8e2219' },
    indigo: { bg: '#25305a', fg: '#e9dfcc', accent: '#d8962b' },
    green: { bg: '#2f5d46', fg: '#efe4c9', accent: '#e0a33c' },
  };
  let artCount = 0;

  /**
   * Inline SVG textile pattern.
   *   kind:   'bandhani' (tie-dye dots), 'patola' (ikat diamonds), 'mirror' (Kutch mirror work)
   *   colour: key of PALETTES
   */
  function art(colour, kind, extra) {
    const p = PALETTES[colour] || PALETTES.red;
    const id = 'gca-art-' + ++artCount;
    let tile;
    if (kind === 'patola') {
      tile =
        '<pattern id="' + id + '" width="36" height="36" patternUnits="userSpaceOnUse">' +
        '<path d="M18 2 34 18 18 34 2 18Z" fill="none" stroke="' + p.fg + '" stroke-opacity=".5" stroke-width="1.2"/>' +
        '<path d="M18 10 26 18 18 26 10 18Z" fill="' + p.accent + '"/>' +
        '<path d="M18 14.5 21.5 18 18 21.5 14.5 18Z" fill="' + p.fg + '"/>' +
        '<circle cx="0" cy="0" r="1.6" fill="' + p.fg + '"/><circle cx="36" cy="0" r="1.6" fill="' + p.fg + '"/>' +
        '<circle cx="0" cy="36" r="1.6" fill="' + p.fg + '"/><circle cx="36" cy="36" r="1.6" fill="' + p.fg + '"/>' +
        '</pattern>';
    } else if (kind === 'mirror') {
      tile =
        '<pattern id="' + id + '" width="40" height="40" patternUnits="userSpaceOnUse">' +
        '<circle cx="20" cy="20" r="7" fill="none" stroke="' + p.fg + '" stroke-width="1.4"/>' +
        '<circle cx="20" cy="20" r="3.2" fill="' + p.accent + '"/>' +
        '<g fill="' + p.fg + '" fill-opacity=".75"><circle cx="20" cy="9" r="1.1"/><circle cx="31" cy="20" r="1.1"/><circle cx="20" cy="31" r="1.1"/><circle cx="9" cy="20" r="1.1"/></g>' +
        '<g fill="' + p.fg + '" fill-opacity=".45"><circle cx="0" cy="0" r="2"/><circle cx="40" cy="0" r="2"/><circle cx="0" cy="40" r="2"/><circle cx="40" cy="40" r="2"/></g>' +
        '</pattern>';
    } else {
      tile =
        '<pattern id="' + id + '" width="28" height="28" patternUnits="userSpaceOnUse">' +
        '<circle cx="14" cy="14" r="1.7" fill="' + p.accent + '"/>' +
        '<g fill="' + p.fg + '"><circle cx="14" cy="9.6" r="1.35"/><circle cx="18.4" cy="14" r="1.35"/><circle cx="14" cy="18.4" r="1.35"/><circle cx="9.6" cy="14" r="1.35"/>' +
        '<circle cx="0" cy="0" r="1.35"/><circle cx="28" cy="0" r="1.35"/><circle cx="0" cy="28" r="1.35"/><circle cx="28" cy="28" r="1.35"/></g>' +
        '</pattern>';
    }
    return (
      '<svg class="art" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
      '<defs>' + tile + '</defs>' +
      '<rect width="400" height="300" fill="' + p.bg + '"/>' +
      '<rect width="400" height="300" fill="url(#' + id + ')"/>' +
      (extra || '') +
      '</svg>'
    );
  }

  /** The diya-lotus motif from the logo, centred on a 400x300 canvas. */
  function motif(colour) {
    const p = PALETTES[colour] || PALETTES.red;
    return (
      '<circle cx="200" cy="150" r="92" fill="' + p.bg + '"/>' +
      '<circle cx="200" cy="150" r="80" fill="none" stroke="' + p.fg + '" stroke-width="2.4" stroke-dasharray="0 9" stroke-linecap="round"/>' +
      '<g transform="translate(200 150) scale(2.3) translate(-32 -33)" fill="' + p.fg + '">' +
      '<path d="M32 13c5 6.2 7.5 11.8 7.5 17.1 0 5.1-3 8.9-7.5 11-4.5-2.1-7.5-5.9-7.5-11 0-5.3 2.5-10.9 7.5-17.1z"/>' +
      '<path d="M29.6 41.6c-7.8-.6-13.8-5.1-15.9-12.4 6.3.4 12.2 4.4 15.9 12.4z"/>' +
      '<path d="M34.4 41.6c7.8-.6 13.8-5.1 15.9-12.4-6.3.4-12.2 4.4-15.9 12.4z"/>' +
      '<path d="M16.5 44.2h31c-1.6 5.4-7.6 8.8-15.5 8.8s-13.9-3.4-15.5-8.8z"/>' +
      '<path d="M32 21.8c1.8 2.3 2.7 4.4 2.7 6.3 0 1.9-1 3.3-2.7 4.1-1.7-.8-2.7-2.2-2.7-4.1 0-1.9.9-4 2.7-6.3z" fill="' + p.accent + '"/>' +
      '</g>'
    );
  }

  /** Image if present, otherwise textile art. `seed` keeps the art stable per item. */
  function media(image, colour, seed, alt, opts) {
    if (image) {
      return '<img src="' + util.esc(image) + '" alt="' + util.esc(alt || '') + '" loading="lazy" decoding="async">';
    }
    const kinds = ['bandhani', 'patola', 'mirror'];
    const kind = (opts && opts.kind) || kinds[util.hash(seed || '') % kinds.length];
    const keys = Object.keys(PALETTES);
    const c = PALETTES[colour] ? colour : keys[util.hash(seed || '') % keys.length];
    return art(c, kind, opts && opts.motif ? motif(c) : '');
  }

  GCA.art = { PALETTES, art, motif, media };

  /* ----------------------------------------------------------- storage */

  /** Small key-value store on IndexedDB, falling back to localStorage. */
  const KV = (() => {
    let dbPromise = null;
    function open() {
      if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
          if (!window.indexedDB) return reject(new Error('IndexedDB unavailable'));
          const req = indexedDB.open('gca-site', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('kv');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      }
      return dbPromise;
    }
    async function run(mode, fn) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('kv', mode);
        const req = fn(tx.objectStore('kv'));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    }
    const lsKey = (k) => 'gca:' + k;
    return {
      async get(key) {
        try {
          return await run('readonly', (s) => s.get(key));
        } catch (e) {
          const raw = localStorage.getItem(lsKey(key));
          return raw ? JSON.parse(raw) : undefined;
        }
      },
      async set(key, value) {
        try {
          await run('readwrite', (s) => s.put(value, key));
        } catch (e) {
          localStorage.setItem(lsKey(key), JSON.stringify(value));
        }
      },
      async del(key) {
        try {
          await run('readwrite', (s) => s.delete(key));
        } catch (e) {
          localStorage.removeItem(lsKey(key));
        }
      },
    };
  })();

  const CONTENT_LISTS = ['announcements', 'events', 'products', 'plans', 'deities', 'gallery', 'committee', 'sponsors'];
  const RECORD_TYPES = ['orders', 'members', 'messages', 'subscribers'];
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function normalize(content) {
    const base = window.GCA_PUBLISHED || {};
    const out = clone(content || base);
    CONTENT_LISTS.forEach((k) => {
      if (!Array.isArray(out[k])) out[k] = [];
    });
    out.settings = Object.assign({}, base.settings, out.settings);
    out.pages = Object.assign({}, base.pages, out.pages);
    return out;
  }

  /**
   * LocalAdapter: content drafts and submitted records stored in this browser.
   *
   * Content:  published content comes from data/content.js. An admin's edits
   *           are kept as a draft here until they are published.
   * Records:  orders, members, messages and subscribers. With this adapter
   *           they only exist in the browser that created them, so swap in a
   *           server adapter before taking real orders.
   */
  const LocalAdapter = {
    name: 'local',
    async loadContent() {
      const draft = await KV.get('draft');
      return { content: normalize(draft || window.GCA_PUBLISHED), isDraft: !!draft };
    },
    async saveDraft(content) {
      await KV.set('draft', clone(content));
    },
    async discardDraft() {
      await KV.del('draft');
    },
    async list(type) {
      return (await KV.get('records:' + type)) || [];
    },
    async add(type, record) {
      const all = await this.list(type);
      all.unshift(record);
      await KV.set('records:' + type, all);
      return record;
    },
    async update(type, id, patch) {
      const all = await this.list(type);
      const i = all.findIndex((r) => r.id === id);
      if (i < 0) return null;
      all[i] = Object.assign({}, all[i], patch);
      await KV.set('records:' + type, all);
      return all[i];
    },
    async remove(type, id) {
      const all = await this.list(type);
      await KV.set('records:' + type, all.filter((r) => r.id !== id));
    },
    async replace(type, records) {
      await KV.set('records:' + type, records);
    },
    async getAuth() {
      return KV.get('auth');
    },
    async setAuth(value) {
      await KV.set('auth', value);
    },
  };

  const data = {
    adapter: LocalAdapter,
    LocalAdapter,
    RECORD_TYPES,
    CONTENT_LISTS,
    content: null,
    isDraft: false,
    normalize,

    async load() {
      const res = await this.adapter.loadContent();
      this.content = res.content;
      this.isDraft = res.isDraft;
      return this.content;
    },

    async saveDraft(content) {
      content.updatedAt = new Date().toISOString();
      await this.adapter.saveDraft(content);
      this.content = content;
      this.isDraft = true;
    },

    async discardDraft() {
      await this.adapter.discardDraft();
      return this.load();
    },

    list(type) { return this.adapter.list(type); },
    add(type, record) {
      record.id = record.id || util.uid(type.slice(0, 3));
      record.createdAt = record.createdAt || new Date().toISOString();
      return this.adapter.add(type, record);
    },
    update(type, id, patch) { return this.adapter.update(type, id, patch); },
    remove(type, id) { return this.adapter.remove(type, id); },

    /** The text of a new data/content.js containing `content`. */
    publishFile(content) {
      const out = clone(content);
      delete out.updatedAt;
      out.publishedAt = new Date().toISOString();
      return (
        '/*\n * Published site content, generated by the GCA admin panel on ' + new Date().toString() + '.\n' +
        ' * Replace data/content.js in the website repository with this file to publish.\n */\n' +
        'window.GCA_PUBLISHED = ' + JSON.stringify(out, null, 2) + ';\n'
      );
    },

    async backup() {
      const records = {};
      for (const t of RECORD_TYPES) records[t] = await this.list(t);
      return { kind: 'gca-backup', version: 1, exportedAt: new Date().toISOString(), content: this.content, records };
    },

    async restore(backup) {
      if (!backup || backup.kind !== 'gca-backup') throw new Error('This file is not a GCA backup.');
      if (backup.content) await this.saveDraft(normalize(backup.content));
      for (const t of RECORD_TYPES) {
        if (Array.isArray(backup.records && backup.records[t])) await this.adapter.replace(t, backup.records[t]);
      }
      return this.load();
    },
  };
  GCA.data = data;

  /* ------------------------------------------------------------- events */

  GCA.events = {
    isPast(ev) {
      return (ev.endDate || ev.date) < util.todayISO();
    },
    visible(content) {
      return (content.events || []).filter((e) => e.published !== false && e.date);
    },
    upcoming(content) {
      return this.visible(content)
        .filter((e) => !this.isPast(e))
        .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')));
    },
    past(content) {
      return this.visible(content)
        .filter((e) => this.isPast(e))
        .sort((a, b) => b.date.localeCompare(a.date));
    },
    tickets(content, eventId) {
      return (content.products || []).filter((p) => p.eventId === eventId && p.active !== false);
    },
    priceFrom(content, eventId) {
      const prices = this.tickets(content, eventId).map((p) => Number(p.price) || 0);
      if (!prices.length) return null;
      return Math.min.apply(null, prices);
    },
    ics(ev, settings) {
      const stamp = (date, time) => date.replace(/-/g, '') + (time ? 'T' + time.replace(':', '') + '00' : '');
      const text = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
      const allDay = !ev.startTime;
      const endDate = ev.endDate || ev.date;
      const lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GCA Golden Triangle//Events//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
        'UID:' + ev.id + '@gca-golden-triangle',
        'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''),
      ];
      if (allDay) {
        const next = util.parseDate(endDate);
        next.setDate(next.getDate() + 1);
        const nextISO = next.getFullYear() + String(next.getMonth() + 1).padStart(2, '0') + String(next.getDate()).padStart(2, '0');
        lines.push('DTSTART;VALUE=DATE:' + stamp(ev.date), 'DTEND;VALUE=DATE:' + nextISO);
      } else {
        lines.push('DTSTART:' + stamp(ev.date, ev.startTime), 'DTEND:' + stamp(ev.date, ev.endTime || ev.startTime));
        if (ev.endDate && ev.endDate !== ev.date) {
          const days = Math.round((util.parseDate(ev.endDate) - util.parseDate(ev.date)) / 86400000) + 1;
          lines.push('RRULE:FREQ=DAILY;COUNT=' + days);
        }
      }
      lines.push(
        'SUMMARY:' + text(ev.title),
        'LOCATION:' + text([ev.venue, ev.address].filter(Boolean).join(', ')),
        'DESCRIPTION:' + text((ev.summary || '') + (settings && settings.shortName ? '\n\n' + settings.shortName : '')),
        'END:VEVENT', 'END:VCALENDAR'
      );
      return lines.join('\r\n');
    },
  };

  /* --------------------------------------------------------------- cart */

  const CART_KEY = 'gca:cart';
  const listeners = [];
  GCA.cart = {
    items() {
      try {
        return JSON.parse(localStorage.getItem(CART_KEY)) || [];
      } catch (e) {
        return [];
      }
    },
    save(items) {
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(items));
      } catch (e) { /* storage blocked: the bag just won't persist */ }
      listeners.forEach((fn) => fn(items));
    },
    onChange(fn) {
      listeners.push(fn);
    },
    add(productId, qty, option) {
      const items = this.items();
      const key = productId + (option ? '::' + option : '');
      const found = items.find((i) => i.key === key);
      if (found) found.qty += qty;
      else items.push({ key, productId, option: option || '', qty });
      this.save(items);
    },
    setQty(key, qty) {
      const items = this.items()
        .map((i) => (i.key === key ? Object.assign(i, { qty }) : i))
        .filter((i) => i.qty > 0);
      this.save(items);
    },
    remove(key) {
      this.save(this.items().filter((i) => i.key !== key));
    },
    clear() {
      this.save([]);
    },
    count() {
      return this.items().reduce((n, i) => n + i.qty, 0);
    },
    /** Bag lines joined with current product data; lines for deleted products are dropped. */
    lines(content) {
      return this.items()
        .map((i) => {
          const product = (content.products || []).find((p) => p.id === i.productId);
          if (!product || product.active === false) return null;
          return Object.assign({}, i, { product, total: (Number(product.price) || 0) * i.qty });
        })
        .filter(Boolean);
    },
    total(content) {
      return this.lines(content).reduce((n, l) => n + l.total, 0);
    },
  };
})();
