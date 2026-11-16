// Série 7400 (version CMOS 74HC ; mêmes brochages en 74LS / 74HCT / 74AC) : portes, bascules, compteurs, registres,
// décodeurs, multiplexeurs, tampons, comparateurs, additionneurs, monostables. Brochages DIP des fiches TI / NXP.
// Description par tables : chaque puce = brochage (ordre des numéros 1..n) + fonction évaluée à chaque pas.
// Notation des broches : '~CLR' = entrée / sortie active à l'état bas (nom nCLR, étiquette /CLR) ; 'NC' = non connectée.
// Seuils : ceux du moteur logique (40 % / 60 % de VCC avec hystérésis), sortie 50 Ω, fonctionnement dès 2 V.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

/* ---------- Outils de description ---------- */
function brochage(liste) {
  let k = 0;
  return liste.map(b => {
    if (typeof b !== 'string') return b;
    if (b === 'NC') return { nom: 'NC' + (++k), etiquette: 'NC' };
    if (b.startsWith('~')) return { nom: 'n' + b.slice(1), etiquette: '/' + b.slice(1) };
    return b;
  });
}
const nomDe = b => (typeof b === 'string' ? b : b.nom);
const n = b => b.replace(/^~/, 'n');        // nom interne d'une broche notée '~X'
const bits = (v, k) => Array.from({ length: k }, (_, i) => ((v >> i) & 1) === 1);
const valeur = (e, noms) => noms.reduce((a, b, i) => a | (e[b] ? 1 << i : 0), 0);

/** o : { id, nom, description, broches, sorties, types: { trois_etats, drain_ouvert, bidir }, evaluer, etat, tags, modele, affichage } */
function puce74(o) {
  const br = brochage(o.broches), noms = br.map(nomDe);
  const nc = noms.filter(x => /^NC\d+$/.test(x));
  const sorties = o.sorties.map(n);
  const sp = Object.fromEntries(Object.entries(o.types || {}).map(([t, l]) => [t, l.map(n)]));
  const passifs = o.passifs || [];
  const pris = new Set(['VCC', 'GND', ...nc, ...Object.values(sp).flat(), ...passifs]);
  const entrees = noms.filter(x => !pris.has(x) && !sorties.includes(x));
  const typesBroches = { alim_entree: ['VCC', 'GND'], entree: entrees, sortie: sorties.filter(x => !pris.has(x)), ...sp };
  if (nc.length) typesBroches.nc = nc;
  if (passifs.length) typesBroches.passif = passifs;
  FrWA.puce({
    id: o.id, tags: ['serie7400', 'logique', ...(o.tags || [])],
    nom: o.nom, prefixe: 'U', categorie: 'Logique 7400', version: '1.0.0', regles: 1,
    description: o.description + ' Brochage identique en 74LS / 74HCT.',
    broches: br, typesBroches, variables: o.variables || [], modele3d: null,
    ...(o.modele ? { modele: o.modele } : {}),
    logique: {
      vdd: 'VCC', vss: 'GND', entrees: [...entrees, ...(sp.bidir || [])], sorties,
      rSortie: 50, vMin: 2, etat: o.etat || (() => ({})), evaluer: o.evaluer,
    },
    ...(o.affichage ? { affichage: o.affichage } : {}),
  });
}

