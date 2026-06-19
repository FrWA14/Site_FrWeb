/**
 * Path Utilities
 * Utilitaires pour la gestion des chemins
 */

const PathUtils = {
    /**
     * Obtient le chemin de base du site
     */
    getBasePath() {
        // Récupère le chemin de l'URL actuelle
        const path = window.location.pathname;
        
        // Pour le protocole file:// (ouverture locale)
        if (window.location.protocol === 'file:') {
            // Extrait le dossier contenant index.html
            const lastSlash = path.lastIndexOf('/');
            return path.substring(0, lastSlash + 1);
        }
        
        // Pour GitHub Pages (username.github.io/repo)
        if (window.location.hostname.includes('github.io')) {
            const parts = path.split('/').filter(p => p);
            if (parts.length > 0) {
                return '/' + parts[0] + '/';
            }
        }
        
        // Pour un serveur local ou autre
        // Trouve le dossier contenant index.html
        const indexPos = path.indexOf('/index.html');
        if (indexPos !== -1) {
            return path.substring(0, indexPos + 1);
        }
        
        // Sinon, utilise le chemin actuel
        if (path.endsWith('/')) {
            return path;
        }
        
        const lastSlash = path.lastIndexOf('/');
        return lastSlash !== -1 ? path.substring(0, lastSlash + 1) : '/';
    },

    /**
     * Normalise un chemin
     */
    normalize(path) {
        return path
            .replace(/\\/g, '/')
            .replace(/\/+/g, '/')
            .replace(/\/$/, '');
    },

    /**
     * Joint des segments de chemin
     */
    join(...segments) {
        return this.normalize(segments.join('/'));
    },

    /**
     * Obtient le nom du fichier sans extension
     */
    getFileName(path) {
        const parts = path.split('/');
        const fileName = parts[parts.length - 1];
        return fileName.replace(/\.[^.]+$/, '');
    },

    /**
     * Obtient l'extension du fichier
     */
    getExtension(path) {
        const match = path.match(/\.[^.]+$/);
        return match ? match[0].toLowerCase() : '';
    },

    /**
     * Obtient le dossier parent
     */
    getParent(path) {
        const normalized = this.normalize(path);
        const parts = normalized.split('/');
        parts.pop();
        return parts.join('/') || '/';
    },

    /**
     * Vérifie si c'est un fichier HTML
     */
    isHtmlFile(path) {
        const ext = this.getExtension(path);
        return SiteConfig.supportedExtensions.includes(ext);
    },

    /**
     * Convertit un chemin en titre lisible
     */
    pathToTitle(path) {
        const fileName = this.getFileName(path);
        
        // Vérifie si on a un nom personnalisé
        if (SiteConfig.displayNames[fileName.toLowerCase()]) {
            return SiteConfig.displayNames[fileName.toLowerCase()];
        }
        
        // Convertit kebab-case ou snake_case en Title Case
        return fileName
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    },

    /**
     * Génère un ID unique depuis un chemin
     */
    pathToId(path) {
        return this.normalize(path)
            .replace(/[^a-zA-Z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    },

    /**
     * Obtient les segments du chemin
     */
    getSegments(path) {
        return this.normalize(path)
            .split('/')
            .filter(s => s.length > 0);
    },

    /**
     * Construit le breadcrumb depuis un chemin
     */
    getBreadcrumb(path) {
        const segments = this.getSegments(path);
        const breadcrumb = [];
        let currentPath = '';
        
        segments.forEach((segment, index) => {
            currentPath += '/' + segment;
            breadcrumb.push({
                name: this.pathToTitle(segment),
                path: currentPath,
                isLast: index === segments.length - 1
            });
        });
        
        return breadcrumb;
    },

    /**
     * Vérifie si un chemin doit être exclu
     */
    shouldExclude(path) {
        const fileName = path.split('/').pop();
        return SiteConfig.excludePatterns.some(pattern => {
            if (pattern.startsWith('.')) {
                return fileName.startsWith(pattern);
            }
            return fileName.toLowerCase() === pattern.toLowerCase() ||
                   fileName.startsWith(pattern);
        });
    }
};

// Export for use in other modules
window.PathUtils = PathUtils;
