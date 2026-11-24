// Composants discrets ajoutés pour l'étude « démodulation de tonalités à référence 6 kHz » (2026-11-24) :
// MOSFET de commutation (BS170, IRLZ44N, IRF4905 canal P), diode zener, TVS SMBJ18A, double diode BAV99,
// fusible (i²t), régulateur à faible chute LM2940-9 protégé contre l'inversion.
// Modèles comportementaux : ils reproduisent la commutation, les seuils et les protections, pas chaque effet du
// composant réel (pas de zone de saturation du MOSFET, pas de limitation de courant du régulateur).
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const BASE = { version: '1.0.0', regles: 1, modele3d: null };

/* ---------- MOSFET de commutation ----------
   Canal drain-source = résistance réglée à chaque pas d'après VGS : bloqué (100 MΩ) sous Vth, Rds(on) à partir de
   VGS = Vplein, entre les deux R = Rds(on)·(Vplein − Vth)/(VGS − Vth) ; moyenne géométrique avec le pas précédent
   (pas d'oscillation numérique). Diode interne (body diode) et capacité d'entrée Ciss entre grille et source. */
function mosfet(o) {
  const pol = o.p ? -1 : 1;
  FrWA.puce({
    ...BASE, id: o.id, nom: o.nom, prefixe: 'Q', categorie: 'Transistors MOSFET', tags: ['semi-conducteur', 'mosfet', ...(o.tags || [])],
    description: o.description,
    broches: ['G', 'D', 'S'], typesBroches: { entree: ['G'], passif: ['D', 'S'] },
    cotes: o.p ? { gauche: ['G'], haut: ['S'], bas: ['D'] } : { gauche: ['G'], haut: ['D'], bas: ['S'] },
    parametres: [
      { cle: 'Vth', nom: o.p ? 'Seuil |VGS(th)|' : 'Seuil VGS(th)', unite: 'V', defaut: o.Vth, min: 0.3, max: 6, echelle: 'lin', pas: 0.05 },
      { cle: 'Vplein', nom: o.p ? '|VGS| de pleine conduction' : 'VGS de pleine conduction', unite: 'V', defaut: o.Vplein, min: 1, max: 20, echelle: 'lin', pas: 0.1 },
      { cle: 'Rdson', nom: 'Rds(on)', unite: 'Ω', defaut: o.Rdson, min: 1e-3, max: 100, echelle: 'log' },
      { cle: 'Ciss', nom: 'Capacité d\'entrée Ciss', unite: 'F', defaut: o.Ciss, min: 1e-12, max: 1e-7, echelle: 'log' },
    ], principal: 'Rdson',
    variables: [{ cle: 'rds', nom: 'Résistance drain-source', unite: 'Ω' }, { cle: 'vgs', nom: 'Tension grille-source', unite: 'V' }],
    modele: {
      elements: [
        { t: 'R', a: 'D', b: 'S', R: 1e8, nom: 'canal' },
        o.p ? { t: 'D', a: 'D', b: 'S', Vf: 0.8, If: 1 } : { t: 'D', a: 'S', b: 'D', Vf: 0.8, If: 1 },
        { t: 'C', a: 'G', b: 'S', C: '$Ciss', euler: true },
      ],
      etat: () => ({ rds: 1e8, vgs: 0 }),
      pas(c) {
        const p = c.p, s = c.s, v = pol * (c.v('G') - c.v('S'));
        s.vgs = c.v('G') - c.v('S');
        const cible = v <= p.Vth ? 1e8 : Math.min(1e8, Math.max(p.Rdson, p.Rdson * (p.Vplein - p.Vth) / (v - p.Vth)));
        s.rds = Math.exp(0.5 * Math.log(s.rds) + 0.5 * Math.log(cible));
        c.regler('canal', s.rds);
      },
    },
    affichage: s => (s.rds < 1e3 ? 'passant' : s.rds > 1e7 ? 'bloqué' : 'linéaire'),
  });
}
mosfet({ id: 'bs170', nom: 'BS170', Vth: 2.1, Vplein: 10, Rdson: 1.2, Ciss: 24e-12, tags: ['basic'],
  description: 'MOSFET canal N petits signaux, TO-92 : 60 V, 0,5 A, Rds(on) ≈ 1,2 Ω à VGS = 10 V, seuil ≈ 2,1 V. Commande de relais ou de LED depuis une sortie CMOS.' });
