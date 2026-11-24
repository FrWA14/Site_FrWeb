// Amplificateurs par usage : ALI réalistes (produit gain-bande, vitesse de balayage), audio, haute fréquence,
// comparateurs rapides, seuils et trigger de Schmitt, instrumentation, mesure de courant, échantillonneur-bloqueur,
// et le haut-parleur qui renvoie le son au programme (exemple « audio-micro-hp », clients/python/exemples/micro_filtre_hp.py).
//
// Modèle d'ALI réaliste (« noyau ») : les ALI de ali.puce.js sont idéaux (gain fixe, réponse instantanée) ; ceux-ci
// reproduisent la réponse en fréquence et la vitesse de balayage d'un ALI à compensation interne :
//   étage d'entrée  x = sat(vd / Vlin) × demi-alimentation autour du point milieu, Vlin = SR / (2π·GBW)
//   transconductance i = 1 mA × x / demi-alimentation (donc ±1 mA au plus) vers l'intégrateur m (C = 1 mA / SR, R = A0 / (gain d'entrée × 1 mS)), d'où
//   gain continu A0, gain unité à GBW, pente maximale SR ; diodes de bridage de m aux rails ;
//   tampon de sortie  y = m, limité aux rails moins les chutes, puis résistance de sortie.
// Le condensateur interne est intégré en Euler implicite : le pôle à GBW reste stable même avec un pas de 62 µs.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const etiq = nom => ({ nom, etiquette: nom.replace('-', '−') });
const dbVersGain = db => Math.pow(10, db / 20);
const gainEntree = p => 2 * Math.PI * p.GBW / p.SR;                  // GBW en MHz, SR en V/µs : rapport sans unité
const GM = 1e-3;                                                     // transconductance interne (S)

const PARAM_REEL = (o) => [
  { cle: 'GBW', nom: 'Produit gain × bande', unite: 'MHz', defaut: o.GBW, min: 0.001, max: 10000, echelle: 'log' },
  { cle: 'SR', nom: 'Vitesse de balayage (V/µs)', unite: '', defaut: o.SR, min: 0.001, max: 10000, echelle: 'log' },
  { cle: 'A0', nom: 'Gain en boucle ouverte', unite: 'dB', defaut: o.A0, min: 20, max: 160 },
  { cle: 'chuteHaut', nom: 'Écart sortie haute / V+', unite: 'V', defaut: o.chuteHaut, min: 0, max: 5 },
  { cle: 'chuteBas', nom: 'Écart sortie basse / V−', unite: 'V', defaut: o.chuteBas, min: 0, max: 5 },
  { cle: 'rSortie', nom: 'Résistance de sortie', unite: 'Ω', defaut: o.rSortie ?? 50, min: 0.01, max: 1e4, echelle: 'log' },
];
/** éléments communs : point milieu et consommation. Le point milieu est une source commandée ((V+ + V−) / 2) et non un
    diviseur de 1 MΩ : quand le nœud intégrateur bute sur un rail (entrée hors de la plage de sortie, au démarrage d'un
    suiveur de Vref par exemple), le courant de l'étage d'entrée repasse par le point milieu ; un diviseur le tirait
    vers 0 V et l'ALI restait bloqué en saturation (corrigé le 2026-11-24, étude demod6k, bloc A). */
const commun = (vp, vn, rConso) => [
  { t: 'E', a: 'mid', b: vn, pa: vp, pb: vn, gain: 0.5 },
  { t: 'R', a: vp, b: vn, R: rConso },
];
/** l'étage d'entrée sature aux rails eux-mêmes : son gain et la transconductance suivent la demi-alimentation (mesurée
    à chaque pas), d'où un courant de sortie de ±1 mA au plus quelle que soit l'alimentation */
const modeleReel = (vp, vn, elements) => ({
  elements,
  etat: () => ({ demi: 12 }),
  pas(c) { c.s.demi = Math.max(0.5, (c.v(vp) - c.v(vn)) / 2); },
});
/** un ALI réaliste entre inP, inN → out */
const noyau = (k, inP, inN, out, vp, vn) => [
  { t: 'OA', p: inP, n: inN, s: 'x' + k, vp, vn, A: (p, s) => gainEntree(p) * s.demi, chuteHaut: 0, chuteBas: 0 },
  { t: 'G', a: 'mid', b: 'm' + k, pa: 'x' + k, pb: 'mid', gm: (p, s) => GM / s.demi },
  { t: 'R', a: 'm' + k, b: 'mid', R: p => dbVersGain(p.A0) / (gainEntree(p) * GM) },
  { t: 'C', a: 'm' + k, b: 'mid', C: p => GM / (p.SR * 1e6), euler: true },
  { t: 'D', a: 'm' + k, b: vp }, { t: 'D', a: vn, b: 'm' + k },
  { t: 'OA', p: 'm' + k, n: 'y' + k, s: 'y' + k, vp, vn, A: 1e4, chuteHaut: '$chuteHaut', chuteBas: '$chuteBas' },
  { t: 'R', a: 'y' + k, b: out, R: '$rSortie' },
];

