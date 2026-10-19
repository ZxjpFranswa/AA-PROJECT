(() => {
  'use strict';

  document.documentElement.classList.add('js');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasObserver = 'IntersectionObserver' in window;

  /* Small helper: run a function at most once per animation frame */
  const rafThrottle = (fn) => {
    let queued = false;
    return (...args) => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        fn(...args);
      });
    };
  };

  const debounce = (fn, wait = 150) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  };

  /* ------------------------------------------------------------------
     Mobile navigation
     ------------------------------------------------------------------ */
  const header = document.querySelector('.site-header');
  const menuToggle = document.getElementById('menuToggle');
  const siteNav = document.getElementById('siteNav');
  const mobileQuery = window.matchMedia('(max-width: 760px)');

  const setMenu = (open, { returnFocus = false } = {}) => {
    if (!menuToggle || !siteNav) return;
    siteNav.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    menuToggle.textContent = open ? '×' : '☰';
    if (!open && returnFocus) menuToggle.focus();
  };

  if (menuToggle && siteNav) {
    menuToggle.addEventListener('click', () => setMenu(!siteNav.classList.contains('open')));

    siteNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMenu(false));
    });

    /* Escape closes the menu and gives focus back to the toggle */
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && siteNav.classList.contains('open')) {
        setMenu(false, { returnFocus: true });
      }
    });

    /* Clicking anywhere outside the header closes the menu */
    document.addEventListener('click', (event) => {
      if (siteNav.classList.contains('open') && header && !header.contains(event.target)) {
        setMenu(false);
      }
    });

    /* Reset when the layout grows back to desktop */
    mobileQuery.addEventListener('change', (event) => {
      if (!event.matches) setMenu(false);
    });
  }

  /* ------------------------------------------------------------------
     Header state + scroll progress bar
     ------------------------------------------------------------------ */
  const progressBar = document.createElement('div');
  progressBar.className = 'scroll-progress';
  progressBar.setAttribute('aria-hidden', 'true');
  document.body.prepend(progressBar);

  const onScroll = rafThrottle(() => {
    if (header) header.classList.toggle('scrolled', window.scrollY > 24);
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
    progressBar.style.setProperty('--progress', progress.toFixed(4));
  });
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  /* ------------------------------------------------------------------
     Artwork cards: clamp long text, only offer "Read more" when needed
     ------------------------------------------------------------------ */
  const readMoreControls = [];

  document.querySelectorAll('.artwork-card .personal').forEach((box, index) => {
    const label = box.querySelector('strong');
    if (!label) return;

    const wrapper = document.createElement('span');
    wrapper.className = 'personal-text';
    wrapper.id = `personal-text-${index + 1}`;
    while (label.nextSibling) wrapper.appendChild(label.nextSibling);
    box.appendChild(wrapper);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'read-more';
    button.textContent = 'Read more';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', wrapper.id);
    button.addEventListener('click', () => {
      const expanded = box.classList.toggle('expanded');
      button.textContent = expanded ? 'Show less' : 'Read more';
      button.setAttribute('aria-expanded', String(expanded));
      /* After collapsing, keep the card in view instead of leaving the user mid-page */
      if (!expanded) box.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
    box.appendChild(button);

    readMoreControls.push({ box, wrapper, button });
  });

  const measureReadMore = () => {
    readMoreControls.forEach(({ box, wrapper, button }) => {
      if (box.classList.contains('expanded')) return;
      button.hidden = wrapper.scrollHeight <= wrapper.clientHeight + 1;
    });
  };
  measureReadMore();
  window.addEventListener('resize', debounce(measureReadMore), { passive: true });
  window.addEventListener('load', measureReadMore);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureReadMore);

  /* ------------------------------------------------------------------
     Image loading state (removes the skeleton shimmer)
     ------------------------------------------------------------------ */
  document.querySelectorAll('.art-image, .hero-art-frame, .masterpiece-image').forEach((container) => {
    const img = container.querySelector('img');
    if (!img) return;
    const done = () => container.classList.add('is-loaded');
    if (img.complete) {
      done();
    } else {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    }
  });

  /* ------------------------------------------------------------------
     Scroll reveal (staggered per group, cleans up after itself)
     ------------------------------------------------------------------ */
  if (!prefersReducedMotion && hasObserver) {
    const revealTargets = document.querySelectorAll(
      '.section-heading, .concept-card, .artwork-card, .gallery-label, .hero-stats li, .intro-band p, ' +
      '.creative-layout > *, .masterpiece-layout > *, .reflection-body, .credits-list li'
    );

    const groupCounts = new Map();
    revealTargets.forEach((el) => {
      const count = groupCounts.get(el.parentElement) || 0;
      groupCounts.set(el.parentElement, count + 1);
      el.style.setProperty('--reveal-delay', `${(count % 3) * 90}ms`);
      el.classList.add('reveal');
    });

    const cleanup = (event) => {
      if (event.animationName !== 'reveal-in') return;
      const el = event.currentTarget;
      el.classList.remove('reveal', 'is-visible');
      el.style.removeProperty('--reveal-delay');
      el.removeEventListener('animationend', cleanup);
    };

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.addEventListener('animationend', cleanup);
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealTargets.forEach((el) => revealObserver.observe(el));
  }

  /* ------------------------------------------------------------------
     Active navigation link while scrolling
     ------------------------------------------------------------------ */
  if (siteNav && hasObserver) {
    const navLinks = [...siteNav.querySelectorAll('a[href^="#"]')];
    const sections = [...document.querySelectorAll('main section[id]')];

    const setActive = (id) => {
      navLinks.forEach((link) => {
        const active = link.getAttribute('href') === `#${id}`;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    };

    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach((section) => navObserver.observe(section));
  }

  /* ------------------------------------------------------------------
     Lightbox: click or press Enter on any artwork to view it larger
     ------------------------------------------------------------------ */
  if (typeof HTMLDialogElement === 'function') {
    const dialog = document.createElement('dialog');
    dialog.className = 'lightbox';
    dialog.setAttribute('aria-label', 'Enlarged artwork');
    dialog.innerHTML =
      '<button type="button" class="lightbox-close" aria-label="Close enlarged artwork">×</button>' +
      '<figure><img alt=""><figcaption></figcaption></figure>';
    document.body.appendChild(dialog);

    const dialogImg = dialog.querySelector('img');
    const dialogCaption = dialog.querySelector('figcaption');
    let opener = null;

    const openLightbox = (img) => {
      opener = img;
      const shownSrc = img.currentSrc || img.src;
      /* Wikimedia originals can be hundreds of MB, so ask for a large (not original) thumbnail */
      const largeSrc = /Special:FilePath\/.*[?&]width=\d+/.test(shownSrc)
        ? shownSrc.replace(/([?&]width=)\d+/, (_, prefix) => `${prefix}2000`)
        : shownSrc;
      dialogImg.onerror = () => {
        dialogImg.onerror = null;
        dialogImg.src = shownSrc;
      };
      dialogImg.src = largeSrc;
      dialogImg.alt = img.alt;
      dialogCaption.textContent = img.alt;
      document.body.classList.add('no-scroll');
      dialog.showModal();
      dialog.querySelector('.lightbox-close').focus();
    };

    document.querySelectorAll('.art-image img, .masterpiece-image img, .hero-art-frame img').forEach((img) => {
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', `Enlarge image: ${img.alt}`);
      img.addEventListener('click', () => openLightbox(img));
      img.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openLightbox(img);
        }
      });
    });

    /* Click the backdrop, the image, or the close button to dismiss */
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog || event.target === dialogImg || event.target.closest('.lightbox-close')) {
        dialog.close();
      }
    });

    dialog.addEventListener('close', () => {
      document.body.classList.remove('no-scroll');
      dialogImg.removeAttribute('src');
      if (opener) opener.focus({ preventScroll: true });
      opener = null;
    });
  }
})();
