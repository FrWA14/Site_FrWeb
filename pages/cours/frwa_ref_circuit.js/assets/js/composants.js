/* frwa_flow-Circuit — composants.js
   Composants de base (toujours présents) + outils de dessin communs aux composants et aux puces.
   Chaque type déclare : broches (coordonnées locales, grille de 20), paramètres, dessin, et poser() qui le traduit
   en primitives du moteur. Les puces (extensions) produisent exactement le même genre d'objet : voir puces.js. */
'use strict';
(function (G) {
const { Prim: P } = G.FrWAMoteur;

const GRILLE = 20;
const TYPES = {};          // id -> définition de type
const ORDRE_CAT = ['Fils et masse', 'Passifs', 'Sources', 'Interrupteurs', 'Semi-conducteurs', 'Mesure', 'Monde physique'];

/* ---------- Format des valeurs (préfixes SI, virgule française) ---------- */
const PREFIXES = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
function formater(v, unite = '', chiffres = 3) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return String(v);
  if (v === 0) return ('0 ' + unite).trim();
  const a = Math.abs(v);
  if (a < 1e-12) return ('≈ 0 ' + unite).trim();
  let [m, p] = PREFIXES.find(([m]) => a >= m * 0.9995) || PREFIXES[PREFIXES.length - 1];
  let n = v / m;
  let s = Number(n.toPrecision(chiffres)).toString();
  return (s.replace('.', ',') + ' ' + p + unite).trim();
}
function lireValeur(txt) {
  const m = String(txt).trim().replace(',', '.').match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*([pnuµmkKMG]?)/);
  if (!m) return NaN;
  const mult = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 }[m[2]] || 1;
  return parseFloat(m[1]) * mult;
}

/* ---------- Couleurs (comme Circuit.js / PROTO) ---------- */
const COUL = {
  fond: '#000000', grille: '#2a2a2a', neutre: [128, 128, 128], positif: [60, 255, 60], negatif: [255, 60, 60],
  point: '#ffd400', selection: '#4ecdc4', texte: '#d7e4e2', pastilleNom: '#9b5cf6', pastilleVal: '#5ee87a', pastilleInd: '#ffcc00',
  boite: '#c9c9c9', boiteFond: '#111418',
};
function couleurTension(v, vmax) {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'rgb(128,128,128)';
  const t = Math.max(-1, Math.min(1, v / (vmax || 5))), c = t >= 0 ? COUL.positif : COUL.negatif, a = Math.abs(t);
  const m = i => Math.round(COUL.neutre[i] + (c[i] - COUL.neutre[i]) * a);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

/* ---------- Outils de dessin (coordonnées locales de l'élément) ---------- */
const D = {
  trait(g, x1, y1, x2, y2, coul, ep = 2.5) { g.strokeStyle = coul; g.lineWidth = ep; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); },
  /** trait coloré en dégradé de la tension v1 à v2 */
  degrade(g, x1, y1, x2, y2, c1, c2) {
    if (c1 === c2) return c1;
    const gr = g.createLinearGradient(x1, y1, x2, y2); gr.addColorStop(0, c1); gr.addColorStop(1, c2); return gr;
  },
  /** points jaunes du courant le long d'un segment ; pos = compteur (curcount) */
  points(g, x1, y1, x2, y2, pos, rayon = 2.4) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy); if (L < 1) return;
    const ds = 16; let p = pos % ds; if (p < 0) p += ds;
    g.fillStyle = COUL.point;
    for (let d = p; d < L; d += ds) { g.beginPath(); g.arc(x1 + dx * d / L, y1 + dy * d / L, rayon, 0, Math.PI * 2); g.fill(); }
  },
};

/* Contexte de rendu passé aux fonctions dessiner(g, el, R) :
   R.c(i) couleur de la broche i, R.v(i) tension, R.i(i) courant entrant, R.vmax, R.marche (simulation en cours). */

/* ---------- Définition d'un dipôle horizontal de −40 à +40 ---------- */
function dipole(def) {
  return Object.assign({
    dipole: true,
    broches: [{ x: -40, y: 0, nom: 'A' }, { x: 40, y: 0, nom: 'B' }],
    boite: [-40, -14, 40, 14],
    infos(el, R) {
      const dv = R.v(0) - R.v(1), i = R.i(0);
      return [`ΔV = ${formater(dv, 'V')}`, `I = ${formater(Math.abs(i), 'A')}`, `P = ${formater(Math.abs(dv * i), 'W')}`];
    },
  }, def);
}
function fils(g, R, l = 16) { // les deux pattes d'un dipôle
  D.trait(g, -40, 0, -l, 0, R.c(0)); D.trait(g, l, 0, 40, 0, R.c(1));
}

/* ---------- Composants de base ---------- */
function ajouterType(id, def) {
  def.id = id;
  if (!def.boiteDe) def.boiteDe = () => def.boite || [-20, -20, 20, 20];   // boîte propre à l'élément (objets de taille variable)
  TYPES[id] = def; return def;
}

/* Matières des objets du monde physique : réflexion infrarouge (TCRT5000), réflexion du son (ultrasons),
   affaiblissement radio en dB quand une onde traverse l'objet. Valeurs d'ordre de grandeur. */
