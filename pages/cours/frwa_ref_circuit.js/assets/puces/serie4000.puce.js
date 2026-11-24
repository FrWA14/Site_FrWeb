// Série 4000 (CMOS, 3 à 15 V) : portes, bascules, compteurs, registres, décodeurs, additionneur, comparateur,
// commutateurs analogiques et monostable. Brochages DIP des fiches TI (CD4000B). Les CD4013, CD4017, CD4060, CD4081,
// CD4511 et CD4518 sont dans leurs propres fichiers. Même description par tables que serie7400.puce.js.
// Notation : '~X' = active à 0 (nom nX, étiquette /X) ; 'NC' = non connectée. Sorties ≈ 500 Ω, fonctionnement dès 3 V.
(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

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
const n = b => b.replace(/^~/, 'n');
const valeur = (e, noms) => noms.reduce((a, b, i) => a | (e[b] ? 1 << i : 0), 0);
const sortiesBits = (v, noms) => Object.fromEntries(noms.map((q, i) => [q, ((v >> i) & 1) === 1]));
const SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];   // segments a..g (bit 0 = a) de 0..9

/** puce logique CMOS : o = { id, nom, description, broches, sorties, types, passifs, evaluer, etat, tags, modele, affichage } */
function puce40(o) {
  const br = brochage(o.broches), noms = br.map(nomDe);
  const nc = noms.filter(x => /^NC\d+$/.test(x));
  const sorties = o.sorties.map(n);
  const sp = Object.fromEntries(Object.entries(o.types || {}).map(([t, l]) => [t, l.map(n)]));
  const passifs = o.passifs || [];
  const pris = new Set(['VDD', 'VSS', ...nc, ...Object.values(sp).flat(), ...passifs]);
  const entrees = noms.filter(x => !pris.has(x) && !sorties.includes(x));
  const typesBroches = { alim_entree: ['VDD', 'VSS'], entree: entrees, sortie: sorties.filter(x => !pris.has(x)), ...sp };
  if (nc.length) typesBroches.nc = nc;
  if (passifs.length) typesBroches.passif = passifs;
  FrWA.puce({
    id: o.id, tags: ['serie4000', 'logique', ...(o.tags || [])],
    nom: o.nom, prefixe: 'U', categorie: 'Logique CMOS 4000', version: '1.0.0', regles: 1,
    description: o.description, broches: br, typesBroches, variables: o.variables || [], modele3d: null,
    ...(o.cotes ? { cotes: o.cotes } : {}), ...(o.parametres ? { parametres: o.parametres, principal: o.principal || o.parametres[0].cle } : {}),
    ...(o.modele ? { modele: o.modele } : {}),
    logique: { vdd: 'VDD', vss: 'VSS', entrees, sorties, rSortie: 500, vMin: 3, etat: o.etat || (() => ({})), evaluer: o.evaluer },
    ...(o.affichage ? { affichage: o.affichage } : {}),
  });
}

/* ---------- Portes ---------- */
const ET = l => l.every(Boolean), OU = l => l.some(Boolean), OUX = l => l.filter(Boolean).length % 2 === 1;
const F = { NAND: l => !ET(l), AND: ET, NOR: l => !OU(l), OR: OU, XOR: OUX, XNOR: l => !OUX(l), NOT: l => !l[0], BUF: l => l[0] };
// [motif, { sortie: [entrées] }]
const QUAD = [['A', 'B', 'J', 'K', 'C', 'D', 'VSS', 'E', 'F', 'L', 'M', 'G', 'H', 'VDD'], { J: ['A', 'B'], K: ['C', 'D'], L: ['E', 'F'], M: ['G', 'H'] }];
const HEX = [['A', 'G', 'B', 'H', 'C', 'I', 'VSS', 'J', 'D', 'K', 'E', 'L', 'F', 'VDD'], { G: ['A'], H: ['B'], I: ['C'], J: ['D'], K: ['E'], L: ['F'] }];
const HEX16 = [['VDD', 'G', 'A', 'H', 'B', 'I', 'C', 'VSS', 'D', 'J', 'E', 'K', 'NC', 'F', 'L', 'NC'], { G: ['A'], H: ['B'], I: ['C'], J: ['D'], K: ['E'], L: ['F'] }];
const DUO4 = [['J', 'A', 'B', 'C', 'D', 'NC', 'VSS', 'NC', 'E', 'F', 'G', 'H', 'K', 'VDD'], { J: ['A', 'B', 'C', 'D'], K: ['E', 'F', 'G', 'H'] }];
const TRI3 = [['A', 'B', 'D', 'E', 'F', 'L', 'VSS', 'C', 'J', 'K', 'G', 'H', 'I', 'VDD'], { J: ['A', 'B', 'C'], L: ['D', 'E', 'F'], K: ['G', 'H', 'I'] }];
function portes(id, f, [motif, table], description, tags = []) {
  puce40({
    id, nom: id.toUpperCase(), description, broches: motif, sorties: Object.keys(table), tags,
    evaluer: e => Object.fromEntries(Object.entries(table).map(([s, l]) => [s, F[f](l.map(x => e[x]))])),
  });
}
portes('cd4001', 'NOR', QUAD, 'Quatre portes NON-OU (NOR) à 2 entrées : J = /(A+B), K = /(C+D), L = /(E+F), M = /(G+H).', ['basic']);
portes('cd4011', 'NAND', QUAD, 'Quatre portes NON-ET (NAND) à 2 entrées : J = /(A·B), K = /(C·D)…', ['basic']);
portes('cd4071', 'OR', QUAD, 'Quatre portes OU (OR) à 2 entrées.');
portes('cd4070', 'XOR', QUAD, 'Quatre portes OU exclusif (XOR) à 2 entrées (remplace le CD4030).');
portes('cd4077', 'XNOR', QUAD, 'Quatre portes NON-OU exclusif (XNOR) à 2 entrées.');
portes('cd4093', 'NAND', QUAD, 'Quatre NON-ET à 2 entrées à trigger de Schmitt : oscillateur RC, anti-rebond, mise en forme.', ['basic']);
portes('cd4069', 'NOT', HEX, 'Six inverseurs (G = /A, H = /B…).', ['basic']);
portes('cd40106', 'NOT', HEX, 'Six inverseurs à trigger de Schmitt (oscillateur RC, anti-rebond).');
portes('cd4049', 'NOT', HEX16, 'Six inverseurs tampons (fort courant, abaisseurs de niveau). Alimentation broche 1, masse broche 8.');
portes('cd4050', 'BUF', HEX16, 'Six tampons non inverseurs (abaisseurs de niveau 5 V → 3,3 V). Alimentation broche 1, masse broche 8.');
portes('cd4012', 'NAND', DUO4, 'Deux portes NON-ET à 4 entrées.');
portes('cd4002', 'NOR', DUO4, 'Deux portes NON-OU à 4 entrées.');
portes('cd4082', 'AND', DUO4, 'Deux portes ET à 4 entrées.');
portes('cd4072', 'OR', DUO4, 'Deux portes OU à 4 entrées.');
portes('cd4023', 'NAND', TRI3, 'Trois portes NON-ET à 3 entrées (J = /(A·B·C), L = /(D·E·F), K = /(G·H·I)).');
portes('cd4025', 'NOR', TRI3, 'Trois portes NON-OU à 3 entrées.');
portes('cd4073', 'AND', TRI3, 'Trois portes ET à 3 entrées.');
portes('cd4075', 'OR', TRI3, 'Trois portes OU à 3 entrées.');
for (const [id, f, g] of [['cd4068', 'AND', 'NAND'], ['cd4078', 'OR', 'NOR']]) {
  puce40({
    id, nom: id.toUpperCase(), description: `Porte ${g} / ${f} à 8 entrées : J = ${g}, K = ${f}.`,
    broches: ['K', 'A', 'B', 'C', 'D', 'NC', 'VSS', 'NC', 'E', 'F', 'G', 'H', 'J', 'VDD'], sorties: ['J', 'K'],
    evaluer: e => { const l = 'ABCDEFGH'.split('').map(x => e[x]); return { J: F[g](l), K: F[f](l) }; },
  });
}