/* ---------- ALI réalistes : symboles génériques et boîtiers ---------- */
function aliReel(o) {
  // o : { id, nom, tags, description, broches, nAli, vp, vn, GBW, SR, A0, chuteHaut, chuteBas, rSortie, rConso, nc, autres, cotes }
  const ent = [], sor = [], el = [...commun(o.vp, o.vn, o.rConso)];
  for (let k = 1; k <= o.nAli; k++) {
    ent.push(`IN${k}+`, `IN${k}-`); sor.push('OUT' + k);
    el.push(...noyau(k, `IN${k}+`, `IN${k}-`, 'OUT' + k, o.vp, o.vn));
  }
  FrWA.puce({
    id: o.id, tags: ['ali', 'analogique', ...(o.tags || [])], nom: o.nom, prefixe: 'U', categorie: o.categorie || 'Amplificateurs',
    version: '1.0.0', regles: 1, description: o.description,
    broches: o.broches.map(b => (/-$/.test(b) ? etiq(b) : b)),
    typesBroches: { entree: [...ent, ...(o.entrees || [])], sortie: sor, alim_entree: [o.vp, o.vn], ...(o.nc ? { nc: o.nc } : {}) },
    ...(o.cotes ? { cotes: o.cotes } : {}),
    parametres: PARAM_REEL(o), principal: 'GBW', variables: [], modele3d: null,
    modele: modeleReel(o.vp, o.vn, [...el, ...(o.autres || [])]),
  });
}
const SIMPLE8 = ['NC1', 'IN1-', 'IN1+', 'V-', 'NC2', 'OUT1', 'V+', 'NC3'];             // brochage standard d'un ALI simple
const DOUBLE8 = ['OUT1', 'IN1-', 'IN1+', 'V-', 'IN2+', 'IN2-', 'OUT2', 'V+'];          // brochage standard d'un ALI double
const COTES_ALI = { gauche: ['IN1+', null, 'IN1-'], droite: [null, 'OUT1'], haut: ['V+'], bas: ['V-'] };

aliReel({ id: 'ali-reel', nom: 'ALI RÉEL ±V', tags: ['basic'], nAli: 1, vp: 'V+', vn: 'V-', GBW: 1, SR: 0.5, A0: 106, chuteHaut: 1.5, chuteBas: 1.5, rConso: 6e3,
  broches: ['IN1+', 'IN1-', 'OUT1', 'V+', 'V-'], cotes: COTES_ALI,
  description: 'ALI générique RÉALISTE à alimentation symétrique : gain limité par le produit gain × bande (GBW), pente limitée par la vitesse de balayage (SR), gain continu A0, sortie saturée aux rails. Réglez GBW et SR pour retrouver n\'importe quel ALI de fiche technique. (Les ALI idéaux sont « ALI ±V » et « ALI V+/GND ».)' });
aliReel({ id: 'ne5532', nom: 'NE5532', tags: ['audio', 'son'], nAli: 2, vp: 'V+', vn: 'V-', GBW: 10, SR: 9, A0: 100, chuteHaut: 2, chuteBas: 2, rSortie: 30, rConso: 2e3,
  broches: DOUBLE8, categorie: 'Amplificateurs audio',
  description: 'Double ALI audio à faible bruit (préamplis, filtres actifs, consoles) : GBW 10 MHz, 9 V/µs, ±5 à ±18 V, sort 600 Ω. Le classique de l\'audio professionnel.' });
aliReel({ id: 'opa2134', nom: 'OPA2134', tags: ['audio', 'son'], nAli: 2, vp: 'V+', vn: 'V-', GBW: 8, SR: 20, A0: 120, chuteHaut: 1.5, chuteBas: 1.5, rSortie: 30, rConso: 3e3,
  broches: DOUBLE8, categorie: 'Amplificateurs audio',
  description: 'Double ALI audio haut de gamme à entrées FET (distorsion très faible) : GBW 8 MHz, 20 V/µs, ±2,5 à ±18 V.' });
aliReel({ id: 'ad8055', nom: 'AD8055', tags: ['haute-frequence'], nAli: 1, vp: 'V+', vn: 'V-', GBW: 300, SR: 1400, A0: 72, chuteHaut: 1.5, chuteBas: 1.5, rSortie: 5, rConso: 1e3, nc: ['NC1', 'NC2', 'NC3'],
  broches: SIMPLE8, categorie: 'Amplificateurs haute fréquence',
  description: 'ALI vidéo / haute fréquence à contre-réaction de tension : 300 MHz de produit gain × bande, 1400 V/µs, ±5 V. Pas de simulation ≤ 1 ns pour voir sa rapidité.' });
