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
        
        const segments = PathUtils.getBreadcrumb(path);
        
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
        const isLast = segment.isLast;
        
        if (isLast) {
            return DOMHelpers.createElement('span', {
                className: 'breadcrumb-item breadcrumb-current',
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
    }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = breadcrumbStyles;
document.head.appendChild(styleSheet);

// Export for use in other modules
window.Breadcrumb = Breadcrumb;
