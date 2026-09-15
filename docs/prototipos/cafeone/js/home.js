/* ==========================================================================
   Finca San Adolfo — home page behaviour
   Depends on assets/js/app.js (window.FSA).
   ========================================================================== */
(function () {
  'use strict';

  function ready(fn) {
    if (window.FSA) window.FSA.onReady.push(fn);
    else document.addEventListener('DOMContentLoaded', function () { window.FSA.onReady.push(fn); });
  }

  ready(function () {
    var FSA = window.FSA;
    var P = FSA.PRODUCT;
    var VARIANTS = FSA.variants();
    var railAPI = null;   /* set once the presentaciones carousel is built */

    /* ------------------------------------------------- producto insignia */
    var state = { grind: 'Molido', size: '250 g' };

    var stage = document.querySelector('[data-stage]');
    var stageImg = stage && stage.querySelector('img');
    var stageLabel = document.querySelector('[data-stage-label]');
    var priceEl = document.querySelector('[data-price]');

    function syncSpotlight(animatePrice) {
      document.querySelectorAll('[data-opts]').forEach(function (group) {
        var axis = group.dataset.opts;
        group.querySelectorAll('.opt').forEach(function (b) {
          b.setAttribute('aria-pressed', String(b.dataset.value === state[axis]));
        });
      });

      var key = state.grind + '|' + state.size;
      if (stage) stage.dataset.grind = state.grind;
      if (stage && stageImg) {
        stage.classList.add('is-swapping');
        setTimeout(function () {
          stageImg.src = P.image[key];
          stageImg.alt = 'Bolsa de café ' + state.grind.toLowerCase() + ' de ' + state.size;
          stage.classList.remove('is-swapping');
        }, 180);
      }
      if (stageLabel) stageLabel.textContent = state.grind + ' · ' + state.size;

      if (priceEl) {
        var next = FSA.money(P.price[state.size]);
        if (animatePrice && priceEl.textContent !== next) {
          priceEl.classList.remove('is-swapping');
          void priceEl.offsetWidth;
          priceEl.classList.add('is-swapping');
          setTimeout(function () { priceEl.textContent = next; }, 130);
        } else {
          priceEl.textContent = next;
        }
      }

      syncRailActive();
    }

    document.querySelectorAll('[data-opts]').forEach(function (group) {
      group.addEventListener('click', function (e) {
        var b = e.target.closest('.opt');
        if (!b) return;
        state[group.dataset.opts] = b.dataset.value;
        syncSpotlight(true);
      });
    });

    function stepVariant(dir) {
      var key = state.grind + '|' + state.size;
      var i = VARIANTS.findIndex(function (v) { return v.key === key; });
      var n = VARIANTS[(i + dir + VARIANTS.length) % VARIANTS.length];
      state.grind = n.grind;
      state.size = n.size;
      syncSpotlight(true);
      scrollRailTo((i + dir + VARIANTS.length) % VARIANTS.length);
    }
    var prevBtn = document.querySelector('[data-stage-prev]');
    var nextBtn = document.querySelector('[data-stage-next]');
    if (prevBtn) prevBtn.addEventListener('click', function () { stepVariant(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { stepVariant(1); });

    var addBtn = document.querySelector('[data-add]');
    if (addBtn) addBtn.addEventListener('click', function () {
      FSA.addToCart(state.grind, state.size, 1);
    });

    /* --------------------------------------------------- presentaciones */
    var rail = document.querySelector('[data-rail]');

    if (rail) {
      rail.innerHTML = VARIANTS.map(function (v, i) {
        return '' +
        '<article class="pres-card" data-card="' + i + '">' +
          '<div class="pres-media" data-grind="' + v.grind + '">' +
            '<img src="' + P.image[v.key] + '" alt="Bolsa de café ' + v.grind.toLowerCase() + ' de ' + v.size + '" loading="lazy" width="755" height="1002">' +
            '<div class="quick-acts">' +
              '<button type="button" data-quick="' + i + '" aria-label="Vista rápida de ' + v.grind + ' ' + v.size + '">' + FSA.icon('eye', 18) + '</button>' +
              '<button type="button" data-quickadd="' + i + '" aria-label="Agregar ' + v.grind + ' ' + v.size + ' al carrito">' + FSA.icon('cart', 18) + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="pres-meta">' +
            '<h3>' + v.grind + ' · ' + v.size + '</h3>' +
            '<span>' + FSA.money(P.price[v.size]) + '</span>' +
          '</div>' +
        '</article>';
      }).join('');

      var cards = Array.prototype.slice.call(rail.querySelectorAll('.pres-card'));

      function centreIndex() {
        var mid = rail.scrollLeft + rail.clientWidth / 2;
        var best = 0, bestD = Infinity;
        cards.forEach(function (c, i) {
          var d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
          if (d < bestD) { bestD = d; best = i; }
        });
        return best;
      }
      function markActive() {
        var i = centreIndex();
        cards.forEach(function (c, n) { c.classList.toggle('is-active', n === i); });
      }

      function railScrollTo(i) {
        var c = cards[i];
        if (!c) return;
        rail.scrollTo({
          left: c.offsetLeft + c.offsetWidth / 2 - rail.clientWidth / 2,
          behavior: FSA.reduced ? 'auto' : 'smooth'
        });
      }
      railAPI = { mark: markActive, to: railScrollTo, at: centreIndex };

      rail.addEventListener('scroll', function () {
        window.requestAnimationFrame(markActive);
      }, { passive: true });
      window.addEventListener('resize', markActive);
      markActive();

      document.querySelector('[data-rail-prev]').addEventListener('click', function () {
        railScrollTo(Math.max(0, centreIndex() - 1));
      });
      document.querySelector('[data-rail-next]').addEventListener('click', function () {
        railScrollTo(Math.min(cards.length - 1, centreIndex() + 1));
      });

      /* Pointer drag */
      var down = false, startX = 0, startScroll = 0, moved = 0;
      rail.addEventListener('pointerdown', function (e) {
        if (e.target.closest('button')) return;
        down = true; moved = 0;
        startX = e.clientX; startScroll = rail.scrollLeft;
        rail.classList.add('is-dragging');
        rail.setPointerCapture(e.pointerId);
      });
      rail.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - startX;
        moved = Math.abs(dx);
        rail.scrollLeft = startScroll - dx;
      });
      function endDrag() {
        if (!down) return;
        down = false;
        rail.classList.remove('is-dragging');
        railScrollTo(centreIndex());
      }
      rail.addEventListener('pointerup', endDrag);
      rail.addEventListener('pointercancel', endDrag);
      rail.addEventListener('click', function (e) {
        if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
      }, true);

      /* Quick view + quick add */
      rail.addEventListener('click', function (e) {
        var qa = e.target.closest('[data-quickadd]');
        if (qa) {
          var v = VARIANTS[+qa.dataset.quickadd];
          FSA.addToCart(v.grind, v.size, 1);
          return;
        }
        var qv = e.target.closest('[data-quick]');
        if (qv) openQuick(+qv.dataset.quick);
      });
    }

    function syncRailActive() { if (railAPI) railAPI.mark(); }
    function scrollRailTo(i) { if (railAPI) railAPI.to(i); }

    /* ----------------------------------------------------- quick view */
    var modal;
    function buildModal() {
      modal = document.createElement('div');
      modal.className = 'modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'Vista rápida');
      modal.innerHTML =
        '<div class="modal-panel">' +
          '<button class="icon-btn modal-close" aria-label="Cerrar">' + FSA.icon('x', 22) + '</button>' +
          '<div class="bag-card"><img alt=""></div>' +
          '<div class="modal-body">' +
            '<h3>' + P.name + '</h3>' +
            '<p class="muted" data-qv-var></p>' +
            '<p class="price-row" style="margin-top:var(--space-5)"><span class="price" data-qv-price></span><small>COP</small></p>' +
            '<div class="qty-block">' +
              '<button type="button" data-qv-minus aria-label="Quitar una unidad">' + FSA.icon('minus', 18) + '</button>' +
              '<span data-qv-qty>1</span>' +
              '<button type="button" data-qv-plus aria-label="Agregar una unidad">' + FSA.icon('plus', 18) + '</button>' +
            '</div>' +
            '<button type="button" class="btn btn--primary btn--block" data-qv-add>Agregar</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);

      modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target.closest('.modal-close')) closeQuick();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) closeQuick();
      });
    }

    var qvIndex = 0, qvQty = 1;
    function openQuick(i) {
      if (!modal) buildModal();
      qvIndex = i; qvQty = 1;
      var v = VARIANTS[i];
      modal.querySelector('.bag-card img').src = P.image[v.key];
      modal.querySelector('.bag-card img').alt = 'Bolsa de café ' + v.grind.toLowerCase() + ' de ' + v.size;
      modal.querySelector('[data-qv-var]').textContent = v.grind + ' · ' + v.size;
      modal.querySelector('[data-qv-price]').textContent = FSA.money(P.price[v.size]);
      modal.querySelector('[data-qv-qty]').textContent = qvQty;
      modal.classList.add('is-open');
      document.body.classList.add('is-locked');
      modal.querySelector('.modal-close').focus();

      modal.querySelector('[data-qv-minus]').onclick = function () {
        qvQty = Math.max(1, qvQty - 1);
        modal.querySelector('[data-qv-qty]').textContent = qvQty;
      };
      modal.querySelector('[data-qv-plus]').onclick = function () {
        qvQty = Math.min(99, qvQty + 1);
        modal.querySelector('[data-qv-qty]').textContent = qvQty;
      };
      modal.querySelector('[data-qv-add]').onclick = function () {
        closeQuick();
        FSA.addToCart(v.grind, v.size, qvQty);
      };
    }
    function closeQuick() {
      modal.classList.remove('is-open');
      document.body.classList.remove('is-locked');
    }

    /* ------------------------------------------------------- marquee */
    var track = document.querySelector('[data-marquee]');
    var mcard = document.querySelector('[data-marquee-card]');
    var marquee = document.querySelector('.marquee');

    if (track && marquee) {
      var mobile = window.matchMedia('(max-width: 640px)').matches;
      if (FSA.reduced || mobile) {
        track.classList.add('marquee-track--auto');
      } else {
        FSA.scrub(marquee, function (p) {
          var travel = window.innerWidth * 1.6;
          track.style.transform = 'translate(' + (-p * travel).toFixed(1) + 'px,-50%)';
        });
        if (mcard) {
          FSA.scrub(marquee, function (p) {
            var t = Math.max(0, Math.min(1, (p - 0.12) / 0.45));
            var scale = 0.85 + 0.15 * t;
            var rot = -4 + 4 * t;
            mcard.style.transform = 'scale(' + scale.toFixed(3) + ') rotate(' + rot.toFixed(2) + 'deg)';
          });
        }
      }
    }

    /* ------------------------------------------------------- collage */
    var collage = document.querySelector('[data-collage]');
    if (collage) {
      var figs = Array.prototype.slice.call(collage.children);
      var from = [-8, 4, -3];
      var spread = [-70, 0, 70];
      FSA.scrub(collage, function (p) {
        var t = Math.max(0, Math.min(1, (p - 0.15) / 0.5));
        figs.forEach(function (f, i) {
          var rot = from[i] * (1 - t);
          var x = spread[i] * t;
          f.style.transform = 'translateX(' + x.toFixed(1) + 'px) rotate(' + rot.toFixed(2) + 'deg)';
        });
      });
      figs.forEach(function (f, i) {
        f.style.transform = 'rotate(' + from[i] + 'deg)';
      });
    }

    /* ------------------------------------------------------ parallax */
    document.querySelectorAll('[data-parallax]').forEach(function (img) {
      var host = img.closest('section') || img.parentElement;
      FSA.scrub(host, function (p) {
        img.style.transform = 'translateY(' + ((p - 0.5) * -10).toFixed(2) + '%)';
      });
    });

    /* ------------------------------------------------------ count-up */
    var stats = document.querySelector('[data-stats]');
    if (stats && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          e.target.querySelectorAll('[data-count]').forEach(function (n) {
            var to = +n.dataset.count;
            if (FSA.reduced) { n.textContent = to.toLocaleString('es-CO'); return; }
            var t0 = performance.now(), dur = 1100;
            (function step(now) {
              var k = Math.min(1, (now - t0) / dur);
              var eased = 1 - Math.pow(1 - k, 3);
              n.textContent = Math.round(to * eased).toLocaleString('es-CO');
              if (k < 1) requestAnimationFrame(step);
            })(t0);
          });
        });
      }, { threshold: 0.4 });
      io.observe(stats);
    }

    /* Anchor links honour the smooth-scroll helper */
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      var head = document.querySelector('.site-header');
      var offset = head ? head.offsetHeight : 0;
      FSA.scrollToY(window.scrollY + t.getBoundingClientRect().top - offset - 12);
    });

    syncSpotlight(false);
  });
})();
