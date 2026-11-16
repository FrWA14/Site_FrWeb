// Modules de l'apprentissage Arduino : potentiomètre, photorésistance, buzzers, LED RGB, joystick, encodeur, clavier,
// capteurs (ultrasons HC-SR04, PIR, DHT11, son, obstacle IR, humidité du sol), puissance (module relais, L298N,
// ULN2003, moteur pas à pas 28BYJ-48), afficheurs (LCD 1602 I2C, OLED SSD1306, matrice MAX7219) et la carte
// Arduino Uno « passerelle » dont les broches suivent une vraie carte reliée par le port série (docs/PILOTAGE.md).
// Il n'y a pas encore de microcontrôleur simulé (V2) : les modules se commandent par des montages, des générateurs
// (bus_serie.puce.js) ou un programme externe.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const BASE = { prefixe: 'M', categorie: 'Kit Arduino', version: '1.0.0', regles: 1, modele3d: null };
const T = ['arduino', 'module'];
const borne = (x, a, b) => Math.max(a, Math.min(b, x));
// niveau logique lu avec hystérésis (règle R11) ; vcc = alimentation du module
const haut = (c, broche, vcc, cle) => { const v = c.v(broche) - c.v('GND'); c.s._n = c.s._n || {}; c.s._n[cle || broche] = FrWA.bus.lireNiveau(v, vcc, c.s._n[cle || broche] || false); return c.s._n[cle || broche]; };

/* =================== Entrées manuelles =================== */
FrWA.puce({
  ...BASE, prefixe: 'RV', id: 'potentiometre', tags: ['passif', 'arduino', 'basic'], nom: 'POTENTIOMÈTRE',
  description: 'Potentiomètre : résistance totale entre 1 et 3, curseur W à la position réglée (molette). Diviseur de tension classique sur une entrée analogique.',
  broches: ['1', 'W', '3'], typesBroches: { passif: ['1', 'W', '3'] }, cotes: { gauche: ['1'], bas: ['W'], droite: ['3'] },
  parametres: [
    { cle: 'position', nom: 'Position du curseur', unite: '%', defaut: 50, min: 0, max: 100 },
    { cle: 'R', nom: 'Résistance totale', unite: 'Ω', defaut: 10e3, min: 10, max: 1e7, echelle: 'log' },
  ], principal: 'position', variables: [],
  modele: { elements: [
    { t: 'R', a: '1', b: 'W', R: p => Math.max(0.5, p.R * p.position / 100) },
    { t: 'R', a: 'W', b: '3', R: p => Math.max(0.5, p.R * (1 - p.position / 100)) },
  ] },
  affichage: (s, p) => Math.round(p.position) + ' %',
});

FrWA.puce({
  ...BASE, prefixe: 'J', id: 'joystick', tags: [...T, 'capteur', 'interrupteur'], nom: 'JOYSTICK',
  description: 'Module joystick (KY-023) : deux potentiomètres 10 kΩ (VRx, VRy entre GND et +5V, milieu au repos) et un poussoir SW vers GND (maintenir appuyé). Positions X / Y dans ⚙.',
  broches: ['GND', '+5V', 'VRx', 'VRy', 'SW'], typesBroches: { alim_entree: ['GND', '+5V'], sortie: ['VRx', 'VRy'], drain_ouvert: ['SW'] },
  cotes: { gauche: ['GND', '+5V', 'VRx', 'VRy', 'SW'] },
  parametres: [
    { cle: 'x', nom: 'Position X', unite: '%', defaut: 0, min: -100, max: 100 },
    { cle: 'y', nom: 'Position Y', unite: '%', defaut: 0, min: -100, max: 100 },
  ], principal: 'x', variables: [{ cle: 'appui', nom: 'Bouton appuyé', type: 'bool' }],
  modele: {
    elements: [
      { t: 'R', a: '+5V', b: 'VRx', R: p => Math.max(1, 10e3 * (1 - (p.x + 100) / 200)) }, { t: 'R', a: 'VRx', b: 'GND', R: p => Math.max(1, 10e3 * (p.x + 100) / 200) },
      { t: 'R', a: '+5V', b: 'VRy', R: p => Math.max(1, 10e3 * (1 - (p.y + 100) / 200)) }, { t: 'R', a: 'VRy', b: 'GND', R: p => Math.max(1, 10e3 * (p.y + 100) / 200) },
      { t: 'S', a: 'SW', b: 'GND', nom: 'bouton' },
    ],
    etat: () => ({ appui: false }),
    pas(c) { c.regler('bouton', c.s.appui); },
  },
  interaction: { appui: s => { s.appui = true; }, relache: s => { s.appui = false; } },
  affichage: (s, p) => `x ${Math.round(p.x)} · y ${Math.round(p.y)}${s.appui ? ' · SW' : ''}`,
});

FrWA.puce({
  ...BASE, prefixe: 'ENC', id: 'encodeur-rotatif', tags: [...T, 'capteur'], nom: 'ENCODEUR',
  description: 'Encodeur rotatif (KY-040) : CLK et DT en quadrature (rappels de 10 kΩ vers +), SW vers GND. Toucher = un cran dans le sens choisi (une période de quadrature en 4 ms) ; bouton SW dans ⚙.',
  broches: ['GND', '+', 'SW', 'DT', 'CLK'], typesBroches: { alim_entree: ['GND', '+'], drain_ouvert: ['SW', 'DT', 'CLK'] },
  cotes: { gauche: ['GND', '+', 'SW', 'DT', 'CLK'] },
  parametres: [
    { cle: 'sens', nom: 'Sens d\'un cran', type: 'choix', options: ['horaire', 'anti-horaire'], defaut: 'horaire' },
    { cle: 'bouton', nom: 'Bouton SW appuyé', type: 'bool', defaut: false },
  ],
  variables: [{ cle: 'position', nom: 'Crans comptés', unite: '' }],
  modele: {
    elements: [
      { t: 'R', a: '+', b: 'CLK', R: 10e3 }, { t: 'R', a: '+', b: 'DT', R: 10e3 }, { t: 'R', a: '+', b: 'SW', R: 10e3 },
      { t: 'S', a: 'CLK', b: 'GND', nom: 'clk' }, { t: 'S', a: 'DT', b: 'GND', nom: 'dt' }, { t: 'S', a: 'SW', b: 'GND', nom: 'sw' },
    ],
    etat: () => ({ position: 0, demandes: 0, t0: null }),
    pas(c) {
      const s = c.s;
      if (s.demandes && s.t0 === null) s.t0 = c.t;
      let phase = 0;                                         // 0 = repos (CLK et DT hauts)
      if (s.t0 !== null) {
        phase = Math.floor((c.t - s.t0) / 1e-3) + 1;
        if (phase > 4) { s.position += c.p.sens === 'horaire' ? 1 : -1; s.demandes--; s.t0 = null; phase = 0; }
      }
      // séquence d'un cran : (CLK, DT) bas = contact fermé ; horaire : CLK tombe avant DT
      const seq = [[false, false], [true, false], [true, true], [false, true], [false, false]][phase];
      const [a, b] = c.p.sens === 'horaire' ? seq : [seq[1], seq[0]];
      c.regler('clk', a); c.regler('dt', b); c.regler('sw', !!c.p.bouton);
    },
  },
  interaction: { clic: s => { s.demandes++; } },
  affichage: s => 'crans ' + s.position,
});