aliReel({ id: 'lm7171', nom: 'LM7171', tags: ['haute-frequence'], nAli: 1, vp: 'V+', vn: 'V-', GBW: 200, SR: 4100, A0: 80, chuteHaut: 1.7, chuteBas: 1.7, rSortie: 5, rConso: 2e3, nc: ['NC1', 'NC2', 'NC3'],
  broches: SIMPLE8, categorie: 'Amplificateurs haute fréquence',
  description: 'ALI très rapide ±5 à ±15 V : 200 MHz, 4100 V/µs, 100 mA de sortie (lignes, vidéo, pilotage de CAN rapides).' });
aliReel({ id: 'opa355', nom: 'OPA355', tags: ['haute-frequence'], nAli: 1, vp: 'V+', vn: 'V-', GBW: 200, SR: 300, A0: 94, chuteHaut: 0.1, chuteBas: 0.1, rSortie: 10, rConso: 500, nc: ['NC1', 'NC2'],
  broches: ['NC1', 'IN1-', 'IN1+', 'V-', 'NC2', 'OUT1', 'V+', 'EN'], entrees: ['EN'],
  autres: [{ t: 'R', a: 'EN', b: 'V+', R: 1e6 }],
  categorie: 'Amplificateurs haute fréquence',
  description: 'ALI CMOS rapide à alimentation simple 2,5 à 5,5 V, sortie rail à rail : 200 MHz, 300 V/µs. EN (rappel interne au V+) : activation, non simulée (toujours actif).' });
aliReel({ id: 'tda2030', nom: 'TDA2030', tags: ['audio', 'son'], nAli: 1, vp: 'V+', vn: 'V-', GBW: 3, SR: 8, A0: 80, chuteHaut: 2, chuteBas: 2, rSortie: 0.05, rConso: 300,
  broches: ['IN1+', 'IN1-', 'V-', 'OUT1', 'V+'], cotes: COTES_ALI, categorie: 'Amplificateurs audio',
  description: 'Ampli de puissance audio 14 W en boîtier Pentawatt, utilisé comme un ALI de puissance (non-inverseur, gain réglé par deux résistances) : ±6 à ±18 V, 3,5 A crête, haut-parleur 4 à 8 Ω en sortie directe. Valeurs dynamiques typiques approchées.' });
aliReel({ id: 'tda2050', nom: 'TDA2050', tags: ['audio', 'son'], nAli: 1, vp: 'V+', vn: 'V-', GBW: 3, SR: 8, A0: 80, chuteHaut: 2.5, chuteBas: 2.5, rSortie: 0.03, rConso: 200,
  broches: ['IN1+', 'IN1-', 'V-', 'OUT1', 'V+'], cotes: COTES_ALI, categorie: 'Amplificateurs audio',
  description: 'Ampli de puissance audio 32 W (brochage du TDA2030), ±4,5 à ±25 V, 5 A crête.' });

/* MC33079 : quadruple ALI bipolaire faible bruit (16 MHz, 7 V/µs), choisi pour les filtres à Q élevé à 6 kHz (gain en
   boucle ouverte ≫ 2Q²). Boîtier complet et unité ¼ (un seul ALI, schémas plus lisibles). */
aliReel({ id: 'mc33079', nom: 'MC33079', tags: ['audio'], nAli: 4, vp: 'VCC', vn: 'VEE', GBW: 16, SR: 7, A0: 110, chuteHaut: 1, chuteBas: 1, rSortie: 30, rConso: 1.1e3,
  broches: ['OUT1', 'IN1-', 'IN1+', 'VCC', 'IN2+', 'IN2-', 'OUT2', 'OUT3', 'IN3-', 'IN3+', 'VEE', 'IN4+', 'IN4-', 'OUT4'],
  description: 'Quadruple ALI bipolaire à faible bruit : GBW 16 MHz, 7 V/µs, A0 ≈ 110 dB, alimentation 5 à 36 V (ou ±2,5 à ±18 V). Filtres actifs à Q élevé jusqu\'à quelques dizaines de kHz. Alimentation simple : VEE à la masse.' });
aliReel({ id: 'mc33079-u', nom: 'MC33079 ¼', tags: ['audio'], nAli: 1, vp: 'VCC', vn: 'VEE', GBW: 16, SR: 7, A0: 110, chuteHaut: 1, chuteBas: 1, rSortie: 30, rConso: 4.4e3,
  broches: ['IN1+', 'IN1-', 'OUT1', 'VCC', 'VEE'], cotes: { gauche: ['IN1+', null, 'IN1-'], droite: [null, 'OUT1'], haut: ['VCC'], bas: ['VEE'] },
  description: 'Un ALI du MC33079 (unité ¼ du boîtier) : GBW 16 MHz, 7 V/µs, A0 ≈ 110 dB. VCC / VEE : alimentation du boîtier (VEE à la masse en alimentation simple).' });

