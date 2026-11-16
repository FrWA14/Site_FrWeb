// Commutation : inverseur, commutateurs rotatifs et DIP (nombre de positions au choix : famille de variantes,
// réglée dans ⚙), interrupteurs temporisés, relais (1 à 4 contacts inverseurs), relais temporisé, fin de course.
// Contacts : interrupteurs idéaux du moteur (R fermée 50 mΩ, ouverte 1 GΩ).
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const BASE = { prefixe: 'SW', categorie: 'Interrupteurs', version: '1.0.0', regles: 1, modele3d: null };

/* ---------- Inverseur (1 circuit, 2 positions) ---------- */
FrWA.puce({
  ...BASE, id: 'inverseur', tags: ['interrupteur', 'basic'], nom: 'INVERSEUR',
  description: 'Interrupteur inverseur (unipolaire bidirectionnel, SPDT) : le commun C est relié à 1 ou à 2. Toucher pour basculer.',
  broches: ['C', '1', '2'], typesBroches: { passif: ['C', '1', '2'] }, cotes: { gauche: ['C'], droite: ['1', '2'] },
  parametres: [{ cle: 'position', nom: 'Position', type: 'choix', options: ['1', '2'], defaut: '1' }],
  variables: [], modele: {
    elements: [{ t: 'S', a: 'C', b: '1', nom: 'k1' }, { t: 'S', a: 'C', b: '2', nom: 'k2' }],
    pas(c) { c.regler('k1', c.p.position === '1'); c.regler('k2', c.p.position === '2'); },
  },
  interaction: { clic: (s, p) => { p.position = p.position === '1' ? '2' : '1'; } },
  affichage: (s, p) => 'C → ' + p.position,
});

/* ---------- Commutateur rotatif : 1 circuit, N positions (famille) ---------- */
for (let N = 2; N <= 12; N++) {
  const pos = Array.from({ length: N }, (_, i) => String(i + 1));
  FrWA.puce({
    ...BASE, id: 'rotatif-' + N, tags: ['interrupteur', 'basic'], nom: `ROTATIF ${N} POS.`,
    famille: { id: 'commutateur-rotatif', nom: 'Positions', valeur: String(N) },
    description: `Commutateur rotatif 1 circuit, ${N} positions : le commun C est relié à la sortie choisie (molette, ⚙ ou toucher pour avancer). Nombre de positions (2 à 12) : ⚙ Réglages.`,
    broches: ['C', ...pos], typesBroches: { passif: ['C', ...pos] }, cotes: { gauche: ['C'], droite: pos },
    parametres: [{ cle: 'position', nom: 'Position', unite: '', defaut: 1, min: 1, max: N, pas: 1 }], principal: 'position',
    variables: [{ cle: 'sortie', nom: 'Sortie reliée', unite: '' }],
    modele: {
      elements: pos.map(k => ({ t: 'S', a: 'C', b: k, nom: 'k' + k })),
      etat: () => ({ sortie: 1 }),
      pas(c) { c.s.sortie = Math.max(1, Math.min(N, Math.round(c.p.position))); for (const k of pos) c.regler('k' + k, Number(k) === c.s.sortie); },
    },
    interaction: { clic: (s, p) => { p.position = (Math.round(p.position) % N) + 1; } },
    affichage: (s, p) => 'C → ' + Math.round(p.position),
  });
}

/* ---------- Interrupteurs DIP : N interrupteurs indépendants (famille) ---------- */
for (const N of [1, 2, 3, 4, 6, 8]) {
  const k = Array.from({ length: N }, (_, i) => i + 1);
  FrWA.puce({
    ...BASE, id: 'dip-' + N, tags: ['interrupteur'], nom: `DIP ×${N}`,
    famille: { id: 'interrupteurs-dip', nom: 'Interrupteurs', valeur: String(N) },
    description: `${N} interrupteur(s) indépendant(s) en boîtier DIP (Ak — Bk). ⚙ : un réglage par interrupteur ; toucher : compte en binaire. Nombre (1 à 8) : ⚙ Réglages.`,
    broches: [...k.map(i => 'A' + i), ...k.map(i => 'B' + (N + 1 - i))],
    typesBroches: { passif: [...k.map(i => 'A' + i), ...k.map(i => 'B' + i)] },
    cotes: { gauche: k.map(i => 'A' + i), droite: k.map(i => 'B' + i) },
    parametres: k.map(i => ({ cle: 's' + i, nom: 'Interrupteur ' + i, type: 'bool', defaut: false })),
    variables: [{ cle: 'code', nom: 'Code (bit 0 = interrupteur 1)', unite: '' }],
    modele: {
      elements: k.map(i => ({ t: 'S', a: 'A' + i, b: 'B' + i, nom: 'k' + i })),
      etat: () => ({ code: 0 }),
      pas(c) { let v = 0; for (const i of k) { c.regler('k' + i, !!c.p['s' + i]); if (c.p['s' + i]) v |= 1 << (i - 1); } c.s.code = v; },
    },
    interaction: { clic: (s, p) => { let v = 0; for (const i of k) if (p['s' + i]) v |= 1 << (i - 1); v = (v + 1) % (1 << N); for (const i of k) p['s' + i] = ((v >> (i - 1)) & 1) === 1; } },
    affichage: (s, p) => k.map(i => (p['s' + i] ? '▮' : '▯')).join(''),
  });
}

