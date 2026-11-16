// Quartz 32,768 kHz (boîtier cylindrique 2 × 6 mm). Électriquement, le simulateur le voit comme un isolant :
// son rôle (fixer la fréquence de l'oscillateur du CD4060) est porté par le paramètre « fosc » du CD4060.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

FrWA.puce({
  id: 'quartz-32k', tags: ['passif', 'generateur'],
  version: '1.0.0', regles: 1,
  typesBroches: { passif: ['X1', 'X2'] },
  variables: [],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'QUARTZ',
  prefixe: 'X',
  categorie: 'Quartz',
  description: 'Quartz horloger 32,768 kHz (2^15 Hz). Dans ce simulateur il est seulement dessiné : la fréquence est réglée sur la puce oscillatrice (CD4060).',
  broches: ['X1', 'X2'],
  cotes: { gauche: ['X1'], droite: ['X2'] },
  parametres: [{ cle: 'f', nom: 'Fréquence', unite: 'Hz', defaut: 32768, min: 1000, max: 5e7, echelle: 'log' }],
  modele: { elements: [{ t: 'R', a: 'X1', b: 'X2', R: 1e10 }] },
  dessin(g) {
    g.strokeStyle = '#cfd8d6'; g.lineWidth = 2;
    g.strokeRect(-6, -32, 12, 24);
    g.beginPath(); g.moveTo(-12, -34); g.lineTo(-12, -6); g.moveTo(12, -34); g.lineTo(12, -6); g.stroke();
  },
  affichage: (s, p) => FrWA.formater(p.f, 'Hz'),
});
})();