/* ---------- Bascules et verrous ---------- */
puce40({
  id: 'cd4027', nom: 'CD4027', description: 'Deux bascules JK sur front montant, mise à 1 (S) et remise à 0 (R) asynchrones actives à 1.',
  broches: ['Q1', '~Q1', 'CLK1', 'R1', 'K1', 'J1', 'S1', 'VSS', 'S2', 'J2', 'K2', 'R2', 'CLK2', '~Q2', 'Q2', 'VDD'], sorties: ['Q1', '~Q1', 'Q2', '~Q2'],
  etat: () => ({ q1: false, q2: false }),
  evaluer(e, s) {
    const o = {};
    for (const k of [1, 2]) {
      const q = 'q' + k;
      if (e['S' + k] && e['R' + k]) { o['Q' + k] = true; o['nQ' + k] = true; continue; }
      if (e['R' + k]) s[q] = false; else if (e['S' + k]) s[q] = true;
      else if (e.monte['CLK' + k]) { const J = e['J' + k], K = e['K' + k]; s[q] = J && K ? !s[q] : J ? true : K ? false : s[q]; }
      o['Q' + k] = s[q]; o['nQ' + k] = !s[q];
    }
    return o;
  },
});
puce40({
  id: 'cd4042', nom: 'CD4042', description: 'Quatre verrous D à horloge commune : transparents quand CLK = POL, mémorisés sur la transition inverse.',
  broches: ['Q4', 'Q1', '~Q1', 'D1', 'CLK', 'POL', 'D2', 'VSS', '~Q2', 'Q2', 'Q3', '~Q3', 'D3', 'D4', '~Q4', 'VDD'],
  sorties: [1, 2, 3, 4].flatMap(k => ['Q' + k, '~Q' + k]), etat: () => ({ v: 0 }),
  evaluer(e, s) {
    if (e.CLK === e.POL) s.v = valeur(e, ['D1', 'D2', 'D3', 'D4']);
    return Object.fromEntries([1, 2, 3, 4].flatMap(k => { const q = ((s.v >> (k - 1)) & 1) === 1; return [['Q' + k, q], ['nQ' + k, !q]]; }));
  },
});
puce40({
  id: 'cd4043', nom: 'CD4043', description: 'Quatre bascules RS (portes NON-OU, R prioritaire), sorties trois états validées par EN = 1.',
  broches: ['Q4', 'Q1', 'R1', 'S1', 'EN', 'S2', 'R2', 'VSS', 'Q2', 'Q3', 'R3', 'S3', 'NC', 'S4', 'R4', 'VDD'],
  sorties: ['Q1', 'Q2', 'Q3', 'Q4'], types: { trois_etats: ['Q1', 'Q2', 'Q3', 'Q4'] }, etat: () => ({ v: 0 }),
  evaluer(e, s) {
    for (const k of [1, 2, 3, 4]) { const m = 1 << (k - 1); if (e['R' + k]) s.v &= ~m; else if (e['S' + k]) s.v |= m; }
    return Object.fromEntries([1, 2, 3, 4].map(k => ['Q' + k, e.EN ? ((s.v >> (k - 1)) & 1) === 1 : null]));
  },
});
puce40({
  id: 'cd40175', nom: 'CD40175', description: 'Quatre bascules D à horloge commune (front montant), sorties Q et /Q, remise à 0 /CLR.',
  broches: ['~CLR', 'Q1', '~Q1', 'D1', 'D2', '~Q2', 'Q2', 'VSS', 'CLK', 'Q3', '~Q3', 'D3', 'D4', '~Q4', 'Q4', 'VDD'],
  sorties: [1, 2, 3, 4].flatMap(k => ['Q' + k, '~Q' + k]), etat: () => ({ v: 0 }),
  evaluer(e, s) {
    if (!e.nCLR) s.v = 0; else if (e.monte.CLK) s.v = valeur(e, ['D1', 'D2', 'D3', 'D4']);
    return Object.fromEntries([1, 2, 3, 4].flatMap(k => { const q = ((s.v >> (k - 1)) & 1) === 1; return [['Q' + k, q], ['nQ' + k, !q]]; }));
  },
});
puce40({
  id: 'cd40174', nom: 'CD40174', description: 'Six bascules D à horloge commune (front montant), remise à 0 /CLR.',
  broches: ['~CLR', 'Q1', 'D1', 'D2', 'Q2', 'D3', 'Q3', 'VSS', 'CLK', 'Q4', 'D4', 'Q5', 'D5', 'D6', 'Q6', 'VDD'],
  sorties: [1, 2, 3, 4, 5, 6].map(k => 'Q' + k), etat: () => ({ v: 0 }),
  evaluer(e, s) {
    if (!e.nCLR) s.v = 0; else if (e.monte.CLK) s.v = valeur(e, [1, 2, 3, 4, 5, 6].map(k => 'D' + k));
    return sortiesBits(s.v, [1, 2, 3, 4, 5, 6].map(k => 'Q' + k));
  },
});