const TOUCHES = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'];
FrWA.puce({
  ...BASE, prefixe: 'KP', id: 'clavier-4x4', tags: [...T, 'interrupteur'], nom: 'CLAVIER 4×4',
  description: 'Clavier matriciel 16 touches : une touche relie sa ligne Rk à sa colonne Cj. Choisir la touche dans ⚙ (molette) puis maintenir la puce appuyée pour l\'enfoncer. Lecture par balayage des lignes.',
  broches: ['R1', 'R2', 'R3', 'R4', 'C1', 'C2', 'C3', 'C4'], typesBroches: { passif: ['R1', 'R2', 'R3', 'R4', 'C1', 'C2', 'C3', 'C4'] },
  cotes: { bas: ['R1', 'R2', 'R3', 'R4', 'C1', 'C2', 'C3', 'C4'] }, largeur: 200,
  parametres: [{ cle: 'touche', nom: 'Touche', type: 'choix', options: TOUCHES, defaut: '5' }], principal: 'touche',
  variables: [{ cle: 'enfoncee', nom: 'Touche enfoncée', type: 'texte' }],
  modele: {
    elements: TOUCHES.map((t, i) => ({ t: 'S', a: 'R' + (Math.floor(i / 4) + 1), b: 'C' + (i % 4 + 1), nom: 'k' + i })),
    etat: () => ({ enfoncee: '', appui: false }),
    pas(c) { c.s.enfoncee = c.s.appui ? c.p.touche : ''; TOUCHES.forEach((t, i) => c.regler('k' + i, c.s.appui && t === c.p.touche)); },
  },
  interaction: { appui: s => { s.appui = true; }, relache: s => { s.appui = false; } },
  dessin(g, x) {
    const w = 18, x0 = -2 * w - 6, y0 = -x.H / 2 + 8;
    g.font = '9px ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    TOUCHES.forEach((t, i) => {
      const cx = x0 + (i % 4) * (w + 4), cy = y0 + Math.floor(i / 4) * 16, on = x.s.appui && x.p.touche === t;
      g.fillStyle = on ? '#ffcc00' : t === x.p.touche ? '#2b4f4c' : '#1c2626'; g.fillRect(cx, cy, w, 13);
      g.fillStyle = on ? '#000' : '#cfd8d6'; g.fillText(t, cx + w / 2, cy + 7);
    });
  },
  affichage: (s, p) => (s.appui ? '● ' : '○ ') + p.touche,
});

/* =================== Capteurs =================== */
FrWA.puce({
  ...BASE, prefixe: 'LDR', id: 'photoresistance', tags: ['capteur', 'optique', 'arduino', 'basic', 'monde'], nom: 'LDR',
  description: 'Photorésistance (GL5528) : R = R10 × (E / 10 lx)^−γ selon l\'éclairement du monde à sa position (lampes « Source de lumière », lumière ambiante), ou d\'un canal (« webcam » : luminance de la caméra, 0..1 → 0..1000 lx).',
  broches: ['A', 'B'], typesBroches: { passif: ['A', 'B'] }, cotes: { gauche: ['A'], droite: ['B'] },
  parametres: [
    { cle: 'source', nom: 'Lumière lue', type: 'choix', options: ['monde', 'canal'], defaut: 'monde' },
    { cle: 'canal', nom: 'Canal (0..1 = 0..1000 lx)', type: 'texte', defaut: 'webcam' },
    { cle: 'R10', nom: 'Résistance à 10 lx', unite: 'Ω', defaut: 10e3, min: 100, max: 1e6, echelle: 'log' },
    { cle: 'gamma', nom: 'Pente γ', unite: '', defaut: 0.7, min: 0.3, max: 1.2 },
  ],
  variables: [{ cle: 'lux', nom: 'Éclairement', unite: 'lx' }, { cle: 'R', nom: 'Résistance', unite: 'Ω' }],
  modele: {
    elements: [{ t: 'R', a: 'A', b: 'B', R: 10e3, nom: 'r' }],
    etat: () => ({ lux: 0, R: 10e3 }),
    pas(c) {
      const p = c.p, E = p.source === 'canal' ? 1000 * c.monde.canal(p.canal, c.t, 0) : c.monde.lux(c.ici.x, c.ici.y);
      c.s.lux = Math.max(0, E); c.s.R = borne(p.R10 * Math.pow(Math.max(c.s.lux, 0.01) / 10, -p.gamma), 50, 2e7);
      c.regler('r', c.s.R);
    },
  },
  affichage: s => Math.round(s.lux) + ' lx',
});

FrWA.puce({
  ...BASE, prefixe: 'US', id: 'hc-sr04', tags: [...T, 'capteur', 'son', 'monde'], nom: 'HC-SR04',
  description: 'Télémètre à ultrasons : une impulsion ≥ 10 µs sur TRIG lance une mesure ; ECHO passe à 1 pendant l\'aller-retour du son vers le premier objet devant le module (vers le haut du symbole), soit 58 µs par cm ; 2 cm à 4 m. Pas de 5 µs ou moins conseillé.',
  broches: ['VCC', 'TRIG', 'ECHO', 'GND'], typesBroches: { alim_entree: ['VCC', 'GND'], entree: ['TRIG'], sortie: ['ECHO'] },
  cotes: { bas: ['VCC', 'TRIG', 'ECHO', 'GND'] }, largeur: 120,
  variables: [{ cle: 'distance', nom: 'Distance mesurée', unite: 'm' }, { cle: 'mesures', nom: 'Mesures', unite: '' }],
  modele: {
    elements: [{ t: 'O', a: 'ECHO', ref: 'GND', V: 0, R: 100, nom: 'echo' }, { t: 'R', a: 'VCC', b: 'GND', R: 330 }],
    etat: () => ({ distance: 0, mesures: 0, tTrig: null, debut: null, fin: null }),
    pas(c) {
      const s = c.s, vcc = c.v('VCC') - c.v('GND'), trig = haut(c, 'TRIG', vcc);
      if (trig && s.tTrig === null) s.tTrig = c.t;
      if (!trig && s.tTrig !== null) {
        if (c.t - s.tTrig >= 10e-6 && s.fin === null) {
          const [x, y] = c.ici.point(0, -30), [dx, dy] = c.ici.direction(0, -1), h = c.monde.lancerRayon(x, y, dx, dy);
          const d = h ? h.d * c.monde.mParPx() : Infinity, v = c.monde.vitesseSon(x, y);
          s.distance = d > 4 ? 4 : Math.max(0.02, d); s.mesures++;
          s.debut = c.t + 450e-6;                                 // salve de 8 périodes à 40 kHz avant ECHO
          s.fin = s.debut + (d > 4 ? 38e-3 : 2 * s.distance / v);  // hors de portée : ECHO ≈ 38 ms
        }
        s.tTrig = null;
      }
      const actif = s.debut !== null && c.t >= s.debut && c.t < s.fin;
      if (s.fin !== null && c.t >= s.fin) { s.debut = null; s.fin = null; }
      c.regler('echo', actif && vcc > 3 ? vcc : 0);
    },
  },
  dessin(g, x) { g.strokeStyle = '#9aa6a4'; g.lineWidth = 1.5; for (const cx of [-24, 24]) { g.beginPath(); g.arc(cx, -2, 15, 0, 2 * Math.PI); g.stroke(); } },
  affichage: s => (s.distance * 100).toFixed(1) + ' cm',
});