/* ---------- Interrupteur temporisé (commande manuelle) ---------- */
const MODES = ['retard à la fermeture', 'retard à l\'ouverture', 'impulsion'];
// commande + temps → état du contact ; t0 = instant du dernier changement de commande
function contactTemporise(mode, commande, t, t0, retard) {
  if (mode === MODES[0]) return commande && t - t0 >= retard;
  if (mode === MODES[1]) return commande || t - t0 < retard;
  return t - t0 < retard;                         // impulsion : fermé pendant T après chaque commande
}
FrWA.puce({
  ...BASE, id: 'interrupteur-temporise', tags: ['interrupteur', 'temporisation', 'basic'], nom: 'INTER. TEMPORISÉ',
  description: 'Interrupteur à retard : « retard à la fermeture » (le contact se ferme T après la commande), « retard à l\'ouverture » (il reste fermé T après l\'arrêt, comme une minuterie d\'escalier), « impulsion » (chaque toucher ferme le contact pendant T). Toucher = commande.',
  broches: ['A', 'B'], typesBroches: { passif: ['A', 'B'] }, cotes: { gauche: ['A'], droite: ['B'] },
  parametres: [
    { cle: 'mode', nom: 'Mode', type: 'choix', options: MODES, defaut: MODES[0] },
    { cle: 'retard', nom: 'Temporisation', unite: 's', defaut: 1, min: 1e-4, max: 3600, echelle: 'log' },
  ], principal: 'retard',
  variables: [{ cle: 'commande', nom: 'Commande', type: 'bool' }, { cle: 'contact', nom: 'Contact fermé', type: 'bool' }],
  modele: {
    elements: [{ t: 'S', a: 'A', b: 'B', nom: 'k' }],
    etat: () => ({ commande: false, contact: false, t0: -Infinity, demande: null }),
    pas(c) {
      const s = c.s;
      if (s.demande !== null) { s.commande = c.p.mode === MODES[2] ? true : s.demande; s.t0 = c.t; s.demande = null; }
      s.contact = contactTemporise(c.p.mode, s.commande, c.t, s.t0, c.p.retard);
      c.regler('k', s.contact);
    },
  },
  interaction: { clic: s => { s.demande = !s.commande; } },
  affichage: (s, p) => `${s.contact ? 'fermé' : 'ouvert'} · ${p.retard} s`,
});