/* ---------- Portes ---------- */
const ET = l => l.every(Boolean), OU = l => l.some(Boolean), OUX = l => l.filter(Boolean).length % 2 === 1;
const FONCTIONS = {
  NAND: l => !ET(l), AND: ET, NOR: l => !OU(l), OR: OU, XOR: OUX, XNOR: l => !OUX(l), NOT: l => !l[0], BUF: l => l[0],
};
const MOTIF_QUAD = ['1A', '1B', '1Y', '2A', '2B', '2Y', 'GND', '3Y', '3A', '3B', '4Y', '4A', '4B', 'VCC'];
const MOTIF_NOR = ['1Y', '1A', '1B', '2Y', '2A', '2B', 'GND', '3A', '3B', '3Y', '4A', '4B', '4Y', 'VCC'];
const MOTIF_HEX = ['1A', '1Y', '2A', '2Y', '3A', '3Y', 'GND', '4Y', '4A', '5Y', '5A', '6Y', '6A', 'VCC'];
const MOTIF_TRI = ['1A', '1B', '2A', '2B', '2C', '2Y', 'GND', '3Y', '3A', '3B', '3C', '1Y', '1C', 'VCC'];
const MOTIF_DUO = ['1A', '1B', 'NC', '1C', '1D', '1Y', 'GND', '2Y', '2A', '2B', 'NC', '2C', '2D', 'VCC'];
function portes(id, nom, f, motif, entreesParPorte, description, opts = {}) {
  const portesL = [...new Set(motif.filter(b => /^\d[A-H]$/.test(b)).map(b => b[0]))];
  const lettres = 'ABCDEFGH'.slice(0, entreesParPorte).split('');
  const oc = opts.drainOuvert;
  puce74({
    id, nom, description, broches: motif, tags: ['basic'].filter(() => opts.basic),
    sorties: portesL.map(k => k + 'Y'), types: oc ? { drain_ouvert: portesL.map(k => k + 'Y') } : undefined,
    evaluer: e => Object.fromEntries(portesL.map(k => { const v = FONCTIONS[f](lettres.map(L => e[k + L])); return [k + 'Y', oc ? (v ? null : false) : v]; })),
  });
}
portes('74hc00', '74HC00', 'NAND', MOTIF_QUAD, 2, 'Quatre portes NON-ET (NAND) à 2 entrées.', { basic: true });
portes('74hc03', '74HC03', 'NAND', MOTIF_QUAD, 2, 'Quatre NON-ET à 2 entrées, sorties à drain ouvert (résistance de rappel externe).', { drainOuvert: true });
portes('74hc08', '74HC08', 'AND', MOTIF_QUAD, 2, 'Quatre portes ET (AND) à 2 entrées.', { basic: true });
portes('74hc32', '74HC32', 'OR', MOTIF_QUAD, 2, 'Quatre portes OU (OR) à 2 entrées.', { basic: true });
portes('74hc86', '74HC86', 'XOR', MOTIF_QUAD, 2, 'Quatre portes OU exclusif (XOR) à 2 entrées.', { basic: true });
portes('74hc7266', '74HC7266', 'XNOR', MOTIF_QUAD, 2, 'Quatre portes NON-OU exclusif (XNOR) à 2 entrées.');
portes('74hc132', '74HC132', 'NAND', MOTIF_QUAD, 2, 'Quatre NON-ET à 2 entrées à trigger de Schmitt (oscillateur RC, mise en forme).');
portes('74hc02', '74HC02', 'NOR', MOTIF_NOR, 2, 'Quatre portes NON-OU (NOR) à 2 entrées (brochage différent du 7400 : sortie en premier).', { basic: true });
portes('74hc04', '74HC04', 'NOT', MOTIF_HEX, 1, 'Six inverseurs.', { basic: true });
portes('74hc14', '74HC14', 'NOT', MOTIF_HEX, 1, 'Six inverseurs à trigger de Schmitt (anti-rebond, oscillateur RC).', { basic: true });
portes('74hc05', '74HC05', 'NOT', MOTIF_HEX, 1, 'Six inverseurs à drain ouvert.', { drainOuvert: true });
portes('74ls06', '74LS06', 'NOT', MOTIF_HEX, 1, 'Six inverseurs à collecteur ouvert haute tension (30 V) : commande de relais, LED.', { drainOuvert: true });
portes('74ls07', '74LS07', 'BUF', MOTIF_HEX, 1, 'Six tampons à collecteur ouvert haute tension (30 V) : adaptation de niveaux.', { drainOuvert: true });
portes('74hc10', '74HC10', 'NAND', MOTIF_TRI, 3, 'Trois portes NON-ET à 3 entrées.');
portes('74hc11', '74HC11', 'AND', MOTIF_TRI, 3, 'Trois portes ET à 3 entrées.');
portes('74hc27', '74HC27', 'NOR', MOTIF_TRI, 3, 'Trois portes NON-OU à 3 entrées.');
portes('74hc20', '74HC20', 'NAND', MOTIF_DUO, 4, 'Deux portes NON-ET à 4 entrées.');
portes('74hc21', '74HC21', 'AND', MOTIF_DUO, 4, 'Deux portes ET à 4 entrées.');
puce74({
  id: '74hc30', nom: '74HC30', description: 'Une porte NON-ET à 8 entrées.',
  broches: ['A', 'B', 'C', 'D', 'E', 'F', 'GND', 'Y', 'NC', 'NC', 'G', 'H', 'NC', 'VCC'], sorties: ['Y'],
  evaluer: e => ({ Y: !'ABCDEFGH'.split('').every(L => e[L]) }),
});

/* ---------- Tampons trois états ---------- */
const MOTIF_125 = ['~1OE', '1A', '1Y', '~2OE', '2A', '2Y', 'GND', '3Y', '3A', '~3OE', '4Y', '4A', '~4OE', 'VCC'];
for (const [id, actifBas] of [['74hc125', true], ['74hc126', false]]) {
  puce74({
    id, nom: id.toUpperCase(), description: `Quatre tampons trois états, validation ${actifBas ? 'active à l\'état bas (/OE)' : 'active à l\'état haut (OE)'}.`,
    broches: actifBas ? MOTIF_125 : MOTIF_125.map(b => b.replace('~', '')), sorties: ['1Y', '2Y', '3Y', '4Y'], types: { trois_etats: ['1Y', '2Y', '3Y', '4Y'] },
    evaluer: e => Object.fromEntries([1, 2, 3, 4].map(k => [k + 'Y', (actifBas ? !e[`n${k}OE`] : e[`${k}OE`]) ? e[k + 'A'] : null])),
  });
}
const MOTIF_244 = ['~1OE', '1A1', '2Y4', '1A2', '2Y3', '1A3', '2Y2', '1A4', '2Y1', 'GND', '2A1', '1Y4', '2A2', '1Y3', '2A3', '1Y2', '2A4', '1Y1', '~2OE', 'VCC'];
for (const [id, inv] of [['74hc244', false], ['74hc240', true]]) {
  const Y = [1, 2].flatMap(g => [1, 2, 3, 4].map(k => `${g}Y${k}`));
  puce74({
    id, nom: id.toUpperCase(), description: `Huit tampons trois états${inv ? ' inverseurs' : ''} en deux groupes de 4 (/1OE, /2OE).`,
    broches: MOTIF_244, sorties: Y, types: { trois_etats: Y },
    evaluer: e => Object.fromEntries(Y.map(y => [y, e[`n${y[0]}OE`] ? null : inv ? !e[`${y[0]}A${y[2]}`] : e[`${y[0]}A${y[2]}`]])),
  });
}
const A8 = [1, 2, 3, 4, 5, 6, 7, 8];
puce74({
  id: '74hc541', nom: '74HC541', description: 'Huit tampons trois états (entrées d\'un côté, sorties de l\'autre), deux validations /OE1 et /OE2.',
  broches: ['~OE1', ...A8.map(k => 'A' + k), 'GND', ...A8.map(k => 'Y' + (9 - k)), '~OE2', 'VCC'], sorties: A8.map(k => 'Y' + k), types: { trois_etats: A8.map(k => 'Y' + k) },
  evaluer: e => Object.fromEntries(A8.map(k => ['Y' + k, e.nOE1 || e.nOE2 ? null : e['A' + k]])),
});
puce74({
  id: '74hc245', nom: '74HC245', description: 'Émetteur-récepteur de bus 8 bits bidirectionnel : DIR = 1 → A vers B, DIR = 0 → B vers A ; /OE = 1 : isolé.',
  broches: ['DIR', ...A8.map(k => 'A' + k), 'GND', ...A8.map(k => 'B' + (9 - k)), '~OE', 'VCC'],
  sorties: [...A8.map(k => 'A' + k), ...A8.map(k => 'B' + k)], types: { bidir: [...A8.map(k => 'A' + k), ...A8.map(k => 'B' + k)] },
  evaluer: e => Object.fromEntries(A8.flatMap(k => [['B' + k, !e.nOE && e.DIR ? e['A' + k] : null], ['A' + k, !e.nOE && !e.DIR ? e['B' + k] : null]])),
});

