/* ==========================================================================
   Finca San Adolfo — shared storefront script
   Vanilla JS, no build step, no dependencies.

   Motion follows the CAFEONE design system: one easing curve
   (cubic-bezier(.22,.61,.36,1)), 120/220/360/420ms durations, no bounce,
   no spring. Scroll-linked effects are additive to the DS and are removed
   entirely under prefers-reduced-motion.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- icons
     Lucide 0.454 geometry at stroke-width 1.6, per the design system's
     ICONOGRAPHY note. Inlined so the site works offline.
     ---------------------------------------------------------------------- */
  var ICONS = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    notePlus: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/>',
    percent: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m15 9-6 6"/><path d="M9 9h.01"/><path d="M15 15h.01"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    xSocial: '<path d="M4 4l7.6 9.9L4.4 20"/><path d="M20 20l-7.6-9.9L19.6 4"/>',
    pinterest: '<path d="M8 20c1.2-3.4 2.2-7 2.2-7"/><path d="M9.6 12.4c-.4-.8-.5-2 0-3 .8-1.8 3-2.6 4.8-1.8 2 .9 2.5 3.4 1.4 5.4-.9 1.6-2.8 2.2-4 1.2"/><circle cx="12" cy="12" r="10"/>',
    instagram: '<rect width="20" height="20" x="2" y="2" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37"/><path d="M17.5 6.5h.01"/>',
    whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-4-1L3 21l2-5.5a8.38 8.38 0 0 1-1-4 8.38 8.38 0 0 1 8.5-8.5A8.38 8.38 0 0 1 21 11.5"/><path d="M8.5 9.5c0 3 2.5 5.5 5.5 5.5"/>'
  };

  function icon(name, size) {
    return '<svg class="i" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="' +
      (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      (ICONS[name] || '') + '</svg>';
  }

  function paintIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
      if (el.dataset.painted) return;
      el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon, +el.dataset.iconSize || 22));
      el.dataset.painted = '1';
    });
  }

  /* --------------------------------------------------------------- product
     ONE coffee, two option axes. Price depends on size only.
     ---------------------------------------------------------------------- */
  var PRODUCT = {
    name: 'Café Finca San Adolfo',
    grinds: ['Molido', 'En grano'],
    sizes: ['250 g', '500 g'],
    price: { '250 g': 38000, '500 g': 68000 },
    /* REPLACE: un mockup de bolsa por presentación (4 en total).
       Por ahora las cuatro usan el único packshot real del design system. */
    image: {
      'Molido|250 g': 'assets/img/product-bag-card.jpg',
      'Molido|500 g': 'assets/img/product-bag-card.jpg',
      'En grano|250 g': 'assets/img/product-bag-card.jpg',
      'En grano|500 g': 'assets/img/product-bag-card.jpg'
    },
    /* Cart + sticky-bar thumbnail. Same packshot as the product images so the
       cart never shows a different bag than the one being bought. */
    thumb: {
      '250 g': 'assets/img/product-bag-card.jpg',
      '500 g': 'assets/img/product-bag-card.jpg'
    }
  };

  var FREE_SHIPPING = 120000;

  function variants() {
    var out = [];
    PRODUCT.grinds.forEach(function (g) {
      PRODUCT.sizes.forEach(function (s) {
        out.push({ grind: g, size: s, key: g + '|' + s });
      });
    });
    return out;
  }

  function money(n) {
    return '$' + Math.round(n).toLocaleString('es-CO');
  }
  function moneyFull(n) {
    return money(n) + ' COP';
  }

  /* ------------------------------------------------------------------ cart
     In-memory, mirrored to localStorage when the environment allows it.
     ---------------------------------------------------------------------- */
  var STORE_KEY = 'fsa-cart-v1';
  var cart = [];
  var note = '';
  var discount = '';

  function loadCart() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (raw) cart = JSON.parse(raw) || [];
    } catch (e) { /* file:// or private mode — stay in memory */ }
  }
  function saveCart() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(cart)); } catch (e) {}
  }

  function cartCount() {
    return cart.reduce(function (n, l) { return n + l.qty; }, 0);
  }
  function cartTotal() {
    return cart.reduce(function (n, l) { return n + l.qty * PRODUCT.price[l.size]; }, 0);
  }

  function addToCart(grind, size, qty) {
    var key = grind + '|' + size;
    var line = cart.filter(function (l) { return l.key === key; })[0];
    if (line) line.qty += (qty || 1);
    else cart.push({ key: key, grind: grind, size: size, qty: qty || 1 });
    saveCart();
    renderCart();
    openDrawer();
    toast(PRODUCT.name + ' · ' + grind + ' ' + size + ' agregado al carrito');
  }

  function setQty(key, qty) {
    cart = cart.reduce(function (acc, l) {
      if (l.key === key) { if (qty > 0) { l.qty = qty; acc.push(l); } }
      else acc.push(l);
      return acc;
    }, []);
    saveCart();
    renderCart();
  }

  /* ----------------------------------------------------------------- toast */
  var toastEl;
  var toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = icon('check', 18) + '<span></span>';
    toastEl.querySelector('span').textContent = msg;
    toastEl.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-open'); }, 3200);
  }

  /* -------------------------------------------------------------- reveal */
  function initReveal() {
    var targets = document.querySelectorAll('[data-reveal],[data-reveal-group]');
    if (reduced || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* -------------------------------------------------------------- scrub
     Minimal scroll-progress engine: register a node + a callback receiving
     0..1 progress as it crosses the viewport. rAF-throttled.
     ---------------------------------------------------------------------- */
  var scrubs = [];
  function scrub(el, fn) { if (el && !reduced) scrubs.push({ el: el, fn: fn }); }
  var ticking = false;
  function runScrubs() {
    var vh = window.innerHeight;
    for (var i = 0; i < scrubs.length; i++) {
      var r = scrubs[i].el.getBoundingClientRect();
      var span = r.height + vh;
      if (span <= 0) continue;
      var p = (vh - r.top) / span;
      scrubs[i].fn(Math.max(0, Math.min(1, p)));
    }
    ticking = false;
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(runScrubs); }
  }

  /* -------------------------------------------- smooth scrolling (inertia)
     Light Lenis-style damping on wheel input. Falls back to native smooth
     scrolling on touch, and is skipped entirely for reduced motion.
     ---------------------------------------------------------------------- */
  function initSmoothScroll() {
    if (reduced) return;
    if (matchMedia('(pointer: coarse)').matches) {
      document.documentElement.style.scrollBehavior = 'smooth';
      return;
    }
    var target = window.scrollY;
    var current = window.scrollY;
    var running = false;

    function max() {
      return document.documentElement.scrollHeight - window.innerHeight;
    }
    function loop() {
      current += (target - current) * 0.12;
      if (Math.abs(target - current) < 0.4) { current = target; running = false; }
      window.scrollTo(0, current);
      if (running) requestAnimationFrame(loop);
    }
    window.addEventListener('wheel', function (e) {
      if (document.body.classList.contains('is-locked')) return;
      if (e.ctrlKey) return;
      e.preventDefault();
      target = Math.max(0, Math.min(max(), target + e.deltaY));
      if (!running) { running = true; current = window.scrollY; requestAnimationFrame(loop); }
    }, { passive: false });

    window.addEventListener('scroll', function () {
      if (!running) { target = window.scrollY; current = window.scrollY; }
    }, { passive: true });
  }

  function scrollToY(y) {
    if (reduced) { window.scrollTo(0, y); return; }
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------ hero video
     Muted + playsinline autoplay is allowed everywhere, but iOS Low Power
     Mode, data saver and tab throttling still pause it. Nudge it back.
     ---------------------------------------------------------------------- */
  function initHeroVideo() {
    var v = document.querySelector('.hero-media video');
    if (!v) return;

    /* Reduced motion: hold the first frame rather than loop. */
    if (reduced) {
      v.removeAttribute('autoplay');
      v.removeAttribute('loop');
      v.pause();
      return;
    }

    var nudge = function () {
      if (!v.paused || v.ended) return;
      var p = v.play();
      if (p && p.catch) p.catch(function () { /* blocked — the poster stands in */ });
    };
    nudge();
    v.addEventListener('loadeddata', nudge);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) nudge();
    });
  }

  /* ----------------------------------------------------------------- header */
  function initHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var opaque = header.classList.contains('is-opaque');

    if (!opaque) {
      var solid = function () {
        header.classList.toggle('is-solid', window.scrollY > 80);
      };
      solid();
      window.addEventListener('scroll', solid, { passive: true });
    }

    /* Mega menu */
    document.querySelectorAll('[data-menu]').forEach(function (trigger) {
      var item = trigger.closest('.nav-item');
      var panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!panel) return;
      var close = function () {
        item.classList.remove('is-open');
        panel.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        header.classList.remove('menu-open');
      };
      var open = function () {
        item.classList.add('is-open');
        panel.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        header.classList.add('menu-open');
      };
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        panel.classList.contains('is-open') ? close() : open();
      });
      header.addEventListener('mouseleave', close);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
      });
      panel.addEventListener('click', function (e) {
        if (e.target.closest('a')) close();
      });
    });

    /* Inline search */
    var searchBtn = document.querySelector('[data-search-toggle]');
    var searchField = document.querySelector('.search-field');
    if (searchBtn && searchField) {
      searchBtn.addEventListener('click', function () {
        var open = searchField.classList.toggle('is-open');
        searchBtn.setAttribute('aria-expanded', String(open));
        if (open) searchField.querySelector('input').focus();
      });
      searchField.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        toast('Demo — la búsqueda no está conectada');
      });
    }

    /* Mobile drawer */
    var burger = document.querySelector('[data-mobile-open]');
    var mnav = document.getElementById('mobile-nav');
    if (burger && mnav) {
      var closeM = function () {
        mnav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('is-locked');
      };
      burger.addEventListener('click', function () {
        mnav.classList.add('is-open');
        burger.setAttribute('aria-expanded', 'true');
        document.body.classList.add('is-locked');
        mnav.querySelector('[data-mobile-close]').focus();
      });
      mnav.querySelector('[data-mobile-close]').addEventListener('click', closeM);
      mnav.addEventListener('click', function (e) { if (e.target.closest('a')) closeM(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && mnav.classList.contains('is-open')) closeM();
      });
    }
  }

  /* --------------------------------------------------------------- to top */
  function initToTop() {
    var btn = document.querySelector('.to-top');
    if (!btn) return;
    var check = function () {
      btn.classList.toggle('is-visible', window.scrollY > window.innerHeight);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    btn.addEventListener('click', function () { scrollToY(0); });
  }

  /* --------------------------------------------------------- cart drawer */
  var drawerEl, scrimEl;

  function openDrawer() {
    if (!drawerEl) return;
    drawerEl.classList.add('is-open');
    scrimEl.classList.add('is-open');
    document.body.classList.add('is-locked', 'drawer-open');
    drawerEl.setAttribute('aria-hidden', 'false');
    var close = drawerEl.querySelector('[data-drawer-close]');
    if (close) close.focus();
  }
  function closeDrawer() {
    if (!drawerEl) return;
    drawerEl.classList.remove('is-open');
    scrimEl.classList.remove('is-open');
    document.body.classList.remove('is-locked', 'drawer-open');
    drawerEl.setAttribute('aria-hidden', 'true');
  }

  function renderCart() {
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = cartCount();
      el.hidden = cartCount() === 0;
    });
    if (!drawerEl) return;

    var body = drawerEl.querySelector('[data-lines]');
    var total = cartTotal();
    var remaining = Math.max(0, FREE_SHIPPING - total);

    /* Free-shipping progress */
    var msg = drawerEl.querySelector('[data-ship-msg]');
    var bar = drawerEl.querySelector('[data-ship-bar]');
    msg.textContent = remaining > 0
      ? 'Te faltan ' + money(remaining) + ' para envío gratis'
      : 'Tienes envío gratis';
    bar.style.width = (remaining > 0 ? Math.max(4, (total / FREE_SHIPPING) * 100) : 100) + '%';

    if (!cart.length) {
      body.innerHTML =
        '<div class="cart-empty"><p>Tu carrito está vacío.</p>' +
        '<a class="btn btn--primary btn--md" href="producto.html">Ver nuestro café</a></div>';
    } else {
      body.innerHTML = cart.map(function (l) {
        return '' +
          '<article class="line">' +
            '<div class="line-thumb"><img src="' + PRODUCT.thumb[l.size] + '" alt="" loading="lazy" width="755" height="1002"></div>' +
            '<div>' +
              '<h3>' + PRODUCT.name + '</h3>' +
              '<p class="variant-line">' + l.grind + ' · ' + l.size + '</p>' +
              '<p class="unit">' + money(PRODUCT.price[l.size]) + '</p>' +
              '<div class="qty">' +
                '<button type="button" data-qty="-1" data-key="' + l.key + '" aria-label="Quitar una unidad">' + icon('minus', 16) + '</button>' +
                '<span>' + l.qty + '</span>' +
                '<button type="button" data-qty="1" data-key="' + l.key + '" aria-label="Agregar una unidad">' + icon('plus', 16) + '</button>' +
              '</div>' +
            '</div>' +
            '<button type="button" class="line-remove" data-remove="' + l.key + '" aria-label="Eliminar ' + l.grind + ' ' + l.size + '">' + icon('trash', 20) + '</button>' +
          '</article>';
      }).join('');
    }

    drawerEl.querySelector('[data-total]').textContent = moneyFull(total);
  }

  function initDrawer() {
    drawerEl = document.querySelector('.drawer');
    scrimEl = document.querySelector('.scrim');
    if (!drawerEl) return;

    document.querySelectorAll('[data-cart-open]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); openDrawer(); });
    });
    drawerEl.querySelector('[data-drawer-close]').addEventListener('click', closeDrawer);
    scrimEl.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawerEl.classList.contains('is-open')) closeDrawer();
    });

    /* Keep focus inside the drawer while it is open */
    drawerEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = drawerEl.querySelectorAll('button,a[href],input,textarea,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    drawerEl.addEventListener('click', function (e) {
      var q = e.target.closest('[data-qty]');
      if (q) {
        var line = cart.filter(function (l) { return l.key === q.dataset.key; })[0];
        if (line) setQty(line.key, line.qty + (+q.dataset.qty));
        return;
      }
      var rm = e.target.closest('[data-remove]');
      if (rm) { setQty(rm.dataset.remove, 0); return; }
    });

    /* Nota / Descuento toggles */
    drawerEl.querySelectorAll('[data-util]').forEach(function (btn) {
      var panel = drawerEl.querySelector('#' + btn.dataset.util);
      btn.addEventListener('click', function () {
        var open = panel.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(open));
        if (open) panel.querySelector('input,textarea').focus();
      });
    });
    var noteField = drawerEl.querySelector('#util-note textarea');
    if (noteField) noteField.addEventListener('input', function () { note = this.value; });
    var discField = drawerEl.querySelector('#util-discount input');
    if (discField) discField.addEventListener('input', function () { discount = this.value; });

    drawerEl.querySelector('[data-checkout]').addEventListener('click', function () {
      toast('Demo — checkout no conectado');
    });
    drawerEl.querySelector('[data-viewcart]').addEventListener('click', function (e) {
      e.preventDefault();
      toast('Demo — la página de carrito no está conectada');
    });
  }

  /* ------------------------------------------------------------ newsletter */
  function initNewsletter() {
    var nl = document.querySelector('.newsletter');
    if (!nl) return;
    nl.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      if (!this.checkValidity()) return;
      nl.classList.add('is-done');
      nl.querySelector('.nl-done .tick').innerHTML = icon('check', 16);
    });
  }

  /* ------------------------------------------------------------------ api */
  window.FSA = {
    icon: icon,
    paintIcons: paintIcons,
    PRODUCT: PRODUCT,
    variants: variants,
    money: money,
    moneyFull: moneyFull,
    addToCart: addToCart,
    toast: toast,
    scrub: scrub,
    reduced: reduced,
    scrollToY: scrollToY,
    openDrawer: openDrawer,
    onReady: []
  };

  /* ----------------------------------------------------------------- boot */
  document.addEventListener('DOMContentLoaded', function () {
    paintIcons();
    loadCart();
    initSmoothScroll();
    initHeroVideo();
    initHeader();
    initToTop();
    initDrawer();
    initNewsletter();
    renderCart();
    initReveal();

    window.FSA.onReady.forEach(function (fn) { fn(); });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  });
})();
