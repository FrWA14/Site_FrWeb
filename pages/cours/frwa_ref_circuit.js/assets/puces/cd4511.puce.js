// CD4511 — décodeur BCD → 7 segments avec verrou, sorties NPN « source » jusqu'à 25 mA (datasheet TI SCHS072B).
// Sortie haute ≈ VDD − 0,45 V à vide, ≈ VDD − 0,9 V à 10 mA (tableau VOH page 2) : modélisée par une chute de 0,6 V + 30 Ω.
// Particularité visible : le « 6 » et le « 9 » s'affichent SANS barre (pas de segment a pour 6, pas de d pour 9).
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const SEG = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const TABLE = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '0011111', '1110000', '1111111', '1110011'];

FrWA.puce({
  id: 'cd4511', tags: ['serie4000', 'logique', 'afficheur'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VDD', 'VSS'], entree: ['A', 'B', 'C', 'D', 'LT', 'BL', 'LE'], sortie: SEG },
  variables: [],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'CD4511',
  categorie: 'Logique CMOS 4000',
  description: 'Décodeur BCD vers afficheur 7 segments à cathode commune. /LT bas : tous les segments allumés ; /BL bas : afficheur éteint ; LE haut : code mémorisé. Codes 10 à 15 : afficheur éteint.',
  //         1    2    3                               4                               5     6    7    8      9    10   11   12   13   14   15   16
  broches: ['B', 'C', { nom: 'LT', etiquette: '/LT' }, { nom: 'BL', etiquette: '/BL' }, 'LE', 'D', 'A', 'VSS', 'e', 'd', 'c', 'b', 'a', 'g', 'f', 'VDD'],
  cotes: { haut: ['VDD'], gauche: ['A', 'B', 'C', 'D', 'LT', 'BL', 'LE'], droite: SEG, bas: ['VSS'] },
  logique: {
    vdd: 'VDD', vss: 'VSS',
    entrees: ['A', 'B', 'C', 'D', 'LT', 'BL', 'LE'],
    sorties: SEG,
    rSortie: 30, chuteHaut: 0.6, vMin: 3,
    etat: () => ({ code: 0, aff: 0 }),
    evaluer(e, s) {
      if (!e.LE) s.code = (e.A ? 1 : 0) + (e.B ? 2 : 0) + (e.C ? 4 : 0) + (e.D ? 8 : 0);
      let motif = '0000000';
      if (!e.LT) motif = '1111111';
      else if (e.BL && s.code <= 9) motif = TABLE[s.code];
      s.aff = !e.LT ? 8 : (!e.BL || s.code > 9) ? -1 : s.code;
      const o = {}; SEG.forEach((x, i) => { o[x] = motif[i] === '1'; });
      return o;
    },
  },
  affichage: s => (s.aff < 0 ? 'éteint' : 'code ' + s.aff),
});
})();
