// Amplificateurs linéaires intégrés (ALI, ampli-op) et comparateurs.
// Deux symboles génériques — alimentation symétrique (V+ / V−) et alimentation simple (V+ / GND) — et les boîtiers
// courants. Le LM2902 (4 ALI, alimentation simple) est dans lm2902.puce.js.
// Primitive « OA » : sortie = rail bas + (rails) × (1 + tanh(A·(v+ − v−)))/2, rails réduits des chutes de tension
// de sortie ; résistance de sortie dans la puce. Pas de limite de bande passante ni de vitesse de balayage (V2).
// Les montages bistable (trigger de Schmitt, ±V) et monostable (alimentation simple) sont dans les exemples.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const PARAM_ALI = (chuteHaut, chuteBas, gain = 2e5) => [
  { cle: 'A', nom: 'Gain en boucle ouverte', unite: '', defaut: gain, min: 1e2, max: 1e7, echelle: 'log' },
  { cle: 'chuteHaut', nom: 'Écart sortie haute / V+', unite: 'V', defaut: chuteHaut, min: 0, max: 5 },
  { cle: 'chuteBas', nom: 'Écart sortie basse / rail bas', unite: 'V', defaut: chuteBas, min: 0, max: 5 },
];
const ali = (k, vp, vn) => [
  { t: 'OA', p: `IN${k}+`, n: `IN${k}-`, s: 's' + k, vp, vn, A: '$A', chuteHaut: '$chuteHaut', chuteBas: '$chuteBas' },
  { t: 'R', a: 's' + k, b: `OUT${k}`, R: 50 },
];
const etiq = nom => ({ nom, etiquette: nom.replace('-', '−') });

/* ---------- Symboles génériques ---------- */
FrWA.puce({
  id: 'ali-symetrique', tags: ['ali', 'analogique', 'basic'], nom: 'ALI ±V', prefixe: 'U', categorie: 'Amplificateurs', version: '1.0.0', regles: 1,
  description: 'Ampli-op générique à alimentation symétrique (V+ et V−, ex. ±12 V) : sortie entre V− + chute et V+ − chute. Montages : inverseur, non-inverseur, comparateur, bistable (trigger de Schmitt), oscillateur.',
  broches: ['IN1+', etiq('IN1-'), 'OUT1', 'V+', etiq('V-')],
  typesBroches: { entree: ['IN1+', 'IN1-'], sortie: ['OUT1'], alim_entree: ['V+', 'V-'] },
  cotes: { gauche: ['IN1+', null, 'IN1-'], droite: [null, 'OUT1'], haut: ['V+'], bas: ['V-'] },
  parametres: PARAM_ALI(1.5, 1.5), principal: 'A', variables: [], modele3d: null,
  modele: { elements: [...ali(1, 'V+', 'V-'), { t: 'R', a: 'V+', b: 'V-', R: 10e3 }] },
});
FrWA.puce({
  id: 'ali-simple', tags: ['ali', 'analogique', 'basic'], nom: 'ALI V+/GND', prefixe: 'U', categorie: 'Amplificateurs', version: '1.0.0', regles: 1,
  description: 'Ampli-op générique à alimentation simple (V+ et GND), sortie « rail à rail » réglable (écarts aux rails). Montages : comparateur, monostable, suiveur, amplificateur à point milieu.',
  broches: ['IN1+', etiq('IN1-'), 'OUT1', 'V+', 'GND'],
  typesBroches: { entree: ['IN1+', 'IN1-'], sortie: ['OUT1'], alim_entree: ['V+', 'GND'] },
  cotes: { gauche: ['IN1+', null, 'IN1-'], droite: [null, 'OUT1'], haut: ['V+'], bas: ['GND'] },
  parametres: PARAM_ALI(0.05, 0.05), principal: 'A', variables: [], modele3d: null,
  modele: { elements: [...ali(1, 'V+', 'GND'), { t: 'R', a: 'V+', b: 'GND', R: 10e3 }] },
});

