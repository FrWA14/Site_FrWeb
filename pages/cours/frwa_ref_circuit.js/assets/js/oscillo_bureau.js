/* frwa_flow-Circuit — oscillo_bureau.js
   Oscilloscope « de bureau », sur le modèle de l'écran TiePie de frwa_flow-Instrument (lui-même proche de Multi Channel) :
   un écran de 10 × 8 divisions par graphe (les courbes jointes sont superposées, les graphes dissociés sont empilés),
   chaque courbe avec sa gamme (tension par division) choisie automatiquement ; barre d'échelles ; curseurs de temps et
   de tension ; déclenchement (trigger) sur front montant ou descendant ; tableau de mesures ; zoom à la souris
   (clic gauche glissé = agrandir la zone, molette = zoom horizontal, clic droit maintenu = se déplacer, double-clic =
   tout voir) ; export CSV et PNG.
   Il ne sert que sur un écran large avec une souris, en affichage temporel, et seulement si la page le demande
   (FrWAConfig.oscilloBureau) : sur mobile, et pour le spectre et la cascade, interface.js garde l'oscilloscope en bandeau.
   Enregistrement : les NP derniers points de chaque courbe (tampon circulaire), pris tous les « durée de l'écran / NP »
   (au plus vite : à chaque pas de calcul). L'écran montre NV points (NV ≤ NP / 2 : la durée choisie) : les derniers, le
   plus récent à droite, ou, trigger actif, ceux qui entourent le dernier front (montant ou descendant) de la courbe de référence
   (placé au milieu de l'écran ; sans front : défilement libre). */
