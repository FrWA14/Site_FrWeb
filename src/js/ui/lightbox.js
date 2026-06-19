/**
 * Lightbox - Système de popup pour agrandir les images
 */

const Lightbox = {
    /**
     * Élément de la lightbox
     */
    element: null,
    
    /**
     * Image courante
     */
    currentImage: null,
    
    /**
     * Liste des images de la galerie courante
     */
    galleryImages: [],
    
    /**
     * Index de l'image courante
     */
    currentIndex: 0,

    /**
     * Initialise la lightbox
     */
    init() {
        this.createLightbox();
        this.bindEvents();
    },

    /**
     * Crée les éléments HTML de la lightbox
     */
    createLightbox() {
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.id = 'lightbox';
        lightbox.innerHTML = `
            <div class="lightbox-overlay"></div>
            <div class="lightbox-content">
                <button class="lightbox-close" title="Fermer (Échap)">&times;</button>
                <button class="lightbox-prev" title="Précédent (←)">&#10094;</button>
                <button class="lightbox-next" title="Suivant (→)">&#10095;</button>
                <div class="lightbox-image-container">
                    <img class="lightbox-image" src="" alt="">
                </div>
                <div class="lightbox-caption"></div>
                <div class="lightbox-counter"></div>
            </div>
        `;
        document.body.appendChild(lightbox);
        this.element = lightbox;
    },

    /**
     * Attache les événements
     */
    bindEvents() {
        // Fermer avec le bouton X
        this.element.querySelector('.lightbox-close').addEventListener('click', () => this.close());
        
        // Fermer en cliquant sur l'overlay
        this.element.querySelector('.lightbox-overlay').addEventListener('click', () => this.close());
        
        // Navigation
        this.element.querySelector('.lightbox-prev').addEventListener('click', (e) => {
            e.stopPropagation();
            this.prev();
        });
        this.element.querySelector('.lightbox-next').addEventListener('click', (e) => {
            e.stopPropagation();
            this.next();
        });
        
        // Clavier
        document.addEventListener('keydown', (e) => {
            if (!this.element.classList.contains('active')) return;
            
            switch (e.key) {
                case 'Escape':
                    this.close();
                    break;
                case 'ArrowLeft':
                    this.prev();
                    break;
                case 'ArrowRight':
                    this.next();
                    break;
            }
        });

        // Attacher aux images de galerie (délégation)
        document.addEventListener('click', (e) => {
            const galleryItem = e.target.closest('.gallery-item');
            if (galleryItem) {
                e.preventDefault();
                this.openFromGallery(galleryItem);
            }
        });

        // Observer les changements de contenu pour les nouvelles galeries
        document.addEventListener('contentLoaded', () => {
            this.setupGalleryImages();
        });
    },

    /**
     * Configure les images de galerie
     */
    setupGalleryImages() {
        const galleryItems = document.querySelectorAll('.gallery-item');
        galleryItems.forEach(item => {
            item.style.cursor = 'pointer';
        });
    },

    /**
     * Ouvre la lightbox depuis un élément de galerie
     */
    openFromGallery(galleryItem) {
        // Trouver toutes les images de la même galerie
        const gallery = galleryItem.closest('.gallery-with-captions, .gallery-grid, .project-gallery');
        if (gallery) {
            const items = gallery.querySelectorAll('.gallery-item');
            this.galleryImages = Array.from(items).map(item => {
                const img = item.querySelector('img');
                const caption = item.querySelector('.gallery-item-caption');
                return {
                    src: img ? img.src : '',
                    alt: img ? img.alt : '',
                    caption: caption ? caption.textContent : (img ? img.alt : '')
                };
            });
            this.currentIndex = Array.from(items).indexOf(galleryItem);
        } else {
            // Image seule
            const img = galleryItem.querySelector('img');
            const caption = galleryItem.querySelector('.gallery-item-caption');
            this.galleryImages = [{
                src: img ? img.src : '',
                alt: img ? img.alt : '',
                caption: caption ? caption.textContent : (img ? img.alt : '')
            }];
            this.currentIndex = 0;
        }

        this.showImage(this.currentIndex);
        this.open();
    },

    /**
     * Affiche une image
     */
    showImage(index) {
        if (index < 0 || index >= this.galleryImages.length) return;
        
        this.currentIndex = index;
        const imageData = this.galleryImages[index];
        
        const img = this.element.querySelector('.lightbox-image');
        const caption = this.element.querySelector('.lightbox-caption');
        const counter = this.element.querySelector('.lightbox-counter');
        
        // Fade out
        img.style.opacity = '0';
        
        setTimeout(() => {
            img.src = imageData.src;
            img.alt = imageData.alt;
            caption.textContent = imageData.caption;
            
            if (this.galleryImages.length > 1) {
                counter.textContent = `${index + 1} / ${this.galleryImages.length}`;
                counter.style.display = 'block';
            } else {
                counter.style.display = 'none';
            }
            
            // Fade in
            img.style.opacity = '1';
        }, 150);

        // Afficher/cacher les boutons de navigation
        const prevBtn = this.element.querySelector('.lightbox-prev');
        const nextBtn = this.element.querySelector('.lightbox-next');
        
        if (this.galleryImages.length <= 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        } else {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
        }
    },

    /**
     * Ouvre la lightbox
     */
    open() {
        this.element.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    /**
     * Ferme la lightbox
     */
    close() {
        this.element.classList.remove('active');
        document.body.style.overflow = '';
    },

    /**
     * Image précédente
     */
    prev() {
        if (this.galleryImages.length <= 1) return;
        const newIndex = this.currentIndex === 0 ? this.galleryImages.length - 1 : this.currentIndex - 1;
        this.showImage(newIndex);
    },

    /**
     * Image suivante
     */
    next() {
        if (this.galleryImages.length <= 1) return;
        const newIndex = this.currentIndex === this.galleryImages.length - 1 ? 0 : this.currentIndex + 1;
        this.showImage(newIndex);
    }
};

// Export
window.Lightbox = Lightbox;