FrWA.puce({
  ...BASE, prefixe: 'PIR', id: 'pir-hc-sr501', tags: [...T, 'capteur', 'monde'], nom: 'PIR HC-SR501',
  description: 'Détecteur de présence infrarouge : OUT passe à 1 (3,3 V) pendant la durée de maintien quand un objet du monde bouge à portée (déplacez un « Objet / obstacle »), ou quand on touche le module.',
  broches: ['VCC', 'OUT', 'GND'], typesBroches: { alim_entree: ['VCC', 'GND'], sortie: ['OUT'] }, cotes: { bas: ['VCC', 'OUT', 'GND'] },
  parametres: [
    { cle: 'maintien', nom: 'Durée de maintien', unite: 's', defaut: 3, min: 0.3, max: 300, echelle: 'log' },
    { cle: 'portee', nom: 'Portée', unite: 'm', defaut: 5, min: 0.5, max: 7 },
  ],
  variables: [{ cle: 'detection', nom: 'Présence détectée', type: 'bool' }],
  modele: {
    elements: [{ t: 'O', a: 'OUT', ref: 'GND', V: 0, R: 1e3, nom: 'out' }, { t: 'R', a: 'VCC', b: 'GND', R: 100e3 }],
    etat: () => ({ detection: false, tFin: -Infinity, vus: {}, toucher: false }),
    pas(c) {
      const s = c.s, mpx = c.monde.mParPx();
      if (c.k % 50 === 0) {                                   // les objets ne bougent pas plus vite que la souris
        for (const o of c.monde.liste('monde_objet')) {
          const d = Math.hypot(o.x - c.ici.x, o.y - c.ici.y) * mpx, cle = String(o.id), pos = o.x + ',' + o.y;
          if (d <= c.p.portee && s.vus[cle] !== undefined && s.vus[cle] !== pos) s.tFin = c.t + c.p.maintien;
          s.vus[cle] = pos;
        }
      }
      if (s.toucher) { s.tFin = c.t + c.p.maintien; s.toucher = false; }
      s.detection = c.t < s.tFin;
      c.regler('out', s.detection && c.v('VCC') - c.v('GND') > 4 ? 3.3 : 0);
    },
  },
  interaction: { clic: s => { s.toucher = true; } },
  affichage: s => (s.detection ? '● présence' : '○ rien'),
});

// DHT11 : 1 fil, drain ouvert (rappel externe 4,7 à 10 kΩ). L'hôte tire DATA à 0 ≥ 18 ms puis relâche ; le capteur
// répond 80 µs bas + 80 µs haut puis 40 bits (50 µs bas + 26 µs haut = 0, 70 µs haut = 1) : humidité, 0, température, 0, somme.
FrWA.puce({
  ...BASE, prefixe: 'DHT', id: 'dht11', tags: [...T, 'capteur', 'monde', 'bus'], nom: 'DHT11',
  description: 'Capteur de température et d\'humidité numérique (protocole 1 fil du DHT11) : lit le climat du monde à sa position (sources « chaleur / humidité », ambiance). Rappel de 10 kΩ vers VCC sur DATA à prévoir. Pas ≤ 5 µs.',
  broches: ['VCC', 'DATA', 'NC', 'GND'], typesBroches: { alim_entree: ['VCC', 'GND'], drain_ouvert: ['DATA'], nc: ['NC'] }, cotes: { bas: ['VCC', 'DATA', 'NC', 'GND'] },
  variables: [{ cle: 'temperature', nom: 'Température envoyée', unite: '°C' }, { cle: 'humidite', nom: 'Humidité envoyée', unite: '%' }, { cle: 'trames', nom: 'Trames envoyées', unite: '' }],
  modele: {
    elements: [{ t: 'S', a: 'DATA', b: 'GND', Ron: 30, nom: 'tire' }, { t: 'R', a: 'VCC', b: 'GND', R: 20e3 }],
    etat: () => ({ temperature: 0, humidite: 0, trames: 0, tBas: null, seq: null, k: 0, tSeg: 0 }),
    pas(c) {
      const s = c.s, vcc = c.v('VCC') - c.v('GND'), bas = !haut(c, 'DATA', vcc);
      if (s.seq === null) {
        if (bas && s.tBas === null) s.tBas = c.t;
        if (!bas && s.tBas !== null) {
          if (c.t - s.tBas >= 15e-3) {                         // départ reconnu : construire la réponse
            const t = c.monde.temperature(c.ici.x, c.ici.y), h = c.monde.humidite(c.ici.x, c.ici.y);
            s.temperature = Math.round(borne(t, 0, 50)); s.humidite = Math.round(borne(h, 20, 90));
            const octets = [s.humidite, 0, s.temperature, 0]; octets.push(octets.reduce((a, b) => a + b, 0) & 0xff);
            // [tirer DATA à 0 ?, durée] : attente, réponse (80 µs bas, 80 µs haut), 40 bits, fin (50 µs bas)
            s.seq = [[false, 30e-6], [true, 80e-6], [false, 80e-6]];
            for (const o of octets) for (let i = 7; i >= 0; i--) s.seq.push([true, 50e-6], [false, ((o >> i) & 1) ? 70e-6 : 26e-6]);
            s.seq.push([true, 50e-6]); s.k = 0; s.tSeg = c.t; s.trames++;
          }
          s.tBas = null;
        }
        c.regler('tire', false); return;
      }
      while (s.k < s.seq.length && c.t - s.tSeg >= s.seq[s.k][1]) { s.tSeg += s.seq[s.k][1]; s.k++; }
      if (s.k >= s.seq.length) { s.seq = null; c.regler('tire', false); return; }
      c.regler('tire', s.seq[s.k][0]);
    },
  },
  affichage: s => `${s.temperature} °C · ${s.humidite} %`,
});

FrWA.puce({
  ...BASE, prefixe: 'MIC', id: 'capteur-son', tags: [...T, 'capteur', 'son', 'pilotage'], nom: 'CAPTEUR SON',
  description: 'Module micro (KY-038) : AO = VCC/2 + amplitude du son (gain réglable), DO = 1 au-dessus du seuil. Le son vient d\'un canal : « micro » (micro du PC ou du téléphone, Simulation → Micro) ou d\'un programme.',
  broches: ['AO', 'GND', '+', 'DO'], typesBroches: { alim_entree: ['GND', '+'], sortie: ['AO', 'DO'] }, cotes: { gauche: ['AO', 'GND', '+', 'DO'] },
  parametres: [
    { cle: 'canal', nom: 'Canal du son (0..1)', type: 'texte', defaut: 'micro' },
    { cle: 'gain', nom: 'Gain', unite: '', defaut: 5, min: 0.1, max: 100, echelle: 'log' },
    { cle: 'seuil', nom: 'Seuil de DO', unite: '%', defaut: 60, min: 0, max: 100 },
  ],
  variables: [{ cle: 'niveau', nom: 'Niveau du son', unite: '' }],
  modele: {
    elements: [{ t: 'O', a: 'AO', ref: 'GND', V: 0, R: 1e3, nom: 'ao' }, { t: 'O', a: 'DO', ref: 'GND', V: 0, R: 1e3, nom: 'do' }, { t: 'R', a: '+', b: 'GND', R: 10e3 }],
    etat: () => ({ niveau: 0 }),
    pas(c) {
      const vcc = c.v('+') - c.v('GND'), n = c.monde.canal(c.p.canal, c.t, 0);
      c.s.niveau = n; const ao = borne(vcc / 2 + vcc / 2 * c.p.gain * n, 0, vcc);
      c.regler('ao', ao); c.regler('do', ao > vcc * c.p.seuil / 100 ? vcc : 0);
    },
  },
  affichage: s => 'son ' + s.niveau.toFixed(3),
});