/* ---------- Boîtiers ---------- */
function boitier(o) {
  // o : { id, nom, description, broches, nAli, vp, vn, chuteHaut, chuteBas, gain, nc, rConso }
  const ent = [], sor = [];
  for (let k = 1; k <= o.nAli; k++) { ent.push(`IN${k}+`, `IN${k}-`); sor.push('OUT' + k); }
  FrWA.puce({
    id: o.id, tags: ['ali', 'analogique', ...(o.tags || [])], nom: o.nom, prefixe: 'U', categorie: 'Amplificateurs', version: '1.0.0', regles: 1,
    description: o.description,
    broches: o.broches.map(b => (/-$/.test(b) ? etiq(b) : b)),
    typesBroches: { entree: ent, sortie: sor, alim_entree: [o.vp, o.vn], ...(o.nc ? { nc: o.nc } : {}) },
    parametres: PARAM_ALI(o.chuteHaut, o.chuteBas, o.gain), principal: 'A', variables: [], modele3d: null,
    modele: { elements: [...Array.from({ length: o.nAli }, (_, i) => ali(i + 1, o.vp, o.vn)).flat(), { t: 'R', a: o.vp, b: o.vn, R: o.rConso }] },
  });
}
boitier({ id: 'lm741', nom: 'LM741', tags: ['basic'], nAli: 1, vp: 'V+', vn: 'V-', chuteHaut: 2, chuteBas: 2, rConso: 8e3, nc: ['OFS1', 'OFS2', 'NC'],
  description: 'L\'ampli-op historique, alimentation symétrique ±5 à ±18 V, sortie à ≈ 2 V des rails. Broches 1 et 5 : réglage d\'offset (non simulé).',
  broches: ['OFS1', 'IN1-', 'IN1+', 'V-', 'OFS2', 'OUT1', 'V+', 'NC'] });
boitier({ id: 'tl071', nom: 'TL071', nAli: 1, vp: 'V+', vn: 'V-', chuteHaut: 1.5, chuteBas: 1.5, rConso: 6e3, nc: ['OFS1', 'OFS2', 'NC'],
  description: 'Ampli-op à entrées JFET (faible bruit, courant d\'entrée ≈ 0), alimentation symétrique. Brochage du LM741.',
  broches: ['OFS1', 'IN1-', 'IN1+', 'V-', 'OFS2', 'OUT1', 'V+', 'NC'] });
boitier({ id: 'tl072', nom: 'TL072', nAli: 2, vp: 'V+', vn: 'V-', chuteHaut: 1.5, chuteBas: 1.5, rConso: 4e3,
  description: 'Double ampli-op JFET, alimentation symétrique (audio, filtres actifs).',
  broches: ['OUT1', 'IN1-', 'IN1+', 'V-', 'IN2+', 'IN2-', 'OUT2', 'V+'] });
boitier({ id: 'tl074', nom: 'TL074', nAli: 4, vp: 'V+', vn: 'V-', chuteHaut: 1.5, chuteBas: 1.5, rConso: 2e3,
  description: 'Quadruple ampli-op JFET, alimentation symétrique.',
  broches: ['OUT1', 'IN1-', 'IN1+', 'V+', 'IN2+', 'IN2-', 'OUT2', 'OUT3', 'IN3-', 'IN3+', 'V-', 'IN4+', 'IN4-', 'OUT4'] });
boitier({ id: 'lm358', nom: 'LM358', tags: ['basic', 'arduino'], nAli: 2, vp: 'VCC', vn: 'GND', chuteHaut: 1.5, chuteBas: 0.02, rConso: 7e3, gain: 1e5,
  description: 'Double ampli-op à alimentation simple (3 à 32 V), entrées jusqu\'à 0 V, sortie haute ≈ VCC − 1,5 V. Le classique des montages Arduino.',
  broches: ['OUT1', 'IN1-', 'IN1+', 'GND', 'IN2+', 'IN2-', 'OUT2', 'VCC'] });
boitier({ id: 'lm324', nom: 'LM324', nAli: 4, vp: 'VCC', vn: 'GND', chuteHaut: 1.5, chuteBas: 0.02, rConso: 7e3, gain: 1e5,
  description: 'Quadruple ampli-op à alimentation simple (brochage du LM2902, plage de température réduite).',
  broches: ['OUT1', 'IN1-', 'IN1+', 'VCC', 'IN2+', 'IN2-', 'OUT2', 'OUT3', 'IN3-', 'IN3+', 'GND', 'IN4+', 'IN4-', 'OUT4'] });

