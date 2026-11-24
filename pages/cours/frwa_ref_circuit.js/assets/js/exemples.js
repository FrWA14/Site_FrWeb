/* frwa_flow-Circuit — exemples.js
   Circuits d'exemple (même format que l'export « .circuit.json »). Coordonnées sur la grille de 20.
   Rotation : 0 = horizontal (broche 1 à gauche), 1 = quart de tour horaire (broche 1 en haut), 3 = broche 1 en bas. */
'use strict';
(function (G) {
const E = (type, nom, x, y, rot = 0, params = {}) => ({ type, nom, x, y, rot, params });

/* Constructeur d'exemples : positions des broches lues dans les brochages réels des puces (après leur chargement).
   B.E(type, nom, x, y, rot, params)  pose un élément        B.P(nom, broche) → [x, y] d'une broche
   B.F(p1, p2, …)                     fils en L entre points   B.L(texte, x, y, rot) étiquette de réseau
   B.M(x, y)                          symbole de masse         B.LP(nom, broche, texte, dir, d) broche → étiquette
   B.MP(nom, broche, dir, d)          broche → masse (dir : 'g' gauche, 'd' droite, 'h' haut, 'b' bas) */
function plan(fn) {
  return () => {
    const { TYPES } = G.FrWAComposants, { tourner } = G.FrWACircuit;
    const elements = [], fils = []; let n = 0;
    const DIR = { g: [-1, 0, 0], h: [0, -1, 1], d: [1, 0, 2], b: [0, 1, 3] };
    const B = {
      E(type, nom, x, y, rot = 0, params = {}, opts = {}) {
        if (!TYPES[type]) throw new Error('composant absent : ' + type.replace('puce:', ''));
        elements.push({ type, nom, x, y, rot, params, ...opts }); return nom;
      },
      P(nom, broche) {
        const e = elements.find(z => z.nom === nom); if (!e) throw new Error('élément inconnu : ' + nom);
        const T = TYPES[e.type], b = T.broches.find(z => z.nom === broche) || T.broches[broche];
        if (!b) throw new Error(`broche inconnue : ${nom}.${broche}`);
        const [x, y] = tourner(b.x, b.y, e.rot); return [e.x + x, e.y + y];
      },
      F(...pts) {
        for (let i = 0; i + 1 < pts.length; i++) {
          const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
          if (x1 !== x2 && y1 !== y2) { fils.push([x1, y1, x2, y1], [x2, y1, x2, y2]); } else fils.push([x1, y1, x2, y2]);
        }
      },
      L(texte, x, y, rot = 0) { elements.push({ type: 'etiquette', nom: 'NET' + (++n), x, y, rot, params: { nom: texte } }); },
      M(x, y) { elements.push({ type: 'masse', nom: 'GND' + (++n), x, y, rot: 0, params: {}, sansPastille: true }); },
      LP(nom, broche, texte, dir = 'g', d = 20) {
        const [x, y] = B.P(nom, broche), [dx, dy, r] = DIR[dir];
        if (d) fils.push([x, y, x + dx * d, y + dy * d]);
        B.L(texte, x + dx * d, y + dy * d, r);
      },
      /** éléments et fils déjà posés (placement automatique des étiquettes, etudes.js) */
      donnees() { return { elements, fils }; },
      MP(nom, broche, dir = 'b', d = 0) {
        const [x, y] = B.P(nom, broche), [dx, dy] = DIR[dir];
        if (d) fils.push([x, y, x + dx * d, y + dy * d]);
        B.M(x + dx * d, y + dy * d);
      },
    };
    fn(B);
    return { elements, fils };
  };
}

G.FrWAExemples = [
  {
    id: 'led', titre: 'LED et résistance',
    description: 'Le circuit de base : une pile, un interrupteur (cliquez-le), une résistance qui limite le courant de la LED. Tournez la molette de R1.',
    dt: 1e-4,
    elements: [
      E('pile', 'V1', 100, 200, 3, { V: 5 }), E('masse', 'GND1', 100, 240),
      E('interrupteur', 'SW1', 180, 160, 0, { ferme: true }),
      E('resistance', 'R1', 300, 160, 0, { R: 220 }),
      E('led', 'D1', 400, 200, 1, { couleur: 'rouge' }),
    ],
    fils: [[100, 160, 140, 160], [220, 160, 260, 160], [340, 160, 400, 160], [400, 240, 100, 240]],
    oscillo: [],
  },
  {
    id: 'rc', titre: 'Charge d\'un condensateur (RC)',
    description: 'Une horloge à 2 Hz charge puis décharge C1 à travers R1. L\'oscilloscope montre la courbe exponentielle (τ = R·C = 0,22 s).',
    dt: 1e-4,
    elements: [
      E('horloge', 'H1', 100, 200, 3, { V: 5, f: 2, rc: 50 }), E('masse', 'GND1', 100, 240),
      E('resistance', 'R1', 200, 160, 0, { R: 10e3 }),
      E('condensateur', 'C1', 300, 200, 1, { C: 22e-6 }),
    ],
    fils: [[100, 160, 160, 160], [240, 160, 300, 160], [300, 240, 100, 240]],
    oscillo: [{ nom: 'H1' }, { nom: 'C1' }],
  },
  {
    id: 'multiplicateur-500v', titre: 'Multiplicateur de tension ×10 (500 V)',
    description: 'Multiplicateur de Cockcroft-Walton à 5 étages (10 diodes, 10 condensateurs) : une source alternative de 50 V crête donne ≈ 500 V continus, soit 2 × 5 × 50 V moins les chutes des diodes. La tension monte étage par étage en 3 à 4 s : l\'oscilloscope la suit par le circuit ouvert CO1, une sonde qui ne consomme rien. Baissez R1 : la sortie chute de I / (f·C) × (2n³/3 + n²/2 − n/6) et l\'ondulation grandit.',
    dt: 5e-5, fenetre: 5,
    construire() {
      // colonne du haut (C impairs) poussée par la source, colonne du bas (C pairs) = sortie continue ; diodes en zigzag
      const n = 5, elements = [E('source_ac', 'V1', -400, -60, 3, { V: 50, f: 50, off: 0 }), E('masse', 'GND1', -400, -20)];
      const fils = [[-400, -100, -340, -100], [-400, -20, -260, -20]];
      for (let k = 0; k < n; k++) {
        const x = 160 * k;
        elements.push(E('condensateur', 'C' + (2 * k + 1), x - 300, -100, 0, { C: 10e-6 }), E('condensateur', 'C' + (2 * k + 2), x - 220, -20, 0, { C: 10e-6 }),
          { ...E('diode', 'D' + (2 * k + 1), x - 260, -60, 3), pastille: 'nom' }, { ...E('diode', 'D' + (2 * k + 2), x - 180, -60, 1), pastille: 'nom' });
        fils.push([x - 260, -100, x - 180, -100]);
        if (k < n - 1) fils.push([x - 180, -20, x - 100, -20]);
      }
      const xs = 160 * n - 340;                                  // sortie : extrémité de la colonne du bas
      elements.push(E('resistance', 'R1', xs + 80, 20, 1, { R: 100e6 }), E('masse', 'GND2', xs + 80, 60));
      // circuit ouvert en sortie : sonde de l'oscilloscope, qui ne charge pas le montage
      elements.push(E('circuit_ouvert', 'CO1', xs + 240, 20, 1), E('masse', 'GND3', xs + 240, 60));
      fils.push([xs, -20, xs + 80, -20], [xs + 80, -20, xs + 240, -20]);
      return { elements, fils };
    },
    oscillo: [{ nom: 'CO1', groupe: 1 }, { nom: 'V1', groupe: 2 }],
  },
  {
    id: 'decharges-partielles', titre: 'Décharges partielles dans un isolant',
    description: 'Modèle « abc » : la cavité d\'air CO1 (0,1 mm, claquage à 300 V) est en série avec l\'isolant sain C1 sous 1000 V crête. À chaque fois que la tension de la cavité atteint 300 V, elle claque et se vide ; C1 lui rend aussitôt une partie de sa tension à travers R1, puis la source la fait remonter : plusieurs décharges par alternance. La résistance de mesure R1 en donne les impulsions (≈ 300 V). Simulation ralentie ×0,1. Dans ⚙ de CO1 : épaisseur, rigidité, εr (qui change la capacité de la cavité, donc sa part de tension).',
    dt: 2e-5, vitesse: 0.1, fenetre: 0.05,
    elements: [
      E('source_ac', 'V1', 100, 200, 3, { V: 1000, f: 50, off: 0 }), E('masse', 'GND1', 100, 240),
      E('condensateur', 'C1', 200, 160, 0, { C: 1e-9 }),
      E('circuit_ouvert', 'CO1', 320, 160, 0, { claquage: true, d: 0.1, Ec: 3, er: 1, S: 1e4, ext: 10, Rarc: 100 }),
      E('resistance', 'R1', 400, 200, 1, { R: 220e3 }), E('masse', 'GND2', 400, 240),
    ],
    fils: [[100, 160, 160, 160], [240, 160, 280, 160], [360, 160, 400, 160]],
    oscillo: [{ nom: 'V1', groupe: 1 }, { nom: 'CO1', groupe: 2 }, { nom: 'R1', groupe: 3 }],
  },
  {
    id: 'transformateur', titre: 'Transformateur abaisseur 230 V → 12 V',
    description: 'Un transformateur à deux bobines (rapport N2 / N1 = 0,052) abaisse le secteur, 325 V crête, à ≈ 17 V crête (12 V efficaces) sur R1. Le secondaire est isolé du primaire : chaque côté a sa masse. Tournez la molette de T1 pour changer le rapport ; remplacez V1 par une pile : le continu ne passe pas.',
    dt: 5e-5, fenetre: 0.1,
    elements: [
      E('source_ac', 'V1', 100, 200, 3, { V: 325, f: 50, off: 0 }), E('masse', 'GND1', 100, 240),
      E('transformateur', 'T1', 240, 200, 0, { n: 0.052, L: 10, k: 0.999, Rp: 20, Rs: 0.2 }),
      E('resistance', 'R1', 360, 200, 1, { R: 100 }), E('masse', 'GND2', 360, 240),
    ],
    fils: [[100, 160, 200, 160], [200, 160, 200, 180], [100, 240, 200, 240], [200, 240, 200, 220],
      [280, 180, 280, 160], [280, 160, 360, 160], [280, 220, 280, 240], [280, 240, 360, 240]],
    oscillo: [{ nom: 'V1', groupe: 1 }, { nom: 'R1', groupe: 2 }],
  },
  /* ---------- Exemples de cours (ajoutés pour la page du site) ---------- */
  {
    id: 'filtre-rc', titre: 'Filtre RC passe-bas (fréquence de coupure)',
    description: 'R1 et C1 forment un filtre passe-bas : fc = 1 / (2π·R·C) ≈ 995 Hz. À 1 kHz, la source est juste à la coupure : la sortie (C1) vaut 71 % de l\'entrée (−3 dB) et retarde de 45°. Tournez la molette de V1 (fréquence) : en dessous de fc le signal passe, au-dessus il est atténué de 20 dB par décade. Simulation ralentie ×0,01.',
    dt: 1e-5, vitesse: 0.01, fenetre: 0.01,
    elements: [
      E('source_ac', 'V1', 100, 200, 3, { V: 5, f: 1000, off: 0 }), E('masse', 'GND1', 100, 240),
      E('resistance', 'R1', 200, 160, 0, { R: 1.6e3 }),
      E('condensateur', 'C1', 300, 200, 1, { C: 100e-9 }),
    ],
    fils: [[100, 160, 160, 160], [240, 160, 300, 160], [300, 240, 100, 240]],
    oscillo: [{ nom: 'V1', groupe: 1 }, { nom: 'C1', groupe: 1 }],
  },
  {
    id: 'rlc', titre: 'Circuit RLC série : oscillations amorties',
    description: 'À chaque front de l\'horloge, L1 et C1 échangent leur énergie : la tension de C1 oscille à f0 = 1 / (2π·√(L·C)) ≈ 503 Hz et s\'amortit avec la constante de temps 2·L / R ≈ 9 ms. Augmentez R1 : au-delà de 2·√(L / C) ≈ 632 Ω, il n\'y a plus d\'oscillation (régime apériodique). Simulation ralentie ×0,1.',
    dt: 2e-5, vitesse: 0.1, fenetre: 0.1,
    elements: [
      E('horloge', 'H1', 100, 200, 3, { V: 5, f: 10, rc: 50 }), E('masse', 'GND1', 100, 240),
      E('resistance', 'R1', 200, 160, 0, { R: 22 }),
      E('bobine', 'L1', 320, 160, 0, { L: 0.1 }),
      E('condensateur', 'C1', 420, 200, 1, { C: 1e-6 }),
    ],
    fils: [[100, 160, 160, 160], [240, 160, 280, 160], [360, 160, 420, 160], [420, 240, 100, 240]],
    oscillo: [{ nom: 'H1', groupe: 1 }, { nom: 'C1', groupe: 1 }],
  },
  {
    id: 'redresseur-pont', titre: 'Alimentation : transformateur, pont de diodes, filtrage',
    description: 'Le transformateur abaisse le secteur à ≈ 17 V crête ; le pont de 4 diodes redresse les deux alternances (deux diodes conduisent à la fois : 2 × 0,8 V de perdus) et C1 lisse la tension : ≈ 14 V continus sur R1 (15 V en crête), avec une ondulation à 100 Hz de 2 à 3 V, de l\'ordre de I / (2·f·C). Baissez C1 ou R1 : l\'ondulation grandit. Retirez C1 : on voit la tension redressée brute.',
    dt: 5e-5, fenetre: 0.1,
    elements: [
      E('source_ac', 'V1', 100, 200, 3, { V: 325, f: 50, off: 0 }), E('masse', 'GND1', 100, 240),
      E('transformateur', 'T1', 240, 200, 0, { n: 0.052, L: 10, k: 0.999, Rp: 20, Rs: 0.2 }),
      // pont : D1 et D2 vers le + (rail du haut), D3 et D4 depuis la masse (rail du bas)
      { ...E('diode', 'D1', 400, 120, 3), pastille: 'nom' }, { ...E('diode', 'D3', 400, 240, 3), pastille: 'nom' },
      { ...E('diode', 'D2', 500, 120, 3), pastille: 'nom' }, { ...E('diode', 'D4', 500, 240, 3), pastille: 'nom' },
      E('masse', 'GND2', 450, 280),
      E('condensateur', 'C1', 660, 160, 1, { C: 470e-6 }), E('masse', 'GND3', 660, 200),
      E('resistance', 'R1', 820, 160, 1, { R: 100 }), E('masse', 'GND4', 820, 200),
    ],
    fils: [[100, 160, 200, 160], [200, 160, 200, 180], [100, 240, 200, 240], [200, 240, 200, 220],
      [280, 180, 400, 180], [400, 160, 400, 180], [400, 180, 400, 200],
      [280, 220, 280, 320], [280, 320, 560, 320], [560, 320, 560, 180], [560, 180, 500, 180], [500, 160, 500, 180], [500, 180, 500, 200],
      [400, 80, 500, 80], [500, 80, 660, 80], [660, 80, 660, 120], [660, 80, 820, 80], [820, 80, 820, 120],
      [400, 280, 450, 280], [450, 280, 500, 280]],
    oscillo: [{ nom: 'R1', groupe: 1 }, { nom: 'V1', groupe: 2 }],
  },
  {
    id: 'chenillard', titre: 'Chenillard NE555 + CD4017',
    description: 'Ton projet « NE555 CD4017 » : le 555 en astable (≈ 3 Hz) cadence le CD4017, qui allume les LED l\'une après l\'autre. Q5 ramène le compteur à zéro : chenillard à 5 LED.',
    dt: 2e-4,
    elements: [
      E('pile', 'V1', 60, 320, 3, { V: 9 }), E('masse', 'GND1', 60, 580),
      E('resistance', 'RA', 200, 200, 1, { R: 10e3 }),
      E('resistance', 'RB', 200, 300, 1, { R: 47e3 }),
      E('condensateur', 'C1', 200, 400, 1, { C: 4.7e-6 }),
      E('puce:ne555', 'U1', 300, 300),
      E('puce:cd4017', 'U2', 500, 360),
      E('led', 'D1', 860, 420, 1, { couleur: 'rouge' }),
      E('led', 'D2', 800, 420, 1, { couleur: 'orange' }),
      E('led', 'D3', 740, 420, 1, { couleur: 'jaune' }),
      E('led', 'D4', 680, 420, 1, { couleur: 'vert' }),
      E('led', 'D5', 620, 420, 1, { couleur: 'bleu' }),
      E('resistance', 'R3', 920, 500, 1, { R: 470 }),
    ],
    fils: [
      [60, 280, 60, 160], [60, 160, 480, 160],                        // +9 V
      [280, 200, 280, 160], [300, 200, 300, 160], [480, 180, 480, 160],
      [200, 240, 200, 260], [200, 260, 240, 260],                      // DIS
      [240, 280, 220, 280], [220, 280, 220, 340], [240, 300, 220, 300], [220, 340, 200, 340], // THR = TRIG
      [200, 340, 200, 360], [200, 440, 200, 580],
      [280, 400, 280, 580],
      [360, 260, 380, 260], [380, 260, 380, 240], [380, 240, 440, 240], // OUT → CLK
      [440, 260, 420, 260], [420, 260, 420, 580],                       // INH à la masse
      [560, 340, 600, 340], [600, 340, 600, 560], [600, 560, 400, 560], [400, 560, 400, 280], [400, 280, 440, 280], // Q5 → RST
      [480, 540, 480, 580],
      [560, 240, 860, 240], [860, 240, 860, 380],
      [560, 260, 800, 260], [800, 260, 800, 380],
      [560, 280, 740, 280], [740, 280, 740, 380],
      [560, 300, 680, 300], [680, 300, 680, 380],
      [560, 320, 620, 320], [620, 320, 620, 380],
      [620, 460, 920, 460], [920, 540, 920, 580],
      [60, 360, 60, 580], [60, 580, 920, 580],                          // masse
    ],
    oscillo: [{ nom: 'C1' }, { nom: 'U1', broche: 'OUT' }],
  },
  {
    id: 'alim33', titre: 'Alimentation 3,3 V mesurée',
    description: 'Un AMS1117-3.3 alimente une charge (R2). L\'ACS712 mesure le courant tiré sur le 5 V : VIOUT = 2,5 V + 185 mV/A. Baissez R2 à la molette, ou la pile V1 sous 4,4 V pour voir le régulateur décrocher.',
    dt: 1e-4,
    elements: [
      E('pile', 'V1', 60, 300, 3, { V: 5 }), E('masse', 'GND1', 60, 660),
      E('puce:acs712-05b', 'U1', 300, 300),
      E('puce:ams1117-3.3', 'U2', 260, 560),
      E('resistance', 'R2', 400, 600, 1, { R: 10 }),
    ],
    fils: [
      [60, 260, 60, 160], [60, 160, 400, 160],
      [220, 240, 160, 240], [160, 240, 160, 160],                         // rail → IP+
      [220, 280, 140, 280], [140, 280, 140, 540], [140, 540, 180, 540],    // IP− → VIN
      [380, 240, 400, 240], [400, 240, 400, 160],                          // VCC du capteur
      [260, 400, 260, 420], [260, 420, 440, 420], [440, 420, 440, 660],    // GND du capteur
      [340, 540, 400, 540], [400, 540, 400, 560],                          // VOUT → charge
      [220, 620, 220, 660], [400, 640, 400, 660],
      [60, 340, 60, 660], [60, 660, 440, 660],
    ],
    oscillo: [{ nom: 'U1', broche: 'VIOUT' }, { nom: 'U2', broche: 'VOUT' }],
  },
  {
    id: 'moteur', titre: 'Commande tactile d\'un moteur',
    description: 'Maintenez le TTP223 appuyé : il met IN1 du DRV8871 à 1 et le pont en H alimente la charge en marche avant (LED verte). Fermez SW1 pour passer le TTP223 en mode bascule.',
    dt: 1e-4,
    elements: [
      E('pile', 'V1', 60, 300, 3, { V: 5 }), E('masse', 'GND1', 60, 600),
      E('interrupteur', 'SW1', 120, 200, 1, { ferme: false }),
      E('puce:ttp223', 'U1', 240, 300),
      E('puce:drv8871', 'U2', 480, 320),
      E('pile', 'V2', 760, 320, 3, { V: 12 }),
      E('resistance', 'R1', 600, 280, 0, { R: 470 }),
      E('led', 'D1', 660, 340, 1, { couleur: 'vert' }),
      E('led', 'D2', 720, 340, 3, { couleur: 'rouge' }),
    ],
    fils: [
      [60, 260, 60, 160], [60, 160, 220, 160], [220, 200, 220, 160],      // +5 V
      [120, 240, 120, 300], [120, 300, 180, 300],                          // SW1 → TOG
      [300, 260, 340, 260], [340, 260, 340, 280], [340, 280, 400, 280],    // Q → IN1
      [460, 220, 460, 200], [460, 200, 760, 200], [760, 200, 760, 280],    // +12 V → VM
      [640, 280, 660, 280], [660, 280, 660, 300], [660, 280, 720, 280], [720, 280, 720, 300], // OUT1 → R1 → LED
      [660, 380, 720, 380], [660, 380, 560, 380], [560, 380, 560, 300],    // → OUT2
      [220, 400, 220, 600], [460, 420, 460, 600], [500, 420, 500, 600], [760, 360, 760, 600],
      [60, 340, 60, 600], [60, 600, 760, 600],
    ],
    oscillo: [{ nom: 'U1', broche: 'Q' }, { nom: 'U2', broche: 'OUT1' }],
  },
  {
    id: 'opto', titre: 'Optocoupleur LTV-817',
    description: 'L\'horloge allume la LED infrarouge du LTV-817 une fois par seconde ; le phototransistor ferme alors le circuit de sortie et allume D1. Réglez le CTR de U1 dans ⚙.',
    dt: 1e-4,
    elements: [
      E('horloge', 'H1', 60, 300, 3, { V: 5, f: 1, rc: 50 }), E('masse', 'GND1', 60, 480),
      E('resistance', 'R1', 160, 260, 0, { R: 330 }),
      E('puce:ltv-817', 'U1', 300, 300),
      E('led', 'D1', 420, 280, 2, { couleur: 'vert' }),
      E('resistance', 'R2', 520, 280, 0, { R: 470 }),
      E('pile', 'V2', 600, 320, 3, { V: 5 }),
    ],
    fils: [
      [60, 260, 120, 260], [200, 260, 220, 260], [220, 260, 220, 280], [220, 280, 240, 280],
      [240, 300, 200, 300], [200, 300, 200, 480],
      [360, 280, 380, 280], [460, 280, 480, 280], [560, 280, 600, 280],
      [360, 300, 380, 300], [380, 300, 380, 480],
      [600, 360, 600, 480],
      [60, 340, 60, 480], [60, 480, 600, 480],
    ],
    oscillo: [{ nom: 'H1' }, { nom: 'U1', broche: 'C' }],
  },

  /* ---------- Horloge à quartz CD4060 + compteur de secondes 00 → 59 sur deux afficheurs ---------- */
  {
    id: 'horloge4060', titre: 'Horloge CD4060 + 7 segments',
    description: 'Quartz 32,768 kHz → CD4060 (÷16384 = 2 Hz) → CD4013 (÷2 = 1 Hz) → CD4518 (unités, dizaines) → 2 × CD4511 → 2 afficheurs. Le CD4081 remet les dizaines à 0 au passage à 60 : les secondes défilent de 00 à 59.',
    dt: 2e-3, vitesse: 1, fenetre: 4,
    oscillo: [{ nom: 'U1', broche: 'Q14' }, { nom: 'U2', broche: 'Q1' }],
    construire: plan(B => {
      B.E('pile', 'V1', -60, 300, 3, { V: 5 }); B.L('+5V', -60, 260, 1); B.M(-60, 340); B.F([-60, 340], [-20, 340]); B.L('GND', -20, 340, 2);
      // oscillateur : quartz + condensateurs de charge + résistance de polarisation
      B.E('puce:cd4060', 'U1', 280, 300);
      B.E('puce:quartz-32k', 'X1', 120, 260, 1, {}, { sansPastille: true });
      B.E('resistance', 'RF', 180, 260, 1, { R: 10e6 }, { pastille: 'valeur' });
      B.E('condensateur', 'C1', 60, 240, 1, { C: 22e-12 }, { pastille: 'valeur', inverse: true });
      B.E('condensateur', 'C2', 60, 360, 1, { C: 22e-12 }, { pastille: 'valeur', inverse: true });
      const phi = B.P('U1', 'PHI'), phob = B.P('U1', 'PHOB'), x1 = B.P('X1', 'X1'), x2 = B.P('X1', 'X2');
      B.F(phi, x1, [60, x1[1]]);
      B.F(phob, [200, phob[1]], [200, x2[1]], x2, [60, x2[1]]);
      B.F(B.P('RF', 'A'), [180, phi[1]]); B.F(B.P('RF', 'B'), [180, x2[1]]);
      B.MP('C1', 'B'); B.MP('C2', 'B'); B.MP('U1', 'RST'); B.LP('U1', 'VDD', '+5V', 'h', 0); B.MP('U1', 'VSS');
      // ÷2 : bascule D montée en diviseur (D = /Q)
      B.E('puce:cd4013', 'U2', 500, 300);
      const q14 = B.P('U1', 'Q14'), clk1 = B.P('U2', 'CLK1');
      B.F(q14, [380, q14[1]], [380, clk1[1]], clk1);
      const d1 = B.P('U2', 'D1'), q1b = B.P('U2', 'Q1B');
      B.F(q1b, [580, q1b[1]], [580, 120], [400, 120], [400, d1[1]], d1);
      const s1 = B.P('U2', 'S1'), r2 = B.P('U2', 'R2');
      B.F([420, s1[1]], [420, r2[1] + 20]); B.M(420, r2[1] + 20);
      for (const b of ['S1', 'R1', 'D2', 'CLK2', 'S2', 'R2']) { const p = B.P('U2', b); B.F(p, [420, p[1]]); }
      B.LP('U2', 'VDD', '+5V', 'h', 0); B.MP('U2', 'VSS');
      // compteurs BCD : unités (A) puis dizaines (B) cadencées par Q4 des unités
      B.E('puce:cd4518', 'U3', 760, 300);
      B.F(B.P('U2', 'Q1'), B.P('U3', 'CLKA'));
      B.LP('U3', 'ENA', '+5V'); B.LP('U3', 'RSTA', 'GND'); B.LP('U3', 'CLKB', 'GND'); B.LP('U3', 'ENB', 'U8'); B.LP('U3', 'RSTB', 'RAZ');
      ['U1', 'U2', 'U4', 'U8'].forEach((t, i) => B.LP('U3', `Q${i + 1}A`, t, 'd'));
      ['D1', 'D2', 'D4', 'D8'].forEach((t, i) => B.LP('U3', `Q${i + 1}B`, t, 'd'));
      B.LP('U3', 'VDD', '+5V', 'h', 0); B.MP('U3', 'VSS');
      // détection du « 6 » des dizaines (0110) : Q2 ET Q3 → RAZ
      B.E('puce:cd4081', 'U6', 760, 660);
      B.LP('U6', 'A', 'D2'); B.LP('U6', 'B', 'D4'); B.LP('U6', 'J', 'RAZ', 'd');
      const c6 = B.P('U6', 'C'), h6 = B.P('U6', 'H');
      B.F([680, c6[1]], [680, h6[1] + 20]); B.M(680, h6[1] + 20);
      for (const b of ['C', 'D', 'E', 'F', 'G', 'H']) { const p = B.P('U6', b); B.F(p, [680, p[1]]); }
      B.LP('U6', 'VDD', '+5V', 'h', 0); B.MP('U6', 'VSS');
      // décodeurs + réseaux de résistances + afficheurs (dizaines à gauche, unités à droite)
      const chaine = (x, bits, dec, rn, aff) => {
        B.E('puce:cd4511', dec, x, 300);
        B.E('puce:reseau-8r', rn, x + 120, 300, 0, { R: 270 });
        B.E('puce:afficheur-7seg-cc', aff, x + 260, 320, 0, { couleur: 'rouge' });
        ['A', 'B', 'C', 'D'].forEach((b, i) => B.LP(dec, b, bits[i]));
        B.LP(dec, 'LT', '+5V'); B.LP(dec, 'BL', '+5V'); B.LP(dec, 'LE', 'GND');
        B.LP(dec, 'VDD', '+5V', 'h', 0); B.MP(dec, 'VSS');
        B.MP(aff, 'COM'); B.MP(aff, 'COM2');
      };
      chaine(1060, ['D1', 'D2', 'D4', 'D8'], 'U5', 'RN2', 'AFF_D');
      chaine(1500, ['U1', 'U2', 'U4', 'U8'], 'U4', 'RN1', 'AFF_U');
    }),
  },

  /* ---------- Démodulation d'un signal composite : porteuse + tout-ou-rien + FM ---------- */
  {
    id: 'demod-rf', titre: 'Démodulation RF : porteuse, OOK et FM',
    description: 'Trois signaux additionnés (porteuse 5 kHz, OOK 16 kHz à 100 bit/s, FM 41,5 kHz ± 4 kHz) passent dans des circuits LC accordés. Détecteurs d\'enveloppe + LM2902 : LED « porteuse » et LED « données ». Deux circuits décalés (37,5 et 45,9 kHz) forment un discriminateur FM : la tension aux bornes de R_FM suit l\'excursion. Simulation au ralenti (×0,02).',
    dt: 1e-6, vitesse: 0.03, fenetre: 0.1,
    oscillo: [{ nom: 'CD_B' }, { nom: 'U1', broche: 'OUT2' }, { nom: 'R_FM' }, { nom: 'CD_A' }],
    construire: plan(B => {
      B.E('source_mod', 'S1', 40, 520, 3, { mode: 'porteuse', V: 2, fc: 5033 });
      B.E('source_mod', 'S2', 40, 440, 3, { mode: 'ook', V: 2, fc: 15915, fmod: 100, motif: '10110010' });
      B.E('source_mod', 'S3', 40, 360, 3, { mode: 'fm', V: 2, fc: 41500, dev: 4000, fmod: 25 });
      B.M(40, 560);
      B.F([40, 320], [40, 120], [1180, 120]);
      // une voie = R série + circuit LC parallèle accordé + diode + condensateur et résistance de détection
      const v = { pastille: 'valeur' };
      const voie = (x, suf, Rs, C, Cd, etiq) => {
        B.E('resistance', 'RS_' + suf, x, 160, 1, { R: Rs }, v);
        B.E('bobine', 'L_' + suf, x, 240, 1, { L: 10e-3 }, v); B.MP('L_' + suf, 'B');
        B.E('condensateur', 'C_' + suf, x + 80, 240, 1, { C }, v); B.MP('C_' + suf, 'B');
        B.F([x, 200], [x + 80, 200], [x + 100, 200]);
        B.E('diode', 'D_' + suf, x + 140, 200, 0, { Vf: 0.72 }, { sansPastille: true });
        B.E('condensateur', 'CD_' + suf, x + 180, 240, 1, { C: Cd }, v); B.MP('CD_' + suf, 'B');
        B.E('resistance', 'RD_' + suf, x + 260, 240, 1, { R: 100e3 }, v); B.MP('RD_' + suf, 'B');
        B.F([x + 180, 200], [x + 260, 200]);
        B.LP('RD_' + suf, 'A', etiq, 'h', 20);
      };
      voie(160, 'A', 4.7e3, 100e-9, 100e-9, 'ENV_P');
      voie(500, 'B', 10e3, 10e-9, 10e-9, 'ENV_OOK');
      voie(840, 'C1', 10e3, 1.2e-9, 10e-9, 'FM_H');
      voie(1180, 'C2', 10e3, 1.8e-9, 10e-9, 'FM_B');
      // discriminateur : différence des deux enveloppes FM
      B.E('resistance', 'R_FM', 760, 520, 0, { R: 1e6 });
      B.L('FM_H', 720, 520, 0); B.L('FM_B', 800, 520, 2);
      // comparateurs
      B.E('puce:lm2902', 'U1', 400, 560);
      B.LP('U1', 'IN1+', 'ENV_P'); B.LP('U1', 'IN1-', 'VTH'); B.LP('U1', 'IN2+', 'ENV_OOK'); B.LP('U1', 'IN2-', 'VTH');
      B.LP('U1', 'IN3+', 'GND'); B.LP('U1', 'IN3-', '+5V'); B.LP('U1', 'IN4+', 'GND'); B.LP('U1', 'IN4-', '+5V');
      B.LP('U1', 'VCC', '+5V', 'h', 0); B.MP('U1', 'GND');
      B.E('resistance', 'R1', 500, 440, 0, { R: 330 }); B.E('led', 'PORTEUSE', 580, 440, 0, { couleur: 'jaune' }); B.M(620, 440);
      B.E('resistance', 'R2', 500, 500, 0, { R: 330 }); B.E('led', 'DONNEES', 580, 500, 0, { couleur: 'vert' }); B.M(620, 500);
      // seuil de détection ≈ 0,76 V
      B.E('resistance', 'RT1', 200, 600, 1, { R: 56e3 }); B.L('+5V', 200, 560, 1);
      B.E('resistance', 'RT2', 200, 680, 1, { R: 10e3 }); B.M(200, 720);
      B.LP('RT1', 'B', 'VTH', 'g');
      // alimentation des comparateurs
      B.E('pile', 'V1', 40, 680, 3, { V: 5 }); B.L('+5V', 40, 640, 1); B.M(40, 720); B.F([40, 720], [80, 720]); B.L('GND', 80, 720, 2);
    }),
  },

  /* ---------- Capteur réflectif TCRT5000 + barre de LED LM3914 ---------- */
  {
    id: 'tcrt-lm3914', titre: 'TCRT5000 + LM3914 (barre de LED)',
    description: 'La LED infrarouge du TCRT5000 éclaire la surface ; le courant du phototransistor crée une tension sur RE, affichée par le LM3914 (10 LED, 125 mV par LED). Molette du TCRT5000 : distance ; clic : couleur de la surface.',
    dt: 1e-3, vitesse: 1, fenetre: 2,
    oscillo: [{ nom: 'U1', broche: 'E' }],
    construire: plan(B => planTcrt(B, false)),
  },
  {
    id: 'tcrt-objet', titre: 'TCRT5000 face à un objet réel (monde physique)',
    description: 'Même montage, mais la distance et la couleur viennent du monde physique : glissez le carton blanc sous le capteur (1 carreau = 2 mm), éloignez-le, ou remplacez-le par le ruban noir. Le faisceau infrarouge est dessiné en rouge.',
    dt: 1e-3, vitesse: 1, fenetre: 4, monde: { echelle: 0.002 },
    oscillo: [{ nom: 'U1', broche: 'E' }],
    construire: plan(B => planTcrt(B, true)),
  },

  /* ---------- Suiveur solaire 2 axes : 4 LDR, LM2902 en comparateurs à fenêtre, 2 × DRV8871 ---------- */
  {
    id: 'suiveur-solaire', titre: 'Suiveur solaire 2 axes (LM2902)',
    description: 'Deux ponts de photorésistances (Est/Ouest, Haut/Bas) donnent VX et VY ≈ 2,5 V quand le panneau vise le soleil. Le LM2902 compare chacune à une fenêtre 2,38 – 2,62 V : hors fenêtre, un DRV8871 fait tourner le moteur de l\'axe dans le bon sens. Molette de M1 : azimut du soleil ; ⚙ : soleil en mouvement.',
    dt: 1e-3, vitesse: 1, fenetre: 10,
    oscillo: [{ nom: 'M1', broche: 'E2', groupe: 1 }, { nom: 'M1', broche: 'H2', groupe: 1 }, { nom: 'U1', broche: 'OUT1', groupe: 2 }, { nom: 'U1', broche: 'OUT2', groupe: 2 },
      { nom: 'MAZ', variable: 'angle', groupe: 3 }, { nom: 'MEL', variable: 'angle', groupe: 3 }],
    construire: plan(B => planSuiveur(B, 'fixe')),
  },
  {
    id: 'suiveur-lampe', titre: 'Suiveur solaire et lampe à déplacer',
    description: 'Le même suiveur, éclairé par une lampe du monde physique : glissez la lampe à gauche, à droite, en haut, en bas, ou éloignez-la. La vue 3D de la monture montre le panneau qui la suit ; trop loin, la lumière directe devient trop faible devant la lumière ambiante et le panneau s\'arrête.',
    dt: 1e-3, vitesse: 1, fenetre: 10, monde: { echelle: 0.05 },
    oscillo: [{ nom: 'M1', broche: 'E2', groupe: 1 }, { nom: 'M1', broche: 'H2', groupe: 1 }, { nom: 'MAZ', variable: 'angle', groupe: 2 }, { nom: 'MEL', variable: 'angle', groupe: 2 }],
    construire: plan(B => planSuiveur(B, 'lampe du monde')),
  },

  /* ---------- Mécanique : servomoteur commandé en PWM, moteur à courant continu ---------- */
  {
    id: 'servo-moteur', titre: 'Servomoteur (PWM) et moteur CC',
    description: 'H1 envoie une impulsion toutes les 20 ms : ⚙ de H1, rapport cyclique 5 % (1 ms → 0°) à 10 % (2 ms → 180°), 7,5 % = 90°. Le servo rejoint la consigne à vitesse limitée. Fermez SW1 : le moteur CC accélère (constante de temps mécanique) puis tourne à vitesse constante ; montez son « couple résistant » à la molette. Les angles sont des variables publiées (rad) tracées à l\'oscilloscope ; clic droit → Vue 3D.',
    dt: 2e-5, vitesse: 0.25, fenetre: 0.5,
    oscillo: [{ nom: 'H1', groupe: 1 }, { nom: 'SV1', variable: 'angle', groupe: 2 }, { nom: 'SV1', variable: 'consigne', groupe: 2 }, { nom: 'MOT1', variable: 'vitesse', groupe: 3 }],
    construire: plan(B => {
      B.E('pile', 'V1', -60, 300, 3, { V: 5 }); B.L('+5V', -60, 260, 1); B.M(-60, 340);
      B.E('horloge', 'H1', 100, 300, 3, { V: 5, f: 50, rc: 7.5 }); B.M(100, 340); B.L('PWM', 100, 260, 1);
      B.E('puce:servo-pwm', 'SV1', 380, 300, 0, { axe: 'BRAS', angle0: 0 });
      B.LP('SV1', 'SIG', 'PWM', 'g', 40); B.LP('SV1', 'V+', '+5V', 'g', 40); B.LP('SV1', 'GND', 'GND', 'g', 40);
      B.F([-60, 340], [-20, 340]); B.L('GND', -20, 340, 2);
      B.E('interrupteur', 'SW1', 100, 520, 0, { ferme: false }); B.L('+5V', 60, 520, 0);
      B.E('puce:moteur-cc', 'MOT1', 300, 520, 0, { axe: 'ROUE', reduction: 30, angleMin: -36000, angleMax: 36000 });
      B.F(B.P('SW1', 'B'), B.P('MOT1', '+'));
      B.MP('MOT1', '-', 'd', 40);
    }),
  },

  /* ---------- Bus série : UART, SPI, I2C (bibliothèque FrWA.bus) ---------- */
  {
    id: 'bus-serie', titre: 'Bus série UART, SPI et I2C',
    description: 'Trois paires maître / esclave écrites avec la bibliothèque des signaux (règle R11). UART 9600 bit/s : le terminal affiche « Bonjour FrWA ». SPI mode 0 : l\'esclave reçoit A5 3C 01 et répond 42 43 44 (lu par le maître). I2C 10 kHz avec rappels de 4,7 kΩ : écriture de 12 34 56 au registre 0 de la mémoire @50, visible dans son afficheur ; passez le maître en « lecture » pour relire. Changez le débit d\'un seul côté de l\'UART : erreurs de trame.',
    dt: 4e-6, vitesse: 0.02, fenetre: 0.004,
    oscillo: [{ nom: 'U1', broche: 'TX', groupe: 1 }, { nom: 'U3', broche: 'SCK', groupe: 2 }, { nom: 'U3', broche: 'MOSI', groupe: 2 }, { nom: 'U4', broche: 'MISO', groupe: 2 },
      { nom: 'U5', broche: 'SCL', groupe: 3 }, { nom: 'U5', broche: 'SDA', groupe: 3 }],
    construire: plan(B => {
      B.E('pile', 'V1', -80, 300, 3, { V: 5 }); B.L('+5V', -80, 260, 1); B.M(-80, 340);
      const alim = n => { B.LP(n, 'VCC', '+5V', 'h', 0); B.MP(n, 'GND'); };
      B.E('puce:gen-uart', 'U1', 160, 100); alim('U1'); B.LP('U1', 'TX', 'TX', 'd');
      B.E('puce:terminal-uart', 'U2', 560, 100); alim('U2'); B.LP('U2', 'RX', 'TX', 'g');
      B.E('puce:gen-spi', 'U3', 160, 400); alim('U3');
      B.E('puce:sonde-spi', 'U4', 560, 400); alim('U4');
      for (const b of ['SCK', 'MOSI', 'MISO', 'CS']) { B.LP('U3', b, b, 'd'); B.LP('U4', b, b, 'g'); }
      B.E('puce:gen-i2c', 'U5', 160, 720); alim('U5');
      B.E('puce:memoire-i2c', 'U6', 600, 720); alim('U6');
      for (const b of ['SCL', 'SDA']) { B.LP('U5', b, b, 'd'); B.LP('U6', b, b, 'g'); }
      B.E('resistance', 'RP1', 360, 620, 1, { R: 4700 }, { pastille: 'valeur' }); B.L('+5V', 360, 580, 1); B.L('SCL', 360, 660, 3);
      B.E('resistance', 'RP2', 420, 620, 1, { R: 4700 }, { pastille: 'valeur' }); B.L('+5V', 420, 580, 1); B.L('SDA', 420, 660, 3);
    }),
  },

  /* ---------- Télécommande 433 MHz : HT12E + émetteur, récepteur + HT12D ---------- */
  {
    id: 'telecommande-433', titre: 'Télécommande 433 MHz (HT12E / HT12D)',
    description: 'Maintenez un bouton BP1 à BP4 : le HT12E envoie adresse + données, l\'émetteur 433 MHz rayonne (cercles orange, pointillés = portée). À 290 m, le récepteur reçoit ≈ −89 dBm ; le HT12D vérifie l\'adresse 3 fois puis allume la LED du bouton (mémorisée) et VT. Glissez le mur de béton entre les deux, ou éloignez le récepteur : le signal tombe dans le bruit.',
    dt: 25e-6, vitesse: 0.25, fenetre: 0.12, monde: { echelleRadio: 5, exposant: 3 },
    oscillo: [{ nom: 'U1', broche: 'DOUT' }, { nom: 'U3', broche: 'DATA' }, { nom: 'U4', broche: 'VT' }],
    construire: plan(B => {
      // ---- émetteur ----
      B.E('pile', 'V1', -60, 320, 3, { V: 5 }); B.L('+5V_E', -60, 280, 1); B.M(-60, 360); B.F([-60, 360], [-20, 360]); B.L('GND', -20, 360, 2);
      B.E('puce:ht12e', 'U1', 300, 320);
      const ADRESSE = [1, 0, 1, 1, 0, 0, 1, 0];
      ADRESSE.forEach((b, i) => B.LP('U1', 'A' + i, b ? '+5V_E' : 'GND'));
      ['AD8', 'AD9', 'AD10', 'AD11'].forEach((n, i) => B.LP('U1', n, 'B' + (8 + i)));
      B.LP('U1', 'TE', 'TE'); B.LP('U1', 'VDD', '+5V_E', 'h', 0); B.MP('U1', 'VSS');
      const o1 = B.P('U1', 'OSC1'), o2 = B.P('U1', 'OSC2');
      B.E('resistance', 'ROSC_E', o1[0] + 40, o1[1] + 40, 1, { R: 1.1e6 });
      B.F(o1, [o1[0] + 40, o1[1]]); B.F(o2, [o2[0] + 20, o2[1]], [o2[0] + 20, o1[1] + 80], [o1[0] + 40, o1[1] + 80]);
      B.E('puce:tx433', 'U2', 520, 200);
      B.F(B.P('U1', 'DOUT'), B.P('U2', 'DATA'));
      B.LP('U2', 'VCC', '+5V_E'); B.LP('U2', 'GND', 'GND');
      // clavier : rappel au +5 V, bouton vers la masse, diode qui active /TE
      [0, 1, 2, 3].forEach(k => {
        const x = 40 + 160 * k;
        B.E('resistance', 'RP' + (k + 1), x, 720, 1, { R: 10e3 }, { pastille: 'valeur' }); B.L('+5V_E', x, 680, 1);
        B.E('poussoir', 'BP' + (k + 1), x, 800, 1); B.M(x, 840);
        B.E('diode', 'DT' + (k + 1), x + 40, 760, 2, { Vf: 0.72 }, { sansPastille: true });
        B.L('B' + (8 + k), x, 760, 0);
        B.F([x + 80, 760], [x + 80, 640]);
      });
      B.F([120, 640], [600, 640]); B.L('TE', 600, 640, 2);
      // ---- obstacle à déplacer ----
      B.E('monde_objet', 'MUR', 1100, 560, 0, { matiere: 'béton', l: 2, h: 12 });
      // ---- récepteur (≈ 290 m plus loin avec 1 carreau = 5 m) ----
      B.E('pile', 'V2', 1560, 320, 3, { V: 5 }); B.L('+5V_R', 1560, 280, 1); B.M(1560, 360);
      B.E('puce:rx433', 'U3', 1800, 200);
      B.LP('U3', 'VCC', '+5V_R', 'd'); B.LP('U3', 'GND', 'GND', 'd');
      B.E('puce:ht12d', 'U4', 2100, 320);
      const data = B.P('U3', 'DATA'), din = B.P('U4', 'DIN');
      B.F(data, [1960, data[1]], [1960, din[1]], din);
      ADRESSE.forEach((b, i) => B.LP('U4', 'A' + i, b ? '+5V_R' : 'GND'));
      B.LP('U4', 'VDD', '+5V_R', 'h', 0); B.MP('U4', 'VSS');
      const q1 = B.P('U4', 'OSC1'), q2 = B.P('U4', 'OSC2');
      B.E('resistance', 'ROSC_R', q1[0] - 40, q1[1] + 40, 1, { R: 51e3 });
      B.F(q1, [q1[0] - 40, q1[1]]); B.F(q2, [q2[0] - 20, q2[1]], [q2[0] - 20, q1[1] + 80], [q1[0] - 40, q1[1] + 80]);
      // 4 LED (allumées quand la sortie est à 0 = bouton appuyé) + LED VT
      [0, 1, 2, 3].forEach(k => {
        const out = B.P('U4', 'D' + (8 + k)), x = 2480 - 80 * k;
        B.F(out, [x, out[1]], [x, 280]);
        B.E('resistance', 'RL' + (k + 1), x, 320, 1, { R: 330 }, { pastille: 'valeur' });
        B.E('led', 'L' + (k + 1), x, 400, 3, { couleur: ['rouge', 'jaune', 'vert', 'bleu'][k] });
        B.L('+5V_R', x, 440, 3);
      });
      const vt = B.P('U4', 'VT');
      B.F(vt, [vt[0] + 20, vt[1]], [vt[0] + 20, 500]);
      B.E('resistance', 'RVT', vt[0] + 20, 540, 1, { R: 330 }, { pastille: 'valeur' });
      B.E('led', 'VT', vt[0] + 20, 620, 1, { couleur: 'vert' }); B.M(vt[0] + 20, 660);
    }),
  },

  /* ---------- Sonar : 3 × NE555 + LM2902 + transducteurs 40 kHz ---------- */
  {
    id: 'sonar-ne555', titre: 'Sonar à ultrasons (3 × NE555, LM2902)',
    description: 'U1 donne des salves (0,5 ms toutes les 7,4 ms), U2 oscille à 40 kHz pendant chaque salve, l\'émetteur rayonne. L\'écho sur la planche revient au récepteur, amplifié ×480 par le LM2902, détecté puis comparé. U6 (bascule) passe à 1 à la fin de la salve et à 0 à l\'écho : la durée = temps de vol. Le voltmètre en donne la moyenne. Glissez la planche (1 carreau = 2 cm). Ralenti × 0,03.',
    dt: 1e-6, vitesse: 0.03, fenetre: 0.01, monde: { echelle: 0.02 },
    oscillo: [{ nom: 'U1', broche: 'OUT' }, { nom: 'U5', broche: 'OUT2' }, { nom: 'U5', broche: 'OUT3' }, { nom: 'U6', broche: 'OUT' }],
    construire: plan(B => {
      B.E('pile', 'V1', -80, 300, 3, { V: 9 }); B.L('+9V', -80, 260, 1); B.M(-80, 340); B.F([-80, 340], [-40, 340]); B.L('GND', -40, 340, 2);
      // astable NE555 : RA, RB, C (diode facultative en parallèle sur RB pour un rapport cyclique < 50 %)
      const astable = (nom, x, RA, RB, C, diode, reset, sortie) => {
        B.E('puce:ne555', nom, x, 300);
        B.E('resistance', 'RA_' + nom, x - 100, 200, 1, { R: RA }, { pastille: 'valeur' }); B.L('+9V', x - 100, 160, 1);
        B.F([x - 100, 240], [x - 100, 260], B.P(nom, 'DIS'));
        B.E('resistance', 'RB_' + nom, x - 100, 300, 1, { R: RB }, { pastille: 'valeur' });
        const thr = B.P(nom, 'THR'), trig = B.P(nom, 'TRIG');
        B.F(thr, [x - 80, thr[1]], [x - 80, 340], [x - 100, 340]); B.F(trig, [x - 80, trig[1]]);
        B.E('condensateur', 'C_' + nom, x - 100, 380, 1, { C }, { pastille: 'valeur' }); B.M(x - 100, 420);
        if (diode) { B.E('diode', 'D_' + nom, x - 140, 300, 1, { Vf: 0.72 }, { sansPastille: true }); B.F([x - 140, 260], [x - 100, 260]); B.F([x - 140, 340], [x - 100, 340]); }
        const vcc = B.P(nom, 'VCC'), rst = B.P(nom, 'RESET');
        B.F(vcc, [vcc[0], vcc[1] - 20]); B.L('+9V', vcc[0], vcc[1] - 20, 1);
        B.F(rst, [rst[0], rst[1] - 20], [rst[0] + 20, rst[1] - 20]); B.L(reset, rst[0] + 20, rst[1] - 20, 2);
        B.MP(nom, 'GND'); B.LP(nom, 'OUT', sortie, 'd');
      };
      astable('U1', 220, 6.8e3, 100e3, 100e-9, true, '+9V', 'SALVE');       // salves : 0,47 ms haut, 6,9 ms bas
      astable('U2', 580, 1e3, 15e3, 1e-9, false, 'SALVE', 'P40K');         // ≈ 40 kHz pendant les salves (RB = ajustable réglé sur la résonance)
      // transducteurs (face vers le haut) et planche
      B.E('puce:us-emetteur', 'U3', 900, 140); B.E('puce:us-recepteur', 'U4', 1020, 140);
      B.LP('U3', '+', 'P40K', 'b', 40); B.MP('U3', '-', 'b', 20);
      B.LP('U4', '+', 'US_RX', 'b', 40); B.LP('U4', '-', 'VREF', 'd', 20);
      B.E('monde_objet', 'PLANCHE', 960, -260, 0, { matiere: 'bois', l: 14, h: 1 });
      // demi-alimentation VREF = 4,5 V
      B.E('resistance', 'RV1', 1200, 560, 1, { R: 10e3 }, { pastille: 'valeur' }); B.L('+9V', 1200, 520, 1);
      B.E('resistance', 'RV2', 1200, 640, 1, { R: 10e3 }, { pastille: 'valeur' }); B.M(1200, 680);
      B.E('condensateur', 'CV', 1280, 640, 1, { C: 2.2e-6 }, { pastille: 'valeur' }); B.M(1280, 680);
      B.F([1200, 600], [1280, 600]); B.L('VREF', 1200, 600, 0);
      // seuil de l'écho = VREF + 0,6 V
      B.E('resistance', 'RS1', 1200, 800, 1, { R: 7.5e3 }, { pastille: 'valeur' }); B.L('+9V', 1200, 760, 1);
      B.E('resistance', 'RS2', 1200, 880, 1, { R: 10e3 }, { pastille: 'valeur' }); B.M(1200, 920);
      B.L('SEUIL', 1200, 840, 0);
      // LM2902 : 2 étages ×22, comparateur
      B.E('puce:lm2902', 'U5', 1500, 360);
      [['IN1+', 'US_RX'], ['IN1-', 'F1'], ['IN2+', 'A1'], ['IN2-', 'F2'], ['IN3+', 'ENV'], ['IN3-', 'SEUIL'], ['IN4+', 'GND'], ['IN4-', '+9V']].forEach(([b, t]) => B.LP('U5', b, t));
      [['OUT1', 'A1'], ['OUT2', 'A2'], ['OUT3', 'ECHO']].forEach(([b, t]) => B.LP('U5', b, t, 'd'));
      B.LP('U5', 'VCC', '+9V', 'h', 0); B.MP('U5', 'GND');
      const etage = (y, sortie, fb, g) => {
        B.E('resistance', 'RF_' + sortie, 1760, y, 0, { R: 100e3 }, { pastille: 'valeur' }); B.L(sortie, 1720, y, 0); B.L(fb, 1800, y, 2);
        B.E('resistance', 'RG_' + sortie, 1760, y + 60, 0, { R: 4.7e3 }, { pastille: 'valeur' }); B.L(fb, 1720, y + 60, 0);
        B.E('condensateur', 'CG_' + sortie, 1880, y + 60, 0, { C: 100e-9 }, { pastille: 'valeur' }); B.F([1800, y + 60], [1840, y + 60]); B.L('VREF', 1920, y + 60, 2);
      };
      etage(600, 'A1', 'F1'); etage(760, 'A2', 'F2');
      // détecteur de crête de l'écho
      B.E('diode', 'D_ENV', 1760, 920, 0, { Vf: 0.72 }, { sansPastille: true }); B.L('A2', 1720, 920, 0);
      B.E('condensateur', 'C_ENV', 1840, 960, 1, { C: 10e-9 }, { pastille: 'valeur' }); B.L('VREF', 1840, 1000, 3);
      B.E('resistance', 'R_ENV', 1920, 960, 1, { R: 100e3 }, { pastille: 'valeur' }); B.L('VREF', 1920, 1000, 3);
      B.F([1800, 920], [1920, 920]); B.L('ENV', 1800, 920, 1);
      // bascule NE555 : mise à 1 à la fin de la salve (front descendant dérivé), remise à 0 par l'écho
      B.E('puce:ne555', 'U6', 560, 760);
      const tr = B.P('U6', 'TRIG');
      B.E('condensateur', 'C_TRG', tr[0] - 60, tr[1], 0, { C: 1e-9 }, { pastille: 'valeur' }); B.F(tr, [tr[0] - 20, tr[1]]); B.L('SALVE', tr[0] - 100, tr[1], 0);
      B.E('resistance', 'R_TRG', tr[0] - 20, tr[1] + 40, 1, { R: 10e3 }, { pastille: 'valeur' }); B.L('+9V', tr[0] - 20, tr[1] + 80, 3);
      B.LP('U6', 'THR', 'ECHO', 'g', 60);
      const vcc6 = B.P('U6', 'VCC'), rst6 = B.P('U6', 'RESET');
      B.F(rst6, [rst6[0], rst6[1] - 20], [vcc6[0], vcc6[1] - 20], vcc6); B.L('+9V', vcc6[0], vcc6[1] - 20, 1);
      B.MP('U6', 'GND');
      const out6 = B.P('U6', 'OUT');
      B.E('resistance', 'R_MOY', out6[0] + 40, out6[1], 0, { R: 100e3 }, { pastille: 'valeur' });
      B.E('condensateur', 'C_MOY', out6[0] + 80, out6[1] + 40, 1, { C: 1e-6 }, { pastille: 'valeur' }); B.M(out6[0] + 80, out6[1] + 80);
      B.E('voltmetre', 'VM1', out6[0] + 160, out6[1]); B.F([out6[0] + 80, out6[1]], [out6[0] + 120, out6[1]]); B.M(out6[0] + 200, out6[1]);
    }),
  },

  /* ---------- Capteurs de climat analogiques ---------- */
  {
    id: 'climat-analogique', titre: 'Température et humidité (LM35, HIH-4030)',
    description: 'Le LM35 donne 10 mV/°C, le HIH-4030 une tension proportionnelle à l\'humidité (et à son alimentation). Glissez la source chaude et humide vers les capteurs (1 carreau = 5 cm) ou réglez-la à la molette : les voltmètres suivent.',
    dt: 1e-3, vitesse: 1, fenetre: 10, monde: { echelle: 0.05, tAmb: 20, hAmb: 50 },
    oscillo: [{ nom: 'U1', broche: 'VOUT' }, { nom: 'U2', broche: 'VOUT' }],
    construire: plan(B => {
      B.E('pile', 'V1', -60, 400, 3, { V: 5 }); B.L('+5V', -60, 360, 1); B.M(-60, 440);
      for (const [nom, type, y, vm] of [['U1', 'puce:lm35', 300, 'VM1'], ['U2', 'puce:hih4030', 520, 'VM2']]) {
        B.E(type, nom, 300, y);
        B.LP(nom, 'VS', '+5V'); B.MP(nom, 'GND');
        const o = B.P(nom, 'VOUT'); B.E('voltmetre', vm, o[0] + 80, o[1]); B.F(o, [o[0] + 40, o[1]]); B.M(o[0] + 120, o[1]);
      }
      B.E('monde_climat', 'CHAUFFE', 700, 420, 0, { temperature: 40, humidite: 85, rayon: 8 });
    }),
  },

  /* ---------- Pilotage externe : un programme (Python, C, IA, Arduino) envoie un signal, lit la réponse ---------- */
  {
    id: 'pilotage-rc', titre: 'Pilotage externe : filtre RC',
    description: 'X1 « Entrée externe » lit le canal A0 (écrit par Python, C/C++, une IA ou un Arduino via clients/, ou par la webcam / le micro depuis Simulation) ; X2 « Sortie externe » renvoie la tension du condensateur sur le canal S1. Essai : python3 clients/python/exemples/forme_onde.py. Sans programme, A0 vaut 0 : réglez « Valeur sans canal » de X1.',
    dt: 1e-5, vitesse: 0.1, fenetre: 0.01,
    oscillo: [{ nom: 'X1', broche: 'OUT', groupe: 1 }, { nom: 'X2', broche: 'IN', groupe: 1 }],
    construire: plan(B => {
      B.E('puce:entree-externe', 'X1', 100, 300, 0, { canal: 'A0' }); B.MP('X1', 'GND');
      B.E('resistance', 'R1', 300, 300, 0, { R: 1000 });
      B.F(B.P('X1', 'OUT'), B.P('R1', 'A'));
      B.E('condensateur', 'C1', 400, 360, 1, { C: 1e-6 });
      B.F(B.P('R1', 'B'), B.P('C1', 'A')); B.MP('C1', 'B');
      B.E('puce:sortie-externe', 'X2', 560, 300, 0, { canal: 'S1' });
      B.F(B.P('C1', 'A'), [B.P('C1', 'A')[0], B.P('X2', 'IN')[1]], B.P('X2', 'IN')); B.MP('X2', 'GND');
    }),
  },
  /* ---------- Chaîne audio : micro du PC → filtre actif → ampli → haut-parleur du PC (Python) ---------- */
  {
    id: 'audio-micro-hp', titre: 'Audio : micro → filtre actif → LM386 → haut-parleur',
    description: 'Le son du micro du PC arrive sur X1 (canal « micro_pcm », 20 mV pleine échelle) par clients/python/exemples/micro_filtre_hp.py, qui rejoue le canal « hp » sur le haut-parleur du PC. U1A : passe-haut de Sallen-Key (C1, C2, RA, RB : 340 Hz) ; U1B : passe-bas (R3, R4, C3, C4 : 3,4 kHz) ; U2A : gain 1 + RF / RG (×23) ; U3 : LM386 (×20 ; ×200 avec 10 µF entre GAIN1 et GAIN8) ; HP1 : 8 Ω. Changez RA = RB, R3 = R4 ou RF avec la molette : on entend tout de suite la différence. Analyse : bouton « spectre » de l\'oscilloscope.',
    dt: 6.25e-5, vitesse: 1, fenetre: 0.02,
    oscillo: [{ nom: 'X1', broche: 'OUT', groupe: 1 }, { nom: 'U2', broche: 'OUT1', groupe: 2 }, { nom: 'HP1', broche: '+', groupe: 3 }],
    construire: plan(B => {
      B.E('pile', 'V1', -260, 300, 3, { V: 12 }); B.LP('V1', '+', '+12V', 'h'); B.MP('V1', '−');
      B.E('pile', 'V2', -160, 300, 1, { V: 12 }); B.LP('V2', '−', '−12V', 'h'); B.MP('V2', '+');
      B.E('pile', 'V3', -60, 300, 3, { V: 9 }); B.LP('V3', '+', '+9V', 'h'); B.MP('V3', '−');
      B.E('puce:entree-externe', 'X1', 60, 300, 0, { canal: 'micro_pcm', gain: 0.02 }); B.LP('X1', 'OUT', 'MIC', 'd'); B.MP('X1', 'GND');
      // passe-haut de Sallen-Key, gain 1 : fc = 1 / (2π·R·C) avec RA = RB, C1 = C2
      B.E('condensateur', 'C1', 260, 200, 0, { C: 47e-9 }); B.LP('C1', 'A', 'MIC', 'g'); B.LP('C1', 'B', 'HA', 'd');
      B.E('condensateur', 'C2', 420, 200, 0, { C: 47e-9 }); B.LP('C2', 'A', 'HA', 'g'); B.LP('C2', 'B', 'HB', 'd');
      B.E('resistance', 'RA', 340, 100, 0, { R: 10e3 }); B.LP('RA', 'A', 'HA', 'g'); B.LP('RA', 'B', 'F1', 'd');
      B.E('resistance', 'RB', 540, 300, 1, { R: 10e3 }); B.LP('RB', 'A', 'HB', 'h'); B.MP('RB', 'B');
      // passe-bas de Sallen-Key, gain 1
      B.E('resistance', 'R3', 260, 480, 0, { R: 4.7e3 }); B.LP('R3', 'A', 'F1', 'g'); B.LP('R3', 'B', 'LA', 'd');
      B.E('resistance', 'R4', 420, 480, 0, { R: 4.7e3 }); B.LP('R4', 'A', 'LA', 'g'); B.LP('R4', 'B', 'LB', 'd');
      B.E('condensateur', 'C3', 340, 380, 0, { C: 10e-9 }); B.LP('C3', 'A', 'LA', 'g'); B.LP('C3', 'B', 'F2', 'd');
      B.E('condensateur', 'C4', 540, 580, 1, { C: 10e-9 }); B.LP('C4', 'A', 'LB', 'h'); B.MP('C4', 'B');
      B.E('puce:ne5532', 'U1', 760, 300);
      B.LP('U1', 'OUT1', 'F1', 'g'); B.LP('U1', 'IN1-', 'F1', 'g', 60); B.LP('U1', 'IN1+', 'HB', 'g'); B.LP('U1', 'V-', '−12V', 'g', 60);
      B.LP('U1', 'V+', '+12V', 'd'); B.LP('U1', 'OUT2', 'F2', 'd', 60); B.LP('U1', 'IN2-', 'F2', 'd'); B.LP('U1', 'IN2+', 'LB', 'd', 60);
      // amplification : non-inverseur, gain 1 + RF / RG
      B.E('puce:ne5532', 'U2', 760, 620);
      B.LP('U2', 'OUT1', 'AMP', 'g'); B.LP('U2', 'IN1-', 'GN', 'g', 60); B.LP('U2', 'IN1+', 'F2', 'g'); B.LP('U2', 'V-', '−12V', 'g', 60);
      B.LP('U2', 'V+', '+12V', 'd'); B.LP('U2', 'OUT2', 'S2', 'd', 60); B.LP('U2', 'IN2-', 'S2', 'd'); B.MP('U2', 'IN2+', 'd', 60);
      B.E('resistance', 'RF', 760, 780, 0, { R: 22e3 }); B.LP('RF', 'A', 'GN', 'g'); B.LP('RF', 'B', 'AMP', 'd');
      B.E('resistance', 'RG', 600, 860, 1, { R: 1e3 }); B.LP('RG', 'A', 'GN', 'h'); B.MP('RG', 'B');
      // ampli de puissance et haut-parleur
      B.E('puce:lm386', 'U3', 1120, 300);
      B.LP('U3', 'IN+', 'AMP', 'g', 60); B.MP('U3', 'IN-', 'g', 20); B.MP('U3', 'GND', 'g', 60);
      B.LP('U3', 'VS', '+9V', 'd', 60); B.LP('U3', 'VOUT', 'OUT', 'd'); B.LP('U3', 'BYPASS', 'BYP', 'd');
      B.E('condensateur', 'CB', 1320, 160, 1, { C: 10e-6 }); B.LP('CB', 'A', 'BYP', 'h'); B.MP('CB', 'B');
      B.E('condensateur', 'CO', 1340, 440, 0, { C: 220e-6 }); B.LP('CO', 'A', 'OUT', 'g'); B.LP('CO', 'B', 'HPP', 'd');
      B.E('puce:haut-parleur', 'HP1', 1520, 460); B.LP('HP1', '+', 'HPP', 'g'); B.MP('HP1', '-', 'g', 20);
    }),
  },
  /* ---------- ALI : bistable (±V) et monostable (V+ / GND) ---------- */
  {
    id: 'ali-bistable', titre: 'ALI ±12 V en bistable (trigger de Schmitt)',
    description: 'Comparateur inverseur à réaction positive : R2 / R1 ramènent une fraction de la sortie sur IN+, d\'où deux seuils (±Vsat·R1/(R1+R2) ≈ ±5,25 V) et une hystérésis. Le sinus de 10 V fait basculer la sortie en créneaux ; réglez l\'amplitude de VS sous 5 V : la sortie ne bascule plus.',
    dt: 1e-5, vitesse: 0.1, fenetre: 0.06,
    oscillo: [{ nom: 'VS', groupe: 1 }, { nom: 'U1', broche: 'IN1+', groupe: 1 }, { nom: 'U1', broche: 'OUT1' }],
    construire: plan(B => {
      B.E('pile', 'V1', -40, 300, 3, { V: 12 }); B.LP('V1', '+', '+12V', 'h'); B.MP('V1', '−');
      B.E('pile', 'V2', 60, 300, 1, { V: 12 }); B.LP('V2', '−', '−12V', 'h'); B.MP('V2', '+');
      B.E('source_ac', 'VS', 180, 300, 3, { V: 10, f: 50 }); B.LP('VS', '+', 'E', 'h'); B.MP('VS', '−');
      B.E('puce:ali-symetrique', 'U1', 420, 300);
      B.LP('U1', 'V+', '+12V', 'h'); B.LP('U1', 'V-', '−12V', 'b');
      B.LP('U1', 'IN1-', 'E', 'g', 40); B.LP('U1', 'IN1+', 'P', 'g', 40); B.LP('U1', 'OUT1', 'S', 'd', 40);
      B.E('resistance', 'R2', 420, 160, 0, { R: 10e3 }); B.LP('R2', 'A', 'P', 'g'); B.LP('R2', 'B', 'S', 'd');
      B.E('resistance', 'R1', 300, 460, 1, { R: 10e3 }); B.LP('R1', 'A', 'P', 'h'); B.MP('R1', 'B');
    }),
  },
  {
    id: 'ali-monostable', titre: 'ALI V+ / GND en monostable',
    description: 'Alimentation simple 5 V. Au repos IN+ (tiré à la masse par R1) < IN− (VCC/2) : sortie basse. Un appui bref sur BP1 fait passer la sortie haute ; le saut est recopié par C1 sur IN+, qui redescend par R1 : la sortie retombe quand IN+ repasse sous VCC/2, après T ≈ R1·C1·ln 2 ≈ 0,7 s, quelle que soit la durée de l\'appui (s\'il est plus court que T).',
    dt: 1e-4, vitesse: 1, fenetre: 2,
    oscillo: [{ nom: 'U1', broche: 'IN1+', groupe: 1 }, { nom: 'U1', broche: 'IN1-', groupe: 1 }, { nom: 'U1', broche: 'OUT1' }],
    construire: plan(B => {
      B.E('pile', 'V1', -40, 300, 3, { V: 5 }); B.LP('V1', '+', '+5V', 'h'); B.MP('V1', '−');
      B.E('puce:ali-simple', 'U1', 420, 300);
      B.LP('U1', 'V+', '+5V', 'h'); B.MP('U1', 'GND');
      B.LP('U1', 'IN1-', 'REF', 'g', 40); B.LP('U1', 'IN1+', 'P', 'g', 40); B.LP('U1', 'OUT1', 'S', 'd', 40);
      B.E('resistance', 'R3', 100, 220, 1, { R: 10e3 }); B.LP('R3', 'A', '+5V', 'h'); B.LP('R3', 'B', 'REF', 'b');
      B.E('resistance', 'R4', 100, 380, 1, { R: 10e3 }); B.LP('R4', 'A', 'REF', 'h'); B.MP('R4', 'B');
      B.E('resistance', 'R1', 220, 460, 1, { R: 100e3 }); B.LP('R1', 'A', 'P', 'h'); B.MP('R1', 'B');
      B.E('condensateur', 'C1', 420, 160, 0, { C: 10e-6 }); B.LP('C1', 'A', 'P', 'g'); B.LP('C1', 'B', 'S', 'd');
      B.E('poussoir', 'BP1', 220, 140, 1); B.LP('BP1', 'A', '+5V', 'h');
      B.E('resistance', 'R5', 220, 240, 1, { R: 1e3 }); B.F(B.P('BP1', 'B'), B.P('R5', 'A')); B.LP('R5', 'B', 'P', 'b');
      B.E('resistance', 'R6', 640, 300, 1, { R: 330 }); B.LP('R6', 'A', 'S', 'h');
      B.E('led', 'D1', 640, 420, 1, { couleur: 'vert' }); B.F(B.P('R6', 'B'), B.P('D1', 0)); B.MP('D1', 1);
    }),
  },
];

/* Montages réutilisés par plusieurs exemples (déclarations « hissées » : utilisables plus haut) */
G.FrWAPlan = plan;   // constructeur de schémas, réutilisé par etudes.js

function planTcrt(B, monde) {
  B.E('pile', 'V1', -60, 300, 3, { V: 5 }); B.L('+5V', -60, 260, 1); B.M(-60, 340);
  B.E('puce:tcrt5000', 'U1', 200, 300, 0, { distance: 3, surface: 'blanc', source: monde ? 'monde physique' : 'réglages' });
  B.E('resistance', 'R1', 80, 180, 1, { R: 180 }); B.L('+5V', 80, 140, 1);
  const a = B.P('U1', 'A'); B.F(B.P('R1', 'B'), [80, a[1]], a);
  B.MP('U1', 'K', 'g', 20);
  B.LP('U1', 'C', '+5V', 'd');
  B.E('puce:lm3914', 'U2', 560, 360);
  const e = B.P('U1', 'E'), sig = B.P('U2', 'SIG');
  B.E('resistance', 'RE', 360, sig[1] + 40, 1, { R: 180 }); B.MP('RE', 'B');
  B.F(e, sig);
  const rhi = B.P('U2', 'RHI'), ref = B.P('U2', 'REFOUT');
  B.F(rhi, [rhi[0] - 20, rhi[1]], [rhi[0] - 20, ref[1]], ref);
  B.E('resistance', 'R_PROG', rhi[0] - 40, ref[1] + 40, 1, { R: 1200 });
  B.F(B.P('R_PROG', 'A'), [rhi[0] - 20, ref[1]]); B.MP('R_PROG', 'B');
  const vp = B.P('U2', 'V+'), mode = B.P('U2', 'MODE');
  B.F(vp, [vp[0], vp[1] - 20], [mode[0], mode[1] - 20], mode); B.L('+5V', vp[0], vp[1] - 20, 1);
  B.MP('U2', 'V-'); B.MP('U2', 'RLO'); B.MP('U2', 'REFADJ');
  B.E('puce:bargraph-10', 'BG1', 740, 360, 0, { couleur: 'vert' });
  const a10 = B.P('BG1', 'A10'), a1 = B.P('BG1', 'A1');
  B.F(a10, a1); B.L('+5V', a10[0], a10[1], 1);
  if (monde) {   // face du capteur à y = 380 ; 10 px = 1 mm : carton à 2,5 mm
    B.E('monde_objet', 'CARTON', 200, 415, 0, { matiere: 'carton blanc', l: 8, h: 1 });
    B.E('monde_objet', 'RUBAN', 200, 600, 0, { matiere: 'papier noir', l: 8, h: 1 });
  }
}
function planSuiveur(B, SOLEIL) {
  B.E('pile', 'V1', 40, 300, 3, { V: 5 }); B.L('+5V', 40, 260, 1); B.M(40, 340); B.F([40, 340], [80, 340]); B.L('GND', 80, 340, 2);
  B.E('pile', 'V2', 40, 500, 3, { V: 12 }); B.L('+12V', 40, 460, 1); B.M(40, 540);
  // fenêtre : 10 k / 1 k / 10 k → VH = 2,62 V, VL = 2,38 V
  B.E('resistance', 'RA', 200, 200, 1, { R: 10e3 }); B.L('+5V', 200, 160, 1);
  B.E('resistance', 'RB', 200, 280, 1, { R: 1e3 });
  B.E('resistance', 'RC', 200, 360, 1, { R: 10e3 }); B.M(200, 400);
  B.LP('RA', 'B', 'VH', 'g'); B.LP('RC', 'A', 'VL', 'g');
  B.E('puce:lm2902', 'U1', 420, 320);
  [['IN1+', 'VX'], ['IN1-', 'VH'], ['IN2+', 'VL'], ['IN2-', 'VX'], ['IN3+', 'VY'], ['IN3-', 'VH'], ['IN4+', 'VL'], ['IN4-', 'VY']].forEach(([b, t]) => B.LP('U1', b, t));
  [['OUT1', 'X_AV'], ['OUT2', 'X_AR'], ['OUT3', 'Y_AV'], ['OUT4', 'Y_AR']].forEach(([b, t]) => B.LP('U1', b, t, 'd'));
  B.LP('U1', 'VCC', '+5V', 'h', 0); B.MP('U1', 'GND');
  B.E('puce:monture-solaire-2axes', 'M1', 900, 320, 0, { solAz: 35, solEl: 50, soleil: SOLEIL });
  B.LP('M1', 'E1', '+5V'); B.LP('M1', 'O2', 'GND'); B.LP('M1', 'H1', '+5V'); B.LP('M1', 'B2', 'GND');
  for (const [p, q, t] of [['E2', 'O1', 'VX'], ['H2', 'B1', 'VY']]) {
    const a = B.P('M1', p), b = B.P('M1', q);
    B.F(a, [a[0] - 20, a[1]], [a[0] - 20, b[1]], b); B.L(t, a[0] - 20, a[1], 0);
  }
  // moteurs réels (règle R10) : ils publient l'angle de leur arbre sur les axes AZ et EL, que la monture lit
  B.E('puce:moteur-cc', 'MAZ', 1760, 260, 0, { axe: 'AZ', angle0: -40, angleMin: -90, angleMax: 90 });
  B.E('puce:moteur-cc', 'MEL', 1760, 520, 0, { axe: 'EL', angle0: 20, angleMin: 0, angleMax: 90 });
  B.LP('MAZ', '+', 'MX+', 'g'); B.LP('MAZ', '-', 'MX-', 'd'); B.LP('MEL', '+', 'MY+', 'g'); B.LP('MEL', '-', 'MY-', 'd');
  if (SOLEIL === 'lampe du monde') B.E('monde_lumiere', 'LAMPE', 1050, 60, 0, { cd: 2000 });
  const drv = (nom, y, av, ar, mp, mm) => {
    B.E('puce:drv8871', nom, 1420, y);
    B.LP(nom, 'IN1', av); B.LP(nom, 'IN2', ar);
    const il = B.P(nom, 'ILIM'); B.E('resistance', 'RIL_' + nom, il[0] - 20, il[1] + 40, 1, { R: 62e3 }); B.F(il, [il[0] - 20, il[1]]); B.MP('RIL_' + nom, 'B');
    B.LP(nom, 'OUT1', mp, 'd'); B.LP(nom, 'OUT2', mm, 'd');
    B.LP(nom, 'VM', '+12V', 'h', 0); B.MP(nom, 'GND'); B.MP(nom, 'PGND');
  };
  drv('U2', 260, 'X_AV', 'X_AR', 'MX+', 'MX-');
  drv('U3', 520, 'Y_AV', 'Y_AR', 'MY+', 'MY-');
}
})(window);
