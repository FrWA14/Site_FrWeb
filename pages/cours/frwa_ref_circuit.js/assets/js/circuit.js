/* frwa_flow-Circuit — circuit.js
   Le schéma (éléments posés sur la grille + fils), sa normalisation (un fil est coupé là où une broche ou
   l'extrémité d'un autre fil le touche), sa compilation en simulation, et le calcul des courants affichés
   (points jaunes) : courant de chaque broche d'après les primitives, puis courant de chaque fil par un arbre
   couvrant de chaque réseau de fils (comme Circuit.js, sans ajouter de source 0 V par fil). */
'use strict';
(function (G) {
const { TYPES } = G.FrWAComposants;
const { Simulation } = G.FrWAMoteur;

function tourner(x, y, r) { r = ((r % 4) + 4) % 4; return r === 0 ? [x, y] : r === 1 ? [-y, x] : r === 2 ? [-x, -y] : [y, -x]; }
const cle = (x, y) => x + ',' + y;

class Schema {
  constructor() { this.elements = []; this.fils = []; this.dt = 5e-5; this.prochainId = 1; this.titre = ''; this.oscillo = []; }
  nouvelId() { return this.prochainId++; }
  nomLibre(prefixe) { const pris = new Set(this.elements.map(e => e.nom)); let n = 1; while (pris.has(prefixe + n)) n++; return prefixe + n; }

  ajouter(type, x, y, rot = 0, params = {}, nom) {
    const T = TYPES[type];
    if (!T) throw new Error(`type inconnu : ${type}`);
    const el = { id: this.nouvelId(), type, x, y, rot, params: {}, nom: nom || this.nomLibre(T.prefixe) };
    for (const p of T.params || []) el.params[p.cle] = p.defaut;
    Object.assign(el.params, params);
    this.elements.push(el);
    return el;
  }
  ajouterFil(x1, y1, x2, y2) {
    if (x1 === x2 && y1 === y2) return null;
    const f = { id: this.nouvelId(), type: 'fil', x1, y1, x2, y2 };
    this.fils.push(f);
    return f;
  }
  supprimer(o) {
    if (o.type === 'fil') this.fils = this.fils.filter(f => f !== o);
    else this.elements = this.elements.filter(e => e !== o);
  }
  broches(el) {
    const T = TYPES[el.type];
    return (T?.broches || []).map(b => { const [x, y] = tourner(b.x, b.y, el.rot); return { x: el.x + x, y: el.y + y, nom: b.nom }; });
  }

  /** coupe les fils aux points de contact, supprime les fils nuls et les doublons */
  normaliser() {
    const vus = new Set();
    this.fils = this.fils.filter(f => {
      if (f.x1 === f.x2 && f.y1 === f.y2) return false;
      const k = [cle(f.x1, f.y1), cle(f.x2, f.y2)].sort().join('|');
      if (vus.has(k)) return false; vus.add(k); return true;
    });
    let change = true, garde = 0;
    while (change && garde++ < 200) {
      change = false;
      const points = [];
      for (const el of this.elements) for (const b of this.broches(el)) points.push(b);
      for (const f of this.fils) { points.push({ x: f.x1, y: f.y1 }); points.push({ x: f.x2, y: f.y2 }); }
      for (const f of this.fils) {
        const dx = f.x2 - f.x1, dy = f.y2 - f.y1, L2 = dx * dx + dy * dy;
        const p = points.find(p => {
          const px = p.x - f.x1, py = p.y - f.y1;
          if (px * dy - py * dx !== 0) return false;
          const t = px * dx + py * dy;
          return t > 0 && t < L2;
        });
        if (p) {
          this.fils = this.fils.filter(x => x !== f);
          this.ajouterFil(f.x1, f.y1, p.x, p.y); this.ajouterFil(p.x, p.y, f.x2, f.y2);
          change = true; break;
        }
      }
    }
  }

  serialiser() {
    return {
      format: 'frwa-circuit', version: 1, titre: this.titre, dt: this.dt,
      elements: this.elements.map(e => ({ type: e.type, nom: e.nom, x: e.x, y: e.y, rot: e.rot, params: { ...e.params },
        ...(e.sansPastille ? { sansPastille: true } : {}), ...(e.pastille ? { pastille: e.pastille } : {}), ...(e.inverse ? { inverse: true } : {}), ...(e.indicateur ? { indicateur: e.indicateur } : {}), ...(e.indicateur && e.indicateurPos ? { indicateurPos: [...e.indicateurPos] } : {}) })),
      fils: this.fils.map(f => [f.x1, f.y1, f.x2, f.y2]),
      oscillo: this.oscillo, monde: this.monde || {},
    };
  }
  /** charge un schéma ; renvoie la liste des types manquants (puces non installées) */
  charger(o) {
    this.elements = []; this.fils = []; this.prochainId = 1;
    this.dt = o.dt || 5e-5; this.titre = o.titre || ''; this.oscillo = o.oscillo || []; this.monde = { ...(o.monde || {}) };
    const manquants = [];
    for (const e of o.elements || []) {
      if (!TYPES[e.type]) { manquants.push(e.type); continue; }
      const n = this.ajouter(e.type, e.x, e.y, e.rot || 0, e.params || {}, e.nom);
      if (e.sansPastille) n.sansPastille = true;
      if (e.pastille) n.pastille = e.pastille;
      if (e.inverse) n.inverse = true;
      if (e.indicateur) n.indicateur = String(e.indicateur);   // repère libre de l'utilisateur, affiché seulement
      if (e.indicateur && Array.isArray(e.indicateurPos)) n.indicateurPos = e.indicateurPos.slice(0, 2).map(Number);   // centre relatif au composant
    }
    for (const [x1, y1, x2, y2] of o.fils || []) this.ajouterFil(x1, y1, x2, y2);
    this.normaliser();
    return [...new Set(manquants)];
  }
}

/* ---------- Compilation : schéma → simulation ---------- */
function compiler(schema) {
  const sim = new Simulation(); sim.dt = schema.dt;
  sim.monde = new G.FrWAMonde.Monde(schema);
  const parent = new Map();
  const trouver = k => { let r = k; while (parent.get(r) !== r) r = parent.get(r); let c = k; while (parent.get(c) !== r) { const n = parent.get(c); parent.set(c, r); c = n; } return r; };
  const ajouterPoint = k => { if (!parent.has(k)) parent.set(k, k); };
  const unir = (a, b) => { const ra = trouver(a), rb = trouver(b); if (ra !== rb) parent.set(ra, rb); };

  const brochesEl = new Map();
  for (const el of schema.elements) { const bs = schema.broches(el); brochesEl.set(el, bs); for (const b of bs) ajouterPoint(cle(b.x, b.y)); }
  for (const f of schema.fils) { const a = cle(f.x1, f.y1), b = cle(f.x2, f.y2); ajouterPoint(a); ajouterPoint(b); unir(a, b); }
  // étiquettes de réseau : même nom = même nœud (liaisons « virtuelles », aussi utilisées pour répartir les courants)
  const liensVirtuels = [];
  const parNom = new Map();
  for (const el of schema.elements) if (TYPES[el.type]?.etiquette) {
    const b = brochesEl.get(el)[0], k = cle(b.x, b.y), n = String(el.params.nom || '');
    if (parNom.has(n)) { unir(parNom.get(n), k); liensVirtuels.push([parNom.get(n), k]); } else parNom.set(n, k);
  }

  // masse
  const noeudDe = new Map();
  let avertissement = '';
  const masses = schema.elements.filter(e => TYPES[e.type]?.masse);
  for (const m of masses) for (const b of brochesEl.get(m)) noeudDe.set(trouver(cle(b.x, b.y)), 0);
  if (!masses.length && schema.elements.length) {
    const src = schema.elements.find(e => ['pile', 'source_ac', 'horloge', 'source_mod'].includes(e.type)) || schema.elements.find(e => brochesEl.get(e).length);
    if (src) {
      const b = brochesEl.get(src)[0];
      noeudDe.set(trouver(cle(b.x, b.y)), 0);
      avertissement = 'Pas de masse : la référence 0 V est prise sur ' + src.nom + '.';
    }
  }
  const noeud = k => { const r = trouver(k); if (!noeudDe.has(r)) noeudDe.set(r, sim.noeud()); return noeudDe.get(r); };

  // éléments → primitives
  for (const el of schema.elements) {
    const T = TYPES[el.type], bs = brochesEl.get(el);
    el._noeuds = bs.map(b => noeud(cle(b.x, b.y)));
    el._prims = []; el._erreur = '';
    el._i = new Array(bs.length).fill(0);
    el._cc = el._cc && el._cc.length === bs.length ? el._cc : new Array(bs.length).fill(0);
    const b = { n: i => el._noeuds[i], interne: () => sim.noeud(), ajouter: p => { el._prims.push(p); return sim.ajouter(p); }, sim };
    try { T.poser(el, b); } catch (e) { el._erreur = e.message; }
  }
  for (const f of schema.fils) { f._noeud = noeud(cle(f.x1, f.y1)); f._i = 0; f._cc = f._cc || 0; }

  // arbres couvrants des réseaux de fils (pour répartir les courants dans les fils)
  const adj = new Map();
  for (const f of schema.fils) {
    const a = cle(f.x1, f.y1), b = cle(f.x2, f.y2);
    if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push([b, f]); adj.get(b).push([a, f]);
  }
  const pointsMasse = new Set(); for (const m of masses) for (const b of brochesEl.get(m)) pointsMasse.add(cle(b.x, b.y));
  // liaisons virtuelles : étiquettes de même nom, et toutes les masses entre elles (le courant « traverse » la masse)
  const lm = [...pointsMasse]; for (let i = 1; i < lm.length; i++) liensVirtuels.push([lm[0], lm[i]]);
  for (const [a, b] of liensVirtuels) {
    if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push([b, null]); adj.get(b).push([a, null]);
  }
  const ordre = [], vus = new Set();
  const departs = [...[...adj.keys()].filter(k => pointsMasse.has(k)), ...adj.keys()];
  for (const r of departs) {
    if (vus.has(r)) continue;
    vus.add(r); const file = [r]; ordre.push({ k: r, f: null, p: null });
    while (file.length) {
      const u = file.shift();
      for (const [v, f] of adj.get(u)) { if (vus.has(v)) continue; vus.add(v); ordre.push({ k: v, f, p: u }); file.push(v); }
    }
  }

  sim.preparer();
  return { sim, ordre, brochesEl, avertissement };
}

/* ---------- Courants : broches puis fils ---------- */
function calculerCourants(compil, schema) {
  const sim = compil.sim;
  const inj = new Map();
  for (const el of schema.elements) {
    const n = el._noeuds; if (!n) continue;
    const I = new Array(n.length).fill(0);
    for (const p of el._prims || []) {
      let cs; try { cs = p.courants(sim); } catch (e) { continue; }
      for (let k = 0; k < p.n.length; k++) {
        const i = p._broches ? p._broches[k] : n.indexOf(p.n[k]);
        if (i >= 0 && Number.isFinite(cs[k])) I[i] += cs[k];
      }
    }
    el._i = I;
    const bs = compil.brochesEl.get(el) || [];
    bs.forEach((b, i) => { const k = cle(b.x, b.y); inj.set(k, (inj.get(k) || 0) + I[i]); });
  }
  const sous = new Map();
  for (const f of schema.fils) f._i = 0;
  for (let j = compil.ordre.length - 1; j >= 0; j--) {
    const o = compil.ordre[j];
    const s = (inj.get(o.k) || 0) + (sous.get(o.k) || 0);
    if (o.p !== null) {
      if (o.f) o.f._i = cle(o.f.x1, o.f.y1) === o.p ? s : -s;   // liaison virtuelle (o.f null) : rien à dessiner
      sous.set(o.p, (sous.get(o.p) || 0) + s);
    }
  }
}

G.FrWACircuit = { Schema, compiler, calculerCourants, tourner, cle };
})(window);
