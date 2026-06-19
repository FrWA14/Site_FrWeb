/**
 * DOM Helpers
 * Utilitaires pour la manipulation du DOM
 */

const DOMHelpers = {
    /**
     * Sélectionne un élément
     */
    $(selector, context = document) {
        return context.querySelector(selector);
    },

    /**
     * Sélectionne plusieurs éléments
     */
    $$(selector, context = document) {
        return Array.from(context.querySelectorAll(selector));
    },

    /**
     * Crée un élément avec des attributs
     */
    createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key.startsWith('data')) {
                element.setAttribute(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                element.addEventListener(key.substring(2).toLowerCase(), value);
            } else {
                element.setAttribute(key, value);
            }
        });

        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });

        return element;
    },

    /**
     * Ajoute une classe avec animation
     */
    addClass(element, className) {
        if (element && !element.classList.contains(className)) {
            element.classList.add(className);
        }
    },

    /**
     * Retire une classe
     */
    removeClass(element, className) {
        if (element) {
            element.classList.remove(className);
        }
    },

    /**
     * Toggle une classe
     */
    toggleClass(element, className) {
        if (element) {
            element.classList.toggle(className);
            return element.classList.contains(className);
        }
        return false;
    },

    /**
     * Vérifie si un élément a une classe
     */
    hasClass(element, className) {
        return element && element.classList.contains(className);
    },

    /**
     * Vide le contenu d'un élément
     */
    empty(element) {
        if (element) {
            element.innerHTML = '';
        }
    },

    /**
     * Insère du HTML
     */
    setHTML(element, html) {
        if (element) {
            element.innerHTML = html;
        }
    },

    /**
     * Anime l'apparition d'un élément
     */
    fadeIn(element, duration = 250) {
        if (!element) return Promise.resolve();
        
        element.style.opacity = '0';
        element.style.display = 'block';
        
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                element.style.transition = `opacity ${duration}ms ease`;
                element.style.opacity = '1';
                setTimeout(resolve, duration);
            });
        });
    },

    /**
     * Anime la disparition d'un élément
     */
    fadeOut(element, duration = 250) {
        if (!element) return Promise.resolve();
        
        return new Promise(resolve => {
            element.style.transition = `opacity ${duration}ms ease`;
            element.style.opacity = '0';
            setTimeout(() => {
                element.style.display = 'none';
                resolve();
            }, duration);
        });
    }
};

// Export for use in other modules
window.DOMHelpers = DOMHelpers;