FrWA.puce({
  ...BASE, prefixe: 'IR', id: 'obstacle-ir', tags: [...T, 'capteur', 'optique', 'monde'], nom: 'OBSTACLE IR',
  description: 'Détecteur d\'obstacle infrarouge (FC-51) : OUT passe à 0 quand un objet assez réfléchissant est devant le module (vers le haut du symbole) à moins de la portée.',
  broches: ['OUT', 'GND', 'VCC'], typesBroches: { alim_entree: ['GND', 'VCC'], sortie: ['OUT'] }, cotes: { bas: ['OUT', 'GND', 'VCC'] },
  parametres: [{ cle: 'portee', nom: 'Portée', unite: 'm', defaut: 0.15, min: 0.02, max: 0.8 }],
  variables: [{ cle: 'obstacle', nom: 'Obstacle détecté', type: 'bool' }, { cle: 'distance', nom: 'Distance', unite: 'm' }],
  modele: {
    elements: [{ t: 'O', a: 'OUT', ref: 'GND', V: 0, R: 1e3, nom: 'out' }, { t: 'R', a: 'VCC', b: 'GND', R: 2e3 }],
    etat: () => ({ obstacle: false, distance: 0 }),
    pas(c) {
      if (c.k % 20 === 0) {
        const [x, y] = c.ici.point(0, -20), [dx, dy] = c.ici.direction(0, -1), h = c.monde.lancerRayon(x, y, dx, dy);
        c.s.distance = h ? h.d * c.monde.mParPx() : Infinity;
        c.s.obstacle = !!h && c.s.distance * (1 / Math.max(0.05, c.monde.matiere(h.objet).refIR)) ** 0.5 <= c.p.portee;
      }
      c.regler('out', c.s.obstacle ? 0 : c.v('VCC') - c.v('GND'));
    },
  },
  affichage: s => (s.obstacle ? '● obstacle' : '○ libre'),
});

FrWA.puce({
  ...BASE, prefixe: 'HS', id: 'humidite-sol', tags: [...T, 'capteur', 'monde'], nom: 'HUMIDITÉ SOL',
  description: 'Sonde d\'humidité du sol : AO baisse quand le sol est humide (humidité du monde à sa position), DO = 0 quand l\'humidité dépasse le seuil.',
  broches: ['VCC', 'GND', 'DO', 'AO'], typesBroches: { alim_entree: ['VCC', 'GND'], sortie: ['DO', 'AO'] }, cotes: { gauche: ['VCC', 'GND', 'DO', 'AO'] },
  parametres: [{ cle: 'seuil', nom: 'Seuil d\'humidité de DO', unite: '%', defaut: 60, min: 0, max: 100 }],
  variables: [{ cle: 'humidite', nom: 'Humidité', unite: '%' }],
  modele: {
    elements: [{ t: 'O', a: 'AO', ref: 'GND', V: 0, R: 1e3, nom: 'ao' }, { t: 'O', a: 'DO', ref: 'GND', V: 0, R: 1e3, nom: 'do' }, { t: 'R', a: 'VCC', b: 'GND', R: 5e3 }],
    etat: () => ({ humidite: 0 }),
    pas(c) {
      const vcc = c.v('VCC') - c.v('GND'), h = c.monde.humidite(c.ici.x, c.ici.y);
      c.s.humidite = h; c.regler('ao', vcc * (0.95 - 0.7 * h / 100)); c.regler('do', h > c.p.seuil ? 0 : vcc);
    },
  },
  affichage: s => Math.round(s.humidite) + ' %',
});

/* =================== Sorties : son, lumière =================== */
FrWA.puce({
  ...BASE, prefixe: 'BZ', id: 'buzzer-actif', tags: ['son', 'arduino', 'basic'], nom: 'BUZZER ACTIF',
  description: 'Buzzer actif : sonne (≈ 2,3 kHz, oscillateur interne) dès que la tension entre + et − dépasse 2,5 V ; consomme ≈ 25 mA sous 5 V.',
  broches: ['+', '-'], typesBroches: { passif: ['+', '-'] }, cotes: { gauche: ['+'], droite: ['-'] },
  variables: [{ cle: 'sonne', nom: 'Sonne', type: 'bool' }],
  modele: {
    elements: [{ t: 'R', a: '+', b: '-', R: 200 }],
    etat: () => ({ sonne: false }),
    pas(c) { c.s.sonne = c.v('+') - c.v('-') > 2.5; },
  },
  dessin(g, x) { if (!x.s.sonne) return; g.strokeStyle = '#ffcc00'; g.lineWidth = 1.5; for (const r of [10, 16, 22]) { g.beginPath(); g.arc(0, 0, r, -0.6, 0.6); g.stroke(); } },
  affichage: s => (s.sonne ? '♪ sonne' : 'muet'),
});
FrWA.puce({
  ...BASE, prefixe: 'BZ', id: 'buzzer-passif', tags: ['son', 'arduino'], nom: 'BUZZER PASSIF',
  description: 'Buzzer passif (piézo) : il faut lui envoyer un signal carré (tone()) ; publie la fréquence et le niveau mesurés.',
  broches: ['+', '-'], typesBroches: { passif: ['+', '-'] }, cotes: { gauche: ['+'], droite: ['-'] },
  variables: [{ cle: 'frequence', nom: 'Fréquence jouée', unite: 'Hz' }, { cle: 'sonne', nom: 'Sonne', type: 'bool' }],
  modele: {
    elements: [{ t: 'R', a: '+', b: '-', R: 50 }, { t: 'C', a: '+', b: '-', C: 20e-9 }],
    etat: () => ({ frequence: 0, sonne: false, prec: false, tFront: null, tDernier: -1 }),
    pas(c) {
      const s = c.s, h = c.v('+') - c.v('-') > 1.5;
      if (h && !s.prec) { if (s.tFront !== null) s.frequence = 1 / (c.t - s.tFront); s.tFront = c.t; s.tDernier = c.t; }
      s.prec = h; s.sonne = s.tFront !== null && c.t - s.tDernier < Math.min(0.1, 3 / Math.max(1, s.frequence));
      if (!s.sonne) s.frequence = 0;
    },
  },
  affichage: s => (s.sonne ? `♪ ${Math.round(s.frequence)} Hz` : 'muet'),
});
FrWA.puce({
  ...BASE, prefixe: 'D', id: 'led-rgb', tags: ['eclairage', 'optique', 'arduino', 'basic'], nom: 'LED RGB',
  description: 'LED RGB à cathode commune (K) : trois LED rouge (Vf ≈ 2 V), verte et bleue (≈ 3 V) ; la couleur affichée mélange les courants (20 mA = plein). Résistances de limitation à prévoir sur R, G, B.',
  broches: ['R', 'K', 'G', 'B'], typesBroches: { passif: ['R', 'K', 'G', 'B'] }, cotes: { gauche: ['R', 'G', 'B'], droite: ['K'] },
  variables: [{ cle: 'rouge', nom: 'Courant rouge', unite: 'A' }, { cle: 'vert', nom: 'Courant vert', unite: 'A' }, { cle: 'bleu', nom: 'Courant bleu', unite: 'A' }],
  modele: {
    elements: [
      { t: 'D', a: 'R', b: 'K', Vf: 2.0, If: 0.02, N: 2, nom: 'dR' }, { t: 'D', a: 'G', b: 'K', Vf: 3.0, If: 0.02, N: 2, nom: 'dG' },
      { t: 'D', a: 'B', b: 'K', Vf: 3.0, If: 0.02, N: 2, nom: 'dB' },
    ],
    etat: () => ({ rouge: 0, vert: 0, bleu: 0 }),
    pas(c) { c.s.rouge = Math.max(0, c.i('dR')); c.s.vert = Math.max(0, c.i('dG')); c.s.bleu = Math.max(0, c.i('dB')); },
  },
  dessin(g, x) {
    const k = v => Math.round(255 * borne((v || 0) / 0.02, 0, 1));
    g.fillStyle = `rgb(${k(x.s.rouge)},${k(x.s.vert)},${k(x.s.bleu)})`;
    g.beginPath(); g.arc(0, 0, 11, 0, 2 * Math.PI); g.fill(); g.strokeStyle = '#9aa6a4'; g.lineWidth = 1; g.stroke();
  },
});

