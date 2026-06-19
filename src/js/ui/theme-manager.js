/**
 * Theme Manager
 * Gestion des thèmes (sombre/clair/cyan)
 */

const ThemeManager = {
    /**
     * Thème actuel
     */
    currentTheme: 'cyan',

    /**
     * Thèmes disponibles avec leurs labels
     */
    themes: {
        dark: 'Sombre',
        light: 'Clair',
        cyan: 'Cyan'
    },

    /**
     * Éléments DOM
     */
    elements: {
        button: null,
        dropdown: null,
        options: null,
        label: null,
        icon: null
    },

    /**
     * Initialise le theme manager
     */
    init() {
        // Charge le thème sauvegardé
        this.loadTheme();
        
        // Applique le thème
        this.applyTheme(this.currentTheme);
        
        // Initialise les éléments du dropdown
        this.initDropdown();
    },

    /**
     * Initialise le dropdown de thème
     */
    initDropdown() {
        this.elements.button = document.querySelector('.theme-btn');
        this.elements.dropdown = document.querySelector('.theme-dropdown');
        this.elements.options = document.querySelectorAll('.theme-option');
        this.elements.label = document.getElementById('theme-label');
        this.elements.icon = document.getElementById('theme-icon');

        if (!this.elements.button || !this.elements.dropdown) {
            return;
        }

        // Toggle du dropdown au clic sur le bouton
        this.elements.button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        // Sélection d'un thème
        this.elements.options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const theme = option.dataset.theme;
                this.setTheme(theme);
                this.closeDropdown();
            });
        });

        // Ferme le dropdown au clic ailleurs
        document.addEventListener('click', () => {
            this.closeDropdown();
        });

        // Ferme le dropdown avec Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDropdown();
            }
        });

        // Met à jour l'état actif et le label
        this.updateActiveOption();
        this.updateButtonLabel();
    },

    /**
     * Ouvre/ferme le dropdown
     */
    toggleDropdown() {
        if (this.elements.dropdown) {
            this.elements.dropdown.classList.toggle('active');
        }
    },

    /**
     * Ferme le dropdown
     */
    closeDropdown() {
        if (this.elements.dropdown) {
            this.elements.dropdown.classList.remove('active');
        }
    },

    /**
     * Met à jour l'option active dans le dropdown
     */
    updateActiveOption() {
        this.elements.options.forEach(option => {
            const isActive = option.dataset.theme === this.currentTheme;
            option.classList.toggle('active', isActive);
        });
    },

    /**
     * Met à jour le label et l'icône du bouton
     */
    updateButtonLabel() {
        const icons = {
            dark: '☾',
            light: '☀',
            cyan: '❄'
        };

        if (this.elements.label) {
            this.elements.label.textContent = this.themes[this.currentTheme];
        }
        
        if (this.elements.icon) {
            this.elements.icon.textContent = icons[this.currentTheme] || '☾';
        }
    },

    /**
     * Cycle entre les thèmes
     */
    toggle() {
        const themeKeys = Object.keys(this.themes);
        const currentIndex = themeKeys.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themeKeys.length;
        this.setTheme(themeKeys[nextIndex]);
    },

    /**
     * Définit un thème
     */
    setTheme(theme) {
        if (!this.themes[theme]) {
            console.warn('Unknown theme:', theme);
            return;
        }
        
        this.currentTheme = theme;
        this.applyTheme(theme);
        this.saveTheme(theme);
        this.updateActiveOption();
        this.updateButtonLabel();
    },

    /**
     * Applique un thème
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Déclenche un événement
        const event = new CustomEvent('themeChange', {
            detail: { theme: theme }
        });
        document.dispatchEvent(event);
    },

    /**
     * Sauvegarde le thème
     */
    saveTheme(theme) {
        try {
            localStorage.setItem(SiteConfig.storageKeys.theme, theme);
        } catch (e) {
            // Ignore storage errors
        }
    },

    /**
     * Charge le thème sauvegardé
     */
    loadTheme() {
        try {
            const saved = localStorage.getItem(SiteConfig.storageKeys.theme);
            if (saved && this.themes[saved]) {
                this.currentTheme = saved;
            }
        } catch (e) {
            // Use default theme
        }
    },

    /**
     * Obtient le thème actuel
     */
    getTheme() {
        return this.currentTheme;
    },

    /**
     * Obtient le label du thème actuel
     */
    getThemeLabel() {
        return this.themes[this.currentTheme] || 'Sombre';
    },

    /**
     * Vérifie si le thème est dark
     */
    isDark() {
        return this.currentTheme === 'dark' || this.currentTheme === 'cyan';
    }
};

// Export for use in other modules
window.ThemeManager = ThemeManager;
