// Transducteurs ultrasonores 40 kHz (Murata MA40S4S émetteur / MA40S4R récepteur, fiche DM-U16-483) :
//  - émetteur : 120 dB SPL (20 Pa) à 30 cm pour 10 Vrms → 2 Pa par volt (composante à 40 kHz),
//  - récepteur : sensibilité −63 dB (0 dB = 10 V/Pa) → 7,1 mV par pascal,
//  - les deux sont des résonateurs piézo très sélectifs : filtre passe-bande 40 kHz (Q ≈ 20) dans le modèle.
// Face active vers le HAUT de la puce (tourner la puce pour viser). Le « monde » transporte l'onde : retard = trajet / c
// (c = 331,3 + 0,606 × T), atténuation 0,3 m / trajet, réflexion selon la matière, absorption ≈ 1,3 dB/m.

(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

function passeBande(f0, Q, dt) {    // biquad (gain 1 à f0)
  const w = 2 * Math.PI * f0 * dt, a = Math.sin(w) / (2 * Q), a0 = 1 + a;
  return { b0: a / a0, b2: -a / a0, a1: -2 * Math.cos(w) / a0, a2: (1 - a) / a0 };
}
function filtrer(s, cf, x) {
  const y = cf.b0 * x + cf.b2 * s.x2 - cf.a1 * s.y1 - cf.a2 * s.y2;
  s.x2 = s.x1; s.x1 = x; s.y2 = s.y1; s.y1 = y; return y;
}
const FACE = [0, -40];      // centre de la face active, repère local (boîte 80 × 80)

const dessinTransducteur = (g, x, recepteur) => {
  g.fillStyle = '#9aa3a8'; g.beginPath(); g.arc(0, -8, 26, 0, 7); g.fill();
  g.fillStyle = '#2b2f33'; g.beginPath(); g.arc(0, -8, 21, 0, 7); g.fill();
  g.strokeStyle = '#6b737a'; g.lineWidth = 1;
  for (let k = -18; k <= 18; k += 6) { g.beginPath(); g.moveTo(k, -8 - Math.sqrt(Math.max(0, 441 - k * k))); g.lineTo(k, -8 + Math.sqrt(Math.max(0, 441 - k * k))); g.stroke(); }
  g.fillStyle = recepteur ? '#5aa9ff' : '#ff9a3c'; g.font = 'bold 9px ui-sans-serif'; g.textAlign = 'center'; g.fillText(recepteur ? 'R' : 'T', 0, -5);
  g.strokeStyle = '#ffffff55'; g.beginPath(); g.moveTo(-12, -38); g.lineTo(0, -46); g.lineTo(12, -38); g.stroke();
};

FrWA.puce({
  id: 'us-emetteur', tags: ['capteur', 'son', 'monde'],
  version: '1.0.0', regles: 1,
  typesBroches: { passif: ['+', '-'] },
  variables: [],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'MA40S4S',
  prefixe: 'UT',
  categorie: 'Ultrasons',
  description: 'Émetteur ultrasonore 40 kHz (Murata MA40S4S) : 120 dB SPL à 30 cm sous 10 Vrms. Face active vers le haut de la puce. Les ondes et leurs échos sont dessinés à leur vraie vitesse (343 m/s) dans le temps simulé.',
  broches: ['+', '-'],
  cotes: { bas: ['+', '-'] },
  parametres: [{ cle: 'f0', nom: 'Fréquence de résonance', unite: 'Hz', defaut: 40000, min: 20000, max: 60000, echelle: 'lin', pas: 100 }],
  modele: {
    elements: [{ t: 'C', a: '+', b: '-', C: 2.2e-9 }, { t: 'R', a: '+', b: '-', R: 1e6 }],
    etat: () => ({ x1: 0, x2: 0, y1: 0, y2: 0, salves: [], actifJusqua: -1, p: 0 }),
    pas(c) {
      const s = c.s;
      if (!s.cf || s.dtcf !== c.dt) { s.cf = passeBande(c.p.f0, 20, c.dt); s.dtcf = c.dt; }
      const y = filtrer(s, s.cf, c.v('+') - c.v('-'));
      s.p = 2 * y;                                            // pression à 30 cm (Pa)
      const [x, yy] = c.ici.point(...FACE);
      c.monde.enregistrerSon(c.ici.id, x, yy, c.ici.direction(0, -1), c.dt, c.k, s.p);
      if (Math.abs(s.p) > 0.5) { if (c.t > s.actifJusqua + 2e-3) { s.salves.push(c.t); if (s.salves.length > 6) s.salves.shift(); } s.actifJusqua = c.t; }
    },
  },
  ondes(g, x) {
    const m = x.monde, [fx, fy] = x.ici.point(...FACE), [dx, dy] = x.ici.direction(0, -1);
    const c = m.vitesseSon(fx, fy), mpx = m.mParPx(), a0 = Math.atan2(dy, dx);
    const h = m.lancerRayon(fx, fy, dx, dy);
    for (const t0 of x.s.salves || []) {
      const r = (x.tsim - t0) * c / mpx; if (r <= 0) continue;
      const fin = (h ? 2 * h.d : 3000) + 60; if (r > fin) continue;
      const al = Math.max(0, 1 - r / fin);
      g.strokeStyle = `rgba(255,154,60,${0.9 * al})`; g.lineWidth = 3;
      if (!h || r < h.d) { g.beginPath(); g.arc(fx, fy, r, a0 - 0.7, a0 + 0.7); g.stroke(); }
      if (h && r > h.d) {                                        // écho renvoyé par l'objet
        g.strokeStyle = `rgba(90,169,255,${0.9 * al})`; g.beginPath(); g.arc(h.x, h.y, r - h.d, a0 + Math.PI - 0.8, a0 + Math.PI + 0.8); g.stroke();
      }
    }
    if (h) { g.strokeStyle = 'rgba(255,154,60,.18)'; g.setLineDash([4, 6]); g.lineWidth = 1; g.beginPath(); g.moveTo(fx, fy); g.lineTo(h.x, h.y); g.stroke(); g.setLineDash([]); }
  },
  dessin(g, x) { dessinTransducteur(g, x, false); },
});

FrWA.puce({
  id: 'us-recepteur', tags: ['capteur', 'son', 'monde'],
  version: '1.0.0', regles: 1,
  typesBroches: { passif: ['+', '-'] },
  variables: [],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'MA40S4R',
  prefixe: 'UR',
  categorie: 'Ultrasons',
  description: 'Récepteur ultrasonore 40 kHz (Murata MA40S4R) : −63 dB (≈ 7 mV/Pa). Reçoit l\'écho des objets du monde situés devant les émetteurs, plus un peu de couplage direct. Sortie de quelques millivolts : il faut amplifier.',
  broches: ['+', '-'],
  cotes: { bas: ['+', '-'] },
  parametres: [
    { cle: 'f0', nom: 'Fréquence de résonance', unite: 'Hz', defaut: 40000, min: 20000, max: 60000, echelle: 'lin', pas: 100 },
    { cle: 'couplage', nom: 'Couplage direct émetteur → récepteur', unite: '', defaut: 0.003, min: 0, max: 0.2, echelle: 'lin', pas: 0.001 },
  ],
  modele: {
    elements: [{ t: 'O', a: '+', ref: '-', V: 0, R: 1000, nom: 'sortie' }],
    etat: () => ({ x1: 0, x2: 0, y1: 0, y2: 0, crete: 0, distance: null }),
    pas(c) {
      const s = c.s;
      if (!s.cf || s.dtcf !== c.dt) { s.cf = passeBande(c.p.f0, 20, c.dt); s.dtcf = c.dt; }
      const [x, y] = c.ici.point(...FACE);
      const r = c.monde.pressionRecue(x, y, c.ici.direction(0, -1), c.k, c.p.couplage);
      const v = 7.08e-3 * filtrer(s, s.cf, r.p);                // V par Pa
      s.crete = Math.max(Math.abs(v), s.crete * (1 - c.dt / 2e-3));
      s.distance = r.trajets.length ? r.trajets[0].d : null;
      c.regler('sortie', v);
    },
  },
  dessin(g, x) { dessinTransducteur(g, x, true); },
  affichage: s => (s.distance !== null && s.distance !== undefined ? `objet ${FrWA.formater(s.distance, 'm')}` : 'pas d\'objet'),
});
})();
