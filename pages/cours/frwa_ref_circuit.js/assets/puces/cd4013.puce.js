// CD4013 — double bascule D (datasheet TI SCHS023). Front montant de CLK : Q prend la valeur de D.
// S et R asynchrones, actifs à l'état haut. Montée en diviseur par 2 : D relié à /Q.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

FrWA.puce({
  id: 'cd4013', tags: ['serie4000', 'logique'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VDD', 'VSS'], entree: ['D1', 'CLK1', 'S1', 'R1', 'D2', 'CLK2', 'S2', 'R2'], sortie: ['Q1', 'Q1B', 'Q2', 'Q2B'] },
  variables: [],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'CD4013',
  categorie: 'Logique CMOS 4000',
  description: 'Deux bascules D déclenchées sur front montant, avec mise à 1 (S) et remise à 0 (R) asynchrones. D relié à /Q : diviseur par 2.',
  //         1     2                                3       4     5     6     7      8     9     10    11      12                               13    14
  broches: ['Q1', { nom: 'Q1B', etiquette: '/Q1' }, 'CLK1', 'R1', 'D1', 'S1', 'VSS', 'S2', 'D2', 'R2', 'CLK2', { nom: 'Q2B', etiquette: '/Q2' }, 'Q2', 'VDD'],
  cotes: { haut: ['VDD'], gauche: ['D1', 'CLK1', 'S1', 'R1', 'D2', 'CLK2', 'S2', 'R2'], droite: ['Q1', 'Q1B', null, null, 'Q2', 'Q2B'], bas: ['VSS'] },
  logique: {
    vdd: 'VDD', vss: 'VSS',
    entrees: ['D1', 'CLK1', 'S1', 'R1', 'D2', 'CLK2', 'S2', 'R2'],
    sorties: ['Q1', 'Q1B', 'Q2', 'Q2B'],
    rSortie: 500, vMin: 3,
    etat: () => ({ q1: false, q2: false }),
    evaluer(e, s) {
      const bascule = (q, D, CLK, S, R) => {
        if (e[S] && e[R]) return { q: true, qb: true };
        if (e[R]) return { q: false, qb: true };
        if (e[S]) return { q: true, qb: false };
        if (e.monte[CLK]) q = e[D];
        return { q, qb: !q };
      };
      const a = bascule(s.q1, 'D1', 'CLK1', 'S1', 'R1'), b = bascule(s.q2, 'D2', 'CLK2', 'S2', 'R2');
      s.q1 = a.q; s.q2 = b.q;
      return { Q1: a.q, Q1B: a.qb, Q2: b.q, Q2B: b.qb };
    },
  },
  affichage: s => `Q1=${s.q1 ? 1 : 0} Q2=${s.q2 ? 1 : 0}`,
});
})();