/* =================== Puissance =================== */
FrWA.puce({
  ...BASE, prefixe: 'K', id: 'module-relais', tags: [...T, 'relais', 'interrupteur'], nom: 'MODULE RELAIS',
  description: 'Module relais 5 V (SRD-05VDC) avec transistor, diode de roue libre et voyant : IN actif à l\'état bas (réglable). Contacts COM / NO / NC (jusqu\'à 10 A, 250 V).',
  broches: ['VCC', 'GND', 'IN', 'COM', 'NO', 'NC'], typesBroches: { alim_entree: ['VCC', 'GND'], entree: ['IN'], passif: ['COM', 'NO', 'NC'] },
  cotes: { gauche: ['VCC', 'GND', 'IN'], droite: ['NO', 'COM', 'NC'] },
  parametres: [{ cle: 'actif', nom: 'IN actif à', type: 'choix', options: ['bas', 'haut'], defaut: 'bas' }],
  variables: [{ cle: 'colle', nom: 'Relais collé', type: 'bool' }],
  modele: {
    elements: [
      { t: 'R', a: 'VCC', b: 'IN', R: 1e3, nom: 'rIn' }, { t: 'R', a: 'VCC', b: 'GND', R: 72, nom: 'bobine' },
      { t: 'S', a: 'COM', b: 'NO', nom: 'no' }, { t: 'S', a: 'COM', b: 'NC', ferme: true, nom: 'nc' },
    ],
    etat: () => ({ colle: false, t0: 0, demande: false }),
    pas(c) {
      const s = c.s, vcc = c.v('VCC') - c.v('GND'), vin = c.v('IN') - c.v('GND');
      const d = vcc > 3.5 && (c.p.actif === 'bas' ? vcc - vin > 1.5 : vin > 2);
      c.regler('rIn', c.p.actif === 'bas' ? 1e3 : 1e9);
      c.regler('bobine', d ? 72 : 1e6);
      if (d !== s.demande) { s.demande = d; s.t0 = c.t; }
      if (s.colle !== d && c.t - s.t0 >= 5e-3) s.colle = d;
      c.regler('no', s.colle); c.regler('nc', !s.colle);
    },
  },
  dessin(g, x) { g.fillStyle = x.s.colle ? '#ff3b30' : '#3a1414'; g.beginPath(); g.arc(-x.W / 2 + 12, -x.H / 2 + 12, 4, 0, 2 * Math.PI); g.fill(); },
  affichage: s => (s.colle ? 'collé' : 'repos'),
});

FrWA.puce({
  ...BASE, prefixe: 'U', id: 'l298n', tags: [...T, 'moteur'], nom: 'L298N',
  description: 'Module double pont en H L298N : IN1/IN2 commandent OUT1/OUT2 (moteur A) si ENA = 1, IN3/IN4 → OUT3/OUT4 (moteur B) si ENB = 1 (PWM sur EN pour la vitesse). Sortie haute ≈ +12V − 1,4 V, basse ≈ 0,7 V (transistors bipolaires) ; EN = 0 : sorties en l\'air.',
  broches: ['IN1', 'IN2', 'ENA', 'IN3', 'IN4', 'ENB', '+12V', 'GND', '+5V', 'OUT1', 'OUT2', 'OUT3', 'OUT4'],
  typesBroches: { entree: ['IN1', 'IN2', 'ENA', 'IN3', 'IN4', 'ENB'], alim_entree: ['+12V', 'GND'], alim_sortie: ['+5V'], trois_etats: ['OUT1', 'OUT2', 'OUT3', 'OUT4'] },
  cotes: { gauche: ['IN1', 'IN2', 'ENA', 'IN3', 'IN4', 'ENB'], droite: ['OUT1', 'OUT2', null, 'OUT3', 'OUT4'], haut: ['+12V', '+5V'], bas: ['GND'] },
  variables: [{ cle: 'etatA', nom: 'Pont A', type: 'texte' }, { cle: 'etatB', nom: 'Pont B', type: 'texte' }],
  modele: {
    elements: [
      ...[1, 2, 3, 4].map(k => ({ t: 'O', a: 'OUT' + k, ref: 'GND', V: 0, R: 1e9, nom: 'o' + k })),
      { t: 'O', a: '+5V', ref: 'GND', V: 5, R: 2, nom: 'reg' }, { t: 'R', a: '+12V', b: 'GND', R: 1e3 },
    ],
    etat: () => ({ etatA: 'libre', etatB: 'libre' }),
    pas(c) {
      const v12 = c.v('+12V') - c.v('GND'), lo = (n) => haut(c, n, 5);
      c.regler('reg', v12 > 7 ? 5 : Math.max(0, v12 - 2));
      for (const [en, a, b, oa, ob, cle] of [['ENA', 'IN1', 'IN2', 'o1', 'o2', 'etatA'], ['ENB', 'IN3', 'IN4', 'o3', 'o4', 'etatB']]) {
        if (!lo(en)) { c.regler(oa, { R: 1e9, V: 0 }); c.regler(ob, { R: 1e9, V: 0 }); c.s[cle] = 'libre'; continue; }
        const ia = lo(a), ib = lo(b), vh = Math.max(0, v12 - 1.4);
        c.regler(oa, { R: 0.5, V: ia ? vh : 0.7 }); c.regler(ob, { R: 0.5, V: ib ? vh : 0.7 });
        c.s[cle] = ia === ib ? 'frein' : ia ? 'avant' : 'arrière';
      }
    },
  },
  affichage: s => `A ${s.etatA} · B ${s.etatB}`,
});

