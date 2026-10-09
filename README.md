# FrWA Conception - Site Web

Site statique (HTML / CSS / JavaScript, sans framework ni compilation) avec
navigation automatique, prévu pour GitHub Pages ou n'importe quel serveur web.

## Fonctionnement

- `index.html` est la seule page chargée par le navigateur. Les autres pages
  (`pages/...`) sont chargées dans la zone de contenu sans rechargement :
  l'adresse devient `index.html#pages/projets/Projets.html`.
- Le menu latéral est construit à partir de `navigation.json`, généré par
  `generate-navigation.sh` (Linux/macOS) ou `generate-navigation.ps1` (Windows)
  en parcourant le dossier `pages/`.
- Les « dernières mises à jour » de l'accueil viennent de `src/assets/data/vlog.json`.

## Organisation

```
index.html                 page d'accueil + chargement des CSS/JS
navigation.json            menu (généré, ne pas modifier à la main)
pages/
  <section>/
    <Section>.html         page de section (liste des pages)
    assets/images/         bannière et vignettes de la section
    <ma-page>/
      <Ma_page>.html       la page
      assets/              TOUS les médias de la page
        images/  videos/  modeles-3d/  fichiers/
  template/                modèles (non affichés dans le menu)
src/
  styles/                  CSS communs (base, layout, components, theme, pages)
  js/                      moteur du site (router, navigation, lightbox...)
  assets/                  médias de l'accueil et éléments communs du site
_sources/                  fichiers de travail, hors site
```

**Règle principale : une page = un dossier.** Une page n'utilise que les médias
de son propre dossier `assets/` (plus les CSS/JS communs de `src/`). On peut
donc ajouter, retirer ou copier une page simplement en copiant ou supprimant
son dossier.

## Ajouter une page

1. Copier `pages/template/exemple-page/` dans la section voulue, par ex.
   `pages/electronique/mon-montage/`, et renommer le fichier HTML
   (`Mon_montage.html` : ce nom devient le libellé du menu).
2. Mettre les médias dans `assets/` et les référencer en **chemin relatif** :
   `assets/images/photo.jpg`. Le site corrige automatiquement les chemins
   (`src`, `poster`, `srcset`, liens vers des fichiers).
3. Lancer `./generate-navigation.sh`.
4. Ajouter une carte vers la page dans la page de section, avec une vignette
   placée dans le `assets/images/` de la section.
5. Optionnel : ajouter une entrée dans `src/assets/data/vlog.json`.

Retirer une page : supprimer son dossier, sa carte dans la page de section,
puis relancer `./generate-navigation.sh`.

## Médias : conventions et compression

- Noms de fichiers **en minuscules, sans espaces ni accents** (`ma-photo-v2.jpg`) :
  le serveur distingue majuscules et minuscules, contrairement à Windows.
- Les gros fichiers alourdissent le dépôt **pour toujours** (historique git).
  GitHub refuse les fichiers de plus de 100 Mo. Compresser avant d'ajouter :

```bash
# Photo : 1920 px max, JPEG qualité 82, métadonnées (GPS !) supprimées
convert photo.jpg -auto-orient -resize '1920x1920>' -strip -quality 82 photo-web.jpg

# Vidéo : 720 px de large, H.264, lecture immédiate sur le web
ffmpeg -i video.mp4 -vf scale=720:-2 -c:v libx264 -preset slow -crf 25 \
       -c:a aac -b:a 128k -movflags +faststart video-web.mp4
```

Les photos de téléphone contiennent souvent la position GPS : `-strip`
la supprime.

## Tester en local

Les pages sont chargées par `fetch`, il faut donc un serveur web
(ouvrir `index.html` directement depuis le disque ne fonctionne pas) :

```bash
python3 -m http.server 8000   # puis http://localhost:8000
```

## Licence

MIT, voir [LICENSE](LICENSE). Libre d'utilisation et de modification.

---

**FrWA Conception** ❄️ 2024