/* ---------- Verrous et bascules ---------- */
function octal(id, nom, motif, horloge, description) {
  const Q = [0, 1, 2, 3, 4, 5, 6, 7].map(k => motif.find(b => /^Q/.test(b) && Number(b.slice(1)) === k + (motif.includes('Q0') ? 0 : 1)));
  const D = Q.map(q => 'D' + q.slice(1));
  puce74({
    id, nom, description, broches: motif, sorties: Q, types: { trois_etats: Q },
    etat: () => ({ v: 0 }),
    evaluer(e, s) {
      if (horloge === 'CLK' ? e.monte.CLK : e.LE) s.v = valeur(e, D);
      return Object.fromEntries(Q.map((q, i) => [q, e.nOE ? null : ((s.v >> i) & 1) === 1]));
    },
    affichage: s => '0x' + s.v.toString(16).toUpperCase().padStart(2, '0'),
  });
}
const M573 = c => ['~OE', ...A8.map(k => 'D' + k), 'GND', c, ...A8.map(k => 'Q' + (9 - k)), 'VCC'];
octal('74hc573', '74HC573', M573('LE'), 'LE', 'Huit verrous transparents (LE = 1 : Q suit D ; LE = 0 : mémorisé), sorties trois états.');
octal('74hc574', '74HC574', M573('CLK'), 'CLK', 'Huit bascules D sur front montant, sorties trois états.');
const M373 = c => ['~OE', 'Q0', 'D0', 'D1', 'Q1', 'Q2', 'D2', 'D3', 'Q3', 'GND', c, 'Q4', 'D4', 'D5', 'Q5', 'Q6', 'D6', 'D7', 'Q7', 'VCC'];
octal('74hc373', '74HC373', M373('LE'), 'LE', 'Huit verrous transparents, sorties trois états (brochage entrelacé).');
octal('74hc374', '74HC374', M373('CLK'), 'CLK', 'Huit bascules D sur front montant, sorties trois états (brochage entrelacé).');

puce74({
  id: '74hc74', nom: '74HC74', tags: ['basic'], description: 'Deux bascules D sur front montant avec mise à 1 (/PR) et remise à 0 (/CLR) asynchrones.',
  broches: ['~1CLR', '1D', '1CLK', '~1PR', '1Q', '~1Q', 'GND', '~2Q', '2Q', '~2PR', '2CLK', '2D', '~2CLR', 'VCC'], sorties: ['1Q', '~1Q', '2Q', '~2Q'],
  etat: () => ({ q1: false, q2: false }),
  evaluer(e, s) {
    const o = {};
    for (const k of [1, 2]) {
      const pr = !e[`n${k}PR`], clr = !e[`n${k}CLR`];
      if (pr && clr) { o[k + 'Q'] = true; o[`n${k}Q`] = true; continue; }
      if (clr) s['q' + k] = false; else if (pr) s['q' + k] = true; else if (e.monte[k + 'CLK']) s['q' + k] = e[k + 'D'];
      o[k + 'Q'] = s['q' + k]; o[`n${k}Q`] = !s['q' + k];
    }
    return o;
  },
  affichage: s => `Q1=${+s.q1} Q2=${+s.q2}`,
});
function jk(id, nom, motif, description, front, kInverse) {
  puce74({
    id, nom, description, broches: motif, sorties: ['1Q', '~1Q', '2Q', '~2Q'],
    etat: () => ({ q1: false, q2: false }),
    evaluer(e, s) {
      const o = {};
      for (const k of [1, 2]) {
        const pr = !e[`n${k}PR`], clr = !e[`n${k}CLR`], q = 'q' + k;
        const horloge = front === 'descend' ? e.descend[`n${k}CLK`] : e.monte[k + 'CLK'];
        const J = e[k + 'J'], K = kInverse ? !e[`n${k}K`] : e[k + 'K'];
        if (pr && clr) { o[k + 'Q'] = true; o[`n${k}Q`] = true; continue; }
        if (clr) s[q] = false; else if (pr) s[q] = true;
        else if (horloge) s[q] = J && K ? !s[q] : J ? true : K ? false : s[q];
        o[k + 'Q'] = s[q]; o[`n${k}Q`] = !s[q];
      }
      return o;
    },
    affichage: s => `Q1=${+s.q1} Q2=${+s.q2}`,
  });
}
jk('74hc112', '74HC112', ['~1CLK', '1K', '1J', '~1PR', '1Q', '~1Q', '~2Q', 'GND', '2Q', '~2PR', '2J', '2K', '~2CLK', '~2CLR', '~1CLR', 'VCC'],
  'Deux bascules JK sur front descendant, /PR et /CLR asynchrones (J = K = 1 : bascule).', 'descend', false);