FrWA.puce({
  ...BASE, prefixe: 'U', id: 'uln2003', tags: [...T, 'moteur', 'semi-conducteur'], nom: 'ULN2003',
  description: 'Sept darlingtons à collecteur ouvert (500 mA) avec diodes de roue libre vers COM : OUTk est tirée à la masse quand INk > ≈ 1,4 V. Commande de relais, moteur pas à pas 28BYJ-48, LED de puissance.',
  broches: ['IN1', 'IN2', 'IN3', 'IN4', 'IN5', 'IN6', 'IN7', 'GND', 'COM', 'OUT7', 'OUT6', 'OUT5', 'OUT4', 'OUT3', 'OUT2', 'OUT1'],
  typesBroches: { entree: [1, 2, 3, 4, 5, 6, 7].map(k => 'IN' + k), drain_ouvert: [1, 2, 3, 4, 5, 6, 7].map(k => 'OUT' + k), alim_entree: ['GND'], passif: ['COM'] },
  variables: [],
  modele: {
    elements: [1, 2, 3, 4, 5, 6, 7].flatMap(k => [
      { t: 'R', a: 'IN' + k, b: 'GND', R: 10e3 },
      { t: 'S', a: 'OUT' + k, b: 'GND', Ron: 2, nom: 'q' + k },
      { t: 'D', a: 'OUT' + k, b: 'COM', Vf: 0.8, If: 0.1 },
    ]),
    pas(c) { for (let k = 1; k <= 7; k++) c.regler('q' + k, c.v('IN' + k) - c.v('GND') > 1.4); },
  },
});

// 28BYJ-48 : moteur unipolaire 5 V, 4 bobines (A B C D) autour du commun rouge ; 32 pas par tour du rotor × réduction 64
// ≈ 2048 pas entiers (4096 demi-pas) par tour de sortie. Le rotor suit la direction du champ des bobines alimentées.
FrWA.puce({
  ...BASE, id: '28byj-48', tags: [...T, 'moteur'], nom: '28BYJ-48',
  description: 'Moteur pas à pas unipolaire 5 V avec réducteur 1:64 (2048 pas entiers par tour) : alimenter les bobines A, B, C, D (vers le commun +5 V) dans l\'ordre fait tourner l\'arbre. Entraîne un axe mécanique nommé (vue 3D, fin de course).',
  broches: ['COM', 'A', 'B', 'C', 'D'], typesBroches: { passif: ['COM', 'A', 'B', 'C', 'D'] }, cotes: { haut: ['COM'], gauche: ['A', 'B', 'C', 'D'] },
  parametres: [
    { cle: 'axe', nom: 'Axe entraîné (nom)', type: 'texte', defaut: 'PAP1' },
    { cle: 'vmax', nom: 'Vitesse maximale de sortie', unite: 'tr/min', defaut: 15, min: 1, max: 30 },
  ],
  mecanique: { pilote: ['$axe'] },
  variables: [{ cle: 'angle', nom: 'Angle de sortie', unite: 'rad' }, { cle: 'vitesse', nom: 'Vitesse de sortie', unite: 'rad/s' }, { cle: 'pas', nom: 'Pas parcourus', unite: '' }],
  modele: {
    elements: ['A', 'B', 'C', 'D'].map(x => ({ t: 'R', a: 'COM', b: x, R: 50, nom: 'b' + x })),
    etat: () => ({ angle: 0, vitesse: 0, pas: 0, elec: 0 }),
    pas(c) {
      const s = c.s, I = ['A', 'B', 'C', 'D'].map(x => Math.max(0, c.i('b' + x)));
      // champ : A = 0, B = π/2, C = π, D = 3π/2 (angle électrique)
      const fx = I[0] - I[2], fy = I[1] - I[3], ancien = s.angle;
      if (Math.hypot(fx, fy) > 0.02) {
        const cible = Math.atan2(fy, fx);
        let d = cible - (s.elec % (2 * Math.PI)); d = Math.atan2(Math.sin(d), Math.cos(d));
        const dmax = c.p.vmax * 2 * Math.PI / 60 * 8 * 64 * c.dt;             // électrique = sortie × 8 paires de pôles × 64
        s.elec += Math.max(-dmax, Math.min(dmax, d));
      }
      s.angle = s.elec / (8 * 64); s.pas = Math.round(s.elec / (Math.PI / 2));
      s.vitesse = (s.angle - ancien) / c.dt;
      c.monde.piloterAxe(c.p.axe, c.nom, c.k, s.angle, s.vitesse);
    },
  },
  dessin(g, x) {
    g.strokeStyle = '#9aa6a4'; g.lineWidth = 1.5; g.beginPath(); g.arc(8, 4, 16, 0, 2 * Math.PI); g.stroke();
    const a = x.s.angle || 0; g.strokeStyle = '#ffcc00'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(8, 4); g.lineTo(8 + 14 * Math.sin(a), 4 - 14 * Math.cos(a)); g.stroke();
  },
  affichage: s => (s.angle * 180 / Math.PI).toFixed(1) + '°',
});

/* =================== Afficheurs (bus) =================== */
// LCD 1602 avec adaptateur I2C PCF8574 (adresse 0x27) : P0 RS, P1 RW, P2 E, P3 rétroéclairage, P4..P7 = D4..D7 du HD44780.
FrWA.puce({
  ...BASE, prefixe: 'LCD', id: 'lcd1602-i2c', tags: [...T, 'afficheur', 'bus'], nom: 'LCD 1602 I2C',
  description: 'Afficheur LCD 2 × 16 caractères (HD44780 en mode 4 bits) derrière un PCF8574 en I2C, comme la bibliothèque LiquidCrystal_I2C : effacement, retour, position du curseur, écriture, rétroéclairage. Rappels de 10 kΩ sur SDA / SCL intégrés.',
  broches: ['GND', 'VCC', 'SDA', 'SCL'], typesBroches: { alim_entree: ['GND', 'VCC'], drain_ouvert: ['SDA'], entree: ['SCL'] },
  cotes: { gauche: ['GND', 'VCC', 'SDA', 'SCL'] }, largeur: 240, hauteur: 80,
  parametres: [{ cle: 'adresse', nom: 'Adresse 7 bits (décimal)', unite: '', defaut: 39, min: 8, max: 119, pas: 1 }],
  variables: [{ cle: 'ligne1', nom: 'Ligne 1', type: 'texte' }, { cle: 'ligne2', nom: 'Ligne 2', type: 'texte' }],
  modele: {
    elements: [{ t: 'R', a: 'VCC', b: 'SDA', R: 10e3 }, { t: 'R', a: 'VCC', b: 'SCL', R: 10e3 }, { t: 'S', a: 'SDA', b: 'GND', Ron: 30, nom: 'sda' }, { t: 'R', a: 'VCC', b: 'GND', R: 5e3 }],
    etat: () => ({ ligne1: '', ligne2: '', ddram: Array(80).fill(32), ac: 0, inc: true, aff: true, lum: true, mode4: false, demi: null, port: 0, lu: 0, cgram: false, esclave: null }),
    pas(c) {
      const s = c.s, vcc = c.v('VCC') - c.v('GND');
      if (!s.esclave) s.esclave = new FrWA.bus.EsclaveI2C({ adresse: Math.round(c.p.adresse), memoire: [0] });
      const r = s.esclave.echantillonner({ SCL: haut(c, 'SCL', vcc), SDA: haut(c, 'SDA', vcc) });
      c.regler('sda', !r.SDA);
      const j = s.esclave.journal;
      while (s.lu < j.length) {
        const v = j[s.lu++], E0 = (s.port >> 2) & 1, E1 = (v >> 2) & 1;
        s.port = v; s.lum = (v & 8) !== 0;
        if (E0 && !E1) {                                      // front descendant de E : le HD44780 lit D4..D7
          const nib = v >> 4, rs = v & 1;
          if (!s.mode4) { if (nib === 2) s.mode4 = true; continue; }   // initialisation 8 bits → 4 bits
          if (s.demi === null) { s.demi = nib; continue; }
          const octet = (s.demi << 4) | nib; s.demi = null;
          if (rs) { if (!s.cgram) { s.ddram[s.ac % 80] = octet; s.ac = (s.ac + (s.inc ? 1 : 79)) % 80; } }
          else if (octet === 1) { s.ddram.fill(32); s.ac = 0; }
          else if ((octet & 0xfe) === 2) s.ac = 0;
          else if ((octet & 0xfc) === 4) s.inc = (octet & 2) !== 0;
          else if ((octet & 0xf8) === 8) s.aff = (octet & 4) !== 0;
          else if ((octet & 0xc0) === 0x40) s.cgram = true;
          else if (octet & 0x80) { const a = octet & 0x7f; s.ac = a >= 0x40 ? 40 + (a - 0x40) % 40 : a % 40; s.cgram = false; }
        }
      }
      if (j.length > 4096) { j.splice(0, s.lu); s.lu = 0; }
      const txt = d => String.fromCharCode(...d.map(x => (x >= 32 && x < 127 ? x : 32)));
      s.ligne1 = txt(s.ddram.slice(0, 16)); s.ligne2 = txt(s.ddram.slice(40, 56));
    },
  },
  dessin(g, x) {
    const s = x.s, w = 200, h = 50, x0 = -w / 2 + 14, y0 = -h / 2;
    g.fillStyle = s.lum ? '#3d7dd8' : '#16263d'; g.fillRect(x0, y0, w, h);
    g.font = 'bold 15px ui-monospace, Consolas, monospace'; g.textBaseline = 'middle'; g.fillStyle = s.lum ? '#eaf3ff' : '#7c8da8';
    if (s.aff !== false) { g.fillText(s.ligne1 || '', x0 + 6, y0 + 15); g.fillText(s.ligne2 || '', x0 + 6, y0 + 36); }
  },
});

