/**
 * Sidebar Toggle
 * Gestion de l'ouverture/fermeture de la sidebar sur mobile
 */

const SidebarToggle = {
    /**
     * Éléments DOM
     */
    sidebar: null,
    toggleBtn: null,
    overlay: null,

    /**
     * État
     */
    isOpen: false,

    /**
     * Initialise le toggle
     */
    init() {
        this.sidebar = document.getElementById('sidebar');
        this.toggleBtn = document.getElementById('sidebar-toggle');
        
        if (!this.sidebar || !this.toggleBtn) {
            console.warn('Sidebar elements not found');
            return;
        }

        // Crée l'overlay
        this.createOverlay();
        
        // Event listeners
        this.toggleBtn.addEventListener('click', () => this.toggle());
        
        // Ferme la sidebar quand on navigue (mobile)
        document.addEventListener('navigate', () => {
            if (window.innerWidth <= 768 && this.isOpen) {
                this.close();
            }
        });

        // Gère le resize
        window.addEventListener('resize', () => this.handleResize());
    },

    /**
     * Crée l'overlay de fond
     */
    createOverlay() {
        this.overlay = DOMHelpers.createElement('div', {
            className: 'sidebar-overlay'
        });
        
        this.overlay.addEventListener('click', () => this.close());
        
        document.body.appendChild(this.overlay);

        // Styles de l'overlay
        const styles = `
            .sidebar-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: calc(var(--z-sidebar) - 1);
                opacity: 0;
                visibility: hidden;
                transition: all var(--transition-normal);
            }
            
            .sidebar-overlay.visible {
                opacity: 1;
                visibility: visible;
            }
        `;
        
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    },

    /**
     * Toggle la sidebar
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    /**
     * Ouvre la sidebar
     */
    open() {
        this.isOpen = true;
        DOMHelpers.addClass(this.sidebar, 'open');
        DOMHelpers.addClass(this.toggleBtn, 'active');
        DOMHelpers.addClass(this.overlay, 'visible');
        document.body.style.overflow = 'hidden';
    },

    /**
     * Ferme la sidebar
     */
    close() {
        this.isOpen = false;
        DOMHelpers.removeClass(this.sidebar, 'open');
        DOMHelpers.removeClass(this.toggleBtn, 'active');
        DOMHelpers.removeClass(this.overlay, 'visible');
        document.body.style.overflow = '';
    },

    /**
     * Gère le resize de la fenêtre
     */
    handleResize() {
        // Ferme automatiquement sur desktop
        if (window.innerWidth > 768 && this.isOpen) {
            this.close();
        }
    }
};

// Export for use in other modules
window.SidebarToggle = SidebarToggle;