mosfet({ id: 'irlz44n', nom: 'IRLZ44N', Vth: 1.5, Vplein: 5, Rdson: 0.022, Ciss: 1.7e-9,
  description: 'MOSFET canal N de puissance « logic level », TO-220 : 55 V, 47 A, Rds(on) 22 mΩ à VGS = 5 V. Phases de moteur pas à pas, charges inductives (diode de roue libre externe).' });
mosfet({ id: 'irf4905', nom: 'IRF4905', p: true, Vth: 3, Vplein: 10, Rdson: 0.02, Ciss: 3.4e-9,
  description: 'MOSFET canal P de puissance, TO-220 : −55 V, −74 A, Rds(on) 20 mΩ à VGS = −10 V. Interrupteur côté positif, protection contre l\'inversion de batterie (drain côté batterie, grille à la masse).' });

/* ---------- Diode zener et TVS : diode directe + diode inverse de tension Vz ---------- */
FrWA.puce({
  ...BASE, id: 'zener', nom: 'ZENER', prefixe: 'D', categorie: 'Diodes', tags: ['semi-conducteur', 'protection', 'alimentation', 'basic'],
  description: 'Diode zener : conduit en direct comme une diode, et en inverse au-delà de Vz (tension réglée au courant Iz). Référence de tension, protection de grille de MOSFET.',
  broches: ['A', 'K'], typesBroches: { passif: ['A', 'K'] }, cotes: { gauche: ['A'], droite: ['K'] },
  parametres: [
    { cle: 'Vz', nom: 'Tension zener', unite: 'V', defaut: 15, min: 1.8, max: 200, echelle: 'log' },
    { cle: 'Iz', nom: 'Courant de mesure de Vz', unite: 'A', defaut: 5e-3, min: 1e-5, max: 1, echelle: 'log' },
  ], principal: 'Vz', variables: [],
  modele: { elements: [
    { t: 'D', a: 'A', b: 'K', Vf: 0.75, If: 0.01 },
    { t: 'D', a: 'K', b: 'A', Vf: '$Vz', If: '$Iz', N: 1.5 },
  ] },
  affichage: (s, p) => 'Vz ' + FrWA.formater(p.Vz, 'V'),
});
FrWA.puce({
  ...BASE, id: 'smbj18a', nom: 'SMBJ18A', prefixe: 'D', categorie: 'Diodes', tags: ['semi-conducteur', 'protection'],
  description: 'Diode TVS unidirectionnelle 600 W : tension de veille 18 V (ne conduit pas), claquage ≈ 20 V à 1 mA, écrêtage ≈ 29 V à 20 A. Absorbe les surtensions de coupure des moteurs sur une alimentation 12 V.',
  broches: ['A', 'K'], typesBroches: { passif: ['A', 'K'] }, cotes: { gauche: ['A'], droite: ['K'] },
  parametres: [{ cle: 'Vbr', nom: 'Tension de claquage (1 mA)', unite: 'V', defaut: 20.5, min: 5, max: 500, echelle: 'log' }],
  principal: 'Vbr', variables: [],
  modele: { elements: [
    { t: 'D', a: 'A', b: 'K', Vf: 0.9, If: 1 },
    { t: 'D', a: 'K', b: 'A', Vf: '$Vbr', If: 1e-3, N: 33 },
  ] },
});
FrWA.puce({
  ...BASE, id: 'bav99', nom: 'BAV99', prefixe: 'D', categorie: 'Diodes', tags: ['semi-conducteur', 'protection'],
  description: 'Deux diodes de commutation rapides en série (SOT-23) : broche 1 = anode de D1, broche 2 = cathode de D2, broche 3 = point commun (cathode de D1, anode de D2). Écrêtage d\'une entrée entre la masse (broche 1) et l\'alimentation (broche 2).',
  broches: [{ nom: 'A1', etiquette: 'A' }, { nom: 'K2', etiquette: 'K' }, { nom: 'COM', etiquette: 'K/A' }],
  typesBroches: { passif: ['A1', 'K2', 'COM'] }, cotes: { bas: ['A1'], haut: ['K2'], gauche: ['COM'] },
  variables: [],
  modele: { elements: [{ t: 'D', a: 'A1', b: 'COM', Vf: 0.85, If: 0.01 }, { t: 'D', a: 'COM', b: 'K2', Vf: 0.85, If: 0.01 }] },
});

