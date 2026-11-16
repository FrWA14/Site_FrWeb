// MODELE.puce.js — point de départ pour écrire une nouvelle puce, conforme aux RÈGLES v1 (docs/REGLES_COMPOSANTS.md).
// Copier ce fichier, le renommer (ex. ma_puce.puce.js), le remplir, puis :
//   - soit l'importer depuis la page (bouton ＋ → « Importer une puce ») : il est gardé dans le navigateur ;
//   - soit le poser dans static/puces/ et ajouter son nom à la liste de static/puces/catalogue.js.
// Une puce non conforme est REFUSÉE au chargement : le message cite la règle (R3, R4…) à corriger.
// Garder l'enveloppe (() => { … })(); : les constantes du fichier restent privées (pas de conflit avec une autre puce).
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

FrWA.puce({
  id: 'ma-puce',                 // R3 : identifiant unique (minuscules, chiffres, - _ .)
  nom: 'MA-PUCE',                // nom affiché dans la puce et dans la bibliothèque
  categorie: 'Mes puces',        // rubrique de la bibliothèque (« Puces · Mes puces »)
  description: 'Une phrase sur ce que fait la puce.',
  version: '1.0.0',              // R3 : version du composant (x.y.z)
  regles: 1,                     // R1 : version des règles respectées

  // R4 : broches dans l'ordre des numéros du boîtier (1, 2, 3…). Une chaîne = nom ; un objet permet une étiquette différente.
  broches: ['VCC', 'GND', 'IN', 'OUT'],
  // R4 : type électrique de CHAQUE broche (une fois) : entree, sortie, bidir, trois_etats, drain_ouvert, passif,
  // alim_entree, alim_sortie, nc. Une broche non « entree » / « nc » doit être reliée au modèle.
  typesBroches: { alim_entree: ['VCC', 'GND'], entree: ['IN'], sortie: ['OUT'] },

  // Facultatif : où dessiner chaque broche. Sans « cotes », le boîtier est un DIP (1..n/2 à gauche, le reste à droite).
  cotes: { haut: ['VCC'], gauche: ['IN'], droite: ['OUT'], bas: ['GND'] },

  // R5 : paramètres réglables à la molette ou dans ⚙ (lisibles dans pas() via c.p.<cle>, ou dans un élément via '$cle').
  // Unité obligatoire, prise dans la liste R2 ('' si sans unité). Un angle se RÈGLE en ° mais se CALCULE en rad.
  parametres: [
    { cle: 'gain', nom: 'Gain', unite: '', defaut: 2, min: 0.1, max: 100, echelle: 'log' },
  ],

  // R7 : variables PUBLIÉES (lues par l'oscilloscope, les infos et les extensions 3D), en unités SI.
  // Chacune doit exister dans l'état initial (etat()).
  variables: [
    { cle: 'vsortie', nom: 'Tension de sortie demandée', unite: 'V' },
  ],

  // R9 : modèle 3D (fichier STEP, en mm comme KiCad), ou null tant qu'il n'existe pas. La 3D n'est jamais calculée
  // ici : elle est affichée par une extension de la fenêtre 3D (static/extensions/3d/).
  modele3d: null,

  // R6 : partie analogique : un petit circuit interne. Les noms qui ne sont pas des broches deviennent des nœuds internes.
  // Types : R C L V A I S O D Q E F G OA K (voir docs/FORMAT_PUCE.md).
  modele: {
    elements: [
      { t: 'R', a: 'IN', b: 'GND', R: 100e3 },                       // impédance d'entrée
      { t: 'O', a: 'OUT', ref: 'GND', V: 0, R: 10, nom: 'sortie' },  // sortie pilotée par pas()
      { t: 'R', a: 'VCC', b: 'GND', R: 10e3 },                       // consommation
    ],
    etat: () => ({ vsortie: 0 }),   // état interne (contient les variables publiées), conservé d'un pas à l'autre
    // Appelé une fois par pas de temps, AVANT la résolution : lit les tensions du pas précédent, règle les éléments nommés.
    // R8 : n'utiliser que c (tensions, courants, monde, c.aleatoire()) : pas de Math.random, Date, document, réseau…
    pas(c) {
      const gnd = c.v('GND'), vcc = c.v('VCC') - gnd;
      c.s.vsortie = Math.max(0, Math.min(vcc, c.p.gain * (c.v('IN') - gnd)));   // ampli saturé entre 0 et VCC
      c.regler('sortie', c.s.vsortie);
    },
  },

  // Texte court affiché sous le nom de la puce (facultatif).
  affichage: (s, p) => '×' + p.gain,
});
})();
