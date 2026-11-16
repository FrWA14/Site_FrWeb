// Barre de 10 LED en boîtier DIP-20 (type Kingbright DC-10EWA) : anodes 1 à 10, cathodes 20 à 11.
// Dessinée dans le sens « vu-mètre » : LED 10 en haut. Chaque LED ≈ 2 V à 10 mA.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const K = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

FrWA.puce({
  id: 'bargraph-10', tags: ['afficheur', 'eclairage'],
  version: '1.0.0', regles: 1,
  typesBroches: { passif: [...K.map(k => 'A' + k), ...K.map(k => 'K' + k)] },
  variables: [],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'BARRE 10',
  prefixe: 'BG',
  categorie: 'Afficheurs',
  description: 'Barre de 10 LED (DIP-20, ex. Kingbright DC-10EWA). LED k entre l\'anode Ak et la cathode Kk. Se pose contre les sorties d\'un LM3914.',
  broches: [...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(k => 'A' + k), ...[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(k => 'K' + k)],
  cotes: { gauche: K.map(k => 'K' + k), droite: K.map(k => 'A' + k) },
  largeur: 120,
  parametres: [{ cle: 'couleur', nom: 'Couleur', type: 'choix', options: ['rouge', 'vert', 'jaune', 'bleu'], defaut: 'vert' }],
  modele: { elements: K.map(k => ({ t: 'D', a: 'A' + k, b: 'K' + k, N: 2, If: 0.01, Vf: p => (p.couleur === 'bleu' ? 3.0 : p.couleur === 'rouge' ? 2.0 : 2.1) })) },
  dessin(g, x) {
    const coul = { rouge: '#ff3b2f', vert: '#3dff6a', jaune: '#ffd23a', bleu: '#4a8dff' }[x.p.couleur] || '#3dff6a';
    K.forEach((k, i) => {
      const y = -x.H / 2 + 20 + 20 * i, lum = Math.max(0, Math.min(1, x.i('A' + k) / 0.008));
      g.fillStyle = '#1d1414'; g.fillRect(-22, y - 6, 44, 12);
      if (lum > 0.03) { g.globalAlpha = 0.3 + 0.7 * lum; g.fillStyle = coul; g.shadowColor = coul; g.shadowBlur = 12 * lum; g.fillRect(-22, y - 6, 44, 12); g.shadowBlur = 0; g.globalAlpha = 1; }
    });
  },
});
})();
