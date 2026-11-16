// CD4081 — quatre portes ET à 2 entrées (datasheet TI SCHS056). J = A·B, K = C·D, L = E·F, M = G·H.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

FrWA.puce({
  id: 'cd4081', tags: ['serie4000', 'logique'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VDD', 'VSS'], entree: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], sortie: ['J', 'K', 'L', 'M'] },
  variables: [],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'CD4081',
  categorie: 'Logique CMOS 4000',
  description: 'Quatre portes ET (AND) à deux entrées. Sert ici à détecter le « 6 » des dizaines (Q2 ET Q3) pour remettre le compteur à zéro.',
  //         1    2    3    4    5    6    7      8    9    10   11   12   13   14
  broches: ['A', 'B', 'J', 'K', 'C', 'D', 'VSS', 'E', 'F', 'L', 'M', 'G', 'H', 'VDD'],
  cotes: { haut: ['VDD'], gauche: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], droite: ['J', null, 'K', null, 'L', null, 'M'], bas: ['VSS'] },
  logique: {
    vdd: 'VDD', vss: 'VSS',
    entrees: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    sorties: ['J', 'K', 'L', 'M'],
    rSortie: 500, vMin: 3,
    etat: () => ({}),
    evaluer: e => ({ J: e.A && e.B, K: e.C && e.D, L: e.E && e.F, M: e.G && e.H }),
  },
});
})();
