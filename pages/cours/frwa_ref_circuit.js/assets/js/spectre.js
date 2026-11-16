/* frwa_flow-Circuit — spectre.js
   Analyse en fréquence pour l'oscilloscope : FFT (radix 2), fenêtres de pondération, spectre d'amplitude et palette
   de la cascade (waterfall). Fonctions pures, sans dépendance : FrWASpectre.{ spectre, couleur, FENETRES }. */
'use strict';
(function (G) {

/* Fenêtres de pondération : gain cohérent (moyenne de w) pour corriger l'amplitude d'une raie */
const FENETRES = {
  hann: { nom: 'Hann', w: (k, N) => 0.5 - 0.5 * Math.cos(2 * Math.PI * k / (N - 1)) },
  blackman: { nom: 'Blackman', w: (k, N) => 0.42 - 0.5 * Math.cos(2 * Math.PI * k / (N - 1)) + 0.08 * Math.cos(4 * Math.PI * k / (N - 1)) },
  flattop: { nom: 'Flat top (amplitude juste)', w: (k, N) => { const a = 2 * Math.PI * k / (N - 1); return 0.21557895 - 0.41663158 * Math.cos(a) + 0.277263158 * Math.cos(2 * a) - 0.083578947 * Math.cos(3 * a) + 0.006947368 * Math.cos(4 * a); } },
  rectangle: { nom: 'Rectangulaire', w: () => 1 },
};
const cacheFen = new Map();
function fenetre(type, N) {
  const cle = type + N;
  if (!cacheFen.has(cle)) {
    const f = FENETRES[type] || FENETRES.hann, w = new Float64Array(N); let s = 0;
    for (let k = 0; k < N; k++) { w[k] = f.w(k, N); s += w[k]; }
    cacheFen.set(cle, { w, gain: s / N });
  }
  return cacheFen.get(cle);
}

/** FFT complexe en place (N puissance de 2) */
function fft(re, im) {
  const N = re.length;
  for (let i = 1, j = 0; i < N; i++) {
    let b = N >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let L = 2; L <= N; L <<= 1) {
    const a = -2 * Math.PI / L, wr = Math.cos(a), wi = Math.sin(a), h = L >> 1;
    for (let i = 0; i < N; i += L) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const p = i + k, q = p + h, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        const n = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = n;
      }
    }
  }
}

/** Spectre d'amplitude crête (même unité que le signal) des N derniers points d'un tampon circulaire.
    tampon : Float32Array de taille N, n : nombre total de points écrits. Composante continue retirée.
    Renvoie Float64Array(N/2 + 1) : amplitude de chaque raie k (fréquence k·fe/N), ou null si pas assez de points. */
function spectre(tampon, n, type = 'hann') {
  const N = tampon.length; if (n < N) return null;
  const { w, gain } = fenetre(type, N), re = new Float64Array(N), im = new Float64Array(N);
  let moy = 0, ok = 0;
  for (let k = 0; k < N; k++) { const x = tampon[(n + k) % N]; if (Number.isFinite(x)) { moy += x; ok++; } }
  moy = ok ? moy / ok : 0;
  for (let k = 0; k < N; k++) { const x = tampon[(n + k) % N]; re[k] = (Number.isFinite(x) ? x - moy : 0) * w[k]; }
  fft(re, im);
  const A = new Float64Array(N / 2 + 1), f = 2 / (N * gain);
  for (let k = 0; k <= N / 2; k++) A[k] = Math.hypot(re[k], im[k]) * (k === 0 || k === N / 2 ? f / 2 : f);
  A[0] = Math.abs(moy);                                            // raie 0 = valeur moyenne (affichée à part)
  return A;
}

/* Palette de la cascade : noir → bleu → cyan → jaune → blanc (t de 0 à 1) */
const PALETTE = [[0, 0, 0], [20, 20, 110], [0, 140, 200], [40, 220, 120], [255, 220, 0], [255, 255, 255]];
function couleur(t) {
  t = Math.max(0, Math.min(1, t)) * (PALETTE.length - 1);
  const i = Math.min(PALETTE.length - 2, Math.floor(t)), u = t - i, a = PALETTE[i], b = PALETTE[i + 1];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

G.FrWASpectre = { FENETRES, fft, spectre, couleur };
})(window);