/* ---------- Compteurs ---------- */
function ripple(id, etages, motif, description) {
  const Q = motif.filter(b => /^Q\d+$/.test(b));
  puce40({
    id, nom: id.toUpperCase(), description, broches: motif, sorties: Q, tags: id === 'cd4040' ? ['basic'] : [],
    etat: () => ({ v: 0 }),
    evaluer(e, s) {
      if (e.RST) s.v = 0; else if (e.descend.nCLK) s.v = (s.v + 1) % (2 ** etages);
      return Object.fromEntries(Q.map(q => [q, ((s.v >> (Number(q.slice(1)) - 1)) & 1) === 1]));
    },
    affichage: s => String(s.v),
  });
}
ripple('cd4020', 14, ['Q12', 'Q13', 'Q14', 'Q6', 'Q5', 'Q7', 'Q4', 'VSS', 'Q1', '~CLK', 'RST', 'Q9', 'Q8', 'Q10', 'Q11', 'VDD'],
  'Compteur binaire asynchrone 14 étages (front descendant), remise à 0 RST ; Q2 et Q3 ne sortent pas.');
ripple('cd4024', 7, ['~CLK', 'RST', 'Q7', 'Q6', 'Q5', 'Q4', 'VSS', 'NC', 'Q3', 'NC', 'Q2', 'Q1', 'NC', 'VDD'],
  'Compteur binaire asynchrone 7 étages (front descendant), remise à 0 RST.');
ripple('cd4040', 12, ['Q12', 'Q6', 'Q5', 'Q7', 'Q4', 'Q3', 'Q2', 'VSS', 'Q1', '~CLK', 'RST', 'Q9', 'Q8', 'Q10', 'Q11', 'VDD'],
  'Compteur binaire asynchrone 12 étages (front descendant), remise à 0 RST.');
