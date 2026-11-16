/* frwa_flow-Circuit — monde.js
   « Monde physique » pseudo-réaliste partagé par les capteurs et les émetteurs :
   - objets / obstacles (matière : réflexion infrarouge, réflexion du son, affaiblissement radio),
   - sources de lumière (intensité en candelas → éclairement en lux = I / d²),
   - sources de chaleur / d'humidité (décroissance gaussienne autour de la source),
   - milieu RADIO : chaque émetteur déclare sa puissance et sa porteuse à chaque pas ; un récepteur calcule la puissance
     reçue (affaiblissement en espace libre généralisé + obstacles traversés). Base prévue pour WiFi / Bluetooth / LoRa :
     une API « paquets » existe aussi (envoyerPaquet / recevoirPaquets),
   - milieu SONORE : chaque émetteur d'ultrasons enregistre la pression qu'il produit ; un récepteur relit cette pression
     avec le retard de propagation (vitesse du son selon la température) et l'atténuation de chaque trajet (direct, écho).
   - AXES MÉCANIQUES (règle R10) : un moteur ou un servomoteur publie l'angle de son arbre sur un axe nommé ; une
     mécanique (monture, roue, bras…) lit cet axe. Même principe qu'une étiquette de réseau, mais pour un arbre.
     Unités SI : angle en rad, vitesse en rad/s, couple en N·m. Les axes survivent aux recompilations du schéma.
   Les positions sont celles des composants sur le plan de travail (20 px = 1 carreau). L'échelle se règle dans
   Simulation : « 1 carreau = X m » (monde) et « 1 carreau = X m » (radio, distances bien plus grandes). */
