/* frwa_flow-Circuit — regles.js
   RÈGLES DES COMPOSANTS, version 1 : le texte normatif est docs/REGLES_COMPOSANTS.md, ce fichier en est l'application.
   Chaque puce est vérifiée AVANT d'être enregistrée : une puce non conforme est refusée (message dans ＋ et dans
   Aide → Conformité). Les composants de base (composants.js) sont vérifiés au démarrage avec les mêmes tables.

   Ce fichier ne dépend de rien : il est aussi chargé par verifier.html (vérification de tous les fichiers du dossier
   puces/, lancée par outils/verifier_composants.sh) et par la fenêtre 3D. */
'use strict';
(function (G) {

const VERSION = 1;

/* ---------- R2. Unités ----------
   versSI : facteur vers l'unité SI (valeur SI = valeur × versSI).
   variable : l'unité est permise pour une VARIABLE publiée (grandeur SI ou convention fixée par les règles) ;
   les autres ne servent qu'à l'affichage d'un PARAMÈTRE (° pour un réglage d'angle, mm, MHz…). */
const UNITES = {
  '':          { grandeur: 'sans dimension', versSI: 1, variable: true },
  'V':         { grandeur: 'tension', versSI: 1, variable: true },
  'A':         { grandeur: 'courant', versSI: 1, variable: true },
  'Ω':         { grandeur: 'résistance', versSI: 1, variable: true },
  'F':         { grandeur: 'capacité', versSI: 1, variable: true },
  'H':         { grandeur: 'inductance', versSI: 1, variable: true },
  's':         { grandeur: 'temps', versSI: 1, variable: true },
  'Hz':        { grandeur: 'fréquence', versSI: 1, variable: true },
  'MHz':       { grandeur: 'fréquence', versSI: 1e6, variable: false },
  'W':         { grandeur: 'puissance', versSI: 1, variable: true },
  '%':         { grandeur: 'rapport (pour cent)', versSI: 0.01, variable: true },
  '°C':        { grandeur: 'température (convention : degrés Celsius)', versSI: 1, variable: true },
  'lx':        { grandeur: 'éclairement', versSI: 1, variable: true },
  'cd':        { grandeur: 'intensité lumineuse', versSI: 1, variable: true },
  'm':         { grandeur: 'longueur', versSI: 1, variable: true },
  'mm':        { grandeur: 'longueur', versSI: 1e-3, variable: false },
  'carreaux':  { grandeur: 'longueur sur le plan (1 carreau = 20 px)', versSI: null, variable: false },
  'dB':        { grandeur: 'rapport logarithmique', versSI: null, variable: true },
  'dBm':       { grandeur: 'puissance logarithmique (0 dBm = 1 mW)', versSI: null, variable: true },
  'V/A':       { grandeur: 'transrésistance', versSI: 1, variable: true },
  'Pa':        { grandeur: 'pression', versSI: 1, variable: true },
  'rad':       { grandeur: 'angle', versSI: 1, variable: true },
  '°':         { grandeur: 'angle', versSI: Math.PI / 180, variable: false },
  'rad/s':     { grandeur: 'vitesse angulaire', versSI: 1, variable: true },
  '°/s':       { grandeur: 'vitesse angulaire', versSI: Math.PI / 180, variable: false },
  'tr/min':    { grandeur: 'vitesse angulaire', versSI: 2 * Math.PI / 60, variable: false },
  'N·m':       { grandeur: 'couple', versSI: 1, variable: true },
  'kg·m²':     { grandeur: 'moment d\'inertie', versSI: 1, variable: true },
  'N·m·s/rad': { grandeur: 'frottement visqueux', versSI: 1, variable: true },
  'V·s/rad':   { grandeur: 'constante de force contre-électromotrice', versSI: 1, variable: true },
  'bit/s':     { grandeur: 'débit', versSI: 1, variable: true },
};

/* ---------- R4. Types électriques des broches (mêmes catégories que KiCad) ---------- */
const TYPES_BROCHES = {
  entree: 'entrée (lit une tension, ne fournit pas de courant utile)',
  sortie: 'sortie (impose une tension)',
  bidir: 'entrée / sortie',
  trois_etats: 'sortie trois états (haute impédance possible)',
  drain_ouvert: 'drain / collecteur ouvert (tire vers le bas ou relâche : rappel externe obligatoire)',
  passif: 'borne passive (résistance, capteur, transducteur, contact…)',
  alim_entree: 'alimentation consommée (VCC, VDD, GND, VSS…)',
  alim_sortie: 'alimentation fournie (sortie de régulateur, pile, référence)',
  nc: 'non connectée à l\'intérieur du composant',
};

/* ---------- R12. Étiquettes (tags) : tri de la bibliothèque ----------
   Un composant peut porter plusieurs étiquettes ; sans étiquette, il est rangé dans « Autre ». « basic » marque les
   composants du mode « Basique » de la bibliothèque. Liste ouverte (minuscules, chiffres, -) ; celles-ci ont un nom. */
const TAGS = {
  basic: 'Basique', fils: 'Fils et masse', passif: 'Passifs', alimentation: 'Alimentation', generateur: 'Générateurs',
  interrupteur: 'Interrupteurs', relais: 'Relais', temporisation: 'Temporisation', 'semi-conducteur': 'Semi-conducteurs',
  eclairage: 'Éclairage', afficheur: 'Afficheurs', ali: 'Amplificateurs (ALI)', analogique: 'Analogique',
  logique: 'Logique', serie4000: 'Série 4000 (CMOS)', serie7400: 'Série 7400', capteur: 'Capteurs', module: 'Modules',
  arduino: 'Kit Arduino', moteur: 'Moteurs', mesure: 'Mesure', radio: 'Radio', bus: 'Bus série', monde: 'Monde physique',
  pilotage: 'Pilotage externe', protection: 'Protection', optique: 'Optique', son: 'Son',
  audio: 'Audio', comparateur: 'Comparateurs et seuils', 'haute-frequence': 'Haute fréquence',
};
const nomTag = t => TAGS[t] || t;

/* ---------- R3. Champs d'une définition de puce ---------- */
const CHAMPS_PUCE = {
  obligatoires: ['id', 'nom', 'categorie', 'description', 'version', 'regles', 'broches', 'typesBroches', 'variables', 'modele3d'],
  facultatifs: ['prefixe', 'documentation', 'fiche', 'cotes', 'largeur', 'hauteur', 'parametres', 'principal',
    'modele', 'logique', 'interaction', 'affichage', 'dessin', 'ondes', 'mecanique', 'tags', 'famille'],
};
const CHAMPS_PARAM = ['cle', 'nom', 'type', 'unite', 'defaut', 'min', 'max', 'echelle', 'pas', 'options'];
const CHAMPS_VARIABLE = ['cle', 'nom', 'unite', 'type', 'description'];
const CHAMPS_MODELE3D = ['step', 'unite', 'description'];
const CHAMPS_MODELE = ['elements', 'etat', 'pas'];
const CHAMPS_LOGIQUE = ['vdd', 'vss', 'entrees', 'sorties', 'rSortie', 'rEntree', 'vMin', 'chuteHaut', 'chuteBas', 'etat', 'evaluer'];
const CHAMPS_MECANIQUE = ['pilote', 'lit'];

/* Nœuds des primitives (mêmes tables que puces.js) */
const CHAMPS_NOEUDS = { R: ['a', 'b'], C: ['a', 'b'], L: ['a', 'b'], V: ['a', 'b'], A: ['a', 'b'], I: ['a', 'b'], S: ['a', 'b'], D: ['a', 'b'],
  O: ['a', 'ref'], E: ['a', 'b', 'pa', 'pb'], G: ['a', 'b', 'pa', 'pb'], F: ['a', 'b'], Q: ['c', 'b', 'e'], OA: ['p', 'n', 's', 'vp', 'vn'], K: ['a', 'b'] };

/* ---------- R8. Code autorisé ----------
   Le code d'un composant ne voit que ce que le simulateur lui donne (c, e, s, p, x). Interdit : la page, le réseau,
   le hasard non reproductible et l'heure réelle (la simulation doit donner le même résultat à chaque lancement). */
const INTERDITS = [
  [/\bdocument\b/, 'document (la page)'], [/\bwindow\b/, 'window'], [/\bglobalThis\b/, 'globalThis'],
  [/\b(local|session)Storage\b/, 'stockage du navigateur'], [/\bindexedDB\b/, 'indexedDB'],
  [/\bfetch\s*\(/, 'fetch (réseau)'], [/\bXMLHttpRequest\b/, 'XMLHttpRequest (réseau)'], [/\bWebSocket\b/, 'WebSocket (réseau)'],
  [/\bMath\.random\b/, 'Math.random (utiliser c.aleatoire(), reproductible)'],
  [/\bDate\b/, 'Date (heure réelle : utiliser c.t, le temps simulé)'], [/\bperformance\b/, 'performance (heure réelle)'],
  [/\beval\s*\(/, 'eval'], [/\bnew\s+Function\b/, 'new Function'], [/\bset(Timeout|Interval)\b/, 'minuteries du navigateur'],
  [/\bimport\s*\(/, 'import dynamique'],
];
function codeInterdit(source) {
  const sans = String(source).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""');
  return INTERDITS.filter(([re]) => re.test(sans)).map(([, nom]) => nom);
}

/* ---------- Outils offerts aux composants et aux extensions ---------- */
const unites = {
  rad: deg => deg * Math.PI / 180,
  deg: rad => rad * 180 / Math.PI,
  /** angle ramené dans [0, 2π[ */
  tour: rad => ((rad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
  versSI: (v, unite) => (UNITES[unite]?.versSI ? v * UNITES[unite].versSI : v),
  /** « 90° (π/2 rad) » : un angle affiché en degrés et en fraction de tour (2π rad) */
  angle(rad) {
    const d = rad * 180 / Math.PI, f = rad / Math.PI;
    const txt = Math.abs(f) < 1e-9 ? '0' : Math.abs(f - Math.round(f * 12) / 12) < 1e-6 ? fractionPi(Math.round(f * 12), 12) : f.toFixed(3).replace('.', ',') + 'π';
    return `${Number(d.toFixed(1)).toString().replace('.', ',')}° (${txt} rad)`;
  },
};
function fractionPi(n, d) {
  const pgcd = (a, b) => (b ? pgcd(b, a % b) : Math.abs(a)); const k = pgcd(n, d); n /= k; d /= k;
  const num = n === 1 ? 'π' : n === -1 ? '−π' : `${n}π`;
  return d === 1 ? num : `${num}/${d}`;
}
/** générateur pseudo-aléatoire reproductible (mulberry32) : même graine → même suite */
function aleatoire(graine) {
  let a = 0; for (const ch of String(graine)) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 0x9e3779b9) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- Vérification d'une définition de puce ----------
   Renvoie la liste des manquements (vide = conforme). Chaque message cite la règle (R3, R4…) de REGLES_COMPOSANTS.md. */
function verifierPuce(def) {
  const err = [];
  const E = (r, m) => err.push(`${r} : ${m}`);
  if (!def || typeof def !== 'object') return ['R3 : définition vide'];
  const connus = new Set([...CHAMPS_PUCE.obligatoires, ...CHAMPS_PUCE.facultatifs]);
  for (const k of CHAMPS_PUCE.obligatoires) if (!(k in def)) E('R3', `champ obligatoire « ${k} » absent`);
  for (const k of Object.keys(def)) if (!connus.has(k)) E('R3', `champ « ${k} » inconnu`);
  if ('id' in def && !/^[a-z0-9][a-z0-9_\-.]*$/.test(def.id || '')) E('R3', '« id » : minuscules, chiffres, _ - . (commence par une lettre ou un chiffre)');
  for (const k of ['nom', 'categorie', 'description']) if (k in def && (typeof def[k] !== 'string' || !def[k].trim())) E('R3', `« ${k} » doit être un texte non vide`);
  if ('version' in def && !/^\d+\.\d+\.\d+$/.test(def.version || '')) E('R3', '« version » : x.y.z (ex. 1.0.0)');
  if ('regles' in def && def.regles !== VERSION) E('R1', `« regles » doit valoir ${VERSION} (version des règles respectées)`);
  if (!def.modele && !def.logique) E('R6', 'un composant doit avoir un comportement : « modele » et/ou « logique »');

  // broches
  const noms = [];
  if (!Array.isArray(def.broches) || !def.broches.length) E('R4', '« broches » doit être une liste non vide');
  else def.broches.forEach((b, i) => {
    const nom = typeof b === 'string' ? b : b?.nom;
    if (!nom) { E('R4', `broche ${i + 1} sans nom`); return; }
    if (typeof b === 'object') for (const k of Object.keys(b)) if (!['nom', 'etiquette', 'num'].includes(k)) E('R4', `broche « ${nom} » : champ « ${k} » inconnu`);
    if (noms.includes(nom)) E('R4', `broche « ${nom} » en double`);
    noms.push(nom);
  });
  // types des broches : chaque broche une fois, types de la liste
  const typeDe = {};
  if (def.typesBroches && typeof def.typesBroches === 'object') {
    for (const [t, l] of Object.entries(def.typesBroches)) {
      if (!TYPES_BROCHES[t]) { E('R4', `type de broche « ${t} » inconnu (${Object.keys(TYPES_BROCHES).join(', ')})`); continue; }
      if (!Array.isArray(l)) { E('R4', `typesBroches.${t} doit être une liste`); continue; }
      for (const n of l) {
        if (!noms.includes(n)) E('R4', `typesBroches.${t} : « ${n} » n'est pas une broche`);
        else if (typeDe[n]) E('R4', `broche « ${n} » typée deux fois (${typeDe[n]}, ${t})`);
        else typeDe[n] = t;
      }
    }
    for (const n of noms) if (!typeDe[n]) E('R4', `broche « ${n} » sans type (typesBroches)`);
  } else if ('typesBroches' in def) E('R4', '« typesBroches » doit être un objet { type: [broches] }');

  // paramètres
  const params = Array.isArray(def.parametres) ? def.parametres : [];
  if ('parametres' in def && !Array.isArray(def.parametres)) E('R5', '« parametres » doit être une liste');
  const cles = new Set();
  for (const p of params) {
    const q = `paramètre « ${p?.cle} »`;
    if (!p || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(p.cle || '')) { E('R5', `paramètre sans « cle » valide`); continue; }
    if (cles.has(p.cle)) E('R5', `${q} en double`); cles.add(p.cle);
    for (const k of Object.keys(p)) if (!CHAMPS_PARAM.includes(k)) E('R5', `${q} : champ « ${k} » inconnu`);
    if (typeof p.nom !== 'string' || !p.nom) E('R5', `${q} : « nom » manquant`);
    const type = p.type || 'num';
    if (type === 'num') {
      if (!(p.unite in UNITES)) E('R2', `${q} : unité « ${p.unite} » absente de la liste des unités (mettre '' si sans unité)`);
      for (const k of ['defaut', 'min', 'max']) if (!Number.isFinite(p[k])) E('R5', `${q} : « ${k} » doit être un nombre`);
      if (p.min >= p.max) E('R5', `${q} : min doit être < max`);
      if (Number.isFinite(p.defaut) && (p.defaut < p.min || p.defaut > p.max)) E('R5', `${q} : défaut hors de [min, max]`);
      if (!['lin', 'log', undefined].includes(p.echelle)) E('R5', `${q} : échelle 'lin' ou 'log'`);
      if (p.echelle === 'log' && !(p.min > 0)) E('R5', `${q} : échelle log → min > 0`);
      if (p.pas !== undefined && !(p.pas > 0)) E('R5', `${q} : « pas » > 0`);
    } else if (type === 'choix') {
      if (!Array.isArray(p.options) || !p.options.length) E('R5', `${q} : « options » non vide`);
      else if (!p.options.includes(p.defaut)) E('R5', `${q} : défaut absent des options`);
    } else if (type === 'bool') { if (typeof p.defaut !== 'boolean') E('R5', `${q} : défaut true / false`); }
    else if (type === 'texte') { if (typeof p.defaut !== 'string') E('R5', `${q} : défaut texte`); }
    else E('R5', `${q} : type « ${type} » inconnu (num, choix, bool, texte)`);
  }
  if (def.principal !== undefined && !cles.has(def.principal)) E('R5', `« principal » : paramètre « ${def.principal} » inconnu`);

  // variables publiées
  const vars = Array.isArray(def.variables) ? def.variables : [];
  if ('variables' in def && !Array.isArray(def.variables)) E('R7', '« variables » doit être une liste (vide si aucune)');
  const vcles = new Set();
  for (const v of vars) {
    const q = `variable « ${v?.cle} »`;
    if (!v || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(v.cle || '')) { E('R7', 'variable sans « cle » valide'); continue; }
    if (vcles.has(v.cle)) E('R7', `${q} en double`); vcles.add(v.cle);
    for (const k of Object.keys(v)) if (!CHAMPS_VARIABLE.includes(k)) E('R7', `${q} : champ « ${k} » inconnu`);
    if (typeof v.nom !== 'string' || !v.nom) E('R7', `${q} : « nom » manquant`);
    const type = v.type || 'num';
    if (!['num', 'bool', 'texte'].includes(type)) E('R7', `${q} : type num, bool ou texte`);
    if (type === 'num') {
      if (!(v.unite in UNITES)) E('R2', `${q} : unité « ${v.unite} » inconnue`);
      else if (!UNITES[v.unite].variable) E('R2', `${q} : « ${v.unite} » est une unité d'affichage ; une variable est en unité SI (angles en rad, vitesses en rad/s, longueurs en m…)`);
    }
  }
  // l'état initial doit contenir chaque variable publiée
  if (vars.length) {
    const fe = def.logique?.etat || def.modele?.etat;
    if (typeof fe !== 'function') E('R7', 'des variables sont publiées : « etat » doit être une fonction qui les crée');
    else {
      const defauts = Object.fromEntries(params.map(p => [p.cle, p.defaut]));
      try {
        const s = fe(defauts) || {};
        for (const v of vars) if (!(v.cle in s)) E('R7', `variable « ${v.cle} » absente de l'état initial (etat())`);
      } catch (e) { E('R7', `etat() a échoué : ${e.message}`); }
    }
  }

  // R12 : étiquettes et famille de variantes
  if ('tags' in def) {
    if (!Array.isArray(def.tags)) E('R12', '« tags » doit être une liste de textes');
    else {
      for (const t of def.tags) if (typeof t !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(t)) E('R12', `étiquette « ${t} » : minuscules, chiffres, -`);
      if (new Set(def.tags).size !== def.tags.length) E('R12', 'étiquette en double');
    }
  }
  if ('famille' in def) {
    const f = def.famille;
    if (!f || typeof f !== 'object') E('R12', '« famille » : { id, nom, valeur }');
    else {
      for (const k of Object.keys(f)) if (!['id', 'nom', 'valeur'].includes(k)) E('R12', `famille : champ « ${k} » inconnu`);
      if (!/^[a-z0-9][a-z0-9_\-.]*$/.test(f.id || '')) E('R12', 'famille.id : minuscules, chiffres, _ - .');
      for (const k of ['nom', 'valeur']) if (typeof f[k] !== 'string' || !f[k]) E('R12', `famille.${k} : texte non vide`);
    }
  }

  // modèle 3D : déclaré explicitement (fichier STEP, ou null tant qu'il n'existe pas)
  if ('modele3d' in def && def.modele3d !== null) {
    const m = def.modele3d;
    if (typeof m !== 'object') E('R9', '« modele3d » : null ou { step: "fichier.step" }');
    else {
      for (const k of Object.keys(m)) if (!CHAMPS_MODELE3D.includes(k)) E('R9', `modele3d : champ « ${k} » inconnu`);
      if (!/\.(step|stp)$/i.test(m.step || '')) E('R9', 'modele3d.step : nom de fichier .step ou .stp');
      if (m.unite !== undefined && m.unite !== 'mm') E('R9', 'modele3d.unite : mm (comme KiCad)');
    }
  }

  // modèle analogique
  const refs = new Set();
  if (def.modele) {
    for (const k of Object.keys(def.modele)) if (!CHAMPS_MODELE.includes(k)) E('R6', `modele : champ « ${k} » inconnu`);
    for (const e of def.modele.elements || []) {
      if (!CHAMPS_NOEUDS[e.t]) { E('R6', `élément de type « ${e.t} » inconnu`); continue; }
      for (const k of CHAMPS_NOEUDS[e.t]) { if (typeof e[k] !== 'string') E('R6', `élément ${e.t} : nœud « ${k} » manquant`); else refs.add(e[k]); }
      if (e.t === 'F' && !e.mesure) E('R6', 'élément F : « mesure » obligatoire');
    }
    if (def.modele.pas !== undefined && typeof def.modele.pas !== 'function') E('R6', 'modele.pas doit être une fonction');
  }
  if (def.logique) {
    const L = def.logique;
    for (const k of Object.keys(L)) if (!CHAMPS_LOGIQUE.includes(k)) E('R6', `logique : champ « ${k} » inconnu`);
    for (const k of ['vdd', 'vss']) { if (!noms.includes(L[k])) E('R6', `logique.${k} doit être une broche`); refs.add(L[k]); }
    for (const n of [...(L.entrees || []), ...(L.sorties || [])]) { if (!noms.includes(n)) E('R6', `logique : « ${n} » n'est pas une broche`); refs.add(n); }
    if (typeof L.evaluer !== 'function') E('R6', 'logique.evaluer doit être une fonction');
    for (const n of L.sorties || []) if (typeDe[n] && !['sortie', 'trois_etats', 'bidir', 'drain_ouvert'].includes(typeDe[n])) E('R4', `« ${n} » est une sortie logique : type sortie, trois_etats, bidir ou drain_ouvert`);
  }
  // R4 : une broche doit être reliée au modèle (élément ou logique), sauf une ENTRÉE idéale lue par le code (c.v)
  // et une broche « nc » (qui, elle, ne doit pas l'être)
  for (const n of noms) {
    if (typeDe[n] === 'nc' && refs.has(n)) E('R4', `broche « ${n} » typée nc mais reliée au modèle`);
    if (typeDe[n] && !['nc', 'entree'].includes(typeDe[n]) && !refs.has(n)) E('R4', `broche « ${n} » (${typeDe[n]}) reliée à rien dans le modèle (la relier, ou la typer entree / nc)`);
  }

  // mécanique : axes pilotés / lus = paramètres texte (nom d'axe, comme une étiquette de réseau)
  if (def.mecanique) {
    for (const k of Object.keys(def.mecanique)) if (!CHAMPS_MECANIQUE.includes(k)) E('R10', `mecanique : champ « ${k} » inconnu`);
    for (const k of CHAMPS_MECANIQUE) for (const a of def.mecanique[k] || []) {
      const c = String(a).replace(/^\$/, ''), p = params.find(z => z.cle === c);
      if (!String(a).startsWith('$') || !p || p.type !== 'texte') E('R10', `mecanique.${k} : « ${a} » doit désigner un paramètre texte ('$cle') qui porte le nom de l'axe`);
    }
  }

  // code : fonctions de la définition
  const fonctions = [];
  const collecter = (o, chemin, prof = 0) => {
    if (!o || prof > 4) return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'function') fonctions.push([chemin + k, v]);
      else if (v && typeof v === 'object' && !Array.isArray(v)) collecter(v, chemin + k + '.', prof + 1);
      else if (Array.isArray(v)) v.forEach((x, i) => { if (x && typeof x === 'object') collecter(x, `${chemin}${k}[${i}].`, prof + 1); });
    }
  };
  collecter(def, '');
  for (const [chemin, f] of fonctions) for (const nom of codeInterdit(f.toString())) E('R8', `${chemin} utilise ${nom}`);
  return err;
}

/* ---------- Vérification d'un composant de base (composants.js) : mêmes tables pour paramètres, broches, variables ---------- */
function verifierType(T) {
  const err = [], E = (r, m) => err.push(`${r} : ${m}`);
  const noms = (T.broches || []).map(b => b.nom);
  if (new Set(noms).size !== noms.length) E('R4', 'broches en double');
  const typeDe = {};
  for (const [t, l] of Object.entries(T.typesBroches || {})) {
    if (!TYPES_BROCHES[t]) E('R4', `type de broche « ${t} » inconnu`);
    for (const n of l) { if (!noms.includes(n)) E('R4', `typesBroches.${t} : « ${n} » n'est pas une broche`); typeDe[n] = t; }
  }
  for (const n of noms) if (!typeDe[n]) E('R4', `broche « ${n} » sans type`);
  for (const p of T.params || []) {
    if ((p.type || 'num') === 'num' && !(p.unite in UNITES)) E('R2', `paramètre « ${p.cle} » : unité « ${p.unite} » inconnue`);
    if ((p.type || 'num') === 'num' && (p.defaut < p.min || p.defaut > p.max)) E('R5', `paramètre « ${p.cle} » : défaut hors de [min, max]`);
  }
  for (const v of T.variables || []) if (!(v.unite in UNITES) || !UNITES[v.unite].variable) E('R2', `variable « ${v.cle} » : unité « ${v.unite} » non SI`);
  for (const t of T.tags || []) if (!/^[a-z0-9][a-z0-9-]*$/.test(t)) E('R12', `étiquette « ${t} » invalide`);
  if (!('modele3d' in T)) E('R9', '« modele3d » non déclaré (null tant qu\'il n\'y a pas de fichier STEP)');
  return err;
}

G.FrWARegles = { VERSION, UNITES, TYPES_BROCHES, TAGS, nomTag, CHAMPS_PUCE, CHAMPS_NOEUDS, INTERDITS, verifierPuce, verifierType, codeInterdit, unites, aleatoire };
})(typeof window !== 'undefined' ? window : globalThis);