jk('74hc109', '74HC109', ['~1CLR', '1J', '~1K', '1CLK', '~1PR', '1Q', '~1Q', 'GND', '~2Q', '2Q', '~2PR', '2CLK', '~2K', '2J', '~2CLR', 'VCC'],
  'Deux bascules J-/K sur front montant (J = 1, /K = 0 : bascule), /PR et /CLR asynchrones.', 'monte', true);
puce74({
  id: '74hc175', nom: '74HC175', description: 'Quatre bascules D à horloge commune, sorties Q et /Q, remise à 0 /CLR.',
  broches: ['~CLR', '1Q', '~1Q', '1D', '2D', '~2Q', '2Q', 'GND', 'CLK', '3Q', '~3Q', '3D', '4D', '~4Q', '4Q', 'VCC'],
  sorties: [1, 2, 3, 4].flatMap(k => [k + 'Q', `~${k}Q`]), etat: () => ({ v: 0 }),
  evaluer(e, s) {
    if (!e.nCLR) s.v = 0; else if (e.monte.CLK) s.v = valeur(e, ['1D', '2D', '3D', '4D']);
    return Object.fromEntries([1, 2, 3, 4].flatMap(k => { const q = ((s.v >> (k - 1)) & 1) === 1; return [[k + 'Q', q], [`n${k}Q`, !q]]; }));
  },
});
puce74({
  id: '74hc174', nom: '74HC174', description: 'Six bascules D à horloge commune, remise à 0 /CLR.',
  broches: ['~CLR', '1Q', '1D', '2D', '2Q', '3D', '3Q', 'GND', 'CLK', '4Q', '4D', '5Q', '5D', '6D', '6Q', 'VCC'],
  sorties: [1, 2, 3, 4, 5, 6].map(k => k + 'Q'), etat: () => ({ v: 0 }),
  evaluer(e, s) {
    if (!e.nCLR) s.v = 0; else if (e.monte.CLK) s.v = valeur(e, [1, 2, 3, 4, 5, 6].map(k => k + 'D'));
    return Object.fromEntries([1, 2, 3, 4, 5, 6].map((k, i) => [k + 'Q', ((s.v >> i) & 1) === 1]));
  },
});

