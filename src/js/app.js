/**
 * App - Point d'entrée principal
 * Initialise tous les modules de l'application
 */

const App = {
    /**
     * État de l'application
     */
    initialized: false,

    /**
     * Initialise l'application
     */
    async init() {
        if (this.initialized) return;
        
        console.log('🚀 Initializing FrWA Site...');
        
        try {
            // Initialise les composants UI
            this.initUI();
            
            // Charge la structure de navigation
            await this.initNavigation();
            
            // Initialise le router
            this.initRouter();
            
            this.initialized = true;
            console.log('✅ FrWA Site initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing app:', error);
            this.showInitError(error);
        }
    },

    /**
     * Initialise les composants UI
     */
    initUI() {
        // Theme manager
        ThemeManager.init();
        
        // Sidebar toggle (mobile)
        SidebarToggle.init();
        
        // Content loader
        ContentLoader.init('content-body');
        
        // Breadcrumb
        Breadcrumb.init('breadcrumb');
        
        // Tree renderer
        TreeRenderer.init('nav-tree');
        
        // Lightbox pour les galeries
        Lightbox.init();
    },

    /**
     * Initialise la navigation
     */
    async initNavigation() {
        // Charge la structure
        let tree = await TreeBuilder.loadStructure();
        
        // Applique l'état des dossiers ouverts
        tree = TreeRenderer.applyOpenFolders(tree);
        
        // Rend l'arbre
        TreeRenderer.render(tree);
    },

    /**
     * Initialise le router
     */
    initRouter() {
        Router.init();
    },

    /**
     * Affiche une erreur d'initialisation
     */
    showInitError(error) {
        const container = document.getElementById('content-body');
        if (container) {
            container.innerHTML = `
                <div class="error-container">
                    <div class="error-icon">❌</div>
                    <h2>Erreur d'initialisation</h2>
                    <p>L'application n'a pas pu démarrer correctement.</p>
                    <p class="error-details">${error.message}</p>
                    <button class="btn btn-primary" onclick="location.reload()">
                        Réessayer
                    </button>
                </div>
            `;
        }
    },

    /**
     * Recharge la navigation
     */
    async refreshNavigation() {
        await this.initNavigation();
    },

    /**
     * Obtient la version de l'app
     */
    getVersion() {
        return '1.0.0';
    }
};

// Démarre l'application quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export pour accès global
window.App = App;
