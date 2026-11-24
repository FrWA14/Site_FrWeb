// Générateurs « équivalents » et moteur pas à pas unipolaire, ajoutés pour l'étude « démodulation de tonalités à
// référence 6 kHz » (2026-11-24) : chaque étape de l'étude est alimentée par un générateur qui remplace l'étage
// précédent (somme de tonalités, phases d'un séquenceur de pas).
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const BASE = { version: '1.0.0', regles: 1, modele3d: null };
const N = [1, 2, 3, 4, 5];
const F0 = [6000, 3000, 1500, 750, 375];

/* ---------- Générateur de tonalités : somme de 5 sinus + décalage + bruit + ronflement 50 Hz ---------- */
FrWA.puce({
  ...BASE, id: 'generateur-tonalites', nom: 'TONALITÉS', prefixe: 'G', categorie: 'Générateurs', tags: ['generateur', 'son', 'basic'],
  description: 'Somme de cinq tonalités sinusoïdales (fréquence et amplitude crête réglables, 0 V = absente), plus un décalage continu, un bruit blanc (V efficaces, hasard reproductible) et un ronflement 50 Hz. « Salves » : si > 0, toutes les tonalités sont coupées une demi-période sur deux (essai des détecteurs de présence). Molette : fréquence de la tonalité 2 (écart Δf d\'un moteur).',
  broches: ['+', '−'], typesBroches: { sortie: ['+'], passif: ['−'] }, cotes: { haut: ['+'], bas: ['−'] },
  parametres: [
    ...N.flatMap(k => [
      { cle: 'f' + k, nom: `Fréquence ${k}`, unite: 'Hz', defaut: F0[k - 1], min: 1, max: 1e6, echelle: 'log' },
      { cle: 'a' + k, nom: `Amplitude crête ${k}`, unite: 'V', defaut: 0.2, min: 0, max: 20, echelle: 'lin', pas: 0.01 },
    ]),
    { cle: 'off', nom: 'Décalage continu', unite: 'V', defaut: 0, min: -50, max: 50, echelle: 'lin', pas: 0.1 },
    { cle: 'bruit', nom: 'Bruit blanc (efficace)', unite: 'V', defaut: 0, min: 0, max: 5, echelle: 'lin', pas: 0.01 },
    { cle: 'ronfle', nom: 'Ronflement 50 Hz (crête)', unite: 'V', defaut: 0, min: 0, max: 5, echelle: 'lin', pas: 0.01 },
    { cle: 'salves', nom: 'Salves (0 = continu)', unite: 'Hz', defaut: 0, min: 0, max: 1000, echelle: 'lin', pas: 0.1 },
  ], principal: 'f2',
  variables: [{ cle: 'v', nom: 'Tension de sortie', unite: 'V' }, { cle: 'presentes', nom: 'Tonalités émises', type: 'bool' }],
  modele: {
    elements: [{ t: 'V', a: '+', b: '−', V: 0, nom: 's' }],
    etat: () => ({ v: 0, presentes: true }),
    pas(c) {
      const p = c.p, t = c.t, w = 2 * Math.PI;
      const on = !(p.salves > 0) || ((t * p.salves) % 1) < 0.5;
      let v = p.off + p.ronfle * Math.sin(w * 50 * t);
      if (on) for (const k of N) if (p['a' + k] > 0) v += p['a' + k] * Math.sin(w * p['f' + k] * t);
      if (p.bruit > 0) {   // Box-Muller sur le hasard reproductible (R8)
        const u = Math.max(1e-12, c.aleatoire()), u2 = c.aleatoire();
        v += p.bruit * Math.sqrt(-2 * Math.log(u)) * Math.cos(w * u2);
      }
      c.s.v = v; c.s.presentes = on;
      c.regler('s', v);
    },
  },
  dessin(g, x) {
    g.strokeStyle = '#ddd'; g.lineWidth = 1.5; g.beginPath();
    for (let i = -12; i <= 12; i++) { const y = -4 * Math.sin(i * 0.9) - 2.5 * Math.sin(i * 2.1); i === -12 ? g.moveTo(i, y) : g.lineTo(i, y); }
    g.stroke();
  },
  affichage: (s, p) => N.filter(k => p['a' + k] > 0).map(k => FrWA.formater(p['f' + k], 'Hz').replace(' ', '')).join(' + ') || 'aucune',
});

