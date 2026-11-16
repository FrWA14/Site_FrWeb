/* frwa_flow-Circuit — interface.js
   Interface « style PROTO » : plan de travail noir à points, fils colorés par la tension, points jaunes du courant,
   pastilles nom/valeur, gros boutons en carrés arrondis, molette circulaire, oscilloscope en bandeau (autant de courbes que l'on veut,
   regroupées en graphes que l'on joint ou dissocie ; un cadre de la couleur de la courbe entoure l'objet mesuré).
   Gestes : glisser depuis une broche = tracer un fil · glisser un composant = le déplacer · glisser le fond = se déplacer
   (souris : cadre de sélection ; clic droit glissé = se déplacer, clic droit = menu, sans collage) · molette souris / pincer = zoom ·
   toucher un composant = le sélectionner (ou l'actionner : interrupteur, poussoir, TTP223) · Maj+clic = ajouter au groupe.
   Copier / coller : boutons en bas à droite (Copier dès qu'il y a une sélection, Coller dès que quelque chose a été copié).
   Clavier : Ctrl+C / X / V / D / A, Suppr, R, Espace, W, Échap. Vue 3D : une fenêtre par module (vue3d.html). */
'use strict';
(function (G) {
const { TYPES, ORDRE_CAT, GRILLE, COUL, D, couleurTension, formater, lireValeur } = G.FrWAComposants;
const { Schema, compiler, calculerCourants, tourner, cle } = G.FrWACircuit;
const { Puces, chargerTout, importer, oublier, pucesUtilisateur, texteVariable } = G.FrWAPuces;
const EXEMPLES = G.FrWAExemples;
/* Réglages de la page (window.FrWAConfig, posé avant ce fichier) : la version du site web n'a ni serveur ni pilotage.
   stockage : garder le circuit en cours et la liste des schémas (navigateur / fichier du projet) ; sinon tout passe par
   des fichiers que l'on télécharge et que l'on rouvre. oscilloBureau : oscilloscope à un écran avec zoom, curseurs et
   mesures (oscillo_bureau.js) sur les écrans larges. sansTags : étiquettes de composants à ne pas proposer.
   vue3d : proposer la fenêtre 3D des modules (vue3d.html). */
const CONFIG = { stockage: true, oscilloBureau: false, sansTags: [], vue3d: true, ...(G.FrWAConfig || {}) };
const typePropose = T => !(T.tags || []).some(t => CONFIG.sansTags.includes(t));

const $ = s => document.querySelector(s);
const toile = $('#toile'), g = toile.getContext('2d');
const oscToile = $('#osc'), og = oscToile.getContext('2d');

const ICONES = {
  spectre: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h16"/><path d="M6 17v-3M9 17V8M12 17v-6M15 17V5M18 17v-4"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
  lecture: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  poubelle: '<svg viewBox="0 0 24 24"><path d="M9 3h6l1 2h4v2H4V5h4zM6 8h12l-1 12.5a1.6 1.6 0 0 1-1.6 1.5H8.6A1.6 1.6 0 0 1 7 20.5z"/></svg>',
  rotation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M19 12a7 7 0 1 1-2-4.9"/><path d="M19 4v4h-4"/></svg>',
  reglages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.4" fill="#5c6b70"/><circle cx="15" cy="17" r="2.4" fill="#5c6b70"/></svg>',
  oscillo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M5 15c2-6 3-6 4.5 0s3 6 4.5 0 3-6 5 0"/></svg>',
  coller: '<svg viewBox="0 0 24 24"><path d="M9 2h6a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V3a1 1 0 0 1 1-1zm1 2v2h4V4zM7 10v2h10v-2zm0 4v2h7v-2z"/></svg>',
  copier: '<svg viewBox="0 0 24 24"><path d="M8 3h9l4 4v11a2 2 0 0 1-2 2h-2V9l-4-4H8z" opacity=".55"/><path d="M4 7h8l4 4v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/></svg>',
  fil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 18h7V6h9"/><circle cx="4" cy="18" r="1.8" fill="currentColor"/><circle cx="20" cy="6" r="1.8" fill="currentColor"/></svg>',
  oeilOuvert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  oeil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 20 20 4"/></svg>',
  fermer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  joindre: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M5 14c2-5 3-5 4.5 0s3 5 4.5 0 3-5 5 0"/><path d="M5 10c2-4 4-4 6 0s4 4 8 0" opacity=".6"/></svg>',
  dissocier: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="8" rx="1.5"/><rect x="3" y="13" width="18" height="8" rx="1.5"/><path d="M5 8c2-3 3-3 4.5 0s3 3 4.5 0 3-3 5 0M5 18c2-3 3-3 4.5 0s3 3 4.5 0 3-3 5 0"/></svg>',
};

/* ---------- État ---------- */
let schema = new Schema();
let compil = null, aCompiler = true, enMarche = true, erreurSim = '';
let vue = { x: 0, y: 0, z: 1.3 };
let selection = null, modeFil = false, geste = null;
let groupe = new Set();          // sélection multiple (éléments et fils) : cadre de sélection, Maj+clic, collage
let pressePapier = null, collages = 0, sourisMonde = null;
const fenetres3d = new Map();    // nom de l'élément → fenêtre vue3d.html ouverte
let vitesse = 1, vitesseCourant = 50, accumulateur = 0, ralenti = false, ralentiVu = -1e9, montrerPastilles = true;
let vmaxLisse = 5;
const pointeurs = new Map();
// analyse en fréquence (spectre, cascade) : réglages enregistrés avec le circuit (champ « analyse »)
const ANALYSE_DEFAUT = { mode: 'temps', taille: 4096, fenetre: 'hann', echelle: 'dB', axe: 'log', dyn: 100, fe: 0, fmax: 0, moyenne: 0 };
const oscillo = { voies: [], N: 500, fenetre: 2, prochain: 0, visible: false, masque: false, analyse: { ...ANALYSE_DEFAUT }, kSpec: 0, feEff: 0 };
// 8 couleurs bien distinctes, puis des teintes réparties par l'angle d'or (aucune limite au nombre de courbes)
const COUL_VOIES = ['#5ee87a', '#5aa9ff', '#ffd400', '#ff6bd5', '#ff8c42', '#4ecdc4', '#c38fe0', '#f2453d'];
let prochainGroupe = 1;

/* ---------- Outils ---------- */
const versMonde = (sx, sy) => [(sx - vue.x) / vue.z, (sy - vue.y) / vue.z];
const aimanter = v => Math.round(v / GRILLE) * GRILLE;
function toast(msg, type = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'on ' + type;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = ''; }, type === 'erreur' ? 7000 : 3200);
}
let _sauveT = 0;
function sauvegarder() {
  if (!CONFIG.stockage) return;
  clearTimeout(_sauveT);
  _sauveT = setTimeout(() => {
    const o = schema.serialiser();
    o.oscillo = voiesSerialisees();
    o.vitesse = vitesse; o.fenetre = oscillo.fenetre; o.analyse = { ...oscillo.analyse };
    try { localStorage.setItem('frwa_circuit_courant', JSON.stringify(o)); } catch (e) { /* stockage indisponible */ }
  }, 400);
}
function modifie() { aCompiler = true; sauvegarder(); }

/* ---------- Tests de position ---------- */
function pointProche(wx, wy) {
  const r2 = (10 / vue.z) ** 2; let best = null, bd = r2;
  const tester = (x, y, o) => { const d = (x - wx) ** 2 + (y - wy) ** 2; if (d < bd) { bd = d; best = { x, y, o }; } };
  for (const el of schema.elements) for (const b of schema.broches(el)) tester(b.x, b.y, el);
  for (const f of schema.fils) { tester(f.x1, f.y1, f); tester(f.x2, f.y2, f); }
  return best;
}
function elementSous(wx, wy) {
  for (let i = schema.elements.length - 1; i >= 0; i--) {
    const el = schema.elements[i], T = TYPES[el.type];
    const [lx, ly] = tourner(wx - el.x, wy - el.y, -el.rot), [x0, y0, x1, y1] = T.boiteDe(el), m = 3 / vue.z;
    if (lx >= x0 - m && lx <= x1 + m && ly >= y0 - m && ly <= y1 + m) return el;
  }
  return null;
}
function filSous(wx, wy) {
  const r = 6 / vue.z;
  for (const f of schema.fils) {
    const dx = f.x2 - f.x1, dy = f.y2 - f.y1, L2 = dx * dx + dy * dy;
    let t = ((wx - f.x1) * dx + (wy - f.y1) * dy) / L2; t = Math.max(0, Math.min(1, t));
    if (Math.hypot(f.x1 + t * dx - wx, f.y1 + t * dy - wy) < r) return f;
  }
  return null;
}
function filsAttaches(el) {
  const bs = schema.broches(el), l = [];
  for (const f of schema.fils) for (const bout of [1, 2]) {
    const x = f['x' + bout], y = f['y' + bout];
    const i = bs.findIndex(b => b.x === x && b.y === y);
    if (i >= 0) l.push({ f, bout, i });
  }
  return l;
}
function suivreFils(el, attaches) {
  const bs = schema.broches(el);
  for (const a of attaches) { a.f['x' + a.bout] = bs[a.i].x; a.f['y' + a.bout] = bs[a.i].y; }
}

/* ---------- Édition ---------- */
function selectionner(o, garderGroupe = false) {
  selection = o;
  if (!garderGroupe) groupe.clear();
  $('#menu-broches').hidden = true;
  majOutils();
}
/** ce sur quoi agissent copier, couper, supprimer, dupliquer : le groupe, sinon la sélection simple */
function objetsSelectionnes() { return groupe.size ? [...groupe] : selection ? [selection] : []; }
/** Maj+clic : ajoute ou retire un objet du groupe (la sélection simple en cours y entre d'abord) */
function basculerGroupe(o) {
  if (!groupe.size && selection && selection !== o) groupe.add(selection);
  if (groupe.has(o)) groupe.delete(o); else groupe.add(o);
  selection = groupe.size === 1 ? [...groupe][0] : groupe.has(o) ? o : null;
  if (groupe.size === 1) groupe.clear();
  $('#menu-broches').hidden = true; majOutils();
}
function toutSelectionner() {
  groupe = new Set([...schema.elements, ...schema.fils]); selection = null;
  if (groupe.size === 1) { selection = [...groupe][0]; groupe.clear(); }
  majOutils();
}
function ajouterAuCentre(type) {
  const W = toile.clientWidth, H = toile.clientHeight;
  const [wx, wy] = versMonde(W / 2, H / 2);
  // cherche, en spirale autour du centre de la vue, une place où le nouveau composant ne touche rien
  const T = TYPES[type]; if (!T) return;
  const etendue = (el) => {
    const b = boiteMonde(el), ps = schema.broches(el);
    return [Math.min(b[0], ...ps.map(p => p.x)) - 20, Math.min(b[1], ...ps.map(p => p.y)) - 20, Math.max(b[2], ...ps.map(p => p.x)) + 20, Math.max(b[3], ...ps.map(p => p.y)) + 20];
  };
  const occupe = schema.elements.map(etendue).concat(schema.fils.map(f => [Math.min(f.x1, f.x2) - 10, Math.min(f.y1, f.y2) - 10, Math.max(f.x1, f.x2) + 10, Math.max(f.y1, f.y2) + 10]));
  const cx = aimanter(wx), cy = aimanter(wy);
  let x = cx, y = cy;
  chercher: for (let r = 0; r < 30; r++) for (let i = -r; i <= r; i++) for (const [dx, dy] of [[i, -r], [i, r], [-r, i], [r, i]]) {
    const essai = { type, x: cx + dx * 40, y: cy + dy * 40, rot: 0 };
    const [a0, b0, a1, b1] = etendue(essai);
    if (!occupe.some(([c0, d0, c1, d1]) => a0 < c1 && a1 > c0 && b0 < d1 && b1 > d0)) { x = essai.x; y = essai.y; break chercher; }
  }
  try {
    const el = schema.ajouter(type, x, y, 0);
    schema.normaliser(); modifie(); selectionner(el); fermerTiroir();
  } catch (e) { toast(e.message, 'erreur'); }
}
function creerFils(x0, y0, x1, y1) {
  if (x0 === x1 && y0 === y1) return;
  // un segment qui passerait SUR une broche ou une extrémité de fil la raccorderait (risque de court-circuit) :
  // on choisit le coude (horizontal d'abord ou vertical d'abord) qui n'en touche aucune
  const points = [];
  for (const el of schema.elements) for (const b of schema.broches(el)) points.push([b.x, b.y]);
  for (const f of schema.fils) points.push([f.x1, f.y1], [f.x2, f.y2]);
  const touche = (ax, ay, bx, by) => points.some(([px, py]) => {
    if ((px === ax && py === ay) || (px === bx && py === by)) return false;
    return ax === bx ? px === ax && py > Math.min(ay, by) && py < Math.max(ay, by) : py === ay && px > Math.min(ax, bx) && px < Math.max(ax, bx);
  });
  if (x0 === x1 || y0 === y1) schema.ajouterFil(x0, y0, x1, y1);
  else if (!touche(x0, y0, x1, y0) && !touche(x1, y0, x1, y1)) { schema.ajouterFil(x0, y0, x1, y0); schema.ajouterFil(x1, y0, x1, y1); }
  else if (!touche(x0, y0, x0, y1) && !touche(x0, y1, x1, y1)) { schema.ajouterFil(x0, y0, x0, y1); schema.ajouterFil(x0, y1, x1, y1); }
  else { schema.ajouterFil(x0, y0, x1, y0); schema.ajouterFil(x1, y0, x1, y1); toast('Attention : ce fil passe sur une broche et la raccorde.'); }
  schema.normaliser(); modifie();
}
function supprimerObjets(objs) {
  if (!objs.length) return;
  const l = new Set(objs);
  oscillo.voies = oscillo.voies.filter(v => !l.has(v.el) && !l.has(v.fil));
  for (const o of objs) schema.supprimer(o);
  selectionner(null); schema.normaliser(); modifie(); majLegende();
}
function supprimerSelection() { supprimerObjets(objetsSelectionnes()); }
function tournerSelection() {
  if (!selection || selection.type === 'fil') return;
  const at = filsAttaches(selection);
  selection.rot = (selection.rot + 1) % 4;
  suivreFils(selection, at); schema.normaliser(); modifie();
}
/* ---------- Presse-papier : copier, couper, coller, dupliquer ----------
   Format texte (JSON) : { format: 'frwa-circuit-copie', version: 1, elements: [...], fils: [[x1, y1, x2, y2], …] }.
   Il passe aussi par le presse-papier du système : on peut coller dans un autre onglet du simulateur. */
function capturer(objs) {
  const els = objs.filter(o => o.type !== 'fil'), fils = objs.filter(o => o.type === 'fil');
  return {
    format: 'frwa-circuit-copie', version: 1,
    elements: els.map(e => ({ type: e.type, nom: e.nom, x: e.x, y: e.y, rot: e.rot, params: JSON.parse(JSON.stringify(e.params)),
      ...(e.sansPastille ? { sansPastille: true } : {}), ...(e.pastille ? { pastille: e.pastille } : {}), ...(e.inverse ? { inverse: true } : {}) })),
    fils: fils.map(f => [f.x1, f.y1, f.x2, f.y2]),
  };
}
function copier(couper = false) {
  const objs = objetsSelectionnes(); if (!objs.length) return;
  pressePapier = capturer(objs); collages = 0;
  try { navigator.clipboard?.writeText(JSON.stringify(pressePapier)).catch(() => {}); } catch (e) { /* presse-papier système indisponible */ }
  if (couper) supprimerObjets(objs); else majOutils();
  toast(`${objs.length} objet(s) ${couper ? 'coupé(s)' : 'copié(s)'} · bouton Coller (en bas à droite) ou Ctrl+V`);
}
/** colle « donnees » ; « ou » = point du monde visé (coin haut-gauche du collage), sinon décalé de 40 à chaque collage */
function coller(donnees = pressePapier, ou = null) {
  if (!donnees?.elements || !Array.isArray(donnees.fils)) { toast('Presse-papier vide : copiez d\'abord (Ctrl+C).'); return; }
  const xs = [...donnees.elements.map(e => e.x), ...donnees.fils.flatMap(f => [f[0], f[2]])];
  const ys = [...donnees.elements.map(e => e.y), ...donnees.fils.flatMap(f => [f[1], f[3]])];
  if (!xs.length) return;
  collages++;
  const [dx, dy] = ou ? [aimanter(ou[0] - Math.min(...xs)), aimanter(ou[1] - Math.min(...ys))] : [40 * collages, 40 * collages];
  const nouveaux = new Set(), manquants = new Set();
  for (const e of donnees.elements) {
    if (!TYPES[e.type]) { manquants.add(e.type.replace('puce:', '')); continue; }
    const pris = schema.elements.some(z => z.nom === e.nom);
    const n = schema.ajouter(e.type, e.x + dx, e.y + dy, e.rot || 0, JSON.parse(JSON.stringify(e.params || {})), pris ? undefined : e.nom);
    if (e.sansPastille) n.sansPastille = true; if (e.pastille) n.pastille = e.pastille; if (e.inverse) n.inverse = true;
    nouveaux.add(n);
  }
  for (const [a, b, c, d] of donnees.fils) { const f = schema.ajouterFil(a + dx, b + dy, c + dx, d + dy); if (f) nouveaux.add(f); }
  schema.normaliser();
  for (const o of [...nouveaux]) if (o.type === 'fil' && !schema.fils.includes(o)) nouveaux.delete(o);   // fils recoupés
  selection = null; groupe = nouveaux;
  if (groupe.size === 1) { selection = [...groupe][0]; groupe = new Set(); }
  modifie(); majOutils();
  if (manquants.size) toast('Puces absentes (importez leur fichier) : ' + [...manquants].join(', '), 'erreur');
}
/** bouton Coller : colle le presse-papier interne au centre de la vue (décalé de 20 à chaque nouveau collage) */
function collerAuCentre() {
  if (!pressePapier) return;
  const xs = [...pressePapier.elements.map(e => e.x), ...pressePapier.fils.flatMap(f => [f[0], f[2]])];
  const ys = [...pressePapier.elements.map(e => e.y), ...pressePapier.fils.flatMap(f => [f[1], f[3]])];
  if (!xs.length) return;
  const [cx, cy] = versMonde(toile.clientWidth / 2, toile.clientHeight / 2), d = 20 * collages;
  coller(pressePapier, [cx - (Math.max(...xs) - Math.min(...xs)) / 2 + d, cy - (Math.max(...ys) - Math.min(...ys)) / 2 + d]);
}
function dupliquer() {
  const objs = objetsSelectionnes(); if (!objs.length) return;
  const avant = collages; collages = 0; coller(capturer(objs)); collages = avant;
}
function reinitialiser() {
  for (const el of schema.elements) { TYPES[el.type]?.reinitialiser?.(el); el._cc = null; }
  for (const f of schema.fils) f._cc = 0;
  for (const v of oscillo.voies) { v.data.fill(NaN); v.n = 0; razSpectre(v); }
  oscillo.prochain = 0; accumulateur = 0; aCompiler = true;
}

