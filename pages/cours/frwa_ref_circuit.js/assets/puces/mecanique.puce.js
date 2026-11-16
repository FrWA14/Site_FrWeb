// Pièces mécaniques motorisées (règle R10) : elles publient l'angle de leur arbre sur un AXE nommé du monde.
// Une mécanique (monture solaire, roue, bras…) lit cet axe : c'est le seul lien mécanique entre composants.
// Angles : variables en rad, réglages affichés en degrés (FrWA.unites.rad / deg). La 3D n'est PAS calculée ici :
// une extension de la fenêtre 3D lit les variables publiées (angle) et oriente le modèle (extensions/3d/).
//
//  - Moteur CC : induit = résistance R en série avec la force contre-électromotrice E = ke·ω (sortie pilotée « O »),
//    couple = kt·i (kt = ke en unités SI), J·dω/dt = kt·i − b·ω − charge/réduction, réducteur, butées mécaniques.
//    Inductance d'induit négligée (L/R ≪ pas de temps habituel) : simplification déclarée.
//  - Servomoteur de modélisme (type SG90) : impulsion de 1 à 2 ms toutes les 20 ms sur SIG → angle 0 à 180°,
//    vitesse limitée (≈ 0,1 s / 60° sous 4,8 V), courant ≈ 10 mA au repos, ≈ 150 mA en mouvement.

(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const { rad, deg } = FrWA.unites;

const dessinArbre = (g, x, cx, cy, r, coul) => {
  const a = x.s.angle ?? 0;
  g.strokeStyle = '#8a969a'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
  // repère de l'arbre : 0 rad vers la droite, sens trigonométrique (vers le haut de l'écran)
  g.strokeStyle = coul; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + r * Math.cos(a), cy - r * Math.sin(a)); g.stroke();
  g.fillStyle = coul; g.beginPath(); g.arc(cx, cy, 3, 0, 7); g.fill();
};

FrWA.puce({
  id: 'moteur-cc', tags: ['basic', 'moteur'],
  nom: 'MOTEUR CC',
  prefixe: 'M',
  categorie: 'Mécanique',
  version: '1.0.0', regles: 1,
  description: 'Motoréducteur à courant continu : R d\'induit, force contre-électromotrice ke·ω, inertie, frottement, réducteur et butées. Publie l\'angle de l\'arbre de sortie sur l\'axe nommé (⚙ « Axe »), lu par une mécanique (monture…).',
  broches: ['+', '-'],
  typesBroches: { passif: ['+', '-'] },
  cotes: { gauche: ['+'], droite: ['-'] },
  largeur: 80, hauteur: 80,
  parametres: [
    { cle: 'axe', nom: 'Axe entraîné (nom)', type: 'texte', defaut: 'AXE1' },
    { cle: 'R', nom: 'Résistance d\'induit', unite: 'Ω', defaut: 24, min: 0.1, max: 1000, echelle: 'log' },
    { cle: 'ke', nom: 'Constante ke = kt', unite: 'V·s/rad', defaut: 0.02, min: 1e-4, max: 1, echelle: 'log' },
    { cle: 'J', nom: 'Inertie du rotor', unite: 'kg·m²', defaut: 2e-6, min: 1e-9, max: 1, echelle: 'log' },
    { cle: 'b', nom: 'Frottement visqueux', unite: 'N·m·s/rad', defaut: 1e-6, min: 0, max: 0.1, echelle: 'lin', pas: 1e-7 },
    { cle: 'reduction', nom: 'Rapport de réduction', unite: '', defaut: 3000, min: 1, max: 1e5, echelle: 'log' },
    { cle: 'charge', nom: 'Couple résistant (sortie)', unite: 'N·m', defaut: 0, min: 0, max: 100, echelle: 'lin', pas: 0.01 },
    { cle: 'angleMin', nom: 'Butée basse', unite: '°', defaut: -180, min: -36000, max: 36000, echelle: 'lin', pas: 1 },
    { cle: 'angleMax', nom: 'Butée haute', unite: '°', defaut: 180, min: -36000, max: 36000, echelle: 'lin', pas: 1 },
    { cle: 'angle0', nom: 'Angle de départ', unite: '°', defaut: 0, min: -36000, max: 36000, echelle: 'lin', pas: 1 },
  ],
  principal: 'charge',
  variables: [
    { cle: 'angle', nom: 'Angle de sortie', unite: 'rad' },
    { cle: 'vitesse', nom: 'Vitesse de sortie', unite: 'rad/s' },
    { cle: 'courant', nom: 'Courant d\'induit', unite: 'A' },
    { cle: 'couple', nom: 'Couple de sortie', unite: 'N·m' },
  ],
  mecanique: { pilote: ['$axe'] },
  modele3d: null,
  modele: {
    elements: [{ t: 'O', a: '+', ref: '-', V: 0, R: '$R', nom: 'induit' }],
    etat: p => ({ angle: rad(p.angle0 ?? 0), vitesse: 0, courant: 0, couple: 0, omega: 0 }),
    pas(c) {
      const s = c.s, p = c.p, n = p.reduction;
      const i = c.i('induit');                                   // courant du pas précédent (E du pas précédent)
      const couple = p.ke * i;                                   // kt = ke (SI)
      let w = s.omega + (couple - p.b * s.omega - p.charge / n) / p.J * c.dt;
      let a = s.angle + w / n * c.dt;
      const aMin = rad(p.angleMin), aMax = rad(p.angleMax);
      if (a <= aMin && w < 0) { a = aMin; w = 0; }              // butée : l'arbre s'arrête
      if (a >= aMax && w > 0) { a = aMax; w = 0; }
      Object.assign(s, { omega: w, angle: a, vitesse: w / n, courant: i, couple: couple * n });
      c.regler('induit', p.ke * w);                              // force contre-électromotrice
      c.monde.piloterAxe(p.axe, c.nom, c.k, a, w / n, couple * n);
    },
  },
  dessin(g, x) {
    g.fillStyle = '#1a2024'; g.beginPath(); g.arc(0, 0, 26, 0, 7); g.fill();
    g.fillStyle = '#d7e4e2'; g.font = 'bold 15px ui-sans-serif, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('M', 0, 1);
    dessinArbre(g, x, 0, 0, 30, '#ffcc00');
  },
  affichage: (s, p) => `${p.axe} · ${Math.round(deg(s.angle ?? 0))}°`,
});

