// CD4017 — compteur décimal (projet KiCad « NE555 CD4017 »).
// Style « logique » : on décrit seulement les entrées, les sorties et une fonction evaluer() ;
// le simulateur s'occupe des seuils (60 % / 40 % de VDD, avec hystérésis) et de la sortance (rSortie).
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const Q = ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9'];

FrWA.puce({
  id: 'cd4017', tags: ['serie4000', 'logique', 'basic'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VDD', 'VSS'], entree: ['CLK', 'INH', 'RST'], sortie: [...Q, 'CO'] },
  variables: [{ cle: 'n', nom: 'Compte', unite: '' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'CD4017',
  categorie: 'Logique CMOS 4000',
  description: 'Compteur Johnson à 10 sorties décodées. Avance sur front montant de CLK quand INH est bas ; RST haut remet à zéro. CO haut pendant les comptes 0 à 4.',
  //         1     2     3     4     5     6     7     8      9     10    11    12    13     14     15     16
  broches: ['Q5', 'Q1', 'Q0', 'Q2', 'Q6', 'Q7', 'Q3', 'VSS', 'Q8', 'Q4', 'Q9', 'CO', 'INH', 'CLK', 'RST', 'VDD'],
  cotes: { haut: ['VDD'], gauche: ['CLK', 'INH', 'RST'], droite: [...Q, 'CO'], bas: ['VSS'] },
  logique: {
    vdd: 'VDD', vss: 'VSS',
    entrees: ['CLK', 'INH', 'RST'],
    sorties: [...Q, 'CO'],
    rSortie: 400,          // les sorties 4000 sont « molles » : quelques mA
    vMin: 3,
    etat: () => ({ n: 0 }),
    evaluer(e, s) {
      if (e.RST) s.n = 0;
      else if (e.monte.CLK && !e.INH) s.n = (s.n + 1) % 10;
      const sorties = { CO: s.n < 5 };
      Q.forEach((q, i) => { sorties[q] = s.n === i; });
      return sorties;
    },
  },
  affichage: s => 'compte = ' + s.n,
});
})();
