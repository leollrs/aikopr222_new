/* =============================================================
   SERENITY SPA — Premium Interactive Layer
   Handles: glass header on scroll, mobile nav, booking modal
   (multi-step with focus trap + preselection), testimonial
   carousel, and scroll-reveal animations.

   All vanilla JS — zero dependencies.
   ============================================================= */

(function () {
  'use strict';

  /* -----------------------------------------------------------
     GLASS HEADER — Transparent → frosted dark glass on scroll.
     Keeps "Book Appointment" CTA always legible at every depth.
     ----------------------------------------------------------- */
  const header = document.getElementById('header');

  function onScroll() {
    header.classList.toggle('scrolled', window.scrollY > 60);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();


  /* -----------------------------------------------------------
     MOBILE NAVIGATION — Hamburger toggle, outside-click close.
     ----------------------------------------------------------- */
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');

  hamburger.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    hamburger.classList.toggle('active');
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (e) => {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !hamburger.contains(e.target)) {
      nav.classList.remove('open');
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
    }
  });


  /* -----------------------------------------------------------
     SCROLL REVEAL — Intersection Observer.
     Single-fire fade-up animation per element.
     ----------------------------------------------------------- */
  const revealEls = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

    revealEls.forEach(el => obs.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('visible'));
  }


  /* -----------------------------------------------------------
     TESTIMONIAL CAROUSEL — Prev/Next + dots.
     Auto-advances every 6s, pauses on hover.
     ----------------------------------------------------------- */
  const track = document.getElementById('carouselTrack');
  const slides = track.querySelectorAll('.testimonial-slide');
  const dotsWrap = document.getElementById('carouselDots');
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  const total = slides.length;
  let current = 0;
  let autoTimer;

  // Generate dots
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Ir a reseña ' + (i + 1));
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
  });
  const dots = dotsWrap.querySelectorAll('.carousel-dot');

  function goTo(i) {
    current = ((i % total) + total) % total;
    track.style.transform = 'translateX(-' + (current * 100) + '%)';
    dots.forEach((d, idx) => d.classList.toggle('active', idx === current));
    resetAuto();
  }

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));

  function startAuto() { autoTimer = setInterval(() => goTo(current + 1), 6000); }
  function resetAuto() { clearInterval(autoTimer); startAuto(); }
  startAuto();

  const carousel = document.getElementById('carousel');
  carousel.addEventListener('mouseenter', () => clearInterval(autoTimer));
  carousel.addEventListener('mouseleave', startAuto);


  /* -----------------------------------------------------------
     BOOKING MODAL — Multi-step concierge flow.
     Core conversion element. Focus is trapped inside for a11y.
     ESC and overlay click both close. Treatment preselection
     from service cards reduces friction.
     ----------------------------------------------------------- */
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('bookingModal');
  const closeBtn = document.getElementById('modalClose');
  const form = document.getElementById('bookingForm');
  const progress = document.getElementById('modalProgress');
  const steps = modal.querySelectorAll('.modal-step');
  const progSteps = modal.querySelectorAll('.prog-step');

  let currentStep = 1;
  let triggerEl = null;

  // Open modal — any element with data-open-modal
  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      triggerEl = btn;

      // Preselect treatment if specified
      const t = btn.getAttribute('data-treatment');
      if (t) {
        const radio = form.querySelector('input[name="treatment"][value="' + t + '"]');
        if (radio) radio.checked = true;
      }

      openModal();
    });
  });

  function openModal() {
    currentStep = 1;
    showStep(1);
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');

    requestAnimationFrame(() => {
      const first = modal.querySelector('button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])');
      if (first) first.focus();
    });
  }

  function closeModal() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');

    if (triggerEl) { triggerEl.focus(); triggerEl = null; }

    setTimeout(() => {
      form.reset();
      clearErrors();
      currentStep = 1;
      showStep(1);
      form.style.display = '';
      progress.style.display = '';
      modal.querySelector('[data-step="4"]').hidden = true;
    }, 300);
  }

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  // Focus trap
  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(
      modal.querySelectorAll('button:not([disabled]), [href], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter(el => el.offsetParent !== null && !el.closest('[hidden]'));

    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  // Step navigation
  function showStep(n) {
    currentStep = n;
    steps.forEach(s => { s.hidden = parseInt(s.dataset.step, 10) !== n; });
    progSteps.forEach(ps => {
      const sn = parseInt(ps.dataset.step, 10);
      ps.classList.toggle('active', sn === n);
      ps.classList.toggle('completed', sn < n);
    });
  }

  // Step 1 → 2
  document.getElementById('toStep2').addEventListener('click', () => {
    clearErrors();
    if (!form.querySelector('input[name="treatment"]:checked')) {
      showError('errTreatment', 'Por favor selecciona un tratamiento para continuar.');
      return;
    }
    showStep(2);
    const dateInput = document.getElementById('bDate');
    const today = new Date();
    dateInput.min = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    requestAnimationFrame(() => dateInput.focus());
  });

  // Step 2 → 3
  document.getElementById('toStep3').addEventListener('click', () => {
    clearErrors();
    let ok = true;
    const d = document.getElementById('bDate');
    const t = document.getElementById('bTime');

    if (!d.value) { showError('errDate', 'Por favor selecciona una fecha.'); d.classList.add('error'); ok = false; }
    else {
      const sel = new Date(d.value);
      const now = new Date(); now.setHours(0,0,0,0);
      if (sel < now) { showError('errDate', 'Por favor selecciona una fecha futura.'); d.classList.add('error'); ok = false; }
    }
    if (!t.value) { showError('errTime', 'Por favor selecciona una hora.'); t.classList.add('error'); ok = false; }

    if (!ok) return;
    showStep(3);
    requestAnimationFrame(() => document.getElementById('bName').focus());
  });

  // Back buttons
  document.getElementById('back1').addEventListener('click', () => showStep(1));
  document.getElementById('back2').addEventListener('click', () => showStep(2));

  // Submit → confirmation
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors();
    let ok = true;

    const name = document.getElementById('bName');
    const email = document.getElementById('bEmail');
    const phone = document.getElementById('bPhone');

    if (name.value.trim().length < 2) {
      showError('errName', 'Por favor ingresa tu nombre completo.'); name.classList.add('error'); ok = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      showError('errEmail', 'Por favor ingresa un email válido.'); email.classList.add('error'); ok = false;
    }
    if (!/[\d\s\-().+]{7,}/.test(phone.value.trim())) {
      showError('errPhone', 'Por favor ingresa un número de teléfono válido.'); phone.classList.add('error'); ok = false;
    }

    if (!ok) return;

    // In production: send to backend here.
    form.style.display = 'none';
    progress.style.display = 'none';
    modal.querySelector('[data-step="4"]').hidden = false;
  });

  document.getElementById('modalDone').addEventListener('click', closeModal);

  // Helpers
  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  }

  function clearErrors() {
    modal.querySelectorAll('.form-error').forEach(el => { el.textContent = ''; });
    modal.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  }

  form.querySelectorAll('input, select').forEach(f => {
    f.addEventListener('input', () => {
      f.classList.remove('error');
      const err = f.closest('.form-group')?.querySelector('.form-error');
      if (err) err.textContent = '';
    });
  });

})();
