/* ==========================================================================
   Finca San Adolfo — product detail page
   One coffee, two option axes. Depends on assets/js/app.js (window.FSA).
   ========================================================================== */
(function () {
  'use strict';

  window.FSA.onReady.push(function () {
    var FSA = window.FSA;
    var P = FSA.PRODUCT;
    var VARIANTS = FSA.variants();

    /* Slides = the four presentations + one lifestyle photo. */
    var SLIDES = VARIANTS.map(function (v) {
      return {
        src: P.image[v.key],
        alt: 'Bolsa de café ' + v.grind.toLowerCase() + ' de ' + v.size,
        key: v.key
      };
    }).concat([{
      /* REPLACE: foto de estilo de vida — la taza servida en la finca */
      src: 'assets/img/farm-cherry-cluster.png',
      alt: 'Cerezas de café recién recogidas en la finca',
      key: null
    }]);

    /* ------------------------------------------------- state from the URL */
    var params = new URLSearchParams(location.search);
    var pParam = (params.get('p') || '').toLowerCase();
    var tParam = (params.get('t') || '').replace(/\D/g, '');

    var state = {
      grind: pParam.indexOf('gran') === 0 || pParam === 'en grano' ? 'En grano' : 'Molido',
      size: tParam === '500' ? '500 g' : '250 g',
      qty: 1
    };

    /* ------------------------------------------------------------ gallery */
    var stage = document.querySelector('[data-gallery]');
    var dots = document.querySelector('[data-dots]');
    var slideIndex = 0;

    stage.innerHTML = SLIDES.map(function (s, i) {
      return '<img src="' + s.src + '" alt="' + s.alt + '"' +
             (i === 0 ? ' class="is-active"' : ' loading="lazy"') +
             ' width="755" height="1002">';
    }).join('');

    dots.innerHTML = SLIDES.map(function (s, i) {
      return '<button type="button" role="tab" data-dot="' + i + '"' +
             ' aria-current="' + (i === 0) + '"' +
             ' aria-label="Imagen ' + (i + 1) + ' de ' + SLIDES.length + '"></button>';
    }).join('');

    var slideEls = stage.querySelectorAll('img');
    var dotEls = dots.querySelectorAll('button');

    function goSlide(i) {
      slideIndex = (i + SLIDES.length) % SLIDES.length;
      slideEls.forEach(function (el, n) { el.classList.toggle('is-active', n === slideIndex); });
      dotEls.forEach(function (el, n) { el.setAttribute('aria-current', String(n === slideIndex)); });
    }

    document.querySelector('[data-g-prev]').addEventListener('click', function () { goSlide(slideIndex - 1); });
    document.querySelector('[data-g-next]').addEventListener('click', function () { goSlide(slideIndex + 1); });
    dots.addEventListener('click', function (e) {
      var d = e.target.closest('[data-dot]');
      if (d) goSlide(+d.dataset.dot);
    });

    /* Keyboard + swipe */
    document.querySelector('.gallery').addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goSlide(slideIndex - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goSlide(slideIndex + 1); }
    });
    var sx = null;
    stage.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) goSlide(slideIndex + (dx < 0 ? 1 : -1));
      sx = null;
    }, { passive: true });

    /* ----------------------------------------------------------- buy box */
    var priceEl = document.querySelector('[data-price]');
    var qtyEl = document.querySelector('[data-qty]');
    var sbVar = document.querySelector('[data-sb-var]');
    var sbPrice = document.querySelector('[data-sb-price]');
    var sbImg = document.querySelector('[data-sb-img]');

    function sync(animate) {
      document.querySelectorAll('[data-opts]').forEach(function (group) {
        var axis = group.dataset.opts;
        group.querySelectorAll('.opt').forEach(function (b) {
          b.setAttribute('aria-pressed', String(b.dataset.value === state[axis]));
        });
      });

      var next = FSA.money(P.price[state.size]);
      if (animate && priceEl.textContent !== next) {
        priceEl.classList.remove('is-swapping');
        void priceEl.offsetWidth;
        priceEl.classList.add('is-swapping');
        setTimeout(function () { priceEl.textContent = next; }, 130);
      } else {
        priceEl.textContent = next;
      }

      qtyEl.textContent = state.qty;
      sbVar.textContent = state.grind + ' · ' + state.size;
      sbPrice.textContent = next;
      sbImg.src = P.thumb[state.size];

      var key = state.grind + '|' + state.size;
      stage.dataset.grind = state.grind;
      var i = SLIDES.findIndex(function (s) { return s.key === key; });
      if (i > -1) goSlide(i);
    }

    document.querySelectorAll('[data-opts]').forEach(function (group) {
      group.addEventListener('click', function (e) {
        var b = e.target.closest('.opt');
        if (!b) return;
        state[group.dataset.opts] = b.dataset.value;
        sync(true);
      });
    });

    document.querySelector('[data-qty-minus]').addEventListener('click', function () {
      state.qty = Math.max(1, state.qty - 1); sync(false);
    });
    document.querySelector('[data-qty-plus]').addEventListener('click', function () {
      state.qty = Math.min(99, state.qty + 1); sync(false);
    });

    document.querySelector('[data-add]').addEventListener('click', function () {
      FSA.addToCart(state.grind, state.size, state.qty);
    });
    document.querySelector('[data-buynow]').addEventListener('click', function () {
      FSA.addToCart(state.grind, state.size, state.qty);
      FSA.toast('Demo — checkout no conectado');
    });
    document.querySelector('[data-sb-add]').addEventListener('click', function () {
      FSA.addToCart(state.grind, state.size, state.qty);
    });

    /* -------------------------------------------------- sticky buy bar */
    var sticky = document.querySelector('[data-sticky]');
    var buybox = document.querySelector('[data-buybox]');
    if (sticky && buybox && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var show = !e.isIntersecting && e.boundingClientRect.top < 0;
          sticky.classList.toggle('is-visible', show);
          sticky.setAttribute('aria-hidden', String(!show));
          document.body.classList.toggle('sticky-buy-on', show);
        });
      }, { threshold: 0, rootMargin: '-120px 0px 0px 0px' }).observe(buybox);
    }

    /* ------------------------------------------------- perfil de sabor */
    var flavour = document.querySelector('[data-flavour]');
    if (flavour && 'IntersectionObserver' in window) {
      var fio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          fio.unobserve(e.target);
          e.target.querySelectorAll('[data-bar]').forEach(function (bar, i) {
            setTimeout(function () { bar.style.width = bar.dataset.bar + '%'; },
                       FSA.reduced ? 0 : i * 110);
          });
        });
      }, { threshold: 0.35 });
      fio.observe(flavour);
    }

    /* ------------------------------------------------------- count-up */
    var stats = document.querySelector('[data-stats]');
    if (stats && 'IntersectionObserver' in window) {
      var sio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          sio.unobserve(e.target);
          e.target.querySelectorAll('[data-count]').forEach(function (n) {
            var to = +n.dataset.count;
            if (FSA.reduced) { n.textContent = to.toLocaleString('es-CO'); return; }
            var t0 = performance.now();
            (function step(now) {
              var k = Math.min(1, (now - t0) / 1100);
              n.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('es-CO');
              if (k < 1) requestAnimationFrame(step);
            })(t0);
          });
        });
      }, { threshold: 0.4 });
      sio.observe(stats);
    }

    /* Smooth in-page anchors */
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      var head = document.querySelector('.site-header');
      FSA.scrollToY(window.scrollY + t.getBoundingClientRect().top - (head ? head.offsetHeight : 0) - 12);
    });

    sync(false);
  });
})();
