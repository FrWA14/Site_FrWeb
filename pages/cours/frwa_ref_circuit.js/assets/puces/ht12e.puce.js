// HT12E — codeur 2^12 (Holtek) : 8 bits d'adresse + 4 bits de données, sortie série DOUT.
// Fiche Holtek « 2^12 Series of Encoders » : oscillateur 3 kHz avec ROSC = 1,1 MΩ sous 5 V ; /TE bas → cycles de 4 mots ;
// un mot = pilote (12 bits à 0) + synchro (1/3 de bit à 1) + 12 bits (A0…A7, AD8…AD11) ; 1 bit = 3 périodes d'horloge
// (figure 5 : « 1 » = impulsion haute courte, « 0 » = impulsion haute longue) ; /TE relâché : le cycle en cours se termine.
// La fréquence suit la résistance réellement câblée entre OSC1 et OSC2 (mesurée par une petite source interne).
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const ADR = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'], DAT = ['AD8', 'AD9', 'AD10', 'AD11'];

FrWA.puce({
  id: 'ht12e', tags: ['radio', 'logique'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VDD', 'VSS'], entree: [...ADR, ...DAT, 'TE'], passif: ['OSC1', 'OSC2'], sortie: ['DOUT'] },
  variables: [{ cle: 'actif', nom: 'Émission en cours', type: 'bool' }, { cle: 'fosc', nom: 'Fréquence d\'oscillateur', unite: 'Hz' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'HT12E',
  categorie: 'Télécommande',
  description: 'Codeur de télécommande Holtek : 8 bits d\'adresse + 4 bits de données envoyés en série sur DOUT tant que /TE est bas (par cycles de 4 mots). Oscillateur réglé par ROSC (1,1 MΩ → 3 kHz sous 5 V).',
  //          1…8     9      10…13    14                               15      16      17      18
  broches: [...ADR, 'VSS', ...DAT, { nom: 'TE', etiquette: '/TE' }, 'OSC2', 'OSC1', 'DOUT', 'VDD'],
  cotes: { haut: ['VDD'], bas: ['VSS'], gauche: [...ADR, null, ...DAT, null, 'TE'], droite: ['DOUT', null, null, 'OSC1', 'OSC2'] },
  parametres: [{ cle: 'fref', nom: 'Fréquence pour ROSC = 1,1 MΩ', unite: 'Hz', defaut: 3000, min: 100, max: 1e5, echelle: 'log' }],
  modele: {
    elements: [
      { t: 'V', a: 'OSC1', b: 'OSC2', V: 0.1, nom: 'mesosc' },        // mesure de ROSC : I = 0,1 V / R
      { t: 'R', a: 'VDD', b: 'TE', R: 1e5 },                           // rappel interne de /TE vers le haut
      { t: 'O', a: 'DOUT', ref: 'VSS', V: 0, R: 200, nom: 'dout' },
      { t: 'R', a: 'VDD', b: 'VSS', R: 5e5 },
    ],
    etat: () => ({ ph: 0, idx: 0, mots: 0, seq: null, actif: false, fosc: 0, code: '' }),
    pas(c) {
      const s = c.s, vss = c.v('VSS'), vdd = c.v('VDD') - vss;
      if (vdd < 2.4) { s.actif = false; c.regler('dout', 0); return; }
      const haut = n => c.v(n) - vss > vdd / 2;
      const i = Math.abs(c.i('mesosc')), rosc = i > 1e-10 ? 0.1 / i : Infinity;
      s.fosc = Number.isFinite(rosc) ? c.p.fref * 1.1e6 / rosc : 0;
      const te = !haut('TE');
      const mot = () => {
        const bits = [...ADR, ...DAT].map(n => (haut(n) ? 1 : 0));
        s.code = bits.slice(0, 8).join('') + ' ' + bits.slice(8).join('');
        const q = new Array(36).fill(0); q.push(1);                    // pilote 12 bits + synchro 1/3 de bit
        for (const b of bits) q.push(...(b ? [0, 0, 1] : [0, 1, 1]));  // « 1 » : 1/3 haut, « 0 » : 2/3 haut
        return q;
      };
      if (!s.actif && te && s.fosc > 0) { s.actif = true; s.mots = 0; s.idx = 0; s.ph = 0; s.seq = mot(); }
      if (s.actif) {
        s.ph += s.fosc * c.dt;
        while (s.ph >= 1) {
          s.ph -= 1; s.idx++;
          if (s.idx >= s.seq.length) {
            s.mots++; s.idx = 0;
            if (s.mots % 4 === 0 && !te) { s.actif = false; break; }   // fin du cycle de 4 mots
            s.seq = mot();
          }
        }
      }
      c.regler('dout', s.actif && s.seq[s.idx] ? vdd : 0);
    },
  },
  affichage: s => (s.actif ? 'émet ' + s.code : s.fosc ? FrWA.formater(s.fosc, 'Hz') + ' · repos' : 'pas de ROSC'),
});
})();