/* ---------- LM386 : ampli audio basse tension, gain 20 à 200 ---------- */
// Équivalent interne : la tension différentielle traverse 150 Ω + 1,35 kΩ (entre GAIN1 et GAIN8) ; la sortie vaut
// VS/2 + 2·15 kΩ × courant / … soit 20 (broches 1-8 en l'air) à 200 (condensateur de 10 µF entre 1 et 8).
FrWA.puce({
  id: 'lm386', tags: ['audio', 'son', 'basic', 'arduino', 'analogique'], nom: 'LM386', prefixe: 'U', categorie: 'Amplificateurs audio', version: '1.0.0', regles: 1,
  description: 'Ampli audio de puissance basse tension (4 à 12 V, ≈ 0,5 W sur 8 Ω). Gain 20 sans rien entre GAIN1 et GAIN8, 200 avec 10 µF entre elles, entre les deux avec une résistance en série. Sortie au point milieu VS/2 : condensateur de liaison (≈ 220 µF) vers le haut-parleur. BYPASS : condensateur de découplage vers la masse.',
  broches: ['GAIN1', etiq('IN-'), 'IN+', 'GND', 'VOUT', 'VS', 'BYPASS', 'GAIN8'],
  typesBroches: { entree: ['IN-', 'IN+'], sortie: ['VOUT'], passif: ['GAIN1', 'GAIN8', 'BYPASS'], alim_entree: ['VS', 'GND'] },
  parametres: [{ cle: 'bande', nom: 'Bande passante', unite: 'Hz', defaut: 300e3, min: 1e3, max: 1e7, echelle: 'log' }],
  principal: 'bande', variables: [], modele3d: null,
  modele: {
    elements: [
      { t: 'R', a: 'IN+', b: 'GND', R: 50e3 }, { t: 'R', a: 'IN-', b: 'GND', R: 50e3 },
      { t: 'E', a: 'ea', b: 'GAIN1', pa: 'IN+', pb: 'IN-', gain: 1 },
      { t: 'R', a: 'ea', b: 'GAIN8', R: 150 }, { t: 'R', a: 'GAIN8', b: 'GAIN1', R: 1350 }, { t: 'R', a: 'GAIN1', b: 'GND', R: 1e6 },
      { t: 'R', a: 'VS', b: 'BYPASS', R: 50e3 }, { t: 'R', a: 'BYPASS', b: 'GND', R: 50e3 },
      { t: 'E', a: 'u', b: 'BYPASS', pa: 'ea', pb: 'GAIN8', gain: 200 },
      { t: 'R', a: 'u', b: 'u2', R: 1e3 }, { t: 'C', a: 'u2', b: 'BYPASS', C: p => 1 / (2 * Math.PI * 1e3 * p.bande), euler: true },
      { t: 'OA', p: 'u2', n: 'y', s: 'y', vp: 'VS', vn: 'GND', A: 1e4, chuteHaut: 1, chuteBas: 0.6 },
      { t: 'R', a: 'y', b: 'VOUT', R: 0.2 },
      { t: 'R', a: 'VS', b: 'GND', R: 1.5e3 },
    ],
  },
});