'use strict';
(function (G) {
const { formater } = G.FrWAComposants;
const NP = 20000;
let NV = NP;                                 // points montrés : durée de l'écran / période d'enregistrement
const FENETRES = [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10];
const MESURES = ['Min', 'Max', 'Crête-crête', 'Moyenne', 'RMS', 'Fréquence'];

let A = null;                                // accès à l'interface : { oscillo, nomVoie, mesurerVoie, menuVoie, reglerFenetre }
let ecran = null, ctx = null, cadre = { x: 0, y: 0, w: 1, h: 1 };   // cadre : celui du graphe en cours de dessin
let zone = cadre, pistes = [];               // zone de tracé entière ; un graphe (piste) par groupe de courbes : { voies, c }
const trig = { actif: false, front: 1, niveau: 0, src: null, dec: 0, trouve: false, cle: '' };
const enr = { pe: 0, n: 0, prochain: 0, tDernier: 0, tampons: new WeakMap() };
const vue = { zoom: 1, centre: 0.5, zy: 1, cy: 0, sel: null, curseurs: 'aucun', c: [0.3, 0.7], cv: [2, -2], glisse: null, ref: null };
const cache = { n: -1, voies: null, gammes: new Map(), mesures: 0 };
const $ = id => document.getElementById(id);
const si = (v, u = '', c = 3) => formater(v, u, c);
const echapper = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- Enregistrement ---------- */
function tampon(v) { let d = enr.tampons.get(v); if (!d) { d = new Float32Array(NP).fill(NaN); enr.tampons.set(v, d); } return d; }
function raz() { enr.n = 0; enr.prochain = 0; enr.tDernier = 0; enr.tampons = new WeakMap(); cache.n = -1; }
function echantillonner(sim) {
  const pe = Math.max(sim.dt, A.oscillo.fenetre / (NP / 2));     // moitié du tampon : de quoi reculer jusqu'au front du trigger
  if (pe !== enr.pe || sim.t < enr.tDernier) { raz(); enr.pe = pe; }
  NV = Math.min(NP / 2, Math.max(2, Math.round(A.oscillo.fenetre / pe)));
  if (sim.t < enr.prochain) return;
  enr.prochain = sim.t + pe - sim.dt / 2;
  const k = enr.n % NP;
  for (const v of A.oscillo.voies) tampon(v)[k] = A.mesurerVoie(v, sim);
  enr.n++; enr.tDernier = sim.t;
}
/** lecteur d'une courbe : i de 0 (le plus ancien montré) à NV − 1 (le plus récent montré) ; NaN si rien n'a été mesuré */
function lecteur(v) { const d = tampon(v), base = enr.n - NV - trig.dec; return i => (base + i < 0 ? NaN : d[(base + i) % NP]); }
const tempsDe = i => enr.tDernier - (NV - 1 - i + trig.dec) * enr.pe;

/* ---------- Déclenchement (trigger) ----------
   Source : la courbe de référence (la dernière case cliquée dans la barre d'échelles). On cherche son dernier front (montant
   ou descendant, au choix) par le niveau choisi qui soit suivi d'un demi-écran de points : l'écran recule de « dec » points pour le centrer. */
function majDeclenchement(ref) {
  if (!trig.actif || !ref) { trig.dec = 0; trig.trouve = false; trig.src = null; return; }
  const d = tampon(ref);
  if (trig.src !== ref) {                                               // nouvelle source : niveau au milieu de sa courbe
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < NP; i++) { const x = d[i]; if (x < mn) mn = x; if (x > mx) mx = x; }
    trig.niveau = mn <= mx ? (mn + mx) / 2 : 0; trig.src = ref;
  }
  const cle = enr.n + '|' + trig.niveau + '|' + NV + '|' + trig.front;
  if (cle === trig.cle) return;
  trig.cle = cle; trig.dec = 0; trig.trouve = false;
  const demi = NV >> 1, bas = Math.max(1, enr.n - NP + demi + 1);
  for (let j = enr.n - 1 - demi; j >= bas; j--) {
    const v1 = d[j % NP], v0 = d[(j - 1) % NP];
    if (trig.front > 0 ? v1 >= trig.niveau && v0 < trig.niveau : v1 <= trig.niveau && v0 > trig.niveau) { trig.dec = enr.n - 1 - (j + demi); trig.trouve = true; break; }
  }
}

/* ---------- Gammes ---------- */
function suite125(x) {
  if (!(x > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  return [1, 2, 5, 10].find(m => m * p >= x) * p;
}
/** gamme de chaque courbe (pleine échelle = ±gamme = 4 divisions), d'après tout l'enregistrement */
function gammes() {
  const voies = A.oscillo.voies;
  if (cache.n === enr.n && cache.voies === voies && cache.gammes.size === voies.length) return cache.gammes;
  cache.gammes = new Map();
  for (const v of voies) {
    const d = tampon(v); let m = 0;
    for (let i = 0; i < NP; i++) { const x = Math.abs(d[i]); if (x > m) m = x; }
    cache.gammes.set(v, suite125(Math.max(m * (1 - 1e-6), 1e-9)));
  }
  cache.n = enr.n; cache.voies = voies;
  return cache.gammes;
}
function reference() { const voies = A.oscillo.voies; return voies.includes(vue.ref) ? vue.ref : voies[0]; }

/* ---------- Dessin (repris de tiepie.js) ---------- */
function fenetre() { const l = 1 / vue.zoom, a = Math.min(Math.max(vue.centre - l / 2, 0), 1 - l); return [a, a + l]; }
function yDe(val, g) { return cadre.y + cadre.h / 2 - (4 * val / g - vue.cy) * vue.zy * cadre.h / 8; }
const valeurA = (c, py, g) => ((4 - (py - c.y) / c.h * 8) / vue.zy + vue.cy) * g / 4;      // inverse de yDe dans le cadre c
/** un graphe par groupe de courbes (les mêmes groupes que le bandeau : boutons joindre / dissocier), empilés */
function calculerPistes(W, H) {
  zone = { x: 58, y: 10, w: W - 68, h: H - 32 };
  const voies = A.oscillo.voies, gs = [...new Set(voies.map(v => v.groupe))], n = Math.max(1, gs.length), esp = 16, h = (zone.h - esp * (n - 1)) / n;
  pistes = (gs.length ? gs : [null]).map((gid, k) => ({ voies: voies.filter(v => v.groupe === gid), c: { x: zone.x, y: zone.y + k * (h + esp), w: zone.w, h } }));
}
const pisteDe = v => pistes.find(p => p.voies.includes(v)) || pistes[0];
const pisteA = py => pistes.find(p => py <= p.c.y + p.c.h + 4) || pistes[pistes.length - 1];

function dessiner() {
  if (!ecran) return;
  const dpr = window.devicePixelRatio || 1, W = ecran.clientWidth, H = ecran.clientHeight;
  if (!W || !H) return;
  if (ecran.width !== Math.round(W * dpr) || ecran.height !== Math.round(H * dpr)) { ecran.width = Math.round(W * dpr); ecran.height = Math.round(H * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  calculerPistes(W, H);
  ctx.fillStyle = '#050909'; ctx.fillRect(0, 0, W, H);
  const G_ = gammes(), [a, b] = fenetre(), ref = reference();
  majDeclenchement(ref);
  pistes.forEach((p, k) => {
    const bas = k === pistes.length - 1;
    cadre = p.c;
    grille(a, b, p.voies.includes(ref) ? ref : p.voies[0], G_, bas);
    traces(a, b, G_, p.voies, bas);
  });
  curseurs(a, b, ref, G_);
  if (vue.sel) {
    const { x0, y0, x1, y1 } = vue.sel;
    ctx.fillStyle = 'rgba(54,197,240,.12)'; ctx.strokeStyle = 'rgba(54,197,240,.9)'; ctx.setLineDash([5, 3]);
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.strokeRect(Math.min(x0, x1) + 0.5, Math.min(y0, y1) + 0.5, Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.setLineDash([]);
  }
  echelles(a, b, ref, G_);
  const t = performance.now();
  if (t - cache.mesures > 300) { cache.mesures = t; mesures(a, b); }
}

function grille(a, b, ref, G_, bas) {
  const { x, y, w, h } = cadre;
  ctx.strokeStyle = '#1f3532'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i <= 10; i++) { const X = Math.round(x + i * w / 10) + 0.5; ctx.moveTo(X, y); ctx.lineTo(X, y + h); }
  for (let j = 0; j <= 8; j++) { const Y = Math.round(y + j * h / 8) + 0.5; ctx.moveTo(x, Y); ctx.lineTo(x + w, Y); }
  ctx.stroke();
  ctx.strokeStyle = '#2f504b'; ctx.beginPath();
  const cx = Math.round(x + w / 2) + 0.5, cy = Math.round(y + h / 2) + 0.5;
  for (let i = 0; i <= 50; i++) { const X = x + i * w / 50; ctx.moveTo(X, cy - 3); ctx.lineTo(X, cy + 3); }
  for (let j = 0; j <= 40; j++) { const Y = y + j * h / 40; ctx.moveTo(cx - 3, Y); ctx.lineTo(cx + 3, Y); }
  ctx.stroke();
  // temps (sous le dernier graphe) : compté depuis le point le plus récent (0 = maintenant, à droite), ou depuis le
  // front du trigger (0 au milieu de l'écran)
  ctx.fillStyle = '#7d908d'; ctx.font = '10px ui-monospace, Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const duree = NV * enr.pe, origine = trig.trouve ? 0.5 : 1;
  if (bas) for (let i = 0; i <= 10; i += 2) { const t = duree * (a + (b - a) * i / 10 - origine); ctx.fillText(si(Math.abs(t) < duree * 1e-9 ? 0 : t, 's'), x + i * w / 10, y + h + 5); }
  if (!ref) return;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = ref.coul;
  const g = G_.get(ref);
  for (let j = 0; j <= 8; j += h < 130 ? 4 : 2) {
    const div = (4 - j) / vue.zy + vue.cy;                               // arrondi : 0 V et non « 4,94 µV » après un zoom
    ctx.fillText(si((Math.abs(div) < 1e-3 / vue.zy ? 0 : div) * g / 4, ref.unite), x - 4, y + j * h / 8);
  }
}

function traces(a, b, G_, voies, bas) {
  const { x, y, w, h } = cadre;
  const i0 = Math.max(0, Math.floor(a * NV) - 1), i1 = Math.min(NV, Math.ceil(b * NV) + 1), parPixel = (i1 - i0) / w;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (const v of voies) {
    const g = G_.get(v), lire = lecteur(v);
    if (parPixel > 1.5) colonnes(lire, g, v.coul, i0, i1, a, b);
    else {
      ctx.strokeStyle = v.coul; ctx.lineWidth = 1.6; ctx.beginPath();
      let leve = true;
      for (let i = i0; i < i1; i++) {
        const val = lire(i); if (!(val === val)) { leve = true; continue; }
        const X = x + ((i / NV) - a) / (b - a) * w, Y = yDe(val, g);
        leve ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); leve = false;
      }
      ctx.stroke();
    }
    const y0 = yDe(0, g);                                                // repère du zéro de la courbe, à gauche
    ctx.fillStyle = v.coul; ctx.beginPath(); ctx.moveTo(x, y0 - 5); ctx.lineTo(x + 8, y0); ctx.lineTo(x, y0 + 5); ctx.fill();
  }
  ctx.restore();
  if (!bas) return;
  ctx.font = '11px ui-monospace, Consolas, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  const txt = `${si(NV * enr.pe * (b - a) / 10, 's')}/div`, l = ctx.measureText(txt).width;
  ctx.fillStyle = 'rgba(5,9,9,.8)'; ctx.fillRect(x + w - 9 - l, y + h - 18, l + 6, 15);
  ctx.fillStyle = '#7d908d'; ctx.fillText(txt, x + w - 6, y + h - 16);
}

/* Plus de points que de pixels : une barre verticale min → max par colonne de pixels (comme un oscilloscope), reliée à la
   colonne précédente. */
function colonnes(lire, g, couleur, i0, i1, a, b) {
  const { x, y, w, h } = cadre;
  ctx.fillStyle = couleur;
  let col = -1, lo = Infinity, hi = -Infinity, dernier = NaN;
  const vider = () => {
    if (col < 0 || lo === Infinity) return;
    const y1 = Math.max(y, Math.round(yDe(hi, g) - 0.75)), y2 = Math.min(y + h, Math.round(yDe(lo, g) + 0.75));
    if (y2 > y1) ctx.fillRect(Math.round(x + col - 0.5), y1, 2, y2 - y1);
  };
  for (let i = i0; i < i1; i++) {
    const val = lire(i), c = Math.floor(((i / NV) - a) / (b - a) * w);
    if (c !== col) {
      vider(); col = c;
      if (dernier === dernier) lo = hi = dernier; else { lo = Infinity; hi = -Infinity; }
    }
    if (!(val === val)) { dernier = NaN; continue; }
    if (val < lo) lo = val; if (val > hi) hi = val;
    dernier = val;
  }
  vider();
}

function curseurs(a, b, ref, G_) {
  const lect = [];
  if (trig.actif && ref) {                                               // trigger : niveau (trait) et instant (triangle) dans le graphe de la source
    cadre = pisteDe(ref).c;
    const { x, y, w, h } = cadre, Y = yDe(trig.niveau, G_.get(ref)), X = x + (0.5 - a) / (b - a) * w;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = ref.coul; ctx.fillStyle = ref.coul; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(x, Math.round(Y) + 0.5); ctx.lineTo(x + w, Math.round(Y) + 0.5); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x + w, Y); ctx.lineTo(x + w - 16, Y - 8); ctx.lineTo(x + w - 16, Y + 8); ctx.fill();
    if (trig.trouve) { ctx.beginPath(); ctx.moveTo(X, y + 9); ctx.lineTo(X - 6, y); ctx.lineTo(X + 6, y); ctx.fill(); }
    ctx.fillStyle = '#050909'; ctx.font = '700 9px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('T', x + w - 10, Y + 0.5);
    ctx.restore();
    lect.push(`Trigger ${A.nomVoie(ref)} ${trig.front > 0 ? '↑' : '↓'} ${si(trig.niveau, ref.unite, 4)}${trig.trouve ? '' : '  (aucun front : défilement libre)'}`);
  }
  cadre = vue.curseurs === 'tension' && ref ? pisteDe(ref).c : zone;
  const { x, y, w, h } = cadre;
  if (vue.curseurs === 'temps') {
    const idx = vue.c.map(f => Math.min(NV - 1, Math.max(0, Math.round((a + (b - a) * f) * NV)))), t = idx.map(tempsDe);
    ctx.strokeStyle = '#e8f1ef'; ctx.lineWidth = 1; ctx.setLineDash([6, 3]);
    vue.c.forEach(f => { const X = x + f * w; ctx.beginPath(); ctx.moveTo(X, y); ctx.lineTo(X, y + h); ctx.stroke(); });
    ctx.setLineDash([]);
    const dt = t[1] - t[0];
    lect.push(`Δt ${si(dt, 's', 4)}   1/Δt ${si(1 / Math.abs(dt), 'Hz', 4)}`);
    for (const v of A.oscillo.voies) { const lire = lecteur(v), u = idx.map(lire); lect.push(`${A.nomVoie(v)}  ${si(u[0], v.unite, 4)}  ${si(u[1], v.unite, 4)}  Δ ${si(u[1] - u[0], v.unite, 4)}`); }
  } else if (vue.curseurs === 'tension' && ref) {
    const g = G_.get(ref);
    ctx.strokeStyle = ref.coul; ctx.lineWidth = 1; ctx.setLineDash([6, 3]);
    vue.cv.forEach(dv => { const Y = y + h / 2 - dv * h / 8; ctx.beginPath(); ctx.moveTo(x, Y); ctx.lineTo(x + w, Y); ctx.stroke(); });
    ctx.setLineDash([]);
    const u = vue.cv.map(dv => (dv / vue.zy + vue.cy) * g / 4);
    lect.push(`${A.nomVoie(ref)}  1 : ${si(u[0], ref.unite, 4)}   2 : ${si(u[1], ref.unite, 4)}`, `Δ ${si(u[0] - u[1], ref.unite, 4)}`);
  }
  const l = lect.join('\n');
  if ($('ob-lecture').textContent !== l) $('ob-lecture').textContent = l;
}

/* ---------- Barre d'échelles : temps par division, puis une case par courbe ---------- */
function echelles(a, b, ref, G_) {
  const div = NV * enr.pe * (b - a) / 10, cases = [];
  cases.push(`<div class="echelle"><span class="nom">Temps / div</span><span class="val">${si(div, 's', 4)}</span><span class="sous">écran ${si(div * 10, 's', 4)} · 1 point / ${si(enr.pe, 's')}</span></div>`);
  A.oscillo.voies.forEach((v, k) => {
    const g = G_.get(v), d = g / 4 / vue.zy;
    cases.push(`<div class="echelle voie-o${v === ref ? ' ref' : ''}" data-k="${k}" style="--c:${v.coul}" title="Clic : graduer l'axe de gauche, les curseurs de tension et le trigger sur cette courbe"><span class="nom">${echapper(A.nomVoie(v))}<button class="plus" data-menu="${k}" title="Retirer la courbe…">✕</button></span><span class="val">${si(d, v.unite, 4)} / div</span><span class="sous">gamme ±${si(g, v.unite)}</span></div>`);
  });
  const html = cases.join(''), z = $('ob-echelles');
  if (z.dataset.html !== html) { z.dataset.html = html; z.innerHTML = html; }
}

/* ---------- Mesures sur la partie visible ---------- */
function mesures(a, b) {
  const i0 = Math.max(0, Math.floor(a * NV)), i1 = Math.min(NV, Math.ceil(b * NV));
  let html = '<tr><th>Courbe</th>' + MESURES.map(m => `<th>${m}</th>`).join('') + '</tr>';
  for (const v of A.oscillo.voies) {
    const lire = lecteur(v);
    let mn = Infinity, mx = -Infinity, s = 0, s2 = 0, n = 0;
    for (let i = i0; i < i1; i++) { const x = lire(i); if (!(x === x)) continue; if (x < mn) mn = x; if (x > mx) mx = x; s += x; s2 += x * x; n++; }
    let cellules;
    if (!n) cellules = MESURES.map(() => '—');
    else {
      // fréquence : passages montants par la moyenne, avec une hystérésis de 10 % de l'amplitude crête à crête
      const moy = s / n, hyst = (mx - mn) * 0.1; let bas = false, premier = -1, dernier = -1, fronts = 0;
      if (hyst > 0) for (let i = i0; i < i1; i++) {
        const x = lire(i); if (!(x === x)) continue;
        if (x < moy - hyst) bas = true;
        else if (bas && x > moy + hyst) { bas = false; if (premier < 0) premier = i; dernier = i; fronts++; }
      }
      const f = fronts >= 2 ? (fronts - 1) / ((dernier - premier) * enr.pe) : NaN;
      cellules = [si(mn, v.unite, 4), si(mx, v.unite, 4), si(mx - mn, v.unite, 4), si(moy, v.unite, 4), si(Math.sqrt(s2 / n), v.unite, 4), Number.isFinite(f) ? si(f, 'Hz', 4) : '—'];
    }
    html += `<tr><td style="color:${v.coul}">${echapper(A.nomVoie(v))}</td>` + cellules.map(c => `<td>${c}</td>`).join('') + '</tr>';
  }
  const t = $('ob-mesures');
  if (t.dataset.html !== html) { t.dataset.html = html; t.innerHTML = html; }
}

/* ---------- Zoom ---------- */
function majZoom() {
  const l = 1 / vue.zoom;
  vue.centre = Math.min(Math.max(vue.centre, l / 2), 1 - l / 2);
  vue.cy = Math.min(Math.max(vue.cy, -4 + 4 / vue.zy), 4 - 4 / vue.zy);
  const zx = vue.zoom > 1.001 ? `×${vue.zoom.toFixed(1).replace('.', ',')}` : '', zy = vue.zy > 1.001 ? `×${vue.zy.toFixed(1).replace('.', ',')}` : '';
  $('ob-zoom').textContent = zx || zy ? `zoom ${zx ? 'temps ' + zx : ''}${zx && zy ? '  ' : ''}${zy ? 'vertical ' + zy : ''}` : '';
  $('ob-tout').classList.toggle('alerte', vue.zoom > 1.001 || vue.zy > 1.001);   // en jaune : la vue est zoomée
  cache.mesures = 0;
}
function toutVoir() { vue.zoom = 1; vue.centre = 0.5; vue.zy = 1; vue.cy = 0; majZoom(); }
/** agrandit la zone sélectionnée : en temps si elle fait plus de 6 px de large, en vertical si plus de 6 px de haut */
function zoomerSelection(s) {
  const larg = Math.abs(s.x1 - s.x0), haut = Math.abs(s.y1 - s.y0), cadre = s.c;
  if (larg > 6) {
    const [a, b] = fenetre(), f0 = (Math.min(s.x0, s.x1) - cadre.x) / cadre.w, f1 = (Math.max(s.x0, s.x1) - cadre.x) / cadre.w;
    vue.centre = a + (b - a) * (f0 + f1) / 2;
    vue.zoom = Math.min(Math.max(vue.zoom / (f1 - f0), 1), 1000);
  }
  if (haut > 6) {
    const div = py => 4 - (py - cadre.y) / cadre.h * 8;
    const d0 = div(Math.max(s.y0, s.y1)), d1 = div(Math.min(s.y0, s.y1));
    vue.cy += (d0 + d1) / 2 / vue.zy;
    vue.zy = Math.min(Math.max(vue.zy * 8 / (d1 - d0), 1), 1000);
  }
  majZoom();
}
function gestes() {
  ecran.addEventListener('wheel', ev => {
    ev.preventDefault();
    const r = ecran.getBoundingClientRect(), f = Math.min(Math.max((ev.clientX - r.left - zone.x) / zone.w, 0), 1);
    const [a, b] = fenetre(), pos = a + (b - a) * f;
    vue.zoom = Math.min(Math.max(vue.zoom * (ev.deltaY < 0 ? 1.25 : 0.8), 1), 1000);
    vue.centre = pos - (f - 0.5) / vue.zoom;
    majZoom();
  }, { passive: false });
  ecran.addEventListener('contextmenu', ev => ev.preventDefault());
  ecran.addEventListener('mousedown', ev => {
    const r = ecran.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
    const c = pisteA(py).c, ref = reference(), cRef = ref ? pisteDe(ref).c : c;     // graphe sous la souris, graphe de la référence
    if (ev.button === 2) { ev.preventDefault(); vue.glisse = { x: ev.clientX, y: ev.clientY, centre: vue.centre, cy: vue.cy, h: c.h }; ecran.style.cursor = 'grabbing'; return; }
    if (ev.button !== 0) return;
    const fx = (px - zone.x) / zone.w, dansRef = py >= cRef.y - 6 && py <= cRef.y + cRef.h + 6;
    if (trig.actif && ref && dansRef) {
      cadre = cRef;
      if (Math.abs(py - yDe(trig.niveau, gammes().get(ref))) < 9) { vue.glisse = { trig: true, c: cRef, ref }; return; }
    }
    if (vue.curseurs === 'temps') {
      const k = Math.abs(fx - vue.c[0]) < Math.abs(fx - vue.c[1]) ? 0 : 1;
      if (Math.abs(fx - vue.c[k]) * zone.w < 12) { vue.glisse = { curseur: k }; return; }
    } else if (vue.curseurs === 'tension' && dansRef) {
      const dv = 4 - (py - cRef.y) / cRef.h * 8, k = Math.abs(dv - vue.cv[0]) < Math.abs(dv - vue.cv[1]) ? 0 : 1;
      if (Math.abs(dv - vue.cv[k]) * cRef.h / 8 < 12) { vue.glisse = { tension: k, c: cRef }; return; }
    }
    const borne = (v, a, l) => Math.min(Math.max(v, a), a + l);
    vue.sel = { x0: borne(px, c.x, c.w), y0: borne(py, c.y, c.h), c };
    vue.sel.x1 = vue.sel.x0; vue.sel.y1 = vue.sel.y0;
    vue.glisse = { selection: true };
  });
  window.addEventListener('mousemove', ev => {
    const g = vue.glisse; if (!g) return;
    const r = ecran.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
    if (g.curseur !== undefined) vue.c[g.curseur] = Math.min(Math.max((px - zone.x) / zone.w, 0), 1);
    else if (g.tension !== undefined) vue.cv[g.tension] = Math.min(Math.max(4 - (py - g.c.y) / g.c.h * 8, -4), 4);
    else if (g.trig) trig.niveau = valeurA(g.c, Math.min(Math.max(py, g.c.y), g.c.y + g.c.h), gammes().get(g.ref));
    else if (g.selection) {
      const c = vue.sel.c;
      vue.sel.x1 = Math.min(Math.max(px, c.x), c.x + c.w);
      vue.sel.y1 = Math.min(Math.max(py, c.y), c.y + c.h);
    } else {
      vue.centre = g.centre - (ev.clientX - g.x) / zone.w / vue.zoom;
      vue.cy = g.cy + (ev.clientY - g.y) / g.h * 8 / vue.zy;
      majZoom();
    }
  });
  window.addEventListener('mouseup', () => {
    const g = vue.glisse; vue.glisse = null; if (!g) return;
    if (g.x !== undefined) ecran.style.cursor = '';
    if (g.selection) { zoomerSelection(vue.sel); vue.sel = null; }
  });
  ecran.addEventListener('dblclick', toutVoir);
}

/* ---------- Exports ---------- */
function telecharger(nom, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
/** tout l'enregistrement, en CSV pour tableur français (point-virgule, virgule décimale) */
function csv() {
  const voies = A.oscillo.voies, lecteurs = voies.map(lecteur), nb = x => (x === x ? String(x).replace('.', ',') : '');
  const lignes = ['t (s);' + voies.map(v => `${A.nomVoie(v)}${v.unite ? ' (' + v.unite + ')' : ''}`).join(';')];
  for (let i = Math.max(0, NV - enr.n); i < NV; i++) lignes.push(nb(Number(tempsDe(i).toPrecision(9))) + ';' + lecteurs.map(l => nb(l(i))).join(';'));
  return lignes.join('\r\n') + '\r\n';
}

/* ---------- Mise en place ---------- */
function construire(oscilloEl) {
  const bloc = document.createElement('div'); bloc.id = 'ob';
  bloc.innerHTML = `
    <div id="ob-barre">
      <span>Curseurs</span>
      <span class="seg" id="ob-curseurs"><button data-c="aucun" class="on">Aucun</button><button data-c="temps">Temps</button><button data-c="tension">Tension</button></span>
      <span class="seg"><button id="ob-trig" title="Trigger : stabilise l'écran sur le front montant de la courbe de référence (la dernière case de couleur cliquée). Glisser le trait « T » pour régler le niveau.">Trigger</button><button id="ob-front" title="Front du trigger : montant (↑) ou descendant (↓)">↑</button></span>
      <label>Durée de l'écran <select id="ob-fenetre"></select></label>
      <span class="espace"></span>
      <span id="ob-zoom"></span>
      <button class="ov-mini" id="ob-tout" title="Clic gauche glissé = agrandir la zone choisie, clic droit maintenu = se déplacer, molette = zoom horizontal ; double-clic = tout voir">Tout voir</button>
      <button class="ov-mini" id="ob-csv" title="Tout l'enregistrement en CSV">⤓ CSV</button>
      <button class="ov-mini" id="ob-png" title="Image de l'écran">⤓ PNG</button>
    </div>
    <div id="ob-echelles"></div>
    <div id="ob-corps">
      <div id="ob-ecran-bloc"><canvas id="ob-ecran"></canvas><div id="ob-lecture"></div></div>
      <div id="ob-mesures-bloc"><table class="mesures" id="ob-mesures"></table></div>
    </div>`;
  oscilloEl.prepend(bloc);
  ecran = $('ob-ecran'); ctx = ecran.getContext('2d');
  $('ob-curseurs').addEventListener('click', ev => {
    const c = ev.target.dataset.c; if (!c) return;
    vue.curseurs = c;
    for (const b of $('ob-curseurs').children) b.classList.toggle('on', b.dataset.c === c);
  });
  $('ob-trig').addEventListener('click', () => { trig.actif = !trig.actif; trig.src = null; trig.cle = ''; $('ob-trig').classList.toggle('on', trig.actif); });
  $('ob-front').addEventListener('click', () => { trig.front = -trig.front; trig.cle = ''; $('ob-front').textContent = trig.front > 0 ? '↑' : '↓'; });
  const sel = $('ob-fenetre');
  for (const f of FENETRES) { const o = document.createElement('option'); o.value = f; o.textContent = si(f, 's'); sel.append(o); }
  sel.addEventListener('change', () => { A.reglerFenetre(Number(sel.value)); toutVoir(); });
  $('ob-tout').addEventListener('click', toutVoir);
  $('ob-csv').addEventListener('click', () => telecharger('oscilloscope.csv', new Blob(['﻿' + csv()], { type: 'text/csv' })));
  $('ob-png').addEventListener('click', () => ecran.toBlob(b => b && telecharger('oscilloscope.png', b)));
  $('ob-echelles').addEventListener('click', ev => {
    const menu = ev.target.closest('[data-menu]'), c = ev.target.closest('[data-k]');
    if (menu) { ev.stopPropagation(); A.menuVoie(A.oscillo.voies[Number(menu.dataset.menu)], menu); }
    else if (c) vue.ref = A.oscillo.voies[Number(c.dataset.k)];
  });
  gestes();
}
/** à appeler quand les courbes ou la durée de l'écran changent */
function rafraichir() { if (ecran) { $('ob-fenetre').value = String(A.oscillo.fenetre); cache.n = -1; cache.mesures = 0; } }

G.FrWAOscilloBureau = {
  NP,
  demarrer(acces, oscilloEl) { A = acces; construire(oscilloEl); rafraichir(); },
  /** vrai sur un écran large avec une souris (sinon : oscilloscope en bandeau, comme sur mobile) ;
      « #oscillo=bureau » dans l'adresse le force (essais sans écran, où aucune souris n'est annoncée) */
  possible: () => /oscillo=bureau/.test(location.hash) || window.matchMedia('(min-width: 900px) and (any-pointer: fine)').matches,
  echantillonner, dessiner, raz, rafraichir, toutVoir, csv, vue, enr, trig,
};
})(window);
