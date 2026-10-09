/**
 * Breadcrumb
 * Gestion du fil d'Ariane
 */

const Breadcrumb = {
    /**
     * Container du breadcrumb
     */
    container: null,

    /**
     * Initialise le breadcrumb
     */
    init(containerId) {
        this.container = document.getElementById(containerId);
    },

    /**
     * Met à jour le breadcrumb
     */
    update(path) {
        if (!this.container) return;
        
        const segments = this.buildSegments(path);

        DOMHelpers.empty(this.container);
        
        // Ajoute le lien home
        const homeLink = this.createHomeLink();
        this.container.appendChild(homeLink);
        
        // Ajoute les segments
        segments.forEach((segment, index) => {
            // Séparateur
            const separator = DOMHelpers.createElement('span', {
                className: 'breadcrumb-separator',
                textContent: '/'
            });
            this.container.appendChild(separator);
            
            // Segment
            const item = this.createSegment(segment);
            this.container.appendChild(item);
        });
    },

    /**
     * Construit les étapes du fil d'Ariane à partir des pages (et non des dossiers) :
     * chaque dossier parent est remplacé par sa page principale
     * ex : pages/projets/plantation_autonome/Plantation_autonome.html
     *      -> Projets (Projets.html) / Plantation Autonome
     */
    buildSegments(path) {
        const segments = [];
        const folders = PathUtils.getSegments(path).slice(0, -1);
        const currentPage = TreeBuilder.findRawItem(path);

        // Dossiers parents, en ignorant le dossier racine "pages"
        let folderPath = '';
        folders.forEach((folderName, index) => {
            folderPath = folderPath ? folderPath + '/' + folderName : folderName;
            if (index === 0) return;

            const folder = TreeBuilder.findRawItem(folderPath);
            const folderPage = TreeBuilder.getFolderPage(folderPath);

            // La page principale du dossier est la page courante : elle sera affichée en dernier
            if (folderPage && folderPage.path === path) return;

            // Dossier absent du menu (ex : template) portant le nom de la page : évite le doublon
            const simplify = name => name.toLowerCase().replace(/\.html?$/, '').replace(/[-_\s]/g, '');
            if (!folder && index === folders.length - 1 && simplify(folderName) === simplify(PathUtils.getSegments(path).pop())) return;

            segments.push({
                name: folderPage ? folderPage.displayName : (folder ? folder.displayName : PathUtils.pathToTitle(folderName)),
                path: folderPage ? folderPage.path : null,
                isLast: false
            });
        });

        // Page courante
        segments.push({
            name: currentPage ? currentPage.displayName : PathUtils.pathToTitle(path),
            path: path,
            isLast: true
        });

        return segments;
    },

    /**
     * Crée le lien home
     */
    createHomeLink() {
        const link = DOMHelpers.createElement('a', {
            className: 'breadcrumb-item breadcrumb-home',
            href: '#',
            title: 'Accueil'
        });
        
        const icon = DOMHelpers.createElement('span', {
            className: 'breadcrumb-icon',
            textContent: '🏠'
        });
        link.appendChild(icon);

        const text = DOMHelpers.createElement('span', {
            textContent: 'Accueil'
        });
        link.appendChild(text);

        link.addEventListener('click', (e) => {
            e.preventDefault();
            const event = new CustomEvent('navigate', {
                detail: { path: null, isHome: true }
            });
            document.dispatchEvent(event);
        });
        
        return link;
    },

    /**
     * Crée un segment de breadcrumb
     */
    createSegment(segment) {
        if (segment.isLast) {
            return DOMHelpers.createElement('span', {
                className: 'breadcrumb-item breadcrumb-current',
                textContent: segment.name
            });
        }

        // Dossier sans page principale : texte simple, pas de lien vers une page inexistante
        if (!segment.path) {
            return DOMHelpers.createElement('span', {
                className: 'breadcrumb-item breadcrumb-folder',
                textContent: segment.name
            });
        }
        
        const link = DOMHelpers.createElement('a', {
            className: 'breadcrumb-item',
            href: '#' + segment.path,
            textContent: segment.name
        });
        
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const event = new CustomEvent('navigate', {
                detail: { path: segment.path }
            });
            document.dispatchEvent(event);
        });
        
        return link;
    },

    /**
     * Efface le breadcrumb (pour la home)
     */
    clear() {
        if (this.container) {
            DOMHelpers.empty(this.container);
        }
    }
};

// Styles inline pour le breadcrumb (ajoutés dynamiquement)
const breadcrumbStyles = `
    .breadcrumb {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.875rem;
        color: var(--text-muted);
    }
    
    .breadcrumb-item {
        color: var(--text-secondary);
        transition: color 0.15s ease;
    }
    
    .breadcrumb-item:hover {
        color: var(--text-accent);
    }
    
    .breadcrumb-current {
        color: var(--text-primary);
        font-weight: 500;
    }
    
    .breadcrumb-separator {
        color: var(--text-muted);
        opacity: 0.5;
    }
    
    .breadcrumb-icon {
        font-size: 1rem;
    }
    
    .breadcrumb-home {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .breadcrumb-folder,
    .breadcrumb-folder:hover {
        color: var(--text-muted);
        cursor: default;
    }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = breadcrumbStyles;
document.head.appendChild(styleSheet);

// Export for use in other modules
window.Breadcrumb = Breadcrumb;
