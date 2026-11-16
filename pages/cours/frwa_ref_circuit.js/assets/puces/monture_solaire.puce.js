// Monture solaire 2 axes : panneau + 4 photorésistances GL5528 séparées par une croix d'ombrage.
// Ce n'est pas une puce du commerce : c'est un « composant mécanique » écrit avec le même format d'extension.
//  - Photorésistance GL5528 : 8 à 20 kΩ sous 10 lux, ≥ 1 MΩ dans le noir, gamma 0,7 → R = R10 × (E / 10 lux)^−0,7.
//  - La croix d'ombrage : si le soleil est plus à l'est que l'axe du panneau, la LDR « E » reçoit plus de lumière que « O ».
//  - Règles v1 (R10) : la monture n'a PAS de moteur interne. Elle lit l'angle de deux AXES mécaniques (azimut, hauteur)
//    pilotés par des composants « Moteur CC » ou « Servo » qui portent le même nom d'axe (⚙ « Axe »).
//  - Règle R9 : pas de vue 3D calculée ici. La carte du ciel (2D) reste ; la 3D est dans la fenêtre 3D, par l'extension
//    static/extensions/3d/monture_solaire.vue3d.js qui lit les variables publiées (azimut, hauteur, soleil).
// Soleil : « fixe » (molette = azimut, ⚙ = hauteur), « mouvement » (course d'une journée), ou « lampe du monde » :
// la direction et l'éclairement viennent de la source de lumière la plus proche, que l'on déplace à la souris.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const sig = x => 0.5 + 0.5 * Math.tanh(x);
const { rad, deg } = FrWA.unites;