const MATIERES = {
  'carton blanc': { couleur: '#e8e4da', refIR: 1.0, refSon: 0.6, radio: 2 },
  'papier gris': { couleur: '#8a8a8a', refIR: 0.45, refSon: 0.6, radio: 1 },
  'papier noir': { couleur: '#1c1c1c', refIR: 0.08, refSon: 0.6, radio: 1 },
  'bois': { couleur: '#a0703e', refIR: 0.55, refSon: 0.8, radio: 4 },
  'brique': { couleur: '#a5462e', refIR: 0.4, refSon: 0.95, radio: 8 },
  'béton': { couleur: '#8d918f', refIR: 0.45, refSon: 0.98, radio: 15 },
  'métal': { couleur: '#b9c4cc', refIR: 0.9, refSon: 0.99, radio: 30 },
  'mousse acoustique': { couleur: '#4d5e44', refIR: 0.3, refSon: 0.05, radio: 1 },
};

ajouterType('masse', {
  nom: 'Masse', cat: 'Fils et masse', prefixe: 'GND', masse: true,
  broches: [{ x: 0, y: 0, nom: 'GND' }], boite: [-14, -4, 14, 24], params: [],
  dessiner(g, el, R) {
    D.trait(g, 0, 0, 0, 10, R.c(0)); g.strokeStyle = R.c(0); g.lineWidth = 2.5;
    for (const [y, w] of [[10, 13], [15, 8], [20, 3]]) { g.beginPath(); g.moveTo(-w, y); g.lineTo(w, y); g.stroke(); }
  },
  poser() {}, infos: () => ['0 V (référence)'],
});

ajouterType('resistance', dipole({
  nom: 'Résistance', cat: 'Passifs', prefixe: 'R', principal: 'R',
  params: [{ cle: 'R', nom: 'Résistance', unite: 'Ω', defaut: 1000, min: 0.1, max: 1e8, echelle: 'log' }],
  dessiner(g, el, R) {
    fils(g, R); g.strokeStyle = D.degrade(g, -16, 0, 16, 0, R.c(0), R.c(1)); g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(-16, 0);
    for (let k = 0; k < 6; k++) g.lineTo(-16 + (k + 0.5) * (32 / 6), (k % 2 ? 6 : -6));
    g.lineTo(16, 0); g.stroke();
  },
  poser(el, b) { b.ajouter(new P.R({ a: b.n(0), b: b.n(1), R: () => el.params.R })); },
}));

ajouterType('condensateur', dipole({
  nom: 'Condensateur', cat: 'Passifs', prefixe: 'C', principal: 'C',
  params: [{ cle: 'C', nom: 'Capacité', unite: 'F', defaut: 10e-6, min: 1e-12, max: 1, echelle: 'log' }],
  dessiner(g, el, R) {
    D.trait(g, -40, 0, -5, 0, R.c(0)); D.trait(g, 5, 0, 40, 0, R.c(1));
    D.trait(g, -5, -13, -5, 13, R.c(0), 3); D.trait(g, 5, -13, 5, 13, R.c(1), 3);
  },
  poser(el, b) { b.ajouter(new P.C({ a: b.n(0), b: b.n(1), C: () => el.params.C })); },
}));

ajouterType('bobine', dipole({
  nom: 'Bobine', cat: 'Passifs', prefixe: 'L', principal: 'L',
  params: [{ cle: 'L', nom: 'Inductance', unite: 'H', defaut: 10e-3, min: 1e-9, max: 100, echelle: 'log' }],
  dessiner(g, el, R) {
    fils(g, R, 20); g.strokeStyle = D.degrade(g, -20, 0, 20, 0, R.c(0), R.c(1)); g.lineWidth = 2.5;
    g.beginPath(); for (let k = 0; k < 4; k++) g.arc(-15 + k * 10, 0, 5, Math.PI, 0); g.stroke();
  },
  poser(el, b) { b.ajouter(new P.L({ a: b.n(0), b: b.n(1), L: () => el.params.L })); },
}));

/* Transformateur à deux bobines : inductances couplées L1, L2 = n²·L1, M = k·√(L1·L2), faites des seules primitives v1.
   Schéma équivalent exact : résistance et inductance de fuite (1 − k)·L1 du primaire, inductance magnétisante k·L1,
   transformateur parfait de rapport n (source E pour la tension, source F pour le courant), puis inductance de fuite
   (1 − k)·L2 et résistance du secondaire. Les points repèrent les bornes de même polarité (P1 et S1).
   Comme un vrai transformateur, il ne transmet pas le continu ; le secondaire est isolé du primaire. */