/* ---------- Compteurs ---------- */
const QABCD = ['QA', 'QB', 'QC', 'QD'];
const sortiesCompte = (v, noms = QABCD) => Object.fromEntries(noms.map((q, i) => [q, ((v >> i) & 1) === 1]));
for (const [id, mod, synchrone] of [['74hc160', 10, false], ['74hc161', 16, false], ['74hc162', 10, true], ['74hc163', 16, true]]) {
  puce74({
    id, nom: id.toUpperCase(), tags: id === '74hc161' ? ['basic'] : [],
    description: `Compteur ${mod === 10 ? 'décimal' : 'binaire 4 bits'} synchrone préchargeable (/LOAD), remise à 0 ${synchrone ? 'synchrone' : 'asynchrone'} (/CLR), validations ENP / ENT, retenue RCO pour la mise en cascade.`,
    broches: ['~CLR', 'CLK', 'A', 'B', 'C', 'D', 'ENP', 'GND', '~LOAD', 'ENT', 'QD', 'QC', 'QB', 'QA', 'RCO', 'VCC'], sorties: [...QABCD, 'RCO'],
    etat: () => ({ v: 0 }),
    evaluer(e, s) {
      if (!synchrone && !e.nCLR) s.v = 0;
      else if (e.monte.CLK) {
        if (synchrone && !e.nCLR) s.v = 0;
        else if (!e.nLOAD) s.v = valeur(e, ['A', 'B', 'C', 'D']);
        else if (e.ENP && e.ENT) s.v = (s.v + 1) % mod;
      }
      return { ...sortiesCompte(s.v), RCO: e.ENT && s.v === mod - 1 };
    },
    affichage: s => String(s.v),
  });
}
for (const [id, mod] of [['74hc192', 10], ['74hc193', 16]]) {
  puce74({
    id, nom: id.toUpperCase(),
    description: `Compteur / décompteur ${mod === 10 ? 'décimal' : 'binaire 4 bits'} à deux horloges (UP, DOWN : front montant, l'autre au repos à 1), préchargement /LOAD, remise à 0 CLR, retenues /CO et /BO.`,
    broches: ['B', 'QB', 'QA', 'DOWN', 'UP', 'QC', 'QD', 'GND', 'D', 'C', '~LOAD', '~CO', '~BO', 'CLR', 'A', 'VCC'], sorties: [...QABCD, '~CO', '~BO'],
    etat: () => ({ v: 0 }),
    evaluer(e, s) {
      if (e.CLR) s.v = 0;
      else if (!e.nLOAD) s.v = valeur(e, ['A', 'B', 'C', 'D']) % 16;
      else if (e.monte.UP && e.DOWN) s.v = (s.v + 1) % mod;
      else if (e.monte.DOWN && e.UP) s.v = (s.v + mod - 1) % mod;
      return { ...sortiesCompte(s.v), nCO: !(s.v === mod - 1 && !e.UP), nBO: !(s.v === 0 && !e.DOWN) };
    },
    affichage: s => String(s.v),
  });
}
puce74({
  id: '74ls90', nom: '74LS90', tags: ['basic'],
  description: 'Compteur décimal asynchrone : bascule ÷2 (/CKA → QA) et compteur ÷5 (/CKB → QB QC QD), sur front descendant. Relier QA à /CKB pour compter de 0 à 9. R0(1)·R0(2) = 1 : zéro ; R9(1)·R9(2) = 1 : neuf. Alimentation broche 5, masse broche 10.',
  broches: ['~CKB', 'R01', 'R02', 'NC', 'VCC', 'R91', 'R92', 'QC', 'QB', 'GND', 'QD', 'QA', 'NC', '~CKA'], sorties: QABCD,
  etat: () => ({ a: 0, b: 0 }),
  evaluer(e, s) {
    if (e.R91 && e.R92) { s.a = 1; s.b = 4; }
    else if (e.R01 && e.R02) { s.a = 0; s.b = 0; }
    else { if (e.descend.nCKA) s.a ^= 1; if (e.descend.nCKB) s.b = (s.b + 1) % 5; }
    return { QA: s.a === 1, ...sortiesCompte(s.b, ['QB', 'QC', 'QD']) };
  },
  affichage: s => String(s.a + 2 * s.b),
});
puce74({
  id: '74ls93', nom: '74LS93', description: 'Compteur binaire 4 bits asynchrone : ÷2 (/CKA → QA) et ÷8 (/CKB → QB QC QD), front descendant ; relier QA à /CKB pour ÷16. R0(1)·R0(2) = 1 : zéro. Alimentation broche 5, masse broche 10.',
  broches: ['~CKB', 'R01', 'R02', 'NC', 'VCC', 'NC', 'NC', 'QC', 'QB', 'GND', 'QD', 'QA', 'NC', '~CKA'], sorties: QABCD,
  etat: () => ({ a: 0, b: 0 }),
  evaluer(e, s) {
    if (e.R01 && e.R02) { s.a = 0; s.b = 0; } else { if (e.descend.nCKA) s.a ^= 1; if (e.descend.nCKB) s.b = (s.b + 1) % 8; }
    return { QA: s.a === 1, ...sortiesCompte(s.b, ['QB', 'QC', 'QD']) };
  },
});
puce74({
  id: '74hc390', nom: '74HC390', description: 'Deux compteurs décimaux asynchrones (÷2 et ÷5 dans chacun, front descendant), remises à 0 1CLR et 2CLR actives à 1.',
  broches: ['~1CKA', '1CLR', '1QA', '~1CKB', '1QB', '1QC', '1QD', 'GND', '2QD', '2QC', '2QB', '~2CKB', '2QA', '2CLR', '~2CKA', 'VCC'],
  sorties: [1, 2].flatMap(k => QABCD.map(q => k + q)), etat: () => ({ a1: 0, b1: 0, a2: 0, b2: 0 }),
  evaluer(e, s) {
    const o = {};
    for (const k of [1, 2]) {
      if (e[k + 'CLR']) { s['a' + k] = 0; s['b' + k] = 0; }
      else { if (e.descend[`n${k}CKA`]) s['a' + k] ^= 1; if (e.descend[`n${k}CKB`]) s['b' + k] = (s['b' + k] + 1) % 5; }
      o[k + 'QA'] = s['a' + k] === 1; Object.assign(o, sortiesCompte(s['b' + k], ['QB', 'QC', 'QD'].map(q => k + q)));
    }
    return o;
  },
});
puce74({
  id: '74hc393', nom: '74HC393', description: 'Deux compteurs binaires 4 bits asynchrones (front descendant), remises à 0 1CLR et 2CLR actives à 1.',
  broches: ['~1CLK', '1CLR', '1QA', '1QB', '1QC', '1QD', 'GND', '2QD', '2QC', '2QB', '2QA', '2CLR', '~2CLK', 'VCC'],
  sorties: [1, 2].flatMap(k => QABCD.map(q => k + q)), etat: () => ({ v1: 0, v2: 0 }),
  evaluer(e, s) {
    for (const k of [1, 2]) { if (e[k + 'CLR']) s['v' + k] = 0; else if (e.descend[`n${k}CLK`]) s['v' + k] = (s['v' + k] + 1) % 16; }
    return { ...sortiesCompte(s.v1, QABCD.map(q => '1' + q)), ...sortiesCompte(s.v2, QABCD.map(q => '2' + q)) };
  },
  affichage: s => `${s.v1} / ${s.v2}`,
});