FrWA.puce({
  id: 'servo-pwm', tags: ['basic', 'moteur', 'arduino'],
  nom: 'SERVO',
  prefixe: 'SV',
  categorie: 'Mécanique',
  version: '1.0.0', regles: 1,
  description: 'Servomoteur de modélisme (type SG90) : une impulsion toutes les 20 ms sur SIG, 1 ms = 0°, 2 ms = 180° (réglables). Vitesse limitée, ne bouge pas sous 3,5 V. Publie l\'angle sur l\'axe nommé. Essai : horloge 50 Hz, rapport cyclique 5 % à 10 %.',
  broches: ['GND', 'V+', 'SIG'],            // fil marron, rouge, orange
  typesBroches: { alim_entree: ['GND', 'V+'], entree: ['SIG'] },
  cotes: { gauche: ['SIG', 'V+', 'GND'] },
  largeur: 120, hauteur: 80,
  parametres: [
    { cle: 'axe', nom: 'Axe entraîné (nom)', type: 'texte', defaut: 'SERVO1' },
    { cle: 'course', nom: 'Course', unite: '°', defaut: 180, min: 10, max: 360, echelle: 'lin', pas: 1 },
    { cle: 'impMin', nom: 'Impulsion pour 0°', unite: 's', defaut: 1e-3, min: 2e-4, max: 3e-3, echelle: 'lin', pas: 1e-5 },
    { cle: 'impMax', nom: 'Impulsion pour la course', unite: 's', defaut: 2e-3, min: 2e-4, max: 3e-3, echelle: 'lin', pas: 1e-5 },
    { cle: 'vmax', nom: 'Vitesse maximale', unite: '°/s', defaut: 600, min: 1, max: 5000, echelle: 'log' },
    { cle: 'angle0', nom: 'Angle de départ', unite: '°', defaut: 90, min: 0, max: 360, echelle: 'lin', pas: 1 },
  ],
  principal: 'vmax',
  variables: [
    { cle: 'angle', nom: 'Angle', unite: 'rad' },
    { cle: 'consigne', nom: 'Consigne', unite: 'rad' },
    { cle: 'largeur', nom: 'Largeur d\'impulsion lue', unite: 's' },
    { cle: 'vitesse', nom: 'Vitesse', unite: 'rad/s' },
  ],
  mecanique: { pilote: ['$axe'] },
  modele3d: null,
  modele: {
    elements: [
      { t: 'R', a: 'V+', b: 'GND', R: 500 },                    // électronique au repos ≈ 10 mA sous 5 V
      { t: 'I', a: 'V+', b: 'GND', I: 0, nom: 'moteur' },       // moteur en mouvement
      { t: 'R', a: 'SIG', b: 'GND', R: 47e3 },
    ],
    etat: p => ({ angle: rad(p.angle0 ?? 90), consigne: rad(p.angle0 ?? 90), largeur: 0, vitesse: 0, mesure: new FrWA.bus.MesureImpulsion() }),
    pas(c) {
      const s = c.s, p = c.p, gnd = c.v('GND'), alim = c.v('V+') - gnd;
      const haut = FrWA.bus.lireNiveau(c.v('SIG') - gnd, alim, s.mesure.prec, 'ttl');
      const l = s.mesure.echantillonner(c.t, haut);
      // consigne : seulement si une impulsion plausible a été vue dans les 50 dernières ms
      if (l !== null && c.t - s.mesure.dernierFront < 0.05 && l > 0.2e-3 && l < 3e-3) {
        s.largeur = l;
        const f = Math.max(0, Math.min(1, (l - p.impMin) / (p.impMax - p.impMin)));
        s.consigne = rad(f * p.course);
      }
      const ecart = s.consigne - s.angle, pasMax = rad(p.vmax) * c.dt;
      const d = alim < 3.5 ? 0 : Math.max(-pasMax, Math.min(pasMax, ecart));
      s.angle += d; s.vitesse = d / c.dt;
      c.regler('moteur', Math.abs(d) > 1e-9 ? 0.15 : 0);
      c.monde.piloterAxe(p.axe, c.nom, c.k, s.angle, s.vitesse);
    },
  },
  dessin(g, x) {
    g.fillStyle = '#1f4f8f'; g.fillRect(-36, -18, 72, 36);
    g.fillStyle = '#e8e8e8'; g.beginPath(); g.arc(18, 0, 6, 0, 7); g.fill();
    // palonnier : 0° à droite, la course tourne dans le sens trigonométrique
    const a = x.s.angle ?? 0;
    g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(18, 0); g.lineTo(18 + 24 * Math.cos(a), -24 * Math.sin(a)); g.stroke();
    g.strokeStyle = '#ffcc0088'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(18, 0); g.lineTo(18 + 28 * Math.cos(x.s.consigne ?? 0), -28 * Math.sin(x.s.consigne ?? 0)); g.stroke();
  },
  affichage: (s, p) => `${p.axe} · ${Math.round(deg(s.angle ?? 0))}°`,
});
})();