/* ---------- Compilation / simulation ---------- */
function recompiler() {
  aCompiler = false;
  const t = compil ? compil.sim.t : 0;
  try {
    compil = compiler(schema);
    compil.sim.t = t;
    compil.jonctions = [];
    const compte = new Map();
    const ajouter = (x, y) => { const k = cle(x, y); compte.set(k, (compte.get(k) || 0) + 1); };
    for (const f of schema.fils) { ajouter(f.x1, f.y1); ajouter(f.x2, f.y2); }
    for (const el of schema.elements) for (const b of compil.brochesEl.get(el)) ajouter(b.x, b.y);
    for (const [k, n] of compte) if (n >= 3) compil.jonctions.push(k.split(',').map(Number));
    erreurSim = '';
  } catch (e) { erreurSim = e.message; compil = null; }
  if (oscillo.prochain > (compil?.sim.t ?? 0)) oscillo.prochain = 0;
}
function mesurerVoie(v, sim) {
  if (v.fil) return sim.v(v.fil._noeud);
  if (v.variable) { const x = v.el._etat?.[v.variable]; return typeof x === 'boolean' ? (x ? 1 : 0) : Number.isFinite(x) ? x : NaN; }
  const n = v.el._noeuds; if (!n) return NaN;
  if (v.broche !== null && v.broche !== undefined) return sim.v(n[v.broche]);
  const T = TYPES[v.el.type];
  if (n.length < 2) return sim.v(n[0]);
  return T.mesureInverse ? sim.v(n[1]) - sim.v(n[0]) : sim.v(n[0]) - sim.v(n[1]);
}
/** oscilloscope de bureau (oscillo_bureau.js) à la place du bandeau : écran large, souris, affichage temporel */
const bureauActif = () => CONFIG.oscilloBureau && !!G.FrWAOscilloBureau && oscillo.analyse.mode === 'temps' && G.FrWAOscilloBureau.possible();
function reglerFenetre(v) {
  oscillo.fenetre = v; for (const w of oscillo.voies) { w.data.fill(NaN); w.n = 0; } oscillo.prochain = 0;
  majLegende(); sauvegarder();
}
function echantillonner(sim) {
  if (!oscillo.voies.length) return;
  if (CONFIG.oscilloBureau && G.FrWAOscilloBureau) G.FrWAOscilloBureau.echantillonner(sim);
  if (oscillo.analyse.mode !== 'temps') echantillonnerSpectre(sim);
  const dtE = oscillo.fenetre / oscillo.N;
  if (sim.t < oscillo.prochain) return;
  oscillo.prochain = sim.t + dtE;
  for (const v of oscillo.voies) { v.data[v.n % oscillo.N] = mesurerVoie(v, sim); v.n++; }
}
function simuler(dms) {
  ralenti = false;
  if (!compil || !enMarche || erreurSim) return;
  const sim = compil.sim;
  accumulateur += vitesse * dms / 1000 / sim.dt;
  let n = Math.floor(accumulateur); accumulateur -= n;
  n = Math.min(n, 100000);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    if (!sim.pas()) { erreurSim = sim.erreur; break; }
    echantillonner(sim);
    if ((i & 7) === 7 && performance.now() - t0 > 14) { ralenti = true; accumulateur = 0; break; }
  }
}
function majCourants(dms) {
  if (!compil) return;
  calculerCourants(compil, schema);
  if (!enMarche) return;
  const mult = 1.7 * dms * Math.exp(vitesseCourant / 3.5 - 14.2);
  const pas = I => { let c = I * mult; if (!Number.isFinite(c)) return 0; return c % 8; };
  for (const el of schema.elements) {
    if (!el._i) continue;
    if (!el._cc || el._cc.length !== el._i.length) el._cc = new Array(el._i.length).fill(0);
    for (let i = 0; i < el._i.length; i++) el._cc[i] += pas(el._i[i]);
  }
  for (const f of schema.fils) f._cc = (f._cc || 0) + pas(f._i || 0);
}

/* ---------- Dessin ---------- */
function rendu(el, sim, vmax) {
  return {
    vmax, marche: enMarche,
    v: i => (sim && el._noeuds ? sim.v(el._noeuds[i]) : 0),
    c: i => (sim && el._noeuds ? couleurTension(sim.v(el._noeuds[i]), vmax) : '#8a8a8a'),
    i: i => (el._i ? el._i[i] || 0 : 0),
  };
}
function pattes(el) {
  const T = TYPES[el.type];
  if (T.lay) return T.def.broches.map(b => { const p = T.lay.pos[b.nom]; return p.cote === 'g' || p.cote === 'd' ? [p.x, p.y, p.bx, p.y] : [p.x, p.y, p.x, p.by]; });
  if (T.pattes) return T.pattes;
  return null;
}
TYPES.npn.pattes = TYPES.pnp.pattes = [[-40, 0, -8, 0], [20, -40, 20, -22], [20, 40, 20, 22]];
for (const id of ['pile', 'source_ac', 'horloge', 'source_mod']) TYPES[id].mesureInverse = true;

