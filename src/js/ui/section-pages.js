/**
 * Section Pages
 * Rend chaque page autonome vis-à-vis de sa section :
 *   - <a data-retour></a> : lien de retour calculé à partir du dossier parent
 *   - <div data-cartes-auto></div> : cartes des pages de la section, construites
 *     à partir des balises <meta> de chaque page (titre, description, tags, vignette)
 * Déplacer ou copier un dossier de page ne demande donc que de relancer
 * generate-navigation.sh.
 */

const SectionPages = {
    /**
     * Métadonnées déjà lues (chemin de page -> carte)
     */
    cache: new Map(),

    /**
     * Couleurs des badges, dans l'ordre des tags
     */
    badgeClasses: ['badge-primary', 'badge-secondary', 'badge-accent'],

    init() {
        document.addEventListener('contentLoaded', (e) => this.apply(e.detail.path));
    },

    /**
     * Appelé après l'affichage de chaque page
     */
    apply(path) {
        const container = ContentLoader.container;
        if (!container || !path) return;

        container.querySelectorAll('[data-retour]').forEach(link => this.fillBackLink(link, path));
        container.querySelectorAll('[data-cartes-auto]').forEach(grid => this.fillCards(grid, path));
    },

    /**
     * Lien de retour : page principale du dossier parent, sinon l'accueil
     */
    async fillBackLink(link, path) {
        const pageDir = PathUtils.getParent(path);
        const parentDir = PathUtils.getParent(pageDir);
        const target = parentDir.startsWith('pages/') ? TreeBuilder.getFolderPage(parentDir) : null;
        const customText = link.textContent.trim() !== '';

        const setLabel = label => {
            if (!customText) link.textContent = '← ' + label;
            link.setAttribute('title', label);
        };

        if (target) {
            link.setAttribute('href', '#' + target.path);
            setLabel('Retour à ' + this.cleanTitle(target.displayName));
            // Titre exact (accents compris) lu dans le <title> de la page de section
            const card = await this.readCard(target);
            setLabel('Retour à ' + card.title);
        } else {
            setLabel("Retour à l'accueil");
            link.setAttribute('href', '#');
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.dispatchEvent(new CustomEvent('navigate', { detail: { isHome: true } }));
            });
        }
    },

    /**
     * Cartes : une par sous-dossier de la section qui contient une page principale.
     * Les éléments déjà présents dans la grille (ex : carte « à venir ») restent à la fin.
     */
    async fillCards(grid, path) {
        const sectionDir = PathUtils.getParent(path);
        const section = TreeBuilder.findRawItem(sectionDir);
        const folders = (section && section.children || []).filter(child => child.type === 'folder');
        const pages = folders
            .map(folder => TreeBuilder.getFolderPage(folder.path))
            .filter(page => page);

        const cards = await Promise.all(pages.map(page => this.readCard(page)));

        // L'utilisateur a pu changer de page pendant le chargement
        if (!grid.isConnected) return;

        const first = grid.firstChild;
        cards.forEach(card => grid.insertBefore(this.renderCard(card), first));
    },

    /**
     * Lit les métadonnées d'une page (sans l'afficher)
     */
    async readCard(page) {
        if (this.cache.has(page.path)) return this.cache.get(page.path);

        const card = {
            path: page.path,
            title: this.cleanTitle(page.displayName),
            description: '',
            tags: [],
            image: null
        };

        try {
            const response = await fetch(PathUtils.getBasePath() + page.path);
            if (!response.ok) throw new Error(response.status);
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            const meta = name => {
                const el = doc.querySelector(`meta[name="${name}"]`);
                return el ? el.getAttribute('content').trim() : '';
            };

            const docTitle = doc.title.replace(/\s*-\s*FrWA Conception\s*$/i, '').trim();
            const bannerTitle = doc.querySelector('.page-banner-title');
            card.title = docTitle || (bannerTitle && bannerTitle.textContent.trim()) || card.title;
            card.description = meta('description');
            card.tags = meta('tags').split(',').map(tag => tag.trim()).filter(tag => tag);

            // Vignette : <meta name="vignette">, sinon l'image de la bannière
            const bannerImg = doc.querySelector('.page-banner img');
            const image = meta('vignette') || (bannerImg && bannerImg.getAttribute('src'));
            if (image) card.image = ContentLoader.resolvePath(image, PathUtils.getParent(page.path));
        } catch (error) {
            console.warn('Carte incomplète pour', page.path, error);
        }

        this.cache.set(page.path, card);
        return card;
    },

    /**
     * Construit le HTML d'une carte (même rendu que les anciennes cartes écrites à la main)
     */
    renderCard(card) {
        const link = DOMHelpers.createElement('a', {
            className: 'project-card',
            href: '#' + card.path
        });

        link.appendChild(this.renderImage(card));

        const content = DOMHelpers.createElement('div', { className: 'project-card-content' });
        content.appendChild(DOMHelpers.createElement('h3', {
            className: 'project-card-title',
            textContent: card.title
        }));

        if (card.description) {
            content.appendChild(DOMHelpers.createElement('p', {
                className: 'project-card-description',
                textContent: card.description
            }));
        }

        if (card.tags.length) {
            const tags = DOMHelpers.createElement('div', { className: 'project-card-tags' });
            card.tags.forEach((tag, index) => {
                tags.appendChild(DOMHelpers.createElement('span', {
                    className: 'badge ' + this.badgeClasses[index % this.badgeClasses.length],
                    textContent: tag
                }));
            });
            content.appendChild(tags);
        }

        link.appendChild(content);
        return link;
    },

    /**
     * Vignette, ou un cadre neutre si l'image manque ou ne se charge pas
     */
    renderImage(card) {
        const placeholder = () => {
            const box = DOMHelpers.createElement('div', { className: 'project-card-image project-card-placeholder' });
            box.textContent = '📄';
            return box;
        };

        if (!card.image) return placeholder();

        const img = DOMHelpers.createElement('img', {
            className: 'project-card-image',
            src: card.image,
            alt: card.title,
            loading: 'lazy'
        });
        img.addEventListener('error', () => img.replaceWith(placeholder()), { once: true });
        return img;
    },

    /**
     * "Ne555 Astable - FrWA Conception" -> "Ne555 Astable"
     */
    cleanTitle(title) {
        return (title || '').replace(/\s*-\s*FrWA Conception\s*$/i, '').trim();
    }
};

const sectionPagesStyles = `
    .project-grid[data-cartes-auto]:empty {
        display: none;
    }

    .project-card-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 3rem;
        background: var(--bg-tertiary);
    }
`;

const sectionPagesStyleSheet = document.createElement('style');
sectionPagesStyleSheet.textContent = sectionPagesStyles;
document.head.appendChild(sectionPagesStyleSheet);

window.SectionPages = SectionPages;
