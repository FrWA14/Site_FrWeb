<!-- À placer dans <head> de CHAQUE page (index + pages internes) -->
<script>
(function(){
  const p = location.pathname;
  const i = p.indexOf('/contenu/');
  const base = (i !== -1) ? p.slice(0, i) : ''; // préfixe projet ('' à la racine)

  // expose pour d'autres scripts si besoin
  window.__ASSETS_BASE__ = base;

  // injecte <link>
  function link(href, rel, attrs={}) {
    const el = document.createElement('link'); el.rel = rel; el.href = href;
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v));
    document.head.appendChild(el);
  }

  // injecte <script> séquentiellement
  function script(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.defer = true; s.onload = resolve; s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  // CSS + favicon
  link(base + '/assets/css/style.css', 'stylesheet');
  link(base + '/assets/css/pageweb.css', 'stylesheet');
  link(base + '/assets/image/icone/FrWA_Conception.png', 'icon', { type: 'image/png' });

  // JS après que le body existe
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      await script(base + '/assets/js/themeToggle.js');
      await script(base + '/assets/js/tree.js');
      await script(base + '/assets/js/menuToggle.js');
    } catch(e) {
      console.error('[loader] JS injection error:', e);
    }
  });
})();
</script>
