// assets/js/themeToggle.js
(function () {
  const KEY = 'theme';
  const THEMES = ['light', 'dark', 'cyan'];
  const root = document.documentElement;
  const btn  = document.querySelector('.theme-toggle');
  if (!btn) return;

  function icon(t) {
    if (t === 'light') return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>';
    if (t === 'dark')  return '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';
    return '<svg viewBox="0 0 24 24"><path d="M12 2C8 7 6 10 6 13a6 6 0 0 0 12 0c0-3-2-6-6-11z"/></svg>'; // goutte
  }

  function setTheme(t) {
    root.setAttribute('data-theme', t);
    localStorage.setItem(KEY, t);
    btn.innerHTML = icon(t);
    btn.setAttribute('aria-label', `Thème : ${t} (cliquer pour changer)`);
    btn.title = `Thème : ${t}`;
  }

  function next(t) { return THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]; }

  const saved = localStorage.getItem(KEY);
  const initial = THEMES.includes(saved) ? saved : 'light';
  setTheme(initial);

  btn.addEventListener('click', () => setTheme(next(root.getAttribute('data-theme') || 'light')));
  btn.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'enter' || k === ' ') { e.preventDefault(); btn.click(); }
  });
})();
