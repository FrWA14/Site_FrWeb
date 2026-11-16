// DRV8871 — pont en H pour moteur à courant continu (projet « Coupe de France de robotique »).
// Style « modèle comportemental » : quatre interrupteurs commandés + diodes de roue libre, table de vérité dans pas().
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

FrWA.puce({
  id: 'drv8871', tags: ['moteur', 'module'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VM', 'GND', 'PGND'], entree: ['IN1', 'IN2'], passif: ['ILIM'], sortie: ['OUT1', 'OUT2'] },
  variables: [{ cle: 'mode', nom: 'Mode', type: 'texte' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'DRV8871',
  categorie: 'Pilotes de moteur',
  description: 'Pont en H 3,6 A, 6,5 à 45 V. IN1/IN2 : 1-0 avant, 0-1 arrière, 1-1 frein, 0-0 roue libre. Coupure sous 4,5 V. (ILIM non simulé.)',
  broches: ['GND', 'IN2', 'IN1', 'ILIM', 'VM', 'OUT1', 'PGND', 'OUT2'],   // HSOP-8
  cotes: { gauche: ['IN1', 'IN2', 'ILIM'], droite: ['OUT1', 'OUT2'], haut: ['VM'], bas: ['GND', 'PGND'] },
  modele: {
    elements: [
      { t: 'S', a: 'VM', b: 'OUT1', ferme: false, Ron: 0.3, nom: 'haut1' },
      { t: 'S', a: 'OUT1', b: 'PGND', ferme: false, Ron: 0.3, nom: 'bas1' },
      { t: 'S', a: 'VM', b: 'OUT2', ferme: false, Ron: 0.3, nom: 'haut2' },
      { t: 'S', a: 'OUT2', b: 'PGND', ferme: false, Ron: 0.3, nom: 'bas2' },
      { t: 'D', a: 'OUT1', b: 'VM', Is: 1e-12 }, { t: 'D', a: 'PGND', b: 'OUT1', Is: 1e-12 },   // diodes des MOSFET
      { t: 'D', a: 'OUT2', b: 'VM', Is: 1e-12 }, { t: 'D', a: 'PGND', b: 'OUT2', Is: 1e-12 },
      { t: 'R', a: 'GND', b: 'PGND', R: 0.01 },
      { t: 'R', a: 'ILIM', b: 'GND', R: 10e6 },       // ILIM : limitation non simulée, broche presque sans charge
      { t: 'R', a: 'VM', b: 'GND', R: 3000 },
      { t: 'R', a: 'IN1', b: 'GND', R: 100e3 },       // rappels internes vers le bas
      { t: 'R', a: 'IN2', b: 'GND', R: 100e3 },
    ],
    etat: () => ({ mode: 'roue libre' }),
    pas(c) {
      const gnd = c.v('GND'), vm = c.v('VM') - gnd;
      const in1 = c.v('IN1') - gnd > 1.5, in2 = c.v('IN2') - gnd > 1.5;
      let h1 = false, b1 = false, h2 = false, b2 = false, mode = 'roue libre';
      if (vm < 4.5) mode = 'sous-tension';
      else if (in1 && !in2) { h1 = true; b2 = true; mode = 'avant'; }
      else if (!in1 && in2) { h2 = true; b1 = true; mode = 'arrière'; }
      else if (in1 && in2) { b1 = true; b2 = true; mode = 'frein'; }
      c.s.mode = mode;
      c.regler('haut1', h1); c.regler('bas1', b1); c.regler('haut2', h2); c.regler('bas2', b2);
    },
  },
  affichage: s => s.mode,
});
})();
