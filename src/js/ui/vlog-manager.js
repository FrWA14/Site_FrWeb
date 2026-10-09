/**
 * Vlog Manager
 * Charge et affiche les mises à jour depuis src/assets/data/vlog.json
 * dans la section .home-updates de la page d'accueil.
 *
 * Appelé par App.initUI() — PathUtils est donc disponible.
 */

const VlogManager = {
    MAX_ENTRIES: 5,

    /**
     * Formate une date ISO en { day, month, year } en français
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        const day  = date.getDate().toString().padStart(2, '0');
        const year = date.getFullYear();
        // toLocaleDateString retourne p.ex "juin" ; on met la première lettre en majuscule
        const month = date.toLocaleDateString('fr-FR', { month: 'short' })
            .replace('.', '')
            .replace(/^\w/, c => c.toUpperCase());
        return { day, month, year };
    },

    /**
     * Échappe le texte pour l'insérer sans risque dans du HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Génère le HTML d'un item de mise à jour
     */
    buildItem(entry) {
        const { day, month, year } = this.formatDate(entry.date);
        return `
            <div class="update-item">
                <div class="update-date">
                    <span class="update-day">${day}</span>
                    <span class="update-month">${month}</span>
                    <span class="update-year">${year}</span>
                </div>
                <div class="update-content">
                    <h4>${this.escapeHtml(entry.title || 'Mise à jour')}</h4>
                    ${entry.message ? `<p>${this.escapeHtml(entry.message)}</p>` : ''}
                </div>
            </div>`;
    },

    /**
     * Initialise l'affichage du vlog dans le container donné.
     * Le chemin vers vlog.json est résolu depuis la racine du site via PathUtils.
     */
    async init(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            // PathUtils est disponible ici car App.initUI() est appelé après le chargement des scripts
            const basePath = PathUtils.getBasePath();
            const url = basePath + 'src/assets/data/vlog.json?t=' + Date.now();

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status} - ${url}`);

            const data = await response.json();
            const entries = data.slice(0, this.MAX_ENTRIES);

            if (entries.length === 0) {
                container.innerHTML = `
                    <div class="update-item">
                        <div class="update-content">
                            <h4>Aucune mise à jour disponible</h4>
                        </div>
                    </div>`;
                return;
            }

            container.innerHTML = entries.map(e => this.buildItem(e)).join('');

        } catch (err) {
            console.error('[VlogManager]', err);
            container.innerHTML = `
                <div class="update-item">
                    <div class="update-content">
                        <h4>Mises à jour non disponibles</h4>
                        <p>Impossible de charger le journal des mises à jour.</p>
                    </div>
                </div>`;
        }
    }
};

window.VlogManager = VlogManager;