// OLED SSD1306 128 × 64 en I2C (0x3C) : octet de contrôle 0x00 = commandes, 0x40 = données ; adressage horizontal ou par page.
FrWA.puce({
  ...BASE, prefixe: 'OLED', id: 'oled-ssd1306', tags: [...T, 'afficheur', 'bus'], nom: 'OLED SSD1306',
  description: 'Écran OLED 128 × 64 monochrome SSD1306 en I2C (bibliothèques Adafruit_SSD1306, U8g2) : commandes et données, modes d\'adressage horizontal et par page, marche / arrêt, inversion. Rappels sur SDA / SCL intégrés.',
  broches: ['GND', 'VCC', 'SCL', 'SDA'], typesBroches: { alim_entree: ['GND', 'VCC'], entree: ['SCL'], drain_ouvert: ['SDA'] },
  cotes: { gauche: ['GND', 'VCC', 'SCL', 'SDA'] }, largeur: 200, hauteur: 120,
  parametres: [{ cle: 'adresse', nom: 'Adresse 7 bits (décimal)', unite: '', defaut: 60, min: 8, max: 119, pas: 1 }],
  variables: [{ cle: 'allume', nom: 'Écran allumé', type: 'bool' }, { cle: 'pixels', nom: 'Pixels allumés', unite: '' }],
  modele: {
    elements: [{ t: 'R', a: 'VCC', b: 'SDA', R: 10e3 }, { t: 'R', a: 'VCC', b: 'SCL', R: 10e3 }, { t: 'S', a: 'SDA', b: 'GND', Ron: 30, nom: 'sda' }, { t: 'R', a: 'VCC', b: 'GND', R: 2e3 }],
    etat: () => ({ allume: false, pixels: 0, ram: Array(1024).fill(0), col: 0, page: 0, c0: 0, c1: 127, p0: 0, p1: 7, mode: 2, inv: false,
      lu: 0, debut: true, ctrl: 0, attente: 0, cmd: null, esclave: null }),
    pas(c) {
      const s = c.s, vcc = c.v('VCC') - c.v('GND');
      if (!s.esclave) s.esclave = new FrWA.bus.EsclaveI2C({ adresse: Math.round(c.p.adresse), memoire: [0] });
      const r = s.esclave.echantillonner({ SCL: haut(c, 'SCL', vcc), SDA: haut(c, 'SDA', vcc) });
      if (r.evenement === 'START') s.debut = true;
      c.regler('sda', !r.SDA);
      const j = s.esclave.journal;
      const avancer = () => {
        if (s.mode === 0) { if (++s.col > s.c1) { s.col = s.c0; if (++s.page > s.p1) s.page = s.p0; } }
        else if (s.mode === 1) { if (++s.page > s.p1) { s.page = s.p0; if (++s.col > s.c1) s.col = s.c0; } }
        else s.col = Math.min(127, s.col + 1);
      };
      while (s.lu < j.length) {
        const v = j[s.lu++];
        if (s.debut) { s.ctrl = v; s.debut = false; continue; }          // octet de contrôle (Co, D/C)
        if (s.ctrl & 0x80) s.debut = true;                               // Co = 1 : un seul octet, puis un nouvel octet de contrôle
        if (s.ctrl & 0x40) { s.ram[(s.page & 7) * 128 + (s.col & 127)] = v; avancer(); continue; }
        if (s.attente > 0) {                                              // paramètres d'une commande
          s.cmd.push(v); s.attente--;
          if (!s.attente) {
            const [k, a, b] = s.cmd;
            if (k === 0x20) s.mode = a & 3;
            else if (k === 0x21) { s.c0 = a & 127; s.c1 = b & 127; s.col = s.c0; }
            else if (k === 0x22) { s.p0 = a & 7; s.p1 = b & 7; s.page = s.p0; }
          }
          continue;
        }
        if (v === 0xae || v === 0xaf) s.allume = v === 0xaf;
        else if (v === 0xa6 || v === 0xa7) s.inv = v === 0xa7;
        else if (v >= 0xb0 && v <= 0xb7) s.page = v & 7;
        else if (v <= 0x0f) s.col = (s.col & 0xf0) | v;
        else if (v >= 0x10 && v <= 0x1f) s.col = ((v & 0x0f) << 4) | (s.col & 0x0f);
        else if (v === 0x21 || v === 0x22) { s.cmd = [v]; s.attente = 2; }
        else if ([0x20, 0x81, 0xa8, 0xd3, 0xd5, 0xd9, 0xda, 0xdb, 0x8d].includes(v)) { s.cmd = [v]; s.attente = 1; }
      }
      if (j.length > 8192) { j.splice(0, s.lu); s.lu = 0; }
      if (c.k % 200 === 0) { let n = 0; for (let o of s.ram) for (; o; o &= o - 1) n++; s.pixels = n; }
    },
  },
  dessin(g, x) {
    const s = x.s, k = 1.25, x0 = -64 * k + 12, y0 = -32 * k;
    g.fillStyle = '#000'; g.fillRect(x0 - 3, y0 - 3, 128 * k + 6, 64 * k + 6);
    if (!s.allume || !s.ram) return;
    g.fillStyle = '#9fe8ff';
    for (let p = 0; p < 8; p++) for (let col = 0; col < 128; col++) {
      const o = s.ram[p * 128 + col]; if (!o && !s.inv) continue;
      for (let b = 0; b < 8; b++) if ((((o >> b) & 1) === 1) !== s.inv) g.fillRect(x0 + col * k, y0 + (p * 8 + b) * k, k, k);
    }
  },
});