puce40({
  id: 'cd4029', nom: 'CD4029', description: 'Compteur / décompteur préchargeable (PE), binaire (B/D = 1) ou décimal (B/D = 0), sens U/D, validation /CI, retenue /CO ; front montant.',
  broches: ['PE', 'Q4', 'J4', 'J1', '~CI', 'Q1', '~CO', 'VSS', { nom: 'BD', etiquette: 'B/D' }, { nom: 'UD', etiquette: 'U/D' }, 'Q2', 'J2', 'J3', 'Q3', 'CLK', 'VDD'],
  sorties: ['Q1', 'Q2', 'Q3', 'Q4', '~CO'], etat: () => ({ v: 0 }),
  evaluer(e, s) {
    const mod = e.BD ? 16 : 10;
    if (e.PE) s.v = valeur(e, ['J1', 'J2', 'J3', 'J4']);
    else if (e.monte.CLK && !e.nCI) s.v = e.UD ? (s.v + 1) % mod : (s.v + mod - 1) % mod;
    return { ...sortiesBits(s.v, ['Q1', 'Q2', 'Q3', 'Q4']), nCO: !(!e.nCI && (e.UD ? s.v === mod - 1 : s.v === 0)) };
  },
  affichage: s => String(s.v),
});
for (const [id, mod] of [['cd4510', 10], ['cd4516', 16]]) {
  puce40({
    id, nom: id.toUpperCase(), description: `Compteur / décompteur ${mod === 10 ? 'décimal (BCD)' : 'binaire 4 bits'} préchargeable (PE), remise à 0 RST, sens U/D, validation /CI, retenue /CO ; front montant.`,
    broches: ['PE', 'Q4', 'P4', 'P1', '~CI', 'Q1', '~CO', 'VSS', 'RST', { nom: 'UD', etiquette: 'U/D' }, 'Q2', 'P2', 'P3', 'Q3', 'CLK', 'VDD'],
    sorties: ['Q1', 'Q2', 'Q3', 'Q4', '~CO'], etat: () => ({ v: 0 }),
    evaluer(e, s) {
      if (e.RST) s.v = 0; else if (e.PE) s.v = valeur(e, ['P1', 'P2', 'P3', 'P4']) % 16;
      else if (e.monte.CLK && !e.nCI) s.v = e.UD ? (s.v + 1) % mod : (s.v + mod - 1) % mod;
      return { ...sortiesBits(s.v, ['Q1', 'Q2', 'Q3', 'Q4']), nCO: !(!e.nCI && (e.UD ? s.v === mod - 1 : s.v === 0)) };
    },
    affichage: s => String(s.v),
  });
}
puce40({
  id: 'cd4520', nom: 'CD4520', description: 'Deux compteurs binaires 4 bits synchrones : comptent sur front montant de CLK (EN = 1) ou descendant de EN (CLK = 0) ; remise à 0 RST. Brochage du CD4518.',
  broches: ['CLKA', 'ENA', 'Q1A', 'Q2A', 'Q3A', 'Q4A', 'RSTA', 'VSS', 'CLKB', 'ENB', 'Q1B', 'Q2B', 'Q3B', 'Q4B', 'RSTB', 'VDD'],
  sorties: ['A', 'B'].flatMap(x => [1, 2, 3, 4].map(k => `Q${k}${x}`)), etat: () => ({ A: 0, B: 0 }),
  evaluer(e, s) {
    const o = {};
    for (const x of ['A', 'B']) {
      if (e['RST' + x]) s[x] = 0;
      else if ((e.monte['CLK' + x] && e['EN' + x]) || (e.descend['EN' + x] && !e['CLK' + x])) s[x] = (s[x] + 1) % 16;
      Object.assign(o, sortiesBits(s[x], [1, 2, 3, 4].map(k => `Q${k}${x}`)));
    }
    return o;
  },
  affichage: s => `${s.A} / ${s.B}`,
});
for (const id of ['cd4026', 'cd4033']) {
  const segs = 'abcdefg'.split('');
  const b4026 = ['CLK', 'INH', 'DEI', 'DEO', 'CO', 'f', 'g', 'VSS', 'd', 'a', 'e', 'b', 'c', 'UCS', 'RST', 'VDD'];
  const b4033 = ['CLK', 'INH', 'RBI', 'RBO', 'CO', 'f', 'g', 'VSS', 'd', 'a', 'e', 'b', 'c', 'LT', 'RST', 'VDD'];
  puce40({
    id, nom: id.toUpperCase(), tags: ['afficheur'],
    description: id === 'cd4026'
      ? 'Compteur décimal avec décodeur 7 segments (cathode commune) : compte sur front montant (INH = 0), DEI = 1 allume l\'affichage, CO = retenue (÷10), UCS = segment c non validé.'
      : 'Compteur décimal avec décodeur 7 segments (cathode commune) : compte sur front montant (INH = 0), RBI = 1 éteint le zéro (RBO signale l\'extinction), LT = 1 allume tout, CO = retenue.',
    broches: id === 'cd4026' ? b4026 : b4033,
    sorties: [...segs, 'CO', ...(id === 'cd4026' ? ['DEO', 'UCS'] : ['RBO'])], etat: () => ({ v: 0 }),
    evaluer(e, s) {
      if (e.RST) s.v = 0; else if (e.monte.CLK && !e.INH) s.v = (s.v + 1) % 10;
      let m = SEG[s.v];
      const o = { CO: s.v < 5 };
      if (id === 'cd4026') { o.DEO = e.DEI; o.UCS = ((SEG[s.v] >> 2) & 1) === 1; if (!e.DEI) m = 0; }
      else { const eteint = e.RBI && s.v === 0; o.RBO = eteint; if (e.LT) m = 0x7f; else if (eteint) m = 0; }
      return { ...o, ...sortiesBits(m, segs) };
    },
    affichage: s => String(s.v),
  });
}
for (const [id, mod] of [['cd40192', 10], ['cd40193', 16]]) {
  puce40({
    id, nom: id.toUpperCase(), description: `Compteur / décompteur ${mod === 10 ? 'décimal' : 'binaire'} à deux horloges UP / DOWN (front montant), préchargement /LOAD, remise à 0 CLR, retenues /CO et /BO (brochage du 74193).`,
    broches: ['B', 'QB', 'QA', 'DOWN', 'UP', 'QC', 'QD', 'VSS', 'D', 'C', '~LOAD', '~CO', '~BO', 'CLR', 'A', 'VDD'],
    sorties: ['QA', 'QB', 'QC', 'QD', '~CO', '~BO'], etat: () => ({ v: 0 }),
    evaluer(e, s) {
      if (e.CLR) s.v = 0; else if (!e.nLOAD) s.v = valeur(e, ['A', 'B', 'C', 'D']);
      else if (e.monte.UP && e.DOWN) s.v = (s.v + 1) % mod; else if (e.monte.DOWN && e.UP) s.v = (s.v + mod - 1) % mod;
      return { ...sortiesBits(s.v, ['QA', 'QB', 'QC', 'QD']), nCO: !(s.v === mod - 1 && !e.UP), nBO: !(s.v === 0 && !e.DOWN) };
    },
    affichage: s => String(s.v),
  });
}