/* ---------- Fusible : fond quand ∫(I² − In²)·dt dépasse son i²t (refroidissement τ = 1 s) ; toucher = le remplacer ---------- */
FrWA.puce({
  ...BASE, id: 'fusible', nom: 'FUSIBLE', prefixe: 'F', categorie: 'Protection', tags: ['protection', 'alimentation', 'basic'],
  description: 'Fusible : résistance faible tant qu\'il est intact ; fond quand l\'énergie de surcharge ∫(I² − In²)·dt dépasse son i²t (fusible lame 3 A ≈ 10 A²s) : un court-circuit de 100 A le fait fondre en 1 ms. Toucher pour le remplacer.',
  broches: ['A', 'B'], typesBroches: { passif: ['A', 'B'] }, cotes: { gauche: ['A'], droite: ['B'] },
  parametres: [
    { cle: 'In', nom: 'Calibre', unite: 'A', defaut: 3, min: 0.05, max: 100, echelle: 'log' },
    { cle: 'i2t', nom: 'Énergie de fusion i²t (A²s)', unite: '', defaut: 10, min: 1e-3, max: 1e4, echelle: 'log' },
    { cle: 'R', nom: 'Résistance', unite: 'Ω', defaut: 0.03, min: 1e-4, max: 10, echelle: 'log' },
  ], principal: 'In',
  variables: [{ cle: 'fondu', nom: 'Fondu', type: 'bool' }, { cle: 'courant', nom: 'Courant', unite: 'A' }],
  modele: {
    elements: [{ t: 'R', a: 'A', b: 'B', R: 0.03, nom: 'f' }],
    etat: () => ({ fondu: false, courant: 0, e: 0 }),
    pas(c) {
      const s = c.s, p = c.p;
      s.courant = s.fondu ? 0 : c.i('f');
      s.e = s.e * Math.exp(-c.dt) + Math.max(0, s.courant * s.courant - p.In * p.In) * c.dt;
      if (s.e > p.i2t) s.fondu = true;
      c.regler('f', s.fondu ? 1e9 : p.R);
    },
  },
  interaction: { clic: s => { s.fondu = false; s.e = 0; } },
  dessin(g, x) {
    g.strokeStyle = '#c9c9c9'; g.lineWidth = 1.5; g.strokeRect(-14, -6, 28, 12);
    g.strokeStyle = x.s.fondu ? '#ff5050' : '#ffcc00'; g.lineWidth = 2; g.beginPath();
    if (x.s.fondu) { g.moveTo(-14, 0); g.lineTo(-4, 0); g.moveTo(4, 0); g.lineTo(14, 0); } else { g.moveTo(-14, 0); g.lineTo(14, 0); }
    g.stroke();
  },
  affichage: (s, p) => (s.fondu ? 'FONDU (toucher)' : FrWA.formater(p.In, 'A')),
});

/* ---------- LM2940-9 : régulateur 9 V à faible chute, protégé contre l'inversion ---------- */
FrWA.puce({
  ...BASE, id: 'lm2940-9', nom: 'LM2940-9', prefixe: 'U', categorie: 'Régulateurs', tags: ['alimentation'],
  description: 'Régulateur linéaire 9 V / 1 A à faible chute (0,5 V typique, 1 V au plus à 1 A), entrée 6 à 26 V, protégé contre l\'inversion de la batterie (sortie à 0, rien ne conduit). Condensateur de sortie ≥ 22 µF obligatoire.',
  broches: ['IN', 'GND', 'OUT'],
  typesBroches: { alim_entree: ['IN', 'GND'], alim_sortie: ['OUT'] }, cotes: { gauche: ['IN'], droite: ['OUT'], bas: ['GND'] },
  parametres: [
    { cle: 'vout', nom: 'Tension de sortie', unite: 'V', defaut: 9, min: 1.2, max: 15, echelle: 'lin', pas: 0.05 },
    { cle: 'chute', nom: 'Tension de déchet', unite: 'V', defaut: 0.5, min: 0.05, max: 2, echelle: 'lin', pas: 0.05 },
  ],
  variables: [{ cle: 'mode', nom: 'État', type: 'texte' }],
  modele: {
    elements: [
      { t: 'V', a: 'reg', b: 'GND', V: 0, nom: 'source' },
      { t: 'R', a: 'reg', b: 'OUT', R: 0.05 },
      { t: 'F', a: 'IN', b: 'GND', mesure: 'source', gain: -1 },
      { t: 'R', a: 'IN', b: 'GND', R: 1e4 },
    ],
    etat: () => ({ mode: '' }),
    pas(c) {
      const vin = c.v('IN') - c.v('GND');
      c.s.mode = vin < 0 ? 'inversé (coupé)' : vin - c.p.chute >= c.p.vout ? 'régule' : vin > 0.5 ? 'décroché' : 'éteint';
      c.regler('source', Math.max(0, Math.min(c.p.vout, vin - c.p.chute)));
    },
  },
  affichage: s => s.mode,
});
})();
