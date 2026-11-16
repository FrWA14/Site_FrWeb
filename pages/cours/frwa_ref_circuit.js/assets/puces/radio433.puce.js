// Modules radio 433 MHz en modulation tout-ou-rien (ASK/OOK), du type FS1000A (émetteur) et XY-MK-5V (récepteur).
// Pas de fiche constructeur officielle pour ces modules : puissance et sensibilité sont des ordres de grandeur réglables.
// L'émetteur déclare sa porteuse au « monde » à chaque pas ; le récepteur calcule la puissance reçue (distance, obstacles).
// Quand aucune porteuse n'est reçue, un récepteur super-régénératif sort du BRUIT (son gain automatique monte au maximum) :
// c'est pour cela que le HT12D vérifie l'adresse et exige 3 mots identiques.

(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const VUS = new Map();      // anneaux déjà dessinés : temps simulé → instant d'affichage (dessin seulement)
const ANTENNE_TX = [60, -10], ANTENNE_RX = [-60, -10];   // position de l'antenne dans la puce (repère local)

FrWA.puce({
  id: 'tx433', tags: ['radio', 'module', 'arduino'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VCC', 'GND'], entree: ['DATA'] },
  variables: [{ cle: 'actif', nom: 'Porteuse émise', type: 'bool' }, { cle: 'dBm', nom: 'Puissance émise', unite: 'dBm' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'TX 433',
  prefixe: 'TX',
  categorie: 'Radio',
  description: 'Émetteur 433 MHz tout-ou-rien (type FS1000A, 3 à 12 V) : DATA à 1 → porteuse émise. Les ondes sont dessinées autour de l\'antenne ; le cercle pointillé marque la portée pour un récepteur de sensibilité −105 dBm.',
  broches: ['DATA', 'VCC', 'GND'],
  cotes: { gauche: ['DATA', 'VCC', 'GND'] },
  largeur: 120,
  parametres: [
    { cle: 'dBm', nom: 'Puissance sous 5 V', unite: 'dBm', defaut: 10, min: -30, max: 20, echelle: 'lin', pas: 1 },
    { cle: 'freq', nom: 'Fréquence', unite: 'MHz', defaut: 433.92, min: 1, max: 6000, echelle: 'log' },
  ],
  principal: 'dBm',
  modele: {
    elements: [
      { t: 'R', a: 'DATA', b: 'GND', R: 100e3 },
      { t: 'S', a: 'VCC', b: 'GND', ferme: false, Ron: 400, Roff: 1e6, nom: 'conso' },   // ≈ 12 mA en émission sous 5 V
    ],
    etat: () => ({ actif: false, anneaux: [], dBm: 0 }),
    pas(c) {
      const s = c.s, gnd = c.v('GND'), vcc = c.v('VCC') - gnd, alim = vcc >= 3;
      s.actif = alim && c.v('DATA') - gnd > vcc / 2;
      s.dBm = c.p.dBm + 20 * Math.log10(Math.max(vcc, 0.1) / 5);
      const [x, y] = c.ici.point(...ANTENNE_TX);
      c.monde.emettre(c.ici.id, { x, y, freq: c.p.freq, dBm: s.dBm, actif: s.actif, alim });
      c.regler('conso', s.actif);
      // un anneau d'onde toutes les 20 ms de temps simulé (R8 : pas d'heure réelle dans la simulation)
      if (s.actif && (!s.anneaux.length || c.t - s.anneaux[s.anneaux.length - 1] > 0.02)) { s.anneaux.push(c.t); if (s.anneaux.length > 40) s.anneaux.shift(); }
    },
  },
  ondes(g, x) {
    const [ax, ay] = x.ici.point(...ANTENNE_TX), portee = x.monde.portee(x.s.dBm ?? x.p.dBm, -105, x.p.freq);
    g.strokeStyle = 'rgba(255,170,60,.35)'; g.setLineDash([8, 8]); g.lineWidth = 1.5;
    g.beginPath(); g.arc(ax, ay, portee, 0, 7); g.stroke(); g.setLineDash([]);
    for (const t0 of x.s.anneaux || []) {
      // dessin seulement : l'anneau part quand il est vu pour la première fois, puis grandit en temps réel (ralenti :
      // la vraie onde va à 300 000 km/s)
      if (!VUS.has(t0)) { VUS.set(t0, x.maintenant); if (VUS.size > 200) VUS.delete(VUS.keys().next().value); }
      const r = (x.maintenant - VUS.get(t0)) * 0.45;
      if (r > portee) continue;
      g.strokeStyle = `rgba(255,170,60,${0.85 * (1 - r / portee)})`; g.lineWidth = 2.5;
      g.beginPath(); g.arc(ax, ay, r, 0, 7); g.stroke();
    }
  },
  dessin(g, x) {
    g.fillStyle = '#1f5a2c'; g.fillRect(-36, -30, 72, 40);
    g.strokeStyle = '#d9b44a'; g.lineWidth = 2; g.beginPath();
    for (let k = 0; k < 6; k++) g.arc(30, -26 + k * 5, 3, Math.PI / 2, -Math.PI / 2, k % 2);
    g.stroke(); g.beginPath(); g.moveTo(30, -26); g.lineTo(60, -10); g.stroke();
    g.fillStyle = x.s.actif ? '#ff9a3c' : '#3a2a14'; g.beginPath(); g.arc(-22, -18, 5, 0, 7); g.fill();
  },
  affichage: s => (s.actif ? 'porteuse' : 'silence'),
});

FrWA.puce({
  id: 'rx433', tags: ['radio', 'module', 'arduino'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VCC', 'GND'], sortie: ['DATA'] },
  variables: [{ cle: 'rssi', nom: 'Puissance reçue (max)', unite: 'dBm' }, { cle: 'etat', nom: 'État', type: 'texte' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'RX 433',
  prefixe: 'RX',
  categorie: 'Radio',
  description: 'Récepteur 433 MHz tout-ou-rien (type XY-MK-5V, super-régénératif). DATA recopie la porteuse reçue si sa puissance dépasse la sensibilité ; sinon il sort du bruit. Indicateur de niveau reçu (RSSI) dans la puce.',
  broches: ['VCC', 'DATA', 'GND'],
  cotes: { droite: ['VCC', 'DATA', 'GND'] },
  largeur: 120,
  parametres: [
    { cle: 'sens', nom: 'Sensibilité', unite: 'dBm', defaut: -105, min: -130, max: -50, echelle: 'lin', pas: 1 },
    { cle: 'freq', nom: 'Fréquence', unite: 'MHz', defaut: 433.92, min: 1, max: 6000, echelle: 'log' },
    { cle: 'cag', nom: 'Maintien du gain (CAG)', unite: 's', defaut: 0.03, min: 0.001, max: 1, echelle: 'log' },
  ],
  principal: 'sens',
  modele: {
    elements: [
      { t: 'O', a: 'DATA', ref: 'GND', V: 0, R: 300, nom: 'sortie' },
      { t: 'R', a: 'VCC', b: 'GND', R: 1000 },                // ≈ 5 mA sous 5 V
    ],
    etat: () => ({ rssi: -200, etat: 'bruit', porteuse: -1, bruit: false, bruitFin: 0, glitch: 0, marge: -99 }),
    pas(c) {
      const s = c.s, gnd = c.v('GND'), vcc = c.v('VCC') - gnd, t = c.t;
      if (vcc < 3) { c.regler('sortie', 0); s.etat = 'éteint'; return; }
      const [x, y] = c.ici.point(...ANTENNE_RX), r = c.monde.recevoir(x, y, c.p.freq);
      s.rssi = r.dBmMax; s.marge = r.dBmMax - c.p.sens;      // marge du signal (porteuse allumée ou non)
      let sortie;
      if (r.dBm >= c.p.sens) { s.porteuse = t; sortie = true; s.etat = 'signal'; }
      else if (s.porteuse >= 0 && t - s.porteuse < c.p.cag && r.dBmMax >= c.p.sens) { sortie = false; s.etat = 'signal'; }
      else {                                                    // bruit du récepteur super-régénératif
        if (t >= s.bruitFin) { s.bruit = !s.bruit; s.bruitFin = t + 5e-5 + c.aleatoire() * 6e-4; }
        sortie = s.bruit; s.etat = 'bruit';
      }
      // signal faible (moins de 6 dB de marge) : erreurs ponctuelles
      if (s.etat === 'signal' && s.marge < 6 && c.aleatoire() < (6 - Math.max(0, s.marge)) / 6 * c.dt / 4e-4) s.glitch = t + 2e-4;
      if (t < s.glitch) sortie = !sortie;
      c.regler('sortie', sortie ? vcc : 0);
    },
  },
  dessin(g, x) {
    g.fillStyle = '#1f5a2c'; g.fillRect(-36, -30, 72, 40);
    g.strokeStyle = '#d9b44a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-36, -10); g.lineTo(-60, -10); g.moveTo(-60, -10); g.lineTo(-60, -34); g.stroke();
    // indicateur RSSI de −120 à −20 dBm
    const n = Math.max(0, Math.min(1, ((x.s.rssi ?? -200) + 120) / 100));
    g.fillStyle = '#0b0f0e'; g.fillRect(-30, -24, 60, 8);
    g.fillStyle = x.s.etat === 'signal' ? '#5ee87a' : '#ff6b6b'; g.fillRect(-30, -24, 60 * n, 8);
    g.strokeStyle = '#ffffff'; g.lineWidth = 1; const xs = -30 + 60 * Math.max(0, Math.min(1, (x.p.sens + 120) / 100)); g.beginPath(); g.moveTo(xs, -27); g.lineTo(xs, -13); g.stroke();
  },
  affichage: s => (s.etat === 'signal' ? `${Math.round(s.rssi)} dBm` : s.etat === 'bruit' ? `bruit (${Number.isFinite(s.rssi) ? Math.round(s.rssi) + ' dBm' : 'rien'})` : s.etat),
});
})();