/* ---------- Registres à décalage ---------- */
const QAH = ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'];
puce74({
  id: '74hc164', nom: '74HC164', description: 'Registre à décalage 8 bits entrée série (A ET B) / sorties parallèles, front montant, remise à 0 /CLR.',
  broches: ['A', 'B', 'QA', 'QB', 'QC', 'QD', 'GND', 'CLK', '~CLR', 'QE', 'QF', 'QG', 'QH', 'VCC'], sorties: QAH, etat: () => ({ v: 0 }),
  evaluer(e, s) { if (!e.nCLR) s.v = 0; else if (e.monte.CLK) s.v = ((s.v << 1) | (e.A && e.B ? 1 : 0)) & 0xff; return sortiesCompte(s.v, QAH); },
  affichage: s => s.v.toString(2).padStart(8, '0'),
});
puce74({
  id: '74hc165', nom: '74HC165', tags: ['arduino'],
  description: 'Registre à décalage 8 bits entrées parallèles / sortie série : SH/LD = 0 charge A..H, puis chaque front montant de CLK (CLK INH = 0) décale vers QH ; SER entre en A. Lecture de boutons par Arduino.',
  broches: [{ nom: 'SHLD', etiquette: 'SH/LD' }, 'CLK', 'E', 'F', 'G', 'H', '~QH', 'GND', 'QH', 'SER', 'A', 'B', 'C', 'D', { nom: 'INH', etiquette: 'CLK INH' }, 'VCC'],
  sorties: ['QH', '~QH'], etat: () => ({ v: 0 }),
  evaluer(e, s) {
    if (!e.SHLD) s.v = valeur(e, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    else if (e.monte.CLK && !e.INH) s.v = ((s.v << 1) | (e.SER ? 1 : 0)) & 0xff;
    const qh = ((s.v >> 7) & 1) === 1; return { QH: qh, nQH: !qh };
  },
});
puce74({
  id: '74hc595', nom: '74HC595', tags: ['arduino', 'basic'],
  description: 'Registre à décalage 8 bits + registre de sortie : SER entre à chaque front de SRCLK (QA en premier), RCLK recopie vers QA..QH (trois états, /OE), QH\' sort le bit décalé (mise en cascade). Le classique des montages Arduino.',
  broches: ['QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH', 'GND', { nom: 'QHS', etiquette: 'QH\'' }, '~SRCLR', 'SRCLK', 'RCLK', '~OE', 'SER', 'QA', 'VCC'],
  sorties: [...QAH, 'QHS'], types: { trois_etats: QAH }, etat: () => ({ sr: 0, v: 0 }),
  evaluer(e, s) {
    if (e.monte.RCLK) s.v = s.sr;
    if (!e.nSRCLR) s.sr = 0; else if (e.monte.SRCLK) s.sr = ((s.sr << 1) | (e.SER ? 1 : 0)) & 0xff;
    const o = Object.fromEntries(QAH.map((q, i) => [q, e.nOE ? null : ((s.v >> i) & 1) === 1]));
    o.QHS = ((s.sr >> 7) & 1) === 1; return o;
  },
  affichage: s => s.v.toString(2).padStart(8, '0').split('').reverse().join(''),
});
puce74({
  id: '74hc194', nom: '74HC194', description: 'Registre à décalage universel 4 bits : S1 S0 = 00 maintien, 01 décalage à droite (SR → QA), 10 à gauche (SL → QD), 11 chargement A..D ; front montant, /CLR.',
  broches: ['~CLR', 'SR', 'A', 'B', 'C', 'D', 'SL', 'GND', 'S0', 'S1', 'CLK', 'QD', 'QC', 'QB', 'QA', 'VCC'], sorties: QABCD, etat: () => ({ v: 0 }),
  evaluer(e, s) {
    if (!e.nCLR) s.v = 0;
    else if (e.monte.CLK) {
      const m = (e.S1 ? 2 : 0) + (e.S0 ? 1 : 0);
      if (m === 1) s.v = ((s.v << 1) | (e.SR ? 1 : 0)) & 15;
      else if (m === 2) s.v = (s.v >> 1) | (e.SL ? 8 : 0);
      else if (m === 3) s.v = valeur(e, ['A', 'B', 'C', 'D']);
    }
    return sortiesCompte(s.v);
  },
});

/* ---------- Décodeurs, codeurs, multiplexeurs ---------- */
puce74({
  id: '74hc138', nom: '74HC138', tags: ['basic'], description: 'Décodeur 3 vers 8, sorties actives à 0 ; validé si G1 = 1, /G2A = /G2B = 0.',
  broches: ['A', 'B', 'C', '~G2A', '~G2B', 'G1', '~Y7', 'GND', '~Y6', '~Y5', '~Y4', '~Y3', '~Y2', '~Y1', '~Y0', 'VCC'],
  sorties: [0, 1, 2, 3, 4, 5, 6, 7].map(k => '~Y' + k),
  evaluer: e => { const ok = e.G1 && !e.nG2A && !e.nG2B, v = valeur(e, ['A', 'B', 'C']); return Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map(k => ['nY' + k, !(ok && v === k)])); },
});
puce74({
  id: '74hc139', nom: '74HC139', description: 'Deux décodeurs 2 vers 4, sorties actives à 0, validations /1G et /2G.',
  broches: ['~1G', '1A', '1B', '~1Y0', '~1Y1', '~1Y2', '~1Y3', 'GND', '~2Y3', '~2Y2', '~2Y1', '~2Y0', '2B', '2A', '~2G', 'VCC'],
  sorties: [1, 2].flatMap(g => [0, 1, 2, 3].map(k => `~${g}Y${k}`)),
  evaluer: e => Object.fromEntries([1, 2].flatMap(g => { const v = valeur(e, [g + 'A', g + 'B']); return [0, 1, 2, 3].map(k => [`n${g}Y${k}`, !(!e[`n${g}G`] && v === k)]); })),
});
puce74({
  id: '74hc42', nom: '74HC42', description: 'Décodeur BCD vers décimal : une des 10 sorties /0../9 passe à 0 (aucune pour 10 à 15).',
  broches: ['~0', '~1', '~2', '~3', '~4', '~5', '~6', 'GND', '~7', '~8', '~9', 'D', 'C', 'B', 'A', 'VCC'],
  sorties: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => '~' + k),
  evaluer: e => { const v = valeur(e, ['A', 'B', 'C', 'D']); return Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => ['n' + k, v !== k])); },
});
// segments a..g des chiffres 0..9 (bit 0 = a)
const SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
for (const [id, actifBas] of [['74ls47', true], ['74ls48', false]]) {
  const segs = 'abcdefg'.split('');
  puce74({
    id, nom: id.toUpperCase(), tags: ['afficheur'],
    description: `Décodeur BCD vers 7 segments, sorties ${actifBas ? 'actives à 0 à collecteur ouvert (afficheur à anode commune + résistances)' : 'actives à 1 avec rappel interne (afficheur à cathode commune)'} ; /LT allume tout, /BI éteint, /RBI éteint le zéro. Codes 10 à 15 : éteint (le vrai circuit affiche des motifs).`,
    broches: ['B', 'C', '~LT', '~BI', '~RBI', 'D', 'A', 'GND', 'e', 'd', 'c', 'b', 'a', 'g', 'f', 'VCC'], sorties: segs,
    types: actifBas ? { drain_ouvert: segs } : undefined,
    evaluer(e) {
      const v = valeur(e, ['A', 'B', 'C', 'D']);
      let m = !e.nLT ? 0x7f : !e.nBI || (v === 0 && !e.nRBI) || v > 9 ? 0 : SEG[v];
      return Object.fromEntries(segs.map((x, i) => { const on = ((m >> i) & 1) === 1; return [x, actifBas ? (on ? false : null) : on]; }));
    },
  });
}
puce74({
  id: '74hc147', nom: '74HC147', description: 'Codeur de priorité 10 vers 4 : l\'entrée active (à 0) de plus haut rang parmi /1../9 donne son code BCD inversé sur /D /C /B /A.',
  broches: ['~4', '~5', '~6', '~7', '~8', '~C', '~B', 'GND', '~A', '~9', '~1', '~2', '~3', '~D', 'NC', 'VCC'], sorties: ['~A', '~B', '~C', '~D'],
  evaluer(e) { let v = 0; for (let k = 9; k >= 1; k--) if (!e['n' + k]) { v = k; break; } return { nA: !(v & 1), nB: !(v & 2), nC: !(v & 4), nD: !(v & 8) }; },
});
puce74({
  id: '74hc148', nom: '74HC148', description: 'Codeur de priorité 8 vers 3 (entrées et sorties actives à 0), validation /EI, sorties /GS (une entrée active) et /EO (cascade).',
  broches: ['~4', '~5', '~6', '~7', '~EI', '~A2', '~A1', 'GND', '~A0', '~0', '~1', '~2', '~3', '~GS', '~EO', 'VCC'], sorties: ['~A0', '~A1', '~A2', '~GS', '~EO'],
  evaluer(e) {
    if (e.nEI) return { nA0: true, nA1: true, nA2: true, nGS: true, nEO: true };
    let v = -1; for (let k = 7; k >= 0; k--) if (!e['n' + k]) { v = k; break; }
    if (v < 0) return { nA0: true, nA1: true, nA2: true, nGS: true, nEO: false };
    return { nA0: !(v & 1), nA1: !(v & 2), nA2: !(v & 4), nGS: false, nEO: true };
  },
});
puce74({
  id: '74hc151', nom: '74HC151', description: 'Multiplexeur 8 vers 1 : C B A choisit D0..D7, Y et W = /Y, validation /G.',
  broches: ['D3', 'D2', 'D1', 'D0', 'Y', 'W', '~G', 'GND', 'C', 'B', 'A', 'D7', 'D6', 'D5', 'D4', 'VCC'], sorties: ['Y', 'W'],
  evaluer: e => { const y = !e.nG && e['D' + valeur(e, ['A', 'B', 'C'])]; return { Y: y, W: !y }; },
});
puce74({
  id: '74hc153', nom: '74HC153', description: 'Deux multiplexeurs 4 vers 1 à sélection commune (B A), validations /1G et /2G.',
  broches: ['~1G', 'B', '1C3', '1C2', '1C1', '1C0', '1Y', 'GND', '2Y', '2C0', '2C1', '2C2', '2C3', 'A', '~2G', 'VCC'], sorties: ['1Y', '2Y'],
  evaluer: e => { const v = valeur(e, ['A', 'B']); return { '1Y': !e.n1G && e['1C' + v], '2Y': !e.n2G && e['2C' + v] }; },
});
puce74({
  id: '74hc157', nom: '74HC157', description: 'Quatre multiplexeurs 2 vers 1 : A/B = 0 choisit les entrées A, 1 les entrées B ; /G = 1 force les sorties à 0.',
  broches: [{ nom: 'S', etiquette: 'A/B' }, '1A', '1B', '1Y', '2A', '2B', '2Y', 'GND', '3Y', '3B', '3A', '4Y', '4B', '4A', '~G', 'VCC'], sorties: ['1Y', '2Y', '3Y', '4Y'],
  evaluer: e => Object.fromEntries([1, 2, 3, 4].map(k => [k + 'Y', !e.nG && (e.S ? e[k + 'B'] : e[k + 'A'])])),
});