/* ---------- Registres à décalage ---------- */
puce40({
  id: 'cd4015', nom: 'CD4015', description: 'Deux registres à décalage 4 bits entrée série / sorties parallèles (front montant), remises à 0 RSTA, RSTB.',
  broches: ['CLKB', 'Q4B', 'Q3A', 'Q2A', 'Q1A', 'RSTA', 'DA', 'VSS', 'CLKA', 'Q4A', 'Q3B', 'Q2B', 'Q1B', 'RSTB', 'DB', 'VDD'],
  sorties: ['A', 'B'].flatMap(x => [1, 2, 3, 4].map(k => `Q${k}${x}`)), etat: () => ({ A: 0, B: 0 }),
  evaluer(e, s) {
    const o = {};
    for (const x of ['A', 'B']) {
      if (e['RST' + x]) s[x] = 0; else if (e.monte['CLK' + x]) s[x] = ((s[x] << 1) | (e['D' + x] ? 1 : 0)) & 15;
      Object.assign(o, sortiesBits(s[x], [1, 2, 3, 4].map(k => `Q${k}${x}`)));
    }
    return o;
  },
});
puce40({
  id: 'cd4021', nom: 'CD4021', description: 'Registre à décalage 8 bits entrées parallèles : P/S = 1 charge P1..P8 (asynchrone), P/S = 0 décale à chaque front montant (SER entre en 1) ; sorties Q6, Q7, Q8.',
  broches: ['P8', 'Q6', 'Q8', 'P4', 'P3', 'P2', 'P1', 'VSS', { nom: 'PS', etiquette: 'P/S' }, 'CLK', 'SER', 'Q7', 'P5', 'P6', 'P7', 'VDD'],
  sorties: ['Q6', 'Q7', 'Q8'], etat: () => ({ v: 0 }),
  evaluer(e, s) {
    if (e.PS) s.v = valeur(e, ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']);
    else if (e.monte.CLK) s.v = ((s.v << 1) | (e.SER ? 1 : 0)) & 0xff;
    return { Q6: ((s.v >> 5) & 1) === 1, Q7: ((s.v >> 6) & 1) === 1, Q8: ((s.v >> 7) & 1) === 1 };
  },
});
puce40({
  id: 'cd4094', nom: 'CD4094', tags: ['arduino'],
  description: 'Registre à décalage 8 bits avec verrou de sortie : D entre à chaque front montant de CLK, STR = 1 recopie vers Q1..Q8 (trois états, OE = 1) ; QS (front montant) et Q\'S (front descendant) pour la cascade.',
  broches: [{ nom: 'STR', etiquette: 'STROBE' }, 'D', 'CLK', 'Q1', 'Q2', 'Q3', 'Q4', 'VSS', 'QS', { nom: 'QSP', etiquette: 'Q\'S' }, 'Q8', 'Q7', 'Q6', 'Q5', 'OE', 'VDD'],
  sorties: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'QS', 'QSP'], types: { trois_etats: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'] },
  etat: () => ({ sr: 0, v: 0, qsp: false }),
  evaluer(e, s) {
    if (e.monte.CLK) s.sr = ((s.sr << 1) | (e.D ? 1 : 0)) & 0xff;
    if (e.descend.CLK) s.qsp = ((s.sr >> 7) & 1) === 1;
    if (e.STR) s.v = s.sr;
    const o = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map(k => ['Q' + k, e.OE ? ((s.v >> (k - 1)) & 1) === 1 : null]));
    return { ...o, QS: ((s.sr >> 7) & 1) === 1, QSP: s.qsp };
  },
});

/* ---------- Décodeur, additionneur, comparateur ---------- */
puce40({
  id: 'cd4028', nom: 'CD4028', description: 'Décodeur BCD vers décimal, sorties actives à 1 (Q0..Q9 ; aucune pour 10 à 15).',
  broches: ['Q4', 'Q2', 'Q0', 'Q7', 'Q9', 'Q5', 'Q6', 'VSS', 'Q8', 'A', 'D', 'C', 'B', 'Q1', 'Q3', 'VDD'],
  sorties: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => 'Q' + k),
  evaluer: e => { const v = valeur(e, ['A', 'B', 'C', 'D']); return Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => ['Q' + k, v === k])); },
});
puce40({
  id: 'cd4008', nom: 'CD4008', description: 'Additionneur 4 bits : S = A + B + CIN, retenue COUT.',
  broches: ['A4', 'B3', 'A3', 'B2', 'A2', 'B1', 'A1', 'VSS', 'CIN', 'S1', 'S2', 'S3', 'S4', 'COUT', 'B4', 'VDD'],
  sorties: ['S1', 'S2', 'S3', 'S4', 'COUT'],
  evaluer(e) { const v = valeur(e, ['A1', 'A2', 'A3', 'A4']) + valeur(e, ['B1', 'B2', 'B3', 'B4']) + (e.CIN ? 1 : 0); return sortiesBits(v, ['S1', 'S2', 'S3', 'S4', 'COUT']); },
});
puce40({
  id: 'cd4063', nom: 'CD4063', description: 'Comparateur de deux nombres de 4 bits avec entrées de cascade (brochage du 74HC85).',
  broches: ['B3', { nom: 'IALB', etiquette: 'I A<B' }, { nom: 'IAEB', etiquette: 'I A=B' }, { nom: 'IAGB', etiquette: 'I A>B' }, { nom: 'OAGB', etiquette: 'A>B' }, { nom: 'OAEB', etiquette: 'A=B' }, { nom: 'OALB', etiquette: 'A<B' }, 'VSS', 'B0', 'A0', 'B1', 'A1', 'A2', 'B2', 'A3', 'VDD'],
  sorties: ['OAGB', 'OAEB', 'OALB'],
  evaluer(e) {
    const a = valeur(e, ['A0', 'A1', 'A2', 'A3']), b = valeur(e, ['B0', 'B1', 'B2', 'B3']);
    return a !== b ? { OAGB: a > b, OAEB: false, OALB: a < b } : { OAGB: e.IAGB && !e.IAEB, OAEB: e.IAEB, OALB: e.IALB && !e.IAEB };
  },
});

/* ---------- Unité séparée : un inverseur à trigger de Schmitt du CD40106 (symbole d'une seule porte) ---------- */
puce40({
  id: 'cd40106-u', nom: '40106 ⅙', tags: [],
  description: 'Un inverseur à trigger de Schmitt du CD40106 (unité ⅙ du boîtier) : Y = /A, seuils ≈ 60 % et 40 % de VDD. VDD et VSS : alimentation du boîtier.',
  broches: ['A', 'Y', 'VDD', 'VSS'], sorties: ['Y'],
  cotes: { gauche: ['A'], droite: ['Y'], haut: ['VDD'], bas: ['VSS'] },
  evaluer: e => ({ Y: !e.A }),
});

