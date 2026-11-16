// AMS1117-3.3 — régulateur LDO (7 fois dans tes schémas : cartes ESP32-S3, STM32, RP2350…).
// Style « modèle comportemental » : une source de tension interne réglée à chaque pas + une source de courant
// commandée (F) qui fait débiter l'entrée exactement le courant fourni en sortie.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

FrWA.puce({
  id: 'ams1117-3.3', tags: ['alimentation', 'basic'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VIN', 'GND'], alim_sortie: ['VOUT'] },
  variables: [{ cle: 'mode', nom: 'État', type: 'texte' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'AMS1117-3.3',
  categorie: 'Régulateurs',
  description: 'Régulateur linéaire 3,3 V / 1 A, boîtier SOT-223. Tension de déchet ≈ 1,1 V : en dessous d\'environ 4,4 V en entrée, la sortie suit VIN − 1,1 V.',
  broches: [{ nom: 'GND', etiquette: 'GND' }, 'VOUT', 'VIN'],   // 1 GND/ADJ, 2 VOUT (et languette), 3 VIN
  cotes: { gauche: ['VIN'], droite: ['VOUT'], bas: ['GND'] },
  parametres: [
    { cle: 'vout', nom: 'Tension de sortie', unite: 'V', defaut: 3.3, min: 1.2, max: 5, echelle: 'lin', pas: 0.05 },
    { cle: 'chute', nom: 'Tension de déchet', unite: 'V', defaut: 1.1, min: 0.1, max: 2, echelle: 'lin', pas: 0.05 },
  ],
  modele: {
    elements: [
      { t: 'V', a: 'reg', b: 'GND', V: 0, nom: 'source' },        // « reg » : nœud interne
      { t: 'R', a: 'reg', b: 'VOUT', R: 0.05 },                    // résistance de sortie
      { t: 'F', a: 'VIN', b: 'GND', mesure: 'source', gain: -1 },  // l'entrée fournit le courant de sortie
      { t: 'R', a: 'VIN', b: 'GND', R: 1e4 },                      // courant de repos
    ],
    etat: () => ({ mode: '' }),
    pas(c) {
      const vin = c.v('VIN') - c.v('GND');
      const cible = Math.max(0, Math.min(c.p.vout, vin - c.p.chute));
      c.s.mode = vin - c.p.chute >= c.p.vout ? 'régule' : vin > 0.5 ? 'décroché' : 'éteint';
      c.regler('source', cible);
    },
  },
  affichage: s => s.mode,
});
})();
