// Chargement dynamique de la navigation
fetch('assets/json/nav.json')
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById('sidebar-content');
    if (container) {
      container.appendChild(buildTree(data));
    }
  })
  .catch(err => console.error('Erreur de chargement nav.json:', err));

// Construction récursive du menu
function buildTree(nodes) {
  const ul = document.createElement('ul');

  nodes.forEach(node => {
    const li = document.createElement('li');

    if (node.type === 'folder') {
      const folder = document.createElement('div');
      folder.className = 'folder';

      const arrow = document.createElement('span');
      arrow.className = 'toggle-arrow';
      arrow.textContent = '▸';

      const label = document.createTextNode(` ${node.name}`);
      folder.appendChild(arrow);
      folder.appendChild(label);
      li.appendChild(folder);

      const subTree = buildTree(node.children);
      subTree.style.display = 'none';
      li.appendChild(subTree);

      folder.addEventListener('click', () => {
        const isVisible = subTree.style.display === 'block';
        subTree.style.display = isVisible ? 'none' : 'block';
        arrow.textContent = isVisible ? '▸' : '▾';
      });
    }

    if (node.type === 'file') {
      const link = document.createElement('a');
      link.href = node.path;
      link.textContent = node.name.replace('.html', '');
      li.appendChild(link);
    }

    ul.appendChild(li);
  });

  return ul;
}

// Gestion du bouton "hamburger"
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('sidebar-toggle');

if (toggleBtn && sidebar) {
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('show');
    document.body.classList.toggle('sidebar-visible');
  });
}

// Mise à jour automatique du layout
function updateSidebarState() {
  const isMobile = window.innerWidth < 700;
  document.body.classList.toggle('sidebar-visible', !isMobile);
  sidebar?.classList.remove('show');
}

window.addEventListener('resize', updateSidebarState);
window.addEventListener('DOMContentLoaded', updateSidebarState);
