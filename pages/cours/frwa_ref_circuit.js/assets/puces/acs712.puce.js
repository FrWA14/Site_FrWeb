// ACS712-05B — capteur de courant à effet Hall (projet « Coupe de France de robotique »).
// Le courant traverse IP+ → IP− (1,2 mΩ) ; la sortie VIOUT = VCC/2 + sensibilité × I.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

FrWA.puce({
  id: 'acs712-05b', tags: ['capteur', 'mesure', 'module'],
  version: '1.0.0', regles: 1,
  typesBroches: { passif: ['IP+a', 'IP+b', 'IP-a', 'IP-b', 'FILTER'], alim_entree: ['VCC', 'GND'], sortie: ['VIOUT'] },
  variables: [{ cle: 'i', nom: 'Courant mesuré', unite: 'A' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'ACS712-05B',
  categorie: 'Capteurs',
  description: 'Capteur de courant ±5 A isolé, SOIC-8. VIOUT = VCC/2 + 185 mV/A (20A : 100 mV/A, 30A : 66 mV/A via le paramètre).',
  broches: [
    { nom: 'IP+a', etiquette: 'IP+' }, { nom: 'IP+b', etiquette: 'IP+' },
    { nom: 'IP-a', etiquette: 'IP−' }, { nom: 'IP-b', etiquette: 'IP−' },
    'GND', 'FILTER', 'VIOUT', 'VCC',
  ],
  cotes: { gauche: ['IP+a', 'IP+b', 'IP-a', 'IP-b'], droite: ['VCC', 'VIOUT', 'FILTER'], bas: ['GND'] },
  parametres: [{ cle: 'sens', nom: 'Sensibilité', unite: 'V/A', defaut: 0.185, min: 0.01, max: 1, echelle: 'lin', pas: 0.001 }],
  modele: {
    elements: [
      { t: 'R', a: 'IP+a', b: 'IP+b', R: 1e-4 },          // les deux broches IP+ sont reliées dans le boîtier
      { t: 'R', a: 'IP-a', b: 'IP-b', R: 1e-4 },
      { t: 'A', a: 'IP+a', b: 'chemin', nom: 'ip' },       // mesure du courant primaire
      { t: 'R', a: 'chemin', b: 'IP-a', R: 1.2e-3 },
      { t: 'O', a: 'VIOUT', ref: 'GND', V: 0, R: 2, nom: 'sortie' },
      { t: 'R', a: 'VIOUT', b: 'FILTER', R: 1700 },        // résistance interne vers la broche de filtrage
      { t: 'R', a: 'VCC', b: 'GND', R: 500 },              // ≈ 10 mA de consommation sous 5 V
    ],
    etat: () => ({ i: 0 }),
    pas(c) {
      const vcc = c.v('VCC') - c.v('GND');
      c.s.i = c.i('ip');
      c.regler('sortie', vcc < 3 ? 0 : Math.max(0, Math.min(vcc, vcc / 2 + c.p.sens * c.s.i)));
    },
  },
  affichage: s => 'I = ' + FrWA.formater(s.i, 'A'),
});
})();
