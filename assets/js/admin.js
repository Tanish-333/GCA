/* GCA Golden Triangle — committee admin panel. */
(function () {
  'use strict';
  const { util, data, art, events: EV } = window.GCA;
  const { $, $$, esc } = util;

  const DEFAULT_PASSWORD = 'gca-admin';
  const SESSION_KEY = 'gca:admin-session';
  const SESSION_HOURS = 8;

  let C = null;          // working content (draft or published)
  let dirty = false;     // unsaved form changes in the current view
  const app = $('#app');

  /* ============================================================ helpers */

  /** Resolve a stored image path for preview from inside /admin/. */
  function src(path) {
    if (!path) return '';
    return /^(data:|https?:|\/)/.test(path) ? path : '../' + path;
  }

  function thumb(image, colour, seed, kind) {
    return '<span class="thumb">' + (image ? '<img src="' + esc(src(image)) + '" alt="">' : art.media('', colour, seed, '', { kind: kind })) + '</span>';
  }

  function hashQuery() {
    const i = location.hash.indexOf('?');
    return new URLSearchParams(i >= 0 ? location.hash.slice(i + 1) : '');
  }

  function confirmLeave() {
    return !dirty || window.confirm('You have unsaved changes. Leave without saving?');
  }

  async function saveContent(message) {
    try {
      await data.saveDraft(C);
      dirty = false;
      updateDraftChip();
      util.toast(message || 'Saved. Publish when you’re ready.');
      return true;
    } catch (e) {
      console.error(e);
      util.toast('Could not save. Browser storage may be full; try smaller images.', 'error');
      return false;
    }
  }

  function readImage(file, opts) {
    const o = Object.assign({ max: 1600, keepFormat: false }, opts);
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) return reject(new Error('Please choose an image file.'));
      if (o.keepFormat && (file.type === 'image/svg+xml' || file.size < 250 * 1024)) {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('Could not read that image.'));
        return r.readAsDataURL(file);
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, o.max / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const png = o.keepFormat && file.type === 'image/png';
        resolve(canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.84));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read that image.'));
      };
      img.src = url;
    });
  }

  const ORDER_STATUS = {
    awaiting: ['Awaiting payment', 'warn'],
    reserved: ['Pay at event', 'info'],
    paid: ['Paid', 'ok'],
    confirmed: ['Confirmed', 'ok'],
    cancelled: ['Cancelled', 'muted'],
    refunded: ['Refunded', 'muted'],
  };
  const MEMBER_STATUS = {
    pending: ['Pending payment', 'warn'],
    active: ['Active', 'ok'],
    expired: ['Expired', 'muted'],
    cancelled: ['Cancelled', 'muted'],
  };
  const badge = (map, key) => {
    const [label, tone] = map[key] || [key || '—', 'muted'];
    return '<span class="badge badge--' + tone + '">' + esc(label) + '</span>';
  };
  const COUNTED = (o) => o.status !== 'cancelled' && o.status !== 'refunded';
  const PAID = (o) => o.status === 'paid' || o.status === 'confirmed';

  function ticketStats(orders, productIds) {
    let qty = 0;
    let gross = 0;
    orders.filter(COUNTED).forEach((o) => (o.items || []).forEach((it) => {
      if (productIds.includes(it.productId)) {
        qty += it.qty;
        gross += it.qty * (Number(it.price) || 0);
      }
    }));
    return { qty, gross };
  }

  /* ======================================================= field system */

  const ART_OPTIONS = [['red', 'Kumkum red'], ['marigold', 'Marigold'], ['indigo', 'Indigo'], ['green', 'Kutch green']];

  /**
   * Field types: text, textarea, number, date, time, select, checkbox, image, art, list.
   * Options: label, help, required, rows, placeholder, suggest (datalist), side (right column),
   *          options (array or fn), fields (for list), keepFormat (image).
   */
  function fieldHTML(f, value) {
    const id = 'f-' + f.name;
    const req = f.required ? ' required' : '';
    const help = f.help ? '<small>' + f.help + '</small>' : '';
    const label = '<label for="' + id + '">' + esc(f.label) + (f.required ? '' : f.optional ? ' <span class="muted">(optional)</span>' : '') + '</label>';
    const v = value == null ? '' : value;
    const ph = f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '';

    switch (f.type) {
      case 'textarea':
        return '<div class="field">' + label + '<textarea class="textarea" id="' + id + '" name="' + f.name + '" rows="' + (f.rows || 4) + '"' + req + ph + '>' + esc(v) + '</textarea>' + help + '</div>';
      case 'number':
        return '<div class="field">' + label + '<input class="input" id="' + id + '" name="' + f.name + '" type="number" min="0" step="' + (f.step || 'any') + '" value="' + esc(v) + '"' + req + ph + '>' + help + '</div>';
      case 'date':
      case 'time':
        return '<div class="field">' + label + '<input class="input" id="' + id + '" name="' + f.name + '" type="' + f.type + '" value="' + esc(v) + '"' + req + '>' + help + '</div>';
      case 'select': {
        const opts = typeof f.options === 'function' ? f.options() : f.options;
        return '<div class="field">' + label + '<select class="select" id="' + id + '" name="' + f.name + '"' + req + '>' +
          opts.map((o) => {
            const [val, text] = Array.isArray(o) ? o : [o, o];
            return '<option value="' + esc(val) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + esc(text) + '</option>';
          }).join('') + '</select>' + help + '</div>';
      }
      case 'checkbox':
        return '<label class="check"><input type="checkbox" name="' + f.name + '"' + (v ? ' checked' : '') + '><span><b>' + esc(f.label) + '</b>' + (f.help ? '<small>' + f.help + '</small>' : '') + '</span></label>';
      case 'art':
        return '<div class="field"><span class="label">' + esc(f.label) + '</span><div class="swatches">' +
          ART_OPTIONS.map(([key, text]) =>
            '<label class="swatch" title="' + text + '"><input type="radio" name="' + f.name + '" value="' + key + '"' + ((v || 'red') === key ? ' checked' : '') + '>' +
            '<span class="swatch__chip">' + art.art(key, 'bandhani') + '</span><span class="visually-hidden">' + text + '</span></label>'
          ).join('') + '</div>' + help + '</div>';
      case 'image':
        return '<div class="field image-field" data-image="' + f.name + '"' + (f.keepFormat ? ' data-keep-format' : '') + '>' +
          '<span class="label">' + esc(f.label) + '</span>' +
          '<div class="image-field__preview">' + (v ? '<img src="' + esc(src(v)) + '" alt="">' : '<span>No image</span>') + '</div>' +
          '<input type="hidden" name="' + f.name + '" value="' + esc(v) + '">' +
          '<div class="image-field__actions">' +
          '<label class="btn btn--small">Upload<input type="file" accept="image/*" hidden></label>' +
          '<button class="btn btn--small btn--quiet" type="button" data-image-url>Use a link</button>' +
          '<button class="btn btn--small btn--quiet" type="button" data-image-clear' + (v ? '' : ' hidden') + '>Remove</button></div>' +
          (f.help ? '<small>' + f.help + '</small>' : '') + '</div>';
      case 'list': {
        const rows = Array.isArray(v) ? v : [];
        return '<div class="field list-field" data-list="' + f.name + '"><span class="label">' + esc(f.label) + '</span>' +
          (f.help ? '<small>' + f.help + '</small>' : '') +
          '<div class="list-field__rows">' + rows.map((r) => listRow(f, r)).join('') + '</div>' +
          '<button class="btn btn--small btn--quiet" type="button" data-list-add="' + f.name + '">+ Add ' + esc(f.itemLabel || 'item') + '</button></div>';
      }
      default:
        return '<div class="field">' + label + '<input class="input" id="' + id + '" name="' + f.name + '" type="' + (f.inputType || 'text') + '" value="' + esc(v) + '"' + req + ph +
          (f.suggest ? ' list="' + id + '-list"' : '') + '>' +
          (f.suggest ? '<datalist id="' + id + '-list">' + f.suggest().map((s) => '<option value="' + esc(s) + '">').join('') + '</datalist>' : '') + help + '</div>';
    }
  }

  function listRow(f, row) {
    const cols = f.fields.filter((sf) => !sf.wide).length || 1;
    return '<div class="list-row" style="--cols:' + cols + '">' + f.fields.map((sf) => {
      const val = row ? row[sf.name] : '';
      const input = sf.type === 'textarea'
        ? '<textarea class="textarea" rows="2" data-sub="' + sf.name + '" placeholder="' + esc(sf.label) + '">' + esc(val || '') + '</textarea>'
        : '<input class="input" data-sub="' + sf.name + '" value="' + esc(val || '') + '" placeholder="' + esc(sf.label) + '"' + (sf.lang ? ' lang="' + sf.lang + '"' : '') + '>';
      return '<label class="list-row__cell' + (sf.wide ? ' is-wide' : '') + '"><span>' + esc(sf.label) + '</span>' + input + '</label>';
    }).join('') +
      '<div class="list-row__tools"><button type="button" class="icon-btn" data-list-up title="Move up" aria-label="Move up">↑</button>' +
      '<button type="button" class="icon-btn" data-list-remove title="Remove" aria-label="Remove">×</button></div></div>';
  }

  function readFields(form, fields) {
    const out = {};
    fields.forEach((f) => {
      if (f.type === 'checkbox') out[f.name] = !!form.querySelector('[name="' + f.name + '"]').checked;
      else if (f.type === 'art') {
        const c = form.querySelector('[name="' + f.name + '"]:checked');
        out[f.name] = c ? c.value : 'red';
      } else if (f.type === 'number') {
        const raw = form.querySelector('[name="' + f.name + '"]').value;
        out[f.name] = raw === '' ? 0 : Math.max(0, Number(raw));
      } else if (f.type === 'list') {
        out[f.name] = $$('[data-list="' + f.name + '"] .list-row', form).map((row) => {
          const item = {};
          f.fields.forEach((sf) => { item[sf.name] = $('[data-sub="' + sf.name + '"]', row).value.trim(); });
          return item;
        }).filter((item) => Object.values(item).some(Boolean));
      } else {
        const el = form.querySelector('[name="' + f.name + '"]');
        out[f.name] = el ? el.value.trim() : '';
      }
    });
    return out;
  }

  /** Wires image uploads, list rows and dirty tracking inside a form. */
  function enhanceForm(form, fields) {
    form.addEventListener('input', () => { dirty = true; });
    form.addEventListener('change', async (e) => {
      dirty = true;
      const file = e.target.type === 'file' && e.target.files[0];
      if (!file) return;
      const wrap = e.target.closest('[data-image]');
      try {
        const url = await readImage(file, { keepFormat: wrap.hasAttribute('data-keep-format') });
        setImage(wrap, url);
      } catch (err) {
        util.toast(err.message, 'error');
      }
      e.target.value = '';
    });
    form.addEventListener('click', (e) => {
      const wrap = e.target.closest('[data-image]');
      if (e.target.closest('[data-image-url]')) {
        const current = $('input[type=hidden]', wrap).value;
        const url = window.prompt('Paste an image link (https://…) or a path in the site, e.g. assets/uploads/photo.jpg', current.startsWith('data:') ? '' : current);
        if (url != null) setImage(wrap, url.trim());
      }
      if (e.target.closest('[data-image-clear]')) setImage(wrap, '');

      const add = e.target.closest('[data-list-add]');
      if (add) {
        const f = fields.find((x) => x.name === add.dataset.listAdd);
        $('.list-field__rows', add.parentElement).insertAdjacentHTML('beforeend', listRow(f, null));
        dirty = true;
      }
      const rm = e.target.closest('[data-list-remove]');
      if (rm) { rm.closest('.list-row').remove(); dirty = true; }
      const up = e.target.closest('[data-list-up]');
      if (up) {
        const row = up.closest('.list-row');
        if (row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling);
        dirty = true;
      }
    });
  }

  function setImage(wrap, url) {
    $('input[type=hidden]', wrap).value = url;
    $('.image-field__preview', wrap).innerHTML = url ? '<img src="' + esc(src(url)) + '" alt="">' : '<span>No image</span>';
    $('[data-image-clear]', wrap).hidden = !url;
    dirty = true;
  }

  function validateRequired(form) {
    let bad = null;
    $$('[required]', form).forEach((el) => {
      const ok = el.value.trim() !== '';
      el.setAttribute('aria-invalid', String(!ok));
      if (!ok && !bad) bad = el;
    });
    if (bad) {
      bad.focus();
      util.toast('Please fill in the required fields.', 'error');
    }
    return !bad;
  }

  /* ======================================================== collections */

  const eventOptions = () => [['', '— Not linked to an event —']].concat(
    (C.events || []).slice().sort((a, b) => b.date.localeCompare(a.date)).map((e) => [e.id, e.title + ' (' + util.dateShort(e.date) + ')'])
  );
  const unique = (list, key) => Array.from(new Set((list || []).map((x) => x[key]).filter(Boolean)));

  const COLLECTIONS = {
    events: {
      label: 'Events', singular: 'event', prefix: 'e',
      search: ['title', 'venue', 'category'],
      sort: (a, b) => b.date.localeCompare(a.date),
      defaults: () => ({ published: true, featured: false, art: 'red', category: 'Cultural' }),
      filters: [['upcoming', 'Upcoming', (e) => !EV.isPast(e)], ['past', 'Past', (e) => EV.isPast(e)], ['all', 'All', () => true]],
      columns: [
        ['Event', (e) => '<div class="cell-media">' + thumb(e.image, e.art, e.id, 'bandhani') + '<span><b>' + esc(e.title) + '</b><small>' + esc(e.venue || '') + '</small></span></div>'],
        ['Date', (e) => esc(util.dateShort(e.date)) + (e.endDate && e.endDate !== e.date ? '<small>to ' + esc(util.dateShort(e.endDate)) + '</small>' : '')],
        ['Category', (e) => esc(e.category || '')],
        ['Status', (e) => (e.published === false ? badge({ x: ['Hidden', 'muted'] }, 'x') : EV.isPast(e) ? badge({ x: ['Past', 'muted'] }, 'x') : badge({ x: ['Live', 'ok'] }, 'x')) + (e.featured ? ' ' + badge({ x: ['Featured', 'info'] }, 'x') : '')],
      ],
      fields: [
        { name: 'title', label: 'Event name', required: true },
        { name: 'gujaratiTitle', label: 'Name in Gujarati', optional: true, help: 'Shown in Gujarati script beside the title.' },
        { name: 'category', label: 'Category', suggest: () => unique(C.events, 'category').concat(['Cultural', 'Religious', 'Education', 'Sports & Youth', 'Community']).filter((v, i, a) => a.indexOf(v) === i) },
        { name: 'date', label: 'Date', type: 'date', required: true, half: true },
        { name: 'endDate', label: 'End date', type: 'date', optional: true, half: true, help: 'Only for multi-day events.' },
        { name: 'startTime', label: 'Starts', type: 'time', half: true },
        { name: 'endTime', label: 'Ends', type: 'time', half: true },
        { name: 'venue', label: 'Venue', half: true },
        { name: 'address', label: 'Address', half: true, help: 'Links to Google Maps on the event page.' },
        { name: 'summary', label: 'Short summary', type: 'textarea', rows: 2, help: 'One or two sentences for event listings.' },
        { name: 'description', label: 'Full description', type: 'textarea', rows: 9, help: 'Leave a blank line between paragraphs.' },
        { name: 'published', label: 'Visible on the website', type: 'checkbox', side: true },
        { name: 'featured', label: 'Feature this event', type: 'checkbox', side: true, help: 'Shown as “Next up” on the home page.' },
        { name: 'image', label: 'Photo or poster', type: 'image', side: true, help: 'Landscape works best. Without a photo, a textile pattern is shown.' },
        { name: 'art', label: 'Pattern colour', type: 'art', side: true },
      ],
    },
    products: {
      label: 'Tickets & shop', singular: 'item', prefix: 'p', orderable: true,
      search: ['name', 'type', 'description'],
      defaults: () => ({ type: 'ticket', price: 0, active: true, soldOut: false, eventId: hashQuery().get('event') || '' }),
      filters: [['all', 'All', () => true], ['tickets', 'Tickets', (p) => p.type !== 'merch'], ['merch', 'Merchandise', (p) => p.type === 'merch']],
      columns: [
        ['Item', (p) => '<b>' + esc(p.name) + '</b><small>' + esc({ ticket: 'Ticket', registration: 'Registration', merch: 'Merchandise' }[p.type] || p.type) + '</small>'],
        ['Event', (p) => { const e = C.events.find((x) => x.id === p.eventId); return e ? esc(e.title) + '<small>' + esc(util.dateShort(e.date)) + '</small>' : '<span class="muted">—</span>'; }],
        ['Price', (p) => util.money(p.price)],
        ['Sold', (p, ctx) => String(ticketStats(ctx.orders, [p.id]).qty)],
        ['Status', (p) => (p.active === false ? badge({ x: ['Off sale', 'muted'] }, 'x') : p.soldOut ? badge({ x: ['Sold out', 'warn'] }, 'x') : badge({ x: ['On sale', 'ok'] }, 'x'))],
      ],
      fields: [
        { name: 'name', label: 'Name', required: true, help: 'e.g. “Gala ticket: Adult”' },
        { name: 'type', label: 'Type', type: 'select', options: [['ticket', 'Event ticket'], ['registration', 'Class or program registration'], ['merch', 'Merchandise']], half: true },
        { name: 'price', label: 'Price (CAD)', type: 'number', step: '0.01', half: true, help: 'Use 0 for a free RSVP.' },
        { name: 'eventId', label: 'Event', type: 'select', options: eventOptions, help: 'Tickets appear on the event page and disappear from the shop once the event is over.' },
        { name: 'description', label: 'Description', type: 'textarea', rows: 3 },
        { name: 'options', label: 'Choices', optional: true, help: 'Comma-separated, e.g. “S, M, L, XL” or class levels. Leave blank if none.' },
        { name: 'active', label: 'On sale', type: 'checkbox', side: true },
        { name: 'soldOut', label: 'Sold out', type: 'checkbox', side: true, help: 'Keeps the item visible but stops new orders.' },
        { name: 'image', label: 'Image', type: 'image', side: true },
      ],
    },
    gallery: {
      label: 'Gallery', singular: 'photo', prefix: 'g', orderable: true, bulkUpload: true,
      search: ['title', 'album'],
      defaults: () => ({ art: 'red' }),
      columns: [
        ['Photo', (g) => '<div class="cell-media">' + thumb(g.image, g.art, g.id) + '<span><b>' + esc(g.title || 'Untitled') + '</b>' + (g.image ? '' : '<small>No photo yet</small>') + '</span></div>'],
        ['Album', (g) => esc(g.album || '')],
      ],
      fields: [
        { name: 'title', label: 'Caption' },
        { name: 'album', label: 'Album', suggest: () => unique(C.gallery, 'album'), help: 'Photos are grouped and filtered by album.' },
        { name: 'image', label: 'Photo', type: 'image', side: true },
        { name: 'art', label: 'Pattern colour (until a photo is added)', type: 'art', side: true },
      ],
    },
    deities: {
      label: 'Darshan', singular: 'murti', prefix: 'd', orderable: true,
      search: ['name', 'gujaratiName', 'occasion'],
      defaults: () => ({}),
      columns: [
        ['Name', (d) => '<div class="cell-media">' + thumb(d.image, 'red', d.id, 'mirror') + '<span><b>' + esc(d.name) + '</b><small class="guj">' + esc(d.gujaratiName || '') + '</small></span></div>'],
        ['Occasion', (d) => esc(d.occasion || '')],
      ],
      fields: [
        { name: 'name', label: 'Name', required: true, half: true },
        { name: 'gujaratiName', label: 'Name in Gujarati', half: true },
        { name: 'occasion', label: 'Occasion', help: 'e.g. Navratri, Diwali' },
        { name: 'description', label: 'Description', type: 'textarea', rows: 3 },
        { name: 'image', label: 'Darshan photo', type: 'image', side: true, help: 'Portrait orientation works best.' },
      ],
    },
    plans: {
      label: 'Membership plans', singular: 'plan', prefix: 'm', orderable: true,
      search: ['name', 'audience'],
      defaults: () => ({ period: 'year', price: 0, featured: false }),
      columns: [
        ['Plan', (p) => '<b>' + esc(p.name) + '</b><small>' + esc(p.audience || '') + '</small>'],
        ['Price', (p) => util.money(p.price) + ' / ' + esc(p.period || 'year')],
        ['Members', (p, ctx) => String(ctx.members.filter((m) => m.planId === p.id && m.status === 'active').length)],
        ['', (p) => (p.featured ? badge({ x: ['Highlighted', 'info'] }, 'x') : '')],
      ],
      fields: [
        { name: 'name', label: 'Plan name', required: true },
        { name: 'audience', label: 'Who it’s for', help: 'e.g. “Two adults and children under 18”' },
        { name: 'price', label: 'Price (CAD)', type: 'number', step: '0.01', half: true },
        { name: 'period', label: 'Per', half: true, placeholder: 'year' },
        { name: 'features', label: 'Benefits', type: 'textarea', rows: 5, help: 'One benefit per line.' },
        { name: 'featured', label: 'Highlight as most popular', type: 'checkbox', side: true },
      ],
    },
    sponsors: {
      label: 'Sponsors', singular: 'sponsor', prefix: 's', orderable: true,
      search: ['name', 'tier'],
      defaults: () => ({}),
      columns: [
        ['Sponsor', (s) => '<div class="cell-media">' + (s.logo ? '<span class="thumb thumb--logo"><img src="' + esc(src(s.logo)) + '" alt=""></span>' : '') + '<span><b>' + esc(s.name) + '</b><small>' + esc(s.url || '') + '</small></span></div>'],
        ['Tier', (s) => esc(s.tier || '')],
      ],
      fields: [
        { name: 'name', label: 'Business name', required: true },
        { name: 'tier', label: 'Tier', suggest: () => (C.pages.sponsorTiers || []).map((t) => t.name) },
        { name: 'url', label: 'Website', inputType: 'url', placeholder: 'https://' },
        { name: 'logo', label: 'Logo', type: 'image', side: true, keepFormat: true, help: 'PNG or SVG with a transparent background looks best.' },
      ],
    },
    committee: {
      label: 'Committee', singular: 'member', prefix: 'c', orderable: true,
      search: ['name', 'role'],
      defaults: () => ({}),
      columns: [
        ['Name', (m) => '<div class="cell-media">' + thumb(m.photo, 'indigo', m.id, 'patola') + '<span><b>' + esc(m.name) + '</b><small>' + esc(m.email || '') + '</small></span></div>'],
        ['Role', (m) => esc(m.role || '')],
      ],
      fields: [
        { name: 'name', label: 'Name', required: true, half: true },
        { name: 'role', label: 'Role', half: true, suggest: () => ['President', 'Vice President', 'Secretary', 'Treasurer', 'Cultural Director', 'Youth Coordinator', 'Director at Large'] },
        { name: 'email', label: 'Public email', inputType: 'email', optional: true },
        { name: 'bio', label: 'Short bio', type: 'textarea', rows: 3, optional: true },
        { name: 'photo', label: 'Photo', type: 'image', side: true },
      ],
    },
    announcements: {
      label: 'Announcements', singular: 'announcement', prefix: 'a', orderable: true,
      search: ['text'],
      defaults: () => ({ active: true }),
      intro: 'The first active announcement is shown in a bar at the top of every page. Visitors can dismiss it.',
      columns: [
        ['Announcement', (a) => '<b>' + esc(a.text) + '</b>' + (a.link ? '<small>' + esc(a.linkText || 'Link') + ' → ' + esc(a.link) + '</small>' : '')],
        ['Status', (a) => (a.active ? badge({ x: ['Active', 'ok'] }, 'x') : badge({ x: ['Off', 'muted'] }, 'x'))],
      ],
      fields: [
        { name: 'text', label: 'Message', required: true },
        { name: 'linkText', label: 'Link text', half: true, placeholder: 'Get tickets' },
        { name: 'link', label: 'Link', half: true, placeholder: 'event.html?id=…', help: 'A page on this site or a full https:// address.' },
        { name: 'active', label: 'Active', type: 'checkbox', side: true },
      ],
    },
  };

  /* ============================================================== shell */

  const NAV = [
    ['Overview', [['dashboard', 'Dashboard']]],
    ['Content', [['events', 'Events'], ['products', 'Tickets & shop'], ['gallery', 'Gallery'], ['deities', 'Darshan'], ['plans', 'Membership plans'], ['sponsors', 'Sponsors'], ['committee', 'Committee'], ['announcements', 'Announcements'], ['pages', 'Page text']]],
    ['Community', [['orders', 'Orders'], ['members', 'Members'], ['messages', 'Messages'], ['subscribers', 'Subscribers']]],
    ['Site', [['settings', 'Settings'], ['publish', 'Publish & backup']]],
  ];

  function renderShell() {
    app.innerHTML =
      '<div class="shell">' +
      '<aside class="side" id="side">' +
      '<a class="side__brand" href="#/dashboard"><img src="' + esc(src(C.settings.logo) || '../assets/img/logo-mark.svg') + '" alt="" width="36" height="36"><span><b>GCA Admin</b><small>Golden Triangle</small></span></a>' +
      '<nav class="side__nav" aria-label="Admin">' +
      NAV.map(([group, items]) => '<div class="side__group"><span>' + group + '</span>' +
        items.map(([key, label]) => '<a href="#/' + key + '" data-nav="' + key + '">' + label + '<i class="side__count" data-count="' + key + '"></i></a>').join('') + '</div>').join('') +
      '</nav>' +
      '<div class="side__foot"><a href="../index.html" target="_blank" rel="noopener">View website ↗</a><button type="button" data-logout>Sign out</button></div>' +
      '</aside>' +
      '<div class="main">' +
      '<header class="top"><button class="top__menu" type="button" aria-label="Menu" data-menu>☰</button><h1 id="view-title"></h1>' +
      '<a class="chip" id="draft-chip" href="#/publish"></a></header>' +
      '<div class="content" id="view"></div>' +
      '</div></div>';

    $('[data-logout]').addEventListener('click', () => {
      if (!confirmLeave()) return;
      sessionStorage.removeItem(SESSION_KEY);
      dirty = false;
      location.hash = '';
      boot();
    });
    $('[data-menu]').addEventListener('click', () => document.body.classList.toggle('side-open'));
    $('#side').addEventListener('click', (e) => { if (e.target.closest('a')) document.body.classList.remove('side-open'); });
    updateDraftChip();
    updateCounts();
  }

  function updateDraftChip() {
    const chip = $('#draft-chip');
    if (!chip) return;
    chip.className = 'chip' + (data.isDraft ? ' chip--draft' : '');
    chip.textContent = data.isDraft ? 'Unpublished changes' : 'Up to date with live site';
  }

  async function updateCounts() {
    const [orders, members, messages] = await Promise.all([data.list('orders'), data.list('members'), data.list('messages')]);
    const counts = {
      orders: orders.filter((o) => o.status === 'awaiting').length,
      members: members.filter((m) => m.status === 'pending').length,
      messages: messages.filter((m) => !m.read).length,
    };
    $$('[data-count]').forEach((el) => {
      const n = counts[el.dataset.count];
      el.textContent = n || '';
      el.hidden = !n;
    });
  }

  function view(title, html, navKey) {
    $('#view-title').textContent = title;
    document.title = title + ' · GCA Admin';
    const host = $('#view');
    host.innerHTML = html;
    $$('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === navKey));
    window.scrollTo(0, 0);
    return host;
  }

  /* ========================================================== dashboard */

  async function dashboard() {
    const [orders, members, messages, subscribers] = await Promise.all(data.RECORD_TYPES.map((t) => data.list(t)));
    const upcoming = EV.upcoming(C);
    const awaiting = orders.filter((o) => o.status === 'awaiting');
    const revenue = orders.filter(PAID).reduce((s, o) => s + (Number(o.total) || 0), 0) +
      members.filter((m) => m.status === 'active').reduce((s, m) => s + (Number(m.amount) || 0), 0);
    const unread = messages.filter((m) => !m.read);
    const active = members.filter((m) => m.status === 'active').length;
    const pending = members.filter((m) => m.status === 'pending').length;

    const kpi = (label, value, sub, href) =>
      '<a class="kpi" href="' + href + '"><span>' + label + '</span><b>' + value + '</b><small>' + sub + '</small></a>';

    const sales = upcoming.map((e) => {
      const ids = EV.tickets(C, e.id).map((p) => p.id);
      return { e, ids, s: ticketStats(orders, ids) };
    }).filter((r) => r.ids.length);

    let storageNote = '';
    if (data.adapter === data.LocalAdapter) {
      storageNote =
        '<div class="callout"><b>Storage is local to this browser.</b> Content edits are saved here until you publish them. ' +
        'Orders, memberships and messages from visitors will only appear here once a shared database is connected; see <code>README.md</code>.</div>';
    }

    const host = view('Dashboard',
      storageNote +
      '<div class="kpis">' +
      kpi('Upcoming events', upcoming.length, upcoming[0] ? 'Next: ' + esc(util.dateShort(upcoming[0].date)) : 'Nothing scheduled', '#/events') +
      kpi('Awaiting payment', util.moneyExact(awaiting.reduce((s, o) => s + o.total, 0)), awaiting.length + (awaiting.length === 1 ? ' order' : ' orders'), '#/orders?status=awaiting') +
      kpi('Collected', util.moneyExact(revenue), 'Paid orders and active memberships', '#/orders?status=paid') +
      kpi('Members', active, pending ? pending + ' pending payment' : 'All paid up', '#/members') +
      kpi('Messages', unread.length, unread.length ? 'unread' : 'Inbox zero', '#/messages') +
      '</div>' +
      '<div class="grid-2">' +
      '<section class="card"><header class="card__head"><h2>Ticket sales</h2><a href="#/products">Manage tickets</a></header>' +
      (sales.length
        ? '<table class="table"><thead><tr><th>Event</th><th class="num">Sold</th><th class="num">Value</th></tr></thead><tbody>' +
          sales.map((r) => '<tr><td><a href="#/events/' + encodeURIComponent(r.e.id) + '"><b>' + esc(r.e.title) + '</b></a><small>' + esc(util.dateShort(r.e.date)) + '</small></td><td class="num">' + r.s.qty + '</td><td class="num">' + util.moneyExact(r.s.gross) + '</td></tr>').join('') +
          '</tbody></table>'
        : '<p class="card__empty">No upcoming events have tickets yet.</p>') +
      '</section>' +
      '<section class="card"><header class="card__head"><h2>Recent orders</h2><a href="#/orders">All orders</a></header>' +
      (orders.length
        ? '<table class="table"><tbody>' + orders.slice(0, 6).map((o) =>
          '<tr class="is-link" data-href="#/orders/' + encodeURIComponent(o.id) + '"><td><b>' + esc(o.name) + '</b><small>' + esc(o.ref) + ' · ' + util.dateTime(o.createdAt) + '</small></td><td class="num">' + util.moneyExact(o.total) + '</td><td class="num">' + badge(ORDER_STATUS, o.status) + '</td></tr>'
        ).join('') + '</tbody></table>'
        : '<p class="card__empty">No orders yet.</p>') +
      '</section>' +
      '<section class="card"><header class="card__head"><h2>Coming up</h2><a href="#/events/new">New event</a></header>' +
      (upcoming.length
        ? '<ul class="agenda">' + upcoming.slice(0, 5).map((e) => {
          const p = util.dateParts(e.date);
          return '<li><a href="#/events/' + encodeURIComponent(e.id) + '"><span class="agenda__date"><b>' + p.dd + '</b>' + p.mon + '</span><span><b>' + esc(e.title) + '</b><small>' + esc([util.timeRange(e.startTime, e.endTime), e.venue].filter(Boolean).join(' · ')) + '</small></span></a></li>';
        }).join('') + '</ul>'
        : '<p class="card__empty">No upcoming events. <a href="#/events/new">Add one</a>.</p>') +
      '</section>' +
      '<section class="card"><header class="card__head"><h2>Latest messages</h2><a href="#/messages">Inbox</a></header>' +
      (messages.length
        ? '<table class="table"><tbody>' + messages.slice(0, 5).map((m) =>
          '<tr class="is-link' + (m.read ? '' : ' is-unread') + '" data-href="#/messages/' + encodeURIComponent(m.id) + '"><td><b>' + esc(m.name) + '</b><small>' + esc(m.topic) + ' · ' + esc(String(m.message).slice(0, 70)) + '</small></td><td class="num muted">' + esc(util.dateShort(m.createdAt.slice(0, 10))) + '</td></tr>'
        ).join('') + '</tbody></table>'
        : '<p class="card__empty">No messages yet.</p>') +
      '</section>' +
      '</div>' +
      '<p class="footnote">' + subscribers.length + ' newsletter subscriber' + (subscribers.length === 1 ? '' : 's') + ' · ' + C.events.length + ' events · ' + C.products.length + ' tickets & products · ' + C.gallery.length + ' photos</p>',
      'dashboard');
    rowLinks(host);
  }

  function rowLinks(host) {
    host.addEventListener('click', (e) => {
      const row = e.target.closest('[data-href]');
      if (row && !e.target.closest('a, button, input, select')) location.hash = row.dataset.href;
    });
  }

  /* ===================================================== content: lists */

  async function listView(key) {
    const def = COLLECTIONS[key];
    const ctx = { orders: await data.list('orders'), members: await data.list('members') };
    const q = hashQuery();
    let filter = q.get('filter') || (def.filters ? def.filters[0][0] : 'all');
    let term = '';

    const host = view(def.label,
      (def.intro ? '<p class="intro">' + def.intro + '</p>' : '') +
      '<div class="toolbar">' +
      (def.filters ? '<div class="tabs" role="group">' + def.filters.map(([k, label]) => '<button type="button" data-filter="' + k + '" aria-pressed="' + (k === filter) + '">' + label + '</button>').join('') + '</div>' : '') +
      '<input class="input input--search" type="search" placeholder="Search ' + esc(def.label.toLowerCase()) + '…" aria-label="Search">' +
      (def.bulkUpload ? '<label class="btn">Upload photos<input type="file" accept="image/*" multiple hidden data-bulk></label>' : '') +
      '<a class="btn btn--primary" href="#/' + key + '/new">New ' + def.singular + '</a>' +
      '</div>' +
      '<div class="card card--flush"><table class="table table--rows"><thead><tr>' +
      def.columns.map(([h]) => '<th>' + h + '</th>').join('') + '<th class="actions"><span class="visually-hidden">Actions</span></th></tr></thead><tbody id="rows"></tbody></table></div>',
      key);

    function draw() {
      let items = C[key].map((item, index) => ({ item, index }));
      if (def.filters) {
        const fn = def.filters.find(([k]) => k === filter)[2];
        items = items.filter(({ item }) => fn(item));
      }
      if (term) {
        const t = term.toLowerCase();
        items = items.filter(({ item }) => def.search.some((f) => String(item[f] || '').toLowerCase().includes(t)));
      }
      if (def.sort) items.sort((a, b) => def.sort(a.item, b.item));
      const canMove = def.orderable && !term && (!def.filters || filter === 'all');
      $('#rows', host).innerHTML = items.map(({ item, index }) =>
        '<tr class="is-link" data-href="#/' + key + '/' + encodeURIComponent(item.id) + '">' +
        def.columns.map(([, fn]) => '<td>' + fn(item, ctx) + '</td>').join('') +
        '<td class="actions">' +
        (canMove ? '<button class="icon-btn" type="button" data-move="-1" data-index="' + index + '" aria-label="Move up"' + (index === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button class="icon-btn" type="button" data-move="1" data-index="' + index + '" aria-label="Move down"' + (index === C[key].length - 1 ? ' disabled' : '') + '>↓</button>' : '') +
        '<button class="icon-btn" type="button" data-duplicate="' + esc(item.id) + '" aria-label="Duplicate" title="Duplicate">⧉</button>' +
        '<button class="icon-btn icon-btn--danger" type="button" data-delete="' + esc(item.id) + '" aria-label="Delete" title="Delete">×</button>' +
        '</td></tr>'
      ).join('') || '<tr><td colspan="' + (def.columns.length + 1) + '" class="card__empty">' +
        (C[key].length ? 'Nothing matches.' : 'No ' + def.label.toLowerCase() + ' yet. <a href="#/' + key + '/new">Add the first one</a>.') + '</td></tr>';
    }
    draw();
    rowLinks(host);

    host.addEventListener('input', (e) => {
      if (e.target.type === 'search') { term = e.target.value.trim(); draw(); }
    });
    host.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-filter]');
      if (tab) {
        filter = tab.dataset.filter;
        $$('[data-filter]', host).forEach((b) => b.setAttribute('aria-pressed', String(b === tab)));
        draw();
      }
      const mv = e.target.closest('[data-move]');
      if (mv) {
        const i = Number(mv.dataset.index);
        const j = i + Number(mv.dataset.move);
        if (j < 0 || j >= C[key].length) return;
        [C[key][i], C[key][j]] = [C[key][j], C[key][i]];
        await saveContent('Order updated.');
        draw();
      }
      const dup = e.target.closest('[data-duplicate]');
      if (dup) {
        const src0 = C[key].find((x) => x.id === dup.dataset.duplicate);
        const copy = JSON.parse(JSON.stringify(src0));
        copy.id = util.uid(def.prefix);
        if (copy.title) copy.title += ' (copy)';
        else if (copy.name) copy.name += ' (copy)';
        if ('published' in copy) copy.published = false;
        if ('active' in copy && key !== 'plans') copy.active = false;
        C[key].splice(C[key].indexOf(src0) + 1, 0, copy);
        await saveContent('Duplicated. The copy starts hidden.');
        location.hash = '#/' + key + '/' + encodeURIComponent(copy.id);
      }
      const del = e.target.closest('[data-delete]');
      if (del) {
        const item = C[key].find((x) => x.id === del.dataset.delete);
        if (!window.confirm('Delete “' + (item.title || item.name || item.text || 'this item') + '”? This can’t be undone after you publish.')) return;
        C[key] = C[key].filter((x) => x !== item);
        await saveContent('Deleted.');
        draw();
      }
    });

    if (def.bulkUpload) {
      $('[data-bulk]', host).addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const album = window.prompt('Album name for these ' + files.length + ' photos?', unique(C.gallery, 'album')[0] || '');
        if (album == null) return;
        let added = 0;
        for (const file of files) {
          try {
            const image = await readImage(file);
            C.gallery.unshift({ id: util.uid('g'), title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), album: album.trim(), image, art: 'red' });
            added++;
          } catch (err) {
            util.toast(file.name + ': ' + err.message, 'error');
          }
        }
        e.target.value = '';
        if (added) {
          await saveContent(added + ' photo' + (added === 1 ? '' : 's') + ' added.');
          draw();
        }
      });
    }
  }

  /* ====================================================== content: edit */

  function editView(key, id) {
    const def = COLLECTIONS[key];
    const isNew = id === 'new';
    const item = isNew ? Object.assign({ id: util.uid(def.prefix) }, def.defaults()) : C[key].find((x) => x.id === id);
    if (!item) {
      view(def.label, '<div class="card"><p class="card__empty">That ' + def.singular + ' no longer exists. <a href="#/' + key + '">Back to ' + def.label.toLowerCase() + '</a></p></div>', key);
      return;
    }
    const main = def.fields.filter((f) => !f.side);
    const side = def.fields.filter((f) => f.side);
    const group = (fields) => {
      let html = '';
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        if (f.half && fields[i + 1] && fields[i + 1].half) {
          html += '<div class="form-row">' + fieldHTML(f, item[f.name]) + fieldHTML(fields[i + 1], item[fields[i + 1].name]) + '</div>';
          i++;
        } else {
          html += fieldHTML(f, item[f.name]);
        }
      }
      return html;
    };

    let extra = '';
    if (key === 'events' && !isNew) {
      const tickets = C.products.filter((p) => p.eventId === item.id);
      extra =
        '<section class="card"><header class="card__head"><h2>Tickets for this event</h2><a href="#/products/new?event=' + encodeURIComponent(item.id) + '">Add ticket</a></header>' +
        (tickets.length
          ? '<table class="table"><tbody>' + tickets.map((t) => '<tr class="is-link" data-href="#/products/' + encodeURIComponent(t.id) + '"><td><b>' + esc(t.name) + '</b></td><td class="num">' + util.money(t.price) + '</td><td class="num">' + (t.active === false ? badge({ x: ['Off sale', 'muted'] }, 'x') : t.soldOut ? badge({ x: ['Sold out', 'warn'] }, 'x') : badge({ x: ['On sale', 'ok'] }, 'x')) + '</td></tr>').join('') + '</tbody></table>'
          : '<p class="card__empty">No tickets. Without tickets, the event page says “Free entry, no ticket needed”.</p>') +
        '</section>';
    }

    const viewLink = key === 'events' && !isNew ? '<a class="btn btn--quiet" href="../event.html?id=' + encodeURIComponent(item.id) + '" target="_blank" rel="noopener">Preview ↗</a>' : '';

    const host = view((isNew ? 'New ' : 'Edit ') + def.singular,
      '<form class="editor" id="editor" novalidate>' +
      '<nav class="crumbs"><a href="#/' + key + '">← ' + esc(def.label) + '</a></nav>' +
      '<div class="editor__grid">' +
      '<div class="editor__main"><section class="card card--form">' + group(main) + '</section>' + extra + '</div>' +
      '<div class="editor__side">' + (side.length ? '<section class="card card--form">' + group(side) + '</section>' : '') + '</div>' +
      '</div>' +
      '<div class="savebar">' +
      (isNew ? '' : '<button class="btn btn--danger" type="button" data-delete>Delete</button>') +
      '<span class="savebar__space"></span>' + viewLink +
      '<a class="btn btn--quiet" href="#/' + key + '">Cancel</a>' +
      '<button class="btn btn--primary" type="submit">' + (isNew ? 'Create ' + def.singular : 'Save changes') + '</button>' +
      '</div></form>',
      key);

    const form = $('#editor', host);
    enhanceForm(form, def.fields);
    rowLinks(host);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateRequired(form)) return;
      const values = readFields(form, def.fields);
      if (key === 'events' && values.endDate && values.endDate < values.date) {
        util.toast('The end date is before the start date.', 'error');
        return;
      }
      Object.assign(item, values);
      if (isNew) C[key].push(item);
      if (await saveContent(isNew ? def.singular[0].toUpperCase() + def.singular.slice(1) + ' created.' : 'Changes saved.')) {
        location.hash = '#/' + key;
      }
    });
    const del = $('[data-delete]', form);
    if (del) {
      del.addEventListener('click', async () => {
        if (!window.confirm('Delete this ' + def.singular + '?')) return;
        C[key] = C[key].filter((x) => x.id !== item.id);
        if (await saveContent('Deleted.')) {
          dirty = false;
          location.hash = '#/' + key;
        }
      });
    }
  }

  /* ========================================================== page text */

  const PAGE_GROUPS = [
    ['Home page: opening', 'The first thing visitors see.', [
      { name: 'heroEyebrow', label: 'Small label above the headline' },
      { name: 'heroGujarati', label: 'Gujarati line', help: 'Shown in Gujarati script above the headline. Leave blank to hide.' },
      { name: 'heroTitle', label: 'Headline', required: true },
      { name: 'heroIntro', label: 'Introduction', type: 'textarea', rows: 3 },
      { name: 'stats', label: 'Numbers strip', type: 'list', itemLabel: 'number', fields: [{ name: 'value', label: 'Number' }, { name: 'label', label: 'Label', wide: true }] },
    ]],
    ['About', 'Used on the home page and the About page.', [
      { name: 'missionTitle', label: 'Mission headline' },
      { name: 'mission', label: 'Mission statement', type: 'textarea', rows: 4 },
      { name: 'story', label: 'Our story', type: 'textarea', rows: 7, help: 'Leave a blank line between paragraphs.' },
      { name: 'programs', label: 'Programs', type: 'list', itemLabel: 'program', fields: [{ name: 'title', label: 'Name' }, { name: 'gujarati', label: 'Gujarati', lang: 'gu' }, { name: 'text', label: 'Description', type: 'textarea', wide: true }] },
    ]],
    ['Section introductions', 'Short paragraphs that open each section.', [
      { name: 'darshanIntro', label: 'Darshan', type: 'textarea', rows: 2 },
      { name: 'galleryIntro', label: 'Gallery', type: 'textarea', rows: 2 },
      { name: 'membershipIntro', label: 'Membership', type: 'textarea', rows: 2 },
      { name: 'contactIntro', label: 'Contact', type: 'textarea', rows: 2 },
    ]],
    ['Sponsorship', 'Shown on the About page, and on the home page until you add sponsors.', [
      { name: 'sponsorIntro', label: 'Introduction', type: 'textarea', rows: 3 },
      { name: 'sponsorTiers', label: 'Tiers', type: 'list', itemLabel: 'tier', fields: [{ name: 'name', label: 'Tier' }, { name: 'amount', label: 'Amount' }, { name: 'perks', label: 'What sponsors get', type: 'textarea', wide: true }] },
    ]],
  ];

  function pagesView() {
    const fields = PAGE_GROUPS.flatMap((g) => g[2]);
    const host = view('Page text',
      '<form class="editor" id="editor" novalidate><div class="stack-lg">' +
      PAGE_GROUPS.map(([title, intro, fs]) =>
        '<section class="card card--form"><header class="card__head card__head--plain"><h2>' + title + '</h2><p>' + intro + '</p></header>' +
        fs.map((f) => fieldHTML(f, C.pages[f.name])).join('') + '</section>'
      ).join('') +
      '</div><div class="savebar"><span class="savebar__space"></span><a class="btn btn--quiet" href="../index.html" target="_blank" rel="noopener">View site ↗</a><button class="btn btn--primary" type="submit">Save changes</button></div></form>',
      'pages');
    const form = $('#editor', host);
    enhanceForm(form, fields);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateRequired(form)) return;
      Object.assign(C.pages, readFields(form, fields));
      await saveContent('Page text saved.');
    });
  }

  /* =========================================================== settings */

  const SETTINGS_GROUPS = [
    ['Organization', [
      { name: 'orgName', label: 'Full name', required: true },
      { name: 'shortName', label: 'Short name', required: true, half: true },
      { name: 'gujaratiName', label: 'Name in Gujarati', half: true },
      { name: 'tagline', label: 'Description', type: 'textarea', rows: 2, help: 'Shown in the footer.' },
      { name: 'registration', label: 'Registration or charity number', optional: true, help: 'Shown in the footer if filled in.' },
    ]],
    ['Contact', [
      { name: 'email', label: 'Public email', inputType: 'email', half: true },
      { name: 'phone', label: 'Phone', half: true, optional: true },
      { name: 'address', label: 'Address or area' },
    ]],
    ['Payments', [
      { name: 'etransferEmail', label: 'Interac e-Transfer email', inputType: 'email', help: 'Shown to people after they order or apply for membership.' },
      { name: 'etransferNote', label: 'Payment note', type: 'textarea', rows: 2 },
    ]],
    ['Social', [
      { name: 'instagram', label: 'Instagram', inputType: 'url', placeholder: 'https://instagram.com/…', half: true },
      { name: 'facebook', label: 'Facebook', inputType: 'url', placeholder: 'https://facebook.com/…', half: true },
      { name: 'youtube', label: 'YouTube', inputType: 'url', placeholder: 'https://youtube.com/…', half: true },
      { name: 'whatsapp', label: 'WhatsApp community link', inputType: 'url', placeholder: 'https://chat.whatsapp.com/…', half: true },
    ]],
    ['Branding', [
      { name: 'logo', label: 'Logo', type: 'image', keepFormat: true, help: 'Leave empty to use the GCA diya mark. Square SVG or PNG works best.' },
      { name: 'showAnnouncement', label: 'Show the announcement bar', type: 'checkbox' },
    ]],
  ];

  function settingsView() {
    const fields = SETTINGS_GROUPS.flatMap((g) => g[1]);
    const row = (fs) => {
      let html = '';
      for (let i = 0; i < fs.length; i++) {
        if (fs[i].half && fs[i + 1] && fs[i + 1].half) {
          html += '<div class="form-row">' + fieldHTML(fs[i], C.settings[fs[i].name]) + fieldHTML(fs[i + 1], C.settings[fs[i + 1].name]) + '</div>';
          i++;
        } else html += fieldHTML(fs[i], C.settings[fs[i].name]);
      }
      return html;
    };
    const host = view('Settings',
      '<form class="editor" id="editor" novalidate><div class="stack-lg">' +
      SETTINGS_GROUPS.map(([title, fs]) => '<section class="card card--form"><header class="card__head card__head--plain"><h2>' + title + '</h2></header>' + row(fs) + '</section>').join('') +
      '</div><div class="savebar"><span class="savebar__space"></span><button class="btn btn--primary" type="submit">Save settings</button></div></form>' +
      '<section class="card card--form mt-lg"><header class="card__head card__head--plain"><h2>Admin password</h2><p>The password is stored as a salted hash in this browser.</p></header>' +
      '<form id="pw-form" class="form-row" novalidate>' +
      '<div class="field"><label for="pw-current">Current password</label><input class="input" id="pw-current" type="password" autocomplete="current-password" required></div>' +
      '<div class="field"><label for="pw-new">New password</label><input class="input" id="pw-new" type="password" autocomplete="new-password" minlength="8" required><small>At least 8 characters.</small></div>' +
      '<div class="field field--end"><button class="btn" type="submit">Change password</button></div></form></section>',
      'settings');

    const form = $('#editor', host);
    enhanceForm(form, fields);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateRequired(form)) return;
      Object.assign(C.settings, readFields(form, fields));
      if (await saveContent('Settings saved.')) {
        const logo = $('.side__brand img');
        if (logo) logo.src = src(C.settings.logo) || '../assets/img/logo-mark.svg';
      }
    });

    $('#pw-form', host).addEventListener('submit', async (e) => {
      e.preventDefault();
      const current = $('#pw-current').value;
      const next = $('#pw-new').value;
      if (!(await checkPassword(current))) return util.toast('Current password is incorrect.', 'error');
      if (next.length < 8) return util.toast('New password must be at least 8 characters.', 'error');
      if (next === DEFAULT_PASSWORD) return util.toast('Please choose something other than the default.', 'error');
      await setPassword(next);
      e.target.reset();
      util.toast('Password changed.');
    });
  }

  /* ============================================================= orders */

  async function ordersView() {
    const orders = await data.list('orders');
    let status = hashQuery().get('status') || 'all';
    let term = '';
    const tabs = [['all', 'All']].concat(Object.entries(ORDER_STATUS).map(([k, [l]]) => [k, l]));
    const host = view('Orders',
      '<div class="toolbar"><div class="tabs" role="group">' +
      tabs.map(([k, l]) => '<button type="button" data-filter="' + k + '" aria-pressed="' + (k === status) + '">' + l + '<i>' + (k === 'all' ? orders.length : orders.filter((o) => o.status === k).length) + '</i></button>').join('') +
      '</div><input class="input input--search" type="search" placeholder="Search name, email or reference…" aria-label="Search orders">' +
      '<button class="btn" type="button" data-export' + (orders.length ? '' : ' disabled') + '>Export CSV</button></div>' +
      '<div class="card card--flush"><table class="table table--rows"><thead><tr><th>Reference</th><th>Customer</th><th>Items</th><th class="num">Total</th><th>Payment</th><th>Status</th></tr></thead><tbody id="rows"></tbody></table></div>',
      'orders');

    const shown = () => orders.filter((o) => (status === 'all' || o.status === status) &&
      (!term || [o.ref, o.name, o.email].join(' ').toLowerCase().includes(term)));
    function draw() {
      $('#rows', host).innerHTML = shown().map((o) =>
        '<tr class="is-link" data-href="#/orders/' + encodeURIComponent(o.id) + '">' +
        '<td><b>' + esc(o.ref) + '</b><small>' + util.dateTime(o.createdAt) + '</small></td>' +
        '<td>' + esc(o.name) + '<small>' + esc(o.email) + '</small></td>' +
        '<td>' + esc((o.items || []).map((i) => i.qty + ' × ' + i.name).join(', ')) + '</td>' +
        '<td class="num">' + util.moneyExact(o.total) + '</td>' +
        '<td>' + esc({ etransfer: 'e-Transfer', door: 'At event', none: '—' }[o.payment] || o.payment) + '</td>' +
        '<td>' + badge(ORDER_STATUS, o.status) + '</td></tr>'
      ).join('') || '<tr><td colspan="6" class="card__empty">' + (orders.length ? 'No orders match.' : 'No orders yet. They appear here when people check out.') + '</td></tr>';
    }
    draw();
    rowLinks(host);
    host.addEventListener('input', (e) => { if (e.target.type === 'search') { term = e.target.value.trim().toLowerCase(); draw(); } });
    host.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-filter]');
      if (tab) {
        status = tab.dataset.filter;
        $$('[data-filter]', host).forEach((b) => b.setAttribute('aria-pressed', String(b === tab)));
        draw();
      }
      if (e.target.closest('[data-export]')) {
        util.download('gca-orders-' + util.todayISO() + '.csv', util.csv(shown(), [
          { label: 'Reference', value: 'ref' }, { label: 'Date', value: (o) => o.createdAt },
          { label: 'Name', value: 'name' }, { label: 'Email', value: 'email' }, { label: 'Phone', value: 'phone' },
          { label: 'Member', value: (o) => (o.member ? 'yes' : 'no') },
          { label: 'Items', value: (o) => (o.items || []).map((i) => i.qty + ' x ' + i.name + (i.option ? ' (' + i.option + ')' : '')).join('; ') },
          { label: 'Total', value: (o) => Number(o.total).toFixed(2) }, { label: 'Payment', value: 'payment' },
          { label: 'Status', value: (o) => (ORDER_STATUS[o.status] || [o.status])[0] }, { label: 'Notes', value: 'notes' }, { label: 'Internal note', value: 'adminNote' },
        ]), 'text/csv');
      }
    });
  }

  async function orderDetail(id) {
    const orders = await data.list('orders');
    const o = orders.find((x) => x.id === id);
    if (!o) {
      view('Order', '<div class="card"><p class="card__empty">Order not found. <a href="#/orders">Back to orders</a></p></div>', 'orders');
      return;
    }
    const mail = 'mailto:' + encodeURIComponent(o.email) + '?subject=' + encodeURIComponent('Your ' + C.settings.shortName + ' order ' + o.ref) +
      '&body=' + encodeURIComponent('Hi ' + o.name.split(' ')[0] + ',\n\nThank you for your order ' + o.ref + '.\n\n' +
        (o.items || []).map((i) => i.qty + ' × ' + i.name + (i.option ? ' (' + i.option + ')' : '')).join('\n') +
        '\n\nTotal: ' + util.moneyExact(o.total) + '\n\n' + C.settings.shortName);

    const host = view('Order ' + o.ref,
      '<nav class="crumbs"><a href="#/orders">← Orders</a></nav>' +
      '<div class="editor__grid">' +
      '<div class="editor__main">' +
      '<section class="card"><header class="card__head"><h2>Items</h2><span>' + util.dateTime(o.createdAt) + '</span></header>' +
      '<table class="table"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead><tbody>' +
      (o.items || []).map((i) => {
        const ev = i.eventId && C.events.find((e) => e.id === i.eventId);
        return '<tr><td><b>' + esc(i.name) + '</b>' + (i.option ? '<small>' + esc(i.option) + '</small>' : '') + (ev ? '<small>' + esc(ev.title) + ', ' + esc(util.dateShort(ev.date)) + '</small>' : '') + '</td>' +
          '<td class="num">' + i.qty + '</td><td class="num">' + util.moneyExact(i.price) + '</td><td class="num">' + util.moneyExact(i.qty * i.price) + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td colspan="3">Total</td><td class="num"><b>' + util.moneyExact(o.total) + '</b></td></tr></tfoot></table></section>' +
      (o.notes ? '<section class="card"><header class="card__head"><h2>Customer notes</h2></header><p class="card__text">' + esc(o.notes) + '</p></section>' : '') +
      '<section class="card card--form"><div class="field"><label for="admin-note">Internal note</label><textarea class="textarea" id="admin-note" rows="3" placeholder="Only visible to the committee">' + esc(o.adminNote || '') + '</textarea></div>' +
      '<button class="btn" type="button" data-save-note>Save note</button></section>' +
      '</div>' +
      '<div class="editor__side">' +
      '<section class="card card--form"><div class="field"><label for="order-status">Status</label><select class="select" id="order-status">' +
      Object.entries(ORDER_STATUS).map(([k, [l]]) => '<option value="' + k + '"' + (k === o.status ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>' +
      (o.status === 'awaiting' || o.status === 'reserved' ? '<button class="btn btn--primary btn--block" type="button" data-mark-paid>Mark as paid</button>' : '') +
      '</section>' +
      '<section class="card"><header class="card__head"><h2>Customer</h2></header><dl class="dl">' +
      '<dt>Name</dt><dd>' + esc(o.name) + '</dd><dt>Email</dt><dd><a href="mailto:' + esc(o.email) + '">' + esc(o.email) + '</a></dd>' +
      (o.phone ? '<dt>Phone</dt><dd><a href="tel:' + esc(o.phone) + '">' + esc(o.phone) + '</a></dd>' : '') +
      '<dt>Member</dt><dd>' + (o.member ? 'Says they are a member' : 'No') + '</dd>' +
      '<dt>Payment</dt><dd>' + esc({ etransfer: 'Interac e-Transfer', door: 'Pay at event', none: 'Free' }[o.payment] || o.payment) + '</dd>' +
      (o.paidAt ? '<dt>Paid</dt><dd>' + util.dateTime(o.paidAt) + '</dd>' : '') +
      '</dl><div class="card__foot"><a class="btn btn--block" href="' + mail + '">Email customer</a></div></section>' +
      '<button class="btn btn--danger btn--block" type="button" data-delete>Delete order</button>' +
      '</div></div>',
      'orders');

    const setStatus = async (status) => {
      const patch = { status };
      if (status === 'paid' && !o.paidAt) patch.paidAt = new Date().toISOString();
      await data.update('orders', o.id, patch);
      util.toast('Order marked ' + ORDER_STATUS[status][0].toLowerCase() + '.');
      updateCounts();
      orderDetail(o.id);
    };
    $('#order-status', host).addEventListener('change', (e) => setStatus(e.target.value));
    const paid = $('[data-mark-paid]', host);
    if (paid) paid.addEventListener('click', () => setStatus('paid'));
    $('[data-save-note]', host).addEventListener('click', async () => {
      await data.update('orders', o.id, { adminNote: $('#admin-note', host).value.trim() });
      util.toast('Note saved.');
    });
    $('[data-delete]', host).addEventListener('click', async () => {
      if (!window.confirm('Delete order ' + o.ref + '? This cannot be undone.')) return;
      await data.remove('orders', o.id);
      updateCounts();
      location.hash = '#/orders';
    });
  }

  /* ============================================================ members */

  async function membersView() {
    const members = await data.list('members');
    let status = hashQuery().get('status') || 'all';
    let term = '';
    const tabs = [['all', 'All']].concat(Object.entries(MEMBER_STATUS).map(([k, [l]]) => [k, l]));
    const host = view('Members',
      '<div class="toolbar"><div class="tabs" role="group">' +
      tabs.map(([k, l]) => '<button type="button" data-filter="' + k + '" aria-pressed="' + (k === status) + '">' + l + '<i>' + (k === 'all' ? members.length : members.filter((m) => m.status === k).length) + '</i></button>').join('') +
      '</div><input class="input input--search" type="search" placeholder="Search members…" aria-label="Search members">' +
      '<button class="btn" type="button" data-export' + (members.length ? '' : ' disabled') + '>Export CSV</button>' +
      '<a class="btn btn--primary" href="#/members/new">Add member</a></div>' +
      '<div class="card card--flush"><table class="table table--rows"><thead><tr><th>Member</th><th>Plan</th><th>City</th><th>Joined</th><th>Expires</th><th>Status</th></tr></thead><tbody id="rows"></tbody></table></div>',
      'members');
    const shown = () => members.filter((m) => (status === 'all' || m.status === status) &&
      (!term || [m.name, m.email, m.ref, m.city].join(' ').toLowerCase().includes(term)));
    function draw() {
      $('#rows', host).innerHTML = shown().map((m) =>
        '<tr class="is-link" data-href="#/members/' + encodeURIComponent(m.id) + '">' +
        '<td><b>' + esc(m.name) + '</b><small>' + esc(m.email) + '</small></td>' +
        '<td>' + esc(m.plan) + '<small>' + util.moneyExact(m.amount) + '</small></td>' +
        '<td>' + esc(m.city || '') + '</td>' +
        '<td>' + esc(util.dateShort((m.activatedAt || m.createdAt || '').slice(0, 10))) + '</td>' +
        '<td>' + esc(util.dateShort(m.expiresAt || '')) + '</td>' +
        '<td>' + badge(MEMBER_STATUS, m.status) + '</td></tr>'
      ).join('') || '<tr><td colspan="6" class="card__empty">' + (members.length ? 'No members match.' : 'No members yet. Applications from the membership page appear here.') + '</td></tr>';
    }
    draw();
    rowLinks(host);
    host.addEventListener('input', (e) => { if (e.target.type === 'search') { term = e.target.value.trim().toLowerCase(); draw(); } });
    host.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-filter]');
      if (tab) {
        status = tab.dataset.filter;
        $$('[data-filter]', host).forEach((b) => b.setAttribute('aria-pressed', String(b === tab)));
        draw();
      }
      if (e.target.closest('[data-export]')) {
        util.download('gca-members-' + util.todayISO() + '.csv', util.csv(shown(), [
          { label: 'Reference', value: 'ref' }, { label: 'First name', value: 'firstName' }, { label: 'Last name', value: 'lastName' },
          { label: 'Email', value: 'email' }, { label: 'Phone', value: 'phone' }, { label: 'City', value: 'city' },
          { label: 'Plan', value: 'plan' }, { label: 'Amount', value: (m) => Number(m.amount || 0).toFixed(2) },
          { label: 'Status', value: (m) => (MEMBER_STATUS[m.status] || [m.status])[0] }, { label: 'Applied', value: 'createdAt' },
          { label: 'Expires', value: 'expiresAt' }, { label: 'Household', value: 'household' }, { label: 'Volunteer', value: (m) => (m.volunteer ? 'yes' : '') },
        ]), 'text/csv');
      }
    });
  }

  const MEMBER_FIELDS = [
    { name: 'firstName', label: 'First name', required: true, half: true },
    { name: 'lastName', label: 'Last name', required: true, half: true },
    { name: 'email', label: 'Email', inputType: 'email', required: true, half: true },
    { name: 'phone', label: 'Phone', half: true },
    { name: 'city', label: 'City', half: true },
    { name: 'planId', label: 'Plan', type: 'select', half: true, options: () => C.plans.map((p) => [p.id, p.name + ' (' + util.money(p.price) + ')']) },
    { name: 'household', label: 'Household members', type: 'textarea', rows: 3 },
    { name: 'adminNote', label: 'Internal note', type: 'textarea', rows: 2 },
  ];

  async function memberDetail(id) {
    const members = await data.list('members');
    const isNew = id === 'new';
    const m = isNew ? { status: 'active', planId: (C.plans[0] || {}).id } : members.find((x) => x.id === id);
    if (!m) {
      view('Member', '<div class="card"><p class="card__empty">Member not found. <a href="#/members">Back to members</a></p></div>', 'members');
      return;
    }
    let fieldsHTML = '';
    for (let i = 0; i < MEMBER_FIELDS.length; i++) {
      const f = MEMBER_FIELDS[i];
      if (f.half && MEMBER_FIELDS[i + 1] && MEMBER_FIELDS[i + 1].half) {
        fieldsHTML += '<div class="form-row">' + fieldHTML(f, m[f.name]) + fieldHTML(MEMBER_FIELDS[i + 1], m[MEMBER_FIELDS[i + 1].name]) + '</div>';
        i++;
      } else fieldsHTML += fieldHTML(f, m[f.name]);
    }
    const host = view(isNew ? 'Add member' : m.name,
      '<form class="editor" id="editor" novalidate><nav class="crumbs"><a href="#/members">← Members</a></nav>' +
      '<div class="editor__grid"><div class="editor__main"><section class="card card--form">' + fieldsHTML + '</section></div>' +
      '<div class="editor__side"><section class="card card--form">' +
      '<div class="field"><label for="m-status">Status</label><select class="select" id="m-status" name="status">' +
      Object.entries(MEMBER_STATUS).map(([k, [l]]) => '<option value="' + k + '"' + (k === m.status ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' +
      '<small>Setting a member to Active starts a 12-month membership.</small></div>' +
      '<div class="field"><label for="m-expires">Expires</label><input class="input" id="m-expires" name="expiresAt" type="date" value="' + esc(m.expiresAt || '') + '"></div>' +
      '</section>' +
      (isNew ? '' : '<section class="card"><dl class="dl"><dt>Reference</dt><dd>' + esc(m.ref || '—') + '</dd><dt>Applied</dt><dd>' + util.dateTime(m.createdAt) + '</dd>' +
        (m.heard ? '<dt>Heard via</dt><dd>' + esc(m.heard) + '</dd>' : '') +
        '<dt>Volunteer</dt><dd>' + (m.volunteer ? 'Interested' : '—') + '</dd><dt>Newsletter</dt><dd>' + (m.newsletter ? 'Yes' : 'No') + '</dd></dl>' +
        '<div class="card__foot"><a class="btn btn--block" href="mailto:' + esc(m.email) + '">Email member</a></div></section>') +
      '</div></div>' +
      '<div class="savebar">' + (isNew ? '' : '<button class="btn btn--danger" type="button" data-delete>Delete</button>') +
      '<span class="savebar__space"></span><a class="btn btn--quiet" href="#/members">Cancel</a><button class="btn btn--primary" type="submit">' + (isNew ? 'Add member' : 'Save changes') + '</button></div></form>',
      'members');

    const form = $('#editor', host);
    enhanceForm(form, MEMBER_FIELDS);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateRequired(form)) return;
      const values = readFields(form, MEMBER_FIELDS);
      const plan = C.plans.find((p) => p.id === values.planId);
      const status = form.elements.status.value;
      let expiresAt = form.elements.expiresAt.value;
      const patch = Object.assign(values, {
        name: (values.firstName + ' ' + values.lastName).trim(),
        email: values.email.toLowerCase(),
        plan: plan ? plan.name : m.plan || '',
        amount: plan ? Number(plan.price) || 0 : m.amount || 0,
        status,
      });
      if (status === 'active' && m.status !== 'active') {
        patch.activatedAt = new Date().toISOString();
        if (!expiresAt) {
          const d = new Date();
          d.setFullYear(d.getFullYear() + 1);
          expiresAt = d.toISOString().slice(0, 10);
        }
      }
      patch.expiresAt = expiresAt;
      if (isNew) await data.add('members', Object.assign({ ref: util.reference('MEM'), source: 'admin' }, patch));
      else await data.update('members', m.id, patch);
      dirty = false;
      updateCounts();
      util.toast(isNew ? 'Member added.' : 'Member saved.');
      location.hash = '#/members';
    });
    const del = $('[data-delete]', form);
    if (del) del.addEventListener('click', async () => {
      if (!window.confirm('Delete ' + m.name + '?')) return;
      await data.remove('members', m.id);
      dirty = false;
      updateCounts();
      location.hash = '#/members';
    });
  }

  /* =========================================================== messages */

  async function messagesView() {
    const messages = await data.list('messages');
    const host = view('Messages',
      '<div class="card card--flush"><table class="table table--rows"><thead><tr><th>From</th><th>Topic</th><th>Message</th><th>Received</th></tr></thead><tbody>' +
      (messages.map((m) =>
        '<tr class="is-link' + (m.read ? '' : ' is-unread') + '" data-href="#/messages/' + encodeURIComponent(m.id) + '">' +
        '<td><b>' + esc(m.name) + '</b><small>' + esc(m.email) + '</small></td><td>' + esc(m.topic) + '</td>' +
        '<td class="clip">' + esc(m.message) + '</td><td>' + util.dateTime(m.createdAt) + '</td></tr>'
      ).join('') || '<tr><td colspan="4" class="card__empty">No messages yet. Messages from the contact page appear here.</td></tr>') +
      '</tbody></table></div>',
      'messages');
    rowLinks(host);
  }

  async function messageDetail(id) {
    const messages = await data.list('messages');
    const m = messages.find((x) => x.id === id);
    if (!m) {
      view('Message', '<div class="card"><p class="card__empty">Message not found. <a href="#/messages">Back to inbox</a></p></div>', 'messages');
      return;
    }
    if (!m.read) {
      await data.update('messages', m.id, { read: true });
      updateCounts();
    }
    const reply = 'mailto:' + encodeURIComponent(m.email) + '?subject=' + encodeURIComponent('Re: ' + m.topic + ' · ' + C.settings.shortName) +
      '&body=' + encodeURIComponent('\n\n---\nOn ' + util.dateTime(m.createdAt) + ', ' + m.name + ' wrote:\n' + m.message);
    const host = view(m.topic + ' from ' + m.name,
      '<nav class="crumbs"><a href="#/messages">← Messages</a></nav>' +
      '<div class="editor__grid"><div class="editor__main"><section class="card"><header class="card__head"><h2>' + esc(m.topic) + '</h2><span>' + util.dateTime(m.createdAt) + '</span></header>' +
      '<div class="card__text message-body">' + util.paragraphs(m.message) + '</div>' +
      '<div class="card__foot row-end"><button class="btn btn--quiet" type="button" data-unread>Mark unread</button><a class="btn btn--primary" href="' + reply + '">Reply by email</a></div></section></div>' +
      '<div class="editor__side"><section class="card"><dl class="dl"><dt>Name</dt><dd>' + esc(m.name) + '</dd><dt>Email</dt><dd><a href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a></dd>' +
      (m.phone ? '<dt>Phone</dt><dd><a href="tel:' + esc(m.phone) + '">' + esc(m.phone) + '</a></dd>' : '') + '</dl></section>' +
      '<button class="btn btn--danger btn--block" type="button" data-delete>Delete message</button></div></div>',
      'messages');
    $('[data-unread]', host).addEventListener('click', async () => {
      await data.update('messages', m.id, { read: false });
      updateCounts();
      location.hash = '#/messages';
    });
    $('[data-delete]', host).addEventListener('click', async () => {
      if (!window.confirm('Delete this message?')) return;
      await data.remove('messages', m.id);
      updateCounts();
      location.hash = '#/messages';
    });
  }

  /* ======================================================== subscribers */

  async function subscribersView() {
    const subs = await data.list('subscribers');
    const host = view('Subscribers',
      '<div class="toolbar"><form class="toolbar__form" id="add-sub" novalidate><input class="input" type="email" placeholder="Add an email address" aria-label="Email address" required><button class="btn" type="submit">Add</button></form>' +
      '<span class="savebar__space"></span>' +
      '<button class="btn" type="button" data-copy' + (subs.length ? '' : ' disabled') + '>Copy all emails</button>' +
      '<button class="btn" type="button" data-export' + (subs.length ? '' : ' disabled') + '>Export CSV</button></div>' +
      '<div class="card card--flush"><table class="table table--rows"><thead><tr><th>Email</th><th>Signed up from</th><th>Date</th><th class="actions"></th></tr></thead><tbody>' +
      (subs.map((s) => '<tr><td><b>' + esc(s.email) + '</b></td><td>' + esc(s.source || '—') + '</td><td>' + util.dateTime(s.createdAt) + '</td>' +
        '<td class="actions"><button class="icon-btn icon-btn--danger" type="button" data-remove="' + esc(s.id) + '" aria-label="Remove">×</button></td></tr>').join('') ||
        '<tr><td colspan="4" class="card__empty">No subscribers yet. Sign-ups from the footer form appear here.</td></tr>') +
      '</tbody></table></div>',
      'subscribers');
    $('#add-sub', host).addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('input', e.target);
      const email = input.value.trim().toLowerCase();
      if (!util.validEmail(email)) return util.toast('Please enter a valid email.', 'error');
      if (subs.some((s) => s.email === email)) return util.toast('Already subscribed.');
      await data.add('subscribers', { email, source: 'admin' });
      subscribersView();
    });
    host.addEventListener('click', async (e) => {
      if (e.target.closest('[data-copy]')) {
        try {
          await navigator.clipboard.writeText(subs.map((s) => s.email).join(', '));
          util.toast('Copied ' + subs.length + ' emails. Paste them into BCC.');
        } catch (err) {
          util.toast('Copy failed; use Export CSV instead.', 'error');
        }
      }
      if (e.target.closest('[data-export]')) {
        util.download('gca-subscribers-' + util.todayISO() + '.csv', util.csv(subs, [{ label: 'Email', value: 'email' }, { label: 'Source', value: 'source' }, { label: 'Date', value: 'createdAt' }]), 'text/csv');
      }
      const rm = e.target.closest('[data-remove]');
      if (rm && window.confirm('Remove this subscriber?')) {
        await data.remove('subscribers', rm.dataset.remove);
        subscribersView();
      }
    });
  }

  /* ============================================================ publish */

  function diffSummary() {
    const pub = data.normalize(window.GCA_PUBLISHED);
    const rows = [];
    const labels = { announcements: 'Announcements', events: 'Events', products: 'Tickets & shop', plans: 'Membership plans', deities: 'Darshan', gallery: 'Gallery', committee: 'Committee', sponsors: 'Sponsors' };
    data.CONTENT_LISTS.forEach((k) => {
      const before = new Map(pub[k].map((x) => [x.id, JSON.stringify(x)]));
      const after = new Map(C[k].map((x) => [x.id, JSON.stringify(x)]));
      let added = 0, removed = 0, changed = 0;
      after.forEach((v, id) => { if (!before.has(id)) added++; else if (before.get(id) !== v) changed++; });
      before.forEach((v, id) => { if (!after.has(id)) removed++; });
      const reordered = !added && !removed && !changed && JSON.stringify(pub[k].map((x) => x.id)) !== JSON.stringify(C[k].map((x) => x.id));
      if (added || removed || changed || reordered) {
        rows.push([labels[k], [added && added + ' added', changed && changed + ' edited', removed && removed + ' removed', reordered && 'reordered'].filter(Boolean).join(', ')]);
      }
    });
    ['settings', 'pages'].forEach((k) => {
      const keys = new Set(Object.keys(pub[k]).concat(Object.keys(C[k])));
      const changed = Array.from(keys).filter((x) => JSON.stringify(pub[k][x]) !== JSON.stringify(C[k][x]));
      if (changed.length) rows.push([k === 'settings' ? 'Settings' : 'Page text', changed.length + ' field' + (changed.length === 1 ? '' : 's') + ' edited']);
    });
    return rows;
  }

  function publishView() {
    const changes = data.isDraft ? diffSummary() : [];
    const publishedAt = window.GCA_PUBLISHED && window.GCA_PUBLISHED.publishedAt;
    const host = view('Publish & backup',
      '<div class="grid-2">' +
      '<section class="card"><header class="card__head"><h2>Publish changes</h2>' + (data.isDraft ? '<span class="badge badge--warn">Draft</span>' : '<span class="badge badge--ok">Live</span>') + '</header>' +
      '<div class="card__text">' +
      (data.isDraft
        ? (changes.length ? '<p>Changes since the live version' + (publishedAt ? ' (' + util.dateTime(publishedAt) + ')' : '') + ':</p><ul class="changes">' + changes.map(([k, v]) => '<li><b>' + k + '</b><span>' + v + '</span></li>').join('') + '</ul>'
          : '<p>Your draft matches the live site.</p>') +
          '<ol class="steps">' +
          '<li><span><b>Download</b> the new <code>content.js</code> below.</span></li>' +
          '<li><span>In the website repository, <b>replace</b> <code>data/content.js</code> with it (on GitHub: open the <code>data</code> folder → Add file → Upload files).</span></li>' +
          '<li><span>Once the site has updated, click <b>Clear draft</b> so this browser shows the live version again.</span></li></ol>'
        : '<p>Everything you see here is what visitors see. Edits you make are saved as a draft and previewed on the site in this browser until you publish them.</p>') +
      '</div><div class="card__foot row-end">' +
      (data.isDraft ? '<button class="btn btn--quiet" type="button" data-discard>Clear draft</button>' : '') +
      '<button class="btn btn--primary" type="button" data-download>Download content.js</button></div></section>' +

      '<section class="card"><header class="card__head"><h2>Backup</h2></header><div class="card__text">' +
      '<p>A backup contains all content plus orders, members, messages and subscribers stored in this browser. Download one regularly, and before clearing browser data.</p></div>' +
      '<div class="card__foot row-end"><label class="btn btn--quiet">Restore from file<input type="file" accept="application/json,.json" hidden data-restore></label>' +
      '<button class="btn" type="button" data-backup>Download backup</button></div></section>' +
      '</div>' +
      '<section class="card card--danger mt-lg"><header class="card__head"><h2>Danger zone</h2></header><div class="card__text"><p>Permanently delete all orders, members, messages and subscribers stored in this browser. Content is not affected.</p></div>' +
      '<div class="card__foot row-end"><button class="btn btn--danger" type="button" data-wipe>Delete all records</button></div></section>',
      'publish');

    host.addEventListener('click', async (e) => {
      if (e.target.closest('[data-download]')) {
        util.download('content.js', data.publishFile(C), 'text/javascript');
        util.toast('Downloaded. Replace data/content.js with this file.');
      }
      if (e.target.closest('[data-discard]')) {
        if (!window.confirm('Clear the draft? Any changes you have not published yet will be lost.')) return;
        await data.discardDraft();
        C = data.content;
        updateDraftChip();
        util.toast('Draft cleared.');
        publishView();
      }
      if (e.target.closest('[data-backup]')) {
        util.download('gca-backup-' + util.todayISO() + '.json', JSON.stringify(await data.backup(), null, 2), 'application/json');
      }
      if (e.target.closest('[data-wipe]')) {
        if (window.prompt('Type DELETE to permanently remove all records from this browser.') !== 'DELETE') return;
        for (const t of data.RECORD_TYPES) await data.adapter.replace(t, []);
        updateCounts();
        util.toast('All records deleted.');
      }
    });
    $('[data-restore]', host).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const backup = JSON.parse(await file.text());
        if (!window.confirm('Restore this backup? It replaces the current draft and all records in this browser.')) return;
        await data.restore(backup);
        C = data.content;
        renderShell();
        publishView();
        util.toast('Backup restored.');
      } catch (err) {
        util.toast(err.message || 'That file could not be read.', 'error');
      }
      e.target.value = '';
    });
  }

  /* ============================================================= router */

  const ROUTES = [
    [/^#?\/?(dashboard)?$/, dashboard],
    [/^#\/(events|products|gallery|deities|sponsors|committee|plans|announcements)$/, (m) => listView(m[1])],
    [/^#\/(events|products|gallery|deities|sponsors|committee|plans|announcements)\/([^/]+)$/, (m) => editView(m[1], decodeURIComponent(m[2]))],
    [/^#\/pages$/, pagesView],
    [/^#\/settings$/, settingsView],
    [/^#\/orders$/, ordersView],
    [/^#\/orders\/(.+)$/, (m) => orderDetail(decodeURIComponent(m[1]))],
    [/^#\/members$/, membersView],
    [/^#\/members\/(.+)$/, (m) => memberDetail(decodeURIComponent(m[1]))],
    [/^#\/messages$/, messagesView],
    [/^#\/messages\/(.+)$/, (m) => messageDetail(decodeURIComponent(m[1]))],
    [/^#\/subscribers$/, subscribersView],
    [/^#\/publish$/, publishView],
  ];
  let currentHash = location.hash;

  function route() {
    const path = location.hash.split('?')[0];
    for (const [re, fn] of ROUTES) {
      const m = path.match(re);
      if (m) {
        dirty = false;
        currentHash = location.hash;
        document.body.classList.remove('side-open');
        Promise.resolve(fn(m)).catch((err) => {
          console.error(err);
          util.toast('Something went wrong loading this page.', 'error');
        });
        return;
      }
    }
    location.hash = '#/dashboard';
  }

  window.addEventListener('hashchange', () => {
    if (location.hash === currentHash) return;
    if (!confirmLeave()) {
      history.replaceState(null, '', currentHash || '#/dashboard');
      return;
    }
    route();
  });
  window.addEventListener('beforeunload', (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* =============================================================== auth */

  async function checkPassword(pw) {
    const auth = await data.adapter.getAuth();
    if (!auth) return pw === DEFAULT_PASSWORD ? 'default' : false;
    return util.sha256(auth.salt + pw) === auth.hash ? 'ok' : false;
  }

  async function setPassword(pw) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const salt = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    await data.adapter.setAuth({ salt, hash: util.sha256(salt + pw), updatedAt: new Date().toISOString() });
  }

  function hasSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      return s && s.until > Date.now();
    } catch (e) {
      return false;
    }
  }

  function startSession() {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ until: Date.now() + SESSION_HOURS * 3600 * 1000 }));
  }

  function authScreen(mode) {
    document.title = 'Committee login · GCA Admin';
    const first = mode === 'first';
    const setNew = mode === 'set';
    app.innerHTML =
      '<div class="auth"><form class="auth__card" novalidate>' +
      '<img src="../assets/img/logo-mark.svg" alt="" width="56" height="56">' +
      '<h1>' + (setNew ? 'Choose a new password' : 'Committee login') + '</h1>' +
      '<p>' + (setNew ? 'The default password can’t be kept. Choose one only the committee knows.'
        : first ? 'First time here? Sign in with the default password <code>' + DEFAULT_PASSWORD + '</code>. You’ll choose a new one next.'
          : 'Sign in to manage events, tickets and members.') + '</p>' +
      (setNew
        ? '<div class="field"><label for="pw1">New password</label><input class="input" id="pw1" type="password" autocomplete="new-password" minlength="8" required><small>At least 8 characters.</small></div>' +
          '<div class="field"><label for="pw2">Confirm password</label><input class="input" id="pw2" type="password" autocomplete="new-password" required></div>'
        : '<div class="field"><label for="pw">Password</label><input class="input" id="pw" type="password" autocomplete="current-password" required autofocus></div>') +
      '<button class="btn btn--primary btn--block" type="submit">' + (setNew ? 'Save and continue' : 'Sign in') + '</button>' +
      '<a class="auth__back" href="../index.html">← Back to the website</a>' +
      '</form></div>';

    const form = $('form', app);
    $('input', form).focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (setNew) {
        const a = $('#pw1').value;
        const b = $('#pw2').value;
        if (a.length < 8) return util.toast('Use at least 8 characters.', 'error');
        if (a === DEFAULT_PASSWORD) return util.toast('Please choose something other than the default.', 'error');
        if (a !== b) return util.toast('The passwords don’t match.', 'error');
        await setPassword(a);
        startSession();
        return enter();
      }
      const result = await checkPassword($('#pw').value);
      if (!result) {
        await new Promise((r) => setTimeout(r, 700));
        $('#pw').value = '';
        $('#pw').setAttribute('aria-invalid', 'true');
        return util.toast('That password isn’t right.', 'error');
      }
      if (result === 'default') return authScreen('set');
      startSession();
      enter();
    });
  }

  function enter() {
    renderShell();
    route();
  }

  async function boot() {
    try {
      await data.load();
    } catch (e) {
      data.content = data.normalize(window.GCA_PUBLISHED);
    }
    C = data.content;
    if (hasSession()) return enter();
    const auth = await data.adapter.getAuth();
    authScreen(auth ? 'login' : 'first');
  }

  boot();
})();