/* ---------- Arithmétique et comparaison ---------- */
puce74({
  id: '74hc85', nom: '74HC85', description: 'Comparateur de deux nombres de 4 bits (A3..A0, B3..B0) avec entrées de cascade ; sorties A>B, A=B, A<B.',
  broches: ['B3', { nom: 'IALB', etiquette: 'I A<B' }, { nom: 'IAEB', etiquette: 'I A=B' }, { nom: 'IAGB', etiquette: 'I A>B' }, { nom: 'OAGB', etiquette: 'A>B' }, { nom: 'OAEB', etiquette: 'A=B' }, { nom: 'OALB', etiquette: 'A<B' }, 'GND', 'B0', 'A0', 'B1', 'A1', 'A2', 'B2', 'A3', 'VCC'],
  sorties: ['OAGB', 'OAEB', 'OALB'],
  evaluer(e) {
    const a = valeur(e, ['A0', 'A1', 'A2', 'A3']), b = valeur(e, ['B0', 'B1', 'B2', 'B3']);
    if (a !== b) return { OAGB: a > b, OAEB: false, OALB: a < b };
    return { OAGB: e.IAGB && !e.IAEB, OAEB: e.IAEB, OALB: e.IALB && !e.IAEB };
  },
});
puce74({
  id: '74hc283', nom: '74HC283', description: 'Additionneur 4 bits : Σ = A + B + C0, retenue de sortie C4.',
  broches: [{ nom: 'S2', etiquette: 'Σ2' }, 'B2', 'A2', { nom: 'S1', etiquette: 'Σ1' }, 'A1', 'B1', 'C0', 'GND', 'C4', { nom: 'S4', etiquette: 'Σ4' }, 'B4', 'A4', { nom: 'S3', etiquette: 'Σ3' }, 'A3', 'B3', 'VCC'],
  sorties: ['S1', 'S2', 'S3', 'S4', 'C4'],
  evaluer(e) { const v = valeur(e, ['A1', 'A2', 'A3', 'A4']) + valeur(e, ['B1', 'B2', 'B3', 'B4']) + (e.C0 ? 1 : 0); const b = bits(v, 5); return { S1: b[0], S2: b[1], S3: b[2], S4: b[3], C4: b[4] }; },
});
puce74({
  id: '74hc688', nom: '74HC688', description: 'Comparateur d\'égalité 8 bits : /P=Q passe à 0 si P = Q (validation /G).',
  broches: ['~G', 'P0', 'Q0', 'P1', 'Q1', 'P2', 'Q2', 'P3', 'Q3', 'GND', 'P4', 'Q4', 'P5', 'Q5', 'P6', 'Q6', 'P7', 'Q7', { nom: 'nPEQ', etiquette: '/P=Q' }, 'VCC'],
  sorties: ['nPEQ'],
  evaluer: e => ({ nPEQ: e.nG || [0, 1, 2, 3, 4, 5, 6, 7].some(k => e['P' + k] !== e['Q' + k]) }),
});

