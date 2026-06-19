/**
 * Tree Builder
 * Construit l'arborescence de navigation depuis la structure des fichiers
 */

const TreeBuilder = {
    /**
     * Structure de données pour un nœud de l'arbre
     */
    createNode(name, path, type = 'file', level = 0) {
        return {
            name: name,
            displayName: PathUtils.pathToTitle(name),
            path: path,
            type: type, // 'file' ou 'folder'
            level: level,
            children: [],
            isOpen: false,
            id: PathUtils.pathToId(path)
        };
    },

    /**
     * Charge la structure depuis navigation.json
     */
    async loadStructure() {
        try {
            const basePath = PathUtils.getBasePath();
            const url = basePath + 'navigation.json';
            console.log('Loading navigation from:', url);
            
            const response = await fetch(url, { cache: 'no-cache' });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Navigation loaded successfully');
                return this.buildTreeFromJson(data);
            } else {
                console.warn('navigation.json not found');
                return this.getFallbackStructure();
            }
        } catch (error) {
            console.error('Error loading navigation:', error.message);
            return this.getFallbackStructure();
        }
    },

    /**
     * Construit l'arbre depuis les données JSON
     */
    buildTreeFromJson(data, level = 0) {
        const nodes = [];
        
        let items = [];
        
        if (Array.isArray(data)) {
            items = data;
        } else if (data && data.children) {
            items = Array.isArray(data.children) ? data.children : [data.children];
        }
        
        items.forEach(item => {
            if (item) {
                const node = this.processItem(item, level);
                if (node) nodes.push(node);
            }
        });
        
        return this.sortNodes(nodes);
    },

    /**
     * Traite un item du JSON
     */
    processItem(item, level) {
        // Vérifie si l'item doit être exclu
        if (PathUtils.shouldExclude(item.name || item.path)) {
            return null;
        }

        const isFolder = item.type === 'folder' || item.children;
        const node = this.createNode(
            item.name,
            item.path || item.name,
            isFolder ? 'folder' : 'file',
            level
        );

        // Surcharge du nom d'affichage si spécifié
        if (item.displayName) {
            node.displayName = item.displayName;
        }

        // Icône personnalisée
        if (item.icon) {
            node.icon = item.icon;
        }

        // Traite les enfants récursivement
        if (item.children) {
            const childrenArray = Array.isArray(item.children) ? item.children : [item.children];
            node.children = this.buildTreeFromJson(childrenArray, level + 1);
        }

        return node;
    },

    /**
     * Trie les nœuds (garde l'ordre du JSON qui est déjà trié par le script PowerShell)
     * Fichiers en premier, puis dossiers
     */
    sortNodes(nodes) {
        // L'ordre est déjà défini dans navigation.json par le script PowerShell
        // On ne re-trie pas pour respecter cet ordre (fichiers avant dossiers)
        return nodes;
    },

    /**
     * Structure de fallback si navigation.json n'existe pas
     */
    getFallbackStructure() {
        return [
            this.createNode('index.html', 'pages/index.html', 'file', 0)
        ];
    },

    /**
     * Trouve un nœud par son chemin
     */
    findNodeByPath(nodes, path) {
        for (const node of nodes) {
            if (node.path === path) {
                return node;
            }
            if (node.children && node.children.length > 0) {
                const found = this.findNodeByPath(node.children, path);
                if (found) return found;
            }
        }
        return null;
    },

    /**
     * Obtient tous les chemins des parents d'un nœud
     */
    getParentPaths(nodes, targetPath, currentPath = []) {
        for (const node of nodes) {
            if (node.path === targetPath) {
                return currentPath;
            }
            if (node.children && node.children.length > 0) {
                const result = this.getParentPaths(
                    node.children, 
                    targetPath, 
                    [...currentPath, node.path]
                );
                if (result) return result;
            }
        }
        return null;
    },

    /**
     * Aplatit l'arbre en liste
     */
    flatten(nodes, result = []) {
        nodes.forEach(node => {
            result.push(node);
            if (node.children && node.children.length > 0) {
                this.flatten(node.children, result);
            }
        });
        return result;
    }
};

// Export for use in other modules
window.TreeBuilder = TreeBuilder;
