/**
 * Tree Renderer
 * Génère le HTML de l'arborescence de navigation
 */

const TreeRenderer = {
    /**
     * Référence au container de navigation
     */
    container: null,

    /**
     * Structure de l'arbre actuel
     */
    currentTree: [],

    /**
     * Chemin actuellement sélectionné
     */
    activePath: null,

    /**
     * Initialise le renderer
     */
    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Navigation container not found:', containerId);
            return;
        }
        this.loadOpenFolders();
    },

    /**
     * Rend l'arbre complet
     */
    render(tree) {
        if (!this.container) return;
        
        this.currentTree = tree;
        DOMHelpers.empty(this.container);
        
        const fragment = document.createDocumentFragment();
        tree.forEach(node => {
            const element = this.renderNode(node);
            if (element) fragment.appendChild(element);
        });
        
        this.container.appendChild(fragment);
    },

    /**
     * Rend un nœud individuel
     */
    renderNode(node) {
        const item = DOMHelpers.createElement('div', {
            className: `nav-item nav-level-${node.level}${node.isOpen ? ' open' : ''}`,
            'data-path': node.path,
            'data-type': node.type
        });

        // Lien principal
        const link = this.createLink(node);
        item.appendChild(link);

        // Container pour les enfants
        if (node.type === 'folder' && node.children.length > 0) {
            const children = DOMHelpers.createElement('div', {
                className: 'nav-children'
            });
            
            node.children.forEach(child => {
                const childElement = this.renderNode(child);
                if (childElement) children.appendChild(childElement);
            });
            
            item.appendChild(children);
        }

        return item;
    },

    /**
     * Crée le lien de navigation
     */
    createLink(node) {
        const isActive = this.activePath === node.path;
        
        const link = DOMHelpers.createElement('a', {
            className: `nav-link${isActive ? ' active' : ''}`,
            href: node.type === 'file' ? '#' + node.path : 'javascript:void(0)',
            title: node.displayName
        });

        // Icône
        const icon = DOMHelpers.createElement('span', {
            className: `nav-icon ${node.type}${node.isOpen ? ' open' : ''}`
        });
        
        // Utilise une icône personnalisée si définie
        if (node.icon) {
            icon.textContent = node.icon;
            icon.classList.remove('folder', 'file');
        }
        
        link.appendChild(icon);

        // Texte
        const text = DOMHelpers.createElement('span', {
            className: 'nav-text',
            textContent: node.displayName
        });
        link.appendChild(text);

        // Chevron pour les dossiers
        if (node.type === 'folder' && node.children.length > 0) {
            const chevron = DOMHelpers.createElement('span', {
                className: 'nav-chevron'
            });
            link.appendChild(chevron);
        }

        // Event listeners
        link.addEventListener('click', (e) => this.handleClick(e, node));

        return link;
    },

    /**
     * Gère le clic sur un élément
     */
    handleClick(event, node) {
        event.preventDefault();
        
        if (node.type === 'folder') {
            this.toggleFolder(node);
        } else {
            this.selectFile(node);
        }
    },

    /**
     * Toggle l'ouverture d'un dossier
     */
    toggleFolder(node) {
        node.isOpen = !node.isOpen;
        
        const item = this.container.querySelector(`[data-path="${node.path}"]`);
        if (item) {
            DOMHelpers.toggleClass(item, 'open');
            
            // Update l'icône
            const icon = item.querySelector('.nav-icon');
            if (icon) {
                DOMHelpers.toggleClass(icon, 'open');
            }
        }
        
        this.saveOpenFolders();
    },

    /**
     * Sélectionne un fichier
     */
    selectFile(node) {
        // Retire la classe active de l'ancien
        const currentActive = this.container.querySelector('.nav-link.active');
        if (currentActive) {
            DOMHelpers.removeClass(currentActive, 'active');
        }
        
        // Ajoute au nouveau
        const item = this.container.querySelector(`[data-path="${node.path}"]`);
        if (item) {
            const link = item.querySelector('.nav-link');
            DOMHelpers.addClass(link, 'active');
        }
        
        this.activePath = node.path;
        
        // Déclenche l'événement de navigation
        const event = new CustomEvent('navigate', {
            detail: { path: node.path, node: node }
        });
        document.dispatchEvent(event);
    },

    /**
     * Définit le chemin actif et ouvre les dossiers parents
     */
    setActivePath(path) {
        this.activePath = path;
        
        // Ouvre les dossiers parents
        const parentPaths = TreeBuilder.getParentPaths(this.currentTree, path);
        if (parentPaths) {
            parentPaths.forEach(parentPath => {
                const node = TreeBuilder.findNodeByPath(this.currentTree, parentPath);
                if (node && !node.isOpen) {
                    node.isOpen = true;
                }
            });
        }
        
        // Re-rend l'arbre
        this.render(this.currentTree);
    },

    /**
     * Sauvegarde les dossiers ouverts
     */
    saveOpenFolders() {
        const openPaths = [];
        const collectOpen = (nodes) => {
            nodes.forEach(node => {
                if (node.isOpen) openPaths.push(node.path);
                if (node.children) collectOpen(node.children);
            });
        };
        collectOpen(this.currentTree);
        
        try {
            localStorage.setItem(
                SiteConfig.storageKeys.openFolders, 
                JSON.stringify(openPaths)
            );
        } catch (e) {
            console.warn('Could not save open folders:', e);
        }
    },

    /**
     * Charge les dossiers ouverts
     */
    loadOpenFolders() {
        try {
            const saved = localStorage.getItem(SiteConfig.storageKeys.openFolders);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    },

    /**
     * Applique l'état des dossiers ouverts
     */
    applyOpenFolders(tree) {
        const openPaths = this.loadOpenFolders();
        
        const applyOpen = (nodes) => {
            nodes.forEach(node => {
                if (openPaths.includes(node.path)) {
                    node.isOpen = true;
                }
                if (node.children) applyOpen(node.children);
            });
        };
        
        applyOpen(tree);
        return tree;
    }
};

// Export for use in other modules
window.TreeRenderer = TreeRenderer;