/* ---------- Monostable redéclenchable (R et C externes) ---------- */
// Durée ≈ 0,45·R·C (fiche NXP 74HC123) : à chaque déclenchement le condensateur est déchargé, l'impulsion se termine
// quand la tension de Rext/Cext remonte à 1 − e^−0,45 ≈ 36 % de VCC. R entre Rext/Cext et VCC, C entre Cext et Rext/Cext.
puce74({
  id: '74hc123', nom: '74HC123', tags: ['temporisation'],
  description: 'Deux monostables redéclenchables : impulsion de durée ≈ 0,45·R·C sur Q (R de Rext/Cext à VCC, C de Cext à Rext/Cext), déclenchée par front descendant de /A (B = 1) ou montant de B (/A = 0) ; /CLR l\'interrompt.',
  broches: ['~1A', '1B', '~1CLR', '~1Q', '2Q', '2CEXT', '2RCEXT', 'GND', '~2A', '2B', '~2CLR', '~2Q', '1Q', '1CEXT', '1RCEXT', 'VCC'],
  sorties: ['1Q', '~1Q', '2Q', '~2Q'], passifs: ['1CEXT', '1RCEXT', '2CEXT', '2RCEXT'],
  modele: {
    elements: [1, 2].flatMap(k => [
      { t: 'R', a: k + 'CEXT', b: 'GND', R: 1 },                                         // Cext relié à la masse interne
      { t: 'S', a: k + 'RCEXT', b: k + 'CEXT', ferme: false, Ron: 20, nom: 'decharge' + k },  // décharge du condensateur
    ]),
  },
  etat: () => ({ a1: false, a2: false, d1: 0, d2: 0 }),
  evaluer(e, s, p, c) {
    const o = {}, vcc = e.alim;
    for (const k of [1, 2]) {
      const declenche = (e.descend[`n${k}A`] && e[k + 'B']) || (e.monte[k + 'B'] && !e[`n${k}A`]);
      if (!e[`n${k}CLR`]) { s['a' + k] = false; s['d' + k] = 0; }
      else if (declenche) { s['a' + k] = true; s['d' + k] = 1; }
      // décharge jusqu'à < 2 % de VCC (au moins un pas), puis l'impulsion dure jusqu'au seuil de recharge
      if (s['d' + k] > 0) s['d' + k] = c.v(k + 'RCEXT') - c.v(k + 'CEXT') > 0.02 * vcc ? s['d' + k] + 1 : 0;
      else if (s['a' + k] && c.v(k + 'RCEXT') - c.v('GND') >= 0.362 * vcc) s['a' + k] = false;
      c.regler('decharge' + k, s['d' + k] > 0);
      o[k + 'Q'] = s['a' + k]; o[`n${k}Q`] = !s['a' + k];
    }
    return o;
  },
});
})();
