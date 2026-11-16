/* frwa_flow-Circuit — puces.js
   Système d'EXTENSIONS de puces. Une puce = un fichier `*.puce.js` (ou `*.puce.json` sans code) qui appelle :

     FrWA.puce({
       id, nom, categorie, description, documentation,
       broches: [ 'VCC', 'GND', { nom: 'IP+a', etiquette: 'IP+', num: 1 }, … ],   // ordre = numéros 1..n
       cotes: { gauche: [...], droite: [...], haut: [...], bas: [...] },           // optionnel (sinon boîtier DIP)
       parametres: [ { cle, nom, unite, defaut, min, max, echelle: 'log'|'lin', type: 'choix'|'bool', options } ],
       modele:  { elements: [ {t:'R', a:'VCC', b:'n1', R:5000}, … ], pas(c) { … } },  // analogique / comportemental
       logique: { vdd, vss, entrees: [...], sorties: [...], rSortie, etat(), evaluer(e, s, p, c) }, // numérique
       interaction: { clic(s, p), appui(s, p), relache(s, p) },                       // puce cliquable
       affichage(s, p) → texte court affiché dans la puce,
       version, regles: 1, typesBroches, variables, modele3d, mecanique                // règles v1 (regles.js)
     });

   Toute définition passe d'abord par FrWARegles.verifierPuce (docs/REGLES_COMPOSANTS.md) : non conforme = refusée.

   Les trois styles se combinent librement (ex. NE555 = diviseur résistif + comparateurs dans pas()).
   Le détail complet et des exemples : docs/FORMAT_PUCE.md et static/puces/*.puce.js. */
