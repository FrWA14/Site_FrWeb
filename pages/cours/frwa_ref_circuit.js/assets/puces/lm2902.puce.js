// LM2902 — quadruple ampli-op « tout terrain » (−40 à +125 °C), alimentation unique 3 à 26 V (datasheet TI SLOS068).
// Entrées utilisables de 0 V jusqu'à VCC − 1,5 V ; sortie de ~0 V à VCC − 1,5 V. Ici utilisé surtout en comparateur.
// Primitive « OA » du simulateur : sortie = rail bas + (rails) × (1 + tanh(A·(v+ − v−)))/2, gain A = 100 000.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const AOP = [1, 2, 3, 4];

FrWA.puce({
  id: 'lm2902', tags: ['ali', 'analogique', 'basic'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VCC', 'GND'], entree: ['IN1+', 'IN1-', 'IN2+', 'IN2-', 'IN3+', 'IN3-', 'IN4+', 'IN4-'], sortie: ['OUT1', 'OUT2', 'OUT3', 'OUT4'] },
  variables: [],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'LM2902',
  categorie: 'Amplificateurs',
  description: 'Quatre ampli-op à alimentation unique (3 à 26 V), entrées jusqu\'à 0 V. Sortie haute ≈ VCC − 1,5 V. Utilisé en comparateur : sortie haute quand IN+ > IN−.',
  //         1       2       3       4      5       6       7       8       9       10      11     12      13      14
  broches: ['OUT1', 'IN1-', 'IN1+', 'VCC', 'IN2+', 'IN2-', 'OUT2', 'OUT3', 'IN3-', 'IN3+', 'GND', 'IN4+', 'IN4-', 'OUT4'],
  cotes: {
    haut: ['VCC'], bas: ['GND'],
    gauche: ['IN1+', 'IN1-', null, 'IN2+', 'IN2-', null, 'IN3+', 'IN3-', null, 'IN4+', 'IN4-'],
    droite: ['OUT1', null, null, 'OUT2', null, null, 'OUT3', null, null, 'OUT4'],
  },
  modele: {
    elements: [
      ...AOP.flatMap(i => [
        { t: 'OA', p: `IN${i}+`, n: `IN${i}-`, s: `s${i}`, vp: 'VCC', vn: 'GND', A: 1e5, chuteHaut: 1.5, chuteBas: 0.02 },
        { t: 'R', a: `s${i}`, b: `OUT${i}`, R: 40 },              // résistance de sortie (courant de court-circuit ≈ 40 mA)
      ]),
      { t: 'R', a: 'VCC', b: 'GND', R: 7000 },                    // consommation au repos ≈ 0,7 mA sous 5 V
    ],
  },
});

/* Unité séparée (comme une « unité » KiCad) : UN des quatre ampli-op du LM2902, avec ses broches d'alimentation.
   Même modèle que le boîtier (gain 100 000, sortie 40 Ω, de ≈ 0 V à VCC − 1,5 V) ; quatre unités = un boîtier
   (consommation répartie : 4 × 28 kΩ = 7 kΩ). Schémas plus lisibles : chaque ampli se dessine là où il sert. */
FrWA.puce({
  id: 'lm2902-u', tags: ['ali', 'analogique'],
  version: '1.0.0', regles: 1,
  typesBroches: { entree: ['IN1+', 'IN1-'], sortie: ['OUT1'], alim_entree: ['VCC', 'GND'] },
  variables: [],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'LM2902 ¼',
  prefixe: 'U',
  categorie: 'Amplificateurs',
  description: 'Un ampli-op du LM2902 (unité ¼ du boîtier) : alimentation simple 3 à 26 V, entrées jusqu\'à 0 V, sortie haute ≈ VCC − 1,5 V. En comparateur : sortie haute quand IN+ > IN−. VCC et GND : alimentation du boîtier.',
  broches: ['IN1+', 'IN1-', 'OUT1', 'VCC', 'GND'],
  cotes: { gauche: ['IN1+', null, 'IN1-'], droite: [null, 'OUT1'], haut: ['VCC'], bas: ['GND'] },
  modele: {
    elements: [
      { t: 'OA', p: 'IN1+', n: 'IN1-', s: 's1', vp: 'VCC', vn: 'GND', A: 1e5, chuteHaut: 1.5, chuteBas: 0.02 },
      { t: 'R', a: 's1', b: 'OUT1', R: 40 },
      { t: 'R', a: 'VCC', b: 'GND', R: 28000 },
    ],
  },
});
})();