function dessinerElement(gc, el, R, points) {
  const T = TYPES[el.type];
  gc.save(); gc.translate(el.x, el.y); gc.rotate(el.rot * Math.PI / 2);
  try { T.dessiner(gc, el, R); } catch (e) { el._erreur = 'dessin : ' + e.message; }
  if (points && el._cc) {
    if (T.dipole) { if (Math.abs(el._i?.[0] || 0) > 1e-9) D.points(gc, -40, 0, 40, 0, el._cc[0]); }
    else { const p = pattes(el); if (p) p.forEach((s, i) => { if (Math.abs(el._i?.[i] || 0) > 1e-9) D.points(gc, s[0], s[1], s[2], s[3], el._cc[i] || 0); }); }
  }
  gc.restore();
}
function boiteMonde(el) {
  const T = TYPES[el.type], [x0, y0, x1, y1] = T.boiteDe(el);
  const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => tourner(x, y, el.rot));
  return [el.x + Math.min(...c.map(p => p[0])), el.y + Math.min(...c.map(p => p[1])), el.x + Math.max(...c.map(p => p[0])), el.y + Math.max(...c.map(p => p[1]))];
}
function texteValeur(el) {
  const T = TYPES[el.type];
  if (T.valeur) return T.valeur(el);
  if (!T.principal) return null;
  const p = T.params.find(p => p.cle === T.principal);
  if (!p) return null;
  return p.type === 'choix' ? el.params[p.cle] : formater(el.params[p.cle], p.unite);
}
function pastille(sx, sy, texte, fond, encre, align, fs) {
  g.font = `600 ${fs}px ui-sans-serif, system-ui, "Segoe UI", sans-serif`;
  const w = g.measureText(texte).width + fs * 0.9, h = fs * 1.55;
  let x = align === 'left' ? sx : align === 'right' ? sx - w : sx - w / 2;
  const y = sy - h / 2;
  g.fillStyle = fond; g.beginPath(); g.roundRect(x, y, w, h, h * 0.32); g.fill();
  g.fillStyle = encre; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texte, x + w / 2, sy + 0.5);
}
function dessinerPastilles(dpr) {
  if (!montrerPastilles || vue.z < 0.55) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const fs = Math.max(9, Math.min(14, 9 * vue.z));
  const ecran = (x, y) => [x * vue.z + vue.x, y * vue.z + vue.y];
  for (const el of schema.elements) {
    const T = TYPES[el.type];
    if (T.etiquette || el.sansPastille) continue;
    const val = texteValeur(el);
    let pn, pv, an = 'center', av = 'center';
    if (T.dipole) {
      // comme PROTO : horizontal → nom au-dessus, valeur en dessous ; vertical → nom à gauche, valeur à droite
      const vertical = el.rot % 2 === 1, s = el.inverse ? -1 : 1;
      const [ox, oy] = vertical ? [-26 * s, 0] : [0, -26 * s], [vx, vy] = vertical ? [26 * s, 0] : [0, 26 * s];
      pn = [el.x + ox, el.y + oy]; pv = [el.x + vx, el.y + vy];
      if (vertical) { an = ox > 0 ? 'left' : 'right'; av = vx > 0 ? 'left' : 'right'; }
    } else if (T.masse) {
      const b = boiteMonde(el); pn = [b[0] - 4, (b[1] + b[3]) / 2]; an = 'right';
    } else if (T.puce) {
      const b = boiteMonde(el); pn = [b[2] + 4, b[1] + 9]; an = 'left'; pv = [b[2] + 4, b[3] - 9]; av = 'left';
    } else {
      const b = boiteMonde(el); pn = [b[2] + 6, b[1] + 6]; an = 'left'; pv = [b[2] + 6, b[3] - 6]; av = 'left';
    }
    // el.pastille : 'valeur' ou 'nom' pour n'en montrer qu'une (circuits denses)
    if (el.pastille !== 'valeur') { const [sx, sy] = ecran(...pn); pastille(sx, sy, el.nom, COUL.pastilleNom, '#ffffff', an, fs); }
    if (val && pv && el.pastille !== 'nom') { const [tx, ty] = ecran(...pv); pastille(tx, ty, val, COUL.pastilleVal, '#04110f', av, fs); }
  }
}
function dessiner() {
  const dpr = window.devicePixelRatio || 1, W = toile.clientWidth, H = toile.clientHeight;
  if (toile.width !== Math.round(W * dpr) || toile.height !== Math.round(H * dpr)) { toile.width = Math.round(W * dpr); toile.height = Math.round(H * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = COUL.fond; g.fillRect(0, 0, W, H);
  // grille de points
  const pas = GRILLE * vue.z;
  if (pas >= 7) {
    g.fillStyle = '#2f3433'; const r = Math.max(1, Math.min(2, vue.z * 1.1));
    for (let x = ((vue.x % pas) + pas) % pas; x < W; x += pas) for (let y = ((vue.y % pas) + pas) % pas; y < H; y += pas) g.fillRect(x - r / 2, y - r / 2, r, r);
  }
  g.setTransform(dpr * vue.z, 0, 0, dpr * vue.z, dpr * vue.x, dpr * vue.y);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const sim = compil?.sim;
  // échelle des couleurs : suit la plus grande tension du circuit
  if (sim) { let m = 1; for (let i = 1; i < sim.N; i++) m = Math.max(m, Math.abs(sim.v(i))); vmaxLisse += (m - vmaxLisse) * 0.1; }
  const vmax = Math.max(1, vmaxLisse);
  const points = enMarche && !!sim;
  // 1) monde physique (objets, lumières, climat) sous tout le reste ; 2) ondes (radio, ultrasons)
  for (const el of schema.elements) if (TYPES[el.type]?.mondePhysique) dessinerElement(g, el, rendu(el, sim, vmax), false);
  if (sim) {
    const ctx = { tsim: sim.t, maintenant: performance.now(), monde: sim.monde, marche: enMarche };
    for (const el of schema.elements) { const T = TYPES[el.type]; if (T?.ondes) { g.save(); try { T.ondes(g, el, ctx); } catch (e) { el._erreur = 'ondes : ' + e.message; } g.restore(); } }
  }
  for (const f of schema.fils) {
    const c = sim && f._noeud !== undefined ? couleurTension(sim.v(f._noeud), vmax) : '#8a8a8a';
    D.trait(g, f.x1, f.y1, f.x2, f.y2, f === selection ? COUL.selection : c, f === selection ? 4 : 2.5);
    if (points && Math.abs(f._i || 0) > 1e-9) D.points(g, f.x1, f.y1, f.x2, f.y2, f._cc || 0);
  }
  for (const el of schema.elements) if (!TYPES[el.type]?.mondePhysique) dessinerElement(g, el, rendu(el, sim, vmax), points);
  if (compil) { g.fillStyle = '#e8e8e8'; for (const [x, y] of compil.jonctions) { g.beginPath(); g.arc(x, y, 3.4, 0, 7); g.fill(); } }
  dessinerSondes();
  // sélection multiple : un cadre pointillé par objet
  if (groupe.size) {
    g.strokeStyle = COUL.selection; g.lineWidth = 1.5 / vue.z * 1.5; g.setLineDash([6 / vue.z, 4 / vue.z]);
    for (const o of groupe) {
      if (o.type === 'fil') { g.save(); g.lineWidth = 6; g.globalAlpha = 0.45; g.setLineDash([]); D.trait(g, o.x1, o.y1, o.x2, o.y2, COUL.selection, 6); g.restore(); }
      else { const b = boiteMonde(o); g.strokeRect(b[0] - 6, b[1] - 6, b[2] - b[0] + 12, b[3] - b[1] + 12); }
    }
    g.setLineDash([]);
  }
  if (geste?.type === 'cadre' && geste.bouge) {
    // gauche → droite : objets entièrement dedans (trait plein) ; droite → gauche : objets touchés (pointillés), comme KiCad
    const x0 = Math.min(geste.x0, geste.x1), y0 = Math.min(geste.y0, geste.y1), w = Math.abs(geste.x1 - geste.x0), h = Math.abs(geste.y1 - geste.y0);
    g.fillStyle = 'rgba(78,205,196,.08)'; g.fillRect(x0, y0, w, h);
    g.strokeStyle = COUL.selection; g.lineWidth = 1.2 / vue.z; g.setLineDash(geste.x1 < geste.x0 ? [6 / vue.z, 4 / vue.z] : []);
    g.strokeRect(x0, y0, w, h); g.setLineDash([]);
  }
  if (selection) {
    g.strokeStyle = COUL.selection; g.lineWidth = 1.5 / vue.z * 1.5; g.setLineDash([6 / vue.z, 4 / vue.z]);
    if (selection.type === 'fil') {
      g.setLineDash([]); g.fillStyle = COUL.selection;
      for (const [x, y] of [[selection.x1, selection.y1], [selection.x2, selection.y2]]) { g.beginPath(); g.arc(x, y, 6 / vue.z * 1.2, 0, 7); g.fill(); }
    } else { const b = boiteMonde(selection); g.strokeRect(b[0] - 6, b[1] - 6, b[2] - b[0] + 12, b[3] - b[1] + 12); }
    g.setLineDash([]);
  }
  if (geste && (geste.type === 'fil' || geste.type === 'depuis-point') && geste.bouge) {
    g.strokeStyle = COUL.selection; g.lineWidth = 2.5; g.setLineDash([5, 4]); g.beginPath();
    g.moveTo(geste.x0, geste.y0); g.lineTo(geste.x1, geste.y0); g.lineTo(geste.x1, geste.y1); g.stroke(); g.setLineDash([]);
  }
  if (modeFil && geste === null && dernierSurvol) {
    g.strokeStyle = COUL.selection; g.lineWidth = 1.5; g.beginPath(); g.arc(dernierSurvol[0], dernierSurvol[1], 5, 0, 7); g.stroke();
  }
  dessinerPastilles(dpr);
}
let dernierSurvol = null;

/* Cadres des sondes : chaque objet mesuré par l'oscilloscope est entouré d'un rectangle de la couleur de sa courbe
   (plusieurs courbes sur le même objet = rectangles emboîtés) ; une broche mesurée porte en plus un carré plein. */
function dessinerSondes() {
  const rang = new Map();
  for (const v of oscillo.voies) {
    const o = v.fil || v.el;
    if (v.fil ? !schema.fils.includes(o) : !schema.elements.includes(o)) continue;
    const k = rang.get(o) || 0; rang.set(o, k + 1);
    g.strokeStyle = v.coul; g.lineWidth = 2.2 / Math.min(vue.z, 1.6); g.setLineDash([]);
    if (v.fil) {
      const m = 7 + 5 * k;
      g.strokeRect(Math.min(o.x1, o.x2) - m, Math.min(o.y1, o.y2) - m, Math.abs(o.x2 - o.x1) + 2 * m, Math.abs(o.y2 - o.y1) + 2 * m);
      continue;
    }
    const b = boiteMonde(o), m = 10 + 5 * k;
    g.strokeRect(b[0] - m, b[1] - m, b[2] - b[0] + 2 * m, b[3] - b[1] + 2 * m);
    if (v.broche !== null && v.broche !== undefined) {
      const p = schema.broches(o)[v.broche];
      if (p) { g.fillStyle = v.coul; g.fillRect(p.x - 5, p.y - 5, 10, 10); }
    }
  }
}

/* ---------- Oscilloscope ----------
   Pas de limite au nombre de courbes. Chaque courbe appartient à un GRAPHE (groupe) : les courbes d'un même graphe
   partagent l'axe vertical. On les joint (glisser une étiquette sur un autre graphe, ou menu de l'étiquette) et on les
   dissocie (menu : « graphe à part »). Une nouvelle courbe rejoint le dernier graphe de même unité. */
function couleurLibre() {
  const prises = new Set(oscillo.voies.map(v => v.coul));
  const c = COUL_VOIES.find(c => !prises.has(c)); if (c) return c;
  for (let k = 0; ; k++) { const h = Math.round((k * 137.508 + 20) % 360), c2 = `hsl(${h} 85% 62%)`; if (!prises.has(c2)) return c2; }
}
function uniteVoie(v) {
  if (v.variable) { const d = (TYPES[v.el.type].variables || []).find(x => x.cle === v.variable); return (d?.type || 'num') === 'num' ? d?.unite ?? '' : ''; }
  return 'V';
}
const groupes = () => { const l = []; for (const v of oscillo.voies) if (!l.includes(v.groupe)) l.push(v.groupe); return l; };
function ajouterVoie(v) {
  if (oscillo.voies.some(w => w.el === v.el && w.fil === v.fil && (w.broche ?? null) === (v.broche ?? null) && (w.variable ?? null) === (v.variable ?? null))) {
    if (oscillo.masque) { oscillo.masque = false; majLegende(); }       // courbe déjà là : le bouton oscilloscope réaffiche l'écran masqué
    return;
  }
  v.coul = couleurLibre(); v.unite = uniteVoie(v);
  if (v.groupe === undefined || v.groupe === null) {
    const meme = [...oscillo.voies].reverse().find(w => w.unite === v.unite);
    v.groupe = meme ? meme.groupe : prochainGroupe++;
  } else prochainGroupe = Math.max(prochainGroupe, v.groupe + 1);
  v.data = new Float32Array(oscillo.N).fill(NaN); v.n = 0;
  oscillo.voies.push(v); oscillo.visible = true; oscillo.masque = false; majLegende(); sauvegarder();
}
function nomVoie(v) {
  if (v.fil) return 'fil';
  if (v.variable) return v.el.nom + '·' + ((TYPES[v.el.type].variables || []).find(x => x.cle === v.variable)?.nom || v.variable);
  return v.el.nom + (v.brocheNom ? '·' + (TYPES[v.el.type].def?.broches.find(b => b.nom === v.brocheNom)?.etiquette || v.brocheNom) : '');
}
function voiesSerialisees() {
  // numéros de graphes renumérotés 1, 2, 3… dans l'ordre d'affichage
  const gs = groupes();
  return oscillo.voies.filter(v => !v.fil).map(v => ({ nom: v.el.nom, ...(v.brocheNom ? { broche: v.brocheNom } : {}), ...(v.variable ? { variable: v.variable } : {}), groupe: gs.indexOf(v.groupe) + 1 }));
}
/** lignes de l'affichage : les graphes (groupes), ou une ligne par courbe en mode cascade */
function lignesOscillo() {
  if (oscillo.analyse.mode === 'cascade') return oscillo.voies.map(v => [v]);
  return groupes().map(g => oscillo.voies.filter(v => v.groupe === g));
}
function hauteurGraphe() {
  const n = lignesOscillo().length;
  return n <= 1 ? 190 : Math.max(96, Math.min(150, Math.floor((window.innerHeight * 0.62) / n)));
}
function joindre(v, gid) { v.groupe = gid; majLegende(); sauvegarder(); }
function majLegende() {
  const l = $('#osc-legende'); l.innerHTML = '';
  const gs = groupes(), L = lignesOscillo(), h = hauteurGraphe();
  L.forEach((voies, k) => {
    const ligne = el_('div', { class: 'leg-groupe' }); ligne.style.top = (k * h + 6) + 'px';
    for (const v of voies) {
      const b = el_('button', { class: 'voie', draggable: 'true', title: 'Clic : retirer, dissocier ou joindre · glisser sur un autre graphe : joindre' }, nomVoie(v));
      b.style.setProperty('--c', v.coul);
      b.onclick = e => { e.stopPropagation(); menuVoie(v, b); };
      b.ondragstart = e => { e.dataTransfer.setData('text/plain', String(oscillo.voies.indexOf(v))); e.dataTransfer.effectAllowed = 'move'; };
      ligne.append(b);
    }
    l.append(ligne);
  });
  const vis = oscillo.visible && oscillo.voies.length > 0 && !oscillo.masque;
  const bureau = bureauActif();
  $('#oscillo').classList.toggle('bureau', bureau);
  $('#oscillo').style.height = bureau ? '' : (L.length ? L.length * h : 190) + 'px';
  if (bureau) G.FrWAOscilloBureau.rafraichir();
  $('#oscillo').hidden = !vis;
  $('#osc-analyse').classList.toggle('actif', oscillo.analyse.mode !== 'temps');
  $('#osc-joindre').hidden = gs.length < 2 || oscillo.analyse.mode === 'cascade'; $('#osc-dissocier').hidden = oscillo.voies.length < 2 || gs.length === oscillo.voies.length;
  $('#osc-montrer').hidden = !(oscillo.masque && oscillo.visible && oscillo.voies.length > 0);
}
function fermerMenus() { for (const id of ['#menu-voie', '#menu-contexte']) $(id).hidden = true; }
function menuVoie(v, ancre) {
  const m = $('#menu-voie'); m.innerHTML = ''; fermerMenus();
  const item = (txt, fn) => m.append(el_('button', { class: 'mc-item', onclick: () => { m.hidden = true; fn(); } }, el_('span', {}, txt)));
  m.append(el_('div', { class: 'mc-titre' }, nomVoie(v)));
  item('Retirer la courbe', () => { oscillo.voies = oscillo.voies.filter(w => w !== v); majLegende(); sauvegarder(); });
  if (oscillo.voies.filter(w => w.groupe === v.groupe).length > 1) item('Dissocier : graphe à part', () => joindre(v, prochainGroupe++));
  groupes().forEach((gid, k) => {
    if (gid === v.groupe) return;
    const noms = oscillo.voies.filter(w => w.groupe === gid).map(nomVoie).join(', ');
    item(`Joindre au graphe ${k + 1} (${noms})`, () => joindre(v, gid));
  });
  const r = ancre.getBoundingClientRect();
  m.hidden = false; m.style.left = Math.min(r.left, window.innerWidth - m.offsetWidth - 8) + 'px'; m.style.top = (r.bottom + 4) + 'px';
}
function dessinerOscillo() {
  if ($('#oscillo').hidden) return;
  if (bureauActif()) { G.FrWAOscilloBureau.dessiner(); return; }
  const dpr = window.devicePixelRatio || 1, W = oscToile.clientWidth, H = oscToile.clientHeight;
  if (oscToile.width !== Math.round(W * dpr) || oscToile.height !== Math.round(H * dpr)) { oscToile.width = Math.round(W * dpr); oscToile.height = Math.round(H * dpr); }
  og.setTransform(dpr, 0, 0, dpr, 0, 0); og.fillStyle = '#050707'; og.fillRect(0, 0, W, H);
  if (oscillo.analyse.mode !== 'temps') { dessinerAnalyse(W, H); return; }
  const gs = groupes(), hG = H / Math.max(1, gs.length);
  gs.forEach((gid, kg) => {
    const voies = oscillo.voies.filter(v => v.groupe === gid), top = kg * hG;
    const unites = [...new Set(voies.map(v => v.unite))], unite = unites.length === 1 ? unites[0] : '';
    let mn = Infinity, mx = -Infinity;
    for (const v of voies) for (const x of v.data) if (Number.isFinite(x)) { mn = Math.min(mn, x); mx = Math.max(mx, x); }
    if (!Number.isFinite(mn)) { mn = 0; mx = 1; }
    if (mx - mn < 1e-3) { mx += 0.5; mn -= 0.5; }
    const marge = (mx - mn) * 0.08; mn -= marge; mx += marge;
    const haut = top + 26, bas = top + hG - 12;
    const g0 = 70, gW = W - g0 - 14, y = v => haut + (bas - haut) * (1 - (v - mn) / (mx - mn));
    if (kg > 0) { og.strokeStyle = '#2c3d3b'; og.lineWidth = 1; og.beginPath(); og.moveTo(0, top + 0.5); og.lineTo(W, top + 0.5); og.stroke(); }
    og.strokeStyle = '#1a2422'; og.lineWidth = 1;
    for (let k = 0; k <= 10; k++) { const x = g0 + gW * k / 10; og.beginPath(); og.moveTo(x, haut - 2); og.lineTo(x, bas); og.stroke(); }
    for (let k = 0; k <= 4; k++) { const yy = haut + (bas - haut) * k / 4; og.beginPath(); og.moveTo(g0, yy); og.lineTo(g0 + gW, yy); og.stroke(); }
    og.fillStyle = '#d7e4e2'; og.font = '600 12px ui-sans-serif, system-ui, sans-serif'; og.textAlign = 'left'; og.textBaseline = 'middle';
    for (const val of [mx - marge, (mx + mn) / 2, mn + marge]) og.fillText(formater(Math.abs(val) < (mx - mn) * 1e-6 ? 0 : val, unite), 6, y(val));   // pas de « 41 nrad/s » pour un zéro arrondi
    if (kg === gs.length - 1) { og.fillStyle = '#7d908d'; og.font = '11px ui-sans-serif, system-ui, sans-serif'; og.textAlign = 'right'; og.fillText(formater(oscillo.fenetre / 10, 's') + ' / div', g0 + gW, H - 4); }
    for (const v of voies) {
      const N = oscillo.N, n = Math.min(v.n, N); if (n < 2) continue;
      og.strokeStyle = v.coul; og.lineWidth = 2; og.beginPath();
      let premier = true, dernier = null;
      for (let k = 0; k < n; k++) {
        const val = v.data[(v.n - n + k) % N]; if (!Number.isFinite(val)) { premier = true; continue; }
        const x = g0 + gW * (k + N - n) / (N - 1), yy = y(val);
        if (premier) { og.moveTo(x, yy); premier = false; } else og.lineTo(x, yy);
        dernier = [x, yy];
      }
      og.stroke();
      if (dernier) { og.fillStyle = v.coul; og.beginPath(); og.arc(dernier[0], dernier[1], 4, 0, 7); og.fill(); }
    }
  });
}
/* ---------- Analyse en fréquence : spectre et cascade (FFT de static/spectre.js) ----------
   Chaque courbe garde les « taille » derniers points, échantillonnés tous les k pas (fe = 1 / (k·dt), réglable) ;
   le spectre est l'amplitude crête de chaque raie (dBV pour une tension). Cascade : une ligne de spectre toutes les
   taille / 2 nouvelles valeurs, la plus récente en haut, couleur = niveau sur la dynamique choisie. */
function razSpectre(v) { v.spec = null; v.nSpec = 0; v.nCalc = -1; v.moy = null; v.casc = null; }
function reglerAnalyse(o) {
  Object.assign(oscillo.analyse, o);
  for (const v of oscillo.voies) razSpectre(v);
  oscillo.kSpec = 0; majLegende(); sauvegarder();
}
function bornesFreq() {
  const A = oscillo.analyse, fe = oscillo.feEff || (compil ? 1 / compil.sim.dt : 1e3), df = fe / A.taille;
  const fmax = Math.min(fe / 2, A.fmax > 0 ? A.fmax : fe / 2), fmin = A.axe === 'log' ? Math.min(fmax / 10, Math.max(df, fmax / 1e5)) : 0;
  const xf = (f, g0, gW) => (A.axe === 'log' ? g0 + gW * Math.log(Math.max(f, fmin) / fmin) / Math.log(fmax / fmin) : g0 + gW * f / fmax);
  const fx = (t) => (A.axe === 'log' ? fmin * Math.pow(fmax / fmin, t) : t * fmax);   // t de 0 à 1
  return { fe, df, fmin, fmax, xf, fx };
}
const versDb = a => 20 * Math.log10(Math.max(a, 1e-15));
function echantillonnerSpectre(sim) {
  const A = oscillo.analyse, k = A.fe > 0 ? Math.max(1, Math.round(1 / (A.fe * sim.dt))) : 1;
  oscillo.feEff = 1 / (k * sim.dt);
  if ((oscillo.kSpec++) % k) return;
  const N = A.taille;
  for (const v of oscillo.voies) {
    if (!v.spec || v.spec.length !== N) { v.spec = new Float32Array(N); v.nSpec = 0; v.nCalc = -1; v.moy = null; v.casc = null; }
    v.spec[v.nSpec % N] = mesurerVoie(v, sim); v.nSpec++;
    if (A.mode === 'cascade' && v.nSpec >= N && v.nSpec % (N / 2) === 0) ligneCascade(v);
  }
}
/** spectre (moyenné si demandé) d'une courbe, recalculé seulement s'il y a de nouveaux points */
function spectreVoie(v) {
  const A = oscillo.analyse;
  if (!v.spec || v.nSpec < A.taille) return null;
  if (v.nCalc !== v.nSpec) {
    const s = G.FrWASpectre.spectre(v.spec, v.nSpec, A.fenetre);
    if (A.moyenne > 0 && v.moy && v.moy.length === s.length) for (let k = 0; k < s.length; k++) v.moy[k] = v.moy[k] * A.moyenne + s[k] * (1 - A.moyenne);
    else v.moy = s;
    v.nCalc = v.nSpec;
  }
  return v.moy;
}
function ligneCascade(v) {
  const A = oscillo.analyse, s = G.FrWASpectre.spectre(v.spec, v.nSpec, A.fenetre); if (!s) return;
  const L = 512, Hc = 240, B = bornesFreq();
  if (!v.casc) { const t = document.createElement('canvas'); t.width = L; t.height = Hc; v.casc = { toile: t, g: t.getContext('2d'), haut: -Infinity, lignes: 0 }; v.casc.g.fillStyle = '#000'; v.casc.g.fillRect(0, 0, L, Hc); }
  const c = v.casc, ligne = c.g.createImageData(L, 1), col = new Float64Array(L);
  let mx = -Infinity;
  for (let x = 0; x < L; x++) {
    const k0 = Math.max(1, Math.floor(B.fx(x / L) / B.df)), k1 = Math.max(k0, Math.min(s.length - 1, Math.floor(B.fx((x + 1) / L) / B.df)));
    let a = 0; for (let k = k0; k <= k1 && k < s.length; k++) a = Math.max(a, s[k]);
    col[x] = A.echelle === 'dB' ? versDb(a) : a; mx = Math.max(mx, col[x]);
  }
  c.haut = A.echelle === 'dB' ? Math.max(Math.ceil(mx / 10) * 10, c.haut - 1) : Math.max(mx, c.haut * 0.98);   // haut d'échelle qui suit le niveau
  for (let x = 0; x < L; x++) {
    const t = A.echelle === 'dB' ? (col[x] - (c.haut - A.dyn)) / A.dyn : col[x] / (c.haut || 1);
    const [r, g, b] = G.FrWASpectre.couleur(t); ligne.data.set([r, g, b, 255], x * 4);
  }
  c.g.drawImage(c.toile, 0, 0, L, Hc - 1, 0, 1, L, Hc - 1);           // défilement vers le bas
  c.g.putImageData(ligne, 0, 0); c.lignes++;
}
function graduationsFreq(B) {
  const l = [];
  if (oscillo.analyse.axe === 'log') {
    for (let e = Math.floor(Math.log10(B.fmin)); e <= Math.ceil(Math.log10(B.fmax)); e++) for (const m of [1, 2, 5]) { const f = m * 10 ** e; if (f >= B.fmin * 0.999 && f <= B.fmax * 1.001) l.push(f); }
  } else {
    const brut = B.fmax / 8, p = 10 ** Math.floor(Math.log10(brut)), pas = [1, 2, 5, 10].map(m => m * p).find(x => x >= brut);
    for (let f = 0; f <= B.fmax * 1.001; f += pas) l.push(f);
  }
  return l;
}
function dessinerAnalyse(W, H) {
  const A = oscillo.analyse, L = lignesOscillo(), hL = H / Math.max(1, L.length), B = bornesFreq(), g0 = 70, gW = W - g0 - 14;
  const grad = graduationsFreq(B);
  og.font = '600 12px ui-sans-serif, system-ui, sans-serif'; og.textBaseline = 'middle';
  L.forEach((voies, kl) => {
    const top = kl * hL, haut = top + 26, bas = top + hL - (kl === L.length - 1 ? 22 : 12);
    const unite = voies[0]?.unite || '', uDb = unite === 'V' ? 'dBV' : 'dB' + unite;
    if (kl > 0) { og.strokeStyle = '#2c3d3b'; og.lineWidth = 1; og.beginPath(); og.moveTo(0, top + 0.5); og.lineTo(W, top + 0.5); og.stroke(); }
    if (A.mode === 'cascade') {
      const v = voies[0], c = v?.casc;
      if (c) { og.imageSmoothingEnabled = true; og.drawImage(c.toile, g0, haut, gW, bas - haut); }
      else { og.fillStyle = '#7d908d'; og.textAlign = 'left'; og.fillText(`en attente de ${A.taille} points…`, g0 + 8, (haut + bas) / 2); }
      og.fillStyle = '#d7e4e2'; og.textAlign = 'left';
      if (c && Number.isFinite(c.haut)) {
        og.fillText(A.echelle === 'dB' ? `${c.haut} ${uDb}` : formater(c.haut, unite), 6, haut + 6);
        og.fillText(A.echelle === 'dB' ? `${c.haut - A.dyn}` : '0', 6, bas - 6);
        const duree = Math.min(c.lignes, c.toile.height) * (A.taille / 2) / B.fe;
        og.fillStyle = '#7d908d'; og.font = '11px ui-sans-serif, system-ui, sans-serif'; og.fillText('↑ ' + formater(duree, 's'), 6, (haut + bas) / 2); og.font = '600 12px ui-sans-serif, system-ui, sans-serif';
      }
    } else {
      const specs = voies.map(v => [v, spectreVoie(v)]).filter(x => x[1]);
      const kmax = Math.floor(B.fmax / B.df), k0 = A.axe === 'log' ? Math.max(1, Math.ceil(B.fmin / B.df)) : 1;
      let mx = -Infinity;
      for (const [, s] of specs) for (let k = k0; k <= kmax && k < s.length; k++) mx = Math.max(mx, A.echelle === 'dB' ? versDb(s[k]) : s[k]);
      let yHaut, yBas;
      if (A.echelle === 'dB') { yHaut = Number.isFinite(mx) ? Math.ceil(mx / 10) * 10 : 0; yBas = yHaut - A.dyn; } else { yHaut = Number.isFinite(mx) && mx > 0 ? mx * 1.1 : 1; yBas = 0; }
      const y = val => haut + (bas - haut) * (1 - (val - yBas) / (yHaut - yBas));
      og.strokeStyle = '#1a2422'; og.lineWidth = 1;
      const pasDb = A.dyn <= 60 ? 10 : 20;
      const lignesY = A.echelle === 'dB' ? Array.from({ length: Math.floor(A.dyn / pasDb) + 1 }, (_, i) => yHaut - i * pasDb) : [0, 1, 2, 3, 4].map(i => yBas + (yHaut - yBas) * i / 4);
      for (const v of lignesY) { og.beginPath(); og.moveTo(g0, y(v)); og.lineTo(g0 + gW, y(v)); og.stroke(); }
      for (const f of grad) { const x = B.xf(f, g0, gW); og.beginPath(); og.moveTo(x, haut - 2); og.lineTo(x, bas); og.stroke(); }
      og.fillStyle = '#d7e4e2'; og.textAlign = 'left';
      for (const v of lignesY) if (y(v) > haut + 6 || v === yHaut) og.fillText(A.echelle === 'dB' ? `${v}${v === yHaut ? ' ' + uDb : ''}` : formater(v, unite), 6, y(v));
      og.save(); og.beginPath(); og.rect(g0, haut - 2, gW, bas - haut + 4); og.clip();
      for (const [v, s] of specs) {
        og.strokeStyle = v.coul; og.lineWidth = 1.6; og.beginPath();
        let px = null, pv = -Infinity, premier = true;
        const tracer = () => { if (px === null) return; const yy = y(Math.max(yBas - 10, pv)); if (premier) { og.moveTo(px, yy); premier = false; } else og.lineTo(px, yy); };
        for (let k = k0; k <= kmax && k < s.length; k++) {
          const x = Math.round(B.xf(k * B.df, g0, gW)), a = A.echelle === 'dB' ? versDb(s[k]) : s[k];
          if (x !== px) { tracer(); px = x; pv = a; } else pv = Math.max(pv, a);
        }
        tracer(); og.stroke();
      }
      og.restore();
      // pic de la première courbe
      const [v0, s0] = specs[0] || [];
      if (s0) {
        let kp = k0; for (let k = k0; k <= kmax && k < s0.length; k++) if (s0[k] > s0[kp]) kp = k;
        const x = B.xf(kp * B.df, g0, gW), a = A.echelle === 'dB' ? versDb(s0[kp]) : s0[kp];
        og.fillStyle = v0.coul; og.beginPath(); og.moveTo(x, y(a) - 3); og.lineTo(x - 5, y(a) - 11); og.lineTo(x + 5, y(a) - 11); og.fill();
        og.textAlign = 'right'; og.font = '11px ui-sans-serif, system-ui, sans-serif';
        og.fillText(`pic ${formater(kp * B.df, 'Hz')} · ${A.echelle === 'dB' ? a.toFixed(1) + ' ' + uDb : formater(a, unite)}`, g0 + gW, top + 14);
        og.font = '600 12px ui-sans-serif, system-ui, sans-serif';
      }
    }
    if (A.mode === 'cascade') { og.strokeStyle = 'rgba(255,255,255,.18)'; og.lineWidth = 1; for (const f of grad) { const x = B.xf(f, g0, gW); og.beginPath(); og.moveTo(x, bas); og.lineTo(x, bas + 4); og.stroke(); } }
  });
  // axe des fréquences et réglages, en bas
  og.fillStyle = '#7d908d'; og.font = '11px ui-sans-serif, system-ui, sans-serif'; og.textAlign = 'center'; og.textBaseline = 'alphabetic';
  let dernierX = -Infinity;
  for (const f of grad) { const x = B.xf(f, g0, gW); if (x - dernierX < 44) continue; og.fillText(formater(f, 'Hz'), x, H - 6); dernierX = x; }
  og.textAlign = 'left';
  og.fillText(`N ${A.taille} · Δf ${formater(B.df, 'Hz')} · fe ${formater(B.fe, 'Hz')}`, 6, H - 6);
}
function menuAnalyse(ancre) {
  const m = $('#menu-voie'); m.innerHTML = ''; fermerMenus();
  const A = oscillo.analyse, fe = oscillo.feEff || (compil ? 1 / compil.sim.dt : 0);
  m.append(el_('div', { class: 'mc-titre' }, 'Oscilloscope : temps, spectre, cascade'));
  const choix = (titre, cle, options, nombre = true) => {
    const sel = el_('select');
    for (const [v, txt] of options) { const o = el_('option', { value: v }, txt); if (String(v) === String(A[cle])) o.selected = true; sel.append(o); }
    sel.onchange = () => reglerAnalyse({ [cle]: nombre ? Number(sel.value) : sel.value });
    m.append(el_('label', { class: 'mc-ligne' }, el_('span', {}, titre), sel));
  };
  choix('Affichage', 'mode', [['temps', 'Temporel'], ['spectre', 'Analyseur de spectre'], ['cascade', 'Cascade (waterfall)']], false);
  choix('Points de la FFT', 'taille', [256, 512, 1024, 2048, 4096, 8192, 16384, 32768].map(n => [n, String(n)]));
  choix('Échantillonnage', 'fe', [[0, `auto : 1 / pas${fe ? ' = ' + formater(1 / compil.sim.dt, 'Hz') : ''}`], ...[1e3, 8e3, 16e3, 48e3, 100e3, 1e6, 10e6, 100e6, 1e9].map(f => [f, formater(f, 'Hz')])]);
  choix('Fréquence max.', 'fmax', [[0, 'fe / 2'], ...[100, 1e3, 5e3, 10e3, 20e3, 100e3, 1e6, 10e6, 100e6].map(f => [f, formater(f, 'Hz')])]);
  choix('Axe des fréquences', 'axe', [['log', 'logarithmique'], ['lin', 'linéaire']], false);
  choix('Amplitude', 'echelle', [['dB', 'dB (dBV)'], ['lin', 'linéaire (crête)']], false);
  choix('Dynamique', 'dyn', [40, 60, 80, 100, 120, 160].map(d => [d, d + ' dB']));
  choix('Fenêtre', 'fenetre', Object.entries(G.FrWASpectre.FENETRES).map(([k, f]) => [k, f.nom]), false);
  choix('Moyenne (spectre)', 'moyenne', [[0, 'aucune'], [0.5, 'faible'], [0.8, 'moyenne'], [0.95, 'forte']]);
  m.append(el_('p', { class: 'mc-aide' }, 'Spectre : amplitude crête de chaque raie. Cascade : une ligne par demi-FFT, la plus récente en haut. Un pas de simulation plus petit élargit la bande analysable (fe / 2).'));
  const r = ancre.getBoundingClientRect();
  m.hidden = false;
  m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, window.innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = Math.max(8, r.top - m.offsetHeight - 6) + 'px';
}
/** menu « mesurer… » d'un élément : ses broches (tension) et ses variables publiées */
function choisirVoie(el) {
  const T = TYPES[el.type];
  const vars = T.variables || [];
  if (!(T.broches || []).length && !vars.length) { toast('Cet élément n’a ni broche ni variable à mesurer.'); return; }
  if (!vars.length && (T.dipole || T.broches.length < 2)) { ajouterVoie({ el, broche: T.dipole ? null : 0, brocheNom: T.dipole ? null : T.broches[0].nom }); return; }
  const m = $('#menu-broches'); m.innerHTML = ''; m.hidden = false;
  if (T.dipole) m.append(el_('button', { class: 'ov-mini', onclick: () => { ajouterVoie({ el, broche: null, brocheNom: null }); m.hidden = true; } }, 'Tension aux bornes'));
  else {
    m.append(el_('div', { class: 'bloc-titre' }, 'Tension de la broche…'));
    (T.def?.broches || T.broches).forEach((b, i) => m.append(el_('button', { class: 'ov-mini', onclick: () => { ajouterVoie({ el, broche: i, brocheNom: b.nom }); m.hidden = true; } }, b.etiquette || b.nom)));
  }
  if (vars.length) {
    m.append(el_('div', { class: 'bloc-titre' }, 'Variable publiée…'));
    for (const v of vars) m.append(el_('button', { class: 'ov-mini', onclick: () => { ajouterVoie({ el, variable: v.cle }); m.hidden = true; } }, v.nom + (v.unite ? ` (${v.unite})` : '')));
  }
}

/* ---------- Infos, statut, outils ---------- */
function majInfos() {
  const sim = compil?.sim, box = $('#infos');
  let l = [];
  if (selection && selection.type === 'fil') {
    l = ['Fil', sim ? `V = ${formater(sim.v(selection._noeud), 'V')}` : '', sim ? `I = ${formater(Math.abs(selection._i || 0), 'A')}` : ''];
  } else if (selection) {
    const T = TYPES[selection.type];
    l = [`${selection.nom} · ${T.nom}`];
    if (sim && T.infos) { try { l.push(...T.infos(selection, rendu(selection, sim, vmaxLisse))); } catch (e) { l.push('⚠ ' + e.message); } }
    else if (selection._erreur) l.push('⚠ ' + selection._erreur);
  }
  const txt = l.filter(Boolean).join('\n');
  if (box.textContent !== txt) box.textContent = txt;
  box.hidden = !txt;
  const st = $('#statut');
  let s = sim ? `t = ${formater(sim.t, 's')} · pas ${formater(sim.dt, 's')} · ×${String(vitesse).replace('.', ',')}` : '—';
  // mentions d'état sur leur propre ligne, au-dessus (place toujours réservée : la barre ne saute pas) ;
  // « ralenti » change plusieurs fois par seconde : gardé 1,5 s
  if (ralenti) ralentiVu = performance.now();
  const notes = [];
  if (sim && enMarche && performance.now() - ralentiVu < 1500) notes.push('ralenti (calcul trop lourd)');
  if (!enMarche) notes.push('en pause');
  if (erreurSim) s = '⚠ ' + erreurSim;
  else if (compil?.avertissement) notes.push(compil.avertissement);
  if (sim?.nonConvergences) notes.push(`${sim.nonConvergences} pas non convergés`);
  const al = $('#statut-alerte'), note = notes.join(' · ');
  if (note && al.textContent !== note) al.textContent = note;
  al.classList.toggle('visible', !!note);
  if (st.textContent !== s) { st.textContent = s; st.className = 'chip' + (erreurSim ? ' ko' : ''); }
}
function majOutils() {
  const multi = groupe.size > 0, el = !multi && selection && selection.type !== 'fil' ? selection : null;
  $('#actions').hidden = !selection && !multi;
  $('#a-reglages').hidden = $('#a-rotation').hidden = !el;
  $('#a-copier').hidden = !el && !multi;
  $('#a-oscillo').hidden = multi;
  $('#b-suppr').hidden = $('#b-copier').hidden = !selection && !multi;
  $('#b-coller').hidden = !pressePapier;
  $('#b-fil').classList.toggle('actif', modeFil);
  $('#b-pause').innerHTML = enMarche ? ICONES.pause : ICONES.lecture;
  majMolette();
  if (tiroirOuvert === 'reglages') ouvrirTiroir('reglages');
}

/* ---------- Molette ---------- */
const molette = { p: null, el: null, angle: null };
function paramPrincipal(el) {
  if (!el || el.type === 'fil') return null;
  const T = TYPES[el.type]; if (!T.principal) return null;
  const p = (T.params || []).find(p => p.cle === T.principal);
  return p && p.type !== 'bool' && p.type !== 'texte' ? p : null;
}
function fraction(p, v) {
  if (p.type === 'choix') return p.options.indexOf(v) / Math.max(1, p.options.length - 1);
  if (p.echelle === 'log') return (Math.log10(v) - Math.log10(p.min)) / (Math.log10(p.max) - Math.log10(p.min));
  return (v - p.min) / (p.max - p.min);
}
function majMolette() {
  const el = selection, p = paramPrincipal(el), m = $('#molette');
  if (!p) { m.hidden = true; return; }
  m.hidden = false; molette.p = p; molette.el = el;
  const v = el.params[p.cle], f = Math.max(0, Math.min(0.9999, fraction(p, v)));
  const R = 78, a0 = -Math.PI / 2, a1 = a0 + f * 2 * Math.PI;
  const x = 100 + R * Math.cos(a1), y = 100 + R * Math.sin(a1);
  const grand = f > 0.5 ? 1 : 0;
  $('#mol-arc').setAttribute('d', f < 0.001 ? '' : `M 100 22 A ${R} ${R} 0 ${grand} 1 ${x.toFixed(2)} ${y.toFixed(2)}`);
  $('#mol-bouton').setAttribute('cx', x.toFixed(2)); $('#mol-bouton').setAttribute('cy', y.toFixed(2));
  const t = p.type === 'choix' ? v : formater(v, p.unite);
  const [nb, ...u] = t.split(' ');
  const val = $('#mol-val');
  if (!val.querySelector('input')) val.innerHTML = `<span class="n">${nb}</span><span class="u">${u.join(' ')}</span><span class="nom">${p.nom}</span>`;
}
function arrondir(p, v) {
  if (p.echelle === 'log') { const e = Math.pow(10, Math.floor(Math.log10(v)) - 2); v = Math.round(v / e) * e; }
  else if (p.pas) v = Math.round(v / p.pas) * p.pas;
  v = Math.max(p.min, Math.min(p.max, v));
  return Number(v.toPrecision(6));
}
function tournerMolette(dA) {
  const p = molette.p, el = molette.el; if (!p || !el) return;
  const v = el.params[p.cle];
  if (p.type === 'choix') {
    molette.reste = (molette.reste || 0) + dA;
    const crans = Math.trunc(molette.reste / (Math.PI / 3)); if (!crans) return;
    molette.reste -= crans * Math.PI / 3;
    const i = (p.options.indexOf(v) + crans + p.options.length * 10) % p.options.length; el.params[p.cle] = p.options[i];
  } else if (p.echelle === 'log') el.params[p.cle] = arrondir(p, v * Math.pow(10, dA / (2 * Math.PI)));
  else el.params[p.cle] = arrondir(p, v + (p.pas || (p.max - p.min) / 200) * 40 * dA / (2 * Math.PI));
  majMolette(); sauvegarder();
}
function initMolette() {
  const m = $('#molette'), svg = m.querySelector('svg');
  const angle = e => { const r = svg.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); molette.angle = angle(e); molette.reste = 0; e.preventDefault(); });
  svg.addEventListener('pointermove', e => {
    if (molette.angle === null) return;
    const a = angle(e); let d = a - molette.angle; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    molette.angle = a; tournerMolette(d);
  });
  const fin = () => { molette.angle = null; };
  svg.addEventListener('pointerup', fin); svg.addEventListener('pointercancel', fin);
  svg.addEventListener('wheel', e => { e.preventDefault(); tournerMolette(-Math.sign(e.deltaY) * Math.PI / 12); }, { passive: false });
  $('#mol-val').addEventListener('click', () => {
    const p = molette.p, el = molette.el; if (!p || p.type === 'choix') return;
    const box = $('#mol-val'); if (box.querySelector('input')) return;
    box.innerHTML = '<input type="text" spellcheck="false">';
    const inp = box.querySelector('input'); inp.value = formater(el.params[p.cle], '').trim(); inp.focus(); inp.select();
    const valider = ok => {
      if (ok) { const v = lireValeur(inp.value); if (Number.isFinite(v)) { el.params[p.cle] = Math.max(p.min, Math.min(p.max, v)); sauvegarder(); } else toast('Valeur illisible (ex. 4,7k · 100n · 3.3)'); }
      box.innerHTML = ''; majMolette();
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') valider(true); if (e.key === 'Escape') valider(false); e.stopPropagation(); });
    inp.addEventListener('blur', () => valider(true));
  });
}

/* ---------- Gestes sur le plan de travail ---------- */
/** objets pris par le cadre : gauche → droite = entièrement dedans, droite → gauche = touchés (comme KiCad) */
function objetsDansCadre(ge) {
  const x0 = Math.min(ge.x0, ge.x1), y0 = Math.min(ge.y0, ge.y1), x1 = Math.max(ge.x0, ge.x1), y1 = Math.max(ge.y0, ge.y1);
  const touche = ge.x1 < ge.x0;
  const dedans = (a, b, c, d) => (touche ? a <= x1 && c >= x0 && b <= y1 && d >= y0 : a >= x0 && c <= x1 && b >= y0 && d <= y1);
  const l = new Set();
  for (const el of schema.elements) { const bx = boiteMonde(el); if (dedans(...bx)) l.add(el); }
  for (const f of schema.fils) if (dedans(Math.min(f.x1, f.x2), Math.min(f.y1, f.y2), Math.max(f.x1, f.x2), Math.max(f.y1, f.y2))) l.add(f);
  return l;
}
function debutGroupe(base) {
  const fils = [...groupe].filter(o => o.type === 'fil'), dansGroupe = new Set(fils);
  return {
    ...base, type: 'groupe',
    els: [...groupe].filter(o => o.type !== 'fil').map(el => ({ el, ox: el.x, oy: el.y, attaches: filsAttaches(el).filter(a => !dansGroupe.has(a.f)) })),
    fils: fils.map(f => ({ f, o: [f.x1, f.y1, f.x2, f.y2] })),
  };
}
function initGestes() {
  toile.addEventListener('contextmenu', e => e.preventDefault());
  toile.addEventListener('pointerdown', e => {
    fermerMenus();
    toile.setPointerCapture(e.pointerId);
    pointeurs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pointeurs.size === 2) {
      const [a, b] = [...pointeurs.values()];
      if (geste?.type === 'appui') TYPES[geste.el.type].relache?.(geste.el);
      geste = { type: 'pincer', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: vue.z, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, vx: vue.x, vy: vue.y };
      return;
    }
    const [wx, wy] = versMonde(e.offsetX, e.offsetY);
    const base = { sx: e.offsetX, sy: e.offsetY, bouge: false, vx: vue.x, vy: vue.y, wx, wy };
    // bouton du milieu ou droit : glisser = se déplacer ; clic droit sans glisser = menu contextuel
    if (e.button === 1 || e.button === 2) { geste = { ...base, type: 'pan', bouton: e.button }; return; }
    if (modeFil) { geste = { ...base, type: 'fil', x0: aimanter(wx), y0: aimanter(wy), x1: aimanter(wx), y1: aimanter(wy) }; return; }
    if (selection?.type === 'fil' && !groupe.size) {
      for (const bout of [1, 2]) if (Math.hypot(selection['x' + bout] - wx, selection['y' + bout] - wy) < 9 / vue.z) { geste = { ...base, type: 'extremite', f: selection, bout }; return; }
    }
    const el = elementSous(wx, wy), pt = pointProche(wx, wy);
    const T = el && TYPES[el.type];
    if (e.shiftKey) {                                    // Maj+clic : ajouter / retirer du groupe
      const o = el || filSous(wx, wy);
      if (o) { basculerGroupe(o); geste = null; return; }
    }
    if (el && groupe.size > 1 && groupe.has(el)) { geste = debutGroupe(base); return; }
    // poussoir, TTP223… : toucher = appuyer, même s'il est déjà sélectionné (sauf sur une de ses broches : on trace un fil).
    // Si le doigt glisse, l'appui est relâché et le composant est déplacé.
    if (el && T.appui && !(selection === el && pt)) { T.appui(el); selectionner(el); geste = { ...base, type: 'appui', el, ox: el.x, oy: el.y, attaches: filsAttaches(el) }; return; }
    if (pt) { geste = { ...base, type: 'depuis-point', x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y, o: pt.o }; return; }
    if (el) { geste = { ...base, type: 'element', el, ox: el.x, oy: el.y, attaches: filsAttaches(el) }; return; }
    const f = filSous(wx, wy);
    // souris sur le fond : cadre de sélection (sur écran tactile, glisser le fond déplace la vue)
    if (e.pointerType === 'mouse' && !f) { geste = { ...base, type: 'cadre', x0: wx, y0: wy, x1: wx, y1: wy }; return; }
    geste = { ...base, type: 'pan', f };
  });
  toile.addEventListener('pointermove', e => {
    if (pointeurs.has(e.pointerId)) pointeurs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    const [wx, wy] = versMonde(e.offsetX, e.offsetY);
    dernierSurvol = [aimanter(wx), aimanter(wy)]; sourisMonde = [wx, wy];
    if (!geste) {
      const el = elementSous(wx, wy), pt = pointProche(wx, wy);
      toile.style.cursor = modeFil || pt ? 'crosshair' : el ? (TYPES[el.type].appui || TYPES[el.type].clic ? 'pointer' : 'move') : 'default';
      return;
    }
    if (geste.type === 'pincer') {
      if (pointeurs.size < 2) return;
      const [a, b] = [...pointeurs.values()];
      const z = Math.max(0.3, Math.min(4, geste.z0 * Math.hypot(a.x - b.x, a.y - b.y) / geste.d0));
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      vue.x = cx - (geste.cx - geste.vx) * z / geste.z0; vue.y = cy - (geste.cy - geste.vy) * z / geste.z0; vue.z = z;
      return;
    }
    const dx = e.offsetX - geste.sx, dy = e.offsetY - geste.sy;
    if (!geste.bouge && Math.hypot(dx, dy) > 5) geste.bouge = true;
    if (!geste.bouge) return;
    if (geste.type === 'appui') { TYPES[geste.el.type].relache?.(geste.el); geste.type = 'element'; }
    switch (geste.type) {
      case 'pan': vue.x = geste.vx + dx; vue.y = geste.vy + dy; break;
      case 'cadre': geste.x1 = wx; geste.y1 = wy; break;
      case 'element': {
        const nx = aimanter(geste.ox + dx / vue.z), ny = aimanter(geste.oy + dy / vue.z);
        if (nx !== geste.el.x || ny !== geste.el.y) {
          geste.el.x = nx; geste.el.y = ny; suivreFils(geste.el, geste.attaches);
          if (!TYPES[geste.el.type].mondePhysique && geste.attaches.length) aCompiler = true;   // un objet du monde ou une puce sans fil se déplace sans relancer le calcul
        }
        break;
      }
      case 'groupe': {
        const ddx = aimanter(dx / vue.z), ddy = aimanter(dy / vue.z);
        for (const m of geste.els) { m.el.x = m.ox + ddx; m.el.y = m.oy + ddy; suivreFils(m.el, m.attaches); if (m.attaches.length) aCompiler = true; }
        for (const m of geste.fils) { m.f.x1 = m.o[0] + ddx; m.f.y1 = m.o[1] + ddy; m.f.x2 = m.o[2] + ddx; m.f.y2 = m.o[3] + ddy; }
        break;
      }
      case 'extremite': geste.f['x' + geste.bout] = aimanter(wx); geste.f['y' + geste.bout] = aimanter(wy); aCompiler = true; break;
      case 'fil': case 'depuis-point': geste.x1 = aimanter(wx); geste.y1 = aimanter(wy); break;
    }
  });
  toile.addEventListener('pointerleave', () => { if (!geste) sourisMonde = null; });
  const fin = e => {
    pointeurs.delete(e.pointerId);
    if (!geste) return;
    if (geste.type === 'pincer') { if (pointeurs.size === 0) geste = null; return; }
    const ge = geste; geste = null;
    switch (ge.type) {
      case 'appui': TYPES[ge.el.type].relache?.(ge.el); break;
      case 'depuis-point':
        if (ge.bouge) creerFils(ge.x0, ge.y0, ge.x1, ge.y1);
        else selectionner(ge.o);
        break;
      case 'fil': if (ge.bouge) creerFils(ge.x0, ge.y0, ge.x1, ge.y1); break;
      case 'element':
        if (ge.bouge) {
          if (TYPES[ge.el.type].mondePhysique) sauvegarder();
          else { const avant = schema.fils.length; schema.normaliser(); if (ge.attaches.length || schema.fils.length !== avant || schema.broches(ge.el).some(b => schema.fils.some(f => (f.x1 === b.x && f.y1 === b.y) || (f.x2 === b.x && f.y2 === b.y)))) modifie(); else sauvegarder(); }
        }
        else { const T = TYPES[ge.el.type]; if (T.clic && selection === ge.el) { T.clic(ge.el); sauvegarder(); } else if (T.clic && !T.principal) { T.clic(ge.el); sauvegarder(); } selectionner(ge.el); }
        break;
      case 'groupe':
        if (ge.bouge) { schema.normaliser(); for (const o of [...groupe]) if (o.type === 'fil' && !schema.fils.includes(o)) groupe.delete(o); modifie(); }
        else { const o = ge.els.find(m => boiteContient(m.el, ge.wx, ge.wy))?.el; if (o) selectionner(o); }
        break;
      case 'cadre': {
        if (!ge.bouge) { selectionner(null); break; }
        const l = objetsDansCadre(ge);
        selection = null; groupe = l;
        if (l.size === 1) { selection = [...l][0]; groupe = new Set(); }
        majOutils();
        break;
      }
      case 'extremite': schema.normaliser(); modifie(); break;
      case 'pan':
        if (ge.bouton === 2 && !ge.bouge) ouvrirMenuContexte(e.clientX, e.clientY, ge.wx, ge.wy);
        else if (!ge.bouge && ge.bouton === undefined) selectionner(ge.f || null);
        break;
    }
  };
  toile.addEventListener('pointerup', fin); toile.addEventListener('pointercancel', fin);
  toile.addEventListener('dblclick', e => { const [wx, wy] = versMonde(e.offsetX, e.offsetY); const el = elementSous(wx, wy); if (el) { selectionner(el); ouvrirTiroir('reglages'); } });
  toile.addEventListener('wheel', e => {
    e.preventDefault();
    const z = Math.max(0.3, Math.min(4, vue.z * Math.exp(-e.deltaY * 0.0015)));
    vue.x = e.offsetX - (e.offsetX - vue.x) * z / vue.z; vue.y = e.offsetY - (e.offsetY - vue.y) * z / vue.z; vue.z = z;
  }, { passive: false });
  let collageAttendu = 0;
  window.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select')) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.key === 'Delete' || e.key === 'Backspace') { supprimerSelection(); e.preventDefault(); }
    else if (ctrl && k === 'c') { copier(); e.preventDefault(); }
    else if (ctrl && k === 'x') { copier(true); e.preventDefault(); }
    // Ctrl+V : l'événement « paste » apporte le presse-papier du système ; sinon on colle le presse-papier interne
    else if (ctrl && k === 'v') { clearTimeout(collageAttendu); collageAttendu = setTimeout(() => coller(pressePapier, sourisMonde), 80); }
    else if (ctrl && k === 'a') { toutSelectionner(); e.preventDefault(); }
    else if (ctrl && k === 'd') { dupliquer(); e.preventDefault(); }
    else if (ctrl) return;
    else if (k === 'r') tournerSelection();
    else if (e.key === ' ') { basculerMarche(); e.preventDefault(); }
    else if (k === 'w') { modeFil = !modeFil; majOutils(); }
    else if (e.key === 'Escape') { fermerMenus(); if (tiroirOuvert) fermerTiroir(); else if (modeFil) { modeFil = false; majOutils(); } else selectionner(null); }
  });
  window.addEventListener('paste', e => {
    if (e.target.closest?.('input, textarea, select')) return;
    clearTimeout(collageAttendu);
    let d = null; try { d = JSON.parse(e.clipboardData?.getData('text') || ''); } catch (err) { /* pas un collage du simulateur */ }
    coller(d?.format === 'frwa-circuit-copie' ? d : pressePapier, sourisMonde);
    e.preventDefault();
  });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#menu-contexte, #menu-voie')) fermerMenus(); });
}
function boiteContient(el, wx, wy) { const b = boiteMonde(el); return wx >= b[0] && wx <= b[2] && wy >= b[1] && wy <= b[3]; }

