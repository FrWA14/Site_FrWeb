/**
 * Site Configuration
 * Configuration centrale du site
 */

const SiteConfig = {
    // Nom du site
    siteName: 'FrWA Conception',
    
    // Dossier contenant les pages
    pagesFolder: 'pages',
    
    // Extensions de fichiers supportées
    supportedExtensions: ['.html', '.htm'],
    
    // Fichier index par défaut dans les dossiers
    indexFile: 'index.html',
    
    // Exclure ces fichiers/dossiers de la navigation
    excludePatterns: [
        'assets',
        '_',
        '.'
    ],
    
    // Ordre de priorité des fichiers (index en premier)
    priorityFiles: ['index.html', 'readme.html', 'home.html'],
    
    // Icônes par type de fichier/dossier
    icons: {
        folder: '📁',
        folderOpen: '📂',
        file: '📄',
        home: '🏠',
        docs: '📚',
        api: '⚡',
        guide: '📖',
        example: '💡',
        config: '⚙️'
    },
    
    // Mapping de noms pour affichage
    displayNames: {
        'docs': 'Documentation',
        'api': 'API Reference',
        'guide': 'Guides',
        'examples': 'Exemples',
        'tutorials': 'Tutoriels'
    },
    
    // Animation settings
    animations: {
        enabled: true,
        duration: 250
    },
    
    // Local storage keys
    storageKeys: {
        openFolders: 'frwa_open_folders',
        lastPage: 'frwa_last_page',
        theme: 'frwa_theme'
    }
};

// Freeze config to prevent modifications
Object.freeze(SiteConfig);
Object.freeze(SiteConfig.icons);
Object.freeze(SiteConfig.displayNames);
Object.freeze(SiteConfig.animations);
Object.freeze(SiteConfig.storageKeys);
