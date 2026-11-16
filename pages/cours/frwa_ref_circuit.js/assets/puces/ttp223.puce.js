// TTP223 — capteur tactile (projet « Manette »).
// Style « logique » + « interaction » : maintenir la puce enfoncée = doigt sur le pavé.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

FrWA.puce({
  id: 'ttp223', tags: ['capteur', 'interrupteur', 'module', 'arduino'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VDD', 'GND'], entree: ['I', 'AHLB', 'TOG'], sortie: ['Q'] },
  variables: [{ cle: 'touche', nom: 'Pavé touché', type: 'bool' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'TTP223',
  categorie: 'Capteurs',
  description: 'Capteur tactile capacitif 1 touche, SOT-23-6. Maintenez la puce appuyée pour toucher le pavé. AHLB = 1 : sortie active à l\'état bas. TOG = 1 : mode bascule.',
  broches: ['Q', 'GND', 'I', 'AHLB', 'VDD', 'TOG'],    // 1 Q, 2 VSS, 3 I (pavé), 4 AHLB, 5 VDD, 6 TOG
  cotes: { gauche: ['I', 'AHLB', 'TOG'], droite: ['Q'], haut: ['VDD'], bas: ['GND'] },
  logique: {
    vdd: 'VDD', vss: 'GND',
    entrees: ['AHLB', 'TOG'],      // non câblées = au niveau bas (comme les rappels internes)
    sorties: ['Q'],
    rSortie: 100, vMin: 2,
    etat: () => ({ touche: false, bascule: false, appuis: 0, vus: 0 }),
    evaluer(e, s) {
      // « appuis » compte les contacts : même un toucher plus court qu'un pas de simulation est pris en compte
      const nouveau = s.appuis !== s.vus; s.vus = s.appuis;
      if (e.TOG && nouveau) s.bascule = !s.bascule;
      const actif = e.TOG ? s.bascule : (s.touche || nouveau);
      return { Q: e.AHLB ? !actif : actif };
    },
  },
  interaction: {
    appui: s => { s.touche = true; s.appuis = (s.appuis || 0) + 1; },
    relache: s => { s.touche = false; },
  },
  affichage: s => (s.touche ? '● touché' : '○ libre'),
});
})();