/* ---------- Comparateurs (sortie logique, temps de propagation) ---------- */
// Un comparateur n'est pas un ALI : sortie tout ou rien, pas de contre-réaction ; le temps de propagation est simulé
// (la sortie change « tpd » après l'entrée, si tpd > pas de simulation).
const PARAM_TPD = defaut => ({ cle: 'tpd', nom: 'Temps de propagation', unite: 's', defaut, min: 0, max: 1e-3, echelle: 'lin' });
function suivre(c, cle, voulu, tpd) {
  const s = c.s;
  if (voulu !== s['v' + cle]) { s['v' + cle] = voulu; s['t' + cle] = c.t; }
  if (s[cle] !== voulu && c.t - s['t' + cle] >= tpd - 1e-15) s[cle] = voulu;
  return s[cle];
}
FrWA.puce({
  id: 'lm311', tags: ['comparateur', 'analogique', 'basic'], nom: 'LM311', prefixe: 'U', categorie: 'Comparateurs', version: '1.0.0', regles: 1,
  description: 'Comparateur à sortie collecteur ouvert ET émetteur sorti (GND, broche 1, à relier au niveau bas voulu, souvent la masse) : OUT tirée vers GND quand IN+ < IN−. Alimentation ±15 V ou 5 V ; rappel externe sur OUT. Temps de réponse ≈ 200 ns. Réglage d\'offset et strobe (5, 6) non simulés.',
  broches: ['GND', 'IN+', etiq('IN-'), etiq('V-'), 'BAL', { nom: 'STRB', etiquette: 'BAL/STB' }, 'OUT', 'V+'],
  typesBroches: { entree: ['IN+', 'IN-'], drain_ouvert: ['OUT'], passif: ['GND', 'BAL', 'STRB'], alim_entree: ['V+', 'V-'] },
  parametres: [PARAM_TPD(200e-9)], principal: 'tpd', variables: [{ cle: 'bas', nom: 'Sortie tirée', type: 'bool' }], modele3d: null,
  modele: {
    elements: [{ t: 'S', a: 'OUT', b: 'GND', ferme: false, Ron: 20, nom: 'sortie' }, { t: 'R', a: 'BAL', b: 'STRB', R: 1e6 }, { t: 'R', a: 'BAL', b: 'V-', R: 1e6 }, { t: 'R', a: 'V+', b: 'V-', R: 3e3 }],
    etat: () => ({ bas: false }),
    pas(c) {
      const d = c.v('IN-') - c.v('IN+'), alim = c.v('V+') - c.v('V-') >= 3.5;
      const voulu = alim && (c.s.bas ? d > -1e-3 : d > 1e-3);
      c.regler('sortie', suivre(c, 'bas', voulu, c.p.tpd));
    },
  },
});
FrWA.puce({
  id: 'lm2903', tags: ['comparateur', 'analogique'], nom: 'LM2903', prefixe: 'U', categorie: 'Comparateurs', version: '1.0.0', regles: 1,
  description: 'Double comparateur à collecteur ouvert (brochage du LM393, plage de température automobile −40 à 125 °C), alimentation simple 2 à 36 V. Temps de réponse ≈ 300 ns.',
  broches: ['OUT1', etiq('IN1-'), 'IN1+', 'GND', 'IN2+', etiq('IN2-'), 'OUT2', 'VCC'],
  typesBroches: { entree: ['IN1+', 'IN1-', 'IN2+', 'IN2-'], drain_ouvert: ['OUT1', 'OUT2'], alim_entree: ['VCC', 'GND'] },
  parametres: [PARAM_TPD(300e-9)], principal: 'tpd', variables: [], modele3d: null,
  modele: {
    elements: [{ t: 'S', a: 'OUT1', b: 'GND', ferme: false, Ron: 60, nom: 's1' }, { t: 'S', a: 'OUT2', b: 'GND', ferme: false, Ron: 60, nom: 's2' }, { t: 'R', a: 'VCC', b: 'GND', R: 6e3 }],
    etat: () => ({ b1: false, b2: false }),
    pas(c) {
      const alim = c.v('VCC') - c.v('GND') >= 2;
      for (const k of [1, 2]) {
        const d = c.v(`IN${k}-`) - c.v(`IN${k}+`), voulu = alim && (c.s['b' + k] ? d > -1e-3 : d > 1e-3);
        c.regler('s' + k, suivre(c, 'b' + k, voulu, c.p.tpd));
      }
    },
  },
});
FrWA.puce({
  id: 'lt1016', tags: ['comparateur', 'haute-frequence', 'analogique'], nom: 'LT1016', prefixe: 'U', categorie: 'Comparateurs', version: '1.0.0', regles: 1,
  description: 'Comparateur ultra-rapide (10 ns) à sorties complémentaires Q et /Q compatibles TTL (≈ 3,4 V / 0,3 V), alimentation 5 V ou ±5 V. LATCH à 1 : les sorties restent figées (verrou).',
  broches: ['V+', 'IN+', etiq('IN-'), etiq('V-'), 'LATCH', 'GND', 'Q', { nom: 'nQ', etiquette: '/Q' }],
  typesBroches: { entree: ['IN+', 'IN-', 'LATCH'], sortie: ['Q', 'nQ'], alim_entree: ['V+', 'V-', 'GND'] },
  parametres: [PARAM_TPD(10e-9)], principal: 'tpd', variables: [{ cle: 'q', nom: 'Sortie Q', type: 'bool' }], modele3d: null,
  modele: {
    elements: [{ t: 'O', a: 'Q', ref: 'GND', V: 0, R: 30, nom: 'q' }, { t: 'O', a: 'nQ', ref: 'GND', V: 0, R: 30, nom: 'nq' }, { t: 'R', a: 'LATCH', b: 'GND', R: 1e6 }, { t: 'R', a: 'V+', b: 'GND', R: 200 }, { t: 'R', a: 'GND', b: 'V-', R: 1e3 }],
    etat: () => ({ q: false }),
    pas(c) {
      const s = c.s, vcc = c.v('V+') - c.v('GND'), d = c.v('IN+') - c.v('IN-');
      if (c.v('LATCH') - c.v('GND') < 1.4) suivre(c, 'q', vcc >= 3 && (s.q ? d > -1e-3 : d > 1e-3), c.p.tpd);
      const h = Math.max(0, vcc - 1.6), b = Math.min(0.3, vcc);
      c.regler('q', s.q ? h : b); c.regler('nq', s.q ? b : h);
    },
  },
});

