// CD4518 — double compteur BCD (datasheet TI SCHS076D, table de vérité page 1) :
//   CLOCK ↑ avec ENABLE = 1  → +1 ;   ENABLE ↓ avec CLOCK = 0 → +1 ;   RESET = 1 → 0.
// Mise en cascade : Q4 du compteur des unités → ENABLE des dizaines, CLOCK des dizaines à la masse.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

FrWA.puce({
  id: 'cd4518', tags: ['serie4000', 'logique'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VDD', 'VSS'], entree: ['CLKA', 'ENA', 'RSTA', 'CLKB', 'ENB', 'RSTB'], sortie: ['Q1A', 'Q2A', 'Q3A', 'Q4A', 'Q1B', 'Q2B', 'Q3B', 'Q4B'] },
  variables: [],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'CD4518',
  categorie: 'Logique CMOS 4000',
  description: 'Deux compteurs décimaux (BCD 0 à 9). Comptent sur front montant de CLOCK (ENABLE haut) ou front descendant de ENABLE (CLOCK bas). RESET haut : remise à 0.',
  //         1       2      3      4      5      6      7       8      9       10     11     12     13     14     15      16
  broches: ['CLKA', 'ENA', 'Q1A', 'Q2A', 'Q3A', 'Q4A', 'RSTA', 'VSS', 'CLKB', 'ENB', 'Q1B', 'Q2B', 'Q3B', 'Q4B', 'RSTB', 'VDD'],
  cotes: { haut: ['VDD'], gauche: ['CLKA', 'ENA', 'RSTA', null, 'CLKB', 'ENB', 'RSTB'], droite: ['Q1A', 'Q2A', 'Q3A', 'Q4A', 'Q1B', 'Q2B', 'Q3B', 'Q4B'], bas: ['VSS'] },
  logique: {
    vdd: 'VDD', vss: 'VSS',
    entrees: ['CLKA', 'ENA', 'RSTA', 'CLKB', 'ENB', 'RSTB'],
    sorties: ['Q1A', 'Q2A', 'Q3A', 'Q4A', 'Q1B', 'Q2B', 'Q3B', 'Q4B'],
    rSortie: 500, vMin: 3,
    etat: () => ({ a: 0, b: 0 }),
    evaluer(e, s) {
      const compter = (n, X) => {
        if (e['RST' + X]) return 0;
        if ((e.monte['CLK' + X] && e['EN' + X]) || (e.descend['EN' + X] && !e['CLK' + X])) return (n + 1) % 10;
        return n;
      };
      s.a = compter(s.a, 'A'); s.b = compter(s.b, 'B');
      const o = {};
      for (let k = 0; k < 4; k++) { o[`Q${k + 1}A`] = ((s.a >> k) & 1) === 1; o[`Q${k + 1}B`] = ((s.b >> k) & 1) === 1; }
      return o;
    },
  },
  affichage: s => `A=${s.a}  B=${s.b}`,
});
})();