'use strict';
(function (G) {

const REGLAGES = { echelle: 0.01, echelleRadio: 5, exposant: 3, tAmb: 20, hAmb: 50, luxAmb: 30 };

class Monde {
  constructor(schema) {
    this.schema = schema;
    this.emissions = new Map();   // radio : id → { x, y, freq, dBm, actif, alim }
    this.paquets = [];            // radio par paquets (WiFi, BLE…) : { t, freq, dBm, x, y, contenu, source }
    this.son = new Map();         // ultrasons : id → { x, y, dir, buf, dt }
    this.axes = schema._axes || (schema._axes = new Map());   // axes mécaniques : nom → { angle, vitesse, couple, pilote }
    // canaux externes (pilotage Python / C / IA, webcam, micro, Arduino) : gardés d'une compilation à l'autre
    this.canaux = schema._canaux || (schema._canaux = { entrees: new Map(), sorties: new Map() });
  }
  get r() { return { ...REGLAGES, ...(this.schema.monde || {}) }; }
  mParPx() { return this.r.echelle / 20; }
  mParPxRadio() { return this.r.echelleRadio / 20; }
  liste(type) { return this.schema.elements.filter(e => e.type === type); }
  matiere(o) { return G.FrWAComposants.MATIERES[o.params.matiere] || G.FrWAComposants.MATIERES['carton blanc']; }

  /** rectangle d'un objet dans le monde [x0, y0, x1, y1] (rotation par quarts de tour) */
  rect(o) {
    const T = G.FrWAComposants.TYPES[o.type], [a, b, c, d] = T.boiteDe(o), { tourner } = G.FrWACircuit;
    const pts = [[a, b], [c, b], [c, d], [a, d]].map(([x, y]) => tourner(x, y, o.rot));
    return [o.x + Math.min(...pts.map(p => p[0])), o.y + Math.min(...pts.map(p => p[1])), o.x + Math.max(...pts.map(p => p[0])), o.y + Math.max(...pts.map(p => p[1]))];
  }
  /** intersection rayon / rectangle (méthode des « dalles ») : distance t ≥ 0 le long de (dx, dy) normalisé, ou null */
  static inter(ox, oy, dx, dy, [x0, y0, x1, y1], tMax = Infinity) {
    let t0 = 0, t1 = tMax;
    for (const [o, d, a, b] of [[ox, dx, x0, x1], [oy, dy, y0, y1]]) {
      if (Math.abs(d) < 1e-12) { if (o < a || o > b) return null; continue; }
      let ta = (a - o) / d, tb = (b - o) / d; if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return null;
    }
    return t0;
  }
  /** premier objet rencontré par un rayon partant de (x, y) dans la direction (dx, dy) : { d (px), objet, x, y } */
  lancerRayon(x, y, dx, dy, max = 1e6) {
    const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    let mieux = null;
    for (const o of this.liste('monde_objet')) {
      const t = Monde.inter(x, y, dx, dy, this.rect(o), max);
      if (t !== null && (!mieux || t < mieux.d)) mieux = { d: t, objet: o, x: x + dx * t, y: y + dy * t };
    }
    return mieux;
  }
  /** éclairement (lux) : lumière ambiante + Σ I/d² de chaque source */
  lux(x, y) {
    let L = this.r.luxAmb;
    for (const l of this.liste('monde_lumiere')) { const d = Math.hypot(l.x - x, l.y - y) * this.mParPx(); L += l.params.cd / Math.max(d * d, 1e-4); }
    return L;
  }
  sourceLumiere(x, y) {   // la source qui éclaire le plus ce point
    let best = null, bl = -1;
    for (const l of this.liste('monde_lumiere')) { const d = Math.hypot(l.x - x, l.y - y) * this.mParPx(), v = l.params.cd / Math.max(d * d, 1e-4); if (v > bl) { bl = v; best = l; } }
    return best;
  }
  climat(x, y, cle, amb) {
    let v = amb;
    for (const s of this.liste('monde_climat')) {
      const r = (s.params.rayon || 8) * 20, d = Math.hypot(s.x - x, s.y - y);
      v += (s.params[cle] - amb) * Math.exp(-((d / r) ** 2));
    }
    return v;
  }
  temperature(x, y) { return this.climat(x, y, 'temperature', this.r.tAmb); }
  humidite(x, y) { return Math.max(0, Math.min(100, this.climat(x, y, 'humidite', this.r.hAmb))); }
  vitesseSon(x, y) { return 331.3 + 0.606 * this.temperature(x, y); }

  /* ---------- Axes mécaniques ---------- */
  /** l'axe « nom » (créé au premier appel) : { angle (rad), vitesse (rad/s), couple (N·m), pilote (nom du moteur) } */
  axe(nom) {
    const k = String(nom || '').trim() || '?';
    if (!this.axes.has(k)) this.axes.set(k, { angle: 0, vitesse: 0, couple: 0, pilote: null });
    return this.axes.get(k);
  }
  /** un moteur publie l'état de son arbre au pas k ; deux moteurs sur le même axe au même pas = erreur signalée au second */
  piloterAxe(nom, pilote, k, angle, vitesse, couple = 0) {
    const a = this.axe(nom);
    if (a.pilote && a.pilote !== pilote && a.kPilote === k) throw new Error(`axe « ${nom} » déjà piloté par ${a.pilote}`);
    Object.assign(a, { angle, vitesse, couple, pilote, kPilote: k });
    return a;
  }

  /* ---------- Canaux externes ----------
     Entrée (écrite par la page ou un programme externe) : { valeur } ou forme d'onde { dt, echantillons, boucle, paliers, t0 }
     (t0 = temps simulé du premier échantillon, posé au premier usage ; interpolation linéaire, ou en paliers). */
  canal(nom, t, defaut = 0) {
    const e = this.canaux.entrees.get(String(nom)); if (!e) return defaut;
    if (!Array.isArray(e.echantillons)) return Number.isFinite(e.valeur) ? e.valeur : defaut;
    const n = e.echantillons.length; if (!n) return defaut;
    if (e.t0 === undefined || e.t0 === null) e.t0 = t;
    let x = (t - e.t0) / e.dt;
    if (x < 0) return e.echantillons[0];
    if (e.boucle) x %= n; else if (x >= n - 1) return e.echantillons[n - 1];
    const i = Math.floor(x), f = x - i, a = e.echantillons[i], b = e.echantillons[(i + 1) % n];
    return e.paliers ? a : a + (b - a) * f;
  }
  /** sortie : valeur rendue au programme externe (lue par l'API de pilotage) */
  publier(nom, valeur) { this.canaux.sorties.set(String(nom), valeur); }

  /* ---------- Radio ---------- */
  /** affaiblissement (dB) entre deux points : modèle log-distance + obstacles traversés */
  affaiblissement(x1, y1, x2, y2, freqMHz) {
    const d = Math.max(1, Math.hypot(x2 - x1, y2 - y1) * this.mParPxRadio());
    const pl1m = 20 * Math.log10(freqMHz) - 27.55;               // espace libre à 1 m (≈ 25 dB à 433 MHz)
    let obst = 0;
    const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    for (const o of this.liste('monde_objet')) {
      const t = Monde.inter(x1, y1, (x2 - x1) / L, (y2 - y1) / L, this.rect(o), L);
      if (t !== null) obst += this.matiere(o).radio;
    }
    return { pl: pl1m + 10 * this.r.exposant * Math.log10(d), obst, d };
  }
  emettre(id, e) { this.emissions.set(id, e); }
  /** puissance reçue en (x, y) sur freq : porteuse allumée (dBm) et maximum possible (pour l'indicateur RSSI) */
  recevoir(x, y, freqMHz) {
    let dBm = -Infinity, dBmMax = -Infinity, source = null;
    for (const [id, e] of this.emissions) {
      if (!e.alim || Math.abs(e.freq - freqMHz) > 0.5) continue;
      const a = this.affaiblissement(e.x, e.y, x, y, freqMHz), p = e.dBm - a.pl - a.obst;
      if (p > dBmMax) dBmMax = p;
      if (e.actif && p > dBm) { dBm = p; source = id; }
    }
    return { dBm, dBmMax, source };
  }
  /** rayon (px) au-delà duquel la puissance passe sous la sensibilité (sans obstacle) */
  portee(dBm, sensibilite, freqMHz) {
    const pl1m = 20 * Math.log10(freqMHz) - 27.55;
    const d = Math.pow(10, (dBm - sensibilite - pl1m) / (10 * this.r.exposant));
    return d / this.mParPxRadio();
  }
  /** API « paquets » pour de futurs modules WiFi / Bluetooth / LoRa (contenu = n'importe quel objet JS) */
  envoyerPaquet(t, p) { this.paquets.push({ t, ...p }); if (this.paquets.length > 500) this.paquets.shift(); }
  recevoirPaquets(x, y, freqMHz, sensibilite, depuis) {
    return this.paquets.filter(p => p.t > depuis && Math.abs(p.freq - freqMHz) < 1).map(p => {
      const a = this.affaiblissement(p.x, p.y, x, y, freqMHz); return { ...p, rssi: p.dBm - a.pl - a.obst };
    }).filter(p => p.rssi >= sensibilite);
  }

  /* ---------- Son (ultrasons) ---------- */
  enregistrerSon(id, x, y, dir, dt, k, pression) {
    let e = this.son.get(id);
    if (!e || e.dt !== dt) { e = { buf: new Float32Array(Math.ceil(0.04 / dt)), dt }; this.son.set(id, e); }
    Object.assign(e, { x, y, dir, k });
    e.buf[k % e.buf.length] = pression;
  }
  lireSon(e, k) { if (k < 0 || e.k - k >= e.buf.length || k > e.k) return 0; return e.buf[k % e.buf.length]; }
  /** pression reçue (Pa) par un récepteur placé en (x, y) et tourné vers dir : trajet direct + échos sur les objets */
  pressionRecue(x, y, dir, k, couplage) {
    let p = 0; const trajets = [];
    for (const [, e] of this.son) {
      const dt = e.dt, c = this.vitesseSon(x, y), mpx = this.mParPx();
      // trajet direct (émetteur et récepteur côte à côte : couplage par l'air et le support)
      const dd = Math.max(0.01, Math.hypot(e.x - x, e.y - y) * mpx);
      p += couplage * 0.3 / dd * this.lireSon(e, k - Math.round(dd / c / dt));
      // échos : rayons dans l'axe de l'émetteur, et dans un cône de ±20°
      const vus = new Set();
      for (const ang of [0, -0.17, 0.17, -0.35, 0.35]) {
        const ca = Math.cos(ang), sa = Math.sin(ang), dx = e.dir[0] * ca - e.dir[1] * sa, dy = e.dir[0] * sa + e.dir[1] * ca;
        const h = this.lancerRayon(e.x, e.y, dx, dy);
        if (!h || vus.has(h.objet)) continue; vus.add(h.objet);
        const d1 = h.d * mpx, d2 = Math.hypot(h.x - x, h.y - y) * mpx, chemin = Math.max(0.02, d1 + d2);
        const directivite = Math.cos(ang) ** 4, absorption = Math.pow(10, -1.3 * chemin / 20);   // ≈ 1,3 dB/m à 40 kHz
        const a = this.matiere(h.objet).refSon * 0.3 / chemin * directivite * absorption;
        p += a * this.lireSon(e, k - Math.round(chemin / c / dt));
        trajets.push({ d: d1, x: h.x, y: h.y, retard: chemin / c });
      }
    }
    return { p, trajets };
  }
}

G.FrWAMonde = { Monde, REGLAGES };
})(window);