/* ---------- Seuils réglables : trigger de Schmitt et comparateur à fenêtre ---------- */
FrWA.puce({
  id: 'schmitt-reglable', tags: ['comparateur', 'analogique', 'basic'], nom: 'SCHMITT', prefixe: 'U', categorie: 'Seuils et trigger de Schmitt', version: '1.0.0', regles: 1,
  description: 'Détecteur de seuil à hystérésis (trigger de Schmitt) aux seuils réglés directement : OUT passe à VCC quand IN dépasse le seuil haut, revient à 0 sous le seuil bas. Égaux : simple détecteur de seuil. Inverser : sortie inversée. Pour le montage à ALI équivalent, voir l\'exemple « ali-bistable ».',
  broches: ['IN', 'OUT', 'VCC', 'GND'], typesBroches: { entree: ['IN'], sortie: ['OUT'], alim_entree: ['VCC', 'GND'] },
  cotes: { gauche: [null, 'IN'], droite: [null, 'OUT'], haut: ['VCC'], bas: ['GND'] },
  parametres: [
    { cle: 'seuilHaut', nom: 'Seuil haut', unite: 'V', defaut: 3, min: -100, max: 100, pas: 0.01 },
    { cle: 'seuilBas', nom: 'Seuil bas', unite: 'V', defaut: 2, min: -100, max: 100, pas: 0.01 },
    { cle: 'inverser', nom: 'Sortie inversée', type: 'bool', defaut: false },
    PARAM_TPD(0),
  ],
  principal: 'seuilHaut', variables: [{ cle: 'etat', nom: 'Au-dessus du seuil', type: 'bool' }], modele3d: null,
  modele: {
    elements: [{ t: 'O', a: 'OUT', ref: 'GND', V: 0, R: 25, nom: 'sortie' }, { t: 'R', a: 'IN', b: 'GND', R: 1e9 }, { t: 'R', a: 'VCC', b: 'GND', R: 50e3 }],
    etat: () => ({ etat: false }),
    pas(c) {
      const p = c.p, v = c.v('IN') - c.v('GND'), hi = Math.max(p.seuilHaut, p.seuilBas), lo = Math.min(p.seuilHaut, p.seuilBas);
      const e = suivre(c, 'etat', c.s.etat ? v > lo : v > hi, p.tpd);
      c.regler('sortie', (e !== p.inverser) ? c.v('VCC') - c.v('GND') : 0);
    },
  },
  affichage: (s, p) => `${p.seuilBas} / ${p.seuilHaut} V`,
});
FrWA.puce({
  id: 'comparateur-fenetre', tags: ['comparateur', 'analogique'], nom: 'FENÊTRE', prefixe: 'U', categorie: 'Seuils et trigger de Schmitt', version: '1.0.0', regles: 1,
  description: 'Comparateur à fenêtre (deux comparateurs et une porte, comme 2 × LM393 en ET câblé) : OUT = VCC quand bas < IN < haut, 0 en dehors. Hystérésis réglable sur les deux seuils. Ex. : surveillance d\'une tension de batterie.',
  broches: ['IN', 'OUT', 'VCC', 'GND'], typesBroches: { entree: ['IN'], sortie: ['OUT'], alim_entree: ['VCC', 'GND'] },
  cotes: { gauche: [null, 'IN'], droite: [null, 'OUT'], haut: ['VCC'], bas: ['GND'] },
  parametres: [
    { cle: 'bas', nom: 'Seuil bas', unite: 'V', defaut: 1, min: -100, max: 100, pas: 0.01 },
    { cle: 'haut', nom: 'Seuil haut', unite: 'V', defaut: 4, min: -100, max: 100, pas: 0.01 },
    { cle: 'hyst', nom: 'Hystérésis', unite: 'V', defaut: 0.05, min: 0, max: 10, pas: 0.01 },
  ],
  principal: 'haut', variables: [{ cle: 'dedans', nom: 'Dans la fenêtre', type: 'bool' }], modele3d: null,
  modele: {
    elements: [{ t: 'O', a: 'OUT', ref: 'GND', V: 0, R: 25, nom: 'sortie' }, { t: 'R', a: 'IN', b: 'GND', R: 1e9 }, { t: 'R', a: 'VCC', b: 'GND', R: 50e3 }],
    etat: () => ({ dedans: false }),
    pas(c) {
      const p = c.p, s = c.s, v = c.v('IN') - c.v('GND'), h = s.dedans ? p.hyst / 2 : -p.hyst / 2;
      s.dedans = v > p.bas - h && v < p.haut + h;
      c.regler('sortie', s.dedans ? c.v('VCC') - c.v('GND') : 0);
    },
  },
  affichage: (s, p) => `${p.bas} … ${p.haut} V`,
});

