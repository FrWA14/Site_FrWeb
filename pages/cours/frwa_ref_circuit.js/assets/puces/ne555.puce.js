// NE555 — temporisateur (projets KiCad « Ne555 » et « NE555 CD4017 »).
// Style « modèle comportemental » : un vrai réseau analogique (diviseur 3 × 5 kΩ) + une logique écrite dans pas().
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

FrWA.puce({
  id: 'ne555', tags: ['basic', 'temporisation', 'generateur'],
  version: '1.0.0', regles: 1,
  typesBroches: { alim_entree: ['VCC', 'GND'], entree: ['TRIG', 'THR', 'RESET'], passif: ['CTRL'], sortie: ['OUT'], drain_ouvert: ['DIS'] },
  variables: [{ cle: 'q', nom: 'Bascule interne (sortie)', type: 'bool' }],
  modele3d: null,   // pas encore de fichier STEP (R9)
  nom: 'NE555',
  categorie: 'Temporisation',
  description: 'Temporisateur astable / monostable. Diviseur interne 3 × 5 kΩ, deux comparateurs (1/3 et 2/3 de VCC), bascule RS, transistor de décharge.',
  broches: ['GND', 'TRIG', 'OUT', { nom: 'RESET', etiquette: 'RST' }, 'CTRL', 'THR', 'DIS', 'VCC'],   // numéros 1 à 8
  cotes: { haut: ['VCC', 'RESET'], gauche: ['DIS', 'THR', 'TRIG', 'CTRL'], droite: ['OUT'], bas: ['GND'] },
  modele: {
    elements: [
      { t: 'R', a: 'VCC', b: 'CTRL', R: 5000 },
      { t: 'R', a: 'CTRL', b: 'tiers', R: 5000 },          // « tiers » : nœud interne (1/3 VCC)
      { t: 'R', a: 'tiers', b: 'GND', R: 5000 },
      { t: 'R', a: 'VCC', b: 'GND', R: 3000 },             // courant de repos ≈ 3 mA sous 9 V
      { t: 'O', a: 'OUT', ref: 'GND', V: 0, R: 10, nom: 'sortie' },
      { t: 'S', a: 'DIS', b: 'GND', ferme: true, Ron: 10, nom: 'decharge' },
    ],
    etat: () => ({ q: false }),
    pas(c) {
      const gnd = c.v('GND'), vcc = c.v('VCC') - gnd;
      if (vcc < 3 || c.v('RESET') - gnd < 0.7) c.s.q = false;
      else if (c.v('TRIG') < c.v('tiers')) c.s.q = true;       // le déclenchement est prioritaire
      else if (c.v('THR') > c.v('CTRL')) c.s.q = false;
      c.regler('sortie', c.s.q ? Math.max(0, vcc - 1.7) : 0);
      c.regler('decharge', !c.s.q);
    },
  },
  affichage: s => (s.q ? 'sortie HAUTE' : 'sortie basse'),
});
})();