/* ---------- Unités séparées : une porte ET du CD4081, un OU exclusif du CD4070, une bascule D du CD4013 ---------- */
puce40({
  id: 'cd4081-u', nom: '4081 ¼', description: 'Une porte ET à 2 entrées du CD4081 (unité ¼ du boîtier) : Y = A·B. VDD et VSS : alimentation du boîtier.',
  broches: ['A', 'B', 'Y', 'VDD', 'VSS'], sorties: ['Y'], cotes: { gauche: ['A', 'B'], droite: ['Y'], haut: ['VDD'], bas: ['VSS'] },
  evaluer: e => ({ Y: e.A && e.B }),
});
puce40({
  id: 'cd4070-u', nom: '4070 ¼', description: 'Un OU exclusif à 2 entrées du CD4070 (unité ¼ du boîtier) : Y = A ⊕ B. VDD et VSS : alimentation du boîtier.',
  broches: ['A', 'B', 'Y', 'VDD', 'VSS'], sorties: ['Y'], cotes: { gauche: ['A', 'B'], droite: ['Y'], haut: ['VDD'], bas: ['VSS'] },
  evaluer: e => ({ Y: e.A !== e.B }),
});
puce40({
  id: 'cd4013-u', nom: '4013 ½', description: 'Une bascule D du CD4013 (unité ½ du boîtier) : au front montant de CLK, Q prend la valeur de D ; S et R asynchrones actifs à 1. D relié à /Q : diviseur par 2.',
  broches: ['D', 'CLK', 'S', 'R', 'Q', '~Q', 'VDD', 'VSS'], sorties: ['Q', '~Q'],
  cotes: { gauche: ['D', 'CLK', 'S', 'R'], droite: ['Q', 'nQ'], haut: ['VDD'], bas: ['VSS'] },
  etat: () => ({ q: false }),
  evaluer(e, s) {
    if (e.S && e.R) return { Q: true, nQ: true };
    if (e.R) s.q = false; else if (e.S) s.q = true; else if (e.monte.CLK) s.q = e.D;
    return { Q: s.q, nQ: !s.q };
  },
  affichage: s => 'Q = ' + (s.q ? 1 : 0),
});

/* ---------- CD4046B : boucle à verrouillage de phase (PLL) ----------
   PC1 : OU exclusif de SIG et COMP. PC2 : comparateur phase-fréquence sur fronts montants, sortie à trois états
   (1 si SIG en avance, 0 si COMP en avance, haute impédance une fois en phase) ; PCP (broche 1) = 1 quand PC2 est en
   haute impédance. VCO : le condensateur EXTERNE C1 (entre C1A et C1B) est chargé alternativement par chaque broche,
   l'autre étant mise à VSS, par un courant I = (VCOIN − Vt) / R1 (+ courant de R2) ; bascule quand la broche chargée
   atteint VDD / 4, d'où f ≈ (VCOIN − Vt) / (R1 · C1 · VDD) : f ≈ 1 / (R1·C1) à VCOIN = VDD (ordre de grandeur de la
   fiche TI, à Vt près). INH = 1 : VCO arrêté. SFOUT : suiveur de VCOIN (sortie du démodulateur). Z : zener 5,2 V. */
puce40({
  id: 'cd4046', nom: 'CD4046B', tags: ['temporisation', 'generateur'],
  description: 'Boucle à verrouillage de phase (PLL) : comparateurs PC1 (OU exclusif) et PC2 (phase-fréquence, trois états), VCO à R1 / C1 externes (f ≈ (VCOIN − Vt) / (R1·C1·VDD), soit ≈ 1/(R1·C1) à VCOIN = VDD), suiveur SFOUT, zener 5,2 V. INH = 1 arrête le VCO. Modèle comportemental : seuil Vt et loi du VCO approchés (à mesurer sur le composant réel).',
  broches: ['PCP', 'PC1', 'COMP', 'VCOUT', 'INH', 'C1A', 'C1B', 'VSS', 'VCOIN', 'SFOUT', 'R1', 'R2', 'PC2', 'SIG', 'Z', 'VDD'].map(b =>
    ({ PCP: { nom: 'PCP', etiquette: 'PHP' }, COMP: { nom: 'COMP', etiquette: 'COMP IN' }, VCOUT: { nom: 'VCOUT', etiquette: 'VCO OUT' }, VCOIN: { nom: 'VCOIN', etiquette: 'VCO IN' },
       SIG: { nom: 'SIG', etiquette: 'SIG IN' }, PC1: { nom: 'PC1', etiquette: 'PC1 OUT' }, PC2: { nom: 'PC2', etiquette: 'PC2 OUT' }, SFOUT: { nom: 'SFOUT', etiquette: 'SF OUT' } })[b] || b),
  sorties: ['PC1', 'PC2', 'PCP', 'VCOUT'],
  types: { trois_etats: ['PC2'], sortie: ['PC1', 'PCP', 'VCOUT', 'SFOUT'] },
  passifs: ['C1A', 'C1B', 'R1', 'R2', 'Z'],
  cotes: { gauche: ['SIG', 'COMP', null, 'VCOIN', 'INH'], droite: ['PC1', 'PC2', 'PCP', null, 'VCOUT', 'SFOUT'], haut: ['C1A', 'C1B', 'VDD'], bas: ['R1', 'R2', 'Z', 'VSS'] },
  parametres: [{ cle: 'Vt', nom: 'Seuil du VCO (Vt)', unite: 'V', defaut: 1, min: 0, max: 3, echelle: 'lin', pas: 0.05 }],
  variables: [{ cle: 'fvco', nom: 'Fréquence du VCO', unite: 'Hz' }, { cle: 'verrouille', nom: 'PC2 en haute impédance (en phase)', type: 'bool' }],
  modele: {
    elements: [
      { t: 'V', a: 'R1', b: 'VSS', V: 0, nom: 'vr1' }, { t: 'V', a: 'R2', b: 'VSS', V: 0, nom: 'vr2' },
      { t: 'I', a: 'VDD', b: 'C1A', I: 0, nom: 'ia' }, { t: 'I', a: 'VDD', b: 'C1B', I: 0, nom: 'ib' },
      { t: 'S', a: 'C1A', b: 'VSS', ferme: false, Ron: 10, nom: 'sa' }, { t: 'S', a: 'C1B', b: 'VSS', ferme: true, Ron: 10, nom: 'sb' },
      { t: 'O', a: 'SFOUT', ref: 'VSS', V: 0, R: 1e3, nom: 'sf' },
      { t: 'D', a: 'Z', b: 'VSS', Vf: 5.2, If: 1e-3 }, { t: 'D', a: 'VSS', b: 'Z', Vf: 0.7, If: 1e-3 },
      { t: 'R', a: 'VDD', b: 'VSS', R: 30e3 },
    ],
  },
  etat: () => ({ ph: 0, up: false, dn: false, fvco: 0, tFront: -1, verrouille: false }),
  evaluer(e, s, p, c) {
    const vdd = e.alim, vss = c.v('VSS'), vin = c.v('VCOIN') - vss;
    // PC2 : bascules « avance » / « retard » remises à zéro quand les deux fronts sont arrivés
    if (e.monte.SIG) { if (s.dn) s.dn = false; else s.up = true; }
    if (e.monte.COMP) { if (s.up) s.up = false; else s.dn = true; }
    s.verrouille = !s.up && !s.dn;
    // VCO
    c.regler('vr1', Math.max(0, Math.min(vdd, vin - p.Vt)));
    c.regler('vr2', vdd / 2);
    c.regler('sf', Math.max(0, Math.min(vdd, vin)));
    const I = Math.abs(c.i('vr1')) + Math.abs(c.i('vr2'));
    if (e.INH || I < 1e-12) {
      c.regler('ia', 0); c.regler('ib', 0); c.regler('sa', true); c.regler('sb', true); s.ph = 0;
      if (e.INH) s.fvco = 0;
    } else {
      const seuil = vdd / 4;
      if (s.ph === 0 && c.v('C1A') - vss >= seuil) s.ph = 1;
      else if (s.ph === 1 && c.v('C1B') - vss >= seuil) {
        s.ph = 0;
        if (s.tFront >= 0) s.fvco = 1 / Math.max(c.dt, c.t - s.tFront);
        s.tFront = c.t;
      }
      c.regler('ia', s.ph === 0 ? I : 0); c.regler('ib', s.ph === 1 ? I : 0);
      c.regler('sa', s.ph === 1); c.regler('sb', s.ph === 0);
    }
    return { PC1: e.SIG !== e.COMP, PC2: s.up ? true : s.dn ? false : null, PCP: s.verrouille, VCOUT: !e.INH && s.ph === 0 };
  },
  affichage: s => (s.fvco ? 'VCO ' + FrWA.formater(s.fvco, 'Hz') : 'VCO arrêté'),
});

