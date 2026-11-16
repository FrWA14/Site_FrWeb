// CD4060 — compteur binaire 14 étages + oscillateur (datasheet TI SCHS049C).
// L'oscillateur à quartz (32,768 kHz) ne peut pas être simulé au même pas de temps que l'affichage (il faudrait
// des pas de ~1 µs) : en mode « quartz », la puce compte directement fosc × dt périodes à chaque pas.
// En mode « entrée φI », elle compte les fronts DESCENDANTS appliqués sur φI (broche 11), comme la vraie puce.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const SORTIES = ['Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q12', 'Q13', 'Q14'];
const RANG = { Q4: 4, Q5: 5, Q6: 6, Q7: 7, Q8: 8, Q9: 9, Q10: 10, Q12: 12, Q13: 13, Q14: 14 };

FrWA.puce({
  id: 'cd4060', tags: ['serie4000', 'logique', 'generateur', 'temporisation'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VDD', 'VSS'], entree: ['PHI', 'RST'], sortie: SORTIES, trois_etats: ['PHO', 'PHOB'] },
  variables: [{ cle: 'n', nom: 'Compte', unite: '' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'CD4060',
  categorie: 'Logique CMOS 4000',
  description: 'Compteur binaire 14 étages à oscillateur intégré. Q14 = fosc / 16384 : avec un quartz de 32,768 kHz, Q14 donne exactement 2 Hz. RST haut : compteur à zéro et oscillateur arrêté.',
  //          1      2      3      4     5     6     7     8      9                          10                          11                         12     13    14    15     16
  broches: ['Q12', 'Q13', 'Q14', 'Q6', 'Q5', 'Q7', 'Q4', 'VSS', { nom: 'PHO', etiquette: 'φO' }, { nom: 'PHOB', etiquette: '/φO' }, { nom: 'PHI', etiquette: 'φI' }, 'RST', 'Q9', 'Q8', 'Q10', 'VDD'],
  cotes: { haut: ['VDD'], gauche: ['PHI', 'PHO', 'PHOB', null, 'RST'], droite: SORTIES, bas: ['VSS'] },
  parametres: [
    { cle: 'source', nom: 'Horloge', type: 'choix', options: ['quartz', 'entrée φI'], defaut: 'quartz' },
    { cle: 'fosc', nom: 'Fréquence du quartz', unite: 'Hz', defaut: 32768, min: 1, max: 1e7, echelle: 'log' },
  ],
  principal: 'fosc',
  logique: {
    vdd: 'VDD', vss: 'VSS',
    entrees: ['PHI', 'RST'],
    sorties: [...SORTIES, 'PHO', 'PHOB'],
    rSortie: 500, vMin: 3,
    etat: () => ({ n: 0, reste: 0 }),
    evaluer(e, s, p, c) {
      if (e.RST) { s.n = 0; s.reste = 0; }
      else if (p.source === 'quartz') {
        s.reste += p.fosc * c.dt;
        const k = Math.floor(s.reste); s.reste -= k; s.n = (s.n + k) % 16384;
      } else if (e.descend.PHI) s.n = (s.n + 1) % 16384;
      const o = { PHO: null, PHOB: null };               // sorties d'oscillateur : non modélisées (haute impédance)
      for (const q of SORTIES) o[q] = ((s.n >> (RANG[q] - 1)) & 1) === 1;
      return o;
    },
  },
  affichage: (s, p) => (p.source === 'quartz' ? FrWA.formater(p.fosc, 'Hz') : 'φI externe'),
});
})();