ajouterType('transformateur', {
  nom: 'Transformateur (2 bobines)', cat: 'Passifs', prefixe: 'T', principal: 'n',
  broches: [{ x: -40, y: -20, nom: 'P1' }, { x: -40, y: 20, nom: 'P2' }, { x: 40, y: -20, nom: 'S1' }, { x: 40, y: 20, nom: 'S2' }],
  boite: [-40, -30, 40, 26],
  pattes: [[-40, -20, -12, -20], [-40, 20, -12, 20], [40, -20, 12, -20], [40, 20, 12, 20]],
  params: [
    { cle: 'n', nom: 'Rapport N2 / N1', unite: '', defaut: 1, min: 0.001, max: 1000, echelle: 'log' },
    { cle: 'L', nom: 'Inductance du primaire', unite: 'H', defaut: 1, min: 1e-6, max: 1000, echelle: 'log' },
    { cle: 'k', nom: 'Couplage k', unite: '', defaut: 0.999, min: 0, max: 0.9999, echelle: 'lin', pas: 0.0001 },
    { cle: 'Rp', nom: 'Résistance du primaire', unite: 'Ω', defaut: 1, min: 0.001, max: 1e6, echelle: 'log' },
    { cle: 'Rs', nom: 'Résistance du secondaire', unite: 'Ω', defaut: 1, min: 0.001, max: 1e6, echelle: 'log' },
  ],
  dessiner(g, el, R) {
    D.trait(g, -40, -20, -12, -20, R.c(0)); D.trait(g, -40, 20, -12, 20, R.c(1));
    D.trait(g, 40, -20, 12, -20, R.c(2)); D.trait(g, 40, 20, 12, 20, R.c(3));
    g.lineWidth = 2.5;
    g.strokeStyle = D.degrade(g, 0, -20, 0, 20, R.c(0), R.c(1));
    g.beginPath(); for (let k = 0; k < 4; k++) g.arc(-12, -15 + k * 10, 5, -Math.PI / 2, Math.PI / 2); g.stroke();
    g.strokeStyle = D.degrade(g, 0, -20, 0, 20, R.c(2), R.c(3));
    g.beginPath(); for (let k = 0; k < 4; k++) g.arc(12, -15 + k * 10, 5, -Math.PI / 2, Math.PI / 2, true); g.stroke();
    D.trait(g, -2, -20, -2, 20, '#bbb', 1.5); D.trait(g, 2, -20, 2, 20, '#bbb', 1.5);   // noyau
    g.fillStyle = '#ddd'; for (const x of [-20, 20]) { g.beginPath(); g.arc(x, -27, 2, 0, 7); g.fill(); }
  },
  poser(el, b) {
    const p = () => el.params, x = b.interne(), m = b.interne(), s = b.interne(), y = b.interne();
    const fuite = () => Math.max(1e-9, (1 - p().k) * p().L);
    // _broches : broche de l'élément où entre le courant de chaque borne de la primitive (−1 = nœud interne)
    const pr = (prim, broches) => { prim._broches = broches; return b.ajouter(prim); };
    pr(new P.R({ a: b.n(0), b: x, R: () => p().Rp }), [0, -1]);
    pr(new P.L({ a: x, b: m, L: fuite }), [-1, -1]);
    pr(new P.L({ a: m, b: b.n(1), L: () => Math.max(1e-9, p().k * p().L) }), [-1, 1]);
    // transformateur parfait : v(s) − v(S2) = n·(v(m) − v(P2)) ; le primaire absorbe −n fois le courant du secondaire
    const e = pr(new P.E({ a: s, b: b.n(3), pa: m, pb: b.n(1), gain: () => p().n }), [-1, 3, -1, -1]);
    pr(new P.F({ a: m, b: b.n(1), ref: e, gain: () => -p().n }), [-1, 1]);
    pr(new P.L({ a: s, b: y, L: () => fuite() * p().n * p().n }), [-1, -1]);
    pr(new P.R({ a: y, b: b.n(2), R: () => p().Rs }), [-1, 2]);
  },
  valeur: el => '1 : ' + String(Number(el.params.n.toPrecision(3))).replace('.', ','),
  infos(el, R) {
    const u1 = R.v(0) - R.v(1), u2 = R.v(2) - R.v(3);
    return [`U primaire = ${formater(u1, 'V')}`, `U secondaire = ${formater(u2, 'V')}`, `I primaire = ${formater(R.i(0), 'A')}`, `I secondaire = ${formater(-R.i(2), 'A')}`];
  },
});

ajouterType('pile', dipole({
  nom: 'Pile / alimentation', cat: 'Sources', prefixe: 'V', principal: 'V',
  broches: [{ x: -40, y: 0, nom: '−' }, { x: 40, y: 0, nom: '+' }],
  params: [{ cle: 'V', nom: 'Tension', unite: 'V', defaut: 5, min: -1000, max: 1000, echelle: 'lin', pas: 0.1 }],
  dessiner(g, el, R) {
    D.trait(g, -40, 0, -5, 0, R.c(0)); D.trait(g, 5, 0, 40, 0, R.c(1));
    D.trait(g, -5, -7, -5, 7, R.c(0), 4); D.trait(g, 5, -15, 5, 15, R.c(1), 2.5);
    g.fillStyle = '#9aa'; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillText('+', 14, -9);
  },
  poser(el, b) { b.ajouter(new P.V({ a: b.n(1), b: b.n(0), V: () => el.params.V })); },
  infos(el, R) { const i = -R.i(1); return [`V = ${formater(el.params.V, 'V')}`, `I débité = ${formater(i, 'A')}`, `P = ${formater(el.params.V * i, 'W')}`]; },
}));

