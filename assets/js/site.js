/* GCA Golden Triangle — public site: shared layout + per-page rendering. */
(function () {
  'use strict';
  const { util, data, art, events: EV, cart } = window.GCA;
  const { $, $$, esc } = util;
  let C = null;

  const NAV = [
    ['about.html', 'About'],
    ['events.html', 'Events'],
    ['gallery.html', 'Gallery'],
    ['membership.html', 'Membership'],
    ['shop.html', 'Shop'],
    ['contact.html', 'Contact'],
  ];
  const NAV_PARENT = { 'event.html': 'events.html', 'checkout.html': 'shop.html', 'index.html': '' };

  const ICON = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 12.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9L5 8Z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  };

  const currentFile = () => location.pathname.split('/').pop() || 'index.html';
  const logoSrc = () => C.settings.logo || 'assets/img/logo-mark.svg';

  function get(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  /* ------------------------------------------------------------ layout */

  function renderHeader() {
    const host = $('#site-header');
    if (!host) return;
    const file = currentFile();
    const active = file in NAV_PARENT ? NAV_PARENT[file] : file;
    const s = C.settings;

    let notice = '';
    const ann = (C.announcements || []).find((a) => a.active && a.text);
    const annKey = ann ? 'gca:notice:' + util.hash(ann.id + ann.text) : '';
    let dismissed = false;
    try { dismissed = annKey && localStorage.getItem(annKey) === '1'; } catch (e) { /* ignore */ }
    if (ann && s.showAnnouncement !== false && !dismissed) {
      notice =
        '<div class="notice" role="region" aria-label="Announcement"><div class="wrap"><span>' + esc(ann.text) + '</span>' +
        (ann.link ? ' <a href="' + esc(ann.link) + '">' + esc(ann.linkText || 'Learn more') + ' →</a>' : '') +
        '<button class="notice__close" type="button" aria-label="Dismiss announcement">' + ICON.close + '</button></div></div>';
    }

    const preview = data.isDraft
      ? '<div class="preview-bar">You are previewing unpublished changes from the admin panel. <a href="admin/#/publish">Review &amp; publish</a></div>'
      : '';

    host.innerHTML =
      preview + notice +
      '<header class="masthead"><div class="wrap">' +
      '<a class="brand" href="index.html" aria-label="' + esc(s.shortName) + ', home">' +
      '<span class="brand__mark"><img src="' + esc(logoSrc()) + '" alt="" width="46" height="46"></span>' +
      '<span class="brand__text"><span class="brand__name">GCA</span><span class="brand__sub">Golden Triangle</span></span></a>' +
      '<nav class="nav" id="site-nav" aria-label="Main">' +
      NAV.map(([href, label]) => '<a href="' + href + '"' + (href === active ? ' aria-current="page"' : '') + '>' + label + '</a>').join('') +
      '</nav>' +
      '<div class="masthead__actions">' +
      '<button class="bag-btn" type="button" data-open-bag aria-label="Open bag">' + ICON.bag + '<span class="bag-label">Bag</span><span class="bag-count" data-count="0">0</span></button>' +
      '<a class="btn btn--primary btn--small masthead__join" href="membership.html">Become a member</a>' +
      '<button class="nav-toggle" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Menu"><span></span></button>' +
      '</div></div></header>';

    const close = $('.notice__close', host);
    if (close) {
      close.addEventListener('click', () => {
        try { localStorage.setItem(annKey, '1'); } catch (e) { /* ignore */ }
        $('.notice', host).remove();
      });
    }

    const toggle = $('.nav-toggle', host);
    toggle.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    $$('.nav a', host).forEach((a) => a.addEventListener('click', () => document.body.classList.remove('nav-open')));

    const masthead = $('.masthead', host);
    const onScroll = () => masthead.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function renderFooter() {
    const host = $('#site-footer');
    if (!host) return;
    const s = C.settings;
    const social = [
      ['instagram', 'Instagram'],
      ['facebook', 'Facebook'],
      ['youtube', 'YouTube'],
      ['whatsapp', 'WhatsApp community'],
    ].filter(([k]) => s[k]);

    host.innerHTML =
      '<section class="signup" aria-labelledby="signup-title"><div class="wrap">' +
      '<div><h2 id="signup-title">Hear about events first.</h2><p>One short email a month with upcoming events, ticket launches and community news. No spam, ever.</p></div>' +
      '<form class="inline-form" id="signup-form" novalidate>' +
      '<label class="visually-hidden" for="signup-email">Email address</label>' +
      '<input class="input" id="signup-email" type="email" name="email" placeholder="you@example.com" autocomplete="email" required>' +
      '<button class="btn btn--primary" type="submit">Subscribe</button></form>' +
      '</div></section>' +
      '<footer class="footer"><div class="band" aria-hidden="true"></div>' +
      '<div class="wrap footer__grid">' +
      '<div><a class="brand" href="index.html"><span class="brand__mark"><img src="' + esc(logoSrc()) + '" alt="" width="46" height="46"></span>' +
      '<span class="brand__text"><span class="brand__name">GCA</span><span class="brand__sub">Golden Triangle</span></span></a>' +
      '<p class="footer__about">' + esc(s.tagline) + '</p>' +
      (s.gujaratiName ? '<p class="footer__guj">' + esc(s.gujaratiName) + '</p>' : '') + '</div>' +
      '<div><h3>Explore</h3><ul><li><a href="events.html">Events</a></li><li><a href="index.html#darshan">Darshan</a></li><li><a href="gallery.html">Gallery</a></li><li><a href="about.html">About us</a></li></ul></div>' +
      '<div><h3>Get involved</h3><ul><li><a href="membership.html">Membership</a></li><li><a href="shop.html">Tickets &amp; shop</a></li><li><a href="about.html#sponsor">Sponsorship</a></li><li><a href="contact.html?topic=Volunteering">Volunteer</a></li></ul></div>' +
      '<div><h3>Contact</h3><ul>' +
      (s.email ? '<li><a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a></li>' : '') +
      (s.phone ? '<li><a href="tel:' + esc(s.phone.replace(/[^\d+]/g, '')) + '">' + esc(s.phone) + '</a></li>' : '') +
      (s.address ? '<li>' + esc(s.address) + '</li>' : '') +
      social.map(([k, label]) => '<li><a href="' + esc(s[k]) + '" rel="noopener" target="_blank">' + label + '</a></li>').join('') +
      '</ul></div>' +
      '</div>' +
      '<div class="wrap footer__bottom"><span>© ' + new Date().getFullYear() + ' ' + esc(s.orgName) + (s.registration ? ' · ' + esc(s.registration) : '') + '</span>' +
      '<span><a href="admin/">Committee login</a></span></div>' +
      '</footer>';

    $('#signup-form', host).addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('#signup-email', host);
      const email = input.value.trim().toLowerCase();
      if (!util.validEmail(email)) {
        input.setAttribute('aria-invalid', 'true');
        util.toast('Please enter a valid email address.', 'error');
        return;
      }
      input.removeAttribute('aria-invalid');
      const existing = await data.list('subscribers');
      if (!existing.some((r) => r.email === email)) {
        await data.add('subscribers', { email, source: currentFile() });
      }
      input.value = '';
      util.toast('Thanks! You’re on the list.');
    });
  }

  /** Fill [data-bind] elements from content, e.g. data-bind="pages.heroTitle". */
  function applyBindings() {
    $$('[data-bind]').forEach((el) => {
      const v = get(C, el.dataset.bind);
      if (v != null && v !== '') el.textContent = v;
      else if (el.hasAttribute('data-hide-empty')) el.remove();
    });
    $$('[data-bind-html]').forEach((el) => {
      const v = get(C, el.dataset.bindHtml);
      if (v) el.innerHTML = util.paragraphs(v);
    });
  }

  /* --------------------------------------------------------------- bag */

  function setupBag() {
    const host = document.createElement('div');
    host.innerHTML =
      '<div class="scrim" data-close-bag></div>' +
      '<aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="bag-title" tabindex="-1">' +
      '<div class="drawer__head"><h2 id="bag-title">Your bag</h2><button class="icon-btn" type="button" data-close-bag aria-label="Close bag">' + ICON.close + '</button></div>' +
      '<div class="drawer__body"></div><div class="drawer__foot"></div></aside>';
    document.body.appendChild(host);
    const drawer = $('.drawer', host);
    const scrim = $('.scrim', host);
    let lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      render();
      drawer.classList.add('is-open');
      scrim.classList.add('is-open');
      drawer.focus();
    }
    function close() {
      drawer.classList.remove('is-open');
      scrim.classList.remove('is-open');
      if (lastFocus) lastFocus.focus();
    }
    function render() {
      const lines = cart.lines(C);
      const body = $('.drawer__body', drawer);
      const foot = $('.drawer__foot', drawer);
      if (!lines.length) {
        body.innerHTML = '<div class="bag-empty"><p>Your bag is empty.</p><a class="arrow-link" href="events.html">Browse events</a></div>';
        foot.innerHTML = '';
        foot.hidden = true;
        return;
      }
      foot.hidden = false;
      body.innerHTML = lines.map((l) => {
        const ev = l.product.eventId ? C.events.find((e) => e.id === l.product.eventId) : null;
        return (
          '<div class="bag-line" data-key="' + esc(l.key) + '">' +
          '<div class="media">' + art.media(l.product.image || (ev && ev.image), ev ? ev.art : '', l.product.id, '') + '</div>' +
          '<div><h3>' + esc(l.product.name) + '</h3>' +
          (ev ? '<small>' + esc(ev.title) + ' · ' + util.dateShort(ev.date) + '</small>' : '') +
          (l.option ? '<small>' + esc(l.option) + '</small>' : '') +
          '<div class="bag-line__controls">' + stepper(l.qty, 'bag') +
          '<button class="bag-line__remove" type="button" data-remove>Remove</button></div></div>' +
          '<div class="bag-line__price">' + util.money(l.total) + '</div></div>'
        );
      }).join('');
      foot.innerHTML =
        '<div class="summary__total"><span>Subtotal</span><b>' + util.moneyExact(cart.total(C)) + '</b></div>' +
        '<a class="btn btn--primary btn--block" href="checkout.html">Checkout</a>' +
        '<button class="btn btn--block" type="button" data-close-bag>Keep browsing</button>';
    }

    host.addEventListener('click', (e) => {
      if (e.target.closest('[data-close-bag]')) return close();
      const line = e.target.closest('.bag-line');
      if (!line) return;
      const key = line.dataset.key;
      const item = cart.items().find((i) => i.key === key);
      if (!item) return;
      if (e.target.closest('[data-remove]')) cart.remove(key);
      else if (e.target.closest('[data-step="+"]')) cart.setQty(key, Math.min(item.qty + 1, 20));
      else if (e.target.closest('[data-step="-"]')) cart.setQty(key, item.qty - 1);
      render();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) close();
    });
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-open-bag]')) open();
    });

    const updateCount = () => {
      const n = cart.lines(C).reduce((s, l) => s + l.qty, 0);
      $$('.bag-count').forEach((el) => {
        el.textContent = n;
        el.dataset.count = n;
      });
    };
    cart.onChange(updateCount);
    window.addEventListener('storage', (e) => {
      if (e.key === 'gca:cart') updateCount();
    });
    updateCount();
    return { open, close, render };
  }
  let bag = null;

  function stepper(value, name, min) {
    const lo = min == null ? 0 : min;
    return (
      '<span class="stepper" data-stepper="' + esc(name || '') + '">' +
      '<button type="button" data-step="-" aria-label="Decrease"' + (value <= lo ? ' disabled' : '') + '>−</button>' +
      '<output aria-live="polite">' + value + '</output>' +
      '<button type="button" data-step="+" aria-label="Increase">+</button></span>'
    );
  }

  /* ------------------------------------------------------- shared views */

  function scheduleRow(ev) {
    const p = util.dateParts(ev.date);
    const price = EV.priceFrom(C, ev.id);
    const past = EV.isPast(ev);
    let aside = '';
    if (!past) {
      aside =
        '<div class="sched-row__aside">' +
        (price == null ? '<div class="sched-row__price"><small>Entry</small>Free</div>'
          : '<div class="sched-row__price"><small>' + (price === 0 ? 'Entry' : 'From') + '</small>' + util.money(price) + '</div>') +
        '<span class="btn btn--small">' + (price == null ? 'Details' : price === 0 ? 'RSVP' : 'Tickets') + '</span></div>';
    }
    return (
      '<a class="sched-row" href="event.html?id=' + encodeURIComponent(ev.id) + '">' +
      '<div class="sched-date"><small>' + p.day + '</small><b>' + p.dd + '</b><span>' + p.mon + ' ' + p.year.slice(2) + '</span></div>' +
      '<div><h3 class="sched-row__title">' + esc(ev.title) + (ev.gujaratiTitle ? '<span class="guj">' + esc(ev.gujaratiTitle) + '</span>' : '') + '</h3>' +
      '<div class="sched-row__meta"><span>' + esc(util.dateLong(ev.date, ev.endDate)) + '</span>' +
      (ev.startTime ? '<span>' + util.timeRange(ev.startTime, ev.endTime) + '</span>' : '') +
      (ev.venue ? '<span>' + esc(ev.venue) + '</span>' : '') + '</div>' +
      (ev.summary && !past ? '<p class="sched-row__summary">' + esc(ev.summary) + '</p>' : '') + '</div>' +
      aside + '</a>'
    );
  }

  function planCards(host, onSelect) {
    const plans = C.plans || [];
    host.style.setProperty('--cols', Math.min(plans.length, 4) || 1);
    host.innerHTML = plans.map((p) =>
      '<div class="plan' + (p.featured ? ' plan--featured' : '') + '">' +
      (p.featured ? '<span class="plan__badge">Most popular</span>' : '') +
      '<h3>' + esc(p.name) + '</h3><p class="plan__aud">' + esc(p.audience) + '</p>' +
      '<div class="plan__price"><b>' + util.money(p.price) + '</b><span>/ ' + esc(p.period || 'year') + '</span></div>' +
      '<ul>' + util.lines(p.features).map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>' +
      (onSelect
        ? '<button class="btn btn--primary btn--block" type="button" data-plan="' + esc(p.id) + '">Choose ' + esc(p.name) + '</button>'
        : '<a class="btn btn--primary btn--block" href="membership.html?plan=' + encodeURIComponent(p.id) + '#join">Choose ' + esc(p.name) + '</a>') +
      '</div>'
    ).join('');
    if (onSelect) {
      host.addEventListener('click', (e) => {
        const b = e.target.closest('[data-plan]');
        if (b) onSelect(b.dataset.plan);
      });
    }
  }

  function sponsorBlock(host) {
    const sponsors = C.sponsors || [];
    if (sponsors.length) {
      host.innerHTML = '<div class="sponsor-wall">' + sponsors.map((s) => {
        const inner = (s.logo ? '<img src="' + esc(s.logo) + '" alt="' + esc(s.name) + '" loading="lazy">' : '<b>' + esc(s.name) + '</b>') +
          (s.tier ? '<small>' + esc(s.tier) + '</small>' : '');
        return s.url
          ? '<a class="sponsor" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + inner + '</a>'
          : '<div class="sponsor">' + inner + '</div>';
      }).join('') + '</div>';
    } else {
      const tiers = C.pages.sponsorTiers || [];
      host.innerHTML = '<div class="tiers">' + tiers.map((t) =>
        '<div class="tier"><h3>' + esc(t.name) + '</h3><b>' + esc(t.amount) + '</b><p>' + esc(t.perks) + '</p></div>'
      ).join('') + '</div>';
    }
  }

  /* ----------------------------------------------------------- lightbox */

  function lightbox(items) {
    let el = $('.lightbox');
    if (!el) {
      el = document.createElement('div');
      el.className = 'lightbox';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', 'Photo viewer');
      el.innerHTML =
        '<button class="lightbox__close" type="button" aria-label="Close">×</button>' +
        '<button class="lightbox__prev" type="button" aria-label="Previous photo">‹</button>' +
        '<button class="lightbox__next" type="button" aria-label="Next photo">›</button>' +
        '<figure class="lightbox__figure"><div class="lightbox__img"></div><figcaption></figcaption></figure>';
      document.body.appendChild(el);
    }
    let index = 0;
    let list = items;
    function show(i) {
      index = (i + list.length) % list.length;
      const it = list[index];
      $('.lightbox__img', el).innerHTML = art.media(it.image, it.art, it.id, it.title, { kind: 'bandhani' });
      $('figcaption', el).innerHTML = (it.album ? '<small>' + esc(it.album) + '</small>' : '') + esc(it.title || '');
    }
    function close() {
      el.classList.remove('is-open');
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') show(index + 1);
      if (e.key === 'ArrowLeft') show(index - 1);
    }
    el.onclick = (e) => {
      if (e.target.closest('.lightbox__close') || e.target === el) close();
      else if (e.target.closest('.lightbox__prev')) show(index - 1);
      else if (e.target.closest('.lightbox__next')) show(index + 1);
    };
    return {
      open(i, newList) {
        if (newList) list = newList;
        show(i);
        el.classList.add('is-open');
        $('.lightbox__close', el).focus();
        document.addEventListener('keydown', onKey);
      },
    };
  }

  function galleryTile(it, i) {
    return (
      '<button class="tile" type="button" data-index="' + i + '" aria-label="View ' + esc(it.title || 'photo') + '">' +
      art.media(it.image, it.art, it.id, it.title) +
      '<span class="tile__cap">' + (it.album ? '<small>' + esc(it.album) + '</small>' : '') + esc(it.title || '') + '</span></button>'
    );
  }

  /* -------------------------------------------------------------- forms */

  function formData(form) {
    const out = {};
    new FormData(form).forEach((v, k) => {
      out[k] = typeof v === 'string' ? v.trim() : v;
    });
    return out;
  }

  /** Mark required/invalid fields; returns true when the form is valid. */
  function validate(form) {
    let firstBad = null;
    $$('.field-error', form).forEach((e) => e.remove());
    $$('[required]', form).forEach((input) => {
      let ok = input.type === 'checkbox' ? input.checked
        : input.type === 'radio' ? !!form.querySelector('input[name="' + input.name + '"]:checked')
        : input.value.trim() !== '';
      if (ok && input.type === 'email') ok = util.validEmail(input.value);
      input.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok) {
        const field = input.closest('.field') || input.closest('.check') || input.parentElement;
        if (field && !field.querySelector('.field-error')) {
          const msg = document.createElement('span');
          msg.className = 'field-error';
          msg.textContent = input.type === 'email' && input.value ? 'Please enter a valid email address.'
            : input.type === 'checkbox' ? 'Please tick this box to continue.' : 'This field is required.';
          field.appendChild(msg);
        }
        firstBad = firstBad || input;
      }
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  function paymentInstructions(ref, amount) {
    const s = C.settings;
    return (
      '<ol class="steps">' +
      '<li><span>Send <b>' + util.moneyExact(amount) + '</b> by Interac e-Transfer to <b>' + esc(s.etransferEmail || s.email) + '</b>.</span></li>' +
      '<li><span>Put your reference <b>' + esc(ref) + '</b> in the message field.</span></li>' +
      '<li><span>We will confirm by email once the payment arrives, usually within two days.</span></li>' +
      '</ol>' +
      (s.etransferNote ? '<p class="muted">' + esc(s.etransferNote) + '</p>' : '')
    );
  }

  /* -------------------------------------------------------------- pages */

  const pages = {
    home() {
      const upcoming = EV.upcoming(C);

      const nextHost = $('#next-up');
      const next = upcoming.find((e) => e.featured) || upcoming[0];
      if (nextHost && next) {
        const p = util.dateParts(next.date);
        const price = EV.priceFrom(C, next.id);
        nextHost.innerHTML =
          '<a class="next-up" href="event.html?id=' + encodeURIComponent(next.id) + '">' +
          '<div class="media">' + art.media(next.image, next.art, next.id, next.title, { kind: 'bandhani' }) +
          '<div class="next-up__date"><b>' + p.dd + '</b><span>' + p.mon + ' · ' + p.day + '</span></div></div>' +
          '<div class="next-up__body"><span class="tag tag--red">Next up</span><h2>' + esc(next.title) + '</h2>' +
          '<p class="next-up__meta">' + [util.timeRange(next.startTime, next.endTime), next.venue].filter(Boolean).map(esc).join(' · ') + '</p>' +
          '<div class="next-up__foot"><span>' + (price == null ? 'Free entry' : price === 0 ? 'Free · RSVP' : 'Tickets from ' + util.money(price)) + '</span>' +
          '<span class="arrow-link">' + (price == null ? 'Details' : 'Get tickets') + '</span></div></div></a>';
      } else if (nextHost) {
        nextHost.remove();
      }

      const stats = $('#stats');
      if (stats) {
        const list = C.pages.stats || [];
        stats.innerHTML = list.map((s) => '<div class="stat"><b>' + esc(s.value) + '</b><span>' + esc(s.label) + '</span></div>').join('');
        stats.hidden = !list.length;
      }

      const sched = $('#home-schedule');
      if (sched) {
        sched.innerHTML = upcoming.slice(0, 4).map(scheduleRow).join('') ||
          '<p class="empty">New events are being planned. Subscribe below to hear first.</p>';
      }

      const programs = $('#programs');
      if (programs) {
        programs.innerHTML = (C.pages.programs || []).map((p) =>
          '<li><h3>' + esc(p.title) + (p.gujarati ? '<span class="guj">' + esc(p.gujarati) + '</span>' : '') + '</h3><p>' + esc(p.text) + '</p></li>'
        ).join('');
      }

      const deities = $('#deities');
      if (deities) {
        const list = C.deities || [];
        deities.innerHTML = list.map((d) =>
          '<article class="deity"><div class="media">' + art.media(d.image, 'red', d.id, d.name, { kind: 'mirror', motif: true }) + '</div>' +
          (d.gujaratiName ? '<p class="deity__guj">' + esc(d.gujaratiName) + '</p>' : '') +
          '<h3>' + esc(d.name) + '</h3>' +
          (d.occasion ? '<span class="deity__occasion">' + esc(d.occasion) + '</span>' : '') +
          (d.description ? '<p>' + esc(d.description) + '</p>' : '') + '</article>'
        ).join('');
        if (!list.length) $('#darshan').remove();
      }

      const mosaic = $('#home-gallery');
      if (mosaic) {
        const items = (C.gallery || []).slice(0, 5);
        mosaic.innerHTML = items.map(galleryTile).join('');
        const lb = lightbox(items);
        mosaic.addEventListener('click', (e) => {
          const t = e.target.closest('.tile');
          if (t) lb.open(Number(t.dataset.index));
        });
        if (!items.length) $('#gallery').remove();
      }

      const plans = $('#home-plans');
      if (plans) planCards(plans);

      const sponsors = $('#home-sponsors');
      if (sponsors) {
        sponsorBlock(sponsors);
        const heading = $('#sponsors-title');
        if (heading && C.sponsors.length) heading.textContent = 'Thank you to our sponsors.';
      }
    },

    events() {
      const upcoming = EV.upcoming(C);
      const past = EV.past(C);
      const featured = upcoming.find((e) => e.featured) || upcoming[0];
      const featHost = $('#featured-event');
      if (featured && featHost) {
        const price = EV.priceFrom(C, featured.id);
        featHost.innerHTML =
          '<a class="feature" href="event.html?id=' + encodeURIComponent(featured.id) + '">' +
          '<div class="media">' + art.media(featured.image, featured.art, featured.id, featured.title, { kind: 'bandhani' }) + '</div>' +
          '<div class="feature__body"><span class="tag tag--red">Featured · ' + esc(featured.category || 'Event') + '</span>' +
          '<h2>' + esc(featured.title) + '</h2>' +
          (featured.gujaratiTitle ? '<span class="guj">' + esc(featured.gujaratiTitle) + '</span>' : '') +
          '<p class="muted">' + esc(util.dateLong(featured.date, featured.endDate)) + (featured.startTime ? ' · ' + util.timeRange(featured.startTime, featured.endTime) : '') + '<br>' + esc(featured.venue || '') + '</p>' +
          '<p>' + esc(featured.summary || '') + '</p>' +
          '<span class="btn btn--primary">' + (price == null ? 'Event details' : price === 0 ? 'RSVP free' : 'Tickets from ' + util.money(price)) + '</span>' +
          '</div></a>';
      } else if (featHost) {
        featHost.remove();
      }

      const cats = Array.from(new Set(upcoming.map((e) => e.category).filter(Boolean)));
      const filters = $('#event-filters');
      const list = $('#event-list');
      let current = 'all';
      function draw() {
        const shown = upcoming.filter((e) => current === 'all' || e.category === current);
        list.innerHTML = shown.map(scheduleRow).join('') || '<p class="empty">No upcoming events in this category yet.</p>';
        $('#upcoming-count').textContent = shown.length + (shown.length === 1 ? ' event' : ' events');
      }
      if (filters) {
        filters.innerHTML = ['all'].concat(cats).map((c) =>
          '<button type="button" data-cat="' + esc(c) + '" aria-pressed="' + (c === 'all') + '">' + (c === 'all' ? 'All events' : esc(c)) + '</button>'
        ).join('');
        filters.hidden = cats.length < 2;
        filters.addEventListener('click', (e) => {
          const b = e.target.closest('button');
          if (!b) return;
          current = b.dataset.cat;
          $$('button', filters).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          draw();
        });
      }
      draw();

      const pastHost = $('#past-list');
      if (pastHost) {
        pastHost.innerHTML = past.slice(0, 12).map(scheduleRow).join('');
        if (!past.length) $('#past-events').remove();
      }
    },

    event() {
      const id = util.param('id');
      const ev = (C.events || []).find((e) => e.id === id && e.published !== false);
      const host = $('#event');
      if (!ev) {
        host.innerHTML =
          '<div class="wrap section"><h1>We couldn’t find that event.</h1><p class="mt-1 muted">It may have been moved or removed.</p>' +
          '<a class="btn btn--primary mt-2" href="events.html">See all events</a></div>';
        return;
      }
      document.title = ev.title + ' · ' + C.settings.shortName;
      const past = EV.isPast(ev);
      const tickets = EV.tickets(C, ev.id);
      const mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([ev.venue, ev.address].filter(Boolean).join(', '));

      let box;
      if (past) {
        box =
          '<aside class="ticket-box"><div class="ticket-box__head"><h2>This event has ended</h2><p>Thank you to everyone who joined us.</p></div>' +
          '<div class="ticket-box__foot"><a class="btn btn--primary" href="events.html">See upcoming events</a><a class="btn" href="gallery.html">View photos</a></div></aside>';
      } else if (!tickets.length) {
        box =
          '<aside class="ticket-box"><div class="ticket-box__head"><h2>Free entry</h2><p>No ticket needed. Just come along, and bring family and friends.</p></div>' +
          '<div class="ticket-box__foot"><button class="btn btn--primary" type="button" data-ics>Add to calendar</button><a class="btn" href="contact.html?topic=Events">Ask a question</a></div></aside>';
      } else {
        box =
          '<aside class="ticket-box" id="tickets"><div class="ticket-box__head"><h2>' + (tickets.every((t) => !Number(t.price)) ? 'RSVP' : 'Tickets') + '</h2>' +
          '<p>Pay by Interac e-Transfer after checkout.</p></div>' +
          tickets.map((t) => {
            const opts = util.lines((t.options || '').replace(/,/g, '\n'));
            return (
              '<div class="ticket-line" data-product="' + esc(t.id) + '">' +
              '<div><h3>' + esc(t.name) + '</h3>' + (t.description ? '<p>' + esc(t.description) + '</p>' : '') + '</div>' +
              '<div class="row" style="justify-content:flex-end;gap:14px"><span class="ticket-line__price">' + util.money(t.price) + '</span>' +
              (t.soldOut ? '<span class="sold-out">Sold out</span>' : stepper(0, t.id)) + '</div>' +
              (opts.length && !t.soldOut ? '<select class="select select--small" aria-label="Option for ' + esc(t.name) + '">' + opts.map((o) => '<option>' + esc(o) + '</option>').join('') + '</select>' : '') +
              '</div>'
            );
          }).join('') +
          '<div class="ticket-box__foot"><div class="ticket-total"><span>Total</span><b data-total>$0.00</b></div>' +
          '<button class="btn btn--primary btn--block" type="button" data-add disabled>Add to bag</button>' +
          '<p class="ticket-box__note">Members: member pricing is applied when we confirm your order.</p></div></aside>';
      }

      host.innerHTML =
        '<div class="wrap"><div class="event-hero">' +
        '<div>' +
        '<nav class="breadcrumb" aria-label="Breadcrumb"><a href="events.html">Events</a> / ' + esc(ev.category || 'Event') + '</nav>' +
        '<div class="media">' + art.media(ev.image, ev.art, ev.id, ev.title, { kind: 'bandhani' }) + '</div>' +
        '<div class="mt-3">' +
        (ev.gujaratiTitle ? '<p class="guj-title">' + esc(ev.gujaratiTitle) + '</p>' : '') +
        '<h1>' + esc(ev.title) + '</h1>' +
        '<ul class="facts">' +
        '<li><span>When</span><span>' + esc(util.dateLong(ev.date, ev.endDate)) + '</span></li>' +
        (ev.startTime ? '<li><span>Time</span><span>' + util.timeRange(ev.startTime, ev.endTime) + '</span></li>' : '') +
        (ev.venue || ev.address ? '<li><span>Where</span><span>' + esc(ev.venue || '') + (ev.address ? '<br><a href="' + mapUrl + '" target="_blank" rel="noopener">' + esc(ev.address) + '</a>' : '') + '</span></li>' : '') +
        '</ul>' +
        '<div class="event-body">' + util.paragraphs(ev.description || ev.summary) + '</div>' +
        '<div class="row mt-2">' + (past ? '' : '<button class="btn btn--small" type="button" data-ics>Add to calendar</button>') +
        '<button class="btn btn--small" type="button" data-share>Copy link</button></div>' +
        '</div></div>' + box + '</div></div>';

      $$('[data-ics]', host).forEach((b) => b.addEventListener('click', () => {
        util.download(ev.id + '.ics', EV.ics(ev, C.settings), 'text/calendar');
      }));
      $('[data-share]', host).addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(location.href);
          util.toast('Link copied.');
        } catch (e) {
          util.toast('Copy the link from your address bar.');
        }
      });

      const ticketBox = $('#tickets');
      if (ticketBox) {
        const qty = {};
        const totalEl = $('[data-total]', ticketBox);
        const addBtn = $('[data-add]', ticketBox);
        const refresh = () => {
          const total = tickets.reduce((s, t) => s + (qty[t.id] || 0) * (Number(t.price) || 0), 0);
          const count = Object.values(qty).reduce((a, b) => a + b, 0);
          totalEl.textContent = util.moneyExact(total);
          addBtn.disabled = count === 0;
          addBtn.textContent = count ? 'Add ' + count + ' to bag' : 'Add to bag';
        };
        ticketBox.addEventListener('click', (e) => {
          const step = e.target.closest('[data-step]');
          if (step) {
            const line = step.closest('[data-product]');
            const pid = line.dataset.product;
            qty[pid] = Math.max(0, Math.min(20, (qty[pid] || 0) + (step.dataset.step === '+' ? 1 : -1)));
            $('output', line).textContent = qty[pid];
            $('[data-step="-"]', line).disabled = qty[pid] === 0;
            refresh();
          }
          if (e.target.closest('[data-add]')) {
            Object.entries(qty).forEach(([pid, n]) => {
              if (!n) return;
              const sel = $('[data-product="' + pid + '"] select', ticketBox);
              cart.add(pid, n, sel ? sel.value : '');
              qty[pid] = 0;
            });
            $$('[data-product]', ticketBox).forEach((line) => {
              const o = $('output', line);
              if (o) o.textContent = '0';
              const minus = $('[data-step="-"]', line);
              if (minus) minus.disabled = true;
            });
            refresh();
            bag.open();
          }
        });
      }

      const more = $('#more-events');
      if (more) {
        const others = EV.upcoming(C).filter((e) => e.id !== ev.id).slice(0, 3);
        if (others.length) {
          more.classList.add('section--tight');
          more.innerHTML = '<div class="wrap"><div class="subhead"><h2>More upcoming events</h2><a class="arrow-link" href="events.html">All events</a></div>' +
            '<div class="schedule">' + others.map(scheduleRow).join('') + '</div></div>';
        }
      }
    },

    shop() {
      const upcomingIds = new Set(EV.upcoming(C).map((e) => e.id));
      const all = (C.products || []).filter((p) => p.active !== false);
      const tickets = all.filter((p) => (p.type === 'ticket' || p.type === 'registration') && upcomingIds.has(p.eventId));
      const merch = all.filter((p) => p.type === 'merch');

      const tHost = $('#shop-tickets');
      if (tHost) {
        tHost.innerHTML = tickets.map((t) => {
          const ev = C.events.find((e) => e.id === t.eventId);
          const opts = util.lines((t.options || '').replace(/,/g, '\n'));
          return (
            '<div class="ticket-row" data-product="' + esc(t.id) + '">' +
            '<div><h3>' + esc(t.name) + '</h3>' + (t.description ? '<p>' + esc(t.description) + '</p>' : '') +
            (opts.length ? '<select class="select select--small mt-1" aria-label="Option">' + opts.map((o) => '<option>' + esc(o) + '</option>').join('') + '</select>' : '') + '</div>' +
            '<div class="ticket-row__event">' + (ev ? '<a href="event.html?id=' + encodeURIComponent(ev.id) + '">' + esc(ev.title) + '</a><br>' + util.dateShort(ev.date) : '') + '</div>' +
            '<div class="ticket-row__price">' + util.money(t.price) + '</div>' +
            (t.soldOut ? '<span class="sold-out">Sold out</span>' : '<button class="btn btn--small" type="button" data-add>Add</button>') +
            '</div>'
          );
        }).join('') || '<p class="empty">No tickets on sale right now.</p>';
      }

      const mHost = $('#shop-merch');
      if (mHost) {
        mHost.innerHTML = merch.map((p) => {
          const opts = util.lines((p.options || '').replace(/,/g, '\n'));
          return (
            '<article class="product" data-product="' + esc(p.id) + '">' +
            '<div class="media">' + art.media(p.image, '', p.id, p.name) + '</div>' +
            '<div class="product__body"><div class="product__row"><h3>' + esc(p.name) + '</h3><span class="product__price">' + util.money(p.price) + '</span></div>' +
            (p.description ? '<p>' + esc(p.description) + '</p>' : '') +
            '<div class="product__buy">' +
            (opts.length ? '<select class="select select--small" aria-label="Choose option for ' + esc(p.name) + '">' + opts.map((o) => '<option>' + esc(o) + '</option>').join('') + '</select>' : '') +
            (p.soldOut ? '<span class="sold-out">Sold out</span>' : '<button class="btn btn--small" type="button" data-add>Add to bag</button>') +
            '</div></div></article>'
          );
        }).join('') || '<p class="empty">Merchandise coming soon.</p>';
        if (!merch.length) $('#merch').remove();
      }

      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-add]');
        if (!btn) return;
        const line = btn.closest('[data-product]');
        if (!line) return;
        const sel = $('select', line);
        cart.add(line.dataset.product, 1, sel ? sel.value : '');
        bag.open();
      });
    },

    checkout() {
      const host = $('#checkout');
      const lines = cart.lines(C);
      if (!lines.length) {
        host.innerHTML = '<div class="panel center"><h2>Your bag is empty</h2><p class="mt-1">Find an event or something from the shop to get started.</p>' +
          '<div class="row mt-2" style="justify-content:center"><a class="btn btn--primary" href="events.html">Browse events</a><a class="btn" href="shop.html">Visit the shop</a></div></div>';
        return;
      }
      const total = cart.total(C);
      const free = total === 0;
      host.innerHTML =
        '<div class="two-col">' +
        '<form class="panel stack" id="checkout-form" novalidate>' +
        '<div><h2>Your details</h2><p class="muted">We use these to send your confirmation and check you in at the door.</p></div>' +
        '<div class="form-grid">' +
        '<div class="field"><label for="co-name">Full name</label><input class="input" id="co-name" name="name" autocomplete="name" required></div>' +
        '<div class="field"><label for="co-phone">Phone</label><input class="input" id="co-phone" name="phone" type="tel" autocomplete="tel"></div>' +
        '<div class="field span-2"><label for="co-email">Email</label><input class="input" id="co-email" name="email" type="email" autocomplete="email" required></div>' +
        '<div class="field span-2"><label for="co-member">Membership</label><select class="select" id="co-member" name="member"><option value="no">I’m not a member</option><option value="yes">I’m a current GCA member</option></select><small>Members get member pricing; we adjust the amount when confirming.</small></div>' +
        '</div>' +
        (free ? '' :
          '<fieldset class="field" style="border:0;padding:0;margin:0"><legend class="label" style="margin-bottom:10px">Payment</legend><div class="choice-group">' +
          '<label class="choice"><input type="radio" name="payment" value="etransfer" checked><span><b>Interac e-Transfer</b><small>Instructions on the next screen.</small></span></label>' +
          '<label class="choice"><input type="radio" name="payment" value="door"><span><b>Pay at the event</b><small>Cash or debit at check-in. Your spot is held until the event.</small></span></label>' +
          '</div></fieldset>') +
        '<div class="field"><label for="co-notes">Notes <span class="muted">(optional)</span></label><textarea class="textarea" id="co-notes" name="notes" rows="3" style="min-height:96px" placeholder="Dietary needs, accessibility, names on tickets…"></textarea></div>' +
        '<label class="check"><input type="checkbox" name="consent" required><span>I agree that GCA may contact me about this order.</span></label>' +
        '<button class="btn btn--primary btn--block" type="submit">' + (free ? 'Confirm RSVP' : 'Place order · ' + util.moneyExact(total)) + '</button>' +
        '</form>' +
        '<aside class="panel"><h2>Order summary</h2><ul class="summary mt-1">' +
        lines.map((l) => {
          const ev = l.product.eventId ? C.events.find((e) => e.id === l.product.eventId) : null;
          return '<li><span><b>' + esc(l.product.name) + '</b> × ' + l.qty +
            (ev ? '<small>' + esc(ev.title) + ', ' + util.dateShort(ev.date) + '</small>' : '') +
            (l.option ? '<small>' + esc(l.option) + '</small>' : '') + '</span><span>' + util.moneyExact(l.total) + '</span></li>';
        }).join('') +
        '</ul><div class="summary__total"><span>Total (CAD)</span><b>' + util.moneyExact(total) + '</b></div>' +
        '<p class="muted mt-2" style="font-size:14px">Tickets are non-refundable but transferable. Contact us if your plans change.</p></aside>' +
        '</div>';

      $('#checkout-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (!validate(form)) return;
        const f = formData(form);
        const btn = $('button[type=submit]', form);
        btn.disabled = true;
        const ref = util.reference('GCA');
        const payment = free ? 'none' : f.payment || 'etransfer';
        const order = {
          ref,
          name: f.name,
          email: f.email.toLowerCase(),
          phone: f.phone || '',
          member: f.member === 'yes',
          notes: f.notes || '',
          payment,
          status: free ? 'confirmed' : payment === 'door' ? 'reserved' : 'awaiting',
          total,
          items: lines.map((l) => ({
            productId: l.product.id, name: l.product.name, option: l.option, qty: l.qty,
            price: Number(l.product.price) || 0, eventId: l.product.eventId || '', type: l.product.type,
          })),
        };
        try {
          await data.add('orders', order);
        } catch (err) {
          btn.disabled = false;
          util.toast('Something went wrong saving your order. Please try again.', 'error');
          return;
        }
        cart.clear();
        window.scrollTo({ top: 0 });
        const done = free
          ? '<p>Your RSVP is confirmed. We look forward to seeing you!</p>'
          : payment === 'door'
            ? '<p>Your spot is held. Please pay ' + util.moneyExact(total) + ' by cash or debit at check-in and give your name or reference.</p>'
            : paymentInstructions(ref, total);
        host.innerHTML =
          '<div class="panel confirm" style="max-width:720px">' +
          '<span class="tag tag--red">' + (free ? 'RSVP confirmed' : 'Order received') + '</span>' +
          '<h2 class="mt-1" style="font-size:36px">Thank you, ' + esc(f.name.split(' ')[0]) + '.</h2>' +
          '<p class="mt-1">Your reference number:</p><span class="confirm__ref">' + esc(ref) + '</span>' + done +
          '<div class="row mt-2"><a class="btn btn--primary" href="events.html">Back to events</a><button class="btn" type="button" onclick="window.print()">Print this page</button></div></div>';
      });
    },

    membership() {
      const plansHost = $('#membership-plans');
      const form = $('#membership-form');
      const select = (id) => {
        const input = form && form.querySelector('input[name="plan"][value="' + CSS.escape(id) + '"]');
        if (input) {
          input.checked = true;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        $('#join').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      if (plansHost) planCards(plansHost, select);
      if (!form) return;

      $('#plan-choices').innerHTML = (C.plans || []).map((p, i) =>
        '<label class="choice"><input type="radio" name="plan" value="' + esc(p.id) + '"' + (i === 0 ? ' required' : '') + (p.featured ? ' checked' : '') + '>' +
        '<span><b>' + esc(p.name) + '</b><small>' + esc(p.audience) + '</small></span><span class="choice__price">' + util.money(p.price) + '</span></label>'
      ).join('');
      const wanted = util.param('plan');
      if (wanted) {
        const input = form.querySelector('input[name="plan"][value="' + CSS.escape(wanted) + '"]');
        if (input) input.checked = true;
      }
      const household = $('#household-field');
      const syncHousehold = () => {
        const chosen = form.querySelector('input[name="plan"]:checked');
        const plan = chosen && C.plans.find((p) => p.id === chosen.value);
        household.hidden = !(plan && /family|household/i.test(plan.name + ' ' + plan.audience));
      };
      form.addEventListener('change', (e) => {
        if (e.target.name === 'plan') syncHousehold();
      });
      syncHousehold();

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validate(form)) return;
        const f = formData(form);
        const plan = C.plans.find((p) => p.id === f.plan);
        const ref = util.reference('MEM');
        const record = {
          ref,
          planId: plan ? plan.id : f.plan,
          plan: plan ? plan.name : f.plan,
          amount: plan ? Number(plan.price) || 0 : 0,
          name: (f.firstName + ' ' + f.lastName).trim(),
          firstName: f.firstName,
          lastName: f.lastName,
          email: f.email.toLowerCase(),
          phone: f.phone || '',
          city: f.city || '',
          household: household.hidden ? '' : f.household || '',
          heard: f.heard || '',
          volunteer: !!f.volunteer,
          newsletter: !!f.newsletter,
          status: 'pending',
        };
        $('button[type=submit]', form).disabled = true;
        await data.add('members', record);
        if (record.newsletter) {
          const subs = await data.list('subscribers');
          if (!subs.some((s) => s.email === record.email)) await data.add('subscribers', { email: record.email, source: 'membership' });
        }
        const panel = form.closest('.panel') || form;
        panel.innerHTML =
          '<div class="confirm"><span class="tag tag--red">Application received</span>' +
          '<h2 class="mt-1" style="font-size:34px">Welcome to the family, ' + esc(f.firstName) + '.</h2>' +
          '<p class="mt-1">Your ' + esc(record.plan) + ' membership is reserved. Reference:</p><span class="confirm__ref">' + esc(ref) + '</span>' +
          (record.amount ? paymentInstructions(ref, record.amount) : '<p>We will confirm your membership by email.</p>') + '</div>';
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },

    about() {
      const programs = $('#about-programs');
      if (programs) {
        programs.innerHTML = (C.pages.programs || []).map((p) =>
          '<li><h3>' + esc(p.title) + (p.gujarati ? '<span class="guj">' + esc(p.gujarati) + '</span>' : '') + '</h3><p>' + esc(p.text) + '</p></li>'
        ).join('');
      }
      const people = $('#committee');
      if (people) {
        const list = C.committee || [];
        people.innerHTML = list.map((m) =>
          '<article class="person"><div class="media">' + art.media(m.photo, 'indigo', m.id, m.name, { kind: 'patola' }) + '</div>' +
          '<h3>' + esc(m.name) + '</h3><span class="tag tag--red">' + esc(m.role || '') + '</span>' +
          (m.bio ? '<p>' + esc(m.bio) + '</p>' : '') +
          (m.email ? '<p><a href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a></p>' : '') + '</article>'
        ).join('');
        if (!list.length) $('#committee-section').remove();
      }
      const sponsors = $('#about-sponsors');
      if (sponsors) {
        const tiers = C.pages.sponsorTiers || [];
        sponsors.innerHTML = '<div class="tiers">' + tiers.map((t) =>
          '<div class="tier"><h3>' + esc(t.name) + '</h3><b>' + esc(t.amount) + '</b><p>' + esc(t.perks) + '</p></div>'
        ).join('') + '</div>';
      }
      const wall = $('#about-sponsor-wall');
      if (wall) {
        if (C.sponsors.length) sponsorBlock(wall);
        else wall.remove();
      }
    },

    gallery() {
      const items = C.gallery || [];
      const albums = Array.from(new Set(items.map((i) => i.album).filter(Boolean)));
      const filters = $('#gallery-filters');
      const grid = $('#gallery-grid');
      let shown = items;
      const lb = lightbox(items);
      function draw(album) {
        shown = album === 'all' ? items : items.filter((i) => i.album === album);
        grid.innerHTML = shown.map(galleryTile).join('') || '<p class="empty">Photos coming soon.</p>';
      }
      filters.innerHTML = ['all'].concat(albums).map((a) =>
        '<button type="button" data-album="' + esc(a) + '" aria-pressed="' + (a === 'all') + '">' + (a === 'all' ? 'All photos' : esc(a)) + '</button>'
      ).join('');
      filters.hidden = albums.length < 2;
      filters.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        $$('button', filters).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        draw(b.dataset.album);
      });
      grid.addEventListener('click', (e) => {
        const t = e.target.closest('.tile');
        if (t) lb.open(Number(t.dataset.index), shown);
      });
      draw('all');
    },

    contact() {
      const s = C.settings;
      const info = $('#contact-info');
      if (info) {
        const rows = [];
        if (s.email) rows.push(['Email', '<a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a>']);
        if (s.phone) rows.push(['Phone', '<a href="tel:' + esc(s.phone.replace(/[^\d+]/g, '')) + '">' + esc(s.phone) + '</a>']);
        if (s.address) rows.push(['Where we are', esc(s.address)]);
        [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['youtube', 'YouTube'], ['whatsapp', 'WhatsApp']].forEach(([k, label]) => {
          if (s[k]) rows.push([label, '<a href="' + esc(s[k]) + '" target="_blank" rel="noopener">' + esc(s[k].replace(/^https?:\/\/(www\.)?/, '')) + '</a>']);
        });
        rows.push(['Sponsorship', 'Interested in supporting an event? <a href="about.html#sponsor">See sponsorship tiers</a>.']);
        info.innerHTML = rows.map(([k, v]) => '<li><span class="tag">' + k + '</span>' + v + '</li>').join('');
      }

      const form = $('#contact-form');
      if (!form) return;
      const topic = util.param('topic');
      if (topic) {
        const sel = form.elements.topic;
        if (Array.from(sel.options).some((o) => o.value === topic)) sel.value = topic;
      }
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validate(form)) return;
        const f = formData(form);
        $('button[type=submit]', form).disabled = true;
        await data.add('messages', {
          name: f.name, email: f.email.toLowerCase(), phone: f.phone || '', topic: f.topic, message: f.message, read: false,
        });
        const panel = form.closest('.panel');
        panel.innerHTML = '<div class="confirm"><span class="tag tag--red">Message sent</span><h2 class="mt-1" style="font-size:34px">Thank you, ' +
          esc(f.name.split(' ')[0]) + '.</h2><p class="mt-1">A committee member will reply to <b>' + esc(f.email) + '</b> within a few days.</p>' +
          '<a class="btn mt-2" href="index.html">Back to home</a></div>';
      });
    },
  };

  /* --------------------------------------------------------------- boot */

  async function init() {
    try {
      await data.load();
    } catch (e) {
      data.content = data.normalize(window.GCA_PUBLISHED);
    }
    C = data.content;
    renderHeader();
    renderFooter();
    applyBindings();
    bag = setupBag();
    // Clear a field's error as soon as the visitor fixes it.
    const clearError = (e) => {
      const input = e.target;
      if (input.getAttribute('aria-invalid') !== 'true') return;
      const ok = input.type === 'checkbox' ? input.checked
        : input.type === 'email' ? util.validEmail(input.value) : input.value.trim() !== '';
      if (!ok) return;
      input.setAttribute('aria-invalid', 'false');
      const field = input.closest('.field') || input.closest('.check') || input.parentElement;
      const msg = field && field.querySelector('.field-error');
      if (msg) msg.remove();
    };
    document.addEventListener('input', clearError);
    document.addEventListener('change', clearError);
    const page = document.body.dataset.page;
    if (pages[page]) pages[page]();
    document.documentElement.classList.add('is-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
