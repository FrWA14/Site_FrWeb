// Fonction pour afficher l'arborescence
function renderTree(tree, container) {
    const ul = document.createElement('ul');
    tree.forEach(item => {
        const li = document.createElement('li');
        if (item.type === 'folder') {
            li.textContent = item.name;
            const subUl = document.createElement('ul');
            renderTree(item.children, subUl);
            li.appendChild(subUl);
        } else if (item.type === 'file') {
            // Créer un lien hypertexte pour chaque fichier .html
            const a = document.createElement('a');
            a.href = item.url;  // Utilisation de l'URL du fichier .html
            a.textContent = item.name;
            li.appendChild(a);
        }
        ul.appendChild(li);
    });
    container.appendChild(ul);
}

// Récupérer l'arborescence via le fichier tree.json
fetch('tree.json')
    .then(response => response.json())
    .then(data => {
        const treeContainer = document.getElementById('tree-container');
        renderTree([data], treeContainer);  // On commence avec un tableau contenant la racine
    })
    .catch(error => console.error('Erreur lors du chargement de l\'arborescence:', error));
