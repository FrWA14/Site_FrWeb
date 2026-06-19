// assets/js/menuToggle.js
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.querySelector('.hamburger');
  const sidebar   = document.querySelector('.sidebar');
  if (!hamburger || !sidebar) return;

  // A11y
  hamburger.setAttribute('role', 'button');
  hamburger.setAttribute('tabindex', '0');
  hamburger.setAttribute('aria-label', 'Ouvrir/fermer le menu');
  hamburger.setAttribute('aria-expanded', 'false');

  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  const openMenu = () => {
    document.body.classList.add('menu-open');
    if (isMobile()) sidebar.classList.add('show');
    hamburger.setAttribute('aria-expanded', 'true');
    if (isMobile()) { sidebar.setAttribute('tabindex', '-1'); sidebar.focus({ preventScroll: true }); }
  };
  const closeMenu = () => {
    document.body.classList.remove('menu-open');
    sidebar.classList.remove('show');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.focus({ preventScroll: true });
  };
  const toggleMenu = () => (document.body.classList.contains('menu-open') ? closeMenu() : openMenu());

  hamburger.addEventListener('click', toggleMenu);
  hamburger.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'enter' || k === ' ') { e.preventDefault(); toggleMenu(); }
    if (k === 'escape') closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) closeMenu();
  });
  document.addEventListener('click', (e) => {
    if (!isMobile()) return;
    if (!document.body.classList.contains('menu-open')) return;
    if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) closeMenu();
  });

  let t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (!isMobile()) { document.body.classList.remove('menu-open'); sidebar.classList.remove('show'); hamburger.setAttribute('aria-expanded', 'false'); }
      else if (document.body.classList.contains('menu-open')) sidebar.classList.add('show');
    }, 120);
  });
});
