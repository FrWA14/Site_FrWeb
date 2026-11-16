// Réseau de 8 résistances isolées en boîtier DIP-16 (type Bourns 4116R-1-xxx) : une résistance entre la broche k et la
// broche 17 − k. Pratique pour les 7 segments d'un afficheur : une seule pièce au lieu de 7.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const K = [1, 2, 3, 4, 5, 6, 7, 8];

FrWA.puce({
  id: 'reseau-8r', tags: ['passif'],
  version: '1.0.0', regles: 1,
  typesBroches: { passif: K.flatMap(k => ['R' + k + 'a', 'R' + k + 'b']) },
  variables: [],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: '8 × R',
  prefixe: 'RN',
  categorie: 'Passifs',
  description: 'Réseau de 8 résistances indépendantes (DIP-16, ex. Bourns 4116R-1). Résistance k entre la broche k et la broche 17 − k. Valeur réglable à la molette.',
  broches: [...K.map(k => ({ nom: 'R' + k + 'a', etiquette: String(k) })), ...[...K].reverse().map(k => ({ nom: 'R' + k + 'b', etiquette: String(17 - k) }))],
  cotes: { gauche: K.map(k => 'R' + k + 'a'), droite: K.map(k => 'R' + k + 'b') },
  parametres: [{ cle: 'R', nom: 'Résistance', unite: 'Ω', defaut: 270, min: 1, max: 1e6, echelle: 'log' }],
  modele: { elements: K.map(k => ({ t: 'R', a: 'R' + k + 'a', b: 'R' + k + 'b', R: '$R' })) },
  dessin(g, x) {
    g.strokeStyle = '#9aa8a6'; g.lineWidth = 1.2;
    K.forEach((k, i) => {
      const y = -x.H / 2 + 20 + 20 * i;
      g.beginPath(); g.moveTo(-14, y);
      for (let j = 0; j < 6; j++) g.lineTo(-14 + (j + 0.5) * (28 / 6), y + (j % 2 ? 3 : -3));
      g.lineTo(14, y); g.stroke();
    });
  },
});
})();
