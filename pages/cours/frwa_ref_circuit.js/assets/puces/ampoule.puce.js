// Ampoule à incandescence (petite lampe témoin) : un filament résistif, R = Unom² / Pnom (valeur à chaud ; le filament
// froid, plus résistant à l'allumage, n'est pas modélisé). Elle s'éclaire en proportion de la puissance reçue :
// pleine lueur à Pnom. Exemple : 9 V 0,5 W → 162 Ω, 56 mA (à commander par un transistor, pas par une sortie logique).
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

FrWA.puce({
  id: 'ampoule', tags: ['eclairage', 'basic'],
  version: '1.0.0', regles: 1,
  typesBroches: { passif: ['A', 'B'] },
  variables: [],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'AMPOULE',
  prefixe: 'LA',
  categorie: 'Éclairage',
  description: 'Ampoule à incandescence (lampe témoin) : filament de résistance Unom² / Pnom, lueur proportionnelle à la puissance reçue (pleine à Pnom). 9 V 0,5 W par défaut : 162 Ω, 56 mA.',
  broches: ['A', 'B'],
  cotes: { haut: [null, 'A'], bas: [null, 'B'] },     // 2e case : broches dans l'axe de l'ampoule (x = 0)
  parametres: [
    { cle: 'vNom', nom: 'Tension nominale', unite: 'V', defaut: 9, min: 1, max: 250, echelle: 'lin', pas: 0.5 },
    { cle: 'pNom', nom: 'Puissance nominale', unite: 'W', defaut: 0.5, min: 0.01, max: 100, echelle: 'log' },
  ],
  principal: 'pNom',
  modele: { elements: [{ t: 'R', a: 'A', b: 'B', R: p => (p.vNom * p.vNom) / p.pNom }] },
  dessin(g, x) {
    const R = (x.p.vNom * x.p.vNom) / x.p.pNom, i = x.i('A'), lum = Math.max(0, Math.min(1, (i * i * R) / x.p.pNom));
    // lueur
    if (lum > 0.02) {
      g.save(); g.globalAlpha = 0.25 + 0.75 * lum; g.fillStyle = '#ffd84a'; g.shadowColor = '#ffcc33'; g.shadowBlur = 28 * lum;
      g.beginPath(); g.arc(0, -4, 17, 0, 2 * Math.PI); g.fill(); g.restore();
    }
    // verre, culot, filament
    g.strokeStyle = '#d8dfdd'; g.lineWidth = 2;
    g.beginPath(); g.arc(0, -4, 17, 0, 2 * Math.PI); g.stroke();
    g.fillStyle = '#8d969a'; g.fillRect(-8, 13, 16, 7);
    g.strokeStyle = lum > 0.02 ? '#fff6c8' : '#9aa3a8'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-6, 13); g.lineTo(-6, -2); g.lineTo(-3, -9); g.lineTo(0, -2); g.lineTo(3, -9); g.lineTo(6, -2); g.lineTo(6, 13); g.stroke();
  },
  affichage: (s, p) => FrWA.formater(p.vNom, 'V') + ' ' + FrWA.formater(p.pNom, 'W'),
});
})();