/* ---------- Relais électromécanique : bobine + 1 à 4 contacts inverseurs (famille) ---------- */
const PARAM_RELAIS = [
  { cle: 'vNom', nom: 'Tension nominale de la bobine', unite: 'V', defaut: 5, min: 1, max: 230 },
  { cle: 'rBobine', nom: 'Résistance de la bobine', unite: 'Ω', defaut: 70, min: 1, max: 1e5, echelle: 'log' },
  { cle: 'collage', nom: 'Seuil de collage (% de Vnom)', unite: '%', defaut: 75, min: 10, max: 100 },
  { cle: 'decollage', nom: 'Seuil de décollage (% de Vnom)', unite: '%', defaut: 10, min: 1, max: 90 },
  { cle: 'tempsCollage', nom: 'Temps de collage / décollage', unite: 's', defaut: 5e-3, min: 0, max: 1 },
];
function relais(o) {
  // o : { id, nom, description, poles, tags, famille, temporise }
  const P = Array.from({ length: o.poles }, (_, i) => i + 1);
  const contacts = P.flatMap(p => o.poles === 1 ? ['COM', 'NO', 'NC'] : ['COM' + p, 'NO' + p, 'NC' + p]);
  const nm = (x, p) => (o.poles === 1 ? x : x + p);
  FrWA.puce({
    ...BASE, prefixe: 'K', id: o.id, tags: ['relais', 'interrupteur', ...(o.tags || [])], nom: o.nom,
    categorie: 'Relais', ...(o.famille ? { famille: o.famille } : {}), description: o.description,
    broches: ['B1', 'B2', ...contacts], typesBroches: { passif: ['B1', 'B2', ...contacts] },
    cotes: { gauche: ['B1', null, 'B2'], droite: contacts },
    parametres: [...PARAM_RELAIS, ...(o.temporise ? [
      { cle: 'mode', nom: 'Mode', type: 'choix', options: MODES.slice(0, 2), defaut: MODES[0] },
      { cle: 'retard', nom: 'Temporisation', unite: 's', defaut: 1, min: 1e-3, max: 3600, echelle: 'log' },
    ] : [])],
    principal: o.temporise ? 'retard' : 'vNom',
    variables: [{ cle: 'colle', nom: 'Bobine excitée', type: 'bool' }, { cle: 'contact', nom: 'Contacts en travail (NO fermés)', type: 'bool' }, { cle: 'courant', nom: 'Courant de bobine', unite: 'A' }],
    modele: {
      elements: [
        { t: 'R', a: 'B1', b: 'B2', R: '$rBobine', nom: 'bobine' },
        ...P.flatMap(p => [{ t: 'S', a: nm('COM', p), b: nm('NO', p), nom: 'no' + p }, { t: 'S', a: nm('COM', p), b: nm('NC', p), ferme: true, nom: 'nc' + p }]),
      ],
      etat: () => ({ colle: false, contact: false, courant: 0, tBascule: -Infinity, t0: -Infinity }),
      pas(c) {
        const s = c.s, p = c.p, v = Math.abs(c.v('B1') - c.v('B2'));
        s.courant = v / p.rBobine;
        const colle = s.colle ? v > p.decollage / 100 * p.vNom : v > p.collage / 100 * p.vNom;
        if (colle !== s.colle) { s.colle = colle; s.t0 = c.t; }
        // armature : suit la bobine après le temps de collage (et la temporisation éventuelle)
        const retard = p.tempsCollage + (o.temporise ? (p.mode === MODES[0] ? (colle ? p.retard : 0) : (colle ? 0 : p.retard)) : 0);
        if (s.contact !== colle && c.t - s.t0 >= retard) s.contact = colle;
        for (const q of P) { c.regler('no' + q, s.contact); c.regler('nc' + q, !s.contact); }
      },
    },
    affichage: s => (s.contact ? 'travail' : 'repos'),
  });
}
for (const n of [1, 2, 3, 4]) {
  relais({
    id: 'relais-' + n + 'rt', nom: `RELAIS ${n}RT`, poles: n, tags: n === 1 ? ['basic'] : [],
    famille: { id: 'relais', nom: 'Contacts inverseurs', valeur: String(n) },
    description: `Relais électromécanique, ${n} contact(s) inverseur(s) (COM, travail NO, repos NC). La bobine (B1-B2) colle au-dessus du seuil, décolle sous un seuil plus bas (hystérésis), avec un temps de collage. Ajouter une diode de roue libre sur la bobine. Nombre de contacts (1 à 4) : ⚙ Réglages.`,
  });
}
relais({
  id: 'relais-temporise', nom: 'RELAIS TEMPO.', poles: 1, temporise: true, tags: ['temporisation'],
  description: 'Relais temporisé : retard à l\'enclenchement (les contacts basculent T après l\'excitation de la bobine) ou au déclenchement (ils restent en travail T après la coupure).',
});

/* ---------- Fin de course commandée par un axe mécanique ---------- */
FrWA.puce({
  ...BASE, id: 'fin-de-course', tags: ['interrupteur', 'moteur', 'capteur'], nom: 'FIN DE COURSE',
  description: 'Contact inverseur actionné par un axe mécanique (moteur, servo, monture) : en travail quand l\'angle de l\'axe dépasse le seuil (ou passe sous le seuil, selon le sens).',
  broches: ['C', 'NO', 'NC'], typesBroches: { passif: ['C', 'NO', 'NC'] }, cotes: { gauche: ['C'], droite: ['NO', 'NC'] },
  parametres: [
    { cle: 'axe', nom: 'Axe surveillé (nom)', type: 'texte', defaut: 'AXE1' },
    { cle: 'seuil', nom: 'Angle de déclenchement', unite: '°', defaut: 90, min: -36000, max: 36000 },
    { cle: 'sens', nom: 'Actionné quand l\'angle est', type: 'choix', options: ['au-dessus', 'en dessous'], defaut: 'au-dessus' },
  ],
  mecanique: { lit: ['$axe'] },
  variables: [{ cle: 'actionne', nom: 'Actionné', type: 'bool' }, { cle: 'angle', nom: 'Angle de l\'axe', unite: 'rad' }],
  modele: {
    elements: [{ t: 'S', a: 'C', b: 'NO', nom: 'no' }, { t: 'S', a: 'C', b: 'NC', ferme: true, nom: 'nc' }],
    etat: () => ({ actionne: false, angle: 0 }),
    pas(c) {
      const a = c.monde.axe(c.p.axe).angle, seuil = c.p.seuil * Math.PI / 180;
      c.s.angle = a; c.s.actionne = c.p.sens === 'au-dessus' ? a >= seuil : a <= seuil;
      c.regler('no', c.s.actionne); c.regler('nc', !c.s.actionne);
    },
  },
  affichage: (s, p) => `${p.axe} ${s.actionne ? '● actionné' : '○ libre'}`,
});
})();
