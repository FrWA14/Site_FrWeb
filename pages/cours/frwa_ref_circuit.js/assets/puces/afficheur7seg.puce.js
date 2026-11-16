// Afficheur 7 segments à CATHODE COMMUNE (brochage courant 10 broches, type 5161AS / SC56-11).
// Chaque segment est une vraie LED du simulateur (≈ 2 V à 10 mA) : sa luminosité suit le courant qui la traverse.
// Exemple d'extension avec « dessin » : la puce dessine elle-même ses segments.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const SEG = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'];
const COULEURS = { rouge: ['#ff3b2f', 2.0], vert: ['#3dff6a', 2.1], bleu: ['#4a8dff', 3.0], jaune: ['#ffd23a', 2.1], blanc: ['#ffffff', 3.0] };

FrWA.puce({
  id: 'afficheur-7seg-cc', tags: ['basic', 'afficheur', 'eclairage', 'arduino'],
  version: '1.0.0', regles: 1,
  typesBroches: { passif: [...SEG, 'COM', 'COM2'] },
  variables: [],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: '7 SEG CC',
  prefixe: 'AFF',
  categorie: 'Afficheurs',
  description: 'Afficheur 7 segments à cathode commune : chaque segment est une LED entre sa broche et COM. Il faut une résistance par segment.',
  //         1    2    3      4    5     6    7    8       9    10
  broches: ['e', 'd', 'COM', 'c', 'dp', 'b', 'a', 'COM2', 'f', 'g'],
  cotes: { gauche: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'], bas: ['COM', 'COM2'] },
  largeur: 120,
  parametres: [{ cle: 'couleur', nom: 'Couleur', type: 'choix', options: Object.keys(COULEURS), defaut: 'rouge' }],
  modele: {
    elements: [
      ...SEG.map(s => ({ t: 'D', a: s, b: 'COM', N: 2, If: 0.01, Vf: p => (COULEURS[p.couleur] || COULEURS.rouge)[1] })),
      { t: 'R', a: 'COM', b: 'COM2', R: 0.01 },
    ],
  },
  dessin(g, x) {
    const [coul] = COULEURS[x.p.couleur] || COULEURS.rouge;
    const x0 = -x.W / 2 + 34, x1 = x.W / 2 - 14, y0 = -x.H / 2 + 18, y1 = 30, ym = (y0 + y1) / 2, t = 7;
    const pente = 0.12;                                  // chiffre légèrement penché, comme un vrai afficheur
    const P = (px, py) => [px - (py - ym) * pente, py];
    const seg = {
      a: [[x0 + t, y0], [x1 - t, y0]], b: [[x1, y0 + t], [x1, ym - t]], c: [[x1, ym + t], [x1, y1 - t]],
      d: [[x0 + t, y1], [x1 - t, y1]], e: [[x0, ym + t], [x0, y1 - t]], f: [[x0, y0 + t], [x0, ym - t]], g: [[x0 + t, ym], [x1 - t, ym]],
    };
    g.fillStyle = '#080808'; g.fillRect(x0 - 14, y0 - 10, x1 - x0 + 28, y1 - y0 + 20);
    g.lineCap = 'round';
    for (const [nom, [[ax, ay], [bx, by]]] of Object.entries(seg)) {
      const lum = Math.max(0, Math.min(1, x.i(nom) / 0.008));
      const [pa, pb] = [P(ax, ay), P(bx, by)];
      g.lineWidth = 9; g.strokeStyle = '#2a1414'; g.shadowBlur = 0;
      g.beginPath(); g.moveTo(...pa); g.lineTo(...pb); g.stroke();
      if (lum > 0.03) {
        g.globalAlpha = 0.35 + 0.65 * lum; g.strokeStyle = coul; g.shadowColor = coul; g.shadowBlur = 14 * lum;
        g.beginPath(); g.moveTo(...pa); g.lineTo(...pb); g.stroke(); g.globalAlpha = 1; g.shadowBlur = 0;
      }
    }
    const lumDp = Math.max(0, Math.min(1, x.i('dp') / 0.008)), [dx, dy] = P(x1 + 9, y1);
    g.fillStyle = lumDp > 0.03 ? coul : '#2a1414'; g.beginPath(); g.arc(dx, dy, 4, 0, 7); g.fill();
  },
});
})();
