/* frwa_flow-Circuit — etudes.js
   Études : une suite d'étapes simulées, chacune dans sa fenêtre (etudes.html). Chaque étape est un circuit équivalent :
   un GÉNÉRATEUR ÉQUIVALENT qui remplace l'étage précédent, puis les composants réels de l'étage avec leurs valeurs,
   reliés par des fils (étiquettes seulement là où un fil croiserait trop de choses : VREF, +BAT).
   Les étapes sont aussi ajoutées à FrWAExemples (champ « etude ») : la page les charge par index.html#exemple=ID,
   la vérification automatique (verifier.html, verifier_etudes.html) les simule comme les autres exemples.

   Étude « demod6k » : démodulation de tonalités à référence 6 kHz (document « Démodulation de tonalités à référence
   6 kHz : actionneurs et moteurs pas à pas en CD4000 (version 2) », 2026-11-23). Partie 1 : blocs A, B, C, D, E, H ;
   partie 2 (carte moteur) : M1 à M4. Valeurs reprises du document ; écarts signalés dans le texte de chaque étape. */
'use strict';
(function (G) {
const plan = G.FrWAPlan;

/* ---------- Géométrie des étiquettes ----------
   Règle : le drapeau d'une étiquette ne touche ni un composant (boîte et pastilles nom / valeur), ni un fil, ni une
   autre étiquette. Le placement automatique essaie des fils de plus en plus longs dans chaque direction, puis en L,
   jusqu'à trouver une place dégagée ; le fil d'amenée ne passe ni dans un boîtier ni par une broche ou un bout de fil
   (il créerait une liaison) et, si possible, ne croise aucun fil. verifier_etudes.html contrôle la même règle. */
const GEO = (() => {
  const TY = () => G.FrWAComposants.TYPES, tr = (x, y, r) => G.FrWACircuit.tourner(x, y, r);
  const CAR = 6.6, H = 14;
  const rectEtiquette = (x, y, rot, texte) => {
    const w = String(texte).length * CAR + 12, r = ((rot % 4) + 4) % 4;
    return r === 0 ? [x - 5 - w, y - H / 2, x - 5, y + H / 2] : r === 1 ? [x - w / 2, y - 5 - H, x + w / 2, y - 5]
      : r === 2 ? [x + 5, y - H / 2, x + 5 + w, y + H / 2] : [x - w / 2, y + 5, x + w / 2, y + 5 + H];
  };
  const boite = e => {
    const T = TY()[e.type], b = T.boiteDe ? T.boiteDe(e) : (T.boite || [-20, -20, 20, 20]);
    const p1 = tr(b[0], b[1], e.rot || 0), p2 = tr(b[2], b[3], e.rot || 0);
    return [e.x + Math.min(p1[0], p2[0]), e.y + Math.min(p1[1], p2[1]), e.x + Math.max(p1[0], p2[0]), e.y + Math.max(p1[1], p2[1])];
  };
  /** pastilles nom / valeur, placées comme dans interface.js (taille à l'échelle 1) */
  const pastilles = e => {
    const T = TY()[e.type]; if (T.etiquette) return [];
    if (T.masse || e.sansPastille) { if (!e.indicateur) return []; if (e.indicateurPos) return [rectIndicateur(e)]; }
    const L = n => n * 5.6 + 9, rect = ([x, y], w, al) => { const x0 = al === 'left' ? x : al === 'right' ? x - w : x - w / 2; return [x0, y - 7, x0 + w, y + 7]; };
    let pn, pv, an = 'center', av = 'center';
    if (T.dipole) {
      const v = (e.rot || 0) % 2 === 1, s = e.inverse ? -1 : 1;
      pn = v ? [e.x - 26 * s, e.y] : [e.x, e.y - 26 * s]; pv = v ? [e.x + 26 * s, e.y] : [e.x, e.y + 26 * s];
      if (v) { an = s > 0 ? 'right' : 'left'; av = s > 0 ? 'left' : 'right'; }
    } else { const b = boite(e), d = T.puce ? 4 : 6, h = T.puce ? 9 : 6; pn = [b[2] + d, b[1] + h]; pv = [b[2] + d, b[3] - h]; an = av = 'left'; }
    const out = [];
    if (T.masse || e.sansPastille) return [rectIndicateur(e, T.masse ? [boite(e)[0] - 4, (boite(e)[1] + boite(e)[3]) / 2] : pn, T.masse ? 'right' : an)];
    if (e.pastille !== 'valeur') out.push(rect(pn, L(e.nom.length), an));
    if (e.pastille !== 'nom') out.push(rect(pv, L(8), av));
    if (e.indicateur) out.push(rectIndicateur(e, pn, an));
    return out;
  };
  /** pastille de l'indicateur : position mémorisée (indicateurPos, centre relatif au composant) ou collée au nom */
  const rectIndicateur = (e, pn, an) => {
    const T = TY()[e.type], w = e.indicateur.length * 5.6 + 9;
    if (e.indicateurPos) { const x = e.x + e.indicateurPos[0], y = e.y + e.indicateurPos[1]; return [x - w / 2, y - 7, x + w / 2, y + 7]; }
    const avecNom = !e.sansPastille && e.pastille !== 'valeur';
    const y = pn[1] + (!avecNom ? 0 : T.dipole ? -18 * (e.inverse && (e.rot || 0) % 2 === 0 ? -1 : 1) : 18);
    const x0 = an === 'left' ? pn[0] : an === 'right' ? pn[0] - w : pn[0] - w / 2; return [x0, y - 7, x0 + w, y + 7];
  };
  const broches = e => (TY()[e.type].broches || []).map(b => { const [x, y] = tr(b.x, b.y, e.rot || 0); return [e.x + x, e.y + y]; });
  /** tout ce qu'une étiquette doit éviter */
  function obstacles({ elements, fils }) {
    const o = { boites: [], pastilles: [], etiquettes: [], fils: fils.map(f => [...f]), points: [] };
    for (const e of elements) {
      const T = TY()[e.type]; if (!T) continue;
      for (const p of broches(e)) o.points.push(p);
      if (T.etiquette) o.etiquettes.push({ nom: e.nom, texte: e.params.nom, r: rectEtiquette(e.x, e.y, e.rot || 0, e.params.nom) });
      else { o.boites.push({ nom: e.nom, r: boite(e) }); for (const r of pastilles(e)) o.pastilles.push({ nom: e.nom, r }); }
    }
    for (const [x1, y1, x2, y2] of fils) o.points.push([x1, y1], [x2, y2]);
    return o;
  }
  const recouvre = (a, b, m = 0) => a[0] < b[2] - m && b[0] < a[2] - m && a[1] < b[3] - m && b[1] < a[3] - m;
  /** segment horizontal ou vertical qui entre dans le rectangle (agrandi de m) */
  const segRect = ([x1, y1, x2, y2], r, m = 0) => recouvre([Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)], [r[0] - m, r[1] - m, r[2] + m, r[3] + m], -1e-9)
    || (x1 === x2 && x1 > r[0] - m && x1 < r[2] + m && Math.max(y1, y2) > r[1] - m && Math.min(y1, y2) < r[3] + m)
    || (y1 === y2 && y1 > r[1] - m && y1 < r[3] + m && Math.max(x1, x2) > r[0] - m && Math.min(x1, x2) < r[2] + m);
  const surSeg = ([px, py], [x1, y1, x2, y2], bouts) => {
    if ((px - x1) * (y2 - y1) !== (py - y1) * (x2 - x1)) return false;
    const t = (px - x1) * (x2 - x1) + (py - y1) * (y2 - y1), L = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    return bouts ? t >= 0 && t <= L : t > 0 && t < L;
  };
  const colineaires = (a, b) => {
    if (a[1] === a[3] && b[1] === b[3] && a[1] === b[1]) return Math.min(Math.max(a[0], a[2]), Math.max(b[0], b[2])) > Math.max(Math.min(a[0], a[2]), Math.min(b[0], b[2]));
    if (a[0] === a[2] && b[0] === b[2] && a[0] === b[0]) return Math.min(Math.max(a[1], a[3]), Math.max(b[1], b[3])) > Math.max(Math.min(a[1], a[3]), Math.min(b[1], b[3]));
    return false;
  };
  const croise = (a, b) => { const h = a[1] === a[3] ? a : b, v = a[1] === a[3] ? b : a; if (h[1] !== h[3] || v[0] !== v[2]) return false;
    return v[0] > Math.min(h[0], h[2]) && v[0] < Math.max(h[0], h[2]) && h[1] > Math.min(v[1], v[3]) && h[1] < Math.max(v[1], v[3]); };
  /** défauts d'un drapeau d'étiquette (contrôle) */
  function defauts(r, o, ignorer = '') {
    const d = [];
    for (const b of o.boites) if (recouvre(r, b.r, -2)) d.push('composant ' + b.nom);
    for (const b of o.pastilles) if (recouvre(r, b.r, -1)) d.push('pastille de ' + b.nom);
    for (const e of o.etiquettes) if (e.nom !== ignorer && recouvre(r, e.r, -2)) d.push('étiquette ' + e.texte);
    for (const f of o.fils) if (segRect(f, r, 2)) { d.push('fil ' + f.join(',')); break; }
    return d;
  }
  function valide(pts, rot, texte, o, sansCroiser) {
    const segs = []; for (let i = 0; i + 1 < pts.length; i++) segs.push([...pts[i], ...pts[i + 1]]);
    const Q = pts[pts.length - 1];
    for (const p of o.points) if (p[0] === Q[0] && p[1] === Q[1]) return false;
    for (const f of o.fils) if (surSeg(Q, f, true)) return false;
    for (const s of segs) {
      for (const p of o.points) if (surSeg(p, s, false) || (s !== segs[0] && p[0] === s[0] && p[1] === s[1])) return false;
      for (const f of o.fils) if (colineaires(s, f) || (sansCroiser && croise(s, f))) return false;
      for (const b of o.boites) if (segRect(s, b.r, -1)) return false;
      for (const b of o.pastilles) if (segRect(s, b.r, 0)) return false;
      for (const e of o.etiquettes) if (segRect(s, e.r, 2)) return false;
    }
    const r = rectEtiquette(Q[0], Q[1], rot, texte);
    if (defauts(r, o).length) return false;
    for (const s of segs.slice(0, -1)) if (segRect(s, r, 2)) return false;
    return true;
  }
  const DIR = { g: [-1, 0, 0], h: [0, -1, 1], d: [1, 0, 2], b: [0, 1, 3] };
  /** cherche un fil d'amenée et une place pour l'étiquette, de P vers une zone dégagée */
  function placer(donnees, P, texte, prefs = 'dhbg') {
    const o = obstacles(donnees), ordre = [...new Set([...prefs, ...'dhbg'])], c = [];
    for (const k of ordre) for (let d = 20; d <= 240; d += 20) c.push([[P, [P[0] + DIR[k][0] * d, P[1] + DIR[k][1] * d]], DIR[k][2]]);
    for (const k of ordre) for (let d1 = 20; d1 <= 160; d1 += 20) for (const k2 of ordre) {
      if (DIR[k2][0] === 0 === (DIR[k][0] === 0)) continue;           // second tronçon perpendiculaire
      const M = [P[0] + DIR[k][0] * d1, P[1] + DIR[k][1] * d1];
      for (let d2 = 20; d2 <= 200; d2 += 20) c.push([[P, M, [M[0] + DIR[k2][0] * d2, M[1] + DIR[k2][1] * d2]], DIR[k2][2]]);
    }
    for (const sansCroiser of [true, false]) for (const [pts, r] of c) if (valide(pts, r, texte, o, sansCroiser)) return { pts, r };
    return null;
  }
  /** place la pastille de chaque indicateur sans toucher boîtier, pastille, étiquette, fil ni autre indicateur :
      la plus proche de la place habituelle, dans un anneau autour du composant ; mémorisée dans e.indicateurPos */
  function placerIndicateurs(donnees) {
    const els = donnees.elements.filter(e => e.indicateur && !e.indicateurPos);
    for (const e of els) {
      const propre = pastilles(e), ri = propre[propre.length - 1], texte = e.indicateur;
      delete e.indicateur; const o = obstacles(donnees); e.indicateur = texte;     // obstacles sans cet indicateur
      const autres = o.pastilles.map(p => p.r);
      const w = ri[2] - ri[0], [ux, uy] = [(ri[0] + ri[2]) / 2, (ri[1] + ri[3]) / 2];
      // marges un peu plus larges que celles du contrôle (defauts) : un écart visible, et l'arrondi de la position reste sûr
      const libre = r => !o.boites.some(b => recouvre(r, b.r, -4)) && !autres.some(p => recouvre(r, p, -3))
        && !o.etiquettes.some(t => recouvre(r, t.r, -3)) && !o.fils.some(f => segRect(f, r, 3));
      // distance rectangle ↔ boîtier ; la pastille doit rester plus près de son composant que de tout autre
      const dist = (r, b) => Math.hypot(Math.max(0, b[0] - r[2], r[0] - b[2]), Math.max(0, b[1] - r[3], r[1] - b[3]));
      // les symboles de masse ne comptent pas comme voisins (ils n'identifient rien)
      const sienne = boite(e), voisins = o.boites.filter(b => b.nom !== e.nom && !TY()[donnees.elements.find(z => z.nom === b.nom)?.type]?.masse).map(b => b.r);
      let mieux = null, dmin = Infinity;
      for (const strict of [true, false]) for (let dy = -120; dy <= 120 && !(mieux && !strict); dy += 6) for (let dx = -200; dx <= 200; dx += 10) {
        if (!strict && mieux) break;   // second passage (sans la règle de proximité) seulement si le premier a échoué
        const cx = ux + dx, cy = uy + dy, r = [cx - w / 2, cy - 7, cx + w / 2, cy + 7];
        const dp = dist(r, sienne), dv = Math.min(Infinity, ...voisins.map(b => dist(r, b)));
        // second passage : la pastille peut être plus près d'un voisin, mais c'est fortement pénalisé
        const d = dp + 0.05 * Math.hypot(dx, dy) + (strict ? 0 : 3 * Math.max(0, dp - dv)); if (d >= dmin) continue;
        if (strict && dv < dp - 4) continue;
        if (libre(r)) { mieux = [cx - e.x, cy - e.y]; dmin = d; }
      }
      if (mieux) e.indicateurPos = mieux.map(v => Math.round(v));
    }
  }
  return { rectEtiquette, obstacles, defauts, placer, boite, pastilles, placerIndicateurs };
})();
G.FrWAGeoEtiquettes = GEO;

/* ---------- Outils de placement ---------- */
const outils = B => B._outils || (B._outils = outilsDe(B));
const outilsDe = B => {
  const R = (nom, x, y, rot, v, o) => B.E('resistance', nom, x, y, rot, { R: v }, o);
  const C = (nom, x, y, rot, v, o) => B.E('condensateur', nom, x, y, rot, { C: v }, o);
  const W = (...pts) => B.F(...pts);
  /** fil vertical d'une broche jusqu'à un rail horizontal (y) */
  const rail = (nom, broche, y) => { const [x, y0] = B.P(nom, broche); W([x, y0], [x, y]); };
  const masse = (nom, broche) => B.MP(nom, broche, 'b', 0);
  /** pile verticale (+ en haut) : renvoie [x, y] de + */
  const pile = (nom, x, y, V) => { B.E('pile', nom, x, y, 3, { V }); masse(nom, '−'); return B.P(nom, '+'); };
  /** bascule D 4013 ½ : S et R à la masse, alimentation */
  const bascule = (nom, x, y, yRail) => {
    B.E('puce:cd4013-u', nom, x, y);
    const [sx, sy] = B.P(nom, 'S'), [rx, ry] = B.P(nom, 'R');
    W([sx, sy], [sx - 20, sy], [sx - 20, ry + 20]); W([rx, ry], [rx - 20, ry]); B.M(sx - 20, ry + 20);
    rail(nom, 'VDD', yRail); masse(nom, 'VSS');
  };
  /** potentiomètre monté en résistance variable entre 1 et le curseur (W relié à 3) : R = Rtot × position */
  const rheostat = (nom, x, y, Rtot, pos, rot = 0) => {
    B.E('puce:potentiometre', nom, x, y, rot, { R: Rtot, position: pos });
    W(B.P(nom, 'W'), [B.P(nom, 'W')[0], B.P(nom, 'W')[1]], B.P(nom, '3'));
  };
  /** étiquette de réseau au bout d'une broche ([nom, broche]) ou d'un point de fil ([x, y]), placée en fin d'étape
      (quand tout le reste est posé) par GEO.placer ; prefs : directions essayées d'abord (g, h, d, b) */
  const file = [];
  const lab = (cible, texte, prefs = 'dhbg') => file.push({ cible, texte, prefs });
  const placerEtiquettes = () => {
    for (const { cible, texte, prefs } of file) {
      const P = typeof cible[0] === 'string' ? B.P(cible[0], cible[1]) : cible;
      const res = GEO.placer(B.donnees(), P, texte, prefs);
      if (!res) throw new Error(`pas de place dégagée pour l'étiquette ${texte} (${cible.join('.')})`);
      B.F(...res.pts); const Q = res.pts[res.pts.length - 1]; B.L(texte, Q[0], Q[1], res.r);
    }
    file.length = 0;
  };
  return { R, C, W, rail, masse, pile, bascule, rheostat, lab, placerEtiquettes };
};

/* ---------- Étape A : entrée jack isolée, gain réglable, Vref ---------- */
function etapeA(B) {
  const { R, C, W, rail, masse, pile, lab } = outils(B);
  const Y9 = -160;
  const [px, py] = pile('V1', -100, -80, 9); W([px, py], [px, Y9], [1260, Y9]);
  // appareil source (générateur équivalent : cinq tonalités de 0,2 V crête) ; masse de l'appareil isolée par T1
  B.E('puce:generateur-tonalites', 'G1', 60, 300, 0, { a1: 0.2, a2: 0.2, a3: 0.2, a4: 0.2, a5: 0.2 });
  C('C1', 100, 240, 0, 4.7e-6); W([20, 240], [60, 240]);
  R('R1', 200, 240, 0, 470); W([140, 240], [160, 240]);
  B.E('transformateur', 'T1', 320, 260, 0, { n: 1, L: 3, k: 0.999, Rp: 40, Rs: 40 });
  W([240, 240], [280, 240]); W([280, 280], [280, 360], [20, 360]);
  // secondaire : S1 → Vref, S2 → signal
  R('R2', 440, 280, 0, 1e3); W([360, 280], [400, 280]);
  B.E('puce:bav99', 'D1', 560, 300); W([480, 280], [500, 280]); rail('D1', 'K2', Y9); masse('D1', 'A1');
  R('R3', 480, 340, 1, 9.1e3); W([480, 280], [480, 300]);
  B.E('puce:mc33079-u', 'U1A', 720, 420); rail('U1A', 'VCC', Y9); masse('U1A', 'VEE');
  W([480, 380], [480, 420], [640, 420]);
  // contre-réaction : R4 + RV1 (gain 1 à 11) // C2
  W([600, 420], [600, 580]); R('R4', 660, 580, 0, 10e3); W([600, 580], [620, 580]);
  B.E('puce:potentiometre', 'RV1', 800, 600, 0, { R: 100e3, position: 20.3 }); W([700, 580], [720, 580]);
  C('C2', 660, 660, 0, 100e-12); W([600, 580], [600, 660], [620, 660]); W([700, 660], [760, 660], [880, 660], [880, 580]);
  W([880, 580], [880, 400]); W([800, 400], [880, 400], [960, 400]);
  lab(['G1', '+'], 'JACK', 'hg'); lab([960, 400], 'AUDIO', 'd');     // entrée (tonalités + porteuse) ; sortie amplifiée
  // générateur de Vref = 4,5 V : pont R5 / R6, C3, suiveur U1B, R7, C4, C5
  R('R5', 1040, -100, 1, 10e3); W([1040, Y9], [1040, -140]);
  R('R6', 1040, 20, 1, 10e3); masse('R6', 'B'); W([1040, -60], [1040, -20]);
  C('C3', 1120, 0, 1, 10e-6); masse('C3', 'B'); W([1040, -40], [1120, -40]);
  B.E('puce:mc33079-u', 'U1B', 1300, -20); rail('U1B', 'VCC', Y9); masse('U1B', 'VEE');
  W([1120, -40], [1180, -40], [1180, -60], [1220, -60]);
  W([1380, -40], [1420, -40], [1420, 120], [1200, 120], [1200, -20], [1220, -20]);
  R('R7', 1460, -40, 0, 47);
  C('C4', 1540, 20, 1, 10e-6); masse('C4', 'B'); C('C5', 1620, 20, 1, 100e-9); masse('C5', 'B');
  W([1500, -40], [1620, -40]); W([1540, -40], [1540, -20]); W([1620, -40], [1620, -20]);
  W([1620, -40], [1680, -40], [1680, 160], [360, 160]); W([360, 240], [360, 160]); W([640, 380], [620, 380], [620, 160]);
}

/* ---------- Étape B : banc de cinq filtres passe-bande MFB, deux étages par voie ---------- */
const VOIES_B = [
  { f: '6 kHz', sortie: 'F6K', u: ['U1C', 'U1D'], R1: 14.0e3, R2: 56.2e3, R3: 590, C: 4.7e-9, r0: 10, c0: 10 },
  { f: '3 kHz', sortie: 'M1_3K', u: ['U2A', 'U2B'], R1: 8.06e3, R2: 31.6e3, R3: 1.00e3, C: 10e-9, r0: 16, c0: 14 },
  { f: '1,5 kHz', sortie: 'M2_1K5', u: ['U2C', 'U2D'], R1: 6.04e3, R2: 24.3e3, R3: 1.15e3, C: 22e-9, r0: 22, c0: 18 },
  { f: '750 Hz', sortie: 'ACT1_750', u: ['U3A', 'U3B'], R1: 11.3e3, R2: 45.3e3, R3: 475, C: 47e-9, r0: 28, c0: 22 },
  { f: '375 Hz', sortie: 'ACT2_375', u: ['U3C', 'U3D'], R1: 10.7e3, R2: 42.2e3, R3: 442, C: 100e-9, r0: 34, c0: 26 },
];
function etapeB(B) {
  const { R, C, W, masse, pile, lab } = outils(B);
  const YA = k => 400 + 520 * k, X9 = -400, XV = -340, XS = -80, FIN = 1040;
  // alimentation 9 V et Vref (générateurs équivalents des blocs H et A)
  const [p9x, p9y] = pile('V1', -520, 120, 9); W([p9x, p9y], [X9, p9y], [X9, YA(4) - 200]);
  const [pvx, pvy] = pile('V2', -520, 320, 4.5); W([pvx, pvy], [XV, pvy]);
  // sortie de l'étage d'entrée (générateur équivalent) : cinq tonalités de 0,6 V crête autour de Vref
  B.E('puce:generateur-tonalites', 'G1', -120, 40, 2, { a1: 0.6, a2: 0.6, a3: 0.6, a4: 0.6, a5: 0.6 });
  W([-80, -20], [XV, -20], [XV, YA(4) - 140]);
  W([XS, 100], [XS, YA(4)], [0, YA(4)]);
  lab(['G1', '+'], 'AUDIO', 'hg');
  VOIES_B.forEach((v, k) => {
    const ya = YA(k);
    lab([1500 - 520, ya - 20], v.sortie, 'd');                         // sortie de la voie, après deux étages (gain 4)
    W([X9, ya - 200], [FIN, ya - 200]); W([XV, ya - 140], [FIN, ya - 140]);
    if (k < 4) W([XS, ya], [0, ya]);
    [0, 520].forEach((x0, e) => {
      const u = v.u[e], xa = x0 + 340, n = i => (e ? 3 : 0) + i;
      R('R' + (v.r0 + n(0)), x0 + 40, ya, 0, v.R1);
      W([x0 + 80, ya], [x0 + 140, ya]);
      C('C' + (v.c0 + 2 * e), x0 + 180, ya, 0, v.C);
      W([x0 + 220, ya], [x0 + 260, ya]);
      B.E('puce:mc33079-u', u, xa, ya);
      W([xa - 40, ya - 100], [xa - 40, ya - 200]); masse(u, 'VEE'); W([xa - 80, ya - 40], [xa - 80, ya - 140]);
      R('R' + (v.r0 + n(2)), x0 + 100, ya - 80, 1, v.R3); W([x0 + 100, ya - 140], [x0 + 100, ya - 120]); W([x0 + 100, ya - 40], [x0 + 100, ya]);
      W([x0 + 240, ya], [x0 + 240, ya + 160], [x0 + 320, ya + 160]);
      R('R' + (v.r0 + n(1)), x0 + 360, ya + 160, 0, v.R2); W([x0 + 400, ya + 160], [x0 + 460, ya + 160]);
      W([x0 + 120, ya], [x0 + 120, ya + 240], [x0 + 160, ya + 240]);
      C('C' + (v.c0 + 2 * e + 1), x0 + 200, ya + 240, 0, v.C);
      W([x0 + 240, ya + 240], [x0 + 460, ya + 240], [x0 + 460, ya - 20], [x0 + 420, ya - 20]);
      if (e === 0) W([x0 + 460, ya], [x0 + 520, ya]);
    });
  });
}

/* ---------- Étape C : mise en forme carrée et détecteur de présence (voie 3 kHz) ---------- */
function etapeC(B) {
  const { R, C, W, rail, masse, pile, rheostat, lab } = outils(B);
  const Y9 = 140;
  const [px, py] = pile('V1', -240, 220, 9); W([px, py], [px, Y9], [1640, Y9]);
  pile('V2', -120, 420, 4.5); lab(['V2', '+'], 'VREF', 'h');
  // sortie du filtre 3 kHz (générateur équivalent) : 2,4 V crête autour de Vref, par salves de 125 ms
  B.E('puce:generateur-tonalites', 'G1', 60, 360, 0, { a1: 0, a2: 2.4, a3: 0, a4: 0, a5: 0, salves: 4 });
  lab(['G1', '−'], 'VREF', 'b'); lab(['G1', '+'], 'M1_3K', 'hg');
  W([20, 300], [420, 300]);
  // carré : comparateur à hystérésis (non inverseur) R40, R41, rappel R42 → SQ3
  R('R40', 460, 300, 0, 47e3); W([500, 300], [540, 300]);
  B.E('puce:lm339-u', 'U4B', 600, 340); rail('U4B', 'VCC', Y9); masse('U4B', 'GND'); lab(['U4B', 'IN1-'], 'VREF', 'bg');
  W([520, 300], [520, 220], [600, 220]); R('R41', 640, 220, 0, 4.7e6); W([680, 220], [700, 220], [700, 320]);
  R('R42', 740, 260, 1, 10e3); W([740, 220], [740, Y9]); W([740, 300], [740, 320]);
  W([660, 320], [700, 320], [820, 320]);
  // présence : détecteur de crête D2, C30, R43, comparateur U5B au seuil Vref + 0,5 V (R44, R45, RV2), hystérésis R46
  W([400, 300], [400, 700], [420, 700]); B.E('diode', 'D2', 460, 700, 0, { Vf: 0.3 });
  C('C30', 540, 760, 1, 100e-9); lab(['C30', 'B'], 'VREF', 'b');
  R('R43', 620, 760, 1, 47e3); lab(['R43', 'B'], 'VREF', 'b');
  W([500, 700], [1000, 700], [1000, 640], [1040, 640]); W([540, 700], [540, 720]); W([620, 700], [620, 720]);
  B.E('puce:lm339-u', 'U5B', 1100, 640); rail('U5B', 'VCC', Y9); masse('U5B', 'GND');
  R('R44', 980, 460, 1, 47e3); W([980, 420], [980, Y9]); W([980, 500], [980, 600], [1040, 600]);
  R('R45', 900, 560, 0, 5.6e3); W([940, 560], [980, 560]);
  B.E('puce:potentiometre', 'RV2', 760, 580, 0, { R: 5e3, position: 5.5 });
  W([840, 560], [860, 560]); W([720, 640], [840, 640], [840, 560]); lab(['RV2', '1'], 'VREF', 'g');
  W([1020, 600], [1020, 480], [1100, 480]); R('R46', 1140, 480, 0, 470e3); W([1180, 480], [1200, 480], [1200, 620]);
  R('R49', 1260, 560, 1, 10e3); W([1260, 520], [1260, Y9]); W([1260, 600], [1260, 620]);
  W([1160, 620], [1320, 620]);
  // temporisation : R47 · C31 ≈ 22 ms à l'apparition, D3 + R48 ≈ 3 ms à la disparition ; trigger U7A → PRES3
  B.E('diode', 'D3', 1360, 620, 0, { Vf: 0.7 }); R('R48', 1460, 620, 0, 22e3); W([1400, 620], [1420, 620]);
  W([1300, 620], [1300, 540], [1380, 540]); R('R47', 1420, 540, 0, 220e3); W([1460, 540], [1540, 540], [1540, 620]);
  W([1500, 620], [1540, 620]); C('C31', 1540, 680, 1, 100e-9); masse('C31', 'B'); W([1540, 620], [1540, 640]);
  B.E('puce:cd40106-u', 'U7A', 1660, 640); rail('U7A', 'VDD', Y9); masse('U7A', 'VSS');
  W([1540, 620], [1600, 620]); W([1720, 620], [1800, 620]);
  lab([820, 320], 'SQ3', 'd'); lab([1800, 620], 'PRES3', 'd');
}

/* ---------- Étape D : PLL de référence 6 kHz (CD4046B) et détecteur de verrouillage ---------- */
function etapeD(B) {
  const { R, C, W, rail, masse, pile, lab } = outils(B);
  const Y9 = 60;
  const [px, py] = pile('V1', -200, 140, 9); W([px, py], [px, Y9], [1180, Y9]);
  // SQ6 (générateur équivalent) : carré 0-9 V à 6 kHz, venant du comparateur du bloc C
  B.E('horloge', 'SQ6', 0, 320, 3, { V: 9, f: 6000, rc: 50 }); masse('SQ6', '−');
  B.E('puce:cd4046', 'U8', 300, 340); rail('U8', 'VDD', Y9); masse('U8', 'VSS'); B.MP('U8', 'INH', 'g', 20);
  W([0, 280], [220, 280]);
  C('C40', 240, 160, 0, 820e-12); W([260, 220], [260, 200], [200, 200], [200, 160]); W([280, 220], [280, 160]);
  R('R50', 260, 520, 1, 100e3); masse('R50', 'B'); W([260, 460], [260, 480]);
  W([380, 360], [420, 360], [420, 620], [140, 620], [140, 300], [220, 300]); W([420, 360], [500, 360]);
  // filtre de boucle : R51, R52, C41 → VCO IN
  R('R51', 480, 300, 0, 100e3); W([380, 300], [440, 300]);
  W([520, 300], [600, 300], [600, 320]); R('R52', 600, 360, 1, 15e3); C('C41', 600, 480, 1, 150e-9); masse('C41', 'B'); W([600, 400], [600, 440]);
  W([520, 300], [520, 680], [100, 680], [100, 340], [220, 340]);
  // verrouillage : moyenne de PC1 (R53, C42) comparée à 2,27 V (R54, R55), hystérésis R56, rappel R57 → LOCK
  W([380, 280], [400, 280], [400, 180], [440, 180]); R('R53', 480, 180, 0, 100e3); W([520, 180], [700, 180]);
  C('C42', 640, 240, 1, 100e-9); masse('C42', 'B'); W([640, 180], [640, 200]);
  B.E('puce:lm339-u', 'U4D', 840, 340); rail('U4D', 'VCC', Y9); masse('U4D', 'GND');
  W([700, 180], [700, 340], [780, 340]);
  W([780, 300], [760, 300], [760, 220], [1180, 220]);
  R('R54', 1180, 140, 1, 27e3); W([1180, 100], [1180, Y9]); W([1180, 180], [1180, 220]);
  R('R55', 1180, 260, 1, 9.1e3); masse('R55', 'B');
  R('R56', 940, 260, 1, 1e6); W([940, 300], [940, 320]);
  R('R57', 1060, 280, 1, 10e3); W([1060, 240], [1060, Y9]);
  W([900, 320], [1100, 320]);
  lab(['SQ6', '+'], 'SQ6', 'h'); lab([500, 360], 'F6', 'd'); lab([1100, 320], 'LOCK', 'd');   // porteuse en carré, référence verrouillée
}

/* ---------- Étape E : validation, surveillance de la batterie, actionneurs ---------- */
function etapeE(B) {
  const { R, W, rail, masse, pile, lab } = outils(B);
  const Y9 = 60;
  const [px, py] = pile('V1', -260, 140, 9); W([px, py], [px, Y9], [1000, Y9]);
  W([-140, 0], [-140, Y9]); W([-140, Y9], [-140, 420], [360, 420]);
  // signaux logiques du bloc C et D (générateurs équivalents) : inverseurs, position 2 = 1 logique (+9 V)
  const signal = (nom, yc, pos) => {
    B.E('puce:inverseur', nom, 0, yc, 2, { position: pos });
    W([-80, yc], [-140, yc]); W([-80, yc + 20], [-100, yc + 20], [-100, yc + 40]); B.M(-100, yc + 40);
  };
  signal('PRES375', 0, '2'); signal('PRES750', 100, '2'); signal('PRES6', 200, '2'); signal('LOCK', 300, '2');
  const et = (nom, x, y) => { B.E('puce:cd4081-u', nom, x, y); rail(nom, 'VDD', Y9); masse(nom, 'VSS'); };
  et('U9A', 300, 260); et('U9B', 500, 280); et('U9C', 700, 240); et('U9D', 1000, 500);
  W([80, 220], [160, 220], [160, 240], [240, 240]); W([80, 320], [180, 320], [180, 260], [240, 260]);
  W([360, 240], [400, 240], [400, 260], [440, 260]);
  W([560, 260], [600, 260], [600, 240], [640, 240]); W([600, 260], [600, 480], [940, 480]);
  W([80, 120], [620, 120], [620, 220], [640, 220]);
  W([80, 20], [900, 20], [900, 500], [940, 500]);
  // batterie (générateur équivalent : 10,2 → 14,6 V en 10 s) et comparateur U6B → OKBAT
  B.E('source_ac', 'VBAT', 40, 720, 3, { V: 2.2, f: 0.1, off: 12.4 }); masse('VBAT', '−');
  W([40, 680], [160, 680], [160, 520]); lab(['VBAT', '+'], '+BAT', 'hg');
  pile('V2', -60, 720, 4.5); lab(['V2', '+'], 'VREF', 'h');
  B.E('puce:lm339-u', 'U6B', 380, 560); masse('U6B', 'GND'); W([360, 460], [360, 420]);
  R('R60', 200, 520, 0, 15e3); W([240, 520], [320, 520]);
  R('R61', 260, 600, 1, 10e3); masse('R61', 'B'); W([260, 520], [260, 560]);
  B.E('condensateur', 'C43', 220, 620, 1, { C: 10e-6 }); masse('C43', 'B'); W([220, 580], [220, 560], [260, 560]);
  lab(['U6B', 'IN1-'], 'VREF', 'bg');
  W([440, 540], [440, 280]); R('R63', 400, 420, 0, 10e3);
  W([300, 520], [300, 380], [340, 380]); R('R62', 380, 380, 0, 150e3); W([420, 380], [440, 380]);
  // actionneurs : BS170 + relais 12 V + roue libre ; contacts → voyant de l'actionneur
  const pilote = (k, enaY, dy) => {
    const n = { R: [64, 66][k], Rp: [65, 67][k], Q: 'Q' + (k + 1), K: 'K' + (k + 1), D: 'D' + (4 + k) };
    R('R' + n.R, 1160, 220 + dy, 0, 100);
    B.E('puce:bs170', n.Q, 1300, 240 + dy); masse(n.Q, 'S'); W([1200, 220 + dy], [1240, 220 + dy]);
    R('R' + n.Rp, 1220, 280 + dy, 1, 100e3); masse('R' + n.Rp, 'B'); W([1220, 220 + dy], [1220, 240 + dy]);
    B.E('puce:relais-1rt', n.K, 1460, 120 + dy, 0, { vNom: 12, rBobine: 400 });
    W([1280, 160 + dy], [1280, 120 + dy], [1380, 120 + dy]); W([1380, 80 + dy], [1380, -60 + dy]);
    B.E('diode', n.D, 1320, 80 + dy, 3, { Vf: 0.7 }); W([1320, 40 + dy], [1320, -60 + dy]);
    W([1540, 80 + dy], [1540, -60 + dy]); W([1320, -60 + dy], [1800, -60 + dy]);
    R('RL' + (k + 1), 1640, 100 + dy, 0, 1e3); W([1540, 100 + dy], [1600, 100 + dy]);
    B.E('led', 'ACT' + (k + 1), 1720, 140 + dy, 1, { couleur: k ? 'vert' : 'jaune' }); masse('ACT' + (k + 1), 'B'); W([1680, 100 + dy], [1720, 100 + dy]);
  };
  W([760, 220], [1120, 220]); pilote(0, 220, 0);
  W([1060, 480], [1100, 480], [1100, 580], [1120, 580]); pilote(1, 580, 360);
  W([1800, -60], [1800, 300]); lab([1800, 300], '+BAT', 'bd');
  for (const n of ['PRES375', 'PRES750', 'PRES6', 'LOCK']) lab([n, 'C'], n, 'h');
  lab(['U6B', 'OUT1'], 'OKBAT', 'db'); lab(['U9C', 'Y'], 'ENA1', 'h'); lab(['U9D', 'Y'], 'ENA2', 'b');
  lab(['K1', 'NO'], 'ACT1', 'b'); lab(['K2', 'NO'], 'ACT2', 'b');      // contacts des actionneurs
}

/* ---------- Étape H : alimentation par batterie au plomb ---------- */
function etapeH(B) {
  const { R, C, W, masse, lab } = outils(B);
  B.E('pile', 'BAT', 0, 300, 3, { V: 12.6 }); masse('BAT', '−');
  B.E('puce:fusible', 'F1', 100, 280, 0, { In: 3, i2t: 10 }); W([0, 260], [40, 260]);
  B.E('interrupteur', 'S1', 240, 260, 0, { ferme: true }); W([160, 260], [200, 260]);
  B.E('puce:irf4905', 'Q3', 400, 280, 1); W([280, 260], [320, 260]);
  W([420, 220], [420, 120], [620, 120]); R('R70', 520, 160, 1, 100e3); masse('R70', 'B');
  B.E('puce:zener', 'D7', 600, 180, 1, { Vz: 15 }); W([620, 240], [620, 260]);
  W([480, 260], [880, 260]);
  B.E('puce:smbj18a', 'D8', 720, 320, 3); masse('D8', 'A');
  C('C60', 800, 300, 1, 1000e-6); masse('C60', 'B');
  C('C61', 860, 300, 1, 470e-9); masse('C61', 'B');
  B.E('puce:lm2940-9', 'U10', 940, 280); masse('U10', 'GND');
  W([1000, 260], [1220, 260]);
  C('C62', 1060, 300, 1, 47e-6); masse('C62', 'B'); C('C63', 1140, 300, 1, 100e-9); masse('C63', 'B');
  R('RCH', 1220, 300, 1, 300); masse('RCH', 'B');
  lab(['BAT', '+'], 'BAT+', 'hg'); lab([1220, 260], '+9V', 'dh');
}

/* ---------- Étape M1 : références 3 et 1,5 kHz, écart (battement) et sens ---------- */
function etapeM1(B) {
  const { R, C, W, rail, masse, pile, bascule, lab } = outils(B);
  const Y9 = 60;
  const [px, py] = pile('V1', -240, 140, 9); W([px, py], [px, Y9], [1440, Y9]);
  // F6 (référence verrouillée) et SQ3 (tonalité du moteur 1 mise en carré) : générateurs équivalents, Δf = +300 Hz
  B.E('horloge', 'F6', 0, 300, 3, { V: 9, f: 6000, rc: 50 }); masse('F6', '−');
  B.E('horloge', 'SQ3', 0, 500, 3, { V: 9, f: 3300, rc: 50 }); masse('SQ3', '−');
  bascule('U101A', 240, 300, Y9); bascule('U101B', 520, 300, Y9);
  W([0, 260], [120, 260], [120, 280], [180, 280]);
  W([300, 280], [340, 280], [340, 180], [160, 180], [160, 260], [180, 260]);
  W([300, 260], [400, 260], [400, 280], [460, 280]);
  W([580, 280], [620, 280], [620, 180], [440, 180], [440, 260], [460, 260]);
  // battement : bascule D U102A (D = SQ3, horloge F3) → BATT1 à |Δf|
  bascule('U102A', 720, 640, Y9);
  W([0, 460], [860, 460], [860, 580], [920, 580]); W([640, 460], [640, 600], [660, 600]);
  W([380, 260], [380, 620], [660, 620]);
  W([780, 600], [840, 600]);
  // sens : PC2 du CD4046B (SIG = SQ3, COMP = F3), filtré R111 · C105, ramené à 4,5 V par R112 / R113, trigger U109A
  B.E('puce:cd4046', 'U105', 1000, 640); rail('U105', 'VDD', Y9); masse('U105', 'VSS');
  W([420, 620], [420, 800], [880, 800], [880, 600], [920, 600]);
  W([920, 660], [900, 660], [900, 500], [1000, 500]);
  R('R111', 1160, 600, 0, 100e3); W([1080, 600], [1120, 600]); W([1200, 600], [1360, 600]);
  C('C105', 1240, 660, 1, 1e-6); masse('C105', 'B'); W([1240, 600], [1240, 620]);
  R('R112', 1300, 520, 1, 2.2e6); W([1300, 480], [1300, Y9]); W([1300, 560], [1300, 600]);
  R('R113', 1340, 680, 1, 2.2e6); masse('R113', 'B'); W([1340, 600], [1340, 640]);
  B.E('puce:cd40106-u', 'U109A', 1460, 620); rail('U109A', 'VDD', Y9); masse('U109A', 'VSS');
  W([1360, 600], [1400, 600]); W([1520, 600], [1600, 600]);
  lab(['F6', '+'], 'F6', 'h'); lab(['SQ3', '+'], 'SQ3', 'g');           // entrées de la carte moteur
  lab(['U101A', 'Q'], 'F3', 'h'); lab(['U101B', 'Q'], 'F15', 'd'); lab([840, 600], 'BATT1', 'd'); lab([1600, 600], 'DIR1', 'd');
}

/* ---------- Étape M2 : conversion fréquence → tension, réglages et VCO ---------- */
function etapeM2(B) {
  const { R, C, W, rail, masse, pile, lab } = outils(B);
  const Y9 = -200;
  const [px, py] = pile('V1', -240, -120, 9); W([px, py], [px, Y9], [1800, Y9]);
  // BATT1 (générateur équivalent) : carré 0-9 V à |Δf| = 300 Hz
  B.E('horloge', 'BATT1', 0, 340, 3, { V: 9, f: 300, rc: 50 }); masse('BATT1', '−');
  // monostable U103A : T = (R101 + RV101) · C101 = 1,67 ms pour Δfmax = 300 Hz
  B.E('puce:cd4538', 'U103', 300, 420); rail('U103', 'VDD', Y9); masse('U103', 'VSS');
  W([0, 300], [100, 300], [100, 340], [160, 340]);
  W([160, 360], [140, 360]); W([160, 380], [140, 380]); W([140, 360], [140, 380]); W([140, 380], [140, Y9]);
  W([160, 420], [140, 420], [140, 480]); W([160, 460], [140, 460]); B.M(140, 480);
  W([220, 280], [220, 240], [180, 240]); B.M(180, 240);
  C('C101', 220, 160, 0, 100e-9); W([180, 160], [180, 240]); W([260, 280], [260, 160]);
  R('R101', 260, 100, 1, 8.2e3); W([260, 140], [260, 160]);
  B.E('puce:potentiometre', 'RV101', 240, -40, 1, { R: 22e3, position: 38.6 });
  W([260, -120], [260, Y9]); W([180, -80], [180, 40], [260, 40]); W([260, 40], [260, 60]);
  // filtre de Sallen-Key U104A (fc ≈ 5 Hz) → VFV = 9 V · T · |Δf|
  R('R102', 520, 340, 0, 100e3); W([440, 340], [480, 340]); W([560, 340], [600, 340]);
  R('R103', 640, 340, 0, 100e3); W([680, 340], [740, 340]);
  C('C103', 680, 400, 1, 220e-9); masse('C103', 'B'); W([680, 340], [680, 360]);
  B.E('puce:lm358-u', 'U104A', 800, 380); rail('U104A', 'VCC', Y9); masse('U104A', 'GND');
  W([580, 340], [580, 240], [620, 240]); C('C102', 660, 240, 0, 470e-9); W([700, 240], [900, 240], [900, 360]);
  W([860, 360], [900, 360], [900, 520], [720, 520], [720, 380], [740, 380]);
  // vitesse maximale : RV102 + R104 (α) ; zone morte : R106 + RV103 (Voff) ; sommateur U104B gain 2
  B.E('puce:potentiometre', 'RV102', 1040, 420, 0, { R: 10e3, position: 8.5 }); W([900, 400], [960, 400]);
  W([1120, 400], [1160, 400], [1160, 420]); R('R104', 1160, 460, 1, 1.2e3); masse('R104', 'B');
  W([1000, 480], [1000, 520], [1040, 520]); R('R105', 1080, 520, 0, 100e3);
  B.E('puce:lm358-u', 'U104B', 1500, 560); rail('U104B', 'VCC', Y9); masse('U104B', 'GND');
  W([1120, 520], [1440, 520]);
  R('R107', 1160, 600, 1, 100e3); W([1160, 520], [1160, 560]); W([1160, 640], [1160, 720], [1240, 720]);
  R('R106', 1240, 660, 1, 22e3); W([1240, 620], [1240, Y9]); W([1240, 700], [1240, 780]);
  B.E('puce:potentiometre', 'RV103', 1320, 800, 0, { R: 10e3, position: 19.7 });
  masse('RV103', 'W'); W([1400, 780], [1400, 860], [1280, 860]);
  W([1440, 560], [1420, 560], [1420, 780], [1460, 780]); R('R108', 1500, 780, 0, 100e3);
  W([1540, 780], [1600, 780], [1600, 540], [1560, 540]);
  W([1420, 640], [1400, 640]); R('R109', 1360, 640, 0, 100e3); masse('R109', 'A');
  // VCO de U105 (R110, C104) → CLK1
  B.E('puce:cd4046', 'U105', 1800, 620); rail('U105', 'VDD', Y9); masse('U105', 'VSS'); B.MP('U105', 'INH', 'g', 20);
  W([1600, 620], [1720, 620]);
  R('R110', 1760, 800, 1, 33e3); masse('R110', 'B'); W([1760, 740], [1760, 760]);
  C('C104', 1740, 440, 0, 22e-9); W([1760, 500], [1760, 480], [1700, 480], [1700, 440]); W([1780, 500], [1780, 440]);
  W([1880, 640], [1960, 640]);
  lab(['BATT1', '+'], 'BATT1', 'h'); lab(['U104A', 'OUT1'], 'VFV', 'h'); lab([1960, 640], 'CLK1', 'd');
}

/* ---------- Étape M3 : séquenceur réversible (compteur de Gray) et validation ---------- */
function etapeM3(B) {
  const { R, W, rail, masse, pile, bascule, lab } = outils(B);
  const Y9 = 60;
  const [px, py] = pile('V1', -260, 140, 9); W([px, py], [px, Y9], [1380, Y9]);
  W([-140, Y9], [-140, 860]);
  // CLK1, DIR1, EN1 (générateurs équivalents) : horloge de pas ralentie à 5 Hz pour suivre les voyants
  const signal = (nom, yc, pos) => {
    B.E('puce:inverseur', nom, 0, yc, 2, { position: pos });
    W([-80, yc], [-140, yc]); W([-80, yc + 20], [-100, yc + 20], [-100, yc + 40]); B.M(-100, yc + 40);
  };
  signal('DIR1', 640, '1'); signal('EN1', 860, '2');
  B.E('horloge', 'CLK1', 300, 780, 3, { V: 9, f: 5, rc: 50 }); masse('CLK1', '−');
  const ou = (nom, x, y) => { B.E('puce:cd4070-u', nom, x, y); rail(nom, 'VDD', Y9); masse(nom, 'VSS'); };
  ou('U107A', 300, 400); bascule('U106A', 520, 420, Y9); ou('U107B', 760, 400); bascule('U106B', 980, 420, Y9);
  W([360, 380], [460, 380]); W([820, 380], [920, 380]);
  W([580, 400], [640, 400], [640, 380], [700, 380]);
  W([1040, 380], [1080, 380], [1080, 600], [200, 600], [200, 380], [240, 380]);
  W([80, 660], [220, 660], [220, 400], [240, 400]); W([220, 660], [680, 660], [680, 400], [700, 400]);
  W([300, 740], [300, 720], [880, 720], [880, 400], [920, 400]); W([420, 720], [420, 400], [460, 400]);
  // validation : CD4081 (M1A = QA·EN, M1AN = /QA·EN, M1B = QB·EN, M1BN = /QB·EN), voyants en charge équivalente
  B.E('puce:cd4081', 'U108', 1400, 420); rail('U108', 'VDD', Y9); masse('U108', 'VSS');
  W([580, 380], [600, 380], [600, 280], [1300, 280], [1300, 340], [1340, 340]);
  W([620, 400], [620, 240], [1280, 240], [1280, 380], [1340, 380]);
  W([1080, 420], [1340, 420]);
  W([1040, 400], [1060, 400], [1060, 460], [1340, 460]);
  W([80, 880], [1320, 880], [1320, 360], [1340, 360]);
  for (const y of [400, 440, 480]) W([1320, y], [1340, y]);
  lab(['CLK1', '+'], 'CLK1', 'g'); lab(['DIR1', 'C'], 'DIR1', 'h'); lab(['EN1', 'C'], 'EN1', 'b');
  ['M1A', 'M1AN', 'M1B', 'M1BN'].forEach((nom, k) => {
    const y = 340 + 40 * k;
    const net = ['M1A', 'M1/A', 'M1B', 'M1/B'][k], yl = 240 + 140 * k;
    lab([1460, y], net, 'dhb');                                         // sorties vers la carte de puissance
    // charge équivalente (voyant) écartée des sorties et reliée par la même étiquette : place pour les pastilles
    R('RV' + (k + 1), 1720, yl, 0, 1e3); lab(['RV' + (k + 1), 'A'], net, 'g');
    B.E('led', nom, 1840, yl, 0, { couleur: k < 2 ? 'rouge' : 'bleu' }); W([1760, yl], [1800, yl]); masse(nom, 'B');
  });
}

/* ---------- Étape M4 : puissance (quatre IRLZ44N) et moteur pas à pas unipolaire ---------- */
function etapeM4(B) {
  const { R, C, W, masse, lab } = outils(B);
  const YB = 60;
  // phases du séquenceur (générateur équivalent) : 100 pas/s = 0,5 tr/s ; batterie 12,6 V
  B.E('puce:generateur-phases', 'G1', 0, 900, 0, { f: 100, V: 9 }); masse('G1', 'GND');
  B.E('pile', 'BAT', -200, 160, 3, { V: 12.6 }); masse('BAT', '−');
  W([-200, 120], [-200, YB], [1700, YB]);
  C('C120', -80, 120, 1, 470e-6); masse('C120', 'B'); W([-80, YB], [-80, 80]);
  B.E('puce:pas-a-pas-unipolaire', 'M1', 1560, 260, 0, { R: 30, L: 0.02, vmax: 300 });
  const phases = ['A', 'AN', 'B', 'BN'];
  phases.forEach((ph, k) => {
    const qx = 400 + 260 * k, [gx, gy] = B.P('G1', ph), dx = qx - 160;
    W([gx, gy], [dx, gy], [dx, 580]); lab([dx, gy], ['M1A', 'M1/A', 'M1B', 'M1/B'][k], 'dbh');
    R('R' + (120 + k), qx - 120, 580, 0, 100); W([qx - 80, 580], [qx - 60, 580]);
    R('R' + (124 + k), qx - 80, 640, 1, 10e3); masse('R' + (124 + k), 'B'); W([qx - 80, 580], [qx - 80, 600]);
    const q = 'Q' + (101 + k);
    B.E('puce:irlz44n', q, qx, 600); masse(q, 'S');
    // bobines du moteur : drain → étiquette BOB_x ; même étiquette sur la broche du moteur (liaison sans fil)
    const bob = 'BOB_' + ['A', '/A', 'B', '/B'][k];
    W([qx - 20, 520], [qx - 20, 500]); lab([qx - 20, 500], bob, 'h'); lab(['M1', ph], bob, 'g');
    const d = 'D' + (101 + k);
    B.E('diode', d, qx + 40, 440, 3, { Vf: 0.35 }); W([qx - 20, 500], [qx + 40, 500], [qx + 40, 480]); W([qx + 40, 400], [qx + 40, YB]);
  });
  for (const com of ['COMA', 'COMB']) { const [x, y] = B.P('M1', com); W([x, y], [x, YB]); }
}

/* ---------- Indicateurs : rôle de chaque composant sur sa carte (pastille jaune, sans effet électrique) ----------
   Posés après les étiquettes de réseau : chaque pastille évite boîtiers, pastilles, étiquettes et fils. */
const ALIM = { V1: 'Alim 9 V' }, VREF = { V2: 'Vref 4,5 V' };
const ROLES = {
  A: { ...ALIM, G1: 'Appareil source (jack)', C1: 'Blocage du continu', R1: 'Limite de courant', T1: "Transfo d'isolement",
    R2: "Protection d'entrée", D1: 'Écrêtage', R3: "Entrée de l'ampli", U1A: 'Ampli du signal', R4: 'Gain minimum',
    RV1: 'Réglage du gain', C2: 'Anti-oscillation', R5: 'Pont Vref haut', R6: 'Pont Vref bas', C3: 'Filtrage Vref',
    U1B: 'Tampon Vref', R7: 'Isolement Vref', C4: 'Réservoir Vref', C5: 'Découplage Vref' },
  B: (() => {
    const o = { ...ALIM, ...VREF, G1: 'Sortie bloc A (équiv.)' };
    for (const v of VOIES_B) [0, 1].forEach(e => {
      const n = i => 'R' + (v.r0 + (e ? 3 : 0) + i), f = v.f.replace(' ', '');
      o[v.u[e]] = `Ampli filtre ${f} (${e + 1})`; o[n(0)] = `Entrée filtre ${f}`; o[n(1)] = `Réaction ${f}`; o[n(2)] = `Accord ${f}`;
      o['C' + (v.c0 + 2 * e)] = `Condo série ${f}`; o['C' + (v.c0 + 2 * e + 1)] = `Condo réaction ${f}`;
    });
    return o;
  })(),
  C: { ...ALIM, ...VREF, G1: 'Sortie filtre 3 kHz (équiv.)', R40: 'Entrée comparateur', U4B: 'Mise en carré', R41: 'Hystérésis',
    R42: 'Rappel SQ3', D2: 'Détecteur de crête', C30: 'Mémoire de crête', R43: 'Décharge de crête', U5B: 'Détecteur de présence',
    R44: 'Pont de seuil haut', R45: 'Pont de seuil', RV2: 'Réglage du seuil', R46: 'Hystérésis présence', R49: 'Rappel présence',
    D3: 'Retombée rapide', R48: 'Retombée 3 ms', R47: 'Retard 22 ms', C31: 'Temporisation', U7A: 'Trigger PRES3' },
  D: { ...ALIM, SQ6: 'Porteuse carrée (équiv.)', U8: 'PLL 6 kHz', C40: 'Condo du VCO', R50: 'Résistance du VCO',
    R51: 'Filtre de boucle', R52: 'Amortissement boucle', C41: 'Condo de boucle', R53: 'Moyenne PC1', C42: 'Moyenne PC1',
    U4D: 'Détecteur verrouillage', R54: 'Seuil LOCK haut', R55: 'Seuil LOCK bas', R56: 'Hystérésis LOCK', R57: 'Rappel LOCK' },
  E: { ...ALIM, ...VREF, PRES375: 'Présence 375 Hz (équiv.)', PRES750: 'Présence 750 Hz (équiv.)', PRES6: 'Porteuse (équiv.)',
    LOCK: 'Verrouillage (équiv.)', U9A: 'ET porteuse + LOCK', U9B: 'ET batterie OK', U9C: 'Validation ACT1', U9D: 'Validation ACT2',
    VBAT: 'Batterie (équiv.)', U6B: 'Surveillance batterie', R60: 'Pont haut', R61: 'Pont bas',
    C43: 'Filtre batterie', R63: 'Rappel OKBAT', R62: 'Hystérésis batterie',
    R64: 'Grille ACT1', R65: 'Tirage grille ACT1', Q1: 'Transistor ACT1', K1: 'Relais ACT1', D4: 'Roue libre ACT1',
    RL1: 'Charge ACT1', ACT1: 'Actionneur 1 (voyant)',
    R66: 'Grille ACT2', R67: 'Tirage grille ACT2', Q2: 'Transistor ACT2', K2: 'Relais ACT2', D5: 'Roue libre ACT2',
    RL2: 'Charge ACT2', ACT2: 'Actionneur 2 (voyant)' },
  H: { BAT: 'Batterie plomb 12 V', F1: 'Fusible 3 A', S1: 'Interrupteur marche', Q3: 'Anti-inversion', R70: 'Rappel de grille',
    D7: 'Protection de grille', D8: 'Anti-surtension', C60: 'Réservoir', C61: 'Découplage entrée', U10: 'Régulateur 9 V',
    C62: 'Stabilité sortie', C63: 'Découplage sortie', RCH: 'Charge (cartes)' },
  M1: { ...ALIM, F6: 'Référence 6 kHz (équiv.)', SQ3: 'Tonalité moteur 1 (équiv.)', U101A: 'Diviseur ÷2 → F3',
    U101B: 'Diviseur ÷2 → F1,5', U102A: 'Battement → BATT1', U105: 'Comparateur de sens', R111: 'Filtre de sens',
    C105: 'Filtre de sens', R112: 'Polarisation 4,5 V', R113: 'Polarisation 4,5 V', U109A: 'Trigger DIR1' },
  M2: { ...ALIM, BATT1: 'Battement (équiv.)', U103: 'Monostable F→V', C101: 'Durée monostable', R101: 'Durée minimale',
    RV101: 'Réglage Δf max', R102: 'Filtre F→V', R103: 'Filtre F→V', C102: 'Filtre F→V', C103: 'Filtre F→V',
    U104A: 'Ampli de filtrage', RV102: 'Réglage vitesse max', R104: 'Butée vitesse', R105: 'Entrée sommateur',
    U104B: 'Sommateur ×2', R107: 'Décalage zone morte', R106: 'Pont zone morte', RV103: 'Réglage zone morte',
    R108: 'Contre-réaction', R109: 'Gain ×2', U105: 'VCO des pas', R110: 'Résistance du VCO', C104: 'Condo du VCO' },
  M3: { ...ALIM, DIR1: 'Sens (équiv.)', EN1: 'Validation (équiv.)', CLK1: 'Horloge de pas (équiv.)',
    U107A: 'OU-X sens A', U106A: 'Bascule phase A', U107B: 'OU-X sens B', U106B: 'Bascule phase B', U108: 'Validation phases',
    RV1: 'Charge A1M1', RV2: 'Charge A2M1', RV3: 'Charge B1M1', RV4: 'Charge B2M1',
    M1A: 'Voyant A1M1', M1AN: 'Voyant A2M1', M1B: 'Voyant B1M1', M1BN: 'Voyant B2M1' },
  M4: (() => {
    const o = { G1: 'Séquenceur (équiv.)', BAT: 'Batterie 12 V', C120: 'Réservoir moteur', M1: 'Moteur pas à pas 1' };
    ['A1M1', 'A2M1', 'B1M1', 'B2M1'].forEach((p, k) => {
      o['R' + (120 + k)] = 'Grille ' + p; o['R' + (124 + k)] = 'Tirage ' + p; o['Q' + (101 + k)] = 'Transistor ' + p; o['D' + (101 + k)] = 'Roue libre ' + p;
    });
    return o;
  })(),
};
function poserRoles(B, bloc) {
  const r = ROLES[bloc] || {};
  for (const e of B.donnees().elements) if (r[e.nom]) e.indicateur = r[e.nom];
  GEO.placerIndicateurs(B.donnees());
}

/* ---------- Étude et étapes ---------- */
const DOC = 'https://claude.ai/artifact/1PcDxoL9UGYFd8e7nErVVK';
const ETAPES = [
  { id: 'demod6k-a', bloc: 'A', titre: 'Bloc A — entrée jack isolée, gain et Vref', construire: etapeA,
    generateur: 'G1 (TONALITÉS) : l\'appareil source, cinq tonalités de 0,2 V crête (6 kHz, 3 kHz, 1,5 kHz, 750 Hz, 375 Hz). Sa masse n\'est reliée qu\'au primaire de T1 : elle reste isolée de la carte.',
    texte: 'C1 bloque le continu de la sortie audio, R1 limite le courant, T1 (1:1) isole l\'appareil. Le secondaire est référencé à Vref ; R2 et D1 (BAV99) écrêtent toute surtension. U1A, inverseur : gain = (R4 + RV1) / (R2 + R3), réglé à 3 (RV1 à 20 %) pour 0,6 V crête par tonalité, soit 2,4 V après les filtres. Vref = 4,5 V : pont R5 / R6, C3, suiveur U1B, R7, C4, C5.',
    observer: 'L\'oscilloscope compare l\'entrée (G1) et la sortie de U1A, autour de 4,5 V. Tournez RV1 : le gain varie de 1 à 11. Mettez le bruit ou le ronflement de G1 (⚙) pour voir ce qui passe jusqu\'aux filtres.',
    dt: 4e-6, vitesse: 0.05, fenetre: 0.005, oscillo: [{ nom: 'G1', broche: '+', groupe: 1 }, { nom: 'U1A', broche: 'OUT1', groupe: 2 }, { nom: 'U1B', broche: 'OUT1', groupe: 2 }] },
  { id: 'demod6k-b', bloc: 'B', titre: 'Bloc B — banc de cinq filtres passe-bande', construire: etapeB,
    generateur: 'G1 : la sortie du bloc A, cinq tonalités de 0,6 V crête autour de Vref (pile V2 de 4,5 V, équivalente au suiveur U1B). V1 : le +9 V du bloc H.',
    texte: 'Chaque voie est faite de deux filtres à contre-réaction multiple identiques (gain 2 chacun, 4 en tout) : R1 en entrée, C vers l\'entrée −, C vers la sortie, R2 en contre-réaction, R3 vers Vref. Une ligne par voie : 6 kHz (Q = 5), 3 kHz (Q = 3), 1,5 kHz (Q = 2,5), 750 Hz et 375 Hz (Q = 5). MC33079 : GBW 16 MHz, indispensable à 6 kHz.',
    observer: 'Chaque sortie doit montrer sa seule tonalité, ≈ 2,4 V crête. Mettez à 0 l\'amplitude d\'une tonalité de G1 : seule sa voie s\'éteint. Changez la fréquence 2 (molette de G1) : la voie 3 kHz baisse en bord de bande (±0,3 kHz recommandé).',
    dt: 2e-6, vitesse: 0.02, fenetre: 0.01,
    oscillo: [{ nom: 'U1D', broche: 'OUT1', groupe: 1 }, { nom: 'U2B', broche: 'OUT1', groupe: 2 }, { nom: 'U2D', broche: 'OUT1', groupe: 3 }, { nom: 'U3B', broche: 'OUT1', groupe: 4 }, { nom: 'U3D', broche: 'OUT1', groupe: 5 }] },
  { id: 'demod6k-c', bloc: 'C', titre: 'Bloc C — mise en forme carrée et présence (voie 3 kHz)', construire: etapeC,
    generateur: 'G1 : la sortie du filtre 3 kHz, 2,4 V crête autour de Vref, coupée une demi-période sur deux (salves à 4 Hz : 125 ms présente, 125 ms absente). V2 : Vref.',
    texte: 'En haut, U4B et R40 / R41 forment un comparateur à hystérésis (≈ 90 mV) : SQ3 est un carré 0-9 V à la fréquence reçue (rappel R42). En bas, D2 (BAT85), C30 et R43 détectent la crête ; U5B la compare à Vref + 0,5 V (R44, R45, RV2), R46 ajoute ≈ 70 mV d\'hystérésis. La temporisation (R47 · C31 à l\'apparition, D3 + R48 à la disparition) et le trigger U7A donnent PRES3 après ≈ 25 ms, retombant en quelques ms.',
    observer: 'Courbes : le signal, SQ3, la tension de C31 et PRES3. Mesurez le retard de PRES3 à l\'apparition des salves. Réglez RV2 (seuil 0,5 V sur les voies moteur, 0,8 V sur les voies fixes) et baissez l\'amplitude de G1 jusqu\'à perdre la présence.',
    dt: 5e-6, vitesse: 0.2, fenetre: 0.5,
    oscillo: [{ nom: 'G1', broche: '+', groupe: 1 }, { nom: 'R42', broche: 'B', groupe: 2 }, { nom: 'C31', broche: 'A', groupe: 3 }, { nom: 'U7A', broche: 'Y', groupe: 4 }] },
  { id: 'demod6k-d', bloc: 'D', titre: 'Bloc D — PLL de référence 6 kHz (CD4046B)', construire: etapeD,
    generateur: 'SQ6 : la référence 6 kHz mise en carré par le bloc C (horloge 0-9 V). Changez sa fréquence pour explorer la plage de capture.',
    texte: 'Le VCO de U8 (R50 = 100 kΩ, C40 = 820 pF) est rebouclé sur COMP IN. Le comparateur phase-fréquence PC2 charge le filtre R51, R52, C41 (fn ≈ 100 Hz, ζ ≈ 0,7) : F6 (VCO OUT) finit exactement à la fréquence du pilote. PC1 (OU exclusif) reste bas une fois en phase : sa moyenne (R53, C42) passe sous 2,27 V (R54, R55) et U4D donne LOCK = 1 (hystérésis R56, rappel R57).',
    observer: 'VCO IN monte puis se stabilise ; LOCK passe à 1 en quelques dizaines de ms. Le libellé de U8 donne la fréquence du VCO. Coupez SQ6 (fréquence très basse) : LOCK retombe. Modèle du VCO comportemental : seuil Vt ≈ 1 V (⚙ de U8), à mesurer sur le composant réel.',
    dt: 1e-6, vitesse: 0.02, fenetre: 0.1,
    oscillo: [{ nom: 'U8', broche: 'VCOIN', groupe: 1 }, { nom: 'C42', broche: 'A', groupe: 2 }, { nom: 'R57', broche: 'B', groupe: 3 }, { nom: 'U8', variable: 'fvco', groupe: 4 }] },
  { id: 'demod6k-e', bloc: 'E', titre: 'Bloc E — validation, batterie et actionneurs', construire: etapeE,
    generateur: 'PRES6, LOCK, PRES750, PRES375 : inverseurs (toucher pour basculer ; position 2 = 1 logique). VBAT : la batterie qui varie lentement de 10,2 à 14,6 V (période 10 s). V1 : +9 V, V2 : Vref.',
    texte: 'G = PRES6 · LOCK · OKBAT (U9A, U9B) ; ENA1 = G · PRES750 (U9C) ; ENA2 = G · PRES375 (U9D). U6B compare +BAT divisé par R60 (15 kΩ) et R61 (10 kΩ) à Vref : OKBAT tombe à 10,8 V et revient vers 11,7 V (hystérésis R62, rappel R63, C43 contre les creux des moteurs). BS170 + relais 12 V, roue libre D4 / D5 ; les contacts allument les voyants des actionneurs.',
    observer: 'Les relais collent seulement quand la référence, le verrouillage et la batterie sont bons. Regardez OKBAT et la tension de batterie sur l\'oscilloscope : coupure vers 10,8 V, retour vers 11,7 V. Avec R60 = 14 kΩ (première version du document), on trouvait 10,4 V et 11,2 V : le courant de R62 dans le pont avait été négligé. Basculez PRES6 ou LOCK : les deux actionneurs tombent.',
    dt: 1e-4, vitesse: 1, fenetre: 20,
    oscillo: [{ nom: 'VBAT', broche: '+', groupe: 1 }, { nom: 'U6B', broche: 'OUT1', groupe: 2 }, { nom: 'K1', variable: 'contact', groupe: 3 }, { nom: 'K2', variable: 'contact', groupe: 3 }] },
  { id: 'demod6k-h', bloc: 'H', titre: 'Bloc H — alimentation par batterie au plomb', construire: etapeH,
    generateur: 'BAT : batterie au plomb 12,6 V (molette : de 10 à 14,7 V, ou −12,6 V pour l\'essai d\'inversion). RCH : charge équivalente de la carte de réception (30 mA).',
    texte: 'F1 (fusible lame 3 A), S1, puis Q3 (IRF4905, canal P) : la diode interne amorce la conduction, puis VGS = −12 V rend le canal passant (quelques mV de chute). Batterie inversée : Q3 bloqué. D7 (zener 15 V) protège la grille, R70 la tire à la masse. D8 (TVS SMBJ18A) écrête les surtensions, C60 sert de réservoir aux moteurs. U10 (LM2940-9) fournit 9 V de 10 à 14,7 V ; C61, C62 (≥ 22 µF exigés), C63.',
    observer: 'Tournez la molette de BAT de 10 à 14,7 V : le +9 V ne bouge pas ; sous ≈ 9,5 V, U10 décroche. Mettez −12,6 V : rien ne conduit. Diminuez RCH vers 0,1 Ω : F1 fond (toucher pour le remplacer).',
    dt: 1e-4, vitesse: 1, fenetre: 1,
    oscillo: [{ nom: 'BAT', broche: '+', groupe: 1 }, { nom: 'Q3', broche: 'S', groupe: 1 }, { nom: 'U10', broche: 'OUT', groupe: 2 }] },
  { id: 'demod6k-m1', bloc: 'M1', titre: 'Carte moteur M1 — références, écart et sens', construire: etapeM1,
    generateur: 'F6 : la référence 6 kHz verrouillée (bloc D). SQ3 : la tonalité du moteur 1 mise en carré (bloc C), ici 3,3 kHz, soit Δf = +300 Hz.',
    texte: 'U101A et U101B divisent F6 par 2 (F3 = 3 kHz) puis par 2 (F15 = 1,5 kHz, moteur 2). U102A échantillonne SQ3 au rythme de F3 : BATT1 est un carré à |Δf| = 300 Hz. Le PC2 de U105 (SIG = SQ3, COMP = F3), filtré par R111 · C105 et ramené à 4,5 V au repos par R112 / R113, vaut ≈ 8 V ou ≈ 0,8 V selon le signe de Δf ; le trigger U109A en tire DIR1 (inversé).',
    observer: 'BATT1 à 300 Hz ; changez SQ3 (molette) vers 2,7 kHz : BATT1 reste à 300 Hz mais la tension filtrée bascule et DIR1 change d\'état (≈ 0,2 s, constante de temps R111 · C105).',
    dt: 2e-6, vitesse: 0.05, fenetre: 0.5,
    oscillo: [{ nom: 'U101A', broche: 'Q', groupe: 1 }, { nom: 'U102A', broche: 'Q', groupe: 2 }, { nom: 'C105', broche: 'A', groupe: 3 }, { nom: 'U109A', broche: 'Y', groupe: 4 }] },
  { id: 'demod6k-m2', bloc: 'M2', titre: 'Carte moteur M2 — conversion, réglages et VCO', construire: etapeM2,
    generateur: 'BATT1 : le battement de M1, carré 0-9 V à |Δf| = 300 Hz (molette : changer l\'écart).',
    texte: 'U103A (CD4538) délivre une impulsion T = (R101 + RV101) · C101 par période ; RV101 à 8,5 kΩ donne T = 1,67 ms pour Δfmax = 300 Hz. Le Sallen-Key U104A (R102, R103, C102, C103 : 5 Hz) en tire VFV = 9 V · T · |Δf| = 4,5 V à l\'écart maximal. RV102 + R104 dosent α (vitesse maximale), R106 + RV103 fixent Voff (zone morte), U104B additionne avec un gain 2 : VCO IN = Voff + α · VFV. Le VCO de U105 (R110, C104) donne CLK1.',
    observer: 'VFV monte en ≈ 90 ms (rampe d\'accélération), puis CLK1 ≈ 600 Hz (3 tr/s) : libellé de U105. Baissez BATT1 vers 20 Hz : CLK1 s\'arrête (zone morte). Écart du modèle : pente du VCO ≈ 153 Hz/V au lieu des 177 Hz/V estimés, d\'où RV102 presque au maximum (8,5 % de sa piste entre VFV et le curseur) ; le réglage final se fait en mesurant CLK1.',
    dt: 5e-6, vitesse: 0.2, fenetre: 0.4,
    oscillo: [{ nom: 'U103', broche: 'Q1', groupe: 1 }, { nom: 'U104A', broche: 'OUT1', groupe: 2 }, { nom: 'U104B', broche: 'OUT1', groupe: 2 }, { nom: 'U105', variable: 'fvco', groupe: 3 }] },
  { id: 'demod6k-m3', bloc: 'M3', titre: 'Carte moteur M3 — séquenceur réversible et validation', construire: etapeM3,
    generateur: 'CLK1 : l\'horloge de pas du VCO (ralentie à 5 Hz pour suivre les voyants). DIR1 et EN1 : inverseurs (toucher pour basculer).',
    texte: 'U106A / U106B (bascules D) et U107A / U107B (OU exclusifs) forment un compteur de Gray réversible : DA = QB ⊕ DIR1, DB = /QA ⊕ DIR1. (QA, QB) parcourt 00 → 01 → 11 → 10 dans un sens, l\'ordre inverse dans l\'autre : seule la bobine B change de sens par rapport à A. U108 (CD4081) valide les quatre phases par EN1. Les voyants M1A … M1BN (1 kΩ) remplacent la carte de puissance.',
    observer: 'Les voyants tournent ; basculez DIR1 : ils tournent dans l\'autre sens. EN1 en position 1 : tout s\'éteint.',
    dt: 1e-3, vitesse: 1, fenetre: 2,
    oscillo: [{ nom: 'U108', broche: 'J', groupe: 1 }, { nom: 'U108', broche: 'K', groupe: 2 }, { nom: 'U108', broche: 'L', groupe: 3 }, { nom: 'U108', broche: 'M', groupe: 4 }] },
  { id: 'demod6k-m4', bloc: 'M4', titre: 'Carte moteur M4 — puissance et moteur pas à pas', construire: etapeM4,
    generateur: 'G1 (PHASES PAP) : les quatre phases du séquenceur, 100 pas/s (0,5 tr/s), niveau 9 V. BAT : batterie 12,6 V.',
    texte: 'Quatre IRLZ44N (Q101 à Q104) mettent tour à tour une demi-bobine à la masse : résistance de grille 100 Ω (R120 à R123), tirage 10 kΩ (R124 à R127), roue libre 1N5819 (D101 à D104) vers +BAT. Les prises médianes COMA, COMB vont à +BAT, C120 en réservoir. Moteur 12 V, 200 pas par tour, 30 Ω et 20 mH par demi-bobine.',
    observer: 'L\'aiguille du moteur tourne de 1,8° par pas ; courant d\'une phase ≈ 0,42 A. Montez la cadence de G1 au-delà de 1000 pas/s (300 tr/min) : le moteur décroche. Changez le sens de G1 (⚙).',
    dt: 2e-5, vitesse: 0.5, fenetre: 0.1,
    oscillo: [{ nom: 'G1', broche: 'A', groupe: 1 }, { nom: 'Q101', broche: 'D', groupe: 2 }, { nom: 'M1', variable: 'angle', groupe: 3 }] },
];

const etude = {
  id: 'demod6k', titre: 'Démodulation de tonalités à référence 6 kHz (version 2)',
  description: 'Chaque étape du document, simulée par un circuit équivalent : un générateur remplace l\'étage précédent, l\'étage lui-même est câblé avec ses valeurs. Partie 1 : carte de réception (A, B, C, D, E, H) ; partie 2 : carte moteur (M1 à M4, moteur 1 ; le moteur 2 est identique à 1,5 kHz).',
  document: DOC, etapes: [],
};
for (const e of ETAPES) {
  const { construire, generateur, texte, observer, bloc, ...reste } = e;
  const ex = { ...reste, etude: etude.id, bloc, generateur, texte, observer,
    description: `Étude « ${etude.titre} », étape ${bloc}. ${texte}`, construire: plan(B => { construire(B); outils(B).placerEtiquettes(); poserRoles(B, bloc); }) };
  etude.etapes.push(ex);
  G.FrWAExemples.push(ex);
}
G.FrWAEtudes = [etude];
})(window);
