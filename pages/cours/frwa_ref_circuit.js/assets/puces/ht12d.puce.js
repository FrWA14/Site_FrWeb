// HT12D — décodeur 2^12 (Holtek), sorties mémorisées (latch) + VT (transmission valide).
// Fiche Holtek « 2^12 Series of Decoders » : oscillateur 150 kHz avec ROSC = 51 kΩ sous 5 V (≈ 50 × celui du codeur) ;
// l'adresse reçue doit correspondre aux broches A0…A7 et le même code doit arriver 3 fois de suite (organigramme p. 4)
// avant que D8…D11 soient mises à jour et que VT passe à 1. Une erreur ou une adresse fausse remet VT à 0.
// Le décodage se fait ici sur les largeurs d'impulsions de DIN, mesurées avec l'horloge du décodeur.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const ADR = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'], SORT = ['D8', 'D9', 'D10', 'D11'];

FrWA.puce({
  id: 'ht12d', tags: ['radio', 'logique'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VDD', 'VSS'], entree: [...ADR, 'DIN'], passif: ['OSC1', 'OSC2'], sortie: [...SORT, 'VT'] },
  variables: [{ cle: 'recus', nom: 'Mots valides reçus', unite: '' }, { cle: 'erreurs', nom: 'Mots refusés', unite: '' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'HT12D',
  categorie: 'Télécommande',
  description: 'Décodeur de télécommande Holtek : compare l\'adresse reçue sur DIN à A0…A7, exige 3 mots identiques, puis mémorise les 4 données sur D8…D11 et met VT à 1. ROSC 51 kΩ → 150 kHz sous 5 V.',
  //          1…8     9      10…13      14     15      16      17    18
  broches: [...ADR, 'VSS', ...SORT, 'DIN', 'OSC2', 'OSC1', 'VT', 'VDD'],
  cotes: { haut: ['VDD'], bas: ['VSS'], gauche: [...ADR, null, 'DIN', null, 'OSC1', 'OSC2'], droite: [...SORT, null, 'VT'] },
  parametres: [{ cle: 'fref', nom: 'Fréquence pour ROSC = 51 kΩ', unite: 'Hz', defaut: 150e3, min: 1e3, max: 1e7, echelle: 'log' }],
  logique: {
    vdd: 'VDD', vss: 'VSS', entrees: [], sorties: [...SORT, 'VT'], rSortie: 150, vMin: 2.4,
    etat: () => ({ niv: false, duree: 0, phase: 'attente', bits: [], compte: 0, prec: '', data: [1, 1, 1, 1], vt: false, depuisValide: 1, recus: 0, erreurs: 0, dernier: '' }),
    evaluer(e, s, p, c) {
      const vss = c.v('VSS'), vdd = c.v('VDD') - vss;
      const i = Math.abs(c.i('mesosc')), rosc = i > 1e-10 ? 0.1 / i : Infinity;
      const fdec = Number.isFinite(rosc) ? p.fref * 51e3 / rosc : 0;
      const T = fdec > 0 ? 50 / fdec : Infinity;                      // période d'horloge du codeur attendue
      const din = c.v('DIN') - vss > vdd / 2;
      s.duree += c.dt; s.depuisValide += c.dt;
      const erreur = () => { if (s.phase === 'bits') s.erreurs++; s.phase = 'attente'; s.compte = 0; s.vt = false; };
      if (din !== s.niv) {
        const L = s.duree;
        if (din) {                                                     // front montant : fin d'un niveau bas de durée L
          if (L >= 20 * T) { s.phase = 'synchro'; s.bits = []; }       // fin du pilote → ce front est la synchro
          else if (s.phase === 'bits' && L > 2.6 * T) erreur();
        } else {                                                       // front descendant : impulsion haute de durée L
          if (s.phase === 'synchro') s.phase = L > 0.4 * T && L < 1.6 * T ? 'bits' : 'attente';
          else if (s.phase === 'bits') {
            if (L > 0.4 * T && L < 1.5 * T) s.bits.push(1); else if (L >= 1.5 * T && L < 2.6 * T) s.bits.push(0); else erreur();
            if (s.phase === 'bits' && s.bits.length === 12) {
              s.phase = 'attente'; s.recus++;
              const adr = s.bits.slice(0, 8), dat = s.bits.slice(8);
              const local = ADR.map(n => (c.v(n) - vss > vdd / 2 ? 1 : 0));
              s.dernier = adr.join('') + ' ' + dat.join('');
              if (adr.join('') !== local.join('')) { s.compte = 0; s.vt = false; }
              else {
                const cle = dat.join('');
                s.compte = cle === s.prec ? s.compte + 1 : 1; s.prec = cle;
                if (s.compte >= 3) { s.data = dat; s.vt = true; s.depuisValide = 0; }
              }
            }
          }
        }
        s.niv = din; s.duree = 0;
      }
      if (s.depuisValide > 3 * 76 * T) s.vt = false;                  // plus de mot valide depuis ~3 mots
      return { D8: !!s.data[0], D9: !!s.data[1], D10: !!s.data[2], D11: !!s.data[3], VT: s.vt };
    },
  },
  modele: {
    elements: [
      { t: 'V', a: 'OSC1', b: 'OSC2', V: 0.1, nom: 'mesosc' },
      { t: 'R', a: 'DIN', b: 'VSS', R: 1e6 },
      { t: 'R', a: 'VDD', b: 'VSS', R: 5e5 },
    ],
  },
  affichage: s => (s.vt ? 'VT · ' + s.data.join('') : s.recus ? 'reçu ' + s.dernier : 'attente'),
});
})();
