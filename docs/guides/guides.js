(() => {
  const GUIDE_VERSION = '2026.07';

  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.innerHTML =
    '<button type="button" class="lightbox-close" aria-label="Cerrar">×</button><img alt="" />';
  document.body.appendChild(lightbox);

  const lightboxImg = lightbox.querySelector('img');
  const closeLightbox = () => lightbox.classList.remove('is-open');
  const openLightbox = (src, alt) => {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.classList.add('is-open');
  };

  lightbox.addEventListener('click', (event) => {
    if (
      event.target === lightbox ||
      event.target.classList.contains('lightbox-close')
    ) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeLightbox();
  });

  document.querySelectorAll('.screenshot-frame').forEach((frame) => {
    frame.addEventListener('click', () => {
      const img = frame.querySelector('img');
      if (img?.src) openLightbox(img.src, img.alt);
    });
    frame.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        frame.click();
      }
    });
    frame.setAttribute('tabindex', '0');
    frame.setAttribute('role', 'button');
    frame.setAttribute('aria-label', 'Ampliar captura de pantalla');
  });

  const printBtn = document.querySelector('[data-guide-print]');
  printBtn?.addEventListener('click', () => window.print());

  const backToTop = document.createElement('button');
  backToTop.type = 'button';
  backToTop.className = 'back-to-top';
  backToTop.setAttribute('aria-label', 'Volver arriba');
  backToTop.textContent = '↑';
  document.body.appendChild(backToTop);

  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener(
    'scroll',
    () => {
      backToTop.classList.toggle('is-visible', window.scrollY > 480);
    },
    { passive: true },
  );

  const tocLinks = Array.from(
    document.querySelectorAll('.guide-sidebar .toc a[href^="#"]'),
  );
  const sections = tocLinks
    .map((link) => {
      const id = link.getAttribute('href')?.slice(1);
      const el = id ? document.getElementById(id) : null;
      return el ? { link, el } : null;
    })
    .filter(Boolean);

  if (sections.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const match = sections.find((s) => s.el === entry.target);
          if (!match) return;
          tocLinks.forEach((a) => a.classList.remove('is-active'));
          match.link.classList.add('is-active');
        });
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s.el));
  }

  document.querySelectorAll('[data-guide-version]').forEach((el) => {
    el.textContent = `ZigZag · Guías v${GUIDE_VERSION}`;
  });
})();