/* ---------- Monostable redéclenchable CD4538 (R et C externes, durée = R·C) ---------- */
puce40({
  id: 'cd4538', nom: 'CD4538', tags: ['temporisation'],
  description: 'Deux monostables de précision redéclenchables : impulsion de durée T = R·C (R de RX/CX à VDD, C de CX à RX/CX ; CX à la masse) ; déclenchés par front montant de +TR (−TR = 1) ou descendant de −TR (+TR = 0) ; /CD remet à zéro.',
  broches: ['CX1', 'RCX1', '~CD1', 'PTR1', 'MTR1', 'Q1', '~Q1', 'VSS', '~Q2', 'Q2', 'MTR2', 'PTR2', '~CD2', 'RCX2', 'CX2', 'VDD'].map(b =>
    ({ RCX1: { nom: 'RCX1', etiquette: 'RX/CX1' }, RCX2: { nom: 'RCX2', etiquette: 'RX/CX2' }, PTR1: { nom: 'PTR1', etiquette: '+TR1' }, PTR2: { nom: 'PTR2', etiquette: '+TR2' }, MTR1: { nom: 'MTR1', etiquette: '−TR1' }, MTR2: { nom: 'MTR2', etiquette: '−TR2' } })[b] || b),
  sorties: ['Q1', '~Q1', 'Q2', '~Q2'], passifs: ['CX1', 'RCX1', 'CX2', 'RCX2'],
  cotes: { gauche: ['PTR1', 'MTR1', 'nCD1', null, 'PTR2', 'MTR2', 'nCD2'], droite: ['Q1', 'nQ1', null, null, 'Q2', 'nQ2'], haut: ['CX1', 'RCX1', 'VDD', 'RCX2', 'CX2'], bas: ['VSS'] },
  modele: {
    elements: [1, 2].flatMap(k => [
      { t: 'R', a: 'CX' + k, b: 'VSS', R: 1 },
      { t: 'S', a: 'RCX' + k, b: 'CX' + k, ferme: false, Ron: 20, nom: 'decharge' + k },
    ]),
  },
  etat: () => ({ a1: false, a2: false, d1: 0, d2: 0 }),
  evaluer(e, s, p, c) {
    const o = {};
    for (const k of [1, 2]) {
      const declenche = (e.monte['PTR' + k] && e['MTR' + k]) || (e.descend['MTR' + k] && !e['PTR' + k]);
      if (!e['nCD' + k]) { s['a' + k] = false; s['d' + k] = 0; }
      else if (declenche) { s['a' + k] = true; s['d' + k] = 1; }
      if (s['d' + k] > 0) s['d' + k] = c.v('RCX' + k) - c.v('CX' + k) > 0.02 * e.alim ? s['d' + k] + 1 : 0;   // décharge jusqu'à < 2 %
      else if (s['a' + k] && c.v('RCX' + k) - c.v('VSS') >= 0.632 * e.alim) s['a' + k] = false;
      c.regler('decharge' + k, s['d' + k] > 0);
      o['Q' + k] = s['a' + k]; o['nQ' + k] = !s['a' + k];
    }
    return o;
  },
});