function sourceRonde(dessinInterne) {
  return function (g, el, R) {
    D.trait(g, -40, 0, -16, 0, R.c(0)); D.trait(g, 16, 0, 40, 0, R.c(1));
    g.strokeStyle = '#bbb'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.stroke();
    g.save(); g.rotate(-(el.rot || 0) * Math.PI / 2); dessinInterne(g); g.restore();
    g.fillStyle = '#9aa'; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillText('+', 22, -9);
  };
}
ajouterType('source_ac', dipole({
  nom: 'Source alternative', cat: 'Sources', prefixe: 'V', principal: 'f',
  broches: [{ x: -40, y: 0, nom: '−' }, { x: 40, y: 0, nom: '+' }],
  params: [
    { cle: 'V', nom: 'Amplitude', unite: 'V', defaut: 5, min: 0, max: 1000, echelle: 'lin', pas: 0.1 },
    { cle: 'f', nom: 'Fréquence', unite: 'Hz', defaut: 50, min: 0.01, max: 1e6, echelle: 'log' },
    { cle: 'off', nom: 'Décalage', unite: 'V', defaut: 0, min: -1000, max: 1000, echelle: 'lin', pas: 0.1 },
  ],
  dessiner: sourceRonde(g => {
    g.strokeStyle = '#ddd'; g.lineWidth = 1.8; g.beginPath();
    for (let x = -9; x <= 9; x++) { const y = -6 * Math.sin(x / 9 * Math.PI); x === -9 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
  }),
  poser(el, b) { b.ajouter(new P.V({ a: b.n(1), b: b.n(0), forme: t => el.params.off + el.params.V * Math.sin(2 * Math.PI * el.params.f * t) })); },
}));

ajouterType('horloge', dipole({
  nom: 'Horloge (signal carré)', cat: 'Sources', prefixe: 'H', principal: 'f',
  broches: [{ x: -40, y: 0, nom: '−' }, { x: 40, y: 0, nom: '+' }],
  params: [
    { cle: 'V', nom: 'Niveau haut', unite: 'V', defaut: 5, min: 0, max: 1000, echelle: 'lin', pas: 0.1 },
    { cle: 'f', nom: 'Fréquence', unite: 'Hz', defaut: 1, min: 0.01, max: 1e6, echelle: 'log' },
    { cle: 'rc', nom: 'Rapport cyclique', unite: '%', defaut: 50, min: 1, max: 99, echelle: 'lin', pas: 1 },
  ],
  dessiner: sourceRonde(g => {
    g.strokeStyle = '#ddd'; g.lineWidth = 1.8; g.beginPath();
    g.moveTo(-9, 5); g.lineTo(-4, 5); g.lineTo(-4, -5); g.lineTo(4, -5); g.lineTo(4, 5); g.lineTo(9, 5); g.stroke();
  }),
  poser(el, b) { b.ajouter(new P.V({ a: b.n(1), b: b.n(0), forme: t => ((t * el.params.f) % 1) < el.params.rc / 100 ? el.params.V : 0 })); },
}));

/* Source modulée : porteuse pure, tout-ou-rien (OOK), FM (fc ± dev), AM.
   FM : fréquence instantanée fc + dev·sin(2π·fmod·t), donc phase = 2π·fc·t − (dev/fmod)·cos(2π·fmod·t). */
function formeModulee(p) {
  const w = 2 * Math.PI;
  return t => {
    const V = p.V, fc = p.fc;
    switch (p.mode) {
      case 'ook': { const m = String(p.motif || '1').replace(/[^01]/g, '') || '1'; const bit = m[Math.floor(t * p.fmod) % m.length] === '1'; return bit ? V * Math.sin(w * fc * t) : 0; }
      case 'fm': return V * Math.sin(w * fc * t - (p.dev / p.fmod) * Math.cos(w * p.fmod * t));
      case 'am': return V * (1 + 0.5 * Math.sin(w * p.fmod * t)) / 1.5 * Math.sin(w * fc * t);
      default: return V * Math.sin(w * fc * t);
    }
  };
}
ajouterType('source_mod', dipole({
  nom: 'Source modulée (porteuse, OOK, FM, AM)', cat: 'Sources', prefixe: 'S', principal: 'fc',
  broches: [{ x: -40, y: 0, nom: '−' }, { x: 40, y: 0, nom: '+' }],
  params: [
    { cle: 'mode', nom: 'Modulation', type: 'choix', options: ['porteuse', 'ook', 'fm', 'am'], defaut: 'porteuse' },
    { cle: 'V', nom: 'Amplitude', unite: 'V', defaut: 1, min: 0, max: 100, echelle: 'lin', pas: 0.1 },
    { cle: 'fc', nom: 'Fréquence porteuse', unite: 'Hz', defaut: 10e3, min: 1, max: 1e7, echelle: 'log' },
    { cle: 'dev', nom: 'Excursion FM (± X)', unite: 'Hz', defaut: 4e3, min: 0, max: 1e6, echelle: 'lin', pas: 100 },
    { cle: 'fmod', nom: 'Fréquence modulante / débit', unite: 'Hz', defaut: 50, min: 0.1, max: 1e5, echelle: 'log' },
    { cle: 'motif', nom: 'Motif OOK (bits)', type: 'texte', defaut: '10110010' },
  ],
  dessiner: sourceRonde(g => {
    g.strokeStyle = '#ddd'; g.lineWidth = 1.5; g.beginPath();
    for (let x = -10; x <= 10; x += 0.5) { const y = -6 * Math.sin(x * 1.6) * (0.5 + 0.5 * Math.cos(x / 4)); x === -10 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
  }),
  poser(el, b) { const f = formeModulee(el.params); b.ajouter(new P.V({ a: b.n(1), b: b.n(0), forme: t => f(t) })); },
  valeur: el => ({ porteuse: '', ook: 'OOK ', fm: 'FM ', am: 'AM ' }[el.params.mode] || '') + formater(el.params.fc, 'Hz') + (el.params.mode === 'fm' ? ' ±' + formater(el.params.dev, 'Hz') : ''),
}));

ajouterType('interrupteur', dipole({
  nom: 'Interrupteur', cat: 'Interrupteurs', prefixe: 'SW',
  params: [{ cle: 'ferme', nom: 'Fermé', type: 'bool', defaut: true }],
  dessiner(g, el, R) {
    fils(g, R); g.fillStyle = '#ddd';
    g.beginPath(); g.arc(-16, 0, 2.5, 0, 7); g.arc(16, 0, 2.5, 0, 7); g.fill();
    D.trait(g, -16, 0, 16, el.params.ferme ? 0 : -14, el.params.ferme ? R.c(0) : '#ddd');
  },
  clic(el) { el.params.ferme = !el.params.ferme; },
  poser(el, b) { b.ajouter(new P.S({ a: b.n(0), b: b.n(1), ferme: () => el.params.ferme, Ron: 0.01 })); },
  valeur: el => (el.params.ferme ? 'fermé' : 'ouvert'),
}));

ajouterType('poussoir', dipole({
  nom: 'Bouton poussoir', cat: 'Interrupteurs', prefixe: 'BP', params: [],
  dessiner(g, el, R) {
    fils(g, R); g.fillStyle = '#ddd';
    g.beginPath(); g.arc(-16, 0, 2.5, 0, 7); g.arc(16, 0, 2.5, 0, 7); g.fill();
    const y = el._appuye ? -3 : -10;
    D.trait(g, -18, y, 18, y, '#ddd'); D.trait(g, 0, y, 0, y - 8, '#ddd');
    if (el._appuye) D.trait(g, -16, 0, 16, 0, R.c(0));
  },
  appui(el) { el._appuye = true; }, relache(el) { el._appuye = false; },
  poser(el, b) { b.ajouter(new P.S({ a: b.n(0), b: b.n(1), ferme: () => !!el._appuye, Ron: 0.01 })); },
  valeur: el => (el._appuye ? 'appuyé' : 'relâché'),
}));

function triangleDiode(g, R) {
  g.fillStyle = D.degrade(g, -8, 0, 8, 0, R.c(0), R.c(1));
  g.beginPath(); g.moveTo(-8, -10); g.lineTo(-8, 10); g.lineTo(8, 0); g.closePath(); g.fill();
  D.trait(g, 8, -10, 8, 10, R.c(1), 2.5);
}
ajouterType('diode', dipole({
  nom: 'Diode', cat: 'Semi-conducteurs', prefixe: 'D', principal: 'Vf',
  params: [{ cle: 'Vf', nom: 'Tension directe (à 10 mA)', unite: 'V', defaut: 0.7, min: 0.1, max: 5, echelle: 'lin', pas: 0.01 }],
  dessiner(g, el, R) { D.trait(g, -40, 0, -8, 0, R.c(0)); D.trait(g, 8, 0, 40, 0, R.c(1)); triangleDiode(g, R); },
  poser(el, b) { b.ajouter(new P.D({ a: b.n(0), b: b.n(1), N: 1.5, If: 0.01, Vf: () => el.params.Vf })); },
}));

const LED_COUL = { rouge: ['#ff3030', 1.9], orange: ['#ff8c1a', 2.0], jaune: ['#ffe030', 2.0], vert: ['#30ff60', 2.1], bleu: ['#3a7bff', 3.0], blanc: ['#ffffff', 3.0] };
ajouterType('led', dipole({
  nom: 'LED', cat: 'Semi-conducteurs', prefixe: 'D', principal: 'couleur',
  params: [{ cle: 'couleur', nom: 'Couleur', type: 'choix', options: Object.keys(LED_COUL), defaut: 'rouge' }],
  dessiner(g, el, R) {
    const [coul] = LED_COUL[el.params.couleur] || LED_COUL.rouge;
    const lum = Math.max(0, Math.min(1, R.i(0) / 0.015));
    if (lum > 0.02) {
      const gr = g.createRadialGradient(0, 0, 2, 0, 0, 30);
      gr.addColorStop(0, coul); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.25 + 0.75 * lum; g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 30, 0, 7); g.fill(); g.globalAlpha = 1;
    }
    D.trait(g, -40, 0, -8, 0, R.c(0)); D.trait(g, 8, 0, 40, 0, R.c(1)); triangleDiode(g, R);
    g.strokeStyle = coul; g.lineWidth = 1.5;
    for (const dx of [0, 7]) { g.beginPath(); g.moveTo(-2 + dx, -12); g.lineTo(5 + dx, -19); g.moveTo(5 + dx, -19); g.lineTo(1 + dx, -18); g.moveTo(5 + dx, -19); g.lineTo(4 + dx, -15); g.stroke(); }
  },
  poser(el, b) { b.ajouter(new P.D({ a: b.n(0), b: b.n(1), N: 2, If: 0.02, Vf: () => (LED_COUL[el.params.couleur] || LED_COUL.rouge)[1] })); },
  valeur: () => null,   // la couleur se voit : pas de pastille de valeur (moins de bruit, comme PROTO)
}));

function dessinerBipolaire(g, el, R, pnp) {
  // broches : B (−40,0), C (20,−40), E (20,40)
  D.trait(g, -40, 0, -8, 0, R.c(0)); D.trait(g, -8, -14, -8, 14, R.c(0), 3);
  D.trait(g, -8, -6, 20, -22, R.c(1)); D.trait(g, 20, -22, 20, -40, R.c(1));
  D.trait(g, -8, 6, 20, 22, R.c(2)); D.trait(g, 20, 22, 20, 40, R.c(2));
  g.fillStyle = R.c(2); g.beginPath();
  if (!pnp) { g.moveTo(20, 22); g.lineTo(9, 21); g.lineTo(14, 13); }
  else { g.moveTo(-6, 7); g.lineTo(5, 9); g.lineTo(1, 17); }
  g.fill();
  g.strokeStyle = '#666'; g.lineWidth = 1.2; g.beginPath(); g.arc(4, 0, 24, 0, 7); g.stroke();
}
for (const [id, nom, pnp] of [['npn', 'Transistor NPN', false], ['pnp', 'Transistor PNP', true]]) {
  ajouterType(id, {
    nom, cat: 'Semi-conducteurs', prefixe: 'Q', principal: 'beta',
    broches: [{ x: -40, y: 0, nom: 'B' }, { x: 20, y: -40, nom: 'C' }, { x: 20, y: 40, nom: 'E' }],
    boite: [-40, -28, 28, 28],
    params: [{ cle: 'beta', nom: 'Gain β', unite: '', defaut: 100, min: 10, max: 1000, echelle: 'log' }],
    dessiner(g, el, R) { dessinerBipolaire(g, el, R, pnp); },
    poser(el, b) { b.ajouter(new P.Q({ b: b.n(0), c: b.n(1), e: b.n(2), beta: () => el.params.beta, pnp })); },
    infos(el, R) { return [`Vbe = ${formater(R.v(0) - R.v(2), 'V')}`, `Vce = ${formater(R.v(1) - R.v(2), 'V')}`, `Ib = ${formater(R.i(0), 'A')}`, `Ic = ${formater(R.i(1), 'A')}`]; },
  });
}

/* Étiquette de réseau (comme dans KiCad) : toutes les étiquettes de même nom sont reliées, sans fil.
   Rotation : 0 = drapeau à gauche du point de connexion, 1 = vers le haut, 2 = à droite, 3 = vers le bas. */
ajouterType('etiquette', {
  nom: 'Étiquette de réseau', cat: 'Fils et masse', prefixe: 'NET', etiquette: true,
  broches: [{ x: 0, y: 0, nom: 'N' }], boite: [-46, -9, 0, 9],
  params: [{ cle: 'nom', nom: 'Nom du réseau', type: 'texte', defaut: 'NET' }],
  dessiner(g, el, R) {
    const txt = String(el.params.nom || '?'), r = ((el.rot || 0) % 4 + 4) % 4, alim = /^[+-]/.test(txt);
    g.save(); g.rotate(-r * Math.PI / 2);                      // texte et drapeau toujours horizontaux
    g.font = '600 10px ui-sans-serif, system-ui, sans-serif';
    const w = g.measureText(txt).width + 12, h = 14;
    const dir = [[-1, 0], [0, -1], [1, 0], [0, 1]][r];
    let x0, y0;                                               // coin haut-gauche du drapeau
    if (dir[0]) { x0 = dir[0] < 0 ? -w - 5 : 5; y0 = -h / 2; } else { x0 = -w / 2; y0 = dir[1] < 0 ? -h - 5 : 5; }
    g.strokeStyle = R.c(0); g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(dir[0] ? (dir[0] < 0 ? -5 : 5) : 0, dir[1] ? (dir[1] < 0 ? -5 : 5) : 0); g.stroke();
    g.fillStyle = alim ? '#3a1414' : '#10202a'; g.beginPath(); g.roundRect(x0, y0, w, h, 4); g.fill(); g.stroke();
    g.fillStyle = alim ? '#ffb3b3' : '#cfe8ff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, x0 + w / 2, y0 + h / 2 + 0.5);
    g.restore();
  },
  poser() {},
  valeur: () => null,
  infos: (el, R) => [`Réseau « ${el.params.nom} »`, `V = ${formater(R.v(0), 'V')}`],
});

/* ---------- Mesure ---------- */
ajouterType('voltmetre', dipole({
  nom: 'Voltmètre', cat: 'Mesure', prefixe: 'VM', params: [],
  broches: [{ x: -40, y: 0, nom: '+' }, { x: 40, y: 0, nom: '−' }], boite: [-40, -22, 40, 22],
  dessiner(g, el, R) {
    D.trait(g, -40, 0, -30, 0, R.c(0)); D.trait(g, 30, 0, 40, 0, R.c(1));
    g.fillStyle = '#0d1512'; g.strokeStyle = '#7d908d'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(-30, -20, 60, 40, 5); g.fill(); g.stroke();
    g.save(); g.rotate(-(el.rot || 0) * Math.PI / 2);
    g.fillStyle = '#5ee87a'; g.font = 'bold 12px ui-monospace, Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const v = R.v(0) - R.v(1); g.fillText(Math.abs(v) < 10 ? v.toFixed(3).replace('.', ',') : v.toFixed(2).replace('.', ','), 0, -2);
    g.fillStyle = '#7d908d'; g.font = '8px ui-sans-serif, sans-serif'; g.fillText('V', 0, 12); g.restore();
  },
  poser(el, b) { b.ajouter(new P.R({ a: b.n(0), b: b.n(1), R: 10e6 })); },
  valeur: () => null,
}));

/* Circuit ouvert : deux bornes que rien ne relie (aucun courant). Sert de sonde : posé entre deux points, il donne leur
   différence de potentiel à l'oscilloscope sans charger le montage (le voltmètre, lui, fait 10 MΩ).
   Option « claquage » : l'intervalle devient un isolant réel (éclateur, lame d'air, cavité dans un diélectrique) :
   - capacité C = ε0·εr·S / d (εr règle la capacité, donc la part de tension que prend l'intervalle dans un diviseur
     capacitif : c'est par là qu'il agit sur les décharges partielles) ;
   - tension de claquage Uc = rigidité diélectrique × épaisseur (air : ≈ 3 kV/mm) ;
   - dès que |U| atteint Uc, un arc de résistance Rarc décharge l'intervalle ; il s'éteint quand |U| retombe sous la
     tension d'extinction (en % de Uc). En série avec un condensateur sous tension alternative, cela donne le modèle
     « abc » des décharges partielles : une suite d'impulsions à chaque alternance, visibles à l'oscilloscope. */
const EPS0 = 8.8541878128e-12;
const claquageDe = el => el.params.Ec * 1e3 * el.params.d;                               // V (kV/mm × mm)
const capaciteDe = el => EPS0 * el.params.er * (el.params.S * 1e-6) / (el.params.d * 1e-3);   // F
ajouterType('circuit_ouvert', dipole({
  nom: 'Circuit ouvert (sonde de tension, claquage)', cat: 'Mesure', prefixe: 'CO', principal: 'd',
  broches: [{ x: -40, y: 0, nom: '+' }, { x: 40, y: 0, nom: '−' }],
  params: [
    { cle: 'claquage', nom: 'Claquage (isolant réel)', type: 'bool', defaut: false },
    { cle: 'd', nom: 'Épaisseur de l\'isolant', unite: 'mm', defaut: 0.1, min: 0.001, max: 100, echelle: 'log' },
    { cle: 'Ec', nom: 'Rigidité diélectrique (kV/mm)', unite: '', defaut: 3, min: 0.1, max: 1000, echelle: 'log' },
    { cle: 'er', nom: 'Permittivité relative εr', unite: '', defaut: 1, min: 1, max: 10000, echelle: 'log' },
    { cle: 'S', nom: 'Surface des électrodes (mm²)', unite: '', defaut: 100, min: 0.01, max: 1e6, echelle: 'log' },
    { cle: 'ext', nom: 'Tension d\'extinction (part de Uc)', unite: '%', defaut: 10, min: 0, max: 95, echelle: 'lin', pas: 1 },
    { cle: 'Rarc', nom: 'Résistance de l\'arc', unite: 'Ω', defaut: 100, min: 0.01, max: 1e6, echelle: 'log' },
  ],
  dessiner(g, el, R) {
    g.fillStyle = '#9aa'; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillText('+', -22, -7);
    if (!el.params.claquage) {
      D.trait(g, -40, 0, -10, 0, R.c(0)); D.trait(g, 10, 0, 40, 0, R.c(1));
      g.lineWidth = 2;
      for (const [x, i] of [[-10, 0], [10, 1]]) { g.strokeStyle = R.c(i); g.beginPath(); g.arc(x, 0, 3.5, 0, 7); g.stroke(); }
      return;
    }
    // électrodes face à face, isolant entre les deux ; éclair pendant quelques images après une décharge
    D.trait(g, -40, 0, -7, 0, R.c(0)); D.trait(g, 7, 0, 40, 0, R.c(1));
    D.trait(g, -7, -12, -7, 12, R.c(0), 3); D.trait(g, 7, -12, 7, 12, R.c(1), 3);
    g.fillStyle = 'rgba(120,170,255,.18)'; g.fillRect(-5, -12, 10, 24);
    if (el._eclair > 0) {
      if (R.marche) el._eclair--;
      g.strokeStyle = '#fff36b'; g.lineWidth = 2; g.beginPath(); g.moveTo(-5, -5); g.lineTo(1, -1); g.lineTo(-2, 2); g.lineTo(5, 6); g.stroke();
    }
  },
  reinitialiser(el) { el._arc = false; el._eclair = 0; el._decharges = 0; },
  poser(el, b) {
    el._arc = false; el._decharges = el._decharges || 0;
    // Euler implicite : la décharge (Rarc·C ≈ ns) est bien plus rapide que le pas ; les trapèzes y oscilleraient
    b.ajouter(new P.C({ a: b.n(0), b: b.n(1), C: () => (el.params.claquage ? capaciteDe(el) : 0), euler: true }));
    b.ajouter(new P.S({ a: b.n(0), b: b.n(1), ferme: () => !!el._arc, Ron: () => el.params.Rarc, Roff: 1e15 }));
    b.sim.actif({ pas(sim) {
      if (!el.params.claquage) { el._arc = false; return; }
      const u = Math.abs(sim.v(b.n(0)) - sim.v(b.n(1))), uc = claquageDe(el);
      if (!el._arc && u >= uc) { el._arc = true; el._decharges++; el._eclair = 8; }
      else if (el._arc && u <= uc * el.params.ext / 100) el._arc = false;
    } });
  },
  valeur: el => (el.params.claquage ? 'Uc ' + formater(claquageDe(el), 'V') : null),
  infos(el, R) {
    const l = [`ΔV = ${formater(R.v(0) - R.v(1), 'V')}`];
    if (!el.params.claquage) return [...l, 'I = 0 A (circuit ouvert)'];
    return [...l, `I = ${formater(Math.abs(R.i(0)), 'A')}`, `Uc = ${formater(claquageDe(el), 'V')} · C = ${formater(capaciteDe(el), 'F')}`, `${el._decharges || 0} décharge(s)${el._arc ? ' · arc amorcé' : ''}`];
  },
}));

/* ---------- Monde physique : éléments sans broche, déplaçables, lus par les capteurs (voir monde.js) ---------- */
ajouterType('monde_objet', {
  nom: 'Objet / obstacle', cat: 'Monde physique', prefixe: 'OBJ', mondePhysique: true, broches: [],
  params: [
    { cle: 'matiere', nom: 'Matière', type: 'choix', options: Object.keys(MATIERES), defaut: 'carton blanc' },
    { cle: 'l', nom: 'Largeur', unite: 'carreaux', defaut: 6, min: 1, max: 200, echelle: 'lin', pas: 1 },
    { cle: 'h', nom: 'Épaisseur', unite: 'carreaux', defaut: 1, min: 1, max: 200, echelle: 'lin', pas: 1 },
  ],
  principal: 'matiere', boite: [-60, -10, 60, 10],
  boiteDe: el => [-el.params.l * 10, -el.params.h * 10, el.params.l * 10, el.params.h * 10],
  dessiner(g, el) {
    const m = MATIERES[el.params.matiere] || MATIERES['carton blanc'], w = el.params.l * 10, h = el.params.h * 10;
    g.fillStyle = m.couleur; g.globalAlpha = 0.9; g.fillRect(-w, -h, 2 * w, 2 * h); g.globalAlpha = 1;
    g.strokeStyle = '#ffffff55'; g.lineWidth = 1; g.strokeRect(-w, -h, 2 * w, 2 * h);
    g.save(); g.beginPath(); g.rect(-w, -h, 2 * w, 2 * h); g.clip(); g.strokeStyle = '#00000033';
    for (let x = -w - 2 * h; x < w; x += 8) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 2 * h, -h); g.stroke(); }
    g.restore();
  },
  poser() {},
  valeur: el => el.params.matiere,
});

