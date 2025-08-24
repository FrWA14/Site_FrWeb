// assets/js/tree.js
(function () {
  const FILE_TREE_UL_ID = 'fileTree';
  const TREE_JSON_URL = 'assets/json/tree.json'; // <base> en <head> fait que ceci marche partout

  // Renvoie 'dir' | 'file'
  function nodeType(node) {
    const t = (node && node.type || '').toLowerCase();
    if (t === 'folder' || t === 'dir' || Array.isArray(node?.children)) return 'dir';
    return 'file';
  }

  // Un nœud contient-il (directement ou en profondeur) un fichier .html ?
  function containsHtml(node) {
    const t = nodeType(node);
    if (t === 'file') {
      const p = String(node.url || node.path || node.name || '').toLowerCase();
      return /\.html?$/.test(p);
    }
    const kids = Array.isArray(node.children) ? node.children : [];
    return kids.some(containsHtml);
  }

  // Crée le lien <a> pour un fichier
  function makeFileLink(node) {
    const href = String(node.url || node.path || '').replace(/^\/+/, '');
    const isHtml = /\.html?$/i.test(href);
    const label = (isHtml ? '--> ' : '') + (node.name || href.split('/').pop() || href);
    const a = document.createElement('a');
    a.href = href; // résolu par <base href="/Site_FrWeb/">
    a.textContent = label;
    return a;
  }

  // Rend un nœud (en filtrant les branches sans .html)
  function renderNode(node) {
    if (!containsHtml(node)) return null;

    const li = document.createElement('li');
    const t = nodeType(node);

    if (t === 'dir') {
      const details = document.createElement('details');
      details.open = true;

      const summary = document.createElement('summary');
      summary.textContent = node.name || node.path || 'dossier';
      details.appendChild(summary);

      const ul = document.createElement('ul');
      for (const child of node.children || []) {
        const el = renderNode(child);
        if (el) ul.appendChild(el);
      }
      if (ul.children.length === 0) return null;

      details.appendChild(ul);
      li.appendChild(details);
      return li;
    }

    // file
    li.appendChild(makeFileLink(node));
    return li;
  }

  // Si la racine contient un dossier "contenu", on l’affiche prioritairement
  function findDirByName(node, target) {
    if (!node || typeof node !== 'object') return null;
    if (nodeType(node) === 'dir' && (node.name === target || node.path === target)) return node;
    for (const c of node.children || []) {
      const f = findDirByName(c, target);
      if (f) return f;
    }
    return null;
  }

  function renderTreeData(data, rootUl) {
    rootUl.textContent = '';

    const roots = [];
    if (Array.isArray(data)) {
      roots.push(...data);
    } else if (data && typeof data === 'object') {
      const contenu = findDirByName(data, 'contenu');
      roots.push(contenu || data);
    }

    if (roots.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Arborescence vide.';
      rootUl.appendChild(li);
      return;
    }

    for (const r of roots) {
      if (nodeType(r) === 'dir' && (r.name === 'contenu') && Array.isArray(r.children)) {
        for (const c of r.children) {
          const el = renderNode(c);
          if (el) rootUl.appendChild(el);
        }
      } else {
        const el = renderNode(r);
        if (el) rootUl.appendChild(el);
      }
    }

    if (rootUl.children.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Aucune page .html trouvée.';
      rootUl.appendChild(li);
    }
  }

  async function init() {
    const ul = document.getElementById(FILE_TREE_UL_ID);
    if (!ul) return;
    ul.innerHTML = '<li>Chargement de l’arborescence…</li>';
    try {
      const res = await fetch(TREE_JSON_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderTreeData(data, ul);
    } catch (e) {
      console.error('Tree load error:', e);
      ul.innerHTML = '<li style="color:#f66">Arborescence indisponible.</li>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