// MAX7219 : mots de 16 bits (adresse sur 8 bits de poids fort) entrés sur DIN aux fronts montants de CLK, validés au
// front montant de CS. Registres 1..8 = lignes de la matrice, 0x0C arrêt, 0x0F test, 0x0A intensité.
FrWA.puce({
  ...BASE, prefixe: 'MAT', id: 'max7219-matrice', tags: [...T, 'afficheur', 'eclairage', 'bus'], nom: 'MATRICE MAX7219',
  description: 'Matrice de LED 8 × 8 commandée par un MAX7219 (liaison série type SPI : DIN, CLK, CS), comme la bibliothèque LedControl : lignes 1 à 8, arrêt, test, intensité. DOUT ressort les bits pour chaîner plusieurs matrices.',
  broches: ['VCC', 'GND', 'DIN', 'CS', 'CLK', 'DOUT'], typesBroches: { alim_entree: ['VCC', 'GND'], entree: ['DIN', 'CS', 'CLK'], sortie: ['DOUT'] },
  cotes: { gauche: ['VCC', 'GND', 'DIN', 'CS', 'CLK'], droite: ['DOUT'] }, largeur: 120, hauteur: 120,
  variables: [{ cle: 'actif', nom: 'Affichage actif', type: 'bool' }, { cle: 'intensite', nom: 'Intensité (0..15)', unite: '' }],
  modele: {
    elements: [{ t: 'O', a: 'DOUT', ref: 'GND', V: 0, R: 100, nom: 'dout' }, { t: 'R', a: 'VCC', b: 'GND', R: 500 }],
    etat: () => ({ actif: false, intensite: 7, test: false, lignes: Array(8).fill(0), sr: 0 }),
    pas(c) {
      const s = c.s, vcc = c.v('VCC') - c.v('GND'), clk = haut(c, 'CLK', vcc), cs = haut(c, 'CS', vcc), din = haut(c, 'DIN', vcc);
      if (clk && !s.clk) s.sr = ((s.sr << 1) | (din ? 1 : 0)) & 0xffff;
      if (cs && s.cs === false) {
        const a = (s.sr >> 8) & 15, d = s.sr & 0xff;
        if (a >= 1 && a <= 8) s.lignes[a - 1] = d; else if (a === 0x0c) s.actif = (d & 1) === 1;
        else if (a === 0x0f) s.test = (d & 1) === 1; else if (a === 0x0a) s.intensite = d & 15;
      }
      s.clk = clk; s.cs = cs;
      c.regler('dout', ((s.sr >> 15) & 1) && vcc > 3 ? vcc : 0);
    },
  },
  dessin(g, x) {
    const s = x.s, p = 11, x0 = -4 * p + 6, y0 = -4 * p;
    g.fillStyle = '#111'; g.fillRect(x0 - 3, y0 - 3, 8 * p + 6, 8 * p + 6);
    const lum = 0.35 + 0.65 * ((s.intensite ?? 7) / 15);
    for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++) {
      const on = s.test || (s.actif && ((s.lignes?.[r] >> (7 - k)) & 1) === 1);
      g.fillStyle = on ? `rgba(255,40,40,${lum})` : '#3a1010'; g.beginPath(); g.arc(x0 + k * p + p / 2, y0 + r * p + p / 2, p * 0.38, 0, 2 * Math.PI); g.fill();
    }
  },
});

/* =================== Carte Arduino Uno « passerelle » =================== */
// Chaque broche Dk / Ak est pilotée par le canal « uno_Dk » / « uno_Ak » s'il existe (0..1 = niveau logique pour D,
// tension en V pour A) ; sinon elle est en entrée (haute impédance) et sa tension est publiée sur le même nom.
// Avec clients/python/exemples/arduino_serie.py et un croquis qui envoie « uno_D13=1 », la carte réelle et la carte
// simulée ont les mêmes niveaux.
const D_UNO = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(k => 'D' + k), A_UNO = [0, 1, 2, 3, 4, 5].map(k => 'A' + k);
FrWA.puce({
  ...BASE, prefixe: 'UNO', id: 'arduino-uno-passerelle', tags: ['arduino', 'pilotage', 'alimentation', 'basic'], nom: 'ARDUINO UNO (passerelle)',
  description: 'Carte Arduino Uno vue de l\'extérieur : 5V et 3V3 alimentent le montage ; chaque broche D2..D13, A0..A5 suit le canal « uno_<broche> » s\'il est écrit (par une vraie carte reliée au port série, Python, C, une IA), sinon elle mesure et publie sa tension. Pas de programme Arduino exécuté dans le simulateur (V2).',
  broches: ['5V', '3V3', 'GND', ...A_UNO, ...D_UNO],
  typesBroches: { alim_sortie: ['5V', '3V3'], passif: ['GND'], bidir: [...A_UNO, ...D_UNO] },
  cotes: { gauche: ['5V', '3V3', 'GND', null, ...A_UNO], droite: [...D_UNO].reverse() }, largeur: 120,
  parametres: [{ cle: 'prefixe', nom: 'Préfixe des canaux', type: 'texte', defaut: 'uno_' }],
  variables: [{ cle: 'pilotees', nom: 'Broches pilotées', unite: '' }],
  modele: {
    elements: [
      { t: 'O', a: '5V', ref: 'GND', V: 5, R: 0.2 }, { t: 'O', a: '3V3', ref: 'GND', V: 3.3, R: 1 },
      ...[...A_UNO, ...D_UNO].map(b => ({ t: 'O', a: b, ref: 'GND', V: 0, R: 1e9, nom: 'o' + b })),
    ],
    etat: () => ({ pilotees: 0 }),
    pas(c) {
      let n = 0;
      for (const b of [...A_UNO, ...D_UNO]) {
        const nom = c.p.prefixe + b, x = c.monde.canal(nom, c.t, NaN);
        if (Number.isFinite(x)) { n++; c.regler('o' + b, { R: 25, V: b[0] === 'D' ? (x > 0.5 ? 5 : 0) : borne(x, 0, 5) }); }
        else { c.regler('o' + b, { R: 1e9, V: 0 }); c.monde.publier(nom, c.v(b) - c.v('GND')); }
      }
      c.s.pilotees = n;
    },
  },
  dessin(g, x) { g.fillStyle = '#0b5f73'; g.fillRect(-x.W / 2 + 26, -x.H / 2 + 10, x.W - 52, x.H - 20); g.fillStyle = '#d7e4e2'; g.font = '9px ui-sans-serif, sans-serif'; g.textAlign = 'center'; g.fillText('UNO', 0, 0); },
  affichage: s => s.pilotees + ' broche(s) pilotée(s)',
});
})();