/* ---------- Comparateurs à collecteur ouvert (résistance de rappel externe) ---------- */
function comparateur(id, nom, description, broches, nComp, tags = [], extra = {}) {
  const ent = [], sor = [], el = [];
  for (let k = 1; k <= nComp; k++) { ent.push(`IN${k}+`, `IN${k}-`); sor.push('OUT' + k); el.push({ t: 'S', a: 'OUT' + k, b: 'GND', ferme: false, Ron: 60, nom: 'sortie' + k }); }
  FrWA.puce({
    id, tags: ['ali', 'analogique', ...tags], nom, prefixe: 'U', categorie: 'Amplificateurs', version: '1.0.0', regles: 1, description,
    broches: broches.map(b => (/-$/.test(b) ? etiq(b) : b)),
    ...extra,
    typesBroches: { entree: ent, drain_ouvert: sor, alim_entree: ['VCC', 'GND'] }, variables: [], modele3d: null,
    modele: {
      elements: [...el, { t: 'R', a: 'VCC', b: 'GND', R: 6e3 }],
      etat: () => ({ bas: Array(nComp).fill(false) }),
      pas(c) {
        const alim = c.v('VCC') - c.v('GND') >= 2;
        for (let k = 1; k <= nComp; k++) {
          const d = c.v(`IN${k}-`) - c.v(`IN${k}+`), prec = c.s.bas[k - 1];
          c.s.bas[k - 1] = alim && (prec ? d > -1e-3 : d > 1e-3);   // ±1 mV : évite le battement au point de bascule
          c.regler('sortie' + k, c.s.bas[k - 1]);
        }
      },
    },
  });
}
comparateur('lm393', 'LM393', 'Double comparateur, alimentation simple 2 à 36 V, sorties à collecteur ouvert (sortie tirée à 0 quand IN− > IN+).',
  ['OUT1', 'IN1-', 'IN1+', 'GND', 'IN2+', 'IN2-', 'OUT2', 'VCC'], 2, ['basic', 'arduino']);
comparateur('lm339', 'LM339', 'Quadruple comparateur, alimentation simple, sorties à collecteur ouvert.',
  ['OUT2', 'OUT1', 'VCC', 'IN1-', 'IN1+', 'IN2-', 'IN2+', 'IN3-', 'IN3+', 'IN4-', 'IN4+', 'GND', 'OUT4', 'OUT3'], 4);

/* ---------- Unités séparées (comme les « unités » d'un symbole KiCad) : un seul ampli ou comparateur par symbole,
   avec ses broches d'alimentation. Même modèle que le boîtier complet ; schémas plus lisibles (étude démodulation). */
const COTES_UNITE = (vp, vn) => ({ gauche: ['IN1+', null, 'IN1-'], droite: [null, 'OUT1'], haut: [vp], bas: [vn] });
comparateur('lm339-u', 'LM339 ¼', 'Un comparateur du LM339 (unité ¼ du boîtier), sortie à collecteur ouvert : tirée à 0 quand IN− > IN+, relâchée sinon (résistance de rappel externe). VCC et GND : alimentation du boîtier.',
  ['IN1+', 'IN1-', 'OUT1', 'VCC', 'GND'], 1, ['comparateur'], { cotes: COTES_UNITE('VCC', 'GND') });
FrWA.puce({
  id: 'lm358-u', tags: ['ali', 'analogique'], nom: 'LM358 ½', prefixe: 'U', categorie: 'Amplificateurs', version: '1.0.0', regles: 1,
  description: 'Un ampli-op du LM358 (unité ½ du boîtier) : alimentation simple, entrées jusqu\'à 0 V, sortie haute ≈ VCC − 1,5 V.',
  broches: ['IN1+', etiq('IN1-'), 'OUT1', 'VCC', 'GND'],
  typesBroches: { entree: ['IN1+', 'IN1-'], sortie: ['OUT1'], alim_entree: ['VCC', 'GND'] },
  cotes: COTES_UNITE('VCC', 'GND'), parametres: PARAM_ALI(1.5, 0.02, 1e5), principal: 'A', variables: [], modele3d: null,
  modele: { elements: [...ali(1, 'VCC', 'GND'), { t: 'R', a: 'VCC', b: 'GND', R: 14e3 }] },
});
})();
