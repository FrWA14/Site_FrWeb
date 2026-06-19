/**
 * Router
 * Gestion du routage basé sur le hash
 */

const Router = {
    /**
     * Route actuelle
     */
    currentRoute: null,

    /**
     * Historique des routes
     */
    history: [],

    /**
     * Initialise le router
     */
    init() {
        // Écoute les changements de hash
        window.addEventListener('hashchange', () => this.handleHashChange());
        
        // Écoute les événements de navigation personnalisés
        document.addEventListener('navigate', (e) => this.navigate(e.detail));
        
        // Charge la route initiale
        this.handleHashChange();
    },

    /**
     * Gère le changement de hash
     */
    handleHashChange() {
        const hash = window.location.hash.slice(1); // Retire le #
        
        if (hash) {
            this.loadRoute(hash);
        } else {
            this.loadHome();
        }
    },

    /**
     * Navigue vers une route
     */
    navigate(detail) {
        if (detail.isHome) {
            this.loadHome();
            window.location.hash = '';
            return;
        }
        
        if (detail.path) {
            window.location.hash = detail.path;
        }
    },

    /**
     * Charge une route
     */
    async loadRoute(path) {
        if (this.currentRoute === path) return;
        
        // Sauvegarde dans l'historique
        if (this.currentRoute) {
            this.history.push(this.currentRoute);
        }
        
        this.currentRoute = path;
        
        // Met à jour la navigation
        TreeRenderer.setActivePath(path);
        
        // Met à jour le breadcrumb
        Breadcrumb.update(path);
        
        // Charge le contenu
        await ContentLoader.load(path);
        
        // Sauvegarde la dernière page
        this.saveLastPage(path);
        
        // Met à jour le titre
        this.updateTitle(path);
    },

    /**
     * Charge la page d'accueil
     */
    loadHome() {
        this.currentRoute = null;
        
        // Clear navigation active
        const activeLink = document.querySelector('.nav-link.active');
        if (activeLink) {
            DOMHelpers.removeClass(activeLink, 'active');
        }
        
        // Clear breadcrumb
        Breadcrumb.clear();
        
        // Affiche le contenu d'accueil
        ContentLoader.showHome();
        
        // Reset title
        document.title = SiteConfig.siteName;
    },

    /**
     * Met à jour le titre de la page
     */
    updateTitle(path) {
        const pageName = PathUtils.pathToTitle(path);
        document.title = `${pageName} - ${SiteConfig.siteName}`;
    },

    /**
     * Retourne à la page précédente
     */
    back() {
        if (this.history.length > 0) {
            const previousPath = this.history.pop();
            window.location.hash = previousPath;
        } else {
            this.loadHome();
            window.location.hash = '';
        }
    },

    /**
     * Sauvegarde la dernière page visitée
     */
    saveLastPage(path) {
        try {
            localStorage.setItem(SiteConfig.storageKeys.lastPage, path);
        } catch (e) {
            // Ignore storage errors
        }
    },

    /**
     * Récupère la dernière page visitée
     */
    getLastPage() {
        try {
            return localStorage.getItem(SiteConfig.storageKeys.lastPage);
        } catch (e) {
            return null;
        }
    },

    /**
     * Génère un lien vers une page
     */
    createLink(path, text, className = '') {
        const link = DOMHelpers.createElement('a', {
            href: '#' + path,
            className: className,
            textContent: text || PathUtils.pathToTitle(path)
        });
        
        return link;
    }
};

// Export for use in other modules
window.Router = Router;
