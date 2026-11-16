/* frwa_flow-Circuit — moteur.js
   Moteur de simulation par analyse nodale modifiée (MNA), même principe que Circuit.js (Falstad) :
   - le circuit devient A·x = B (x = tensions des nœuds + courants des sources de tension) ;
   - à chaque pas de temps, chaque primitive « tamponne » (stamp) sa contribution dans A et B ;
   - les primitives non linéaires (diode, transistor) sont linéarisées et on itère (Newton-Raphson) ;
   - condensateurs et bobines = modèle compagnon (méthode des trapèzes).
   Ce fichier ne connaît ni le dessin ni les puces : il ne voit que des primitives reliées à des nœuds.
   Nœud 0 = masse. Toutes les valeurs peuvent être des nombres ou des fonctions (lues à chaque pas : la molette agit en direct). */
'use strict';
(function (G) {

const VT = 0.025852;      // tension thermique à 27 °C
const GMIN = 1e-11;       // conductance de fuite vers la masse sur chaque nœud (évite les nœuds flottants)
const MAX_ITER = 60;
const LIN_OA = 0.8;           // part linéaire de la plage de sortie de l'ALI (primitive OA)

const val = v => (typeof v === 'function' ? v() : v);

/* ---------- Résolution : Gauss avec pivot partiel (matrices petites, pleines) ---------- */
/* ---------- Système : outils de « stamping » ---------- */
/* Matrice à plat M[ligne·n + colonne]. La matrice MNA est presque vide (≈ 3 non-nuls par ligne) et sa structure ne
   change pas d'un pas à l'autre : la première résolution (ou après un changement de structure) se fait par élimination
   de Gauss à pivot partiel complète, qui fixe l'ordre des pivots ; on en déduit le plan de factorisation (lignes et
   colonnes non nulles à chaque étape, remplissage compris). Les résolutions suivantes ne touchent que ces cases.
   Si un pivot devient trop petit (< 1/1000 du plus grand de sa colonne), on refait l'élimination complète. */
class Systeme {
  constructor(nNoeuds, nBranches) {
    this.N = nNoeuds; const n = this.taille = nNoeuds - 1 + nBranches;
    this.M = new Float64Array(n * n); this.B = new Float64Array(n);
    this.motif = new Uint8Array(n * n); this.motifNeuf = true;      // cases déjà écrites (structure)
    this.sauveM = new Float64Array(n * n); this.sauveB = new Float64Array(n);
    this.perm = new Int32Array(n); this.plan = null; this.plans = [];
  }
  effacer() { this.M.fill(0); this.B.fill(0); }
  iN(n) { return n - 1; }                       // index matrice d'un nœud (−1 = masse)
  iB(k) { return this.N - 1 + k; }              // index matrice d'une branche
  a(r, c, v) {
    if (r < 0 || c < 0) return;
    const i = r * this.taille + c; this.M[i] += v;
    if (!this.motif[i]) { this.motif[i] = 1; this.motifNeuf = true; }
  }
  /** résout M·x = B ; renvoie x (Float64Array) ou null si le système est singulier */
  resoudre() {
    if (this.motifNeuf) { this.plans = []; this.plan = null; }
    if (this.plan) {
      // plan courant, puis les autres plans déjà analysés (un ALI qui sature et revient alterne entre deux ordres de pivots)
      this.sauveM.set(this.M); this.sauveB.set(this.B);
      for (const p of [this.plan, ...this.plans.filter(q => q !== this.plan)]) {
        if (p !== this.plan) { this.M.set(this.sauveM); this.B.set(this.sauveB); this.plan = p; }
        this.perm.set(p.perm);
        const x = this.resoudrePlan(); if (x) return x;
      }
      this.M.set(this.sauveM); this.B.set(this.sauveB);
    }
    const x = this.resoudreDense();
    if (!x) { this.plan = null; return x; }
    const cle = this.perm.join(',');
    this.plan = this.plans.find(p => p.cle === cle) || null;
    if (!this.plan) { this.analyser(); this.plan.cle = cle; this.plans.unshift(this.plan); this.plans.length = Math.min(this.plans.length, 6); }
    this.motifNeuf = false;
    return x;
  }
  resoudreDense() {
    const n = this.taille, M = this.M, B = this.B, perm = this.perm, nz = new Int32Array(n);
    for (let i = 0; i < n; i++) perm[i] = i;
    for (let c = 0; c < n; c++) {
      let pi = c, m = Math.abs(M[perm[c] * n + c]);
      for (let i = c + 1; i < n; i++) { const a = Math.abs(M[perm[i] * n + c]); if (a > m) { m = a; pi = i; } }
      if (m < 1e-300) return null;
      if (pi !== c) { const t = perm[pi]; perm[pi] = perm[c]; perm[c] = t; }
      const oc = perm[c] * n, piv = M[oc + c], bc = B[perm[c]];
      let nnz = 0; for (let k = c + 1; k < n; k++) if (M[oc + k] !== 0) nz[nnz++] = k;
      for (let i = c + 1; i < n; i++) {
        const r = perm[i], or = r * n, v = M[or + c]; if (v === 0) continue;
        const f = v / piv; M[or + c] = 0;
        for (let q = 0; q < nnz; q++) { const k = nz[q]; M[or + k] -= f * M[oc + k]; }
        B[r] -= f * bc;
      }
    }
    const x = new Float64Array(n);
    for (let c = n - 1; c >= 0; c--) {
      const o = perm[c] * n; let s = B[perm[c]];
      for (let k = c + 1; k < n; k++) { const v = M[o + k]; if (v !== 0) s -= v * x[k]; }
      x[c] = s / M[o + c];
    }
    for (let i = 0; i < n; i++) if (!Number.isFinite(x[i])) return null;
    return x;
  }
  analyser() {
    // plan à plat : pour l'étape c, lignes à éliminer L[dL[c]..dL[c+1]) (indices de ligne) et colonnes non nulles de la
    // ligne pivot K[dK[c]..dK[c+1]) (colonnes > c), remplissage compris
    const n = this.taille, S = Uint8Array.from(this.motif), perm = this.perm, L = [], K = [], dL = [0], dK = [0];
    for (let c = 0; c < n; c++) {
      const oc = perm[c] * n, cols = [];
      for (let k = c + 1; k < n; k++) if (S[oc + k]) cols.push(k);
      for (let i = c + 1; i < n; i++) { const r = perm[i]; if (S[r * n + c]) { L.push(r); for (const k of cols) S[r * n + k] = 1; } }
      K.push(...cols); dL.push(L.length); dK.push(K.length);
    }
    this.plan = { perm: Int32Array.from(perm), L: Int32Array.from(L), K: Int32Array.from(K), dL: Int32Array.from(dL), dK: Int32Array.from(dK) };
  }
  resoudrePlan() {
    const n = this.taille, M = this.M, B = this.B, perm = this.perm, { L, K, dL, dK } = this.plan;
    for (let c = 0; c < n; c++) {
      const pr = perm[c], oc = pr * n, piv = M[oc + c], l0 = dL[c], l1 = dL[c + 1], k0 = dK[c], k1 = dK[c + 1];
      let mx = Math.abs(piv); for (let j = l0; j < l1; j++) { const a = Math.abs(M[L[j] * n + c]); if (a > mx) mx = a; }
      if (mx < 1e-300 || !(Math.abs(piv) >= 1e-3 * mx)) return null;
      const bc = B[pr];
      for (let j = l0; j < l1; j++) {
        const r = L[j], or = r * n, v = M[or + c]; if (v === 0) continue;
        const f = v / piv;
        for (let q = k0; q < k1; q++) { const k = K[q]; M[or + k] -= f * M[oc + k]; }
        B[r] -= f * bc;
      }
    }
    const x = new Float64Array(n);
    for (let c = n - 1; c >= 0; c--) {
      const pr = perm[c], o = pr * n; let s = B[pr];
      for (let q = dK[c]; q < dK[c + 1]; q++) { const k = K[q]; s -= M[o + k] * x[k]; }
      x[c] = s / M[o + c];
    }
    for (let i = 0; i < n; i++) if (!Number.isFinite(x[i])) return null;
    return x;
  }
  b(r, v) { if (r >= 0) this.B[r] += v; }
  /** conductance g entre les nœuds a et b */
  conductance(na, nb, g) { const a = na - 1, b = nb - 1; this.a(a, a, g); this.a(b, b, g); this.a(a, b, -g); this.a(b, a, -g); }
  /** source de courant : I circule de a vers b à travers la source */
  courant(na, nb, I) { this.b(na - 1, -I); this.b(nb - 1, I); }
  /** source de tension v(a) − v(b) = V, branche k (courant de branche : de a vers b à travers la source) */
  tension(k, na, nb, V) { const r = this.iB(k), a = na - 1, b = nb - 1; this.a(a, r, 1); this.a(b, r, -1); this.a(r, a, 1); this.a(r, b, -1); this.b(r, V); }
  /** source de tension commandée en tension : v(a) − v(b) = gain·(v(c) − v(d)) */
  vcvs(k, na, nb, nc, nd, gain) { const r = this.iB(k), a = na - 1, b = nb - 1; this.a(a, r, 1); this.a(b, r, -1); this.a(r, a, 1); this.a(r, b, -1); this.a(r, nc - 1, -gain); this.a(r, nd - 1, gain); }
  /** source de courant commandée en courant : gain·i(branche kref) de a vers b */
  cccs(na, nb, kref, gain) { const r = this.iB(kref); this.a(na - 1, r, gain); this.a(nb - 1, r, -gain); }
  /** source de courant commandée en tension : gm·(v(c) − v(d)) de a vers b */
  vccs(na, nb, nc, nd, gm) { const a = na - 1, b = nb - 1, c = nc - 1, d = nd - 1; this.a(a, c, gm); this.a(a, d, -gm); this.a(b, c, -gm); this.a(b, d, gm); }
  /** dipôle/tripôle non linéaire linéarisé : I0[k] = courant entrant dans le composant par la borne k,
      J[k][j] = dI_k/dv_j, au point de fonctionnement v0 */
  nonLineaire(noeuds, I0, J, v0) {
    for (let k = 0; k < noeuds.length; k++) {
      const r = noeuds[k] - 1; if (r < 0) continue;
      let s = I0[k];
      for (let j = 0; j < noeuds.length; j++) { this.a(r, noeuds[j] - 1, J[k][j]); s -= J[k][j] * v0[j]; }
      this.b(r, -s);
    }
  }
}

/* ---------- Limitation de tension de jonction (pnjlim, comme SPICE) ---------- */
function pnjlim(vnew, vold, nvt, vcrit) {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * nvt) {
    if (vold > 0) { const arg = 1 + (vnew - vold) / nvt; vnew = arg > 0 ? vold + nvt * Math.log(arg) : vcrit; }
    else vnew = nvt * Math.log(vnew / nvt);
  }
  return vnew;
}

/* ---------- Primitives ----------
   Chaque primitive : n (tableau de nœuds), branches (nombre de courants inconnus), stamp(S, sim),
   verifier(x, sim) (non linéaires : true si convergé), accepter(sim) (fin de pas), courants(sim) (courant entrant par chaque borne). */
const Prim = {};

Prim.R = class { // résistance
  constructor(o) { this.n = [o.a, o.b]; this.R = o.R; }
  stamp(S) { S.conductance(this.n[0], this.n[1], 1 / Math.max(1e-9, val(this.R))); }
  courants(sim) { const i = (sim.v(this.n[0]) - sim.v(this.n[1])) / Math.max(1e-9, val(this.R)); return [i, -i]; }
};

Prim.C = class { // condensateur (trapèzes) ; V0 = tension initiale optionnelle
  // euler : Euler implicite (amorti) au lieu des trapèzes, pour les pôles internes bien plus rapides que le pas
  // (ALI à 10 MHz simulé à 16 kHz : les trapèzes y laisseraient une oscillation de ±1 à chaque pas)
  constructor(o) { this.n = [o.a, o.b]; this.C = o.C; this.vp = val(o.V0) || 0; this.ip = 0; this.euler = !!o.euler; }
  stamp(S, sim) {
    if (this.euler) { const g = val(this.C) / sim.dt; S.conductance(this.n[0], this.n[1], g); S.courant(this.n[0], this.n[1], -g * this.vp); return; }
    const g = 2 * val(this.C) / sim.dt; S.conductance(this.n[0], this.n[1], g); S.courant(this.n[0], this.n[1], -(g * this.vp + this.ip));
  }
  accepter(sim) {
    const v = sim.v(this.n[0]) - sim.v(this.n[1]);
    if (this.euler) { this.ip = val(this.C) / sim.dt * (v - this.vp); this.vp = v; return; }
    const g = 2 * val(this.C) / sim.dt; this.ip = g * (v - this.vp) - this.ip; this.vp = v;
  }
  courants() { return [this.ip, -this.ip]; }
};

Prim.L = class { // bobine (trapèzes)
  constructor(o) { this.n = [o.a, o.b]; this.L = o.L; this.vp = 0; this.ip = 0; }
  stamp(S, sim) { const g = sim.dt / (2 * val(this.L)); S.conductance(this.n[0], this.n[1], g); S.courant(this.n[0], this.n[1], this.ip + g * this.vp); }
  accepter(sim) { const v = sim.v(this.n[0]) - sim.v(this.n[1]), g = sim.dt / (2 * val(this.L)); this.ip = this.ip + g * (v + this.vp); this.vp = v; }
  courants() { return [this.ip, -this.ip]; }
};

Prim.V = class { // source de tension (V peut dépendre du temps : fonction de sim.t via forme(t))
  constructor(o) { this.n = [o.a, o.b]; this.V = o.V ?? 0; this.forme = o.forme || null; this.branches = 1; }
  valeur(sim) { return this.forme ? this.forme(sim.t) : val(this.V); }
  stamp(S, sim) { S.tension(this.k, this.n[0], this.n[1], this.valeur(sim)); }
  courants(sim) { const j = sim.ib(this.k); return [j, -j]; }
};

Prim.A = class extends Prim.V { // ampèremètre = source 0 V (sert de capteur de courant)
  constructor(o) { super({ a: o.a, b: o.b, V: 0 }); }
};

Prim.I = class { // source de courant (de a vers b à travers la source)
  constructor(o) { this.n = [o.a, o.b]; this.I = o.I ?? 0; }
  stamp(S) { S.courant(this.n[0], this.n[1], val(this.I)); }
  courants() { const i = val(this.I); return [i, -i]; }
};

Prim.S = class { // interrupteur commandé
  constructor(o) { this.n = [o.a, o.b]; this.ferme = o.ferme ?? false; this.Ron = o.Ron ?? 0.05; this.Roff = o.Roff ?? 1e9; }
  R() { return val(this.ferme) ? val(this.Ron) : val(this.Roff); }
  stamp(S) { S.conductance(this.n[0], this.n[1], 1 / this.R()); }
  courants(sim) { const i = (sim.v(this.n[0]) - sim.v(this.n[1])) / this.R(); return [i, -i]; }
};

Prim.O = class { // sortie pilotée (Thévenin) : V en série avec R, entre a et ref
  constructor(o) { this.n = [o.a, o.ref]; this.V = o.V ?? 0; this.R = o.R ?? 50; }
  stamp(S) { const R = Math.max(1e-6, val(this.R)), g = 1 / R; S.conductance(this.n[0], this.n[1], g); S.courant(this.n[1], this.n[0], val(this.V) * g); }
  courants(sim) { const i = (sim.v(this.n[0]) - sim.v(this.n[1]) - val(this.V)) / Math.max(1e-6, val(this.R)); return [i, -i]; }
};

Prim.E = class { // VCVS : v(a)−v(b) = gain·(v(pa)−v(pb))
  constructor(o) { this.n = [o.a, o.b, o.pa, o.pb]; this.gain = o.gain ?? 1; this.branches = 1; }
  stamp(S) { S.vcvs(this.k, this.n[0], this.n[1], this.n[2], this.n[3], val(this.gain)); }
  courants(sim) { const j = sim.ib(this.k); return [j, -j, 0, 0]; }
};

Prim.F = class { // CCCS : gain·i(mesure) de a vers b ; « mesure » = une primitive V ou A (résolue à la construction)
  constructor(o) { this.n = [o.a, o.b]; this.gain = o.gain ?? 1; this.ref = o.ref; }
  stamp(S) { S.cccs(this.n[0], this.n[1], this.ref.k, val(this.gain)); }
  courants(sim) { const i = val(this.gain) * sim.ib(this.ref.k); return [i, -i]; }
};

Prim.G = class { // VCCS : gm·(v(pa)−v(pb)) de a vers b
  constructor(o) { this.n = [o.a, o.b, o.pa, o.pb]; this.gm = o.gm ?? 1e-3; }
  stamp(S) { S.vccs(this.n[0], this.n[1], this.n[2], this.n[3], val(this.gm)); }
  courants(sim) { const i = val(this.gm) * (sim.v(this.n[2]) - sim.v(this.n[3])); return [i, -i, 0, 0]; }
};

Prim.D = class { // diode : anode a, cathode b ; Is, n (coefficient d'émission), ou Vf (tension directe à If)
  constructor(o) {
    this.n = [o.a, o.b]; this.nonLin = true;
    this.N = val(o.N) ?? 1;
    this.Is = o.Is ?? 1e-14;
    if (o.Vf !== undefined) { const If = o.If ?? 0.02; this.Is = () => val(If) / Math.exp(val(o.Vf) / (this.N * VT)); }
    this.vd = 0; this.vdIt = 0;
  }
  calc(vd) { const nvt = this.N * VT, Is = val(this.Is), e = Math.exp(Math.min(vd / nvt, 80)); return { id: Is * (e - 1), gd: Is / nvt * e + GMIN }; }
  stamp(S, sim) {
    const nvt = this.N * VT, Is = val(this.Is), vcrit = nvt * Math.log(nvt / (Math.SQRT2 * Is));
    const brut = sim.v(this.n[0]) - sim.v(this.n[1]);
    this.vdIt = sim.iter === 0 ? this.vd : pnjlim(brut, this.vdIt, nvt, vcrit);
    const { id, gd } = this.calc(this.vdIt), vb = sim.v(this.n[1]);
    S.nonLineaire(this.n, [id, -id], [[gd, -gd], [-gd, gd]], [vb + this.vdIt, vb]);
  }
  verifier(sim) {
    const vd = sim.v(this.n[0]) - sim.v(this.n[1]);
    if (Math.abs(vd - this.vdIt) < 1e-6 + 1e-4 * Math.abs(this.vdIt)) return true;
    // ou critère en courant (comme SPICE) : le courant de la linéarisation colle au vrai courant. Une diode bloquée
    // dont la tension inverse bouge (bridage d'un ALI) converge ainsi dès la première itération.
    const a = this.calc(this.vdIt), b = this.calc(vd);
    return Math.abs(b.id - (a.id + a.gd * (vd - this.vdIt))) < 1e-12 + 1e-3 * Math.abs(b.id);
  }
  accepter(sim) { this.vd = sim.v(this.n[0]) - sim.v(this.n[1]); }
  courants(sim) { const { id } = this.calc(sim.v(this.n[0]) - sim.v(this.n[1])); return [id, -id]; }
};

Prim.Q = class { // transistor bipolaire (Ebers-Moll), bornes [c, b, e] ; pnp = true pour un PNP
  constructor(o) {
    this.n = [o.c, o.b, o.e]; this.nonLin = true;
    this.beta = o.beta ?? 100; this.betaR = o.betaR ?? 1; this.Is = o.Is ?? 1e-14; this.s = o.pnp ? -1 : 1;
    this.vbe = 0; this.vbc = 0; this.vbeIt = 0; this.vbcIt = 0;
  }
  calc(vbe, vbc) {
    const Is = val(this.Is), bf = val(this.beta), br = val(this.betaR);
    const ebe = Math.exp(Math.min(vbe / VT, 80)), ebc = Math.exp(Math.min(vbc / VT, 80));
    const Ic = Is * (ebe - ebc) - Is / br * (ebc - 1);
    const Ib = Is / bf * (ebe - 1) + Is / br * (ebc - 1);
    return {
      Ic, Ib,
      dIc_be: Is / VT * ebe, dIc_bc: -Is / VT * ebc - Is / (br * VT) * ebc,
      dIb_be: Is / (bf * VT) * ebe + GMIN, dIb_bc: Is / (br * VT) * ebc + GMIN,
    };
  }
  stamp(S, sim) {
    const s = this.s, Is = val(this.Is), vcrit = VT * Math.log(VT / (Math.SQRT2 * Is));
    const vc = sim.v(this.n[0]), vb = sim.v(this.n[1]), ve = sim.v(this.n[2]);
    if (sim.iter === 0) { this.vbeIt = this.vbe; this.vbcIt = this.vbc; }
    else { this.vbeIt = pnjlim(s * (vb - ve), this.vbeIt, VT, vcrit); this.vbcIt = pnjlim(s * (vb - vc), this.vbcIt, VT, vcrit); }
    const r = this.calc(this.vbeIt, this.vbcIt);
    const Ic = s * r.Ic, Ib = s * r.Ib, Ie = -(Ic + Ib);
    // dérivées par rapport à vc, vb, ve (vbe = s(vb−ve), vbc = s(vb−vc), s² = 1)
    const Jc = [-r.dIc_bc, r.dIc_be + r.dIc_bc, -r.dIc_be];
    const Jb = [-r.dIb_bc, r.dIb_be + r.dIb_bc, -r.dIb_be];
    const Je = [-(Jc[0] + Jb[0]), -(Jc[1] + Jb[1]), -(Jc[2] + Jb[2])];
    const ve0 = ve, vb0 = ve0 + s * this.vbeIt, vc0 = vb0 - s * this.vbcIt;
    S.nonLineaire(this.n, [Ic, Ib, Ie], [Jc, Jb, Je], [vc0, vb0, ve0]);
  }
  verifier(sim) {
    const s = this.s, vc = sim.v(this.n[0]), vb = sim.v(this.n[1]), ve = sim.v(this.n[2]);
    const ok = (a, b) => Math.abs(a - b) < 1e-6 + 1e-4 * Math.abs(b);
    return ok(s * (vb - ve), this.vbeIt) && ok(s * (vb - vc), this.vbcIt);
  }
  accepter(sim) { const s = this.s, vc = sim.v(this.n[0]), vb = sim.v(this.n[1]), ve = sim.v(this.n[2]); this.vbe = s * (vb - ve); this.vbc = s * (vb - vc); }
  courants(sim) {
    const s = this.s, vc = sim.v(this.n[0]), vb = sim.v(this.n[1]), ve = sim.v(this.n[2]);
    const r = this.calc(s * (vb - ve), s * (vb - vc)); const Ic = s * r.Ic, Ib = s * r.Ib;
    return [Ic, Ib, -(Ic + Ib)];
  }
};

Prim.OA = class { // ampli-op / comparateur : sortie interne s = f(v(p) − v(n)), saturée entre les rails vn et vp − chute
  // bornes [p, n, s, vp, vn] ; la sortie réelle passe par une résistance de sortie placée dans la puce
  constructor(o) {
    this.n = [o.p, o.n, o.s, o.vp, o.vn]; this.branches = 1; this.nonLin = true;
    this.A = o.A ?? 1e5; this.chuteHaut = o.chuteHaut ?? 1.5; this.chuteBas = o.chuteBas ?? 0.02; this.vdIt = 0;
  }
  rails(sim) { const vn = sim.v(this.n[4]), vp = sim.v(this.n[3]); const lo = vn + val(this.chuteBas), hi = Math.max(lo + 1e-3, vp - val(this.chuteHaut)); return [lo, hi]; }
  // caractéristique : linéaire sur 80 % de la plage de sortie, puis saturation douce (tanh) vers les rails ; pente A au
  // centre, dérivée continue. Linéaire au milieu : un ALI bouclé converge en une itération de Newton par pas.
  f(vd, lo, hi) {
    const span = hi - lo, x = Math.max(-40, Math.min(40, 2 * val(this.A) * vd / span)), ax = Math.abs(x);
    let t = x, d = 1;
    if (ax > LIN_OA) { const th = Math.tanh((ax - LIN_OA) / (1 - LIN_OA)); t = Math.sign(x) * (LIN_OA + (1 - LIN_OA) * th); d = 1 - th * th; }
    return { y: lo + span * 0.5 * (1 + t), g: val(this.A) * d };
  }
  stamp(S, sim) {
    const [lo, hi] = this.rails(sim);
    // limitation du pas de Newton (comme pnjlim pour les diodes) : l'argument de tanh ne bouge que de ±6 par itération,
    // sauf si l'ancien et le nouveau point sont tous deux en saturation du même côté.
    // L'ancien point est d'abord ramené dans [−20, 20] (au-delà, tanh vaut ±1 : même sortie) ; sinon une sortie saturée
    // loin du seuil (x = −5000) ne remonterait que de 6 par itération et ne basculerait jamais dans le pas.
    const vdNew = sim.v(this.n[0]) - sim.v(this.n[1]), k = 2 * val(this.A) / (hi - lo);
    if (sim.iter === 0 || this.vdIt === undefined) this.vdIt = vdNew;
    else {
      const xo = Math.max(-20, Math.min(20, k * this.vdIt)), xn = k * vdNew;
      const sature = (xo >= 20 && xn > 20) || (xo <= -20 && xn < -20);
      const L = Math.abs(xo) > 6 ? 6 : 1.5;     // près du coude de tanh, pas fin : un ampli bouclé (gain ×22…) n'y oscille plus
      this.vdIt = sature ? vdNew : Math.max(xo - L, Math.min(xo + L, xn)) / k;
    }
    let { y, g } = this.f(this.vdIt, lo, hi);
    // réaction positive (bistable) : Newton peut osciller sans fin ; au-delà de la moitié des itérations, point fixe
    // (g = 0, sortie = f(vd) du coup précédent), qui converge vers la saturation
    if (sim.iter >= MAX_ITER / 2) { this.vdIt = vdNew; ({ y } = this.f(vdNew, lo, hi)); g = 0; }
    const r = S.iB(this.k), s = this.n[2] - 1;
    // v(s) − g·(v(p) − v(n)) = y − g·vd0   (la sortie est référencée à la masse ; la puce ajoute sa résistance de sortie)
    S.a(r, s, 1); S.a(r, this.n[0] - 1, -g); S.a(r, this.n[1] - 1, g); S.b(r, y - g * this.vdIt);
    S.a(s, r, 1);
  }
  verifier(sim) {
    const vd = sim.v(this.n[0]) - sim.v(this.n[1]), [lo, hi] = this.rails(sim);
    // convergé quand la sortie résolue vérifie l'équation de l'élément, v(s) = f(v(p) − v(n)) (résidu, comme SPICE) :
    // exact dès la 1re itération dans la partie linéaire ; refuse aussi, en réaction positive (bistable), un point
    // « presque saturé » dont la sortie linéarisée sortirait des rails
    return Math.abs(sim.v(this.n[2]) - this.f(vd, lo, hi).y) < 1e-6 * (hi - lo) + 1e-9;
  }
  courants(sim) { const j = sim.ib(this.k); return [0, 0, j, 0, 0]; }
};

Prim.K = class { // puits de courant avec « compliance » : I ≈ Imax dès que v(a) − v(b) dépasse ~0,3 V (sorties LED du LM3914)
  constructor(o) { this.n = [o.a, o.b]; this.I = o.I ?? 0.01; this.Vk = o.Vk ?? 0.08; this.nonLin = true; this.vIt = 0; }
  calc(v) { const I = val(this.I), Vk = val(this.Vk); if (I <= 0) return { i: v * 1e-9, g: 1e-9 }; if (v < 0) return { i: I * v / Vk, g: I / Vk }; const e = Math.exp(-v / Vk); return { i: I * (1 - e), g: I / Vk * e + 1e-9 }; }
  stamp(S, sim) {
    const brut = sim.v(this.n[0]) - sim.v(this.n[1]);
    this.vIt = sim.iter === 0 ? brut : this.vIt + Math.max(-0.5, Math.min(0.5, brut - this.vIt));
    const { i, g } = this.calc(this.vIt), vb = sim.v(this.n[1]);
    S.nonLineaire(this.n, [i, -i], [[g, -g], [-g, g]], [vb + this.vIt, vb]);
  }
  verifier(sim) { return Math.abs((sim.v(this.n[0]) - sim.v(this.n[1])) - this.vIt) < 1e-5 + 1e-4 * Math.abs(this.vIt); }
  courants(sim) { const { i } = this.calc(sim.v(this.n[0]) - sim.v(this.n[1])); return [i, -i]; }
};

/* ---------- Simulation ---------- */
class Simulation {
  constructor() {
    this.N = 1; this.nb = 0; this.prims = []; this.actifs = [];
    this.t = 0; this.dt = 1e-5; this.iter = 0; this.x = null;
    this.erreur = ''; this.nonConvergences = 0;
  }
  noeud() { return this.N++; }
  ajouter(p) { if (p.branches) { p.k = this.nb; this.nb += p.branches; } this.prims.push(p); return p; }
  /** élément qui a besoin d'agir une fois par pas (logique, comportement) : objet avec pas(sim) */
  actif(el) { this.actifs.push(el); }
  preparer() {
    this.S = new Systeme(this.N, this.nb);
    this.x = new Float64Array(this.S.taille);
    this.nonLin = this.prims.filter(p => p.nonLin);
    this.aAccepter = this.prims.filter(p => p.accepter);
  }
  v(n) { return n > 0 ? this.x[n - 1] : 0; }
  ib(k) { return this.x[this.N - 1 + k]; }
  pas() {
    if (!this.S) this.preparer();
    for (const a of this.actifs) a.pas(this);
    const S = this.S, xPrec = this.x;
    let converge = false;
    for (this.iter = 0; this.iter < MAX_ITER; this.iter++) {
      S.effacer();
      for (const p of this.prims) p.stamp(S, this);
      for (let i = 0; i < this.N - 1; i++) S.a(i, i, GMIN);
      const x = S.resoudre();
      if (!x) { this.erreur = 'Circuit impossible à résoudre (court-circuit de sources ou boucle de sources ?)'; this.x = xPrec; return false; }
      this.x = x;
      converge = true;
      for (const p of this.nonLin) if (!p.verifier(this)) { converge = false; break; }
      if (converge) break;
    }
    this.iterations = (this.iterations || 0) + Math.min(this.iter + 1, MAX_ITER);
    if (!converge) this.nonConvergences++;
    this.erreur = '';
    for (const p of this.aAccepter) p.accepter(this);
    this.t += this.dt;
    return true;
  }
}

G.FrWAMoteur = { Simulation, Prim, VT, val };
})(window);