/* ---------- Générateur de phases de moteur pas à pas (sorties A, /A, B, /B en code de Gray) ---------- */
const GRAY = [[0, 0], [1, 0], [1, 1], [0, 1]];
FrWA.puce({
  ...BASE, id: 'generateur-phases', nom: 'PHASES PAP', prefixe: 'G', categorie: 'Générateurs', tags: ['generateur', 'moteur', 'logique'],
  description: 'Remplace un séquenceur de moteur pas à pas : quatre sorties logiques A, /A, B, /B en pas entier (code de Gray 00 → 10 → 11 → 01 en avant, ordre inverse en arrière), cadence réglable. Sorties à 0 quand il est désactivé (toucher pour activer / couper).',
  broches: ['A', { nom: 'AN', etiquette: '/A' }, 'B', { nom: 'BN', etiquette: '/B' }, 'GND'],
  typesBroches: { sortie: ['A', 'AN', 'B', 'BN'], alim_entree: ['GND'] }, cotes: { droite: ['A', 'AN', 'B', 'BN'], bas: ['GND'] },
  parametres: [
    { cle: 'f', nom: 'Cadence', unite: 'Hz', defaut: 100, min: 0.1, max: 1e4, echelle: 'log' },
    { cle: 'sens', nom: 'Sens', type: 'choix', options: ['avant', 'arrière'], defaut: 'avant' },
    { cle: 'V', nom: 'Niveau haut', unite: 'V', defaut: 9, min: 1, max: 20, echelle: 'lin', pas: 0.1 },
    { cle: 'actif', nom: 'Actif', type: 'bool', defaut: true },
  ], principal: 'f',
  variables: [{ cle: 'pas', nom: 'Pas émis', unite: '' }],
  modele: {
    elements: ['A', 'AN', 'B', 'BN'].map(x => ({ t: 'O', a: x, ref: 'GND', V: 0, R: 100, nom: 'o' + x })),
    etat: () => ({ pas: 0, acc: 0 }),
    pas(c) {
      const s = c.s, p = c.p;
      if (p.actif) { s.acc += p.f * c.dt; while (s.acc >= 1) { s.acc -= 1; s.pas += p.sens === 'avant' ? 1 : -1; } }
      const [a, b] = GRAY[((s.pas % 4) + 4) % 4], V = p.actif ? p.V : 0;
      c.regler('oA', a * V); c.regler('oAN', (1 - a) * V); c.regler('oB', b * V); c.regler('oBN', (1 - b) * V);
    },
  },
  interaction: { clic: (s, p) => { p.actif = !p.actif; } },
  affichage: (s, p) => (p.actif ? `${FrWA.formater(p.f, 'Hz')} ${p.sens}` : 'coupé'),
});

/* ---------- Moteur pas à pas unipolaire 200 pas / tour (6 fils) ----------
   Quatre demi-bobines (R + L) vers deux prises médianes ; le champ résultant (A − /A, B − /B) attire le rotor, qui le
   suit au plus à la vitesse maximale (décrochage au-delà). 50 paires de pôles : un pas entier = 1,8°. Couplage
   magnétique entre demi-bobines non modélisé (la surtension de coupure réelle monte vers 2 × l'alimentation). */
FrWA.puce({
  ...BASE, id: 'pas-a-pas-unipolaire', nom: 'PAS À PAS', prefixe: 'M', categorie: 'Mécanique', tags: ['moteur'],
  description: 'Moteur pas à pas unipolaire 12 V, 200 pas par tour (1,8°), 6 fils : prises médianes COMA et COMB au +, phases A, /A, B, /B mises à la masse tour à tour par des MOSFET. Le rotor suit le champ des bobines jusqu\'à la vitesse maximale. Entraîne un axe mécanique nommé.',
  broches: ['A', 'COMA', { nom: 'AN', etiquette: '/A' }, 'B', 'COMB', { nom: 'BN', etiquette: '/B' }],
  typesBroches: { passif: ['A', 'COMA', 'AN', 'B', 'COMB', 'BN'] },
  cotes: { gauche: ['A', 'AN', null, 'B', 'BN'], haut: ['COMA', 'COMB'] }, largeur: 100,
  parametres: [
    { cle: 'R', nom: 'Résistance d\'une demi-bobine', unite: 'Ω', defaut: 30, min: 0.5, max: 1e3, echelle: 'log' },
    { cle: 'L', nom: 'Inductance d\'une demi-bobine', unite: 'H', defaut: 0.02, min: 1e-4, max: 1, echelle: 'log' },
    { cle: 'vmax', nom: 'Vitesse maximale (décrochage)', unite: 'tr/min', defaut: 300, min: 1, max: 3000, echelle: 'log' },
    { cle: 'axe', nom: 'Axe entraîné (nom)', type: 'texte', defaut: 'PAP1' },
  ], principal: 'vmax',
  mecanique: { pilote: ['$axe'] },
  variables: [{ cle: 'angle', nom: 'Angle de l\'arbre', unite: 'rad' }, { cle: 'vitesse', nom: 'Vitesse de l\'arbre', unite: 'rad/s' }, { cle: 'pas', nom: 'Pas parcourus', unite: '' }],
  modele: {
    elements: [['A', 'COMA'], ['AN', 'COMA'], ['B', 'COMB'], ['BN', 'COMB']].flatMap(([x, com]) => [
      { t: 'R', a: com, b: 'm' + x, R: '$R', nom: 'r' + x }, { t: 'L', a: 'm' + x, b: x, L: '$L' },
    ]),
    etat: () => ({ angle: 0, vitesse: 0, pas: 0, elec: 0 }),
    pas(c) {
      const s = c.s, I = ['A', 'AN', 'B', 'BN'].map(x => Math.max(0, c.i('r' + x)));
      const fx = I[0] - I[1], fy = I[2] - I[3], ancien = s.angle;
      if (Math.hypot(fx, fy) > 0.1 * 12 / c.p.R) {
        let d = Math.atan2(fy, fx) - (s.elec % (2 * Math.PI)); d = Math.atan2(Math.sin(d), Math.cos(d));
        const dmax = c.p.vmax / 60 * 2 * Math.PI * 50 * c.dt;           // électrique = mécanique × 50 paires de pôles
        s.elec += Math.max(-dmax, Math.min(dmax, d));
      }
      s.angle = s.elec / 50; s.pas = Math.round(s.elec / (Math.PI / 2));
      s.vitesse = (s.angle - ancien) / c.dt;
      c.monde.piloterAxe(c.p.axe, c.nom, c.k, s.angle, s.vitesse);
    },
  },
  dessin(g, x) {
    const cx = 10, cy = 0, r = 18;
    g.strokeStyle = '#9aa6a4'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r, 0, 2 * Math.PI); g.stroke();
    const a = x.s.angle || 0; g.strokeStyle = '#ffcc00'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (r - 3) * Math.sin(a), cy - (r - 3) * Math.cos(a)); g.stroke();
  },
  affichage: s => `${s.pas} pas`,
});
})();