'use strict';
(function (G) {
const { Prim: P } = G.FrWAMoteur;
const { TYPES, D, COUL, formater, ajouterType } = G.FrWAComposants;
const Regles = G.FrWARegles;

const CLE_PRINCIPALE = { R: 'R', C: 'C', L: 'L', V: 'V', A: 'V', I: 'I', S: 'ferme', O: 'V', E: 'gain', F: 'gain', G: 'gm', D: 'Is', Q: 'beta', OA: 'A', K: 'I' };
const CHAMPS_NOEUDS = Regles.CHAMPS_NOEUDS;   // nœuds de chaque primitive (une seule table, dans regles.js)

const Puces = {
  liste: [],          // { id, nom, origine, erreur }
  erreurs: [],
  origine: 'interne',
  ecouteurs: [],
  conformite: [],     // { id, nom, origine, erreurs } : une ligne par définition lue, conforme ou refusée
};

/* ---------- Validation et normalisation d'une définition ---------- */
function normaliser(def) {
  if (!def || typeof def !== 'object') throw new Error('définition vide');
  const manquements = Regles.verifierPuce(def);
  Puces.conformite = Puces.conformite.filter(l => !(l.id === def.id && l.origine === Puces.origine));
  Puces.conformite.push({ id: def.id, nom: def.nom || def.id, origine: Puces.origine, erreurs: manquements });
  if (manquements.length) throw new Error(`« ${def.id} » refusée, non conforme aux règles v${Regles.VERSION} :\n  - ` + manquements.join('\n  - '));
  if (!/^[a-z0-9_\-.]+$/i.test(def.id || '')) throw new Error('« id » manquant ou invalide (lettres, chiffres, _ - .)');
  if (!Array.isArray(def.broches) || !def.broches.length) throw new Error('« broches » doit être une liste non vide');
  const broches = def.broches.map((b, i) => {
    const o = typeof b === 'string' ? { nom: b } : { ...b };
    if (!o.nom) throw new Error(`broche ${i + 1} sans nom`);
    o.num = o.num ?? i + 1; o.etiquette = o.etiquette ?? o.nom;
    return o;
  });
  const noms = new Set();
  for (const b of broches) { if (noms.has(b.nom)) throw new Error(`broche « ${b.nom} » en double`); noms.add(b.nom); }
  const params = (def.parametres || []).map(p => ({ echelle: 'lin', ...p }));
  if (def.logique) {
    const L = def.logique;
    for (const k of ['vdd', 'vss']) if (!noms.has(L[k])) throw new Error(`logique.${k} doit être le nom d'une broche`);
    for (const n of [...(L.entrees || []), ...(L.sorties || [])]) if (!noms.has(n)) throw new Error(`logique : broche « ${n} » inconnue`);
    if (typeof L.evaluer !== 'function') throw new Error('logique.evaluer(e, s, p) doit être une fonction');
  }
  for (const e of def.modele?.elements || []) {
    if (!CHAMPS_NOEUDS[e.t]) throw new Error(`élément de type « ${e.t} » inconnu (R C L V A I S O D Q E F G OA K)`);
    if (e.t === 'F' && !e.mesure) throw new Error('un élément F doit indiquer « mesure » (nom d\'une source V ou A)');
  }
  return { ...def, broches, params };
}

/* ---------- Disposition du boîtier (grille de 20) ---------- */
const arr40 = v => Math.ceil(v / 40) * 40;
function disposer(def) {
  const parNom = Object.fromEntries(def.broches.map(b => [b.nom, b]));
  let cotes = def.cotes;
  if (!cotes) { // DIP : 1..n/2 à gauche de haut en bas, n..n/2+1 à droite de haut en bas
    const n = def.broches.length, m = Math.ceil(n / 2);
    cotes = { gauche: def.broches.slice(0, m).map(b => b.nom), droite: def.broches.slice(m).reverse().map(b => b.nom) };
  }
  // null dans une liste = case vide (sert à aligner des broches, ex. une sortie en face de ses entrées)
  const g = cotes.gauche || [], d = cotes.droite || [], h = cotes.haut || [], ba = cotes.bas || [];
  const places = new Set([...g, ...d, ...h, ...ba].filter(Boolean));
  for (const n of places) if (!parNom[n]) throw new Error(`cotes : « ${n} » n'est pas une broche`);
  for (const b of def.broches) if (!places.has(b.nom)) throw new Error(`cotes : la broche « ${b.nom} » n'est placée nulle part`);
  const lon = l => Math.max(0, ...l.filter(Boolean).map(n => parNom[n].etiquette.length));
  const lg = lon(g), ld = lon(d);
  // écart des broches du haut / du bas : 20, ou 40 si les étiquettes sont trop longues pour tenir côte à côte
  const lhb = lon([...h, ...ba]);
  const pasHB = Math.max(20, Math.ceil((lhb * 5.2 + 2) / 20) * 20);
  const W = Math.max(80, def.largeur ? arr40(def.largeur) : 0, arr40(lg * 7 + ld * 7 + 20), arr40((Math.max(h.length, ba.length) + 1) * pasHB), arr40((def.nom || '').length * 7.5 + 16));
  const lignes = Math.max(g.length, d.length) + 2 + (h.length ? 1 : 0) + (ba.length ? 1 : 0);
  const H = Math.max(arr40(lignes * 20), def.hauteur ? arr40(def.hauteur) : 0);
  const y0 = -H / 2 + (h.length ? 40 : 20);
  const pos = {};
  g.forEach((n, i) => { if (n) pos[n] = { x: -W / 2 - 20, y: y0 + 20 * i, bx: -W / 2, cote: 'g' }; });
  d.forEach((n, i) => { if (n) pos[n] = { x: W / 2 + 20, y: y0 + 20 * i, bx: W / 2, cote: 'd' }; });
  h.forEach((n, i) => { if (n) pos[n] = { x: -W / 2 + pasHB * (i + 1), y: -H / 2 - 20, by: -H / 2, cote: 'h' }; });
  ba.forEach((n, i) => { if (n) pos[n] = { x: -W / 2 + pasHB * (i + 1), y: H / 2 + 20, by: H / 2, cote: 'b' }; });
  const yNom = y0 + 20 * Math.max(g.length, d.length);
  return { W, H, pos, yNom };
}

/* ---------- Dessin d'une puce ---------- */
function dessinerPuce(def, lay, g, el, R) {
  const { W, H } = lay;
  def.broches.forEach((b, i) => {
    const p = lay.pos[b.nom], c = R.c(i);
    if (p.cote === 'g' || p.cote === 'd') D.trait(g, p.x, p.y, p.bx, p.y, c); else D.trait(g, p.x, p.y, p.x, p.by, c);
  });
  g.fillStyle = COUL.boiteFond; g.strokeStyle = el._erreur ? '#ff6b6b' : COUL.boite; g.lineWidth = 1.6;
  g.beginPath(); g.rect(-W / 2, -H / 2, W, H); g.fill(); g.stroke();
  // encoche du boîtier
  g.beginPath(); g.arc(0, -H / 2, 6, 0, Math.PI); g.stroke();
  // dessin propre à la puce (afficheur, voyant, mécanique…), dans le repère de la puce
  if (def.dessin) {
    const idx = Object.fromEntries(def.broches.map((b, i) => [b.nom, i]));
    try {
      g.save();
      def.dessin(g, { W, H, s: el._etat || {}, p: el.params, v: nom => R.v(idx[nom]), i: nom => R.i(idx[nom]), marche: R.marche, rot: el.rot || 0 });
      g.restore();
    } catch (e) { g.restore(); el._erreur = 'dessin : ' + e.message; }
  }
  g.save(); g.rotate(-(el.rot || 0) * Math.PI / 2); // textes toujours lisibles : on « dé-tourne »
  const tourne = (x, y) => { const r = ((el.rot || 0) % 4 + 4) % 4; return r === 0 ? [x, y] : r === 1 ? [-y, x] : r === 2 ? [-x, -y] : [y, -x]; };
  g.font = '9px ui-monospace, Consolas, monospace'; g.textBaseline = 'middle';
  def.broches.forEach((b) => {
    const p = lay.pos[b.nom]; let [x, y] = [0, 0], al = 'center';
    if (p.cote === 'g') { [x, y] = [-W / 2 + 4, p.y]; al = 'left'; }
    else if (p.cote === 'd') { [x, y] = [W / 2 - 4, p.y]; al = 'right'; }
    else if (p.cote === 'h') { [x, y] = [p.x, -H / 2 + 10]; }
    else { [x, y] = [p.x, H / 2 - 10]; }
    const [tx, ty] = tourne(x, y);
    const r = ((el.rot || 0) % 4 + 4) % 4;
    let a = al; if (r === 2 && al !== 'center') a = al === 'left' ? 'right' : 'left';
    if ((r === 1 || r === 3) && al !== 'center') a = 'center';
    g.textAlign = a; g.fillStyle = '#cfd8d6'; g.fillText(b.etiquette, tx, ty);
    // numéro de broche le long de la patte
    let nx = p.x, ny = p.y; if (p.cote === 'g' || p.cote === 'd') { nx = (p.x + p.bx) / 2; ny = p.y - 6; } else { nx = p.x + 6; ny = (p.y + p.by) / 2; }
    const [mx, my] = tourne(nx, ny); g.textAlign = 'center'; g.fillStyle = '#6f7d7b'; g.font = '7px ui-monospace, Consolas, monospace';
    g.fillText(String(b.num), mx, my); g.font = '9px ui-monospace, Consolas, monospace';
  });
  // nom + texte d'état : sur leur ligne réservée si la puce est droite, au centre (l'un sous l'autre) si elle est tournée
  const r0 = ((el.rot || 0) % 4 + 4) % 4;
  const [nx, ny] = r0 === 0 ? [0, lay.yNom] : [0, -6];
  g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
  g.fillText(def.nom, nx, ny);
  if (def.affichage && el._etat) {
    let txt = ''; try { txt = def.affichage(el._etat, el.params) ?? ''; } catch (e) { txt = '!'; }
    if (txt !== '') { g.fillStyle = COUL.selection; g.font = 'bold 10px ui-monospace, Consolas, monospace'; g.fillText(String(txt), nx, ny + 13); }
  }
  g.restore();
}

/* ---------- Position de la puce dans le monde : point et direction locaux → monde (rotation par quarts de tour) ---------- */
function iciDe(el) {
  const tr = (x, y) => { const r = ((el.rot || 0) % 4 + 4) % 4; return r === 0 ? [x, y] : r === 1 ? [-y, x] : r === 2 ? [-x, -y] : [y, -x]; };
  return {
    get x() { return el.x; }, get y() { return el.y; }, get rot() { return el.rot || 0; }, id: el.id,
    point: (lx, ly) => { const [x, y] = tr(lx, ly); return [el.x + x, el.y + y]; },
    direction: (lx, ly) => tr(lx, ly),
  };
}

/* ---------- Valeur d'un champ : nombre, '$param', ou fonction (p, s) ---------- */
function resoudre(v, el) {
  if (typeof v === 'function') return () => v(el.params, el._etat);
  if (typeof v === 'string' && v.startsWith('$')) { const k = v.slice(1); return () => el.params[k]; }
  return v;
}

/* ---------- Traduction d'une puce en primitives du moteur ---------- */
function poserPuce(def, el, b) {
  const noeuds = {};
  def.broches.forEach((br, i) => noeuds[br.nom] = b.n(i));
  const nd = nom => {
    if (nom === undefined) throw new Error('nœud manquant');
    if (!(nom in noeuds)) noeuds[nom] = b.interne();
    return noeuds[nom];
  };
  const prims = {};
  if (!el._etat) el._etat = def.logique?.etat ? def.logique.etat(el.params) : (def.modele?.etat ? def.modele.etat(el.params) : {});
  el._entrees = el._entrees || {};
  const aCreer = [];
  for (const e of def.modele?.elements || []) {
    const o = {};
    for (const [k, v] of Object.entries(e)) if (k !== 't' && k !== 'nom' && k !== 'mesure') o[k] = resoudre(v, el);
    for (const k of CHAMPS_NOEUDS[e.t]) o[k] = nd(e[k]);
    aCreer.push([e, o]);
  }
  // chaque borne de primitive retient la broche qu'elle touche (utile quand plusieurs broches sont sur le même fil :
  // le courant de chaque LED d'une barre reste attribué à SA broche)
  const idxBroche = Object.fromEntries(def.broches.map((br, i) => [br.nom, i]));
  const marquer = (p, e) => { p._broches = CHAMPS_NOEUDS[e.t].map(k => idxBroche[e[k]] ?? -1); };
  // première passe : tout sauf F (qui doit référencer une source déjà créée)
  for (const [e, o] of aCreer) if (e.t !== 'F') { const p = b.ajouter(new P[e.t](o)); p.t = e.t; marquer(p, e); if (e.nom) prims[e.nom] = p; }
  for (const [e, o] of aCreer) if (e.t === 'F') {
    const ref = prims[e.mesure];
    if (!ref || ref.k === undefined) throw new Error(`F : « ${e.mesure} » n'est pas une source V ou A nommée`);
    o.ref = ref; const p = b.ajouter(new P.F(o)); p.t = 'F'; marquer(p, e); if (e.nom) prims[e.nom] = p;
  }
  const L = def.logique;
  if (L) {
    for (const s of L.sorties || []) {
      const p = b.ajouter(new P.O({ a: nd(s), ref: nd(L.vss), V: 0, R: 1e9 })); p.t = 'O'; prims['sortie:' + s] = p;
      p._broches = [idxBroche[s], idxBroche[L.vss]];
    }
    if (L.rEntree) for (const s of L.entrees || []) { const p = b.ajouter(new P.R({ a: nd(s), b: nd(L.vss), R: L.rEntree })); p._broches = [idxBroche[s], idxBroche[L.vss]]; }
  }
  const sim = b.sim;
  if (!el._hasard) el._hasard = Regles.aleatoire(def.id + '/' + el.nom);   // R8 : hasard reproductible, propre à chaque élément
  const c = {
    get t() { return sim.t; }, get dt() { return sim.dt; },
    get k() { return Math.round(sim.t / sim.dt); },          // numéro du pas (utile pour les tampons de retard)
    get p() { return el.params; }, get s() { return el._etat; },
    get monde() { return sim.monde; }, ici: iciDe(el),
    aleatoire: () => el._hasard(),
    get nom() { return el.nom; },
    v: nom => sim.v(nd(nom)),
    i: nom => { const p = prims[nom]; if (!p) throw new Error(`« ${nom} » : élément inconnu`); return p.k !== undefined ? sim.ib(p.k) : p.courants(sim)[0]; },
    regler: (nom, v) => {
      const p = prims[nom]; if (!p) throw new Error(`regler : « ${nom} » inconnu`);
      if (v !== null && typeof v === 'object') Object.assign(p, v); else p[CLE_PRINCIPALE[p.t]] = v;
    },
  };
  if (L || def.modele?.pas) {
    sim.actif({
      pas() {
        try {
          if (L) {
            const vss = c.v(L.vss), alim = c.v(L.vdd) - vss, vMin = L.vMin ?? 2;
            const e = { monte: {}, descend: {}, alim };
            for (const n of L.entrees || []) {
              const prec = el._entrees[n] ?? false, v = c.v(n) - vss;
              const haut = v > alim * (prec ? 0.4 : 0.6);
              e[n] = haut; e.monte[n] = haut && !prec; e.descend[n] = !haut && prec; el._entrees[n] = haut;
            }
            const sorties = alim >= vMin ? (L.evaluer(e, el._etat, el.params, c) || {}) : null;
            for (const s of L.sorties || []) {
              const p = prims['sortie:' + s];
              if (sorties === null) { p.R = 1e9; p.V = 0; continue; }
              const o = sorties[s];
              if (o === undefined) continue;
              if (o === null) { p.R = 1e9; p.V = 0; } else { p.R = L.rSortie ?? 100; p.V = o ? Math.max(0, alim - (L.chuteHaut ?? 0)) : (L.chuteBas ?? 0); }
            }
          }
          if (def.modele?.pas) def.modele.pas(c);
          el._erreur = '';
        } catch (err) { el._erreur = String(err.message || err); }
      },
    });
  }
}

/** valeur d'une variable publiée, avec son unité ; les angles sont aussi donnés en fraction de tour (2π rad) */
function texteVariable(v, x) {
  if (x === undefined || x === null) return '—';
  if ((v.type || 'num') !== 'num') return String(x);
  if (v.unite === 'rad') return Regles.unites.angle(x);
  if (v.unite === 'rad/s') return `${formater(x, 'rad/s')} (${formater(x * 60 / (2 * Math.PI), 'tr/min')})`;
  return formater(x, v.unite);
}

/* ---------- Enregistrement : produit un type utilisable comme un composant de base ---------- */
function enregistrer(brut) {
  const origine = Puces.origine;
  let def;
  try { def = normaliser(brut); }
  catch (e) { Puces.erreurs.push(`${origine} : ${e.message}`); return null; }
  if (TYPES['puce:' + def.id] && !TYPES['puce:' + def.id].puce) { Puces.erreurs.push(`${origine} : « ${def.id} » est déjà un composant de base`); return null; }
  let lay;
  try { lay = disposer(def); } catch (e) { Puces.erreurs.push(`${origine} (${def.id}) : ${e.message}`); return null; }
  const id = 'puce:' + def.id;
  const remplace = !!TYPES[id];
  const xs = Object.values(lay.pos).map(p => p.x), ys = Object.values(lay.pos).map(p => p.y);
  ajouterType(id, {
    nom: def.nom || def.id, cat: 'Puces (extensions)', sousCat: def.categorie || 'Divers', prefixe: def.prefixe || 'U', puce: true, def, lay,
    description: def.description || '', origine,
    broches: def.broches.map(b => ({ x: lay.pos[b.nom].x, y: lay.pos[b.nom].y, nom: b.nom })),
    boite: [-lay.W / 2, -lay.H / 2, lay.W / 2, lay.H / 2],
    etendue: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    params: def.params,
    typesBroches: def.typesBroches, variables: def.variables || [], modele3d: def.modele3d ?? null, mecanique: def.mecanique, version: def.version,
    tags: def.tags || [], famille: def.famille || null,
    principal: def.principal || (def.params[0] && def.params[0].type !== 'bool' ? def.params[0].cle : undefined),
    dessiner(g, el, R) { dessinerPuce(def, lay, g, el, R); },
    poser(el, b) { poserPuce(def, el, b); },
    clic: def.interaction?.clic ? el => def.interaction.clic(el._etat || (el._etat = {}), el.params) : undefined,
    appui: def.interaction?.appui ? el => def.interaction.appui(el._etat || (el._etat = {}), el.params) : undefined,
    relache: def.interaction?.relache ? el => def.interaction.relache(el._etat || (el._etat = {}), el.params) : undefined,
    reinitialiser(el) { el._etat = null; el._entrees = {}; el._hasard = null; },
    // ondes(g, x) : dessin dans le repère du MONDE (sous le schéma) : propagation radio, ultrasons…
    ondes: def.ondes ? (g, el, ctx) => def.ondes(g, { s: el._etat || {}, p: el.params, ici: iciDe(el), ...ctx }) : undefined,
    infos(el, R) {
      const l = def.broches.map((b, i) => `${b.etiquette.padEnd(6)} ${formater(R.v(i), 'V').padStart(9)}  ${formater(R.i(i), 'A').padStart(9)}`);
      for (const v of def.variables || []) l.push(`${v.nom} : ${texteVariable(v, el._etat?.[v.cle])}`);
      if (el._erreur) l.unshift('⚠ ' + el._erreur);
      return l;
    },
  });
  const ligne = { id: def.id, nom: def.nom, origine, categorie: def.categorie || 'Divers', description: def.description || '' };
  Puces.liste = Puces.liste.filter(p => p.id !== def.id); Puces.liste.push(ligne);
  if (remplace) Puces.erreurs.push(`${origine} : la puce « ${def.id} » remplace une puce déjà chargée`);
  return TYPES[id];
}

/* ---------- Chargement des fichiers d'extension ---------- */
function executer(source, fichier) {
  Puces.origine = fichier;
  try {
    if (/\.json$/i.test(fichier)) {
      const o = JSON.parse(source);
      for (const d of Array.isArray(o) ? o : [o]) enregistrer(d);
    } else {
      // le fichier n'a accès qu'à l'objet FrWA (et aux objets globaux du navigateur)
      new Function('FrWA', '"use strict";\n' + source + '\n//# sourceURL=' + fichier)(G.FrWA);
    }
  } catch (e) { Puces.erreurs.push(`${fichier} : ${e.message}`); }
  Puces.origine = 'interne';
}

const CLE_STOCKAGE = 'frwa_circuit_puces';
function pucesUtilisateur() { try { return JSON.parse(localStorage.getItem(CLE_STOCKAGE) || '[]'); } catch (e) { return []; } }
function sauverPucesUtilisateur(l) { try { localStorage.setItem(CLE_STOCKAGE, JSON.stringify(l)); } catch (e) { /* stockage indisponible */ } }

/* Les fichiers du dossier puces/ sont chargés par des balises <script> (et non par fetch) : ça marche aussi bien
   servi en http qu'ouvert directement depuis le disque (file://), où le navigateur interdit fetch.
   Un seul fichier à la fois, dans l'ordre du catalogue, pour que Puces.origine désigne le bon fichier. */
function chargerScript(fichier) {
  return new Promise(fin => {
    const el = document.createElement('script');
    // en http, un paramètre qui change à chaque chargement évite de garder une vieille version en cache
    el.src = 'puces/' + fichier + (location.protocol.startsWith('http') ? '?v=' + Date.now() : '');
    let erreur = null;
    const surErreur = ev => {
      // en file:// le navigateur masque le détail (« Script error. ») : on renvoie vers la console
      if (ev.filename && !ev.filename.includes(fichier)) return;
      erreur = ev.message && !/^Script error\.?$/i.test(ev.message) ? ev.message : 'erreur dans le fichier (détail dans la console, F12)';
      if (ev.lineno) erreur += ` (ligne ${ev.lineno})`;
    };
    window.addEventListener('error', surErreur);
    const finir = msg => { window.removeEventListener('error', surErreur); el.remove(); fin(msg || erreur); };
    el.onload = () => finir();
    el.onerror = () => finir('fichier introuvable');
    document.head.appendChild(el);
  });
}

async function chargerTout() {
  Puces.erreurs = []; Puces.conformite = [];
  // composants de base : mêmes règles (unités, types de broches, modèle 3D déclaré)
  for (const T of Object.values(TYPES)) if (!T.puce && T.cat) Puces.conformite.push({ id: T.id, nom: T.nom, origine: 'composants.js', erreurs: Regles.verifierType(T) });
  delete G.FrWACatalogue;
  const errCat = await chargerScript('catalogue.js');
  const liste = G.FrWACatalogue;
  if (errCat || !Array.isArray(liste)) Puces.erreurs.push('puces/catalogue.js : ' + (errCat || 'window.FrWACatalogue doit être une liste de noms de fichiers'));
  for (const f of Array.isArray(liste) ? liste : []) {
    if (/\.json$/i.test(f)) { Puces.erreurs.push(`${f} : un .json ne peut pas être chargé au démarrage (l'importer depuis la page, ou l'envelopper dans FrWA.puce(...) dans un .puce.js)`); continue; }
    Puces.origine = f;
    const err = await chargerScript(f);
    Puces.origine = 'interne';
    if (err) Puces.erreurs.push(`${f} : ${err}`);
  }
  for (const u of pucesUtilisateur()) executer(u.source, '★ ' + u.fichier);
}

/** importe un fichier choisi par l'utilisateur ; renvoie { ok, message } */
function importer(fichier, source) {
  const avant = Puces.erreurs.length, ids = new Set(Puces.liste.map(p => p.id));
  executer(source, '★ ' + fichier);
  const err = Puces.erreurs.slice(avant).filter(e => !/remplace/.test(e));
  if (err.length) { Puces.erreurs.length = avant; return { ok: false, message: err.join('\n') }; }
  const nouvelles = Puces.liste.filter(p => p.origine === '★ ' + fichier).map(p => p.nom);
  const l = pucesUtilisateur().filter(u => u.fichier !== fichier); l.push({ fichier, source }); sauverPucesUtilisateur(l);
  return { ok: true, message: `${nouvelles.length} puce(s) ajoutée(s) : ${nouvelles.join(', ')}` + (nouvelles.some(n => ids.has(n)) ? ' (remplacement)' : '') };
}
function oublier(fichier) { sauverPucesUtilisateur(pucesUtilisateur().filter(u => u.fichier !== fichier)); }

G.FrWA = G.FrWA || {};
G.FrWA.puce = enregistrer;
G.FrWA.formater = formater;   // utilitaire offert aux extensions : FrWA.formater(0.0123, 'A') → « 12,3 mA »
G.FrWA.unites = Regles.unites;   // FrWA.unites.rad(90) → π/2, FrWA.unites.angle(Math.PI / 2) → « 90° (π/2 rad) »
G.FrWA.regles = Regles.VERSION;
G.FrWAPuces = { Puces, chargerTout, importer, oublier, pucesUtilisateur, texteVariable };
})(window);