/* ---------- Instrumentation : trois ALI internes, gain 1 + Rint / RG ---------- */
function instrumentation(id, nom, rInt, description) {
  const ideal = (p, n, s) => ({ t: 'OA', p, n, s, vp: 'V+', vn: 'V-', A: 1e5, chuteHaut: 1.2, chuteBas: 1.2 });
  FrWA.puce({
    id, tags: ['mesure', 'analogique', 'capteur'], nom, prefixe: 'U', categorie: 'Amplificateurs d\'instrumentation', version: '1.0.0', regles: 1,
    description,
    broches: ['RG1', etiq('IN-'), 'IN+', etiq('V-'), 'REF', 'OUT', 'V+', 'RG8'],
    typesBroches: { entree: ['IN-', 'IN+', 'REF'], sortie: ['OUT'], passif: ['RG1', 'RG8'], alim_entree: ['V+', 'V-'] },
    variables: [], modele3d: null,
    modele: {
      elements: [
        ideal('IN-', 'RG1', 'a1'), { t: 'R', a: 'a1', b: 'RG1', R: rInt },
        ideal('IN+', 'RG8', 'a2'), { t: 'R', a: 'a2', b: 'RG8', R: rInt },
        { t: 'R', a: 'a1', b: 'n3', R: 10e3 }, { t: 'R', a: 'n3', b: 's3', R: 10e3 },
        { t: 'R', a: 'a2', b: 'p3', R: 10e3 }, { t: 'R', a: 'p3', b: 'REF', R: 10e3 },
        ideal('p3', 'n3', 's3'), { t: 'R', a: 's3', b: 'OUT', R: 1 },
        { t: 'R', a: 'V+', b: 'V-', R: 15e3 },
      ],
    },
  });
}
instrumentation('ad620', 'AD620', 24.7e3, 'Ampli d\'instrumentation (trois ALI) : OUT = REF + G·(IN+ − IN−), G = 1 + 49,4 kΩ / RG (résistance entre RG1 et RG8 ; sans RG : G = 1). Pont de jauges, thermocouple, ECG. ±2,3 à ±18 V.');
instrumentation('ina128', 'INA128', 25e3, 'Ampli d\'instrumentation de précision : G = 1 + 50 kΩ / RG (entre RG1 et RG8), OUT = REF + G·(IN+ − IN−). ±2,25 à ±18 V.');

/* ---------- Mesure de courant sur shunt : INA180 (gain fixe, famille de variantes) ---------- */
for (const [suffixe, gain] of [['a1', 20], ['a2', 50], ['a3', 100], ['a4', 200]]) {
  FrWA.puce({
    id: 'ina180-' + suffixe, tags: ['mesure', 'analogique', 'capteur'], nom: 'INA180' + suffixe.toUpperCase(), prefixe: 'U',
    categorie: 'Mesure de courant', version: '1.0.0', regles: 1,
    famille: { id: 'ina180', nom: 'Gain', valeur: gain + ' V/V' },
    description: `Ampli de mesure de courant sur shunt, gain fixe ${gain} V/V : OUT = ${gain} × (IN+ − IN−), entre 0 et VS. Le shunt (ex. 0,1 Ω) est placé entre IN+ et IN−, côté alimentation ou côté masse. Gain 20 / 50 / 100 / 200 : ⚙ Réglages.`,
    broches: ['OUT', 'GND', 'IN+', etiq('IN-'), 'VS'],
    typesBroches: { entree: ['IN+', 'IN-'], sortie: ['OUT'], alim_entree: ['VS', 'GND'] },
    cotes: { gauche: ['IN+', null, 'IN-'], droite: [null, 'OUT'], haut: ['VS'], bas: ['GND'] },
    variables: [], modele3d: null,
    modele: {
      elements: [
        { t: 'R', a: 'IN+', b: 'IN-', R: 1e6 }, { t: 'R', a: 'IN-', b: 'GND', R: 165e3 },
        { t: 'E', a: 'e', b: 'GND', pa: 'IN+', pb: 'IN-', gain },
        { t: 'OA', p: 'e', n: 'y', s: 'y', vp: 'VS', vn: 'GND', A: 1e4, chuteHaut: 0.02, chuteBas: 0.003 },
        { t: 'R', a: 'y', b: 'OUT', R: 10 }, { t: 'R', a: 'VS', b: 'GND', R: 20e3 },
      ],
    },
  });
}

