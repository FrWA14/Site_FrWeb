// LM3914 — pilote de barre de 10 LED, échelle linéaire (datasheet TI SNVS761B).
// Référence 1,25 V entre REF OUT et REF ADJ ; 10 comparateurs sur un diviseur de 10 résistances entre RLO et RHI
// (une LED de plus tous les 125 mV quand RHI = 1,25 V) ; courant de chaque LED ≈ 10 × courant tiré sur REF OUT.
// Broche MODE reliée à V+ : mode barre ; laissée en l'air : mode point.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const LEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

FrWA.puce({
  id: 'lm3914', tags: ['afficheur', 'analogique', 'eclairage'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['V+', 'V-'], entree: ['SIG', 'MODE'], passif: ['RLO', 'RHI', 'REFADJ'], alim_sortie: ['REFOUT'], drain_ouvert: LEDS.map(k => 'LED' + k) },
  variables: [{ cle: 'n', nom: 'LED allumées', unite: '' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'LM3914',
  categorie: 'Afficheurs',
  description: 'Allume 1 à 10 LED selon la tension sur SIG (barre ou point). Pleine échelle = tension RHI − RLO ; courant LED ≈ 10 × courant de REF OUT (≈ 12,5 V / R1).',
  //         1       2     3     4      5      6      7                                    8                                    9       10       11      12      13      14      15      16      17      18
  broches: ['LED1', 'V-', 'V+', 'RLO', 'SIG', 'RHI', { nom: 'REFOUT', etiquette: 'REF OUT' }, { nom: 'REFADJ', etiquette: 'REF ADJ' }, 'MODE', 'LED10', 'LED9', 'LED8', 'LED7', 'LED6', 'LED5', 'LED4', 'LED3', 'LED2'],
  // LED10 en haut : la barre « monte » ; RHI et REF OUT côte à côte (on les relie pour une pleine échelle de 1,25 V)
  cotes: { haut: ['V+', 'MODE'], bas: ['V-', 'RLO', 'REFADJ'], gauche: ['SIG', null, 'RHI', 'REFOUT'], droite: [...LEDS].reverse().map(k => 'LED' + k) },
  modele: {
    elements: [
      { t: 'V', a: 'REFOUT', b: 'REFADJ', V: 1.25, nom: 'ref' },
      // diviseur interne : 10 × 1 kΩ de RLO (t0) à RHI (t10)
      ...LEDS.map(k => ({ t: 'R', a: k === 1 ? 'RLO' : `t${k - 1}`, b: k === 10 ? 'RHI' : `t${k}`, R: 1000 })),
      ...LEDS.map(k => ({ t: 'K', a: 'LED' + k, b: 'V-', I: 0, nom: 'led' + k })),   // sorties en courant constant
      { t: 'R', a: 'V+', b: 'V-', R: 1500 },                                        // consommation propre ≈ 3 mA
    ],
    etat: () => ({ n: 0, iLed: 0, barre: true }),
    pas(c) {
      const alim = c.v('V+') - c.v('V-');
      const iRef = Math.max(0, -c.i('ref'));                 // courant sortant de REF OUT
      c.s.iLed = alim >= 3 ? Math.min(0.03, 10 * iRef) : 0;
      c.s.barre = c.v('MODE') > c.v('V+') - 0.1;
      const lo = c.v('RLO'), hi = c.v('RHI'), sig = c.v('SIG');
      let n = 0;
      for (const k of LEDS) if (sig > lo + (hi - lo) * k / 10) n = k;
      c.s.n = n;
      for (const k of LEDS) c.regler('led' + k, (c.s.barre ? k <= n : k === n) ? c.s.iLed : 0);
    },
  },
  affichage: s => `${s.n}/10 · ${FrWA.formater(s.iLed, 'A', 2)}`,
});
})();
