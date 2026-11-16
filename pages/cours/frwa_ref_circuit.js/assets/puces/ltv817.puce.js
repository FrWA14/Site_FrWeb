// LTV-817 — optocoupleur (17 fois dans tes schémas, ampli audio isolé).
// Style « sous-circuit » pur : LED + capteur de courant (A) + transistor dont la base reçoit
// un courant proportionnel au courant LED (F). Aucun code : seule la valeur du gain dépend du paramètre CTR.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

FrWA.puce({
  id: 'ltv-817', tags: ['optique', 'semi-conducteur', 'protection'],
  version: '1.0.0', regles: 1,
  typesBroches: { passif: ['A', 'K', 'E', 'C'] },
  variables: [{ cle: 'iled', nom: 'Courant LED', unite: 'A' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'LTV-817',
  categorie: 'Optocoupleurs',
  description: 'Optocoupleur LED infrarouge → phototransistor, DIP-4. CTR = courant collecteur / courant LED (50 à 600 % selon le rang ; 100 % par défaut).',
  broches: ['A', 'K', 'E', 'C'],          // DIP-4 : 1 anode, 2 cathode, 3 émetteur, 4 collecteur
  parametres: [{ cle: 'ctr', nom: 'CTR', unite: '%', defaut: 100, min: 20, max: 600, echelle: 'lin', pas: 5 }],
  modele: {
    elements: [
      { t: 'D', a: 'A', b: 'k_int', N: 1.8, Vf: 1.2, If: 0.02 },     // LED IR : 1,2 V à 20 mA
      { t: 'A', a: 'k_int', b: 'K', nom: 'iled' },                    // capteur du courant LED
      { t: 'Q', c: 'C', b: 'base', e: 'E', beta: 200 },              // phototransistor
      { t: 'F', a: 'E', b: 'base', mesure: 'iled', gain: p => p.ctr / 100 / 200 },
    ],
    etat: () => ({ iled: 0 }),
    pas(c) { c.s.iled = c.i('iled'); },
  },
  affichage: s => (s.iled > 1e-4 ? 'LED ' + FrWA.formater(s.iled, 'A', 2) : 'LED éteinte'),
});
})();
