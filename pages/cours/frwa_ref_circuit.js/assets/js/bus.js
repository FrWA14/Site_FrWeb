/* frwa_flow-Circuit — bus.js
   Bibliothèque des SIGNAUX NUMÉRIQUES (règle R11 de docs/REGLES_COMPOSANTS.md), offerte aux puces par FrWA.bus.
   Les futurs microcontrôleurs et FPGA, et tous les modules (écran SPI, capteur I2C, module UART…), passent par elle :
     - un ÉMETTEUR calcule la forme exacte des impulsions (instants des fronts) d'après le protocole et le débit ;
       la puce recopie ces niveaux sur ses broches à chaque pas (c.regler) ;
     - un RÉCEPTEUR ne reçoit que les niveaux lus sur ses broches à chaque pas : il « voit » ce qu'un vrai circuit
       verrait (fronts ratés si le pas de temps est trop grand, erreur de trame si le débit ne correspond pas…).
   Tout est en unités SI : temps en s, fréquences en Hz, débits en bit/s. Aucune dépendance au reste du simulateur. */
'use strict';
(function (G) {

/* ---------- Niveaux logiques (R11.1) ---------- */
const FAMILLES = {
  cmos: { vil: 0.3, vih: 0.7, relatif: true },     // fractions de VDD (CD4000, 74HC, MCU 3,3 V / 5 V)
  ttl: { vil: 0.8, vih: 2.0, relatif: false },     // volts (74LS, 74HCT)
};
/** niveau lu avec hystérésis : reste à l'état précédent entre VIL et VIH */
function lireNiveau(v, vdd, precedent = false, famille = 'cmos') {
  const f = FAMILLES[famille] || FAMILLES.cmos;
  const bas = f.relatif ? f.vil * vdd : f.vil, haut = f.relatif ? f.vih * vdd : f.vih;
  return v >= haut ? true : v <= bas ? false : precedent;
}

/* ---------- UART (R11.2) : repos haut, bit de départ bas, données LSB d'abord, parité, 1 ou 2 bits d'arrêt ---------- */
function bitsUART(octet, o) {
  const d = []; for (let i = 0; i < o.bits; i++) d.push(((octet >> i) & 1) === 1);
  const l = [false, ...d];
  if (o.parite !== 'aucune') { const un = d.filter(Boolean).length; l.push(o.parite === 'paire' ? un % 2 === 1 : un % 2 === 0); }
  for (let i = 0; i < o.arret; i++) l.push(true);
  return l;
}
const OPTIONS_UART = { debit: 9600, bits: 8, parite: 'aucune', arret: 1 };
class EmetteurUART {
  constructor(o = {}) { this.o = { ...OPTIONS_UART, ...o }; this.file = []; this.trame = null; this.t0 = 0; this.envoyes = 0; }
  envoyer(octets) { for (const x of typeof octets === 'string' ? [...new TextEncoder().encode(octets)] : octets) this.file.push(x & 0xff); }
  get occupe() { return !!this.trame || this.file.length > 0; }
  /** niveau de la ligne TX à l'instant t (true = haut) */
  niveau(t) {
    const Tb = 1 / this.o.debit;
    for (;;) {
      if (!this.trame) { if (!this.file.length) return true; this.trame = bitsUART(this.file.shift(), this.o); this.t0 = t; }
      const k = Math.floor((t - this.t0) / Tb + 1e-9);
      if (k < this.trame.length) return this.trame[k];
      this.t0 += this.trame.length * Tb; this.trame = null; this.envoyes++;
      if (this.file.length) { this.trame = bitsUART(this.file.shift(), this.o); continue; }
      return true;
    }
  }
}
class RecepteurUART {
  constructor(o = {}) { this.o = { ...OPTIONS_UART, ...o }; this.prec = true; this.etat = 'repos'; this.erreurs = 0; }
  /** à appeler à chaque pas avec le niveau lu sur RX ; renvoie { octet, erreur } quand une trame est complète, sinon null */
  echantillonner(t, haut) {
    const Tb = 1 / this.o.debit, o = this.o;
    let r = null;
    if (this.etat === 'repos') {
      if (this.prec && !haut) { this.etat = 'trame'; this.tDepart = t; this.k = 0; this.bits = []; }
    } else {
      // échantillon au milieu de chaque bit (le départ est vérifié au milieu du bit 0)
      const total = 1 + o.bits + (o.parite !== 'aucune' ? 1 : 0) + o.arret;
      while (this.k < total && t >= this.tDepart + (this.k + 0.5) * Tb) { this.bits.push(haut); this.k++; }
      if (this.k >= total) {
        const b = this.bits; let octet = 0, erreur = '';
        if (b[0]) erreur = 'faux départ';
        for (let i = 0; i < o.bits; i++) if (b[1 + i]) octet |= 1 << i;
        if (o.parite !== 'aucune') { const un = b.slice(1, 1 + o.bits).filter(Boolean).length + (b[1 + o.bits] ? 1 : 0); if ((un % 2 === 0) !== (o.parite === 'paire')) erreur = erreur || 'parité'; }
        if (b.slice(total - o.arret).some(x => !x)) erreur = erreur || 'trame (bit d\'arrêt bas)';
        if (erreur) this.erreurs++;
        r = erreur === 'faux départ' ? null : { octet, erreur };
        this.etat = 'repos';
      }
    }
    this.prec = haut;
    return r;
  }
}

/* ---------- SPI (R11.3) : SCK, MOSI, MISO, CS actif bas ; modes 0 à 3 (CPOL, CPHA) ; MSB d'abord par défaut ---------- */
const OPTIONS_SPI = { frequence: 100e3, mode: 0, bits: 8, msbDabord: true };
const bitDe = (octet, i, n, msb) => ((octet >> (msb ? n - 1 - i : i)) & 1) === 1;
class MaitreSPI {
  constructor(o = {}) { this.o = { ...OPTIONS_SPI, ...o }; this.file = []; this.tr = null; this.recus = []; }
  /** une transaction = CS bas pendant tous les octets */
  envoyer(octets) { this.file.push([...octets].map(x => x & 0xff)); }
  get occupe() { return !!this.tr || this.file.length > 0; }
  /** niveaux des sorties à l'instant t : { SCK, MOSI, CS } ; misoHaut = niveau lu sur MISO (échantillonné aux bons fronts) */
  pas(t, misoHaut) {
    const o = this.o, cpol = o.mode >= 2, cpha = o.mode % 2 === 1, Th = 1 / (2 * o.frequence);
    if (!this.tr && this.file.length) { const oct = this.file.shift(); this.tr = { oct, t0: t, n: oct.length * o.bits, lus: [], k: 0 }; }
    const tr = this.tr;
    if (!tr) return { SCK: cpol, MOSI: false, CS: true, fin: null };
    const u = (t - tr.t0) / Th;               // en demi-périodes depuis la chute de CS
    // échantillonnage de MISO : fronts « avant » (CPHA 0) ou « arrière » (CPHA 1)
    while (tr.k < tr.n && u >= (cpha ? 2 * tr.k + 2 : 2 * tr.k + 1) - 1e-9) { tr.lus.push(misoHaut); tr.k++; }
    if (u >= 2 * tr.n + 2) {                  // fin : CS remonte une demi-période après le dernier front
      const octets = [];
      for (let j = 0; j < tr.oct.length; j++) { let v = 0; for (let i = 0; i < o.bits; i++) if (tr.lus[j * o.bits + i]) v |= 1 << (o.msbDabord ? o.bits - 1 - i : i); octets.push(v); }
      this.recus.push(...octets); this.tr = null;
      return { SCK: cpol, MOSI: false, CS: true, fin: octets };
    }
    if (u >= 2 * tr.n + 1) return { SCK: cpol, MOSI: false, CS: true, fin: null };
    const front = Math.floor(u + 1e-9);       // nombre de fronts d'horloge déjà passés
    const SCK = front >= 1 && front <= 2 * tr.n ? (front % 2 === 1) !== cpol : cpol;
    const j = cpha ? Math.max(0, Math.floor((front - 1) / 2)) : Math.floor(front / 2);
    const b = Math.min(j, tr.n - 1);
    const MOSI = bitDe(tr.oct[Math.floor(b / o.bits)], b % o.bits, o.bits, o.msbDabord);
    return { SCK, MOSI, CS: false, fin: null };
  }
}
class EsclaveSPI {
  constructor(o = {}) { this.o = { ...OPTIONS_SPI, ...o }; this.prec = { SCK: null, CS: true }; this.k = 0; this.v = 0; this.reponse = []; this.sortant = 0; this.miso = false; }
  /** niveaux lus : { SCK, MOSI, CS } ; renvoie { octet (reçu ou null), miso (niveau à imposer), actif } */
  echantillonner(n) {
    const o = this.o, cpol = o.mode >= 2, cpha = o.mode % 2 === 1;
    let octet = null;
    const p = this.prec;
    if (p.SCK === null) p.SCK = n.SCK;
    if (p.CS && !n.CS) { this.k = 0; this.v = 0; this.kSortant = undefined; this.charger(); if (!cpha) this.miso = this.bitSortant(); }   // sélection
    if (!n.CS && n.SCK !== p.SCK) {
      const avant = n.SCK !== cpol;          // front qui quitte le repos = front « avant »
      const echantillon = cpha ? !avant : avant;
      if (echantillon) {
        this.v = (this.v << 1 | (n.MOSI ? 1 : 0)) & 0xffff; this.k++;
        if (this.k === o.bits) { octet = o.msbDabord ? this.v & 0xff : renverser(this.v, o.bits); this.k = 0; this.v = 0; this.charger(); }
      } else this.miso = this.bitSortant();
    }
    this.prec = { SCK: n.SCK, CS: n.CS };
    return { octet, miso: n.CS ? false : this.miso, actif: !n.CS };
  }
  charger() { if (this.kSortant === undefined || this.kSortant >= this.o.bits) { this.sortant = this.reponse.length ? this.reponse.shift() : 0xff; this.kSortant = 0; } }
  bitSortant() { const b = bitDe(this.sortant, this.kSortant ?? 0, this.o.bits, this.o.msbDabord); this.kSortant = (this.kSortant ?? 0) + 1; return b; }
}
function renverser(v, n) { let r = 0; for (let i = 0; i < n; i++) if (v & (1 << i)) r |= 1 << (n - 1 - i); return r; }

/* ---------- I2C (R11.4) : SDA et SCL en drain ouvert (tirer = 0, relâcher = haute impédance, rappel externe) ----------
   Le maître découpe chaque bit en 4 quarts de période ; s'il relâche SCL mais lit SCL bas, il attend (étirement). */
const OPTIONS_I2C = { frequence: 100e3 };
class MaitreI2C {
  constructor(o = {}) { this.o = { ...OPTIONS_I2C, ...o }; this.file = []; this.seq = null; }
  ecrire(adresse, octets) { this.file.push({ adresse, rw: 0, octets: [...octets], n: 0 }); }
  lire(adresse, n) { this.file.push({ adresse, rw: 1, octets: [], n }); }
  get occupe() { return !!this.seq || this.file.length > 0; }
  construire(tr) {
    const s = [];   // segments : [scl relâché ?, sda relâché ?, action]
    s.push([true, true], [true, false], [false, false]);                       // START
    const octet = (v, lecture) => { for (let i = 7; i >= 0; i--) { const b = lecture ? true : ((v >> i) & 1) === 1; s.push([false, b], [true, b, lecture ? 'bit' : null], [true, b], [false, b]); } };
    const ack = (maitre, dernier) => { const sda = maitre ? dernier : true; s.push([false, sda], [true, sda, maitre ? null : 'ack'], [true, sda], [false, sda]); };
    octet((tr.adresse << 1) | tr.rw, false); ack(false);
    if (tr.rw === 0) for (const v of tr.octets) { octet(v, false); ack(false); }
    else for (let k = 0; k < tr.n; k++) { octet(0xff, true); ack(true, k === tr.n - 1); }   // NACK sur le dernier octet lu
    s.push([false, false], [true, false], [true, true]);                       // STOP
    return s;
  }
  /** niveaux lus { SCL, SDA } → commandes { SCL, SDA } (true = relâcher), et fin = { ok, acks, octets } en fin de transaction */
  pas(t, lu) {
    const Tq = 1 / (4 * this.o.frequence);
    if (!this.seq && this.file.length) { const tr = this.file.shift(); this.seq = { tr, s: this.construire(tr), i: 0, tSeg: t, acks: [], bits: [] }; }
    const q = this.seq;
    if (!q) return { SCL: true, SDA: true, fin: null };
    let seg = q.s[q.i];
    if (t - q.tSeg >= Tq - 1e-12) {
      // étirement d'horloge : SCL relâché mais encore bas → on attend l'esclave
      if (!(seg[0] && !lu.SCL)) {
        if (seg[2] === 'ack') q.acks.push(!lu.SDA);
        if (seg[2] === 'bit') q.bits.push(lu.SDA);
        q.i++; q.tSeg = t;
        if (q.i >= q.s.length) {
          const octets = []; for (let k = 0; k + 8 <= q.bits.length; k += 8) octets.push(q.bits.slice(k, k + 8).reduce((v, b) => v << 1 | (b ? 1 : 0), 0));
          this.seq = null;
          return { SCL: true, SDA: true, fin: { ok: q.acks.every(Boolean), acks: q.acks, octets, adresse: q.tr.adresse, rw: q.tr.rw } };
        }
        seg = q.s[q.i];
      }
    }
    return { SCL: seg[0], SDA: seg[1], fin: null };
  }
}
class EsclaveI2C {
  /** adresse 7 bits ; memoire : registres lus / écrits (1er octet écrit = pointeur de registre, comme une EEPROM ou un capteur) */
  constructor(o = {}) { this.adresse = o.adresse ?? 0x50; this.memoire = o.memoire || new Array(16).fill(0); this.ptr = 0; this.prec = { SCL: true, SDA: true }; this.etat = 'repos'; this.sda = true; this.journal = []; }
  /** niveaux lus { SCL, SDA } → { SDA (true = relâcher), evenement } */
  echantillonner(n) {
    const p = this.prec; let ev = null;
    if (p.SCL && n.SCL && p.SDA && !n.SDA) { this.etat = 'adresse'; this.k = 0; this.v = 0; this.sda = true; this.premier = true; ev = 'START'; }
    else if (p.SCL && n.SCL && !p.SDA && n.SDA) { if (this.etat !== 'repos') ev = 'STOP'; this.etat = 'repos'; this.sda = true; }
    else if (this.etat !== 'repos' && !p.SCL && n.SCL) {                 // front montant : lecture d'un bit
      if (this.etat === 'ack_maitre') { if (n.SDA) this.etat = 'attente'; else { this.etat = 'emission'; this.k = 0; this.octetSortant = this.memoire[this.ptr++ % this.memoire.length]; } }
      else if (this.etat === 'adresse' || this.etat === 'reception') { this.v = (this.v << 1 | (n.SDA ? 1 : 0)) & 0xff; this.k++; }
      else if (this.etat === 'emission') this.k++;
    } else if (this.etat !== 'repos' && p.SCL && !n.SCL) {               // front descendant : on change SDA
      if (this.etat === 'ack') { this.sda = true; this.etat = this.lecture ? 'emission' : 'reception'; this.k = 0; this.v = 0;
        if (this.lecture) this.octetSortant = this.memoire[this.ptr++ % this.memoire.length]; }
      if ((this.etat === 'adresse' || this.etat === 'reception') && this.k === 8) {
        if (this.etat === 'adresse') {
          const ok = (this.v >> 1) === this.adresse; this.lecture = (this.v & 1) === 1;
          ev = ok ? `adresse 0x${this.adresse.toString(16)} ${this.lecture ? 'lecture' : 'écriture'}` : null;
          if (ok) { this.sda = false; this.etat = 'ack'; } else { this.etat = 'repos'; this.sda = true; }
        } else {
          if (this.premier) { this.ptr = this.v % this.memoire.length; this.premier = false; ev = `registre ${this.ptr}`; }
          else { this.memoire[this.ptr % this.memoire.length] = this.v; ev = `écrit 0x${this.v.toString(16).padStart(2, '0')} → [${this.ptr % this.memoire.length}]`; this.ptr++; }
          this.journal.push(this.v); this.sda = false; this.etat = 'ack';
        }
      } else if (this.etat === 'emission') {
        if (this.k < 8) this.sda = ((this.octetSortant >> (7 - this.k)) & 1) === 1;
        else { this.sda = true; this.etat = 'ack_maitre'; }
      }
    }
    this.prec = { SCL: n.SCL, SDA: n.SDA };
    return { SDA: this.sda, evenement: ev };
  }
}

/* ---------- Impulsions (R11.5) : mesure de largeur et de période (PWM, servomoteurs, capteurs à sortie impulsionnelle) ---------- */
class MesureImpulsion {
  constructor() { this.prec = false; this.tMontee = null; this.largeur = null; this.periode = null; this.dernierFront = -Infinity; }
  echantillonner(t, haut) {
    if (haut && !this.prec) { if (this.tMontee !== null) this.periode = t - this.tMontee; this.tMontee = t; this.dernierFront = t; }
    if (!haut && this.prec && this.tMontee !== null) { this.largeur = t - this.tMontee; this.dernierFront = t; }
    this.prec = haut;
    return this.largeur;
  }
}
/** générateur PWM : niveau à l'instant t pour une fréquence et un rapport cyclique (0..1) */
const pwm = (t, frequence, rapport) => ((t * frequence) % 1) < rapport;

G.FrWA = G.FrWA || {};
G.FrWA.bus = { FAMILLES, lireNiveau, EmetteurUART, RecepteurUART, MaitreSPI, EsclaveSPI, MaitreI2C, EsclaveI2C, MesureImpulsion, pwm, OPTIONS_UART, OPTIONS_SPI, OPTIONS_I2C };
})(typeof window !== 'undefined' ? window : globalThis);