FrWA.puce({
  id: 'monture-solaire-2axes', tags: ['moteur', 'capteur', 'monde'],
  nom: 'MONTURE 2 AXES',
  prefixe: 'M',
  categorie: 'Mécanique',
  version: '2.0.0', regles: 1,
  description: 'Panneau solaire orientable : 4 photorésistances GL5528 (Est, Ouest, Haut, Bas) derrière une croix d\'ombrage. L\'azimut et la hauteur du panneau sont les angles de deux axes mécaniques (⚙), entraînés par des moteurs CC ou des servos. Le soleil peut être fixe, en mouvement, ou une lampe du monde à déplacer.',
  broches: [
    { nom: 'E1', etiquette: 'LDR E' }, { nom: 'E2', etiquette: 'LDR E' }, { nom: 'O1', etiquette: 'LDR O' }, { nom: 'O2', etiquette: 'LDR O' },
    { nom: 'H1', etiquette: 'LDR H' }, { nom: 'H2', etiquette: 'LDR H' }, { nom: 'B1', etiquette: 'LDR B' }, { nom: 'B2', etiquette: 'LDR B' },
  ],
  typesBroches: { passif: ['E1', 'E2', 'O1', 'O2', 'H1', 'H2', 'B1', 'B2'] },
  cotes: { gauche: ['E1', 'E2', 'O1', 'O2', null, 'H1', 'H2', 'B1', 'B2'] },
  largeur: 280, hauteur: 200,
  parametres: [
    { cle: 'solAz', nom: 'Azimut du soleil (+ = est)', unite: '°', defaut: 35, min: -80, max: 80, echelle: 'lin', pas: 1 },
    { cle: 'solEl', nom: 'Hauteur du soleil', unite: '°', defaut: 50, min: 5, max: 85, echelle: 'lin', pas: 1 },
    { cle: 'soleil', nom: 'Soleil', type: 'choix', options: ['fixe', 'mouvement', 'lampe du monde'], defaut: 'fixe' },
    { cle: 'lux', nom: 'Éclairement plein soleil (sur la LDR)', unite: 'lx', defaut: 800, min: 50, max: 20000, echelle: 'log' },
    { cle: 'axeAz', nom: 'Axe d\'azimut (nom)', type: 'texte', defaut: 'AZ' },
    { cle: 'axeEl', nom: 'Axe de hauteur (nom)', type: 'texte', defaut: 'EL' },
  ],
  principal: 'solAz',
  variables: [
    { cle: 'azimut', nom: 'Azimut du panneau', unite: 'rad' },
    { cle: 'hauteur', nom: 'Hauteur du panneau', unite: 'rad' },
    { cle: 'soleilAz', nom: 'Azimut du soleil', unite: 'rad' },
    { cle: 'soleilEl', nom: 'Hauteur du soleil', unite: 'rad' },
    { cle: 'eclairement', nom: 'Éclairement direct', unite: 'lx' },
    { cle: 'rendement', nom: 'Rendement d\'orientation (cos de l\'écart)', unite: '%' },
  ],
  mecanique: { lit: ['$axeAz', '$axeEl'] },
  modele3d: null,
  modele: {
    elements: [
      { t: 'R', a: 'E1', b: 'E2', R: (p, s) => s.rE || 1e4, nom: 'ldrE' },
      { t: 'R', a: 'O1', b: 'O2', R: (p, s) => s.rO || 1e4, nom: 'ldrO' },
      { t: 'R', a: 'H1', b: 'H2', R: (p, s) => s.rH || 1e4, nom: 'ldrH' },
      { t: 'R', a: 'B1', b: 'B2', R: (p, s) => s.rB || 1e4, nom: 'ldrB' },
    ],
    etat: () => ({ azimut: 0, hauteur: 0, soleilAz: 0, soleilEl: rad(45), eclairement: 800, rendement: 0, t: 0, lampe: false }),
    pas(c) {
      const s = c.s, p = c.p, dt = c.dt;
      s.t += dt;
      let L = p.lux, amb = 20, solAz, solEl;
      s.lampe = false;
      if (p.soleil === 'mouvement') { const u = (s.t * 4) % 160; solAz = 80 - u; solEl = 10 + 60 * Math.sin(Math.PI * u / 160); }
      else if (p.soleil === 'lampe du monde') {
        const l = c.monde.sourceLumiere(c.ici.x, c.ici.y);
        if (l) {
          // la lampe est vue depuis le centre de la monture : écart horizontal → azimut, écart vertical → hauteur
          const dx = l.x - c.ici.x, dy = l.y - c.ici.y, D = 400;
          solAz = Math.max(-80, Math.min(80, deg(Math.atan2(dx, D))));
          solEl = Math.max(5, Math.min(85, 45 + deg(Math.atan2(-dy, D))));
          L = Math.max(0, c.monde.lux(c.ici.x, c.ici.y) - c.monde.r.luxAmb); amb = c.monde.r.luxAmb; s.lampe = true;
        } else { L = 0; solAz = deg(s.soleilAz); solEl = deg(s.soleilEl); }
      } else { solAz = p.solAz; solEl = p.solEl; }
      // angles du panneau : lus sur les axes mécaniques (rad)
      s.azimut = c.monde.axe(p.axeAz).angle; s.hauteur = c.monde.axe(p.axeEl).angle;
      s.soleilAz = rad(solAz); s.soleilEl = rad(solEl); s.eclairement = L;
      const dAz = (solAz - deg(s.azimut)) / 15, dEl = (solEl - deg(s.hauteur)) / 15;
      const R = lux => 15e3 * Math.pow(Math.max(lux, 0.1) / 10, -0.7);
      s.rE = R(amb + L * sig(dAz)); s.rO = R(amb + L * sig(-dAz));
      s.rH = R(amb + L * sig(dEl)); s.rB = R(amb + L * sig(-dEl));
      // rendement : cosinus de l'angle entre la normale du panneau et la direction du soleil
      const dir = (a, e) => [Math.sin(a) * Math.cos(e), -Math.cos(a) * Math.cos(e), Math.sin(e)];
      const n = dir(s.azimut, s.hauteur), d = dir(s.soleilAz, s.soleilEl);
      s.rendement = 100 * Math.max(0, n[0] * d[0] + n[1] * d[1] + n[2] * d[2]);
    },
  },
  ondes(g, x) {   // rayon de la lampe vers la monture
    if (!x.s.lampe) return;
    const l = x.monde.sourceLumiere(x.ici.x, x.ici.y); if (!l) return;
    g.strokeStyle = 'rgba(255,220,100,.35)'; g.lineWidth = 2; g.setLineDash([10, 8]);
    g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(x.ici.x, x.ici.y); g.stroke(); g.setLineDash([]);
  },
  dessin(g, x) {
    const s = x.s;
    // ----- carte du ciel (2D) : azimut en abscisse (est à droite), hauteur en ordonnée -----
    const X0 = -100, X1 = 130, Y0 = -88, Y1 = 50;
    const px = az => X0 + (az + 90) / 180 * (X1 - X0), py = el => Y1 - el / 90 * (Y1 - Y0);
    g.fillStyle = '#0b1830'; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    g.strokeStyle = '#24406b'; g.lineWidth = 1;
    for (const a of [-60, -30, 0, 30, 60]) { g.beginPath(); g.moveTo(px(a), Y0); g.lineTo(px(a), Y1); g.stroke(); }
    for (const e of [30, 60]) { g.beginPath(); g.moveTo(X0, py(e)); g.lineTo(X1, py(e)); g.stroke(); }
    g.fillStyle = '#3d5a2a'; g.fillRect(X0, Y1, X1 - X0, 5);
    g.fillStyle = '#7d908d'; g.font = '8px ui-sans-serif, sans-serif'; g.textAlign = 'center';
    g.fillText('O', px(-85), Y1 + 13); g.fillText('S', px(0), Y1 + 13); g.fillText('E', px(85), Y1 + 13);
    g.fillStyle = '#ffd400'; g.shadowColor = '#ffd400'; g.shadowBlur = 10; g.beginPath(); g.arc(px(deg(s.soleilAz ?? 0)), py(deg(s.soleilEl ?? 0)), 6, 0, 7); g.fill(); g.shadowBlur = 0;
    const ax = px(deg(s.azimut ?? 0)), ay = py(deg(s.hauteur ?? 0));
    g.strokeStyle = '#4ecdc4'; g.lineWidth = 2; g.beginPath(); g.moveTo(ax - 9, ay); g.lineTo(ax + 9, ay); g.moveTo(ax, ay - 9); g.lineTo(ax, ay + 9); g.stroke();
    g.beginPath(); g.arc(ax, ay, 5, 0, 7); g.stroke();
    g.fillStyle = '#0a0f0fcc'; g.fillRect(X0, Y0, 230, 14);
    g.fillStyle = '#ffcc00'; g.font = 'bold 9px ui-monospace, Consolas, monospace'; g.textAlign = 'left';
    g.fillText(`axes ${x.p.axeAz} / ${x.p.axeEl} · rendement ${Math.round(s.rendement ?? 0)} %`, X0 + 4, Y0 + 10);
  },
  affichage: s => `P ${Math.round(deg(s.azimut ?? 0))}°/${Math.round(deg(s.hauteur ?? 0))}° · S ${Math.round(deg(s.soleilAz ?? 0))}°/${Math.round(deg(s.soleilEl ?? 0))}°${s.lampe ? ' · ' + Math.round(s.eclairement) + ' lx' : ''}`,
});
})();
