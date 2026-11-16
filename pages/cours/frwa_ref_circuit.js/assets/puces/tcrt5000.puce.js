// TCRT5000 — capteur optique réflectif : LED infrarouge 950 nm + phototransistor (datasheet Vishay 83760).
// Courant collecteur ≈ 1 mA pour IF = 10 mA à 12 mm (CTR ≈ 10 %), maximum vers 2,5 mm (Fig. 9 : courbe relative
// relevée ci-dessous), plage utile 0,2 à 15 mm. Paramètres : distance (molette) et surface (clic sur la puce).
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const D_MM = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const REL = [0, 0.55, 0.8, 0.92, 0.98, 1, 0.99, 0.93, 0.83, 0.72, 0.62, 0.52, 0.45, 0.38, 0.33, 0.29, 0.26, 0.23, 0.21, 0.19];
const REFLET = { blanc: 1, gris: 0.45, noir: 0.08, rien: 0 };
function relatif(d) {
  if (d >= 16) return 0.19 * (16 / d) ** 2;
  let i = 0; while (D_MM[i + 1] < d) i++;
  const t = (d - D_MM[i]) / (D_MM[i + 1] - D_MM[i]);
  return REL[i] + t * (REL[i + 1] - REL[i]);
}
const BETA = 300;

FrWA.puce({
  id: 'tcrt5000', tags: ['capteur', 'optique', 'arduino'],
  version: '1.0.0', regles: 1,
  typesBroches: { passif: ['C', 'E', 'A', 'K'] },
  variables: [{ cle: 'ctr', nom: 'Rapport de transfert (CTR)', unite: '' }, { cle: 'iled', nom: 'Courant LED IR', unite: 'A' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'TCRT5000',
  prefixe: 'U',
  categorie: 'Capteurs',
  description: 'Capteur réflectif infrarouge. Le courant du phototransistor dépend de la distance (maxi à 2,5 mm) et de la couleur de la surface. Molette : distance ; clic sur la puce : surface suivante.',
  broches: ['C', 'E', 'A', 'K'],                       // collecteur, émetteur (détecteur) ; anode, cathode (LED IR)
  cotes: { gauche: ['A', 'K'], droite: ['C', 'E'] },
  largeur: 120, hauteur: 160,
  parametres: [
    { cle: 'distance', nom: 'Distance à la surface', unite: 'mm', defaut: 3, min: 0.2, max: 40, echelle: 'lin', pas: 0.1 },
    { cle: 'surface', nom: 'Surface', type: 'choix', options: Object.keys(REFLET), defaut: 'blanc' },
    { cle: 'source', nom: 'Distance et surface données par', type: 'choix', options: ['réglages', 'monde physique'], defaut: 'réglages' },
  ],
  principal: 'distance',
  modele: {
    elements: [
      { t: 'D', a: 'A', b: 'k_int', N: 1.6, Vf: 1.18, If: 0.02 },        // LED IR : ≈ 1,2 V à 20 mA (VF typ. 1,25 V à 60 mA)
      { t: 'A', a: 'k_int', b: 'K', nom: 'iled' },
      { t: 'Q', c: 'C', b: 'base', e: 'E', beta: BETA },
      { t: 'F', a: 'E', b: 'base', mesure: 'iled', gain: (p, s) => (s.ctr || 0) / BETA },
      { t: 'I', a: 'C', b: 'E', I: 10e-9 },                               // courant d'obscurité (10 nA typ.)
    ],
    etat: () => ({ ctr: 0, iled: 0 }),
    pas(c) {
      c.s.iled = c.i('iled');
      let d = c.p.distance, refl = REFLET[c.p.surface] ?? 1;
      if (c.p.source === 'monde physique') {
        // rayon infrarouge depuis la face du capteur (bas de la puce) vers le premier objet du monde
        const [x, y] = c.ici.point(0, 80), [dx, dy] = c.ici.direction(0, 1), h = c.monde.lancerRayon(x, y, dx, dy);
        if (h) { d = Math.max(0.05, h.d * c.monde.mParPx() * 1000); refl = c.monde.matiere(h.objet).refIR; c.s.objet = h.objet.params.matiere; c.s.cible = [h.x, h.y]; }
        else { d = 1000; refl = 0; c.s.objet = null; c.s.cible = null; }
        c.s.dMonde = d;
      }
      c.s.ctr = 0.10 * relatif(d) / relatif(12) * refl;
    },
  },
  ondes(g, x) {
    if (x.p.source !== 'monde physique' || !x.s.cible || (x.s.iled || 0) < 1e-3) return;
    const [ax, ay] = x.ici.point(-12, 80), [bx, by] = x.ici.point(12, 80), [cx, cy] = x.s.cible;
    g.strokeStyle = 'rgba(255,60,60,.55)'; g.setLineDash([3, 3]); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(cx, cy); g.lineTo(bx, by); g.stroke(); g.setLineDash([]);
  },
  interaction: {
    clic: (s, p) => { const o = Object.keys(REFLET); p.surface = o[(o.indexOf(p.surface) + 1) % o.length]; },
  },
  dessin(g, x) {
    // vue de côté : la LED (gauche) et le phototransistor (droite) au-dessus de la surface
    if (x.p.source === 'monde physique') {   // la vraie surface est l'objet du monde, sous la puce
      g.fillStyle = '#1b1b22'; g.fillRect(-26, 56, 52, 14);
      g.fillStyle = '#5b6cff'; g.beginPath(); g.arc(-12, 70, 6, 0, Math.PI); g.fill();
      g.fillStyle = '#222'; g.strokeStyle = '#888'; g.lineWidth = 1; g.beginPath(); g.arc(12, 70, 6, 0, Math.PI); g.fill(); g.stroke();
      return;
    }
    const d = Math.min(x.p.distance, 30), yS = 26 + d * 1.6, refl = REFLET[x.p.surface] ?? 1;
    g.fillStyle = '#1b1b22'; g.fillRect(-26, 6, 52, 14);
    g.fillStyle = '#5b6cff'; g.beginPath(); g.arc(-12, 20, 6, 0, Math.PI); g.fill();
    g.fillStyle = '#222'; g.strokeStyle = '#888'; g.lineWidth = 1; g.beginPath(); g.arc(12, 20, 6, 0, Math.PI); g.fill(); g.stroke();
    const teinte = { blanc: '#e8e8e8', gris: '#777', noir: '#1a1a1a', rien: null }[x.p.surface];
    if (teinte) { g.fillStyle = teinte; g.fillRect(-34, yS, 68, 5); g.strokeStyle = '#555'; g.strokeRect(-34, yS, 68, 5); }
    if (x.marche && x.i('A') > 1e-3 && teinte) {
      g.strokeStyle = `rgba(255,80,80,${0.25 + 0.6 * refl})`; g.setLineDash([3, 3]); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-12, 26); g.lineTo(0, yS); g.lineTo(12, 26); g.stroke(); g.setLineDash([]);
    }
  },
  affichage: (s, p) => (p.source === 'monde physique'
    ? (s.objet ? `${FrWA.formater((s.dMonde || 0) / 1000, 'm', 2)} · ${s.objet}` : 'aucun objet')
    : `${FrWA.formater(p.distance / 1000, 'm', 2)} · ${p.surface}`),
});
})();