/* ---------- Commutateurs analogiques (interrupteurs commandés, R passante ≈ 100 à 300 Ω) ---------- */
function analogique(o) {
  // o : { id, nom, description, broches, voies: [[a, b, nom]], commandes, vee, choisir(e) → Set des voies fermées, ron }
  const br = brochage(o.broches), noms = br.map(nomDe);
  const signal = [...new Set(o.voies.flatMap(([a, b]) => [a, b]))];
  const alim = o.vee ? ['VDD', 'VSS', 'VEE'] : ['VDD', 'VSS'];
  FrWA.puce({
    id: o.id, tags: ['serie4000', 'analogique', 'interrupteur'], nom: o.nom, prefixe: 'U', categorie: 'Logique CMOS 4000', version: '1.0.0', regles: 1,
    description: o.description, broches: br,
    typesBroches: { alim_entree: alim, entree: o.commandes, passif: signal, ...(noms.some(x => /^NC/.test(x)) ? { nc: noms.filter(x => /^NC/.test(x)) } : {}) },
    variables: [], modele3d: null,
    modele: {
      elements: [
        ...o.voies.map(([a, b, nom]) => ({ t: 'S', a, b, ferme: false, Ron: o.ron, Roff: 1e10, nom })),
        { t: 'R', a: 'VDD', b: 'VSS', R: 1e6 }, ...(o.vee ? [{ t: 'R', a: 'VEE', b: 'VSS', R: 1e9 }] : []),
      ],
      etat: () => ({ niveaux: {} }),
      pas(c) {
        const vss = c.v('VSS'), vdd = c.v('VDD') - vss, e = {};
        for (const k of o.commandes) { const prec = c.s.niveaux[k] ?? false, v = c.v(k) - vss; e[k] = v > vdd * (prec ? 0.4 : 0.6); c.s.niveaux[k] = e[k]; }
        const fermees = vdd >= 3 ? o.choisir(e) : new Set();
        for (const [, , nom] of o.voies) c.regler(nom, fermees.has(nom));
      },
    },
  });
}
for (const [id, ron] of [['cd4066', 125], ['cd4016', 300]]) {
  analogique({
    id, nom: id.toUpperCase(), ron, description: `Quatre interrupteurs analogiques bidirectionnels (R passante ≈ ${ron} Ω sous 10 V) : C1..C4 = 1 relie A et B de la même voie.`,
    broches: ['A1', 'B1', 'B2', 'A2', 'C2', 'C3', 'VSS', 'A3', 'B3', 'B4', 'A4', 'C4', 'C1', 'VDD'],
    voies: [1, 2, 3, 4].map(k => ['A' + k, 'B' + k, 'sw' + k]), commandes: ['C1', 'C2', 'C3', 'C4'],
    choisir: e => new Set([1, 2, 3, 4].filter(k => e['C' + k]).map(k => 'sw' + k)),
  });
}
const CH8 = [0, 1, 2, 3, 4, 5, 6, 7];
analogique({
  id: 'cd4051', nom: 'CD4051', ron: 120, vee: true,
  description: 'Multiplexeur / démultiplexeur analogique 8 voies : C B A choisit CH0..CH7 relié à COM ; INH = 1 ouvre tout. VEE = tension négative possible (sinon à VSS).',
  broches: ['CH4', 'CH6', 'COM', 'CH7', 'CH5', 'INH', 'VEE', 'VSS', 'C', 'B', 'A', 'CH3', 'CH0', 'CH1', 'CH2', 'VDD'],
  voies: CH8.map(k => ['COM', 'CH' + k, 'sw' + k]), commandes: ['A', 'B', 'C', 'INH'],
  choisir: e => new Set(e.INH ? [] : ['sw' + valeur(e, ['A', 'B', 'C'])]),
});
analogique({
  id: 'cd4052', nom: 'CD4052', ron: 120, vee: true,
  description: 'Double multiplexeur analogique 4 voies : B A choisit X0..X3 (vers COMX) et Y0..Y3 (vers COMY) ; INH = 1 ouvre tout.',
  broches: ['Y0', 'Y2', 'COMY', 'Y3', 'Y1', 'INH', 'VEE', 'VSS', 'B', 'A', 'X3', 'X0', 'COMX', 'X1', 'X2', 'VDD'],
  voies: [0, 1, 2, 3].flatMap(k => [['COMX', 'X' + k, 'x' + k], ['COMY', 'Y' + k, 'y' + k]]), commandes: ['A', 'B', 'INH'],
  choisir: e => { const v = valeur(e, ['A', 'B']); return new Set(e.INH ? [] : ['x' + v, 'y' + v]); },
});
analogique({
  id: 'cd4053', nom: 'CD4053', ron: 120, vee: true,
  description: 'Trois inverseurs analogiques : A, B, C choisissent X (0) ou Y (1) pour COMA, COMB, COMC ; INH = 1 ouvre tout.',
  broches: ['BY', 'BX', 'CY', 'COMC', 'CX', 'INH', 'VEE', 'VSS', 'C', 'B', 'A', 'AX', 'AY', 'COMA', 'COMB', 'VDD'],
  voies: ['A', 'B', 'C'].flatMap(x => [['COM' + x, x + 'X', x + 'x'], ['COM' + x, x + 'Y', x + 'y']]), commandes: ['A', 'B', 'C', 'INH'],
  choisir: e => new Set(e.INH ? [] : ['A', 'B', 'C'].map(x => x + (e[x] ? 'y' : 'x'))),
});
const CH16 = [...Array(16).keys()];
analogique({
  id: 'cd4067', nom: 'CD4067', ron: 125,
  description: 'Multiplexeur / démultiplexeur analogique 16 voies : D C B A choisit I0..I15 relié à COM ; INH = 1 ouvre tout.',
  broches: ['COM', 'I7', 'I6', 'I5', 'I4', 'I3', 'I2', 'I1', 'I0', 'A', 'B', 'VSS', 'D', 'C', 'INH', 'I15', 'I14', 'I13', 'I12', 'I11', 'I10', 'I9', 'I8', 'VDD'],
  voies: CH16.map(k => ['COM', 'I' + k, 'sw' + k]), commandes: ['A', 'B', 'C', 'D', 'INH'],
  choisir: e => new Set(e.INH ? [] : ['sw' + valeur(e, ['A', 'B', 'C', 'D'])]),
});
})();