ajouterType('monde_lumiere', {
  nom: 'Source de lumière', cat: 'Monde physique', prefixe: 'LUM', mondePhysique: true, broches: [],
  params: [{ cle: 'cd', nom: 'Intensité', unite: 'cd', defaut: 2000, min: 1, max: 1e6, echelle: 'log' }],
  principal: 'cd', boite: [-16, -16, 16, 16],
  dessiner(g, el) {
    const r = 30 + 12 * Math.log10(el.params.cd);
    const gr = g.createRadialGradient(0, 0, 4, 0, 0, r); gr.addColorStop(0, 'rgba(255,230,120,.75)'); gr.addColorStop(1, 'rgba(255,230,120,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(0, 0, 11, 0, 7); g.fill();
    g.strokeStyle = '#ffd84a'; g.lineWidth = 2;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); g.lineTo(Math.cos(a) * 19, Math.sin(a) * 19); g.stroke(); }
  },
  poser() {},
});

ajouterType('monde_climat', {
  nom: 'Source de chaleur / humidité', cat: 'Monde physique', prefixe: 'CLI', mondePhysique: true, broches: [],
  params: [
    { cle: 'temperature', nom: 'Température', unite: '°C', defaut: 40, min: -40, max: 150, echelle: 'lin', pas: 0.5 },
    { cle: 'humidite', nom: 'Humidité relative', unite: '%', defaut: 85, min: 0, max: 100, echelle: 'lin', pas: 1 },
    { cle: 'rayon', nom: 'Rayon d\'influence', unite: 'carreaux', defaut: 8, min: 1, max: 100, echelle: 'lin', pas: 1 },
  ],
  principal: 'temperature', boite: [-18, -18, 18, 18],
  dessiner(g, el) {
    const r = el.params.rayon * 20, chaud = el.params.temperature >= 20;
    const gr = g.createRadialGradient(0, 0, 4, 0, 0, r);
    gr.addColorStop(0, chaud ? 'rgba(255,90,60,.35)' : 'rgba(80,160,255,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.fillStyle = chaud ? '#ff6b4a' : '#5aa9ff'; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.font = 'bold 9px ui-sans-serif, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(Math.round(el.params.temperature) + '°', 0, -3); g.fillText(Math.round(el.params.humidite) + '%', 0, 7);
  },
  poser() {},
  valeur: el => `${el.params.temperature} °C · ${el.params.humidite} %`,
});

/* Règles v1 (docs/REGLES_COMPOSANTS.md) pour les composants de base : type électrique de chaque broche (R4),
   variables publiées (R7, aucune ici) et modèle 3D (R9 : pas encore de fichier STEP). Vérifiés au démarrage. */
const P2 = { passif: ['A', 'B'] }, SOURCE = { alim_sortie: ['−', '+'] };
const REGLES_BASE = {
  masse: { alim_sortie: ['GND'] }, resistance: P2, condensateur: P2, bobine: P2,
  transformateur: { passif: ['P1', 'P2', 'S1', 'S2'] },
  pile: SOURCE, source_ac: SOURCE, horloge: SOURCE, source_mod: SOURCE,
  interrupteur: P2, poussoir: P2, diode: P2, led: P2,
  npn: { passif: ['B', 'C', 'E'] }, pnp: { passif: ['B', 'C', 'E'] },
  etiquette: { passif: ['N'] }, voltmetre: { entree: ['+', '−'] }, circuit_ouvert: { entree: ['+', '−'] },
  monde_objet: {}, monde_lumiere: {}, monde_climat: {},
};
for (const [id, typesBroches] of Object.entries(REGLES_BASE)) Object.assign(TYPES[id], { typesBroches, variables: [], modele3d: null });
/* R12 : étiquettes des composants de base (tri de la bibliothèque ; « basic » = mode Basique) */
const TAGS_BASE = {
  masse: ['basic', 'fils'], etiquette: ['basic', 'fils'],
  resistance: ['basic', 'passif'], condensateur: ['basic', 'passif'], bobine: ['basic', 'passif'],
  transformateur: ['basic', 'passif', 'alimentation'],
  pile: ['basic', 'alimentation'], source_ac: ['basic', 'generateur', 'alimentation'], horloge: ['basic', 'generateur'],
  source_mod: ['generateur', 'radio'],
  interrupteur: ['basic', 'interrupteur'], poussoir: ['basic', 'interrupteur'],
  diode: ['basic', 'semi-conducteur'], led: ['basic', 'semi-conducteur', 'eclairage', 'optique'],
  npn: ['basic', 'semi-conducteur'], pnp: ['semi-conducteur'],
  voltmetre: ['basic', 'mesure'], circuit_ouvert: ['basic', 'mesure'],
  monde_objet: ['monde'], monde_lumiere: ['monde', 'eclairage'], monde_climat: ['monde'],
};
for (const [id, tags] of Object.entries(TAGS_BASE)) TYPES[id].tags = tags;

/* Fil : type spécial (deux extrémités libres, pas de rotation) */
ajouterType('fil', { nom: 'Fil', cat: null, prefixe: 'W', params: [] });

G.FrWAComposants = { TYPES, ORDRE_CAT, GRILLE, COUL, D, couleurTension, formater, lireValeur, ajouterType, MATIERES };
})(window);