/* ---------- Échantillonneur-bloqueur LF398 ---------- */
FrWA.puce({
  id: 'lf398', tags: ['analogique', 'mesure'], nom: 'LF398', prefixe: 'U', categorie: 'Autres amplificateurs', version: '1.0.0', regles: 1,
  description: 'Échantillonneur-bloqueur : LOGIC − LREF > 1,4 V → OUT suit IN (le condensateur externe CH, ≈ 1 nF à 1 µF vers la masse, se charge) ; sinon OUT garde la dernière valeur. Sert avant un CAN lent, ou pour figer une crête. Réglage d\'offset (2) non simulé ; IN et OUT supposés entre les rails.',
  broches: ['V+', 'OFS', 'IN', etiq('V-'), 'OUT', 'CH', 'LREF', 'LOGIC'],
  typesBroches: { entree: ['IN', 'LOGIC', 'LREF'], sortie: ['OUT'], passif: ['OFS', 'CH'], alim_entree: ['V+', 'V-'] },
  variables: [{ cle: 'suivi', nom: 'En suivi', type: 'bool' }], modele3d: null,
  modele: {
    elements: [
      { t: 'E', a: 'b', b: 'V-', pa: 'IN', pb: 'V-', gain: 1 },
      { t: 'S', a: 'b', b: 'CH', ferme: true, Ron: 300, Roff: 1e13, nom: 'ech' },
      { t: 'E', a: 'o', b: 'V-', pa: 'CH', pb: 'V-', gain: 1 }, { t: 'R', a: 'o', b: 'OUT', R: 1 },
      { t: 'R', a: 'OFS', b: 'V+', R: 1e6 }, { t: 'R', a: 'LOGIC', b: 'LREF', R: 1e7 }, { t: 'R', a: 'V+', b: 'V-', R: 3e3 },
    ],
    etat: () => ({ suivi: true }),
    pas(c) { c.s.suivi = c.v('LOGIC') - c.v('LREF') > 1.4; c.regler('ech', c.s.suivi); },
  },
});

/* ---------- Haut-parleur : charge 8 Ω qui renvoie le son au programme (canal) ---------- */
FrWA.puce({
  id: 'haut-parleur', tags: ['audio', 'son', 'basic', 'pilotage'], nom: 'HAUT-PARLEUR', prefixe: 'HP', categorie: 'Amplificateurs audio', version: '1.0.0', regles: 1,
  description: 'Haut-parleur (charge résistive). Publie sa tension divisée par la pleine échelle sur un canal de sortie (« hp » par défaut) : clients/python/exemples/micro_filtre_hp.py le joue sur la carte son du PC. Puissance moyenne et crête affichées.',
  broches: ['+', etiq('-')], typesBroches: { passif: ['+', '-'] }, cotes: { gauche: ['+', null, '-'] },
  parametres: [
    { cle: 'Z', nom: 'Impédance', unite: 'Ω', defaut: 8, min: 1, max: 1e4, echelle: 'log' },
    { cle: 'canal', nom: 'Canal de sortie', type: 'texte', defaut: 'hp' },
    { cle: 'pleineEchelle', nom: 'Tension de pleine échelle', unite: 'V', defaut: 4, min: 0.01, max: 1000, echelle: 'log' },
  ],
  principal: 'Z',
  variables: [{ cle: 'tension', nom: 'Tension', unite: 'V' }, { cle: 'puissance', nom: 'Puissance moyenne', unite: 'W' }],
  modele3d: null,
  modele: {
    elements: [{ t: 'R', a: '+', b: '-', R: '$Z' }],
    etat: () => ({ tension: 0, puissance: 0 }),
    pas(c) {
      const s = c.s, v = c.v('+') - c.v('-');
      s.tension = v; s.puissance += (v * v / c.p.Z - s.puissance) * Math.min(1, c.dt / 0.2);   // moyenne glissante sur 0,2 s
      c.monde.publier(c.p.canal, v / c.p.pleineEchelle);
    },
  },
  dessin(g, x) {
    g.strokeStyle = '#9aa6a4'; g.lineWidth = 1.5; g.beginPath();
    g.moveTo(-6, -10); g.lineTo(4, -10); g.lineTo(16, -22); g.lineTo(16, 22); g.lineTo(4, 10); g.lineTo(-6, 10); g.closePath(); g.stroke();
    const a = Math.min(1, Math.abs(x.s.tension || 0) / (x.p.pleineEchelle || 4));
    g.strokeStyle = `rgba(255, 204, 0, ${0.25 + 0.75 * a})`; for (const r of [8, 14]) { g.beginPath(); g.arc(20, 0, r, -0.7, 0.7); g.stroke(); }
  },
  affichage: s => (s.puissance * 1e3).toFixed(1) + ' mW',
});
})();
