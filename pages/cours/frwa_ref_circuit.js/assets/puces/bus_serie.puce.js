// Modules d'essai des bus numériques (règle R11) : un maître et un esclave par protocole, écrits uniquement avec
// FrWA.bus (bus.js). Ils servent de référence aux futurs microcontrôleurs / FPGA et aux modules (écran SPI, capteur I2C…) :
//  - les maîtres reçoivent la forme des impulsions de la bibliothèque et la recopient sur leurs broches ;
//  - les esclaves ne lisent que les tensions de leurs broches et décodent ce qu'ils « voient ».
// Les octets se tapent en hexadécimal séparés par des espaces (« A5 3C 01 ») ; le texte UART accepte \n.

(() => {   // portée privée : les constantes de ce fichier ne gênent pas les autres puces
'use strict';

const B = FrWA.bus;
const hex = l => l.map(x => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');
const octets = txt => String(txt).split(/[\s,;]+/).filter(Boolean).map(x => parseInt(x.replace(/^0x/i, ''), 16)).filter(x => x >= 0 && x <= 255);
const echappe = txt => String(txt).replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
const ALIM = { alim_entree: ['VCC', 'GND'] };
const ecran = (g, x, lignes, coul = '#5ee87a') => {
  const w = x.W - 16, h = x.H - 34;
  g.fillStyle = '#041008'; g.fillRect(-w / 2, -x.H / 2 + 8, w, h);
  g.fillStyle = coul; g.font = '10px ui-monospace, Consolas, monospace'; g.textAlign = 'left'; g.textBaseline = 'top';
  lignes.slice(-Math.floor(h / 12)).forEach((l, i) => g.fillText(l, -w / 2 + 4, -x.H / 2 + 11 + 12 * i));
};
// sortie pilotée : tension du niveau haut = alimentation de la puce
const piloter = (c, nom, haut) => { const vcc = c.v('VCC') - c.v('GND'); c.regler(nom, vcc < 1.5 ? 0 : haut ? vcc : 0); };
// drain ouvert : tirer à la masse (50 Ω) ou relâcher (haute impédance)
const drain = (c, nom, relache) => c.regler(nom, relache ? { V: 0, R: 1e9 } : { V: 0, R: 50 });
const lire = (c, s, broche) => { const gnd = c.v('GND'); s.niv[broche] = B.lireNiveau(c.v(broche) - gnd, c.v('VCC') - gnd, s.niv[broche] ?? true); return s.niv[broche]; };

/* ---------------- UART ---------------- */
const PARAM_UART = [
  { cle: 'debit', nom: 'Débit', unite: 'bit/s', defaut: 9600, min: 300, max: 1e6, echelle: 'log' },
  { cle: 'parite', nom: 'Parité', type: 'choix', options: ['aucune', 'paire', 'impaire'], defaut: 'aucune' },
  { cle: 'arret', nom: 'Bits d\'arrêt', type: 'choix', options: ['1', '2'], defaut: '1' },
];
const optUART = p => ({ debit: p.debit, parite: p.parite, arret: Number(p.arret) });

FrWA.puce({
  id: 'gen-uart', tags: ['bus', 'generateur'], nom: 'GÉN. UART', prefixe: 'G', categorie: 'Bus série (essai)', version: '1.0.0', regles: 1,
  description: 'Maître UART d\'essai : envoie le message en 8 bits, LSB d\'abord, repos haut (forme calculée par FrWA.bus.EmetteurUART), puis attend la période et recommence.',
  broches: ['VCC', 'GND', 'TX'],
  typesBroches: { ...ALIM, sortie: ['TX'] },
  cotes: { haut: ['VCC'], droite: ['TX'], bas: ['GND'] },
  parametres: [...PARAM_UART,
    { cle: 'message', nom: 'Message', type: 'texte', defaut: 'Bonjour FrWA\\n' },
    { cle: 'periode', nom: 'Période d\'envoi', unite: 's', defaut: 0.03, min: 1e-4, max: 10, echelle: 'log' }],
  principal: 'debit',
  variables: [{ cle: 'envoyes', nom: 'Octets envoyés', unite: '' }],
  modele3d: null,
  modele: {
    elements: [{ t: 'O', a: 'TX', ref: 'GND', V: 0, R: 50, nom: 'tx' }, { t: 'R', a: 'VCC', b: 'GND', R: 10e3 }],
    etat: () => ({ envoyes: 0, em: null, cfg: '', prochain: 0 }),
    pas(c) {
      const s = c.s, cfg = JSON.stringify(optUART(c.p));
      if (!s.em || s.cfg !== cfg) { s.em = new B.EmetteurUART(optUART(c.p)); s.cfg = cfg; }
      if (!s.em.occupe && c.t >= s.prochain) { s.em.envoyer(echappe(c.p.message)); s.prochain = c.t + c.p.periode; }
      piloter(c, 'tx', s.em.niveau(c.t));
      s.envoyes = s.em.envoyes;
    },
  },
  affichage: (s, p) => `${p.debit} bit/s`,
});

FrWA.puce({
  id: 'terminal-uart', tags: ['bus', 'mesure'], nom: 'TERMINAL UART', prefixe: 'T', categorie: 'Bus série (essai)', version: '1.0.0', regles: 1,
  description: 'Récepteur UART : échantillonne RX au milieu de chaque bit (FrWA.bus.RecepteurUART) et affiche le texte reçu. Une erreur de débit, de parité ou de bit d\'arrêt est comptée.',
  broches: ['VCC', 'GND', 'RX'],
  typesBroches: { ...ALIM, entree: ['RX'] },
  cotes: { haut: ['VCC'], gauche: ['RX'], bas: ['GND'] },
  largeur: 200, hauteur: 100,
  parametres: PARAM_UART,
  principal: 'debit',
  variables: [
    { cle: 'recus', nom: 'Octets reçus', unite: '' },
    { cle: 'erreurs', nom: 'Erreurs de trame', unite: '' },
    { cle: 'ligne', nom: 'Dernière ligne', type: 'texte' },
  ],
  modele3d: null,
  modele: {
    elements: [{ t: 'R', a: 'RX', b: 'GND', R: 1e6 }, { t: 'R', a: 'VCC', b: 'GND', R: 10e3 }],
    etat: () => ({ recus: 0, erreurs: 0, ligne: '', lignes: [''], rx: null, cfg: '', niv: {} }),
    pas(c) {
      const s = c.s, cfg = JSON.stringify(optUART(c.p));
      if (!s.rx || s.cfg !== cfg) { s.rx = new B.RecepteurUART(optUART(c.p)); s.cfg = cfg; }
      const r = s.rx.echantillonner(c.t, lire(c, s, 'RX'));
      if (!r) return;
      s.recus++; if (r.erreur) s.erreurs++;
      const ch = r.erreur ? '¿' : r.octet === 10 ? '\n' : r.octet >= 32 && r.octet < 127 ? String.fromCharCode(r.octet) : '·';
      if (ch === '\n') { s.lignes.push(''); if (s.lignes.length > 20) s.lignes.shift(); }
      else { s.lignes[s.lignes.length - 1] = (s.lignes[s.lignes.length - 1] + ch).slice(-26); }
      s.ligne = s.lignes[s.lignes.length - 1] || s.lignes[s.lignes.length - 2] || '';
    },
  },
  dessin(g, x) { ecran(g, x, x.s.lignes || []); },
  affichage: s => `${s.recus ?? 0} octets${s.erreurs ? ' · ' + s.erreurs + ' err.' : ''}`,
});

/* ---------------- SPI ---------------- */
const PARAM_SPI = [
  { cle: 'mode', nom: 'Mode (CPOL, CPHA)', type: 'choix', options: ['0', '1', '2', '3'], defaut: '0' },
];

FrWA.puce({
  id: 'gen-spi', tags: ['bus', 'generateur'], nom: 'MAÎTRE SPI', prefixe: 'G', categorie: 'Bus série (essai)', version: '1.0.0', regles: 1,
  description: 'Maître SPI d\'essai : CS bas pendant toute la transaction, horloge et données calculées par FrWA.bus.MaitreSPI (modes 0 à 3, MSB d\'abord), MISO lu aux fronts d\'échantillonnage.',
  broches: ['VCC', 'GND', 'SCK', 'MOSI', 'MISO', 'CS'],
  typesBroches: { ...ALIM, sortie: ['SCK', 'MOSI', 'CS'], entree: ['MISO'] },
  cotes: { haut: ['VCC'], droite: ['SCK', 'MOSI', 'MISO', 'CS'], bas: ['GND'] },
  parametres: [
    { cle: 'frequence', nom: 'Fréquence d\'horloge', unite: 'Hz', defaut: 10e3, min: 10, max: 1e7, echelle: 'log' },
    ...PARAM_SPI,
    { cle: 'donnees', nom: 'Octets envoyés (hex)', type: 'texte', defaut: 'A5 3C 01' },
    { cle: 'periode', nom: 'Période', unite: 's', defaut: 0.01, min: 1e-4, max: 10, echelle: 'log' },
  ],
  principal: 'frequence',
  variables: [{ cle: 'recu', nom: 'Octets lus sur MISO', type: 'texte' }, { cle: 'transactions', nom: 'Transactions', unite: '' }],
  modele3d: null,
  modele: {
    elements: [
      { t: 'O', a: 'SCK', ref: 'GND', V: 0, R: 50, nom: 'sck' }, { t: 'O', a: 'MOSI', ref: 'GND', V: 0, R: 50, nom: 'mosi' },
      { t: 'O', a: 'CS', ref: 'GND', V: 5, R: 50, nom: 'cs' }, { t: 'R', a: 'MISO', b: 'GND', R: 1e6 }, { t: 'R', a: 'VCC', b: 'GND', R: 10e3 },
    ],
    etat: () => ({ recu: '', transactions: 0, m: null, cfg: '', prochain: 0, niv: {} }),
    pas(c) {
      const s = c.s, cfg = c.p.frequence + '/' + c.p.mode;
      if (!s.m || s.cfg !== cfg) { s.m = new B.MaitreSPI({ frequence: c.p.frequence, mode: Number(c.p.mode) }); s.cfg = cfg; }
      if (!s.m.occupe && c.t >= s.prochain) { const o = octets(c.p.donnees); if (o.length) s.m.envoyer(o); s.prochain = c.t + c.p.periode; }
      const r = s.m.pas(c.t, lire(c, s, 'MISO'));
      piloter(c, 'sck', r.SCK); piloter(c, 'mosi', r.MOSI); piloter(c, 'cs', r.CS);
      if (r.fin) { s.recu = hex(r.fin); s.transactions++; }
    },
  },
  affichage: s => (s.recu ? '← ' + s.recu : ''),
});

FrWA.puce({
  id: 'sonde-spi', tags: ['bus', 'mesure'], nom: 'ESCLAVE SPI', prefixe: 'S', categorie: 'Bus série (essai)', version: '1.0.0', regles: 1,
  description: 'Esclave SPI : ne voit que SCK, MOSI et CS (FrWA.bus.EsclaveSPI), affiche les octets reçus et répond sur MISO (haute impédance quand CS est haut).',
  broches: ['VCC', 'GND', 'SCK', 'MOSI', 'MISO', 'CS'],
  typesBroches: { ...ALIM, entree: ['SCK', 'MOSI', 'CS'], trois_etats: ['MISO'] },
  cotes: { haut: ['VCC'], gauche: ['SCK', 'MOSI', 'MISO', 'CS'], bas: ['GND'] },
  largeur: 200, hauteur: 120,
  parametres: [...PARAM_SPI, { cle: 'reponse', nom: 'Réponse sur MISO (hex)', type: 'texte', defaut: '42 43 44' }],
  principal: 'mode',
  variables: [{ cle: 'recus', nom: 'Octets reçus', type: 'texte' }, { cle: 'nombre', nom: 'Nombre d\'octets', unite: '' }],
  modele3d: null,
  modele: {
    elements: [
      { t: 'R', a: 'SCK', b: 'GND', R: 1e6 }, { t: 'R', a: 'MOSI', b: 'GND', R: 1e6 }, { t: 'R', a: 'CS', b: 'VCC', R: 100e3 },
      { t: 'O', a: 'MISO', ref: 'GND', V: 0, R: 1e9, nom: 'miso' }, { t: 'R', a: 'VCC', b: 'GND', R: 10e3 },
    ],
    etat: () => ({ recus: '', nombre: 0, liste: [], e: null, cfg: '', niv: {}, lignes: [] }),
    pas(c) {
      const s = c.s;
      if (!s.e || s.cfg !== c.p.mode) { s.e = new B.EsclaveSPI({ mode: Number(c.p.mode) }); s.cfg = c.p.mode; }
      const n = { SCK: lire(c, s, 'SCK'), MOSI: lire(c, s, 'MOSI'), CS: lire(c, s, 'CS') };
      if (!n.CS && s.e.prec.CS) s.e.reponse = octets(c.p.reponse);          // nouvelle sélection : réponse rechargée
      const r = s.e.echantillonner(n);
      const vcc = c.v('VCC') - c.v('GND');
      c.regler('miso', r.actif ? { V: r.miso ? vcc : 0, R: 50 } : { V: 0, R: 1e9 });
      if (r.octet !== null) {
        s.liste.push(r.octet); s.nombre++;
        if (s.liste.length > 24) s.liste.shift();
        s.recus = hex(s.liste.slice(-8));
      }
      if (n.CS && s.liste.length && s.lignes[s.lignes.length - 1] !== s.recus) { s.lignes.push(s.recus); if (s.lignes.length > 6) s.lignes.shift(); }
    },
  },
  dessin(g, x) { ecran(g, x, ['MOSI →', ...(x.s.lignes || [])], '#5aa9ff'); },
  affichage: s => `${s.nombre ?? 0} octets`,
});

/* ---------------- I2C ---------------- */
FrWA.puce({
  id: 'gen-i2c', tags: ['bus', 'generateur'], nom: 'MAÎTRE I2C', prefixe: 'G', categorie: 'Bus série (essai)', version: '1.0.0', regles: 1,
  description: 'Maître I2C d\'essai : START, adresse 7 bits + R/W, octets MSB d\'abord, ACK au 9e coup d\'horloge, STOP (FrWA.bus.MaitreI2C). SDA et SCL en drain ouvert : il faut une résistance de rappel sur chaque ligne. Respecte l\'étirement d\'horloge.',
  broches: ['VCC', 'GND', 'SCL', 'SDA'],
  typesBroches: { ...ALIM, drain_ouvert: ['SCL', 'SDA'] },
  cotes: { haut: ['VCC'], droite: ['SCL', 'SDA'], bas: ['GND'] },
  parametres: [
    { cle: 'frequence', nom: 'Fréquence SCL', unite: 'Hz', defaut: 10e3, min: 100, max: 1e6, echelle: 'log' },
    { cle: 'adresse', nom: 'Adresse 7 bits (décimal)', unite: '', defaut: 80, min: 0, max: 127, echelle: 'lin', pas: 1 },
    { cle: 'operation', nom: 'Opération', type: 'choix', options: ['écriture', 'lecture'], defaut: 'écriture' },
    { cle: 'donnees', nom: 'Registre puis octets (hex)', type: 'texte', defaut: '00 12 34 56' },
    { cle: 'nLire', nom: 'Octets à lire', unite: '', defaut: 3, min: 1, max: 16, echelle: 'lin', pas: 1 },
    { cle: 'periode', nom: 'Période', unite: 's', defaut: 0.02, min: 1e-3, max: 10, echelle: 'log' },
  ],
  principal: 'operation',
  variables: [{ cle: 'resultat', nom: 'Dernière transaction', type: 'texte' }, { cle: 'nacks', nom: 'NACK reçus', unite: '' }],
  modele3d: null,
  modele: {
    elements: [{ t: 'O', a: 'SCL', ref: 'GND', V: 0, R: 1e9, nom: 'scl' }, { t: 'O', a: 'SDA', ref: 'GND', V: 0, R: 1e9, nom: 'sda' }, { t: 'R', a: 'VCC', b: 'GND', R: 10e3 }],
    etat: () => ({ resultat: '', nacks: 0, m: null, cfg: '', prochain: 0, niv: {} }),
    pas(c) {
      const s = c.s, p = c.p;
      if (!s.m || s.cfg !== String(p.frequence)) { s.m = new B.MaitreI2C({ frequence: p.frequence }); s.cfg = String(p.frequence); }
      if (!s.m.occupe && c.t >= s.prochain) {
        const o = octets(p.donnees);
        if (p.operation === 'écriture') s.m.ecrire(p.adresse, o);
        else { s.m.ecrire(p.adresse, o.slice(0, 1)); s.m.lire(p.adresse, p.nLire); }     // pointeur de registre, puis lecture
        s.prochain = c.t + p.periode;
      }
      const r = s.m.pas(c.t, { SCL: lire(c, s, 'SCL'), SDA: lire(c, s, 'SDA') });
      drain(c, 'scl', r.SCL); drain(c, 'sda', r.SDA);
      if (r.fin) {
        if (!r.fin.ok) s.nacks++;
        s.resultat = `${r.fin.rw ? 'lu' : 'écrit'} @${r.fin.adresse.toString(16)} ${r.fin.ok ? 'ACK' : 'NACK'}${r.fin.rw ? ' : ' + hex(r.fin.octets) : ''}`;
      }
    },
  },
  affichage: s => s.resultat || '',
});

FrWA.puce({
  id: 'memoire-i2c', tags: ['bus', 'module'], nom: 'MÉMOIRE I2C', prefixe: 'U', categorie: 'Bus série (essai)', version: '1.0.0', regles: 1,
  description: 'Esclave I2C à 16 registres (comme une petite EEPROM ou un capteur) : le 1er octet écrit fixe le registre, les suivants y sont écrits ; une lecture renvoie les registres à partir du pointeur. Ne lit que SCL et SDA (FrWA.bus.EsclaveI2C).',
  broches: ['VCC', 'GND', 'SCL', 'SDA'],
  typesBroches: { ...ALIM, entree: ['SCL'], drain_ouvert: ['SDA'] },
  cotes: { haut: ['VCC'], gauche: ['SCL', 'SDA'], bas: ['GND'] },
  largeur: 200, hauteur: 100,
  parametres: [
    { cle: 'adresse', nom: 'Adresse 7 bits (décimal)', unite: '', defaut: 80, min: 0, max: 127, echelle: 'lin', pas: 1 },
    { cle: 'contenu', nom: 'Contenu initial (hex)', type: 'texte', defaut: '10 20 30 40 50 60 70 80' },
  ],
  principal: 'adresse',
  variables: [{ cle: 'evenement', nom: 'Dernier événement', type: 'texte' }],
  modele3d: null,
  modele: {
    elements: [{ t: 'R', a: 'SCL', b: 'GND', R: 10e6 }, { t: 'O', a: 'SDA', ref: 'GND', V: 0, R: 1e9, nom: 'sda' }, { t: 'R', a: 'VCC', b: 'GND', R: 10e3 }],
    etat: p => {
      const m = new Array(16).fill(0); octets(p.contenu ?? '').slice(0, 16).forEach((v, i) => { m[i] = v; });
      return { evenement: '', e: null, adr: null, memoire: m, niv: {} };
    },
    pas(c) {
      const s = c.s;
      if (!s.e || s.adr !== c.p.adresse) { s.e = new B.EsclaveI2C({ adresse: c.p.adresse, memoire: s.memoire }); s.adr = c.p.adresse; }
      const r = s.e.echantillonner({ SCL: lire(c, s, 'SCL'), SDA: lire(c, s, 'SDA') });
      drain(c, 'sda', r.SDA);
      if (r.evenement) s.evenement = r.evenement;
    },
  },
  dessin(g, x) {
    const m = x.s.memoire || [];
    ecran(g, x, [hex(m.slice(0, 8)), hex(m.slice(8, 16)), x.s.evenement || ''], '#ffcc00');
  },
  affichage: (s, p) => '@' + p.adresse.toString(16),
});
})();
