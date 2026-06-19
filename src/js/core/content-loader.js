/**
 * Content Loader
 * Charge le contenu des pages dynamiquement
 */

const ContentLoader = {
    /**
     * Container du contenu
     */
    container: null,

    /**
     * Cache des pages chargées
     */
    cache: new Map(),

    /**
     * Contenu de la page d'accueil
     */
    homeContent: null,

    /**
     * Initialise le loader
     */
    init(containerId) {
        this.container = document.getElementById(containerId);
        if (this.container) {
            // Sauvegarde le contenu initial comme page d'accueil
            this.homeContent = this.container.innerHTML;
        }
    },

    /**
     * Charge une page
     */
    async load(path) {
        if (!this.container) return false;

        // Affiche un loader
        this.showLoading();

        try {
            const content = await this.fetchContent(path);
            await this.displayContent(content, path);
            return true;
        } catch (error) {
            console.error('Error loading page:', error);
            this.showError(path, error);
            return false;
        }
    },

    /**
     * Récupère le contenu d'une page
     */
    async fetchContent(path) {
        // Vérifie le cache
        if (this.cache.has(path)) {
            return this.cache.get(path);
        }

        const basePath = PathUtils.getBasePath();
        const url = basePath + path;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Page not found: ${path}`);
        }

        const html = await response.text();
        const content = this.extractContent(html);
        
        // Met en cache
        this.cache.set(path, content);
        
        return content;
    },

    /**
     * Extrait le contenu principal d'une page HTML
     */
    extractContent(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Cherche un élément avec la classe 'page-content' ou 'content'
        let content = doc.querySelector('.page-content');
        if (!content) content = doc.querySelector('.content');
        if (!content) content = doc.querySelector('main');
        if (!content) content = doc.querySelector('article');
        if (!content) content = doc.body;
        
        return content.innerHTML;
    },

    /**
     * Affiche le contenu
     */
    async displayContent(content, path) {
        // Animation de sortie
        if (SiteConfig.animations.enabled) {
            await DOMHelpers.fadeOut(this.container, 150);
        }

        // Insère le nouveau contenu
        this.container.innerHTML = `
            <div class="page-content">
                ${content}
            </div>
        `;

        // Corrige les chemins relatifs des images
        this.fixRelativePaths(path);

        // Exécute les scripts éventuels de la page (innerHTML ne les exécute pas)
        this.executeScripts(path);

        // Animation d'entrée
        if (SiteConfig.animations.enabled) {
            await DOMHelpers.fadeIn(this.container, 200);
        }

        // Scroll en haut
        this.container.scrollTop = 0;

        // Déclenche un événement
        const event = new CustomEvent('contentLoaded', {
            detail: { path: path }
        });
        document.dispatchEvent(event);
    },

    /**
     * Corrige les chemins relatifs dans le contenu
     */
    fixRelativePaths(pagePath) {
        const basePath = PathUtils.getBasePath();
        const pageDir = PathUtils.getParent(pagePath);
        
        // Images
        const images = this.container.querySelectorAll('img[src]');
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:')) {
                // Si le chemin commence par 'src/' ou 'pages/', c'est un chemin depuis la racine du site
                if (src.startsWith('src/') || src.startsWith('pages/')) {
                    img.src = basePath + src;
                } else {
                    // Sinon c'est un chemin relatif au dossier de la page
                    img.src = basePath + PathUtils.join(pageDir, src);
                }
            }
        });

        // Liens
        const links = this.container.querySelectorAll('a[href]');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('/')) {
                const fullPath = PathUtils.join(pageDir, href);
                link.href = '#' + fullPath;
                
                // Ajoute un listener pour la navigation interne
                if (PathUtils.isHtmlFile(href)) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        const event = new CustomEvent('navigate', {
                            detail: { path: fullPath }
                        });
                        document.dispatchEvent(event);
                    });
                }
            }
        });
    },

    /**
     * Réexécute les balises <script> présentes dans le contenu chargé
     * (innerHTML n'exécute pas les scripts par défaut)
     */
    executeScripts(pagePath) {
        const basePath = PathUtils.getBasePath();
        const pageDir = PathUtils.getParent(pagePath);
        const scripts = this.container.querySelectorAll('script');

        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');

            // Copie les attributs (type, etc.)
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });

            const src = oldScript.getAttribute('src');
            if (src) {
                // Corrige le chemin relatif comme pour les images
                if (!src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:')) {
                    if (src.startsWith('src/') || src.startsWith('pages/')) {
                        newScript.src = basePath + src;
                    } else {
                        newScript.src = basePath + PathUtils.join(pageDir, src);
                    }
                }
            } else {
                newScript.textContent = oldScript.textContent;
            }

            oldScript.replaceWith(newScript);
        });
    },

    /**
     * Affiche la page d'accueil
     */
    showHome() {
        if (this.container && this.homeContent) {
            this.container.innerHTML = this.homeContent;
        }
    },

    /**
     * Affiche un indicateur de chargement
     */
    showLoading() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>Chargement...</p>
            </div>
        `;
    },

    /**
     * Affiche une erreur
     */
    showError(path, error) {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <h2>Page non trouvée</h2>
                <p>La page <code>${path}</code> n'a pas pu être chargée.</p>
                <p class="error-details">${error.message}</p>
                <a href="#" class="btn btn-primary" onclick="ContentLoader.showHome(); return false;">
                    Retour à l'accueil
                </a>
            </div>
        `;
    },

    /**
     * Vide le cache
     */
    clearCache() {
        this.cache.clear();
    }
};

// Styles pour le loader et les erreurs
const loaderStyles = `
    .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 300px;
        color: var(--text-muted);
    }
    
    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--bg-tertiary);
        border-top-color: var(--text-accent);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 16px;
    }
    
    .error-container {
        text-align: center;
        padding: 48px;
    }
    
    .error-icon {
        font-size: 4rem;
        margin-bottom: 16px;
    }
    
    .error-container h2 {
        color: var(--color-error);
        margin-bottom: 16px;
    }
    
    .error-details {
        color: var(--text-muted);
        font-size: 0.875rem;
        margin-bottom: 24px;
    }
`;

const loaderStyleSheet = document.createElement('style');
loaderStyleSheet.textContent = loaderStyles;
document.head.appendChild(loaderStyleSheet);

// Export for use in other modules
window.ContentLoader = ContentLoader;