/* ---------- Menu contextuel (clic droit) ---------- */
function ouvrirMenuContexte(cx, cy, wx, wy) {
  const el = elementSous(wx, wy), f = el ? null : filSous(wx, wy), cible = el || f;
  if (cible && !groupe.has(cible)) selectionner(cible);
  const objs = objetsSelectionnes(), seul = !groupe.size && selection && selection.type !== 'fil' ? selection : null;
  const m = $('#menu-contexte'); m.innerHTML = ''; fermerMenus();
  const item = (txt, touche, fn, actif = true) => m.append(el_('button', { class: 'mc-item' + (actif ? '' : ' inactif'), onclick: () => { m.hidden = true; if (actif) fn(); } }, el_('span', {}, txt), el_('kbd', {}, touche || '')));
  const sep = () => m.append(el_('hr'));
  if (objs.length > 1) m.append(el_('div', { class: 'mc-titre' }, `${objs.length} objets sélectionnés`));
  else if (cible) m.append(el_('div', { class: 'mc-titre' }, cible.type === 'fil' ? 'Fil' : `${cible.nom} · ${TYPES[cible.type].nom}`));
  item('Copier', 'Ctrl+C', () => copier(), objs.length > 0);
  item('Couper', 'Ctrl+X', () => copier(true), objs.length > 0);
  item('Dupliquer', 'Ctrl+D', dupliquer, objs.length > 0);
  item('Supprimer', 'Suppr', supprimerSelection, objs.length > 0);
  if (seul) {
    sep();
    item('Tourner', 'R', tournerSelection);
    item('Réglages…', 'double-clic', () => ouvrirTiroir('reglages'));
    item('Oscilloscope…', '', () => choisirVoie(seul));
    if (CONFIG.vue3d) item('Vue 3D (fenêtre)', '', () => ouvrirVue3D(seul));
  } else if (f && objs.length === 1) { sep(); item('Oscilloscope : tension du fil', '', () => ajouterVoie({ fil: f })); }
  sep();
  item('Tout sélectionner', 'Ctrl+A', toutSelectionner);
  m.hidden = false;
  m.style.left = Math.max(4, Math.min(cx, window.innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = Math.max(4, Math.min(cy, window.innerHeight - m.offsetHeight - 8)) + 'px';
}

/* ---------- Vue 3D : une fenêtre par module (vue3d.html), alimentée par messages ----------
   Règle R9 : la 3D n'est jamais calculée par le simulateur. Il envoie seulement l'état publié (positions, paramètres,
   variables, axes mécaniques) ; la fenêtre et ses extensions (extensions/3d/) construisent la scène. */
function ouvrirVue3D(el) {
  const w = window.open('vue3d.html#' + encodeURIComponent(el.nom), 'frwa3d_' + el.nom.replace(/\W/g, '_'), 'width=780,height=580');
  if (!w) { toast('Fenêtre bloquée par le navigateur : autorisez les fenêtres surgissantes pour cette page.', 'erreur'); return; }
  fenetres3d.set(el.nom, w); dernier3D = 0;
}
let dernier3D = 0;
function etat3D() {
  return {
    type: 'frwa-circuit-etat', regles: G.FrWARegles.VERSION, t: compil?.sim.t ?? 0, enMarche,
    axes: Object.fromEntries([...(schema._axes || new Map())].map(([k, a]) => [k, { angle: a.angle, vitesse: a.vitesse, couple: a.couple, pilote: a.pilote }])),
    elements: schema.elements.map(el => {
      const T = TYPES[el.type];
      return {
        nom: el.nom, type: el.type, typeNom: T.nom, x: el.x, y: el.y, rot: el.rot, params: JSON.parse(JSON.stringify(el.params)),
        boite: T.boiteDe(el), modele3d: T.modele3d ?? null, mecanique: T.mecanique || null,
        variables: Object.fromEntries((T.variables || []).map(v => [v.cle, el._etat?.[v.cle] ?? null])),
        definitionsVariables: T.variables || [],
      };
    }),
  };
}
function envoyer3D() {
  if (!fenetres3d.size) return;
  const t = performance.now(); if (t - dernier3D < 50) return; dernier3D = t;
  const msg = etat3D();
  for (const [nom, w] of fenetres3d) { if (w.closed) { fenetres3d.delete(nom); continue; } try { w.postMessage(msg, '*'); } catch (e) { fenetres3d.delete(nom); } }
}
window.addEventListener('message', e => {
  if (e.data?.type === 'frwa-vue3d-pret' && e.source) { fenetres3d.set(e.data.nom, e.source); dernier3D = 0; }
});
function basculerMarche() { enMarche = !enMarche; accumulateur = 0; majOutils(); }
function cadrer() {
  const xs = [], ys = [];
  for (const el of schema.elements) { const b = boiteMonde(el); xs.push(b[0], b[2]); ys.push(b[1], b[3]); for (const p of schema.broches(el)) { xs.push(p.x); ys.push(p.y); } }
  for (const f of schema.fils) { xs.push(f.x1, f.x2); ys.push(f.y1, f.y2); }
  const W = toile.clientWidth, H = toile.clientHeight;
  if (!xs.length) { vue = { x: W / 2, y: H / 2, z: 1.3 }; return; }
  const x0 = Math.min(...xs) - 40, x1 = Math.max(...xs) + 40, y0 = Math.min(...ys) - 50, y1 = Math.max(...ys) + 40;
  const z = Math.max(0.4, Math.min(2, Math.min((W - 160) / (x1 - x0), (H - 120) / (y1 - y0))));
  vue = { z, x: W / 2 - (x0 + x1) / 2 * z, y: H / 2 - (y0 + y1) / 2 * z };
}

/* ---------- Tiroir (bibliothèque, exemples, réglages, fichier, simulation, aide) ---------- */
let tiroirOuvert = null;
function fermerTiroir() { tiroirOuvert = null; $('#tiroir').hidden = true; }
function el_(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v); }
  for (const c of enfants.flat()) if (c !== null && c !== undefined) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
function apercuType(type, w = 84, h = 60) {
  const c = el_('canvas'); const dpr = window.devicePixelRatio || 1; c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
  const gc = c.getContext('2d'), T = TYPES[type];
  const el = { type, x: 0, y: 0, rot: 0, params: {} }; for (const p of T.params || []) el.params[p.cle] = p.defaut;
  const pts = (T.broches || []).map(b => [b.x, b.y]); const [bx0, by0, bx1, by1] = T.boiteDe(el);
  const x0 = Math.min(bx0, ...pts.map(p => p[0])) - 4, x1 = Math.max(bx1, ...pts.map(p => p[0])) + 4, y0 = Math.min(by0, ...pts.map(p => p[1])) - 4, y1 = Math.max(by1, ...pts.map(p => p[1])) + 4;
  const z = Math.min(w / (x1 - x0), h / (y1 - y0), 1.2);
  gc.setTransform(dpr * z, 0, 0, dpr * z, dpr * (w / 2 - (x0 + x1) / 2 * z), dpr * (h / 2 - (y0 + y1) / 2 * z));
  gc.lineCap = 'round'; gc.lineJoin = 'round';
  dessinerElement(gc, el, { vmax: 5, marche: false, v: () => 0, c: () => '#9a9a9a', i: () => 0 }, false);
  return c;
}
function apercuSchema(def, w = 120, h = 80) {
  const c = el_('canvas'); const dpr = window.devicePixelRatio || 1; c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
  const gc = c.getContext('2d'), s = new Schema(); s.charger(def);
  const xs = [], ys = [];
  for (const el of s.elements) for (const p of s.broches(el)) { xs.push(p.x); ys.push(p.y); }
  for (const f of s.fils) { xs.push(f.x1, f.x2); ys.push(f.y1, f.y2); }
  gc.fillStyle = '#000'; gc.fillRect(0, 0, c.width, c.height);
  if (!xs.length) return c;
  const x0 = Math.min(...xs) - 30, x1 = Math.max(...xs) + 30, y0 = Math.min(...ys) - 30, y1 = Math.max(...ys) + 30;
  const z = Math.min(w / (x1 - x0), h / (y1 - y0));
  gc.setTransform(dpr * z, 0, 0, dpr * z, dpr * (w / 2 - (x0 + x1) / 2 * z), dpr * (h / 2 - (y0 + y1) / 2 * z));
  gc.lineCap = 'round';
  for (const f of s.fils) D.trait(gc, f.x1, f.y1, f.x2, f.y2, '#3cd35a', 3);
  for (const el of s.elements) dessinerElement(gc, el, { vmax: 5, marche: false, v: () => 0, c: () => '#3cd35a', i: () => 0 }, false);
  return c;
}
/* R12 : bibliothèque triée par étiquettes. Un composant figure sous chacune de ses étiquettes (sauf « basic », qui sert
   au mode Basique) ; sans étiquette, il va dans « Autre ». Une famille de variantes (ex. nombre de positions) n'y
   apparaît qu'une fois : la variante se choisit ensuite dans ⚙ Réglages. */
const prefsBiblio = (() => { try { return JSON.parse(localStorage.getItem('frwa_circuit_biblio') || '{}'); } catch (e) { return {}; } })();
function garderPrefsBiblio() { try { localStorage.setItem('frwa_circuit_biblio', JSON.stringify(prefsBiblio)); } catch (e) { /* stockage indisponible */ } }
const tagsDe = T => (T.tags || []).filter(t => t !== 'basic');
function representants() {
  const vus = new Map();
  for (const T of Object.values(TYPES)) {
    if (T.cat === null || T.id === 'fil' || !typePropose(T)) continue;
    const f = T.famille?.id; if (!f) { vus.set(T.id, T); continue; }
    if (!vus.has('famille:' + f)) vus.set('famille:' + f, T);
  }
  return [...vus.values()];
}
function categories(types = representants()) {
  const R = G.FrWARegles, cats = new Map();
  for (const T of types) for (const t of tagsDe(T).length ? tagsDe(T) : ['autre']) { if (!cats.has(t)) cats.set(t, []); cats.get(t).push(T); }
  const connus = Object.keys(R.TAGS).filter(t => t !== 'basic');
  const ordre = [...connus, ...[...cats.keys()].filter(t => !connus.includes(t) && t !== 'autre').sort(), 'autre'];
  return ordre.filter(t => cats.has(t)).map(t => [t, t === 'autre' ? 'Autre' : R.nomTag(t), cats.get(t)]);
}
const PANNEAUX = {
  bibliotheque: { titre: 'Bibliothèque', remplir: remplirBibliotheque },
  exemples: { titre: 'Exemples', remplir: remplirExemples },
  reglages: { titre: 'Réglages', remplir: remplirReglages },
  fichier: { titre: 'Fichier', remplir: remplirFichier },
  simulation: { titre: 'Simulation', remplir: remplirSimulation },
  regles: { titre: 'Règles des composants', remplir: remplirRegles },
  aide: { titre: 'Aide', remplir: remplirAide },
};
function ouvrirTiroir(nom) {
  const P = PANNEAUX[nom]; if (!P) return;
  tiroirOuvert = nom; $('#tiroir').hidden = false; $('#tiroir-titre').textContent = P.titre;
  const corps = $('#tiroir-corps'); const defil = corps.scrollTop; corps.innerHTML = ''; P.remplir(corps); corps.scrollTop = defil;
}
function remplirBibliotheque(corps) {
  const recherche = el_('input', { type: 'text', placeholder: 'Rechercher (ex. 555, opto, régulateur)…', class: 'large', id: 'recherche' });
  // mode Basique / Tout (comme les widgets de base et ttk de tkinter)
  const mode = el_('div', { class: 'bascule-mode', role: 'radiogroup' });
  for (const [m, txt] of [['basic', 'Basique'], ['tout', 'Tout']]) {
    mode.append(el_('button', { class: 'btn petit' + ((prefsBiblio.mode || 'tout') === m ? ' actif' : ''), role: 'radio', onclick: () => { prefsBiblio.mode = m; garderPrefsBiblio(); ouvrirTiroir('bibliotheque'); } }, txt));
  }
  corps.append(el_('div', { class: 'ligne-recherche' }, recherche, mode));
  const tous = representants().filter(T => (prefsBiblio.mode || 'tout') === 'tout' || (T.tags || []).includes('basic'));
  const cats = categories(tous);
  const masques = new Set(prefsBiblio.masques || []);
  const filtre = el_('details', { class: 'filtre-tags' }, el_('summary', {}, `Étiquettes (${cats.length - cats.filter(([t]) => masques.has(t)).length} / ${cats.length})`));
  const cases = el_('div', { class: 'cases-tags' });
  for (const [t, nom, types] of cats) {
    const c = el_('input', { type: 'checkbox' }); c.checked = !masques.has(t);
    c.onchange = () => { if (c.checked) masques.delete(t); else masques.add(t); prefsBiblio.masques = [...masques]; garderPrefsBiblio(); afficher(); filtre.firstChild.textContent = `Étiquettes (${cats.length - masques.size} / ${cats.length})`; };
    cases.append(el_('label', {}, c, ` ${nom} `, el_('small', {}, String(types.length))));
  }
  cases.append(el_('div', { class: 'boutons' },
    el_('button', { class: 'btn petit', onclick: () => { prefsBiblio.masques = []; garderPrefsBiblio(); ouvrirTiroir('bibliotheque'); } }, 'Tout cocher'),
    el_('button', { class: 'btn petit', onclick: () => { prefsBiblio.masques = cats.map(([t]) => t); garderPrefsBiblio(); ouvrirTiroir('bibliotheque'); } }, 'Tout décocher')));
  filtre.append(cases); if (prefsBiblio.filtreOuvert) filtre.open = true;
  filtre.ontoggle = () => { prefsBiblio.filtreOuvert = filtre.open; garderPrefsBiblio(); };
  corps.append(filtre);
  const liste = el_('div');
  const afficher = () => {
    liste.innerHTML = ''; const q = recherche.value.trim().toLowerCase();
    for (const [t, nomCat, types] of cats) {
      if (masques.has(t) && !q) continue;
      const items = types.filter(T => !q || [T.nom, nomCat, T.sousCat || '', T.description || '', (T.tags || []).join(' '), T.famille?.nom || ''].join(' ').toLowerCase().includes(q))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
      if (!items.length) continue;
      liste.append(el_('div', { class: 'bloc-titre' }, `${nomCat} · ${items.length}`));
      const grille = el_('div', { class: 'grille-comp' });
      for (const T of items) {
        const nf = T.famille ? Object.values(TYPES).filter(U => U.famille?.id === T.famille.id).length : 0;
        grille.append(el_('button', { class: 'comp' + (T.origine?.startsWith('★') ? ' perso' : ''), title: T.description || T.nom, onclick: () => ajouterAuCentre(T.id) },
          apercuType(T.id), el_('span', {}, T.nom), nf > 1 ? el_('small', {}, `${nf} variantes (${T.famille.nom})`) : T.sousCat ? el_('small', {}, T.sousCat) : null));
      }
      liste.append(grille);
    }
    if (!liste.childElementCount) liste.append(el_('p', { class: 'aide' }, 'Aucun composant : cochez des étiquettes, passez en mode « Tout » ou changez la recherche.'));
  };
  recherche.addEventListener('input', afficher); afficher(); corps.append(liste);
  corps.append(el_('div', { class: 'bloc-titre' }, 'Mes puces (extensions)'));
  corps.append(el_('p', { class: 'aide' }, 'Une puce = un fichier ', el_('code', {}, '.puce.js'), ' ou ', el_('code', {}, '.puce.json'), '. Importez-le ici (ou glissez-le sur la page) : il est gardé dans ce navigateur.'));
  corps.append(el_('div', { class: 'boutons' },
    el_('button', { class: 'btn primaire', onclick: () => $('#f-puce').click() }, 'Importer une puce…'),
    el_('a', { class: 'btn', href: 'puces/MODELE.puce.js', download: 'ma_puce.puce.js' }, 'Télécharger le modèle')));
  const perso = pucesUtilisateur();
  if (perso.length) {
    const ul = el_('div', { class: 'liste-perso' });
    for (const u of perso) ul.append(el_('div', { class: 'ligne-perso' }, el_('span', {}, '★ ' + u.fichier), el_('button', { class: 'btn petit danger', onclick: () => { oublier(u.fichier); toast(`« ${u.fichier} » sera retiré au prochain chargement de la page.`); ouvrirTiroir('bibliotheque'); } }, 'Oublier')));
    corps.append(ul);
  }
  if (Puces.erreurs.length) corps.append(el_('pre', { class: 'erreurs' }, Puces.erreurs.join('\n')));
}
/** faux si l'exemple emploie un composant absent ou non proposé par cette page (pilotage externe sur le site web) */
function exempleUtilisable(ex) {
  let def = ex;
  if (ex.construire && !ex._fait) { try { def = ex.construire(); } catch (e) { return false; } } else def = ex._fait || ex;
  return (def.elements || []).every(e => TYPES[e.type] && typePropose(TYPES[e.type]));
}
function remplirExemples(corps) {
  corps.append(el_('p', { class: 'aide' }, 'Cliquez un exemple pour le charger (le circuit en cours est remplacé ; exportez-le d\'abord dans Fichier si besoin).'));
  for (const ex of EXEMPLES) {
    if (!exempleUtilisable(ex)) continue;
    corps.append(el_('div', { class: 'carte ex', onclick: () => { chargerSchema(ex); fermerTiroir(); } },
      apercuSchema(resoudreExemple(ex)), el_('div', {}, el_('div', { class: 'n' }, ex.titre), el_('div', { class: 'd' }, ex.description))));
  }
}
function champParam(el, p) {
  const v = el.params[p.cle];
  const maj = () => { sauvegarder(); majMolette(); };
  if (p.type === 'bool') { const i = el_('input', { type: 'checkbox' }); i.checked = !!v; i.onchange = () => { el.params[p.cle] = i.checked; maj(); }; return i; }
  if (p.type === 'texte') { const i = el_('input', { type: 'text', class: 'large' }); i.value = v ?? ''; i.onchange = () => { el.params[p.cle] = i.value; maj(); }; return i; }
  if (p.type === 'choix') { const s = el_('select'); for (const o of p.options) { const op = el_('option', { value: o }, o); if (o === v) op.selected = true; s.append(op); } s.onchange = () => { el.params[p.cle] = s.value; maj(); }; return s; }
  const i = el_('input', { type: 'text', spellcheck: 'false' }); i.value = formater(v, '').trim();
  i.onchange = () => { const x = lireValeur(i.value); if (Number.isFinite(x)) { el.params[p.cle] = Math.max(p.min ?? -Infinity, Math.min(p.max ?? Infinity, x)); maj(); } else toast('Valeur illisible'); i.value = formater(el.params[p.cle], '').trim(); };
  return i;
}
/** remplace un composant par une autre variante de sa famille (même nom, même place, paramètres communs gardés) */
function changerVariante(el, type) {
  const U = TYPES[type]; if (!U || el.type === type) return;
  const params = {}; for (const p of U.params || []) params[p.cle] = p.cle in el.params ? el.params[p.cle] : p.defaut;
  el.type = type; el.params = params; el._etat = null; el._entrees = {}; el._hasard = null;
  oscillo.voies = oscillo.voies.filter(v => v.el !== el || v.variable); majLegende();
  aCompiler = true; sauvegarder(); ouvrirTiroir('reglages');
}
function remplirReglages(corps) {
  const el = selection;
  if (!el || el.type === 'fil') { corps.append(el_('p', { class: 'aide' }, 'Sélectionnez un composant pour le régler.')); return; }
  const T = TYPES[el.type];
  const nom = el_('input', { type: 'text', class: 'large' }); nom.value = el.nom;
  nom.onchange = () => { const n = nom.value.trim(); if (n && !schema.elements.some(e => e !== el && e.nom === n)) { el.nom = n; sauvegarder(); majLegende(); } else nom.value = el.nom; };
  corps.append(el_('div', { class: 'ov-ligne' }, el_('span', {}, 'Nom'), nom));
  corps.append(el_('div', { class: 'ov-ligne' }, el_('span', {}, 'Type'), el_('b', {}, T.nom)));
  if (T.famille) {
    const freres = Object.values(TYPES).filter(U => U.famille?.id === T.famille.id).sort((x, y) => x.famille.valeur.localeCompare(y.famille.valeur, 'fr', { numeric: true }));
    const sel = el_('select'); for (const U of freres) { const o = el_('option', { value: U.id }, U.famille.valeur); if (U.id === el.type) o.selected = true; sel.append(o); }
    sel.onchange = () => changerVariante(el, sel.value);
    corps.append(el_('div', { class: 'ov-ligne' }, el_('span', {}, T.famille.nom), sel));
  }
  if ((T.tags || []).length) corps.append(el_('div', { class: 'ov-ligne' }, el_('span', {}, 'Étiquettes'), el_('span', { class: 'sous' }, T.tags.map(G.FrWARegles.nomTag).join(', '))));
  for (const p of T.params || []) corps.append(el_('div', { class: 'ov-ligne' }, el_('span', {}, p.nom + (p.unite ? ` (${p.unite})` : '')), champParam(el, p)));
  corps.append(el_('div', { class: 'boutons' }, CONFIG.vue3d ? el_('button', { class: 'btn petit', onclick: () => ouvrirVue3D(el) }, 'Vue 3D (fenêtre)') : null, el_('button', { class: 'btn petit', onclick: () => choisirVoie(el) }, 'Oscilloscope…')));
  if (T.puce) {
    const d = T.def;
    if (d.description) corps.append(el_('p', { class: 'aide' }, d.description));
    corps.append(el_('div', { class: 'bloc-titre' }, 'Brochage'));
    const tab = el_('table', { class: 'brochage' }, el_('tr', {}, el_('th', {}, 'N°'), el_('th', {}, 'Broche'), el_('th', {}, 'Oscillo')));
    d.broches.forEach((b, i) => tab.append(el_('tr', {}, el_('td', {}, String(b.num)), el_('td', {}, b.etiquette),
      el_('td', {}, el_('button', { class: 'ov-mini', onclick: () => ajouterVoie({ el, broche: i, brocheNom: b.nom }) }, '+ voie')))));
    corps.append(tab);
    if ((T.variables || []).length) {
      corps.append(el_('div', { class: 'bloc-titre' }, 'Variables publiées (R7)'));
      const tv = el_('table', { class: 'brochage' }, el_('tr', {}, el_('th', {}, 'Variable'), el_('th', {}, 'Valeur'), el_('th', {}, 'Oscillo')));
      for (const v of T.variables) tv.append(el_('tr', {}, el_('td', {}, v.nom), el_('td', { 'data-variable': v.cle }, texteVariable(v, el._etat?.[v.cle])),
        el_('td', {}, el_('button', { class: 'ov-mini', onclick: () => ajouterVoie({ el, variable: v.cle }) }, '+ voie'))));
      corps.append(tv);
    }
    const tb = T.typesBroches || {};
    corps.append(el_('p', { class: 'sous' }, `Version ${T.version || '?'} · règles v${T.def.regles} · modèle 3D : ${T.modele3d?.step || 'aucun fichier STEP'}`
      + (T.mecanique ? ` · axes : ${[...(T.mecanique.pilote || []), ...(T.mecanique.lit || [])].map(a => el.params[a.slice(1)]).join(', ')}` : '')));
    corps.append(el_('p', { class: 'sous' }, 'Types de broches : ' + Object.entries(tb).map(([t, l]) => `${t} (${l.length})`).join(', ')));
    corps.append(el_('p', { class: 'sous' }, 'Fichier : ' + T.origine));
    if (el._erreur) corps.append(el_('pre', { class: 'erreurs' }, el._erreur));
  }
}
function remplirFichier(corps) {
  if (!CONFIG.stockage) {
    // site web : rien n'est gardé dans le navigateur, un circuit s'enregistre et se rouvre comme un fichier
    corps.append(el_('p', { class: 'aide' }, 'Le circuit n\'est pas gardé par le site : enregistrez-le sur votre ordinateur (fichier .circuit.json) et rouvrez-le d\'ici, ou en le glissant sur la page.'));
    const nom = el_('input', { type: 'text', placeholder: 'Nom du circuit', class: 'large' }); nom.value = schema.titre || '';
    nom.onchange = () => { schema.titre = nom.value.trim(); };
    corps.append(el_('div', { class: 'pied-cat' }, nom,
      el_('button', { class: 'btn primaire', onclick: () => { schema.titre = nom.value.trim(); exporter(); } }, 'Enregistrer (télécharger le fichier)'),
      el_('button', { class: 'btn', onclick: () => $('#f-circuit').click() }, 'Ouvrir un fichier de l\'ordinateur…'),
      el_('button', { class: 'btn', onclick: () => { if (schema.elements.length && !confirm('Effacer le circuit en cours ?')) return; chargerSchema({ titre: '', elements: [], fils: [], dt: 5e-5 }); fermerTiroir(); } }, 'Nouveau circuit')));
    return;
  }
  corps.append(el_('p', { class: 'aide' }, 'Le circuit en cours est enregistré automatiquement dans ce navigateur. Enregistrez-le dans la liste ci-dessous pour le retrouver, ou exportez-le pour le garder dans un fichier à part.'));
  corps.append(el_('div', { class: 'pied-cat' },
    el_('button', { class: 'btn', onclick: () => { if (schema.elements.length && !confirm('Effacer le circuit en cours ?')) return; chargerSchema({ titre: '', elements: [], fils: [], dt: 5e-5 }); fermerTiroir(); } }, 'Nouveau circuit'),
    el_('button', { class: 'btn', onclick: exporter }, 'Exporter (.circuit.json)'),
    el_('button', { class: 'btn', onclick: () => $('#f-circuit').click() }, 'Ouvrir un fichier…')));
  const bloc = el_('div', { id: 'schemas' });
  corps.append(el_('div', { class: 'bloc-titre' }, 'Schémas enregistrés'), bloc);
  remplirSchemas(bloc);
}

/* ---------- Schémas enregistrés ----------
   Liste gardée par le serveur local dans un fichier du projet (schemas_enregistres.json, routes /api/schemas) :
   { format: 'frwa-circuit-schemas', version: 1, schemas: { nom: { date, circuit } } }, « circuit » au format de l'export.
   La page lit et réécrit le fichier entier (le serveur ne l'analyse pas). Sans serveur local (Apache, file://) : même
   liste gardée dans le stockage du navigateur. */
const SCHEMAS_VIDE = () => ({ format: 'frwa-circuit-schemas', version: 1, schemas: {} });
const bonneListe = o => (o?.format === 'frwa-circuit-schemas' && o.schemas && typeof o.schemas === 'object' ? o : null);
/** renvoie { liste, fichier } ; fichier = chemin du fichier du projet, ou null si la liste est dans le navigateur */
async function lireSchemas() {
  try {
    const r = await fetch('/api/schemas', { cache: 'no-store' });
    const liste = r.ok ? bonneListe(await r.json()) : null;
    if (liste) return { liste, fichier: await (await fetch('/api/schemas/fichier', { cache: 'no-store' })).text() };
  } catch (e) { /* pas de serveur local : stockage du navigateur */ }
  let liste = null; try { liste = bonneListe(JSON.parse(localStorage.getItem('frwa_circuit_schemas') || 'null')); } catch (e) { /* stockage indisponible */ }
  return { liste: liste || SCHEMAS_VIDE(), fichier: null };
}
async function ecrireSchemas(liste, fichier) {
  if (!fichier) { localStorage.setItem('frwa_circuit_schemas', JSON.stringify(liste)); return; }
  const r = await fetch('/api/schemas', { method: 'POST', headers: { 'X-FrWA': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(liste, null, 1) });
  if (!r.ok) throw new Error(`le serveur a refusé l'enregistrement (${r.status})`);
}
function circuitComplet() {
  const o = schema.serialiser();
  o.oscillo = voiesSerialisees(); o.vitesse = vitesse; o.fenetre = oscillo.fenetre; o.analyse = { ...oscillo.analyse };
  o.puces = [...new Set(schema.elements.filter(e => e.type.startsWith('puce:')).map(e => e.type.slice(5)))];
  return o;
}
/** enregistre le circuit en cours sous « nom » ; la liste est relue juste avant (un autre onglet a pu enregistrer) */
async function enregistrerSchema(nom, remplacer = n => confirm(`Remplacer le schéma « ${n} » ?`)) {
  nom = String(nom || '').trim(); if (!nom) throw new Error('donnez un nom au schéma');
  const { liste, fichier } = await lireSchemas();
  if (liste.schemas[nom] && !remplacer(nom)) return false;
  schema.titre = nom; sauvegarder();
  liste.schemas[nom] = { date: new Date().toISOString(), circuit: circuitComplet() };
  await ecrireSchemas(liste, fichier);
  return true;
}
async function ouvrirSchemaEnregistre(nom) {
  const { liste } = await lireSchemas(), s = liste.schemas[nom];
  if (!s) throw new Error(`schéma « ${nom} » introuvable`);
  chargerSchema(s.circuit);
}
async function supprimerSchemaEnregistre(nom) {
  const { liste, fichier } = await lireSchemas();
  delete liste.schemas[nom];
  await ecrireSchemas(liste, fichier);
}
async function remplirSchemas(bloc) {
  const { liste, fichier } = await lireSchemas();
  const rafraichir = () => { if (bloc.isConnected) remplirSchemas(bloc); };
  const tenter = (fn, message) => async () => { try { if (await fn() !== false && message) toast(message()); } catch (e) { toast('Schémas : ' + e.message, 'erreur'); } rafraichir(); };
  const nom = el_('input', { type: 'text', placeholder: 'Nom du schéma', class: 'large' }); nom.value = schema.titre || '';
  const enregistrer = tenter(() => enregistrerSchema(nom.value), () => `Schéma « ${nom.value.trim()} » enregistré.`);
  nom.addEventListener('keydown', e => { if (e.key === 'Enter') enregistrer(); });
  bloc.innerHTML = '';
  bloc.append(el_('div', { class: 'ligne-recherche' }, nom, el_('button', { class: 'btn primaire', onclick: enregistrer }, 'Enregistrer')));
  const noms = Object.keys(liste.schemas).sort((a, b) => a.localeCompare(b, 'fr'));
  const ul = el_('div', { class: 'liste-perso' });
  for (const n of noms) {
    const s = liste.schemas[n], date = new Date(s.date);
    ul.append(el_('div', { class: 'ligne-perso' },
      el_('span', { class: 'schema-nom', title: 'Ouvrir', onclick: tenter(async () => { await ouvrirSchemaEnregistre(n); fermerTiroir(); }, () => `Schéma « ${n} » ouvert.`) },
        n, el_('small', {}, ` ${s.circuit?.elements?.length ?? 0} composants · ${Number.isNaN(date.getTime()) ? '' : date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`)),
      el_('span', {},
        el_('button', { class: 'btn petit', onclick: tenter(async () => { await ouvrirSchemaEnregistre(n); fermerTiroir(); }, () => `Schéma « ${n} » ouvert.`) }, 'Ouvrir'), ' ',
        el_('button', { class: 'btn petit danger', onclick: tenter(() => (confirm(`Supprimer le schéma « ${n} » de la liste ?`) ? supprimerSchemaEnregistre(n) : false), () => `Schéma « ${n} » supprimé.`) }, 'Supprimer'))));
  }
  if (!noms.length) ul.append(el_('p', { class: 'sous' }, 'Aucun schéma enregistré.'));
  bloc.append(ul, el_('p', { class: 'aide' }, fichier ? 'Liste gardée dans le fichier du projet : ' + fichier : 'Sans serveur local (dist/frwa_circuit, frwa_circuit.pyz ou serveur_circuit.py), la liste est gardée dans ce navigateur seulement.'));
}
function remplirSimulation(corps) {
  const dt = el_('input', { type: 'text' }); dt.value = formater(schema.dt, 's');
  dt.onchange = () => { const v = lireValeur(dt.value); if (v >= 1e-9 && v <= 0.1) { schema.dt = v; modifie(); } dt.value = formater(schema.dt, 's'); };
  // vitesse : valeurs courantes, ou « Custom » = n'importe quelle valeur saisie (au-delà de ×10, en dessous de ×0,001…)
  const vit = el_('select'), VITESSES = [0.001, 0.01, 0.1, 0.25, 0.5, 1, 2, 5, 10], fois = v => '×' + String(v).replace('.', ',');
  const remplirVitesses = () => {
    vit.innerHTML = '';
    for (const v of VITESSES) { const o = el_('option', { value: v }, fois(v)); if (v === vitesse) o.selected = true; vit.append(o); }
    const perso = !VITESSES.includes(vitesse), o = el_('option', { value: 'custom' }, perso ? `Custom : ${fois(vitesse)}` : 'Custom…'); o.selected = perso; vit.append(o);
    if (perso) vit.append(el_('option', { value: 'saisir' }, 'Autre valeur…'));
  };
  vit.onchange = () => {
    if (vit.value === 'custom' || vit.value === 'saisir') {
      const r = prompt('Vitesse de simulation, en multiple du temps réel (plus grand que 0).\nExemples : 50 · 0,0005 · 2m (= 0,002)', String(vitesse).replace('.', ','));
      const v = r === null ? NaN : lireValeur(r);
      if (v > 0 && Number.isFinite(v)) vitesse = v; else if (r !== null) toast('Vitesse illisible : un nombre plus grand que 0');
    } else vitesse = Number(vit.value);
    accumulateur = 0; remplirVitesses(); sauvegarder();
  };
  remplirVitesses();
  const vc = el_('input', { type: 'range', min: 1, max: 100 }); vc.value = vitesseCourant; vc.oninput = () => { vitesseCourant = Number(vc.value); };
  const fen = el_('select'); for (const v of [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]) { const o = el_('option', { value: v }, formater(v, 's')); if (v === oscillo.fenetre) o.selected = true; fen.append(o); }
  fen.onchange = () => reglerFenetre(Number(fen.value));
  const pa = el_('input', { type: 'checkbox' }); pa.checked = montrerPastilles; pa.onchange = () => { montrerPastilles = pa.checked; };
  // monde physique : échelles, radio, ambiance
  const M = { ...G.FrWAMonde.REGLAGES, ...(schema.monde || {}) };
  const champMonde = (cle, unite) => {
    const i = el_('input', { type: 'text' }); i.value = String(M[cle]).replace('.', ',');
    i.onchange = () => { const v = lireValeur(i.value); if (Number.isFinite(v)) { schema.monde = { ...(schema.monde || {}), [cle]: v }; modifie(); } i.value = String((schema.monde || {})[cle] ?? M[cle]).replace('.', ','); };
    return el_('span', {}, i, ' ' + unite);
  };
  const blocMonde = [
    el_('div', { class: 'bloc-titre' }, 'Monde physique'),
    el_('div', { class: 'ov-ligne' }, el_('span', {}, '1 carreau (capteurs)'), champMonde('echelle', 'm')),
    el_('div', { class: 'ov-ligne' }, el_('span', {}, '1 carreau (radio)'), champMonde('echelleRadio', 'm')),
    el_('div', { class: 'ov-ligne' }, el_('span', {}, 'Exposant d\'affaiblissement'), champMonde('exposant', '(2 = espace libre)')),
    el_('div', { class: 'ov-ligne' }, el_('span', {}, 'Température ambiante'), champMonde('tAmb', '°C')),
    el_('div', { class: 'ov-ligne' }, el_('span', {}, 'Humidité ambiante'), champMonde('hAmb', '%')),
    el_('div', { class: 'ov-ligne' }, el_('span', {}, 'Lumière ambiante'), champMonde('luxAmb', 'lx')),
  ];
  corps.append(
    el_('div', { class: 'ov-ligne' }, el_('span', {}, 'Pas de temps'), dt),
    el_('div', { class: 'ov-ligne' }, el_('span', {}, 'Vitesse (temps simulé)'), vit),
    el_('div', { class: 'ov-ligne' }, el_('span', {}, 'Vitesse des points'), vc),
    el_('div', { class: 'ov-ligne' }, el_('span', {}, 'Oscilloscope : largeur'), fen),
    el_('div', { class: 'ov-ligne' }, el_('span', {}, 'Pastilles nom / valeur'), pa),
    el_('p', { class: 'aide' }, 'Un pas plus petit = plus précis mais plus lent. Le chenillard tourne en temps réel avec 200 µs ; un signal à 50 Hz demande ≈ 10 µs (et une vitesse réduite).'),
    ...blocMonde);
  G.FrWAPilote?.remplirPanneau(corps);
}
/* Règles v1 : résumé + conformité de chaque composant (le texte normatif est docs/REGLES_COMPOSANTS.md) */
function remplirRegles(corps) {
  const R = G.FrWARegles, ok = Puces.conformite.filter(l => !l.erreurs.length).length;
  corps.append(el_('p', { class: 'aide' }, `Règles v${R.VERSION}, validées et gelées le 2026-11-13 (pistes pour la v2 : docs/AMELIORATIONS_V2.md). Texte complet : docs/REGLES_COMPOSANTS.md dans le dossier du projet. Une puce non conforme est refusée au chargement.`));
  corps.append(el_('ul', { class: 'aide-liste', html: [
    '<b>R2</b> unités : liste fermée ; variables en SI (angles en rad, 2π rad = 1 tour), réglages affichés en ° possibles',
    '<b>R3</b> champs : id, nom, categorie, description, version, regles, broches, typesBroches, variables, modele3d',
    '<b>R4</b> chaque broche a un type électrique (entree, sortie, bidir, trois_etats, drain_ouvert, passif, alim_entree, alim_sortie, nc)',
    '<b>R5</b> paramètres typés avec unité, bornes et défaut cohérents · <b>R6</b> comportement par modele / logique',
    '<b>R7</b> variables publiées (oscilloscope, extensions 3D) · <b>R8</b> code reproductible : c.aleatoire(), temps simulé, ni page ni réseau',
    '<b>R9</b> 3D uniquement par extension (fenêtre vue3d.html), modèle STEP déclaré · <b>R10</b> mécanique par axes nommés',
    '<b>R11</b> signaux numériques : niveaux CMOS / TTL, UART, SPI, I2C, impulsions calculés par FrWA.bus',
    '<b>R12</b> étiquettes (tags, plusieurs possibles ; sans étiquette : « Autre » ; basic = mode Basique) et familles de variantes choisies dans ⚙',
  ].map(t => `<li>${t}</li>`).join('') }));
  corps.append(el_('div', { class: 'bloc-titre' }, `Conformité : ${ok} / ${Puces.conformite.length}`));
  const tab = el_('table', { class: 'brochage' }, el_('tr', {}, el_('th', {}, ''), el_('th', {}, 'Composant'), el_('th', {}, 'Fichier')));
  for (const l of [...Puces.conformite].sort((a, b) => (b.erreurs.length - a.erreurs.length) || a.nom.localeCompare(b.nom, 'fr'))) {
    tab.append(el_('tr', {}, el_('td', { style: `color:${l.erreurs.length ? 'var(--rouge)' : 'var(--teal)'}` }, l.erreurs.length ? '✗' : '✓'), el_('td', {}, l.nom), el_('td', { class: 'sous' }, l.origine)));
    if (l.erreurs.length) tab.append(el_('tr', {}, el_('td', {}), el_('td', { colspan: '2' }, el_('pre', { class: 'erreurs' }, l.erreurs.join('\n')))));
  }
  corps.append(tab);
}
function remplirAide(corps) {
  corps.innerHTML = `
  <div class="bloc-titre">Gestes</div>
  <ul class="aide-liste">
    <li><b>＋</b> : bibliothèque de composants et de puces.</li>
    <li><b>Glisser depuis une broche</b> (ou en mode fil ✎) : tracer un fil en L.</li>
    <li><b>Glisser un composant</b> : le déplacer (les fils suivent). <b>Fond</b> : se déplacer. <b>Molette / pincer</b> : zoom.</li>
    <li><b>Toucher</b> un composant : le sélectionner → molette pour sa valeur, boutons ⚙ ↻ oscillo copier, 🗑.</li>
    <li>Interrupteur : toucher pour basculer. Bouton poussoir et TTP223 : maintenir appuyé.</li>
    <li><b>Souris</b> : glisser le fond = cadre de sélection (vers la droite : objets entièrement dedans ; vers la gauche : objets touchés). <b>Maj+clic</b> : ajouter / retirer du groupe. Glisser un objet du groupe : tout le groupe bouge. <b>Clic droit</b> : menu (copier, couper, dupliquer, oscilloscope, vue 3D… ; il ne colle jamais) ; clic droit glissé ou bouton du milieu : se déplacer.</li>
    <li><b>Copier / coller</b> : le bouton <b>Copier</b> apparaît en bas à droite dès qu'un objet est sélectionné, le bouton <b>Coller</b> dès que quelque chose a été copié (collage au centre de la vue).</li>
    <li>Clavier : Ctrl+C / Ctrl+X / Ctrl+V (aussi d'un onglet à l'autre), Ctrl+D (dupliquer), Ctrl+A (tout), Suppr, R (tourner), Espace (pause), W (mode fil), Échap.</li>
  </ul>
  <div class="bloc-titre">Bibliothèque</div>
  <ul class="aide-liste">
    <li><b>Basique / Tout</b> (à côté de la recherche) : seulement les composants d'initiation, ou toute la bibliothèque (séries 4000 et 7400, modules Arduino, ALI, relais…).</li>
    <li><b>Étiquettes</b> : cocher / décocher pour filtrer. Un composant à plusieurs étiquettes apparaît dans chaque section ; sans étiquette, dans « Autre ».</li>
    <li>Les variantes (commutateur 2 à 12 positions, DIP 1 à 8, relais 1 à 4 RT) n'apparaissent qu'une fois : le nombre se choisit dans <b>⚙ Réglages</b>.</li>
  </ul>
  <div class="bloc-titre" data-pilotage>Pilotage (Python, C/C++, IA, Arduino)</div>
  <p class="aide" data-pilotage>Avec <code>dist/frwa_circuit</code> ou <code>frwa_circuit.pyz</code>, un programme local pilote cette page : construire un circuit, écrire des canaux (valeurs, formes d'onde), simuler et lire les résultats. Puces « Entrée externe » / « Sortie externe » ; webcam, micro et mouvement dans Simulation. Clients et mode d'emploi : <code>clients/</code> et <code>docs/PILOTAGE.md</code>.</p>
  <div class="bloc-titre">Oscilloscope</div>
  <ul class="aide-liste">
    <li>Autant de courbes que voulu : tension d'un fil, d'une broche, ou <b>variable publiée</b> d'une puce (angle d'un servo, courant d'un moteur…).</li>
    <li>Chaque objet mesuré est entouré d'un <b>cadre de la couleur de sa courbe</b>.</li>
    <li>Premier bouton de l'oscilloscope (<b>spectre</b>) : affichage <b>temporel</b>, <b>analyseur de spectre</b> (FFT : nombre de points, fenêtre, dB ou linéaire, axe log, moyenne) ou <b>cascade</b> (waterfall : le temps descend, la couleur donne le niveau). Échantillonnage : 1 / pas de simulation par défaut ; seules les fréquences jusqu'à sa moitié sont visibles.</li>
    <li>Clic sur l'étiquette d'une courbe : retirer, <b>dissocier</b> (graphe à part) ou <b>joindre</b> à un autre graphe. On peut aussi glisser l'étiquette sur un autre graphe. Boutons en bas à droite : tout joindre, tout dissocier.</li>
  </ul>
  <div class="bloc-titre" data-vue3d>Vue 3D</div>
  <p class="aide" data-vue3d>Clic droit → « Vue 3D (fenêtre) » : une fenêtre par module, comme la visionneuse 3D de KiCad. La 3D n'est pas calculée par le simulateur (règle R9) : la fenêtre lit l'état publié et ses extensions (<code>extensions/3d/*.vue3d.js</code>) construisent la scène ; les modules liés par un axe mécanique y apparaissent ensemble.</p>
  <div class="bloc-titre">Ajouter une puce</div>
  <p class="aide">Une puce est un fichier <code>nom.puce.js</code> qui appelle <code>FrWA.puce({ … })</code>. Trois façons de décrire son comportement, combinables :</p>
  <ul class="aide-liste">
    <li><b>modele.elements</b> : un sous-circuit de primitives <code>R C L V A I S O D Q E F G</code> entre les broches et des nœuds internes (ex. LTV-817, ou JSON pur comme LESD5D5.0).</li>
    <li><b>logique</b> : entrées, sorties et une fonction <code>evaluer(e, s, p)</code> ; seuils, fronts (<code>e.monte.CLK</code>) et sortance gérés pour vous (ex. CD4017, TTP223).</li>
    <li><b>modele.pas(c)</b> : code exécuté à chaque pas, qui lit <code>c.v('BROCHE')</code>, <code>c.i('capteur')</code> et règle <code>c.regler('nom', valeur)</code> (ex. NE555, AMS1117, DRV8871).</li>
  </ul>
  <p class="aide">Modèle commenté : bouton « Télécharger le modèle » de la bibliothèque. Référence complète : <code>docs/FORMAT_PUCE.md</code> dans le dossier du projet.</p>
  <div class="bloc-titre">Moteur</div>
  <p class="aide">Analyse nodale modifiée (comme Circuit.js) : A·x = B résolu à chaque pas, Newton-Raphson pour diodes et transistors, trapèzes pour C et L. Couleur des fils = tension (vert +, rouge −, gris 0 V) ; points jaunes = courant conventionnel.</p>`;
  if (!G.FrWAPilote) for (const e of corps.querySelectorAll('[data-pilotage]')) e.remove();
  if (!CONFIG.vue3d) for (const e of corps.querySelectorAll('[data-vue3d]')) e.remove();
  if (CONFIG.oscilloBureau) corps.querySelector('.bloc-titre').before(el_('div', { class: 'bloc-titre' }, 'Oscilloscope sur ordinateur'), el_('ul', { class: 'aide-liste', html:
    '<li>Courbes superposées ou en graphes séparés, chacune avec sa gamme (case de couleur : valeur par division).</li>'
    + '<li><b>Zoom</b> : clic gauche glissé = agrandir la zone, molette = zoom en temps, clic droit maintenu = se déplacer, double-clic = tout voir. Mettre en pause pour examiner un détail.</li>'
    + '<li><b>Graphes</b> : les boutons en haut à droite joignent toutes les courbes dans un seul graphe ou les séparent (un graphe par courbe, empilés). <b>Trigger</b> : stabilise l\'écran sur le front montant ou descendant (bouton ↑ / ↓) de la courbe de référence (la dernière case de couleur cliquée), même si les graphes sont séparés ; glisser le trait « T » pour régler le niveau.</li>'
    + '<li><b>Curseurs</b> de temps (Δt, 1/Δt, valeur de chaque courbe) ou de tension ; <b>mesures</b> (min, max, crête à crête, moyenne, RMS, fréquence) sur la partie visible ; export CSV et PNG.</li>'
    + '<li>Sur téléphone, et pour le spectre et la cascade, l\'oscilloscope reste en bandeau.</li>' }));
}

/* ---------- Fichiers ---------- */
function telecharger(nom, texte) {
  const a = el_('a', { href: URL.createObjectURL(new Blob([texte], { type: 'application/json' })), download: nom });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function exporter() {
  const o = circuitComplet();
  telecharger((o.titre || 'circuit').replace(/[^\w-]+/g, '_') + '.circuit.json', JSON.stringify(o, null, 1));
}
/** un exemple peut être décrit par une fonction « construire » (positions calculées d'après les brochages des puces) */
function resoudreExemple(ex) {
  if (!ex.construire) return ex;
  if (!ex._fait) { try { ex._fait = { ...ex, ...ex.construire() }; delete ex._fait.construire; } catch (e) { toast('Exemple ' + ex.titre + ' : ' + e.message, 'erreur'); return { ...ex, elements: [], fils: [] }; } }
  return ex._fait;
}
function chargerSchema(def) {
  def = resoudreExemple(def);
  vitesse = def.vitesse ?? 1;
  oscillo.fenetre = def.fenetre ?? 2;
  oscillo.analyse = { ...ANALYSE_DEFAUT, ...(def.analyse || {}) }; oscillo.kSpec = 0; oscillo.feEff = 0;
  const manquants = schema.charger(JSON.parse(JSON.stringify(def)));
  if (manquants.length) toast('Puces absentes (importez leur fichier) : ' + manquants.map(m => m.replace('puce:', '')).join(', '), 'erreur');
  selection = null; oscillo.voies = []; oscillo.prochain = 0; compil = null; aCompiler = true; accumulateur = 0;
  prochainGroupe = 1;
  for (const o of def.oscillo || []) {
    const el = schema.elements.find(e => e.nom === o.nom); if (!el) continue;
    const T = TYPES[el.type];
    if (o.variable) { if ((T.variables || []).some(v => v.cle === o.variable)) ajouterVoie({ el, variable: o.variable, groupe: o.groupe }); continue; }
    const i = o.broche ? (T.broches || []).findIndex(b => b.nom === o.broche) : -1;
    ajouterVoie({ el, broche: i >= 0 ? i : null, brocheNom: i >= 0 ? o.broche : null, groupe: o.groupe });
  }
  majLegende(); majOutils(); besoinCadrer = true; sauvegarder();
}
let besoinCadrer = false;
function lireFichiers(fichiers) {
  for (const f of fichiers) {
    const r = new FileReader();
    r.onload = () => {
      const txt = String(r.result);
      let json = null; try { json = JSON.parse(txt); } catch (e) { /* pas du JSON : une puce .js */ }
      if (json && json.format === 'frwa-circuit') { chargerSchema(json); toast(`Circuit « ${f.name} » ouvert.`); return; }
      const res = importer(f.name, txt);
      toast(res.message, res.ok ? '' : 'erreur');
      if (res.ok) { aCompiler = true; if (tiroirOuvert === 'bibliotheque') ouvrirTiroir('bibliotheque'); }
    };
    r.readAsText(f);
  }
}

/* ---------- Démarrage ---------- */
async function demarrer() {
  $('#b-pause').innerHTML = ICONES.pause; $('#b-reset').innerHTML = ICONES.reset; $('#b-ajout').innerHTML = ICONES.plus;
  $('#b-suppr').innerHTML = ICONES.poubelle; $('#b-fil').innerHTML = ICONES.fil;
  $('#b-copier').innerHTML = ICONES.copier; $('#b-coller').innerHTML = ICONES.coller;
  $('#b-copier').onclick = () => copier(); $('#b-coller').onclick = collerAuCentre;
  $('#a-reglages').innerHTML = ICONES.reglages; $('#a-rotation').innerHTML = ICONES.rotation; $('#a-oscillo').innerHTML = ICONES.oscillo; $('#a-copier').innerHTML = ICONES.copier;
  $('#osc-masquer').innerHTML = ICONES.oeil; $('#osc-fermer').innerHTML = ICONES.fermer;
  $('#b-pause').onclick = basculerMarche;
  $('#b-reset').onclick = () => { reinitialiser(); if (compil) compil.sim.t = 0; compil = null; toast('Simulation remise à zéro'); };
  $('#b-ajout').onclick = () => (tiroirOuvert === 'bibliotheque' ? fermerTiroir() : ouvrirTiroir('bibliotheque'));
  $('#b-suppr').onclick = supprimerSelection;
  $('#b-fil').onclick = () => { modeFil = !modeFil; majOutils(); toast(modeFil ? 'Mode fil : glissez d\'un point à un autre' : 'Mode fil désactivé'); };
  $('#a-reglages').onclick = () => ouvrirTiroir('reglages');
  $('#a-rotation').onclick = tournerSelection;
  $('#a-copier').onclick = dupliquer;
  $('#a-oscillo').onclick = () => {
    if (!selection) return;
    if (selection.type === 'fil') ajouterVoie({ fil: selection }); else choisirVoie(selection);
  };
  $('#osc-masquer').onclick = () => { oscillo.masque = true; majLegende(); toast('Oscilloscope masqué : l\'œil en haut à droite, ou le bouton oscilloscope d\'un composant, le réaffiche.'); };
  $('#osc-montrer').innerHTML = ICONES.oeilOuvert; $('#osc-montrer').onclick = () => { oscillo.masque = false; majLegende(); };
  $('#osc-joindre').innerHTML = ICONES.joindre; $('#osc-dissocier').innerHTML = ICONES.dissocier;
  $('#osc-analyse').innerHTML = ICONES.spectre; $('#osc-analyse').onclick = e => { e.stopPropagation(); menuAnalyse($('#osc-analyse')); };
  $('#osc-joindre').onclick = () => { const g0 = oscillo.voies[0]?.groupe; for (const v of oscillo.voies) v.groupe = g0; majLegende(); sauvegarder(); };
  $('#osc-dissocier').onclick = () => { for (const v of oscillo.voies) v.groupe = prochainGroupe++; majLegende(); sauvegarder(); };
  // glisser une étiquette de courbe sur un autre graphe : jonction
  $('#oscillo').addEventListener('dragover', e => e.preventDefault());
  $('#oscillo').addEventListener('drop', e => {
    e.preventDefault();
    const v = oscillo.voies[Number(e.dataTransfer.getData('text/plain'))]; if (!v || oscillo.analyse.mode === 'cascade') return;
    const gs = groupes(), r = $('#oscillo').getBoundingClientRect();
    const k = Math.max(0, Math.min(gs.length - 1, Math.floor((e.clientY - r.top) / (r.height / gs.length))));
    joindre(v, gs[k]);
  });
  $('#osc-fermer').onclick = () => { oscillo.voies = []; majLegende(); sauvegarder(); };
  $('#tiroir-fermer').onclick = fermerTiroir;
  for (const b of document.querySelectorAll('[data-panneau]')) b.onclick = () => (tiroirOuvert === b.dataset.panneau ? fermerTiroir() : ouvrirTiroir(b.dataset.panneau));
  $('#f-puce').onchange = e => { lireFichiers(e.target.files); e.target.value = ''; };
  $('#f-circuit').onchange = e => { lireFichiers(e.target.files); e.target.value = ''; };
  document.body.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('depot'); });
  document.body.addEventListener('dragleave', e => { if (e.target === document.body || !e.relatedTarget) document.body.classList.remove('depot'); });
  document.body.addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('depot'); lireFichiers(e.dataTransfer.files); });
  initGestes(); initMolette();
  if (CONFIG.oscilloBureau && G.FrWAOscilloBureau) {
    G.FrWAOscilloBureau.demarrer({ oscillo, nomVoie, mesurerVoie, menuVoie, reglerFenetre }, $('#oscillo'));
    window.addEventListener('resize', majLegende);
  }

  await chargerTout();
  if (Puces.erreurs.length) toast(Puces.erreurs.length + ' message(s) au chargement des puces : voir ＋', 'erreur');
  let depart = null;
  try { depart = CONFIG.stockage ? JSON.parse(localStorage.getItem('frwa_circuit_courant') || 'null') : null; } catch (e) { depart = null; }
  const demande = (location.hash.match(/exemple=([\w-]+)/) || [])[1];      // index.html#exemple=horloge4060
  const exDemande = demande && EXEMPLES.find(e => e.id === demande);
  chargerSchema(exDemande || (depart && (depart.elements?.length || depart.fils?.length) ? depart : EXEMPLES.find(e => e.id === 'chenillard')));

  let dernier = performance.now(), prochainDessin = 0;
  const boucle = ts => {
    const dms = Math.min(100, ts - dernier); dernier = ts;
    if (besoinCadrer && toile.clientWidth > 50 && toile.clientHeight > 50) { besoinCadrer = false; cadrer(); }
    if (aCompiler && !(geste && (geste.type === 'element' || geste.type === 'extremite'))) recompiler();
    simuler(dms); majCourants(dms);
    // dessin adaptatif : un gros schéma long à dessiner (d ms) n'est redessiné qu'après ≈ 3·d, pour laisser au moins
    // 75 % du temps au calcul et au pilotage ; 5 images/s au plus quand un programme pilote la page (chaque dessin
    // retarde la commande suivante) ; pendant un geste, on dessine toujours
    if (geste || ts >= prochainDessin) {
      const t0 = performance.now(); dessiner(); dessinerOscillo(); majInfos();
      prochainDessin = ts + Math.max(G.FrWAPilote?.occupe ? 200 : 0, 3 * (performance.now() - t0) - 8);
    }
    envoyer3D();
    requestAnimationFrame(boucle);
  };
  requestAnimationFrame(boucle);
  // accès de débogage depuis la console du navigateur
  G.FrWACircuitApp = { get schema() { return schema; }, get compil() { return compil; }, get vue() { return vue; }, get oscillo() { return oscillo; },
    get groupe() { return groupe; }, get selection() { return selection; }, chargerSchema, Puces, TYPES,
    ajouterVoie, joindre, toutSelectionner, copier, coller, dupliquer, supprimerSelection, selectionner, basculerGroupe, ouvrirMenuContexte, etat3D, choisirVoie, groupes,
    // pour pilote.js (pilotage externe) et les pages de vérification
    EXEMPLES, resoudreExemple, modifie, toast, changerVariante, ouvrirTiroir,
    collerAuCentre, lireSchemas, enregistrerSchema, ouvrirSchemaEnregistre, supprimerSchemaEnregistre,
    get enMarche() { return enMarche; }, marche(v) { if (!!v !== enMarche) basculerMarche(); },
    get vitesse() { return vitesse; }, set vitesse(v) { vitesse = v; accumulateur = 0; },
    reinitialiser() { reinitialiser(); if (compil) compil.sim.t = 0; compil = null; },
    compiler() { if (aCompiler || !compil) recompiler(); return compil; }, get erreurSim() { return erreurSim; },
    echantillonner, reglerAnalyse, get analyse() { return { ...oscillo.analyse, feEffective: oscillo.feEff }; },
    serialiser() { const o = schema.serialiser(); o.oscillo = voiesSerialisees(); o.analyse = { ...oscillo.analyse }; o.puces = [...new Set(schema.elements.filter(e => e.type.startsWith('puce:')).map(e => e.type.slice(5)))]; return o; } };
  G.FrWAPilote?.demarrer(G.FrWACircuitApp);
}
demarrer();
})(window);
