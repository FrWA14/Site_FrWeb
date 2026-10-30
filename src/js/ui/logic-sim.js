/**
 * LogicSim - Petits simulateurs de circuits logiques (fiches de la série CD4000)
 *
 * Dans une page :
 *   <div data-lsim="nom-du-scenario" data-lsim-opts='{"cle": "valeur"}'></div>
 * Le simulateur est monté automatiquement à chaque chargement de page
 * (événement contentLoaded) et arrêté quand on quitte la page.
 *
 * Chaque scénario reçoit une instance (sim) qui fournit les commandes
 * (interrupteurs, boutons, curseurs, choix), les indicateurs (LED, afficheur
 * 7 segments, valeurs) et un oscilloscope (voies logiques ou analogiques).
 */

const LogicSim = {
    scenarios: {},
    active: [],

    init() {
        document.addEventListener('contentLoaded', () => this.mountAll());
    },

    mountAll() {
        // Arrête les simulateurs des pages quittées
        this.active = this.active.filter(sim => {
            if (document.body.contains(sim.root)) return true;
            sim.stop();
            return false;
        });

        document.querySelectorAll('[data-lsim]').forEach(el => {
            if (el._lsim) return;
            const build = this.scenarios[el.dataset.lsim];
            if (!build) {
                console.warn('LogicSim : scénario inconnu', el.dataset.lsim);
                return;
            }
            let opts = {};
            try {
                opts = JSON.parse(el.dataset.lsimOpts || '{}');
            } catch (e) {
                console.warn('LogicSim : options invalides', e);
            }
            const sim = new LogicSimInstance(el);
            el._lsim = sim;
            build(sim, opts);
            sim.start();
            this.active.push(sim);
        });

        // Brochages interactifs (défini plus bas)
        ChipLive.mountAll();
    }
};

/* ========================================================================
   Outils
   ======================================================================== */

const LS = {
    colors: ['#f7e36a', '#4ecdc4', '#e67e22', '#7bd88f', '#ff7eb6', '#78a9ff', '#c8d5d5', '#f39c12'],

    // Segments a..g (bit 0 = a)
    SEG: [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F, 0x77, 0x7C, 0x39, 0x5E, 0x79, 0x71],

    el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    },

    num(v, digits = 3) {
        return Number(v.toPrecision(digits)).toLocaleString('fr-FR');
    },

    freq(f) {
        if (!isFinite(f)) return '—';
        if (f >= 1e6) return this.num(f / 1e6) + ' MHz';
        if (f >= 1e3) return this.num(f / 1e3) + ' kHz';
        return this.num(f) + ' Hz';
    },

    time(t) {
        if (!isFinite(t)) return '—';
        if (t >= 1) return this.num(t) + ' s';
        if (t >= 1e-3) return this.num(t * 1e3) + ' ms';
        if (t >= 1e-6) return this.num(t * 1e6) + ' µs';
        return this.num(t * 1e9) + ' ns';
    },

    ohm(r) {
        if (r >= 1e6) return this.num(r / 1e6) + ' MΩ';
        if (r >= 1e3) return this.num(r / 1e3) + ' kΩ';
        return this.num(r) + ' Ω';
    },

    farad(c) {
        if (c >= 1e-6) return this.num(c * 1e6) + ' µF';
        if (c >= 1e-9) return this.num(c * 1e9) + ' nF';
        return this.num(c * 1e12) + ' pF';
    },

    // Formes d'onde analogiques (0..1), période 1
    wave: {
        sine: x => 0.5 + 0.5 * Math.sin(2 * Math.PI * x),
        tri: x => { const p = x - Math.floor(x); return p < 0.5 ? 2 * p : 2 - 2 * p; },
        square: x => ((x - Math.floor(x)) < 0.5 ? 1 : 0),
        saw: x => x - Math.floor(x)
    },

    sq(x) {
        return (x - Math.floor(x)) < 0.5 ? 1 : 0;
    },

    // État d'une LED sur un signal de fréquence f : visible jusqu'à 8 Hz,
    // scintillement jusqu'à 100 Hz, puis allumée en continu (persistance rétinienne)
    blink(f, level) {
        if (f <= 8) return level ? 1 : 0;
        return f <= 100 ? 'fast' : 1;
    },

    // Schéma : entrée pilotée par un interrupteur du panneau de commandes
    pin(o, name) {
        return o.pinmap ? o.pinmap[name] : undefined;
    }
};

/* ========================================================================
   Instance de simulateur
   ======================================================================== */

class LogicSimInstance {
    constructor(root) {
        this.root = root;
        root.classList.add('lsim');
        root.innerHTML = `
            <div class="lsim-grid">
                <div class="card lsim-controls">
                    <div class="card-header"><h3 class="card-title">Commandes</h3></div>
                    <div class="card-body"></div>
                </div>
                <div class="lsim-right">
                    <div class="card">
                        <div class="card-header"><h3 class="card-title">Montage</h3></div>
                        <div class="card-body lsim-board"></div>
                    </div>
                    <div class="card lsim-scope-card">
                        <div class="card-header lsim-scope-header">
                            <h3 class="card-title">Oscilloscope</h3>
                            <span class="lsim-scope-info"></span>
                            <button type="button" class="lsim-pause" title="Figer l'affichage">⏸</button>
                        </div>
                        <div class="card-body"><canvas class="lsim-scope"></canvas></div>
                    </div>
                </div>
            </div>`;
        this.controls = root.querySelector('.lsim-controls .card-body');
        this.board = root.querySelector('.lsim-board');
        this.canvas = root.querySelector('.lsim-scope');
        this.ctx = this.canvas.getContext('2d');
        this.scopeInfo = root.querySelector('.lsim-scope-info');
        this.pauseBtn = root.querySelector('.lsim-pause');
        this.pauseBtn.addEventListener('click', () => {
            this.paused = !this.paused;
            this.pauseBtn.textContent = this.paused ? '▶' : '⏸';
            this.pauseBtn.title = this.paused ? 'Reprendre' : "Figer l'affichage";
        });

        this.t = 0;          // temps simulé (s)
        this.tReal = 0;      // temps réel écoulé (s)
        this.timeScale = 1;  // secondes simulées par seconde réelle
        this.substeps = 1;
        this.steppers = [];
        this.renderers = [];
        this.clocks = [];
        this.scopeCfg = null;
        this.paused = false;
    }

    /* ----- Boucle ----- */

    start() {
        this.last = performance.now();
        const loop = now => {
            if (this.stopped) return;
            const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
            this.last = now;
            this.tick(dt);
            this.raf = requestAnimationFrame(loop);
        };
        this.raf = requestAnimationFrame(loop);
        this.onResize = () => this.resizeCanvas();
        window.addEventListener('resize', this.onResize);
        this.resizeCanvas();
    }

    stop() {
        this.stopped = true;
        cancelAnimationFrame(this.raf);
        window.removeEventListener('resize', this.onResize);
    }

    tick(dtReal) {
        if (!this.paused) {
            this.tReal += dtReal;
            const n = this.substeps;
            const dt = dtReal * this.timeScale / n;
            for (let i = 0; i < n; i++) {
                this.t += dt;
                this.clocks.forEach(c => c.step(dt));
                this.steppers.forEach(fn => fn(dt, this.t));
                this.sample(dt);
            }
        }
        this.renderers.forEach(fn => fn());
        this.drawScope();
    }

    onStep(fn) { this.steppers.push(fn); }
    onRender(fn) { this.renderers.push(fn); }

    /* ----- Commandes ----- */

    section(title) {
        const s = LS.el('div', 'lsim-section');
        if (title) s.append(LS.el('div', 'lsim-section-title', title));
        this.controls.append(s);
        return s;
    }

    group(parent) {
        const g = LS.el('div', 'lsim-toggles');
        parent.append(g);
        return g;
    }

    toggle(parent, label, value, onChange) {
        const b = LS.el('button', 'lsim-toggle');
        b.type = 'button';
        const obj = {
            value: !!value,
            el: b,
            disabled: false,
            set(v) { obj.value = !!v; render(); },
            setDisabled(d) { obj.disabled = d; b.disabled = d; }
        };
        const render = () => {
            b.classList.toggle('on', obj.value);
            b.setAttribute('aria-pressed', obj.value);
            b.innerHTML = `<span class="lsim-toggle-name">${label}</span><span class="lsim-toggle-state">${obj.value ? 1 : 0}</span>`;
        };
        b.addEventListener('click', () => {
            obj.value = !obj.value;
            render();
            if (onChange) onChange(obj.value);
        });
        render();
        parent.append(b);
        return obj;
    }

    button(parent, label, onPress) {
        const b = LS.el('button', 'btn btn-secondary btn-sm lsim-btn', label);
        b.type = 'button';
        b.addEventListener('click', onPress);
        parent.append(b);
        return b;
    }

    slider(parent, label, o) {
        const f = LS.el('div', 'lsim-field');
        const head = LS.el('div', 'lsim-label');
        const name = LS.el('span', '', label);
        const val = LS.el('span', 'lsim-value');
        head.append(name, val);
        const input = LS.el('input');
        input.type = 'range';
        const steps = 1000;
        const obj = { value: o.value };
        if (o.log) {
            input.min = 0; input.max = steps; input.step = 1;
            const lmin = Math.log(o.min), lmax = Math.log(o.max);
            input.value = Math.round((Math.log(o.value) - lmin) / (lmax - lmin) * steps);
            obj.read = () => {
                const raw = Math.exp(lmin + (lmax - lmin) * input.value / steps);
                return o.round ? o.round(raw) : raw;
            };
        } else {
            input.min = o.min; input.max = o.max; input.step = o.step || 'any';
            input.value = o.value;
            obj.read = () => parseFloat(input.value);
        }
        const fmt = o.format || (v => LS.num(v));
        const update = () => {
            obj.value = obj.read();
            val.textContent = fmt(obj.value);
            if (o.onChange) o.onChange(obj.value);
        };
        input.addEventListener('input', update);
        obj.value = obj.read();
        val.textContent = fmt(obj.value);
        f.append(head, input);
        parent.append(f);
        return obj;
    }

    choice(parent, label, options, value, onChange) {
        const f = LS.el('div', 'lsim-field');
        if (label) f.append(LS.el('div', 'lsim-label', `<span>${label}</span>`));
        const wrap = LS.el('div', 'lsim-choice');
        const obj = { value };
        const buttons = options.map(opt => {
            const b = LS.el('button', '', opt.label);
            b.type = 'button';
            b.addEventListener('click', () => {
                obj.value = opt.value;
                buttons.forEach(x => x.classList.toggle('active', x === b));
                if (onChange) onChange(obj.value);
            });
            if (opt.value === value) b.classList.add('active');
            wrap.append(b);
            return b;
        });
        f.append(wrap);
        parent.append(f);
        return obj;
    }

    note(parent, html) {
        const p = LS.el('p', 'lsim-note', html);
        parent.append(p);
        return p;
    }

    /* Horloge : auto (fréquence réglable) ou impulsions manuelles */
    clock(parent, o = {}) {
        const sec = parent || this.section('Horloge');
        const clk = {
            level: 0,
            phase: 0,
            pulse: 0,
            rise: [],
            fall: [],
            onRise(fn) { clk.rise.push(fn); },
            onFall(fn) { clk.fall.push(fn); }
        };
        const g = this.group(sec);
        clk.auto = this.toggle(g, 'Horloge automatique', o.auto !== false);
        clk.freq = this.slider(sec, 'Fréquence', {
            min: o.min || 0.2, max: o.max || 10, step: 0.1, value: o.freq || 1,
            format: v => LS.num(v, 2) + ' Hz'
        });
        this.button(sec, 'Impulsion manuelle ⎍', () => {
            clk.auto.set(false);
            clk.pulse = 0.25;
        });
        clk.step = dt => {
            let lvl;
            if (clk.auto.value) {
                clk.phase += dt * clk.freq.value;
                clk.phase -= Math.floor(clk.phase);
                lvl = clk.phase < 0.5 ? 1 : 0;
            } else {
                clk.pulse = Math.max(0, clk.pulse - dt);
                lvl = clk.pulse > 0 ? 1 : 0;
            }
            if (lvl !== clk.level) {
                clk.level = lvl;
                (lvl ? clk.rise : clk.fall).forEach(fn => fn());
            }
        };
        this.clocks.push(clk);
        return clk;
    }

    /* ----- Indicateurs ----- */

    boardRow(title) {
        const row = LS.el('div', 'lsim-board-row');
        if (title) row.append(LS.el('div', 'lsim-board-title', title));
        this.board.append(row);
        return row;
    }

    leds(parent, labels, color) {
        const wrap = LS.el('div', 'lsim-leds');
        const items = labels.map(l => {
            const it = LS.el('div', 'lsim-led-item');
            const led = LS.el('span', 'lsim-led' + (color ? ' lsim-led-' + color : ''));
            it.append(led, LS.el('span', 'lsim-led-label', l));
            wrap.append(it);
            return led;
        });
        parent.append(wrap);
        return {
            items,
            set(i, on, fast) {
                items[i].classList.toggle('on', !!on);
                items[i].classList.toggle('fast', !!fast);
            }
        };
    }

    seg7(parent, digits = 1) {
        const wrap = LS.el('div', 'lsim-seg7');
        const segPaths = [
            'M14 6 h32 l-5 6 h-22 z',          // a
            'M48 8 l-6 6 v22 l6 4 z',          // b
            'M48 44 l-6 4 v22 l6 6 z',         // c
            'M14 78 h32 l-5 -6 h-22 z',        // d
            'M12 44 l6 4 v22 l-6 6 z',         // e
            'M12 8 l6 6 v22 l-6 4 z',          // f
            'M15 42 l5 -4 h20 l5 4 l-5 4 h-20 z' // g
        ];
        const digitEls = [];
        for (let d = 0; d < digits; d++) {
            const svg = `<svg viewBox="0 0 60 84" class="lsim-seg7-digit">${segPaths.map((p, i) => `<path d="${p}" data-s="${i}"/>`).join('')}</svg>`;
            const holder = LS.el('div', '', svg);
            wrap.append(holder);
            digitEls.push(Array.from(holder.querySelectorAll('path')));
        }
        parent.append(wrap);
        return {
            set(d, mask) {
                digitEls[d].forEach((p, i) => p.classList.toggle('on', !!(mask & (1 << i))));
            }
        };
    }

    readout(parent, label) {
        const r = LS.el('div', 'lsim-readout');
        const v = LS.el('span', 'lsim-readout-value');
        r.append(LS.el('span', 'lsim-readout-label', label), v);
        parent.append(r);
        let last = null;
        return {
            set(html) {
                if (html !== last) { v.innerHTML = html; last = html; }
            }
        };
    }

    cells(parent, labels, marked = []) {
        const wrap = LS.el('div', 'lsim-cells');
        const items = labels.map((l, i) => {
            const c = LS.el('div', 'lsim-cell' + (marked.includes(i) ? ' marked' : ''));
            const v = LS.el('span', 'lsim-cell-v', '0');
            c.append(v, LS.el('span', 'lsim-cell-l', l));
            wrap.append(c);
            return { c, v };
        });
        parent.append(wrap);
        return {
            set(i, on) {
                items[i].c.classList.toggle('on', !!on);
                items[i].v.textContent = on ? '1' : '0';
            }
        };
    }

    /* ----- Schéma de câblage ----- */

    /**
     * Dessine la puce câblée : alimentation (VDD en haut, VSS en bas),
     * entrées à gauche, sorties à droite. Mis à jour à chaque image.
     * cfg = {
     *   chip: 'CD4011', vdd: 14, vss: 7, inner: 'NAND', title,
     *   left:  [{ pin, label, kind, get, click, text }],
     *     kind : 'in' (boule jaune = 1 / noire = 0), 'clk' (horloge), 'fixed' (relié à un
     *            potentiel, text = '0 V'), 'sig' (signal analogique, get() = voie active),
     *            'part' (composant, text()), 'xtal' (quartz entre cette broche et la suivante), 'nc'
     *   right: [{ pin, label, kind, get, text }],
     *     kind : 'led' (défaut, get() = 0 / 1 / 'fast'), 'seg' (segment vers l'afficheur),
     *            'probe' (valeur affichée, text()), 'nc'
     *   display: () => masque des segments (si des sorties 'seg')
     * }
     * Les noms commençant par « ~ » sont surlignés (actifs à l'état bas).
     */
    schematic(cfg) {
        const row = this.boardRow(cfg.title || 'Schéma de câblage');
        row.classList.add('lsim-schem-row');
        const L = cfg.left || [], R = cfg.right || [];
        const n = Math.max(L.length, R.length, 2);
        const P = 26, X0 = 170, X1 = 360, XM = (X0 + X1) / 2, TOP = 48;
        const BOT = TOP + n * P + 16, H = BOT + 44;
        let W = 540;
        const ys = list => list.map((_, i) => TOP + 8 + P / 2 + (i + (n - list.length) / 2) * P);
        const yl = ys(L), yr = ys(R);
        const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const lbl = s => (String(s).startsWith('~')
            ? `<tspan text-decoration="overline">${esc(String(s).slice(1))}</tspan>`
            : esc(s).replace(/\/~(.+)$/, '/<tspan text-decoration="overline">$1</tspan>'));
        const LOW = '#3d7a7a', MUT = '#6a7a7a', TXT = '#e8f0f0';
        const gnd = (x, y) => `<path d="M${x} ${y}v6M${x - 7} ${y + 6}h14M${x - 4.5} ${y + 9}h9M${x - 2} ${y + 12}h4" stroke="${MUT}" stroke-width="1.4" fill="none"/>`;
        const s = [];
        let k = 0;
        const items = [];

        // Alimentation
        s.push(`<path d="M${XM} ${TOP}V${TOP - 24}M${XM - 12} ${TOP - 24}h24" stroke="#e67e22" stroke-width="1.8"/>`);
        s.push(`<text x="${XM + 16}" y="${TOP - 20}" font-size="11" fill="#e67e22">${esc(cfg.vddLabel || '+5 V')} (VDD)</text>`);
        s.push(`<text x="${XM - 5}" y="${TOP - 6}" font-size="9" text-anchor="end" fill="${MUT}">${cfg.vdd || ''}</text>`);
        s.push(`<path d="M${XM} ${BOT}V${BOT + 14}" stroke="${MUT}" stroke-width="1.8"/>${gnd(XM, BOT + 14)}`);
        s.push(`<text x="${XM + 16}" y="${BOT + 24}" font-size="11" fill="${MUT}">0 V (VSS)</text>`);
        s.push(`<text x="${XM - 5}" y="${BOT + 11}" font-size="9" text-anchor="end" fill="${MUT}">${cfg.vss || ''}</text>`);
        // Boîtier
        s.push(`<rect x="${X0}" y="${TOP}" width="${X1 - X0}" height="${BOT - TOP}" rx="6" fill="#121a1a" stroke="#3d7a7a" stroke-width="2"/>`);
        const midY = (TOP + BOT) / 2;
        s.push(`<text x="${XM}" y="${midY + 4}" text-anchor="middle" font-size="13" font-weight="bold" fill="#4ecdc4">${esc(cfg.chip || '')}</text>`);
        if (cfg.inner) s.push(`<text x="${XM}" y="${TOP + 13}" text-anchor="middle" font-size="9.5" fill="${MUT}">${esc(cfg.inner)}</text>`);

        // Entrées (gauche)
        L.forEach((it, i) => {
            const y = yl[i], id = k++;
            const kind = it.kind || 'in';
            items.push({ it, id, kind, side: 'L' });
            if (kind === 'xtal-end') {
                s.push(`<polyline data-w="${id}" points="${X0},${y} 96,${y} 96,${(yl[i - 1] + y) / 2 + (L[i - 1].cap ? 3 : 9)}" fill="none" stroke="${LOW}" stroke-width="1.6"/>`);
            } else if (kind === 'xtal') {
                const y2 = yl[i + 1], m = (y + y2) / 2;
                s.push(`<polyline data-w="${id}" points="${X0},${y} 96,${y} 96,${m - (it.cap ? 3 : 9)}" fill="none" stroke="${LOW}" stroke-width="1.6"/>`);
                s.push(`<path d="M86 ${m - (it.cap ? 3 : 9)}h20M86 ${m + (it.cap ? 3 : 9)}h20" stroke="${TXT}" stroke-width="1.6"/>${it.cap ? '' : `<rect x="90" y="${m - 5}" width="12" height="10" fill="#1a2424" stroke="${TXT}" stroke-width="1.4"/>`}`);
                s.push(`<text data-t="${id}" x="80" y="${m + 4}" text-anchor="end" font-size="10" fill="${TXT}"></text>`);
            } else if (kind === 'nc') {
                s.push(`<path d="M${X0 - 22} ${y}H${X0}" stroke="${LOW}" stroke-width="1.6"/>`);
            } else {
                const x0 = kind === 'part' ? 60 : 66;
                s.push(`<path data-w="${id}" d="M${x0} ${y}H${X0}" stroke="${LOW}" stroke-width="1.6"/>`);
                if (kind === 'in' || kind === 'clk') {
                    s.push(`<g data-b="${id}"${it.click ? ' class="lsim-sch-click" tabindex="0" role="button"' : ''}>` +
                        `<circle cx="58" cy="${y}" r="8.5" stroke="${MUT}" stroke-width="1.2"/>` +
                        `<text x="58" y="${y + 3.5}" text-anchor="middle" font-size="9.5" font-weight="bold"></text></g>`);
                    if (kind === 'clk') s.push(`<path d="M14 ${y + 5}h5v-10h6v10h6v-10h5" stroke="#4ecdc4" stroke-width="1.4" fill="none"/>`);
                } else if (kind === 'fixed') {
                    s.push(`<text data-t="${id}" x="62" y="${y + 4}" text-anchor="end" font-size="10" fill="${MUT}"></text>`);
                } else if (kind === 'sig') {
                    s.push(`<path d="M30 ${y}c4-12 8-12 12 0s8 12 12 0" stroke="#4ecdc4" stroke-width="1.4" fill="none"/>`);
                    s.push(`<text data-t="${id}" x="72" y="${y - 4}" font-size="9" fill="${MUT}"></text>`);
                } else if (kind === 'part') {
                    s.push(`<rect x="90" y="${y - 5}" width="28" height="10" fill="#1a2424" stroke="${TXT}" stroke-width="1.4"/>`);
                    s.push(`<text data-t="${id}" x="54" y="${y + 4}" text-anchor="end" font-size="10" fill="${TXT}"></text>`);
                }
            }
            if (it.pin) s.push(`<text x="${X0 - 5}" y="${y - 4}" text-anchor="end" font-size="9" fill="${MUT}">${it.pin}</text>`);
            s.push(`<text data-l="${id}" x="${X0 + 6}" y="${y + 4}" font-size="11" fill="${TXT}">${lbl(typeof it.label === 'function' ? it.label() : it.label)}</text>`);
        });

        // Sorties (droite)
        const segRows = [];
        R.forEach((it, i) => {
            const y = yr[i], id = k++;
            const kind = it.kind || 'led';
            items.push({ it, id, kind, side: 'R' });
            if (kind === 'nc') {
                s.push(`<path d="M${X1} ${y}h22" stroke="${LOW}" stroke-width="1.6"/>`);
            } else if (kind === 'probe') {
                s.push(`<path data-w="${id}" d="M${X1} ${y}H${X1 + 40}" stroke="${LOW}" stroke-width="1.6"/>`);
                s.push(`<circle cx="${X1 + 42}" cy="${y}" r="2.5" fill="${TXT}"/>`);
                s.push(`<text data-t="${id}" x="${X1 + 50}" y="${y + 4}" font-size="11" fill="${TXT}"></text>`);
            } else {
                // résistance série
                s.push(`<path data-w="${id}" d="M${X1} ${y}H392M418 ${y}H${kind === 'seg' ? 450 : 434}" stroke="${LOW}" stroke-width="1.6"/>`);
                s.push(`<rect x="392" y="${y - 4.5}" width="26" height="9" fill="#1a2424" stroke="${TXT}" stroke-width="1.2"/>`);
                if (kind === 'seg') segRows.push(y);
                else {
                    s.push(`<circle data-g="${id}" cx="442" cy="${y}" r="10" fill="#ff3b3b" opacity="0"/>`);
                    s.push(`<path data-d="${id}" d="M434 ${y - 6}V${y + 6}L448 ${y}Z" fill="#3a1212" stroke="#ff6b6b" stroke-width="1"/>`);
                    s.push(`<path d="M448 ${y - 6}V${y + 6}M448 ${y}H464" stroke="#ff6b6b" stroke-width="1.4"/>${gnd(464, y)}`);
                }
            }
            if (it.pin) s.push(`<text x="${X1 + 5}" y="${y - 4}" font-size="9" fill="${MUT}">${it.pin}</text>`);
            s.push(`<text data-l="${id}" x="${X1 - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="${TXT}">${lbl(typeof it.label === 'function' ? it.label() : it.label)}</text>`);
        });
        if (segRows.length) {
            const y0 = segRows[0] - 14, y1 = segRows[segRows.length - 1] + 14;
            const segPaths = ['M14 6 h32 l-5 6 h-22 z', 'M48 8 l-6 6 v22 l6 4 z', 'M48 44 l-6 4 v22 l6 6 z',
                'M14 78 h32 l-5 -6 h-22 z', 'M12 44 l6 4 v22 l-6 6 z', 'M12 8 l6 6 v22 l-6 4 z', 'M15 42 l5 -4 h20 l5 4 l-5 4 h-20 z'];
            const dh = Math.min(y1 - y0 - 16, 110), dw = dh * 60 / 84;
            s.push(`<rect x="450" y="${y0}" width="${dw + 24}" height="${y1 - y0}" rx="4" fill="#0b0d0d" stroke="#3d7a7a"/>`);
            W = Math.max(W, 450 + dw + 34);
            s.push(`<svg x="462" y="${(y0 + y1) / 2 - dh / 2}" width="${dw}" height="${dh}" viewBox="0 0 60 84">` +
                segPaths.map((p, i) => `<path data-seg="${i}" d="${p}" fill="#2a0d0d"/>`).join('') + '</svg>');
            s.push(`<path d="M${450 + (dw + 24) / 2} ${y1}v10" stroke="${MUT}" stroke-width="1.4"/>${gnd(450 + (dw + 24) / 2, y1 + 10)}`);
        }

        const box = LS.el('div', 'lsim-schem');
        box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" font-family="DejaVu Sans Mono, Consolas, monospace" role="img" aria-label="Schéma de câblage de ${esc(cfg.chip || 'la puce')}">${s.join('')}</svg>`;
        row.append(box);
        const svg = box.firstChild;
        // Le schéma passe en tête du montage
        this.board.prepend(row);

        const q = (a, id) => svg.querySelector(`[data-${a}="${id}"]`);
        items.forEach(e => {
            e.w = q('w', e.id); e.b = q('b', e.id); e.t = q('t', e.id); e.l = q('l', e.id);
            e.g = q('g', e.id); e.d = q('d', e.id);
            e.last = {};
            if (e.b && e.it.click) {
                const fire = () => e.it.click();
                e.b.addEventListener('click', fire);
                e.b.addEventListener('keydown', ev => {
                    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fire(); }
                });
            }
        });
        const segs = Array.from(svg.querySelectorAll('[data-seg]'));
        const set = (e, key, val, fn) => { if (e.last[key] !== val) { e.last[key] = val; fn(val); } };

        this.onRender(() => {
            items.forEach(e => {
                const it = e.it;
                if (typeof it.label === 'function' && e.l) set(e, 'l', it.label(), v => { e.l.innerHTML = lbl(v); });
                if (e.t) set(e, 't', it.text ? (typeof it.text === 'function' ? it.text() : it.text) : '', v => { e.t.textContent = v; });
                if (!it.get) return;
                const raw = it.get();
                if (e.kind === 'sig') {
                    set(e, 'v', !!raw, v => { if (e.w) e.w.setAttribute('stroke', v ? '#e67e22' : LOW); });
                    return;
                }
                const fast = raw === 'fast';
                const v = fast || !!raw;
                set(e, 'v', v + (fast ? 'f' : ''), () => {
                    if (e.w) e.w.setAttribute('stroke', v ? '#f7e36a' : LOW);
                    if (e.b) {
                        e.b.querySelector('circle').setAttribute('fill', v ? '#f7e36a' : '#0b0d0d');
                        const tx = e.b.querySelector('text');
                        tx.textContent = v ? '1' : '0';
                        tx.setAttribute('fill', v ? '#0a0f0f' : '#a8b5b5');
                    }
                    if (e.g) {
                        e.g.setAttribute('opacity', v ? (fast ? 0.35 : 0.45) : 0);
                        e.g.classList.toggle('lsim-sch-flicker', fast);
                        e.d.setAttribute('fill', v ? '#ff3b3b' : '#3a1212');
                    }
                });
            });
            if (segs.length && cfg.display) {
                const m = cfg.display();
                segs.forEach((p, i) => {
                    const on = !!(m & (1 << i));
                    if (p._on !== on) { p._on = on; p.setAttribute('fill', on ? '#ff3b3b' : '#2a0d0d'); }
                });
            }
        });
        return svg;
    }

    /* ----- Oscilloscope ----- */

    /**
     * cfg = {
     *   mode: 'lanes' (voies empilées) | 'overlay' (courbes superposées),
     *   traces: [{ label, get() | fn(t), kind: 'digital'|'analog', min, max, color }],
     *   window: secondes simulées affichées (nombre ou fonction),
     *   analytic: true → les traces sont des fonctions fn(t) tracées sur [t0 - window, t0],
     *   t0(): fin de la fenêtre (mode analytique),
     *   min, max, unit, guides: [{ v, label }] (mode overlay),
     *   info(): texte affiché dans l'en-tête
     * }
     */
    scope(cfg) {
        this.scopeCfg = cfg;
        cfg.traces.forEach((tr, i) => {
            tr.color = tr.color || LS.colors[i % LS.colors.length];
            tr.kind = tr.kind || (cfg.mode === 'overlay' ? 'analog' : 'digital');
        });
        this.N = 600;
        this.resetScope();
        this.resizeCanvas();
    }

    resetScope() {
        const cfg = this.scopeCfg;
        if (!cfg || cfg.analytic) return;
        this.buf = cfg.traces.map(() => []);
        this.acc = 0;
        this.lastWindow = this.windowLength();
    }

    windowLength() {
        const w = this.scopeCfg.window;
        return typeof w === 'function' ? w() : (w || 8);
    }

    sample(dt) {
        const cfg = this.scopeCfg;
        if (!cfg || cfg.analytic) return;
        const win = this.windowLength();
        if (Math.abs(win - this.lastWindow) > 1e-9 * Math.max(1, win)) this.resetScope();
        const period = win / this.N;
        this.acc += dt;
        let guard = 0;
        while (this.acc >= period && guard++ < this.N) {
            this.acc -= period;
            cfg.traces.forEach((tr, i) => {
                const b = this.buf[i];
                b.push(+tr.get());
                if (b.length > this.N) b.shift();
            });
        }
        if (guard >= this.N) this.acc = 0;
    }

    resizeCanvas() {
        const cfg = this.scopeCfg;
        if (!cfg) return;
        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.clientWidth || 600;
        let h;
        if (cfg.mode === 'overlay') {
            h = 220;
        } else {
            this.laneH = Math.max(20, Math.min(34, 300 / cfg.traces.length));
            h = Math.round(this.laneH * cfg.traces.length + 10);
        }
        this.canvas.style.height = h + 'px';
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.cw = w;
        this.ch = h;
    }

    drawScope() {
        const cfg = this.scopeCfg;
        if (!cfg) return;
        if (this.canvas.clientWidth && Math.abs(this.canvas.clientWidth - this.cw) > 1) this.resizeCanvas();
        const ctx = this.ctx, w = this.cw, h = this.ch;
        ctx.clearRect(0, 0, w, h);

        // Grille (10 divisions horizontales)
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        const x0 = cfg.mode === 'overlay' ? 0 : 54;
        for (let i = 0; i <= 10; i++) {
            const gx = x0 + (w - x0) * i / 10;
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
        }

        const win = this.windowLength();
        const pts = this.N;
        const valueAt = (tr, i, k) => {
            if (cfg.analytic) {
                const t0 = cfg.t0 ? cfg.t0() : this.t;
                return +tr.fn(t0 - win + win * k / (pts - 1));
            }
            const b = this.buf[i];
            const idx = k - (pts - b.length);
            return idx >= 0 ? b[idx] : NaN;
        };

        ctx.font = '11px ' + getComputedStyle(document.body).getPropertyValue('--font-family-mono');
        if (cfg.mode === 'overlay') {
            const min = cfg.min, max = cfg.max;
            const yOf = v => h - 8 - (v - min) / (max - min) * (h - 16);
            for (let gy = 0; gy <= 5; gy++) {
                const y = 8 + (h - 16) * gy / 5;
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
            }
            (cfg.guides || []).forEach(g => {
                ctx.save();
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = 'rgba(230,126,34,0.6)';
                ctx.beginPath(); ctx.moveTo(0, yOf(g.v)); ctx.lineTo(w, yOf(g.v)); ctx.stroke();
                ctx.fillStyle = 'rgba(230,126,34,0.9)';
                ctx.fillText(g.label, 4, yOf(g.v) - 3);
                ctx.restore();
            });
            cfg.traces.forEach((tr, i) => {
                ctx.strokeStyle = tr.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                let started = false;
                for (let k = 0; k < pts; k++) {
                    const v = valueAt(tr, i, k);
                    if (isNaN(v)) continue;
                    const x = w * k / (pts - 1), y = yOf(v);
                    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
                }
                ctx.stroke();
            });
            // Légende
            let lx = w - 8;
            ctx.textAlign = 'right';
            cfg.traces.slice().reverse().forEach(tr => {
                ctx.fillStyle = tr.color;
                ctx.fillText(tr.label, lx, 16);
                lx -= ctx.measureText(tr.label).width + 16;
            });
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillText(LS.num(max, 2) + ' ' + (cfg.unit || 'V'), 4, 16);
            ctx.fillText(LS.num(min, 2) + ' ' + (cfg.unit || 'V'), 4, h - 12);
        } else {
            const lh = this.laneH;
            cfg.traces.forEach((tr, i) => {
                const top = 5 + i * lh;
                ctx.strokeStyle = 'rgba(255,255,255,0.06)';
                ctx.beginPath(); ctx.moveTo(x0, top + lh); ctx.lineTo(w, top + lh); ctx.stroke();
                ctx.fillStyle = tr.color;
                ctx.fillText(tr.label, 4, top + lh / 2 + 4);
                const hi = top + lh * 0.18, lo = top + lh * 0.82;
                const yOf = tr.kind === 'analog'
                    ? v => lo - (v - tr.min) / (tr.max - tr.min) * (lo - hi)
                    : v => (v ? hi : lo);
                ctx.strokeStyle = tr.color;
                ctx.lineWidth = tr.bold ? 2.5 : 1.6;
                ctx.beginPath();
                let started = false, prevY = 0;
                for (let k = 0; k < pts; k++) {
                    const v = valueAt(tr, i, k);
                    if (isNaN(v)) continue;
                    const x = x0 + (w - x0) * k / (pts - 1), y = yOf(v);
                    if (!started) { ctx.moveTo(x, y); started = true; }
                    else {
                        if (tr.kind !== 'analog') ctx.lineTo(x, prevY);
                        ctx.lineTo(x, y);
                    }
                    prevY = y;
                }
                ctx.stroke();
            });
        }

        const info = cfg.info ? cfg.info() : LS.time(win / 10) + ' / div';
        if (info !== this.lastInfo) {
            this.scopeInfo.textContent = info;
            this.lastInfo = info;
        }
    }
}

/* ========================================================================
   Scénarios
   ======================================================================== */

const LSGates = {
    and: a => a.every(Boolean),
    nand: a => !a.every(Boolean),
    or: a => a.some(Boolean),
    nor: a => !a.some(Boolean),
    xor: a => a.filter(Boolean).length % 2 === 1,
    xnor: a => a.filter(Boolean).length % 2 === 0,
    not: a => !a[0],
    buf: a => !!a[0]
};

/* Porte logique : interrupteurs sur les entrées, LED, table de vérité */
LogicSim.scenarios.gate = (sim, o) => {
    const f = LSGates[o.type];
    const n = o.inputs.length;
    const sec = sim.section('Entrées de la porte');
    const g = sim.group(sec);
    const ins = o.inputs.map((name, i) => sim.toggle(g, `${name} <small>broche ${o.pins[i]}</small>`, false));
    const secA = sim.section('Défilement automatique');
    const auto = sim.toggle(sim.group(secA), 'Parcourir la table de vérité', true);
    const speed = sim.slider(secA, 'Vitesse', {
        min: 0.25, max: 4, step: 0.25, value: 1, format: v => LS.num(v, 2) + ' combinaison/s'
    });
    ins.forEach(t => t.el.addEventListener('click', () => auto.set(false)));

    const out = () => f(ins.map(t => t.value));
    const row = sim.boardRow(`Sortie ${o.output} (broche ${o.pins[n]})`);
    const led = sim.leds(row, [o.output]);

    // Table de vérité
    const rowT = sim.boardRow('Table de vérité');
    const table = LS.el('table', 'lsim-truth');
    let html = '<thead><tr>' + o.inputs.map(x => `<th>${x}</th>`).join('') + `<th>${o.output}</th></tr></thead><tbody>`;
    for (let c = 0; c < (1 << n); c++) {
        const bits = o.inputs.map((_, i) => (c >> (n - 1 - i)) & 1);
        html += `<tr data-c="${c}">` + bits.map(b => `<td>${b}</td>`).join('') + `<td class="out">${f(bits) ? 1 : 0}</td></tr>`;
    }
    table.innerHTML = html + '</tbody>';
    rowT.append(table);
    const trs = Array.from(table.querySelectorAll('tbody tr'));

    let acc = 0, combo = 0;
    sim.onStep(dt => {
        if (!auto.value) return;
        acc += dt * speed.value;
        if (acc >= 1) {
            acc -= 1;
            combo = (combo + 1) % (1 << n);
            ins.forEach((t, i) => t.set((combo >> (n - 1 - i)) & 1));
        }
    });
    sim.onRender(() => {
        led.set(0, out());
        const c = ins.reduce((acc2, t) => (acc2 << 1) | (t.value ? 1 : 0), 0);
        trs.forEach((tr, i) => tr.classList.toggle('active', i === c));
    });
    const GN = { and: 'ET', nand: 'NAND', or: 'OU', nor: 'NOR', xor: 'XOR', xnor: 'XNOR', not: 'INVERSEUR', buf: 'BUFFER' };
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'porte 1 : ' + GN[o.type] + (o.schmitt ? ' (Schmitt)' : ''),
        left: o.inputs.map((name, i) => ({ pin: o.pins[i], label: name, get: () => ins[i].value, click: () => ins[i].el.click() })),
        right: [{ pin: o.pins[n], label: o.output, get: out }]
    });
    sim.scope({
        mode: 'lanes', window: 10,
        traces: [...o.inputs.map((name, i) => ({ label: name, get: () => ins[i].value })),
            { label: o.output, get: out, bold: true }]
    });
};

/* Oscillateur RC à trigger de Schmitt (4093 / 40106) */
LogicSim.scenarios.schmittOsc = (sim, o) => {
    const VDD = 5, VTP = o.vtp || 2.9, VTN = o.vtn || 1.9;
    const sec = sim.section('Composants');
    const R = sim.slider(sec, 'Résistance R (sortie → entrée)', {
        min: 1e3, max: 1e6, value: 100e3, log: true, format: v => LS.ohm(v),
        round: v => Math.round(v / 1e3) * 1e3 || 1e3
    });
    const C = sim.choice(sec, 'Condensateur C (entrée → masse)', [
        { value: 1e-8, label: '10 nF' }, { value: 1e-7, label: '100 nF' },
        { value: 1e-6, label: '1 µF' }, { value: 1e-5, label: '10 µF' }
    ], 1e-6);
    let en = { value: true };
    if (o.kind === 'nand') {
        en = sim.toggle(sim.group(sim.section('Validation')), `Entrée A <small>broche ${o.enPin}</small>`, true);
        sim.note(sim.controls.lastChild, "À 0, la sortie reste à 1 : l'oscillateur est arrêté.");
    }
    let vc = 0, high = true;
    const period = () => R.value * C.value * (Math.log((VDD - VTN) / (VDD - VTP)) + Math.log(VTP / VTN));
    const out = () => (!en.value ? VDD : (high ? VDD : 0));
    sim.substeps = 20;
    sim.onStep(dt => {
        if (en.value) {
            if (vc >= VTP) high = false;
            if (vc <= VTN) high = true;
        }
        const tau = R.value * C.value;
        vc += (out() - vc) * (1 - Math.exp(-dt / tau));
    });

    const row = sim.boardRow('Mesures');
    const rf = sim.readout(row, 'Fréquence');
    const rt = sim.readout(row, 'Période');
    const rs = sim.readout(row, 'Vitesse de la simulation');
    const led = sim.leds(sim.boardRow(`Sortie (broche ${o.outPin})`), ['LED']);
    sim.onRender(() => {
        const T = period();
        sim.timeScale = T / 1.2;   // une période ≈ 1,2 s à l'écran
        rf.set(en.value ? LS.freq(1 / T) : 'arrêté');
        rt.set(LS.time(T));
        rs.set(sim.timeScale < 1 ? `ralentie ×${LS.num(1 / sim.timeScale, 2)}` : `accélérée ×${LS.num(sim.timeScale, 2)}`);
        led.set(0, out() > VDD / 2);
    });
    // Schéma de l'oscillateur : R de la sortie vers l'entrée, C de l'entrée vers la masse
    {
        const nand = o.kind === 'nand';
        const yIn = nand ? 110 : 120, yOut = 120, xi = 140, xo = 300;
        const MUT = '#6a7a7a', TXT = '#e8f0f0', LOW = '#3d7a7a';
        const gnd = (x, y) => `<path d="M${x} ${y}v6M${x - 7} ${y + 6}h14M${x - 4.5} ${y + 9}h9M${x - 2} ${y + 12}h4" stroke="${MUT}" stroke-width="1.4" fill="none"/>`;
        const body = nand
            ? `<path d="M196 98h22a22 22 0 0 1 0 44h-22z" fill="#121a1a" stroke="#c8d5d5" stroke-width="1.6"/><circle cx="244" cy="120" r="4" fill="#121a1a" stroke="#c8d5d5" stroke-width="1.4"/>`
            : `<path d="M196 98l48 22l-48 22z" fill="#121a1a" stroke="#c8d5d5" stroke-width="1.6"/><circle cx="248" cy="120" r="4" fill="#121a1a" stroke="#c8d5d5" stroke-width="1.4"/>`;
        const xg = nand ? 248 : 252;
        const svg = `<svg viewBox="0 0 520 230" font-family="DejaVu Sans Mono, Consolas, monospace" role="img" aria-label="Schéma de l'oscillateur">
            <text x="10" y="18" font-size="11" fill="#e67e22">VDD (${o.vdd}) = +5 V</text>
            <text x="10" y="34" font-size="11" fill="${MUT}">VSS (${o.vss}) = 0 V</text>
            <text x="510" y="18" font-size="12" font-weight="bold" fill="#4ecdc4" text-anchor="end">${o.chip || ''}</text>
            <path data-k="fb" d="M${xo} ${yOut}V60H${xi}V${yIn}H196" stroke="${LOW}" stroke-width="1.6" fill="none"/>
            <rect x="205" y="55" width="40" height="10" fill="#1a2424" stroke="${TXT}" stroke-width="1.4"/>
            <text data-k="r" x="225" y="48" font-size="10" text-anchor="middle" fill="${TXT}"></text>
            <path d="M${xi} ${yIn}V170M${xi - 12} 170h24M${xi - 12} 177h24M${xi} 177V190" stroke="${TXT}" stroke-width="1.6" fill="none"/>
            ${gnd(xi, 190)}
            <text data-k="c" x="${xi - 18}" y="177" font-size="10" text-anchor="end" fill="${TXT}"></text>
            <circle cx="${xi}" cy="${yIn}" r="3" fill="${TXT}"/>
            <text data-k="vc" x="${xi - 8}" y="${yIn + 22}" font-size="10" text-anchor="end" fill="#4ecdc4"></text>
            ${body}
            <path d="M${nand ? 206 : 203} 126h9v-11h4M${nand ? 210 : 207} 126h4v-11h9" stroke="#4ecdc4" stroke-width="1.2" fill="none"/>
            <text x="190" y="${yIn - 4}" font-size="9" text-anchor="end" fill="${MUT}">${nand ? '2' : '1'}</text>
            ${nand ? `<path data-k="en" d="M184 130H196" stroke="${LOW}" stroke-width="1.6"/>
            <g data-k="ball" class="lsim-sch-click" tabindex="0" role="button"><circle cx="176" cy="130" r="8.5" stroke="${MUT}" stroke-width="1.2"/>
            <text x="176" y="133.5" text-anchor="middle" font-size="9.5" font-weight="bold"></text></g>
            <text x="176" y="154" font-size="9" text-anchor="middle" fill="${MUT}">A (${o.enPin})</text>` : ''}
            <path data-k="out" d="M${xg} 120H${xo}H372M398 120H414" stroke="${LOW}" stroke-width="1.6"/>
            <circle cx="${xo}" cy="120" r="3" fill="${TXT}"/>
            <text x="${xg + 6}" y="114" font-size="9" fill="${MUT}">${o.outPin}</text>
            <rect x="372" y="115.5" width="26" height="9" fill="#1a2424" stroke="${TXT}" stroke-width="1.2"/>
            <circle data-k="glow" cx="422" cy="120" r="10" fill="#ff3b3b" opacity="0"/>
            <path data-k="led" d="M414 114V126L428 120Z" fill="#3a1212" stroke="#ff6b6b" stroke-width="1"/>
            <path d="M428 114V126M428 120H444" stroke="#ff6b6b" stroke-width="1.4"/>${gnd(444, 120)}
            <text x="422" y="146" font-size="9" text-anchor="middle" fill="${MUT}">LED</text>
        </svg>`;
        const row = sim.boardRow("Schéma de l'oscillateur");
        row.classList.add('lsim-schem-row');
        const box = LS.el('div', 'lsim-schem', svg);
        row.append(box);
        sim.board.prepend(row);
        const q = k => box.querySelector(`[data-k="${k}"]`);
        const E = { r: q('r'), c: q('c'), vc: q('vc'), out: q('out'), glow: q('glow'), led: q('led'), ball: q('ball'), en: q('en'), fb: q('fb') };
        if (E.ball) {
            const fire = () => en.el.click();
            E.ball.addEventListener('click', fire);
            E.ball.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fire(); } });
        }
        const Cname = { 1e-8: '10 nF', 1e-7: '100 nF', 1e-6: '1 µF', 1e-5: '10 µF' };
        sim.onRender(() => {
            const hi = out() > VDD / 2;
            E.r.textContent = 'R ' + LS.ohm(R.value);
            E.c.textContent = 'C ' + Cname[C.value];
            E.vc.textContent = 'Vc ' + LS.num(vc, 2) + ' V';
            // La simulation est ralentie (≈ 1,2 s par période) : la LED suit la sortie simulée
            E.out.setAttribute('stroke', hi ? '#f7e36a' : LOW);
            E.fb.setAttribute('stroke', hi ? 'rgba(247,227,106,0.55)' : LOW);
            E.glow.setAttribute('opacity', hi ? 0.45 : 0);
            E.led.setAttribute('fill', hi ? '#ff3b3b' : '#3a1212');
            if (E.ball) {
                E.ball.querySelector('circle').setAttribute('fill', en.value ? '#f7e36a' : '#0b0d0d');
                const t = E.ball.querySelector('text');
                t.textContent = en.value ? '1' : '0';
                t.setAttribute('fill', en.value ? '#0a0f0f' : '#a8b5b5');
                E.en.setAttribute('stroke', en.value ? '#f7e36a' : LOW);
            }
        });
    }
    sim.scope({
        mode: 'overlay', min: 0, max: VDD,
        window: () => 4 * period(),
        guides: [{ v: VTP, label: 'V+ ' + LS.num(VTP, 2) + ' V' }, { v: VTN, label: 'V− ' + LS.num(VTN, 2) + ' V' }],
        traces: [
            { label: 'Condensateur', get: () => vc, color: '#4ecdc4' },
            { label: 'Sortie', get: out, color: '#f7e36a' }
        ]
    });
};

/* Buffer convertisseur de niveau (4049 / 4050) */
LogicSim.scenarios.levelShift = (sim, o) => {
    const VDD = 5;
    const sec = sim.section('Signal d\'entrée');
    const vin = sim.slider(sec, 'Niveau haut de l\'entrée', {
        min: 5, max: 15, step: 0.5, value: 12, format: v => LS.num(v, 3) + ' V'
    });
    const g = sim.group(sec);
    const input = sim.toggle(g, `Entrée 1A <small>broche 3</small>`, false);
    const auto = sim.toggle(g, 'Signal carré 0,5 Hz', true);
    input.el.addEventListener('click', () => auto.set(false));
    sim.note(sec, 'Le circuit est alimenté en <strong>VDD = 5 V</strong> : la sortie ne dépasse pas 5 V, même si l\'entrée monte à 15 V.');
    sim.onStep((dt, t) => {
        if (auto.value) input.set(LS.sq(t * 0.5) === 1);
    });
    const vIn = () => (input.value ? vin.value : 0);
    const vOut = () => ((input.value !== !!o.invert) ? VDD : 0);
    const row = sim.boardRow('Mesures');
    const ri = sim.readout(row, 'Entrée (broche 3)');
    const ro = sim.readout(row, 'Sortie 1Y (broche 2)');
    const led = sim.leds(sim.boardRow('Sortie'), ['1Y']);
    sim.onRender(() => {
        ri.set(LS.num(vIn(), 3) + ' V');
        ro.set(LS.num(vOut(), 3) + ' V');
        led.set(0, vOut() > 0);
    });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: o.invert ? 'INVERSEUR' : 'BUFFER',
        left: [{ pin: 3, label: '1A', get: () => input.value, click: () => input.el.click() }],
        right: [{ pin: 2, label: '1Y', get: () => vOut() > 0 }]
    });
    sim.scope({
        mode: 'overlay', min: 0, max: 15, window: 8,
        traces: [
            { label: 'Entrée', get: vIn, color: '#4ecdc4' },
            { label: 'Sortie', get: vOut, color: '#f7e36a' }
        ]
    });
};

/* Bascule D (4013) */
LogicSim.scenarios.dff = (sim, o) => {
    const sec = sim.section('Câblage');
    const mode = sim.choice(sec, 'Entrée D', [
        { value: 'div', label: 'Reliée à Q̄ (÷2)' }, { value: 'man', label: 'Interrupteur' }
    ], 'div', v => d.setDisabled(v === 'div'));
    const g = sim.group(sec);
    const d = sim.toggle(g, 'D <small>broche 5</small>', false);
    d.setDisabled(true);
    const s = sim.toggle(g, 'S <small>broche 6</small>', false);
    const r = sim.toggle(g, 'R <small>broche 4</small>', false);
    const clk = sim.clock(sim.section('Horloge CLK (broche 3)'), { freq: 1 });
    let q = false;
    const dVal = () => (mode.value === 'div' ? !q : d.value);
    clk.onRise(() => { if (!s.value && !r.value) q = dVal(); });
    sim.onStep(() => {
        if (s.value && !r.value) q = true;
        if (r.value && !s.value) q = false;
    });
    const Q = () => (s.value && r.value ? true : q);
    const QN = () => (s.value && r.value ? true : !q);
    const leds = sim.leds(sim.boardRow('Sorties'), ['Q (1)', 'Q̄ (2)']);
    sim.onRender(() => { leds.set(0, Q()); leds.set(1, QN()); });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'bascule D 1',
        left: [
            { pin: 5, label: () => (mode.value === 'div' ? 'D ← Q̄' : 'D'), get: dVal, click: () => d.el.click() },
            { pin: 3, label: 'CLK', kind: 'clk', get: () => clk.level },
            { pin: 6, label: 'S', get: () => s.value, click: () => s.el.click() },
            { pin: 4, label: 'R', get: () => r.value, click: () => r.el.click() }
        ],
        right: [{ pin: 1, label: 'Q', get: Q }, { pin: 2, label: '~Q', get: QN }]
    });
    sim.scope({
        mode: 'lanes', window: 10,
        traces: [
            { label: 'CLK', get: () => clk.level },
            { label: 'D', get: dVal },
            { label: 'S', get: () => s.value },
            { label: 'R', get: () => r.value },
            { label: 'Q', get: Q, bold: true },
            { label: 'Q̄', get: QN }
        ]
    });
};

/* Bascule JK (4027) */
LogicSim.scenarios.jkff = (sim, o) => {
    const sec = sim.section('Entrées');
    const g = sim.group(sec);
    const j = sim.toggle(g, 'J <small>broche 10</small>', true);
    const k = sim.toggle(g, 'K <small>broche 11</small>', true);
    const s = sim.toggle(g, 'S <small>broche 9</small>', false);
    const r = sim.toggle(g, 'R <small>broche 12</small>', false);
    sim.note(sec, 'J = K = 1 : la sortie change d\'état à chaque front montant (diviseur par 2).');
    const clk = sim.clock(sim.section('Horloge CLK (broche 13)'), { freq: 1 });
    let q = false;
    clk.onRise(() => {
        if (s.value || r.value) return;
        if (j.value && k.value) q = !q;
        else if (j.value) q = true;
        else if (k.value) q = false;
    });
    sim.onStep(() => {
        if (s.value && !r.value) q = true;
        if (r.value && !s.value) q = false;
    });
    const Q = () => (s.value && r.value ? true : q);
    const QN = () => (s.value && r.value ? true : !q);
    const leds = sim.leds(sim.boardRow('Sorties'), ['Q (15)', 'Q̄ (14)']);
    sim.onRender(() => { leds.set(0, Q()); leds.set(1, QN()); });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'bascule JK 1',
        left: [
            { pin: 10, label: 'J', get: () => j.value, click: () => j.el.click() },
            { pin: 11, label: 'K', get: () => k.value, click: () => k.el.click() },
            { pin: 13, label: 'CLK', kind: 'clk', get: () => clk.level },
            { pin: 9, label: 'S', get: () => s.value, click: () => s.el.click() },
            { pin: 12, label: 'R', get: () => r.value, click: () => r.el.click() }
        ],
        right: [{ pin: 15, label: 'Q', get: Q }, { pin: 14, label: '~Q', get: QN }]
    });
    sim.scope({
        mode: 'lanes', window: 10,
        traces: [
            { label: 'CLK', get: () => clk.level },
            { label: 'J', get: () => j.value },
            { label: 'K', get: () => k.value },
            { label: 'Q', get: Q, bold: true },
            { label: 'Q̄', get: QN }
        ]
    });
};

/* Compteur Johnson 4017 : chenillard 10 LED */
LogicSim.scenarios.johnson10 = (sim, o) => {
    const clk = sim.clock(sim.section('Horloge CLK (broche 14)'), { freq: 4, max: 15 });
    const sec = sim.section('Entrées de contrôle');
    const g = sim.group(sec);
    const inh = sim.toggle(g, 'Inhibition <small>broche 13</small>', false);
    sim.button(sec, 'Remise à zéro (broche 15)', () => { count = 0; });
    const mod = sim.choice(sec, 'Broche RST (15) reliée à', [
        { value: 0, label: 'masse (10 LED)' }, { value: 4, label: 'Q4' },
        { value: 6, label: 'Q6' }, { value: 8, label: 'Q8' }
    ], 0);
    sim.note(sec, 'Relier RST à une sortie raccourcit le cycle : avec Q6, le chenillard tourne sur 6 LED (Q0 à Q5).');
    let count = 0;
    clk.onRise(() => {
        if (inh.value) return;
        count = (count + 1) % 10;
        if (mod.value && count === mod.value) count = 0;
    });
    const pins = [3, 2, 4, 7, 10, 1, 5, 6, 9, 11];
    const leds = sim.leds(sim.boardRow('Chenillard'), pins.map((p, i) => `Q${i}<br><small>${p}</small>`), 'orange');
    const co = sim.leds(sim.boardRow('Retenue'), ['CO (12)']);
    sim.onRender(() => {
        pins.forEach((_, i) => leds.set(i, i === count));
        co.set(0, count < 5);
    });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'JOHNSON ÷10',
        left: [
            { pin: 14, label: 'CLK', kind: 'clk', get: () => clk.level },
            { pin: 13, label: '~EN', get: () => inh.value, click: () => inh.el.click() },
            { pin: 15, label: 'RST', kind: 'fixed', text: () => (mod.value ? '← Q' + mod.value : '0 V'), get: () => false }
        ],
        right: [...pins.map((p, i) => ({ pin: p, label: 'Q' + i, get: () => count === i })),
            { pin: 12, label: 'CO', get: () => count < 5 }]
    });
    sim.scope({
        mode: 'lanes', window: 6,
        traces: [{ label: 'CLK', get: () => clk.level },
            ...pins.map((_, i) => ({ label: 'Q' + i, get: () => count === i, color: i % 2 ? '#4ecdc4' : '#f7e36a' })),
            { label: 'CO', get: () => count < 5, color: '#e67e22' }]
    });
};

/* Compteur binaire asynchrone (4020, 4024, 4040) */
LogicSim.scenarios.ripple = (sim, o) => {
    const clk = sim.clock(sim.section(`Horloge C̄LK (broche ${o.clkPin}) — front descendant`), { freq: 4, max: 30 });
    const sec = sim.section('Remise à zéro');
    const rst = sim.toggle(sim.group(sec), `RST <small>broche ${o.rstPin}</small>`, false);
    sim.button(sec, 'Impulsion RST', () => { count = 0; });
    let count = 0;
    const max = 2 ** o.stages;
    clk.onFall(() => { if (!rst.value) count = (count + 1) % max; });
    sim.onStep(() => { if (rst.value) count = 0; });
    const bit = k => (count >> (k - 1)) & 1;
    const leds = sim.leds(sim.boardRow('Sorties'), o.outputs.map(k => `Q${k}<br><small>${o.pins[k]}</small>`));
    const row = sim.boardRow('Valeur');
    const rv = sim.readout(row, 'Impulsions comptées');
    sim.onRender(() => {
        o.outputs.forEach((k, i) => leds.set(i, bit(k)));
        rv.set(`${count} <small>(modulo ${max})</small>`);
    });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: o.stages + ' étages',
        left: [
            { pin: o.clkPin, label: '~CLK', kind: 'clk', get: () => clk.level },
            { pin: o.rstPin, label: 'RST', get: () => rst.value, click: () => rst.el.click() }
        ],
        right: o.outputs.map(k => ({ pin: o.pins[k], label: 'Q' + k, get: () => bit(k) }))
    });
    sim.scope({
        mode: 'lanes', window: 8,
        traces: [{ label: 'CLK', get: () => clk.level },
            ...o.outputs.slice(0, 6).map(k => ({ label: 'Q' + k, get: () => bit(k) }))]
    });
};

/* 4060 : oscillateur à quartz + diviseur, choix de la sortie */
LogicSim.scenarios.osc4060 = (sim, o) => {
    const sec = sim.section('Quartz');
    const xtal = sim.choice(sec, 'Fréquence du quartz', [
        { value: 32768, label: '32,768 kHz' }, { value: 4194304, label: '4,194 MHz' }
    ], 32768);
    const outs = [[4, 7], [5, 5], [6, 4], [7, 6], [8, 14], [9, 13], [10, 15], [12, 1], [13, 2], [14, 3]];
    const sel = sim.choice(sim.section('Sortie observée'), 'Broche',
        outs.map(([k, p]) => ({ value: k, label: `Q${k} (${p})` })), 14);
    sim.note(sim.controls.lastChild, 'Chaque étage divise la fréquence par 2 : Qn = f / 2ⁿ. Q11 n\'est pas sortie sur une broche.');

    const fQ = () => xtal.value / 2 ** sel.value;
    const row = sim.boardRow('Mesures');
    const rq = sim.readout(row, 'Quartz');
    const rf = sim.readout(row, 'Fréquence de la sortie');
    const rt = sim.readout(row, 'Période');
    const led = sim.leds(sim.boardRow('LED sur la sortie'), ['Qn']);
    const lv = (k, t) => Math.floor(t * xtal.value / 2 ** (k - 1)) % 2;
    // LED : clignote jusqu'à 8 Hz, scintille jusqu'à 100 Hz, puis reste allumée
    const ledState = () => LS.blink(fQ(), lv(sel.value, sim.tReal));
    const pinOf = k => outs.find(([q]) => q === k)[1];
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'OSCILLATEUR + ÷2ⁿ',
        left: [
            { pin: 12, label: 'RST', kind: 'fixed', text: '0 V', get: () => false },
            { pin: 11, label: 'φI', kind: 'xtal', text: () => (xtal.value === 32768 ? '32,768 kHz' : '4,194 MHz') },
            { pin: 10, label: '~φO', kind: 'xtal-end' },
            { pin: 9, label: 'φO', kind: 'nc' }
        ],
        right: [{ label: () => `Q${sel.value} (${pinOf(sel.value)})`, get: ledState }]
    });
    // Défilement : temps réel pour les sorties lentes, ralenti sinon
    const t0 = () => sim.tReal * Math.min(1, 0.5 / fQ());
    sim.onRender(() => {
        rq.set(LS.freq(xtal.value));
        rf.set(LS.freq(fQ()));
        rt.set(LS.time(1 / fQ()));
        const st = ledState();
        led.set(0, st, st === 'fast');
    });
    const lane = d => ({
        label: '', fn: t => lv(sel.value + d, t), color: d === 0 ? '#f7e36a' : '#4ecdc4', bold: d === 0
    });
    const traces = [lane(-2), lane(-1), lane(0), lane(1)];
    sim.scope({
        mode: 'lanes', analytic: true,
        window: () => 4 / fQ(), t0,
        traces,
        info: () => LS.time(0.4 / fQ()) + ' / div'
    });
    sim.onRender(() => {
        const k = sel.value;
        const avail = n => outs.some(([q]) => q === n);
        traces.forEach((tr, i) => {
            const n = k + i - 2;
            tr.label = n >= 1 ? 'Q' + n + (avail(n) ? '' : '*') : '';
        });
    });
    sim.note(sim.controls.lastChild, '* étage interne, sans broche de sortie.');
};

/* 4026 : compteur décimal avec sorties 7 segments */
LogicSim.scenarios.count7seg = (sim, o) => {
    const clk = sim.clock(sim.section('Horloge CLK (broche 1)'), { freq: 2, max: 15 });
    const sec = sim.section('Entrées de contrôle');
    const g = sim.group(sec);
    const inh = sim.toggle(g, 'Inhibition <small>broche 2</small>', false);
    const dei = sim.toggle(g, 'Affichage actif <small>broche 3</small>', true);
    sim.button(sec, 'Remise à zéro (broche 15)', () => { count = 0; });
    let count = 0;
    clk.onRise(() => { if (!inh.value) count = (count + 1) % 10; });
    const seg = () => (dei.value ? LS.SEG[count] : 0);
    const row = sim.boardRow('Afficheur');
    const d = sim.seg7(row, 1);
    const co = sim.leds(sim.boardRow('Retenue'), ['CO (5)']);
    sim.onRender(() => { d.set(0, seg()); co.set(0, count < 5); });
    let rstFlash = 0;
    sim.onStep(dt => { rstFlash = Math.max(0, rstFlash - dt); });
    const segPins = [['a', 10], ['b', 12], ['c', 13], ['d', 9], ['e', 11], ['f', 6], ['g', 7]];
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: '÷10 → 7 seg.',
        left: [
            { pin: 1, label: 'CLK', kind: 'clk', get: () => clk.level },
            { pin: 2, label: 'INH', get: () => inh.value, click: () => inh.el.click() },
            { pin: 3, label: 'DEI', get: () => dei.value, click: () => dei.el.click() },
            { pin: 15, label: 'RST', get: () => rstFlash > 0, click: () => { count = 0; rstFlash = 0.3; } }
        ],
        right: [...segPins.map(([n, p], i) => ({ pin: p, label: n, kind: 'seg', get: () => (seg() >> i) & 1 })),
            { pin: 5, label: 'CO', get: () => count < 5 }],
        display: seg
    });
    sim.scope({
        mode: 'lanes', window: 8,
        traces: [{ label: 'CLK', get: () => clk.level }, { label: 'CO', get: () => count < 5, color: '#e67e22' },
            ...'abcdefg'.split('').map((s, i) => ({ label: s, get: () => (seg() >> i) & 1 }))]
    });
};

/* Compteur haut / bas préréglable (4029 / 4510) */
LogicSim.scenarios.updown = (sim, o) => {
    const clk = sim.clock(sim.section('Horloge CLK (broche 15)'), { freq: 2, max: 15 });
    const sec = sim.section('Mode');
    const g = sim.group(sec);
    const up = sim.toggle(g, 'U/D̄ <small>broche 10</small>', true);
    const bin = o.binSel ? sim.toggle(g, 'B/D̄ <small>broche 9</small>', false) : { value: false };
    const ci = sim.toggle(g, 'C̄I <small>broche 5</small>', false);
    sim.note(sec, 'U/D̄ = 1 : compte, 0 : décompte. C̄I = 1 bloque le comptage.' + (o.binSel ? ' B/D̄ = 1 : binaire (0-15), 0 : décimal (0-9).' : ''));
    const secP = sim.section('Préréglage');
    const gp = sim.group(secP);
    const P = [['P1', 4], ['P2', 12], ['P3', 13], ['P4', 3]].map(([n, p]) => sim.toggle(gp, `${n} <small>${p}</small>`, false));
    sim.button(secP, 'Charger (PE, broche 1)', () => {
        count = P.reduce((a, t, i) => a | (t.value ? 1 << i : 0), 0) % (max() + 1);
    });
    if (o.reset) sim.button(secP, 'Remise à zéro (broche 9)', () => { count = 0; });
    let count = 0;
    const max = () => (bin.value ? 15 : 9);
    clk.onRise(() => {
        if (ci.value) return;
        const m = max();
        if (count > m) count = 0;
        count = up.value ? (count >= m ? 0 : count + 1) : (count <= 0 ? m : count - 1);
    });
    const coN = () => !(!ci.value && (up.value ? count === max() : count === 0));
    const row = sim.boardRow('Sorties');
    const leds = sim.leds(row, ['Q4 (2)', 'Q3 (14)', 'Q2 (11)', 'Q1 (6)']);
    const d = sim.seg7(row, 1);
    const rowV = sim.boardRow('Valeur');
    const rv = sim.readout(rowV, 'Compteur');
    const co = sim.leds(sim.boardRow('Retenue'), ['C̄O (7)']);
    sim.onRender(() => {
        [3, 2, 1, 0].forEach((b, i) => leds.set(i, (count >> b) & 1));
        d.set(0, LS.SEG[count & 15]);
        rv.set(`${count} <small>(${count.toString(2).padStart(4, '0')})</small>`);
        co.set(0, coN());
    });
    let flash = 0;
    sim.onStep(dt => { flash = Math.max(0, flash - dt); });
    const pClick = i => () => P[i].el.click();
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: o.binSel ? 'HAUT/BAS BIN/BCD' : 'HAUT/BAS BCD',
        left: [
            { pin: 15, label: 'CLK', kind: 'clk', get: () => clk.level },
            { pin: 10, label: 'U/~D', get: () => up.value, click: () => up.el.click() },
            o.binSel ? { pin: 9, label: 'B/~D', get: () => bin.value, click: () => bin.el.click() }
                : { pin: 9, label: 'RST', get: () => flash > 0, click: () => { count = 0; flash = 0.3; } },
            { pin: 5, label: '~CI', get: () => ci.value, click: () => ci.el.click() },
            { pin: 1, label: 'PE', get: () => flash > 0, click: () => {
                count = P.reduce((a, t, i) => a | (t.value ? 1 << i : 0), 0) % (max() + 1); flash = 0.3;
            } },
            ...[['P1', 4], ['P2', 12], ['P3', 13], ['P4', 3]].map(([nm, p], i) => ({ pin: p, label: nm, get: () => P[i].value, click: pClick(i) }))
        ],
        right: [...[['Q1', 6], ['Q2', 11], ['Q3', 14], ['Q4', 2]].map(([nm, p], b) => ({ pin: p, label: nm, get: () => (count >> b) & 1 })),
            { pin: 7, label: '~CO', get: coN }]
    });
    sim.scope({
        mode: 'lanes', window: 10,
        traces: [{ label: 'CLK', get: () => clk.level }, { label: 'U/D̄', get: () => up.value, color: '#c8d5d5' },
            ...[0, 1, 2, 3].map(b => ({ label: 'Q' + (b + 1), get: () => (count >> b) & 1 })),
            { label: 'C̄O', get: coN, color: '#e67e22' }]
    });
};

/* Double compteur 4518 (BCD) / 4520 (binaire), deux étages en cascade */
LogicSim.scenarios.dualCount = (sim, o) => {
    const bcd = o.mode === 'bcd';
    const m = bcd ? 10 : 16;
    const clk = sim.clock(sim.section('Horloge CLK A (broche 1)'), { freq: 5, max: 30 });
    const sec = sim.section('Remise à zéro');
    sim.button(sec, 'Remise à zéro (broches 7 et 15)', () => { a = 0; b = 0; });
    sim.note(sec, `Q4A est reliée à EN B (broche 10) : le compteur B avance quand A repasse de ${m - 1} à 0.`);
    let a = 0, b = 0;
    clk.onRise(() => {
        const q4 = (a >> 3) & 1;
        a = (a + 1) % m;
        if (q4 && !((a >> 3) & 1)) b = (b + 1) % m;   // front descendant de Q4A
    });
    if (bcd) {
        const d = sim.seg7(sim.boardRow('Afficheur 00-99'), 2);
        sim.onRender(() => { d.set(0, LS.SEG[b]); d.set(1, LS.SEG[a]); });
    } else {
        const leds = sim.leds(sim.boardRow('Sorties (8 bits)'), ['Q4B', 'Q3B', 'Q2B', 'Q1B', 'Q4A', 'Q3A', 'Q2A', 'Q1A']);
        const rv = sim.readout(sim.boardRow('Valeur'), 'Compteur');
        sim.onRender(() => {
            const v = b * 16 + a;
            for (let i = 0; i < 8; i++) leds.set(i, (v >> (7 - i)) & 1);
            rv.set(`${v} <small>(0 à 255)</small>`);
        });
    }
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: bcd ? '2 × BCD' : '2 × 4 bits',
        left: [
            { pin: 1, label: 'CLKA', kind: 'clk', get: () => clk.level },
            { pin: 2, label: 'ENA', kind: 'fixed', text: '+5 V', get: () => true },
            { pin: 7, label: 'RSTA', kind: 'fixed', text: '0 V', get: () => false },
            { pin: 9, label: 'CLKB', kind: 'fixed', text: '0 V', get: () => false },
            { pin: 10, label: 'ENB', kind: 'fixed', text: '← Q4A', get: () => (a >> 3) & 1 },
            { pin: 15, label: 'RSTB', kind: 'fixed', text: '0 V', get: () => false }
        ],
        right: [...[3, 4, 5, 6].map((p, i) => ({ pin: p, label: `Q${i + 1}A`, get: () => (a >> i) & 1 })),
            ...[11, 12, 13, 14].map((p, i) => ({ pin: p, label: `Q${i + 1}B`, get: () => (b >> i) & 1 }))]
    });
    sim.scope({
        mode: 'lanes', window: 8,
        traces: [{ label: 'CLK', get: () => clk.level },
            ...[0, 1, 2, 3].map(i => ({ label: `Q${i + 1}A`, get: () => (a >> i) & 1 })),
            { label: 'Q1B', get: () => b & 1, color: '#e67e22' },
            { label: 'Q2B', get: () => (b >> 1) & 1, color: '#e67e22' }]
    });
};

/* Registre à décalage à chargement parallèle (4014 sync / 4021 async) */
LogicSim.scenarios.piso = (sim, o) => {
    const secP = sim.section('Entrées parallèles');
    const gp = sim.group(secP);
    const pPins = [7, 6, 5, 4, 13, 14, 15, 1];
    const init = [1, 0, 1, 1, 0, 0, 1, 0];
    const P = pPins.map((p, i) => sim.toggle(gp, `P${i + 1} <small>${p}</small>`, init[i]));
    const sec = sim.section('Mode et entrée série');
    const g = sim.group(sec);
    const ps = sim.toggle(g, 'P/S̄ <small>broche 9</small>', true);
    const ser = sim.toggle(g, 'SER <small>broche 11</small>', false);
    sim.note(sec, o.sync
        ? 'P/S̄ = 1 : les entrées P sont chargées au front montant d\'horloge (chargement synchrone). P/S̄ = 0 : décalage d\'un cran à chaque front.'
        : 'P/S̄ = 1 : les entrées P sont copiées immédiatement (chargement asynchrone). P/S̄ = 0 : décalage d\'un cran à chaque front montant.');
    const clk = sim.clock(sim.section('Horloge CLK (broche 10)'), { freq: 1 });
    let reg = new Array(8).fill(0);
    const load = () => { reg = P.map(t => (t.value ? 1 : 0)); };
    clk.onRise(() => {
        if (ps.value) { if (o.sync) load(); }
        else reg = [ser.value ? 1 : 0, ...reg.slice(0, 7)];
    });
    sim.onStep(() => { if (!o.sync && ps.value) load(); });
    const cells = sim.cells(sim.boardRow('Contenu du registre (Q6, Q7, Q8 sortent sur des broches)'),
        reg.map((_, i) => 'Q' + (i + 1)), [5, 6, 7]);
    const led = sim.leds(sim.boardRow('Sortie série'), ['Q8 (3)']);
    sim.onRender(() => {
        reg.forEach((v, i) => cells.set(i, v));
        led.set(0, reg[7]);
    });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'PARALLÈLE → SÉRIE',
        left: [...pPins.map((p, i) => ({ pin: p, label: 'P' + (i + 1), get: () => P[i].value, click: () => P[i].el.click() })),
            { pin: 9, label: 'P/~S', get: () => ps.value, click: () => ps.el.click() },
            { pin: 11, label: 'SER', get: () => ser.value, click: () => ser.el.click() },
            { pin: 10, label: 'CLK', kind: 'clk', get: () => clk.level }],
        right: [{ pin: 2, label: 'Q6', get: () => reg[5] }, { pin: 12, label: 'Q7', get: () => reg[6] },
            { pin: 3, label: 'Q8', get: () => reg[7] }]
    });
    sim.scope({
        mode: 'lanes', window: 12,
        traces: [{ label: 'CLK', get: () => clk.level }, { label: 'P/S̄', get: () => ps.value, color: '#c8d5d5' },
            { label: 'SER', get: () => ser.value }, { label: 'Q6', get: () => reg[5] },
            { label: 'Q7', get: () => reg[6] }, { label: 'Q8', get: () => reg[7], bold: true }]
    });
};

/* Registre à décalage série → parallèle 4 bits (4015) */
LogicSim.scenarios.sipo4 = (sim, o) => {
    const sec = sim.section('Donnée');
    const g = sim.group(sec);
    const d = sim.toggle(g, 'DA <small>broche 7</small>', true);
    const auto = sim.toggle(g, 'Motif automatique', true);
    d.el.addEventListener('click', () => auto.set(false));
    sim.button(sec, 'Remise à zéro (broche 6)', () => { reg = [0, 0, 0, 0]; });
    const clk = sim.clock(sim.section('Horloge CLKA (broche 9)'), { freq: 1.5 });
    let reg = [0, 0, 0, 0], n = 0;
    const pattern = [1, 1, 0, 1, 0, 0, 0, 1];
    clk.onFall(() => { if (auto.value) d.set(pattern[n++ % pattern.length]); });
    clk.onRise(() => { reg = [d.value ? 1 : 0, ...reg.slice(0, 3)]; });
    const leds = sim.leds(sim.boardRow('Sorties'), ['Q1A (5)', 'Q2A (4)', 'Q3A (3)', 'Q4A (10)']);
    sim.onRender(() => reg.forEach((v, i) => leds.set(i, v)));
    let flash = 0;
    sim.onStep(dt => { flash = Math.max(0, flash - dt); });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'registre A',
        left: [
            { pin: 7, label: 'DA', get: () => d.value, click: () => d.el.click() },
            { pin: 9, label: 'CLKA', kind: 'clk', get: () => clk.level },
            { pin: 6, label: 'RSTA', get: () => flash > 0, click: () => { reg = [0, 0, 0, 0]; flash = 0.3; } }
        ],
        right: [5, 4, 3, 10].map((p, i) => ({ pin: p, label: `Q${i + 1}A`, get: () => reg[i] }))
    });
    sim.scope({
        mode: 'lanes', window: 12,
        traces: [{ label: 'CLK', get: () => clk.level }, { label: 'D', get: () => d.value, color: '#c8d5d5' },
            ...[0, 1, 2, 3].map(i => ({ label: `Q${i + 1}`, get: () => reg[i] }))]
    });
};

/* Registre 8 bits avec verrou de sortie (4094) */
LogicSim.scenarios.sr4094 = (sim, o) => {
    const sec = sim.section('Entrées');
    const g = sim.group(sec);
    const d = sim.toggle(g, 'DATA <small>broche 2</small>', true);
    const auto = sim.toggle(g, 'Motif automatique', true);
    const str = sim.toggle(g, 'STR <small>broche 1</small>', false);
    const oe = sim.toggle(g, 'OE <small>broche 15</small>', true);
    d.el.addEventListener('click', () => auto.set(false));
    sim.note(sec, 'Les données entrent dans le registre interne ; elles n\'apparaissent sur Q1-Q8 que lorsque STR = 1. OE = 0 met les sorties en haute impédance.');
    sim.button(sec, 'Impulsion STR (mémoriser)', () => { latch = reg.slice(); strPulse = 0.3; });
    const clk = sim.clock(sim.section('Horloge CLK (broche 3)'), { freq: 2 });
    let reg = new Array(8).fill(0), latch = new Array(8).fill(0), n = 0, strPulse = 0;
    const pattern = [1, 0, 1, 1, 0, 0, 1, 0, 0, 0];
    clk.onFall(() => { if (auto.value) d.set(pattern[n++ % pattern.length]); });
    clk.onRise(() => { reg = [d.value ? 1 : 0, ...reg.slice(0, 7)]; });
    sim.onStep(dt => {
        strPulse = Math.max(0, strPulse - dt);
        if (str.value || strPulse > 0) latch = reg.slice();
    });
    const strLvl = () => str.value || strPulse > 0;
    const cells = sim.cells(sim.boardRow('Registre interne'), reg.map((_, i) => 'S' + (i + 1)));
    const leds = sim.leds(sim.boardRow('Sorties Q1-Q8'), [4, 5, 6, 7, 14, 13, 12, 11].map((p, i) => `Q${i + 1}<br><small>${p}</small>`), 'orange');
    sim.onRender(() => {
        reg.forEach((v, i) => cells.set(i, v));
        latch.forEach((v, i) => leds.set(i, oe.value && v));
    });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'REGISTRE + VERROU',
        left: [
            { pin: 2, label: 'D', get: () => d.value, click: () => d.el.click() },
            { pin: 3, label: 'CLK', kind: 'clk', get: () => clk.level },
            { pin: 1, label: 'STR', get: strLvl, click: () => str.el.click() },
            { pin: 15, label: 'OE', get: () => oe.value, click: () => oe.el.click() }
        ],
        right: [...[4, 5, 6, 7, 14, 13, 12, 11].map((p, i) => ({ pin: p, label: 'Q' + (i + 1), get: () => oe.value && latch[i] })),
            { pin: 9, label: 'QS', get: () => reg[7] }]
    });
    sim.scope({
        mode: 'lanes', window: 12,
        traces: [{ label: 'CLK', get: () => clk.level }, { label: 'DATA', get: () => d.value, color: '#c8d5d5' },
            { label: 'STR', get: strLvl, color: '#e67e22' },
            ...[0, 1, 2, 7].map(i => ({ label: 'Q' + (i + 1), get: () => oe.value && latch[i] })),
            { label: 'QS', get: () => reg[7], color: '#ff7eb6' }]
    });
};

/* Interrupteur analogique (4016 / 4066) */
LogicSim.scenarios.aswitch = (sim, o) => {
    const sec = sim.section('Commande');
    const g = sim.group(sec);
    const ctl = sim.toggle(g, '1CTL <small>broche 13</small>', true);
    const auto = sim.toggle(g, 'Commande en créneaux 0,25 Hz', false);
    ctl.el.addEventListener('click', () => auto.set(false));
    const secS = sim.section('Montage');
    const rl = sim.slider(secS, 'Résistance de charge (sortie → masse)', {
        min: 1e3, max: 1e5, value: 1e4, log: true, format: v => LS.ohm(v), round: v => Math.round(v / 100) * 100
    });
    sim.note(secS, `Ron ≈ ${LS.ohm(o.ron)} à 5 V : la charge et Ron forment un diviseur de tension.`);
    sim.onStep((dt, t) => { if (auto.value) ctl.set(LS.sq(t * 0.25) === 1); });
    const vin = () => 0.5 + 4 * LS.wave.sine(sim.t * 1);
    const vout = () => (ctl.value ? vin() * rl.value / (rl.value + o.ron) : 0);
    const row = sim.boardRow('Mesures');
    const rs = sim.readout(row, 'Interrupteur');
    const ra = sim.readout(row, 'Transmission');
    sim.onRender(() => {
        rs.set(ctl.value ? '<strong>fermé</strong>' : 'ouvert');
        ra.set(ctl.value ? LS.num(100 * rl.value / (rl.value + o.ron), 3) + ' %' : '0 %');
    });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'interrupteur 1',
        left: [
            { pin: 1, label: '1E/S', kind: 'sig', text: '0-5 V', get: () => true },
            { pin: 13, label: '1CTL', get: () => ctl.value, click: () => ctl.el.click() }
        ],
        right: [{ pin: 2, label: '1S/E', kind: 'probe', text: () => LS.num(vout(), 2) + ' V' }]
    });
    sim.scope({
        mode: 'overlay', min: 0, max: 5, window: 8,
        traces: [
            { label: 'Entrée 1E/S (1)', get: vin, color: '#4ecdc4' },
            { label: 'CTL', get: () => (ctl.value ? 4.9 : 0.1), color: 'rgba(230,126,34,0.7)' },
            { label: 'Sortie 1S/E (2)', get: vout, color: '#f7e36a' }
        ]
    });
};

/* Multiplexeurs analogiques (4051 / 4052 / 4053) */
LogicSim.scenarios.amux = (sim, o) => {
    const W = LS.wave;
    const sig = (name, f) => {
        if (typeof name === 'number') return () => name;
        return () => 0.3 + 4.4 * W[name](sim.t * f);
    };
    const sec = sim.section('Adresse');
    const g = sim.group(sec);
    const sels = o.select.map(([n, p]) => sim.toggle(g, `${n} <small>broche ${p}</small>`, false));
    const inh = sim.toggle(g, 'INH <small>broche 6</small>', false);
    const auto = sim.toggle(sim.group(sec), 'Balayage automatique', true);
    sels.forEach(t => t.el.addEventListener('click', () => auto.set(false)));
    let acc = 0, step = 0;
    sim.onStep(dt => {
        if (!auto.value) return;
        acc += dt;
        if (acc >= 2) {
            acc = 0;
            step = (step + 1) % (1 << sels.length);
            sels.forEach((t, i) => t.set((step >> i) & 1));
        }
    });
    const addr = () => sels.reduce((a, t, i) => a | (t.value ? 1 << i : 0), 0);

    const outs = o.outputs.map(out => {
        const chans = out.channels.map(c => ({ ...c, get: sig(c.sig, c.f || 0.5) }));
        return { ...out, chans };
    });
    const selected = out => {
        if (inh.value) return null;
        const idx = out.bit !== undefined ? (addr() >> out.bit) & 1 : addr();
        return out.chans[idx];
    };
    const value = out => { const c = selected(out); return c ? c.get() : NaN; };

    outs.forEach(out => {
        const row = sim.boardRow(`${out.name} (broche ${out.pin})`);
        out.leds = sim.leds(row, out.chans.map(c => `${c.name}<br><small>${c.desc}</small>`));
    });
    sim.onRender(() => {
        outs.forEach(out => {
            const c = selected(out);
            out.chans.forEach((x, i) => out.leds.set(i, x === c));
        });
    });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'MULTIPLEXEUR',
        left: [...outs.flatMap(out => out.chans.map(c => ({
            pin: LS.pin(o, c.name), label: c.name, kind: 'sig', text: c.desc, get: () => selected(out) === c
        }))),
        ...o.select.map(([nm, p], i) => ({ pin: p, label: nm, get: () => sels[i].value, click: () => sels[i].el.click() })),
        { pin: 6, label: 'INH', get: () => inh.value, click: () => inh.el.click() }],
        right: outs.map(out => ({
            pin: out.pin, label: out.name.replace(' ', ''), kind: 'probe',
            text: () => { const v = value(out); return isNaN(v) ? 'ouvert' : LS.num(v, 2) + ' V'; }
        }))
    });
    sim.scope({
        mode: 'overlay', min: 0, max: 5, window: 8,
        traces: outs.map((out, i) => ({ label: out.name, get: () => value(out), color: LS.colors[i] }))
    });
};

/* Décodeur BCD → décimal (4028) */
LogicSim.scenarios.bcd10 = (sim, o) => {
    const sec = sim.section('Entrées BCD');
    const g = sim.group(sec);
    const bits = [['A', 10], ['B', 13], ['C', 12], ['D', 11]].map(([n, p]) => sim.toggle(g, `${n} <small>broche ${p}</small>`, false));
    const auto = sim.toggle(sim.group(sec), 'Comptage automatique 0 → 15', true);
    bits.forEach(t => t.el.addEventListener('click', () => auto.set(false)));
    sim.note(sec, 'Les codes 10 à 15 ne sont pas des chiffres BCD : aucune sortie ne s\'allume.');
    let acc = 0, n = 0;
    sim.onStep(dt => {
        if (!auto.value) return;
        acc += dt;
        if (acc >= 0.8) { acc = 0; n = (n + 1) % 16; bits.forEach((t, i) => t.set((n >> i) & 1)); }
    });
    const val = () => bits.reduce((a, t, i) => a | (t.value ? 1 << i : 0), 0);
    const pins = [3, 14, 2, 15, 1, 6, 7, 4, 9, 5];
    const leds = sim.leds(sim.boardRow('Sorties'), pins.map((p, i) => `Q${i}<br><small>${p}</small>`), 'orange');
    const rv = sim.readout(sim.boardRow('Code'), 'Entrée DCBA');
    sim.onRender(() => {
        const v = val();
        pins.forEach((_, i) => leds.set(i, v === i));
        rv.set(`${v.toString(2).padStart(4, '0')} = ${v}`);
    });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'BCD → 1 parmi 10',
        left: [['A', 10], ['B', 13], ['C', 12], ['D', 11]].map(([nm, p], i) => ({
            pin: p, label: nm, get: () => bits[i].value, click: () => bits[i].el.click()
        })),
        right: pins.map((p, i) => ({ pin: p, label: 'Q' + i, get: () => val() === i }))
    });
    sim.scope({
        mode: 'lanes', window: 14,
        traces: [...bits.map((t, i) => ({ label: 'ABCD'[i], get: () => t.value, color: '#c8d5d5' })),
            ...pins.map((_, i) => ({ label: 'Q' + i, get: () => val() === i, color: i % 2 ? '#4ecdc4' : '#f7e36a' }))]
    });
};

/* Décodeur BCD → 7 segments (4511) */
LogicSim.scenarios.bcd7 = (sim, o) => {
    const SEG4511 = LS.SEG.slice(0, 10);
    SEG4511[6] = 0x7C;  // le 4511 affiche le 6 sans barre du haut
    SEG4511[9] = 0x67;  // et le 9 sans barre du bas
    const sec = sim.section('Entrées BCD');
    const g = sim.group(sec);
    const bits = [['A', 7], ['B', 1], ['C', 2], ['D', 6]].map(([n, p]) => sim.toggle(g, `${n} <small>broche ${p}</small>`, false));
    const secC = sim.section('Entrées de contrôle');
    const gc = sim.group(secC);
    const lt = sim.toggle(gc, '<span class="over">LT</span> <small>broche 3</small>', true);
    const bl = sim.toggle(gc, '<span class="over">BL</span> <small>broche 4</small>', true);
    const le = sim.toggle(gc, 'LE <small>broche 5</small>', false);
    const auto = sim.toggle(sim.group(secC), 'Comptage automatique', false);
    sim.note(secC, '<span class="over">LT</span> = 0 : test, tous les segments s\'allument. <span class="over">BL</span> = 0 : afficheur éteint. LE = 1 : l\'affichage est figé (mémorisé). Codes 10 à 15 : afficheur éteint.');
    let acc = 0, n = 0, latched = 0;
    sim.onStep(dt => {
        if (auto.value) {
            acc += dt;
            if (acc >= 0.8) { acc = 0; n = (n + 1) % 10; bits.forEach((t, i) => t.set((n >> i) & 1)); }
        }
        if (!le.value) latched = bits.reduce((a, t, i) => a | (t.value ? 1 << i : 0), 0);
    });
    const seg = () => {
        if (!lt.value) return 0x7F;
        if (!bl.value) return 0;
        return latched <= 9 ? SEG4511[latched] : 0;
    };
    const row = sim.boardRow('Afficheur à cathode commune');
    const d = sim.seg7(row, 1);
    const rv = sim.readout(sim.boardRow('Code'), 'Entrée DCBA');
    sim.onRender(() => {
        d.set(0, seg());
        const v = bits.reduce((a, t, i) => a | (t.value ? 1 << i : 0), 0);
        rv.set(`${v.toString(2).padStart(4, '0')} = ${v}`);
    });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'BCD → 7 seg.',
        left: [...[['A', 7], ['B', 1], ['C', 2], ['D', 6]].map(([nm, p], i) => ({
            pin: p, label: nm, get: () => bits[i].value, click: () => bits[i].el.click()
        })),
        { pin: 3, label: '~LT', get: () => lt.value, click: () => lt.el.click() },
        { pin: 4, label: '~BL', get: () => bl.value, click: () => bl.el.click() },
        { pin: 5, label: 'LE', get: () => le.value, click: () => le.el.click() }],
        right: [['a', 13], ['b', 12], ['c', 11], ['d', 10], ['e', 9], ['f', 15], ['g', 14]].map(([nm, p], i) => ({
            pin: p, label: nm, kind: 'seg', get: () => (seg() >> i) & 1
        })),
        display: seg
    });
    sim.scope({
        mode: 'lanes', window: 12,
        traces: [...bits.map((t, i) => ({ label: 'ABCD'[i], get: () => t.value, color: '#c8d5d5' })),
            ...'abcdefg'.split('').map((s, i) => ({ label: s, get: () => (seg() >> i) & 1, color: i % 2 ? '#4ecdc4' : '#f7e36a' }))]
    });
};

/* Additionneur 4 bits (4008) */
LogicSim.scenarios.adder = (sim, o) => {
    const secA = sim.section('Nombre A');
    const ga = sim.group(secA);
    const A = [7, 5, 3, 1].map((p, i) => sim.toggle(ga, `A${i + 1} <small>${p}</small>`, [1, 0, 1, 0][i]));
    const secB = sim.section('Nombre B');
    const gb = sim.group(secB);
    const B = [6, 4, 2, 15].map((p, i) => sim.toggle(gb, `B${i + 1} <small>${p}</small>`, [1, 1, 0, 0][i]));
    const ci = sim.toggle(sim.group(sim.section('Retenue d\'entrée')), 'CI <small>broche 9</small>', false);
    const auto = sim.toggle(sim.group(sim.controls.lastChild), 'Valeurs aléatoires', false);
    let acc = 0;
    sim.onStep(dt => {
        if (!auto.value) return;
        acc += dt;
        if (acc >= 1.2) {
            acc = 0;
            A.forEach(t => t.set(Math.random() < 0.5));
            B.forEach(t => t.set(Math.random() < 0.5));
        }
    });
    const num = arr => arr.reduce((a, t, i) => a | (t.value ? 1 << i : 0), 0);
    const sum = () => num(A) + num(B) + (ci.value ? 1 : 0);
    const leds = sim.leds(sim.boardRow('Sorties'), ['CO (14)', 'S4 (13)', 'S3 (12)', 'S2 (11)', 'S1 (10)']);
    const r = sim.readout(sim.boardRow('Calcul'), 'A + B + CI');
    sim.onRender(() => {
        const s = sum();
        [4, 3, 2, 1, 0].forEach((b, i) => leds.set(i, (s >> b) & 1));
        r.set(`${num(A)} + ${num(B)} + ${ci.value ? 1 : 0} = <strong>${s}</strong> <small>(${s.toString(2).padStart(5, '0')})</small>`);
    });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'A + B + CI',
        left: [...[7, 5, 3, 1].map((p, i) => ({ pin: p, label: 'A' + (i + 1), get: () => A[i].value, click: () => A[i].el.click() })),
            ...[6, 4, 2, 15].map((p, i) => ({ pin: p, label: 'B' + (i + 1), get: () => B[i].value, click: () => B[i].el.click() })),
            { pin: 9, label: 'CI', get: () => ci.value, click: () => ci.el.click() }],
        right: [...[10, 11, 12, 13].map((p, b) => ({ pin: p, label: 'S' + (b + 1), get: () => (sum() >> b) & 1 })),
            { pin: 14, label: 'CO', get: () => (sum() >> 4) & 1 }]
    });
    sim.scope({
        mode: 'lanes', window: 10,
        traces: [{ label: 'A1', get: () => A[0].value, color: '#c8d5d5' }, { label: 'B1', get: () => B[0].value, color: '#c8d5d5' },
            ...[0, 1, 2, 3].map(b => ({ label: 'S' + (b + 1), get: () => (sum() >> b) & 1 })),
            { label: 'CO', get: () => (sum() >> 4) & 1, color: '#e67e22' }]
    });
};

/* Boucle à verrouillage de phase (4046) */
LogicSim.scenarios.pll = (sim, o) => {
    const sec = sim.section('Signal d\'entrée (broche 14)');
    const fin = sim.slider(sec, 'Fréquence', { min: 100, max: 2500, step: 10, value: 800, format: v => LS.freq(v) });
    const range = sim.choice(sim.section('Plage du VCO (R1, C1, R2)'), '', [
        { value: 0, label: '300 Hz – 1,2 kHz' }, { value: 1, label: '600 Hz – 2,4 kHz' }
    ], 0);
    sim.note(sim.controls.lastChild, 'Comparateur de phase PC2 (broche 13) filtré par R-C vers VCOIN (broche 9) ; VCOOUT (4) relié à COMPIN (3).');
    const ranges = [[300, 1200], [600, 2400]];
    let fv = 300, phi = 0.37;
    sim.onStep(dt => {
        const [fmin, fmax] = ranges[range.value];
        const target = Math.min(fmax, Math.max(fmin, fin.value));
        fv += (target - fv) * (1 - Math.exp(-dt / 0.5));
        if (Math.abs(fv - fin.value) / fin.value < 0.01) phi *= Math.exp(-dt / 0.4);
        else phi = (phi + (fv - fin.value) * dt * 0.02) % 1;
    });
    const locked = () => Math.abs(fv - fin.value) / fin.value < 0.01;
    const row = sim.boardRow('Mesures');
    const rv = sim.readout(row, 'Fréquence du VCO');
    const ru = sim.readout(row, 'Tension VCOIN');
    const led = sim.leds(sim.boardRow('État'), ['Verrouillé']);
    sim.onRender(() => {
        const [fmin, fmax] = ranges[range.value];
        rv.set(LS.freq(fv));
        ru.set(LS.num(5 * (fv - fmin) / (fmax - fmin), 2) + ' V');
        led.set(0, locked());
    });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'PLL',
        left: [
            { pin: 14, label: 'SIN', kind: 'sig', text: () => LS.freq(fin.value), get: () => true },
            { pin: 3, label: 'CIN', kind: 'fixed', text: '← VCO', get: () => false },
            { pin: 5, label: 'INH', kind: 'fixed', text: '0 V', get: () => false },
            { pin: 11, label: 'R1', kind: 'part', text: 'R1' },
            { pin: 6, label: 'C1A', kind: 'xtal', cap: true, text: 'C1' },
            { pin: 7, label: 'C1B', kind: 'xtal-end' },
            { pin: 9, label: 'VCOIN', kind: 'part', text: () => LS.num(5 * (fv - ranges[range.value][0]) / (ranges[range.value][1] - ranges[range.value][0]), 2) + ' V' }
        ],
        right: [
            { pin: 4, label: 'VCO', kind: 'probe', text: () => LS.freq(fv) },
            { pin: 13, label: 'PC2', kind: 'probe', text: () => (locked() ? 'verrouillé' : 'correction…') },
            { pin: 1, label: 'PP', get: () => (locked() ? 1 : 'fast') }
        ]
    });
    sim.scope({
        mode: 'lanes', analytic: true,
        window: () => 5 / fin.value, t0: () => 5 / fin.value,
        traces: [
            { label: 'SIGIN', fn: t => LS.sq(fin.value * t) },
            { label: 'VCOOUT', fn: t => LS.sq(fv * t + phi), bold: true },
            { label: 'PC2', fn: t => (LS.sq(fin.value * t) !== LS.sq(fv * t + phi) ? 1 : 0), color: '#e67e22' }
        ],
        info: () => LS.time(0.5 / fin.value) + ' / div'
    });
};

/* Multivibrateur astable (4047) */
LogicSim.scenarios.astable4047 = (sim, o) => {
    const sec = sim.section('Composants');
    const R = sim.slider(sec, 'R (broches 2 – 3)', {
        min: 1e4, max: 1e6, value: 1e5, log: true, format: v => LS.ohm(v), round: v => Math.round(v / 1e3) * 1e3
    });
    const C = sim.choice(sec, 'C (broches 1 – 3)', [
        { value: 1e-7, label: '100 nF' }, { value: 1e-6, label: '1 µF' }, { value: 1e-5, label: '10 µF' }
    ], 1e-6);
    const en = sim.toggle(sim.group(sim.section('Validation')), 'ASTABLE <small>broche 5</small>', true);
    const fQ = () => 1 / (4.4 * R.value * C.value);
    let t = 0;
    sim.onStep(dt => { if (en.value) t += dt; });
    const row = sim.boardRow('Mesures');
    const rf = sim.readout(row, 'Fréquence Q (f = 1 / 4,4·R·C)');
    const ro = sim.readout(row, 'Fréquence OSC (2·f)');
    const leds = sim.leds(sim.boardRow('Sorties'), ['Q (10)', 'Q̄ (11)']);
    const q = tt => (en.value ? LS.sq(fQ() * tt) : 0);
    sim.onRender(() => {
        const f = fQ();
        rf.set(en.value ? LS.freq(f) : 'arrêté');
        ro.set(en.value ? LS.freq(2 * f) : 'arrêté');
        const a = en.value ? LS.blink(f, q(t)) : 0;
        const b = en.value ? LS.blink(f, 1 - q(t)) : 1;
        leds.set(0, a, a === 'fast');
        leds.set(1, b, b === 'fast');
    });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'ASTABLE',
        left: [
            { pin: 1, label: 'C', kind: 'xtal', cap: true, text: () => LS.farad(C.value) },
            { pin: 3, label: 'RC', kind: 'xtal-end' },
            { pin: 2, label: 'R', kind: 'part', text: () => LS.ohm(R.value) },
            { pin: 4, label: '~AST', kind: 'fixed', text: '+5 V', get: () => true },
            { pin: 5, label: 'AST', get: () => en.value, click: () => en.el.click() },
            { pin: 9, label: 'RST', kind: 'fixed', text: '0 V', get: () => false }
        ],
        right: [
            { pin: 10, label: 'Q', get: () => (en.value ? LS.blink(fQ(), q(t)) : 0) },
            { pin: 11, label: '~Q', get: () => (en.value ? LS.blink(fQ(), 1 - q(t)) : 1) },
            { pin: 13, label: 'OSC', get: () => (en.value ? LS.blink(2 * fQ(), LS.sq(2 * fQ() * t)) : 0) }
        ]
    });
    sim.scope({
        mode: 'lanes', analytic: true,
        window: () => 4 / fQ(),
        t0: () => t * Math.min(1, 0.5 / fQ()),
        traces: [
            { label: 'OSC', fn: tt => (en.value ? LS.sq(2 * fQ() * tt) : 0), color: '#4ecdc4' },
            { label: 'Q', fn: q, bold: true },
            { label: 'Q̄', fn: tt => (en.value ? 1 - q(tt) : 1) }
        ],
        info: () => LS.time(0.4 / fQ()) + ' / div'
    });
};

/* Monostable de précision (4538) */
LogicSim.scenarios.mono4538 = (sim, o) => {
    const sec = sim.section('Composants');
    const R = sim.slider(sec, 'Rx (broches 2 – VDD)', {
        min: 1e4, max: 1e6, value: 1e5, log: true, format: v => LS.ohm(v), round: v => Math.round(v / 1e3) * 1e3
    });
    const C = sim.choice(sec, 'Cx (broches 1 – 2)', [
        { value: 1e-6, label: '1 µF' }, { value: 4.7e-6, label: '4,7 µF' }, { value: 1e-5, label: '10 µF' }
    ], 1e-5);
    const secT = sim.section('Déclenchement');
    let trig = 0, rem = 0;
    sim.button(secT, 'Front montant sur +TR (broche 4)', () => { trig = 0.15; rem = R.value * C.value; });
    sim.button(secT, 'Remise à zéro R̄ (broche 3)', () => { rem = 0; });
    sim.note(secT, 'Redéclenchable : un nouveau front pendant l\'impulsion la prolonge.');
    sim.onStep(dt => {
        trig = Math.max(0, trig - dt);
        rem = Math.max(0, rem - dt);
    });
    const tw = () => R.value * C.value;
    const row = sim.boardRow('Mesures');
    const rt = sim.readout(row, 'Durée de l\'impulsion (T = Rx·Cx)');
    const rr = sim.readout(row, 'Temps restant');
    const leds = sim.leds(sim.boardRow('Sorties'), ['Q1 (6)', 'Q̄1 (7)']);
    sim.onRender(() => {
        rt.set(LS.time(tw()));
        rr.set(rem > 0 ? LS.time(rem) : '—');
        leds.set(0, rem > 0);
        leds.set(1, rem <= 0);
    });
    let rFlash = 0;
    sim.onStep(dt => { rFlash = Math.max(0, rFlash - dt); });
    sim.schematic({
        chip: o.chip, vdd: o.vdd, vss: o.vss, inner: 'monostable 1',
        left: [
            { pin: 1, label: 'CX1', kind: 'xtal', cap: true, text: () => LS.farad(C.value) },
            { pin: 2, label: 'RC1', kind: 'xtal-end' },
            { label: '', kind: 'part', text: () => 'Rx ' + LS.ohm(R.value) + ' → VDD' },
            { pin: 3, label: '~R1', get: () => rFlash <= 0, click: () => { rem = 0; rFlash = 0.3; } },
            { pin: 4, label: '+T1', get: () => trig > 0, click: () => { trig = 0.15; rem = R.value * C.value; } },
            { pin: 5, label: '-T1', kind: 'fixed', text: '+5 V', get: () => true }
        ],
        right: [{ pin: 6, label: 'Q1', get: () => rem > 0 }, { pin: 7, label: '~Q1', get: () => rem <= 0 }]
    });
    sim.scope({
        mode: 'lanes',
        window: () => Math.min(30, Math.max(4, 2.5 * tw())),
        traces: [
            { label: '+TR', get: () => trig > 0, color: '#c8d5d5' },
            { label: 'Q1', get: () => rem > 0, bold: true },
            { label: 'Q̄1', get: () => rem <= 0, color: '#4ecdc4' }
        ]
    });
};

/* ========================================================================
   Brochage interactif des fiches (data-chip-live)
   Le SVG du brochage est intégré dans la page : chaque broche est un
   <g class="pin" data-pin="n">. Les entrées logiques deviennent cliquables
   (mode manuel) ou sont pilotées automatiquement (mode auto, par défaut).
   ======================================================================== */

const ChipModels = (() => {
    const ck = (t, p) => ((t % p) < p / 2 ? 0 : 1);            // horloge de période p
    const st = (t, p) => Math.floor(t / p);                     // n° de pas
    const pulse = (t, p, w) => ((t % p) < w ? 1 : 0);           // impulsion de largeur w
    const bus = (io, names) => names.reduce((v, n, i) => v | ((io[n] ? 1 : 0) << i), 0);
    const setBus = (o, names, v) => names.forEach((n, i) => { o[n] = (v >> i) & 1; });
    const range = (pre, a, b, post = '') => Array.from({ length: b - a + 1 }, (_, i) => pre + (a + i) + post);
    const SEG7 = LS.SEG.slice(0, 10);
    const SEG4511 = SEG7.slice(); SEG4511[6] = 0x7C; SEG4511[9] = 0x67;
    const SEGN = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

    const M = {};

    // --- Portes : déduites du brochage (nA, nB… → nY) ---
    M.gates = (pins, o) => {
        const groups = {};
        pins.forEach(p => {
            const m = /^(\d)([A-DY])$/.exec(p);
            if (!m) return;
            const g = groups[m[1]] || (groups[m[1]] = { ins: [], out: null });
            if (m[2] === 'Y') g.out = p; else g.ins.push(p);
        });
        const list = Object.values(groups).filter(g => g.out);
        const fn = {
            and: v => v.every(x => x), nand: v => !v.every(x => x),
            or: v => v.some(x => x), nor: v => !v.some(x => x),
            xor: v => v.filter(x => x).length % 2 === 1, xnor: v => v.filter(x => x).length % 2 === 0,
            not: v => !v[0], buf: v => !!v[0]
        }[o.type];
        return {
            inputs: list.flatMap(g => g.ins),
            eval(io, out) { list.forEach(g => { out[g.out] = fn(g.ins.map(n => io[n])) ? 1 : 0; }); },
            auto(t, io) {
                list.forEach((g, k) => setBus(io, g.ins, st(t + k * 0.37, 0.9) + k));
            }
        };
    };

    // --- Bascules D (4013) et JK (4027) ---
    M.ff = (pins, o) => ({
        inputs: [1, 2].flatMap(k => (o.jk ? ['J', 'K'] : ['D']).concat(['CLK', 'S', 'R']).map(n => k + n)),
        init: s => { s.q = { 1: 0, 2: 0 }; },
        eval(io, out, s, ev) {
            [1, 2].forEach(k => {
                const S = io[k + 'S'], R = io[k + 'R'];
                if (S || R) {
                    s.q[k] = S ? 1 : 0;
                } else if (ev.rise(k + 'CLK')) {
                    if (!o.jk) s.q[k] = io[k + 'D'] ? 1 : 0;
                    else {
                        const J = io[k + 'J'], K = io[k + 'K'];
                        s.q[k] = J && K ? 1 - s.q[k] : J ? 1 : K ? 0 : s.q[k];
                    }
                }
                out[k + 'Q'] = s.q[k];
                out['~' + k + 'Q'] = S && R ? 1 : 1 - s.q[k];
            });
        },
        auto(t, io) {
            [1, 2].forEach(k => {
                io[k + 'CLK'] = ck(t, k === 1 ? 1 : 1.4);
                if (o.jk) setBus(io, [k + 'J', k + 'K'], st(t, 2.8) + k);
                else io[k + 'D'] = st(t, k === 1 ? 2.3 : 3.1) % 2;
            });
        }
    });

    // --- 4017 : compteur Johnson ---
    M.johnson = () => ({
        inputs: ['CLK', '~EN', 'RST'],
        init: s => { s.c = 0; },
        eval(io, out, s, ev) {
            if (io.RST) s.c = 0;
            else if (ev.rise('CLK') && !io['~EN']) s.c = (s.c + 1) % 10;
            for (let i = 0; i < 10; i++) out['Q' + i] = s.c === i ? 1 : 0;
            out.CO = s.c < 5 ? 1 : 0;
        },
        auto(t, io) { io.CLK = ck(t, 0.7); }
    });

    // --- Compteurs binaires asynchrones (4020, 4024, 4040, 4060) ---
    M.ripple = (pins, o) => {
        const qs = pins.filter(p => /^Q\d+$/.test(p));
        const clk = o.clk;
        return {
            inputs: [clk, 'RST'],
            init: s => { s.c = 0; },
            eval(io, out, s, ev) {
                if (io.RST) s.c = 0;
                else if (ev.fall(clk)) s.c = (s.c + 1) % (1 << 14);
                qs.forEach(q => { out[q] = (s.c >> (parseInt(q.slice(1), 10) - 1)) & 1; });
                if (o.osc) { out['φO'] = io[clk] ? 0 : 1; out['~φO'] = io[clk] ? 1 : 0; }
            },
            auto(t, io) { io[clk] = ck(t, o.period || 0.15); }
        };
    };

    // --- 4026 : compteur décimal 7 segments ---
    M.c4026 = () => ({
        inputs: ['CLK', 'INH', 'RST', 'DEI'],
        defaults: { DEI: 1 },
        init: s => { s.c = 0; },
        eval(io, out, s, ev) {
            if (io.RST) s.c = 0;
            else if (ev.rise('CLK') && !io.INH) s.c = (s.c + 1) % 10;
            const seg = SEG7[s.c];
            SEGN.forEach((n, i) => { out[n] = io.DEI ? (seg >> i) & 1 : 0; });
            out["c'"] = (seg >> 2) & 1;
            out.DEO = io.DEI ? 1 : 0;
            out.CO = s.c < 5 ? 1 : 0;
        },
        auto(t, io) { io.CLK = ck(t, 0.8); }
    });

    // --- 4029 / 4510 : compteurs haut / bas préréglables ---
    M.updown = (pins, o) => {
        const P = range('P', 1, 4), Q = range('Q', 1, 4);
        return {
            inputs: ['CLK', 'U/~D', 'PE', '~CI'].concat(o.rst ? ['RST'] : ['B/~D']).concat(P),
            defaults: { 'U/~D': 1, 'B/~D': 1 },
            init: s => { s.c = 0; },
            eval(io, out, s, ev) {
                const mod = o.rst || !io['B/~D'] ? 10 : 16;
                const up = !!io['U/~D'];
                if (io.RST) s.c = 0;
                else if (io.PE) s.c = bus(io, P) % mod;
                else if (ev.rise('CLK') && !io['~CI']) s.c = (s.c + (up ? 1 : mod - 1)) % mod;
                setBus(out, Q, s.c);
                out['~CO'] = !io['~CI'] && (up ? s.c === mod - 1 : s.c === 0) ? 0 : 1;
            },
            auto(t, io) { io.CLK = ck(t, 0.7); io['U/~D'] = st(t, 0.7 * 20) % 2 ? 0 : 1; }
        };
    };

    // --- 4518 / 4520 : deux compteurs synchrones ---
    M.dual = (pins, o) => ({
        inputs: ['A', 'B'].flatMap(x => ['CLK' + x, 'EN' + x, 'RST' + x]),
        defaults: { ENA: 1, ENB: 1 },
        init: s => { s.c = { A: 0, B: 0 }; },
        eval(io, out, s, ev) {
            ['A', 'B'].forEach(x => {
                const mod = o.bcd ? 10 : 16;
                if (io['RST' + x]) s.c[x] = 0;
                else if ((ev.rise('CLK' + x) && io['EN' + x]) || (ev.fall('EN' + x) && !io['CLK' + x])) {
                    s.c[x] = (s.c[x] + 1) % mod;
                }
                setBus(out, range('Q', 1, 4, x), s.c[x]);
            });
        },
        auto(t, io) { io.CLKA = ck(t, 0.6); io.CLKB = ck(t, 1.5); }
    });

    // --- 4014 / 4021 : registres parallèle → série ---
    M.piso = (pins, o) => {
        const P = range('P', 1, 8);
        return {
            inputs: ['CLK', 'P/~S', 'SER'].concat(P),
            init: s => { s.r = 0; },
            eval(io, out, s, ev) {
                if (io['P/~S'] && (o.async_ || ev.rise('CLK'))) s.r = bus(io, P);
                else if (ev.rise('CLK') && !io['P/~S']) s.r = ((s.r << 1) | (io.SER ? 1 : 0)) & 255;
                out.Q6 = (s.r >> 5) & 1; out.Q7 = (s.r >> 6) & 1; out.Q8 = (s.r >> 7) & 1;
            },
            auto(t, io) {
                const k = st(t, 0.8);
                io.CLK = ck(t, 0.8);
                io['P/~S'] = k % 9 === 0 ? 1 : 0;
                setBus(io, P, [0xB5, 0x4E, 0xF0, 0x2D][st(t, 7.2) % 4]);
            }
        };
    };

    // --- 4015 : deux registres série → parallèle ---
    M.sipo = () => ({
        inputs: ['A', 'B'].flatMap(x => ['D' + x, 'CLK' + x, 'RST' + x]),
        init: s => { s.r = { A: 0, B: 0 }; },
        eval(io, out, s, ev) {
            ['A', 'B'].forEach(x => {
                if (io['RST' + x]) s.r[x] = 0;
                else if (ev.rise('CLK' + x)) s.r[x] = ((s.r[x] << 1) | (io['D' + x] ? 1 : 0)) & 15;
                setBus(out, range('Q', 1, 4, x), s.r[x]);
            });
        },
        auto(t, io) {
            io.CLKA = ck(t, 0.7); io.DA = [1, 0, 1, 1, 0, 0][st(t, 0.7) % 6];
            io.CLKB = ck(t, 1.1); io.DB = st(t, 2.2) % 2;
        }
    });

    // --- 4094 : registre 8 bits + verrou + sorties 3 états ---
    M.c4094 = () => ({
        inputs: ['D', 'CLK', 'STR', 'OE'],
        defaults: { STR: 1, OE: 1 },
        init: s => { s.r = 0; s.l = 0; s.qp = 0; },
        eval(io, out, s, ev) {
            if (ev.rise('CLK')) s.r = ((s.r << 1) | (io.D ? 1 : 0)) & 255;
            if (ev.fall('CLK')) s.qp = (s.r >> 7) & 1;
            if (io.STR) s.l = s.r;
            for (let i = 0; i < 8; i++) out['Q' + (i + 1)] = io.OE ? (s.l >> i) & 1 : 'Z';
            out.QS = (s.r >> 7) & 1;
            out["Q'S"] = s.qp;
        },
        auto(t, io) {
            const k = st(t, 0.6);
            io.CLK = ck(t, 0.6);
            io.D = [1, 1, 0, 1, 0, 0, 1, 0, 0, 0][k % 10];
            io.STR = k % 8 === 7 ? 1 : 0;
        }
    });

    // --- 4016 / 4066 : interrupteurs analogiques ---
    M.switches = () => {
        const ks = [1, 2, 3, 4];
        return {
            inputs: ks.flatMap(k => [k + 'CTL', k + 'E/S']),
            eval(io, out) { ks.forEach(k => { out[k + 'S/E'] = io[k + 'CTL'] ? io[k + 'E/S'] : 'Z'; }); },
            auto(t, io) {
                ks.forEach(k => { io[k + 'CTL'] = st(t + k * 0.9, 3.6) % 2; io[k + 'E/S'] = ck(t, 0.5 + 0.2 * k); });
            }
        };
    };

    // --- 4051 / 4052 / 4053 : multiplexeurs analogiques ---
    M.amux = (pins, o) => {
        const sel = o.sel;
        return {
            inputs: sel.concat(['INH']).concat(o.groups.map(g => g.com)),
            eval(io, out) {
                o.groups.forEach((g, gi) => {
                    const k = o.perGroup ? (io[sel[gi]] ? 1 : 0) : bus(io, sel);
                    g.ch.forEach((c, i) => { out[c] = !io.INH && k === i ? io[g.com] : 'Z'; });
                });
            },
            auto(t, io) {
                if (o.perGroup) sel.forEach((n, i) => { io[n] = st(t + i * 0.8, 2.4) % 2; });
                else setBus(io, sel, st(t, 1.2));
                o.groups.forEach((g, i) => { io[g.com] = ck(t, 0.4 + 0.15 * i); });
            }
        };
    };

    // --- 4028 : décodeur 1 parmi 10 ---
    M.c4028 = () => ({
        inputs: ['A', 'B', 'C', 'D'],
        eval(io, out) {
            const v = bus(io, ['A', 'B', 'C', 'D']);
            for (let i = 0; i < 10; i++) out['Q' + i] = v === i ? 1 : 0;
        },
        auto(t, io) { setBus(io, ['A', 'B', 'C', 'D'], st(t, 0.8) % 12); }
    });

    // --- 4511 : décodeur BCD → 7 segments avec verrou ---
    M.c4511 = () => ({
        inputs: ['A', 'B', 'C', 'D', '~LT', '~BL', 'LE'],
        defaults: { '~LT': 1, '~BL': 1 },
        init: s => { s.v = 0; },
        eval(io, out, s) {
            if (!io.LE) s.v = bus(io, ['A', 'B', 'C', 'D']);
            const seg = !io['~LT'] ? 0x7F : !io['~BL'] || s.v > 9 ? 0 : SEG4511[s.v];
            SEGN.forEach((n, i) => { out[n] = (seg >> i) & 1; });
        },
        auto(t, io) { setBus(io, ['A', 'B', 'C', 'D'], st(t, 0.9) % 10); }
    });

    // --- 4008 : additionneur 4 bits ---
    M.adder = () => {
        const A = range('A', 1, 4), B = range('B', 1, 4);
        return {
            inputs: A.concat(B).concat(['CI']),
            eval(io, out) {
                const s = bus(io, A) + bus(io, B) + (io.CI ? 1 : 0);
                setBus(out, range('S', 1, 4), s);
                out.CO = (s >> 4) & 1;
            },
            auto(t, io) {
                const k = st(t, 1.5);
                setBus(io, A, (k * 7 + 3) % 16);
                setBus(io, B, (k * 5 + 6) % 16);
                io.CI = k % 3 === 2 ? 1 : 0;
            }
        };
    };

    // --- 4046 : PLL (comportement logique simplifié) ---
    M.pll = () => ({
        inputs: ['SIN', 'CIN', 'INH'],
        init: s => { s.ph = 0; },
        step(dt, io, s) { if (!io.INH) s.ph = (s.ph + dt * 0.8) % 1; },
        eval(io, out, s) {
            out.VCO = io.INH ? 0 : (s.ph < 0.5 ? 0 : 1);
            out.PC1 = io.SIN ^ io.CIN;
            out.PC2 = io.SIN && !io.CIN ? 1 : !io.SIN && io.CIN ? 0 : 'Z';
            out.PP = io.SIN === io.CIN ? 1 : 0;
        },
        auto(t, io, s) { io.SIN = ck(t + 0.15, 1.25); io.CIN = s.ph < 0.5 ? 0 : 1; }
    });

    // --- 4047 : astable / monostable ---
    M.c4047 = () => ({
        inputs: ['~AST', 'AST', '+TR', '-TR', 'RST', 'RTR'],
        defaults: { '~AST': 1, '-TR': 1 },
        init: s => { s.osc = 0; s.ph = 0; s.q = 0; s.rem = 0; },
        step(dt, io, s) {
            if (io.AST || !io['~AST']) s.ph += dt;
            else s.ph = 0;
            if (s.rem > 0) s.rem = Math.max(0, s.rem - dt);
        },
        eval(io, out, s, ev) {
            const ast = io.AST || !io['~AST'];
            const osc = ast ? (s.ph % 0.8 < 0.4 ? 1 : 0) : 0;
            if (ast && osc && !s.osc) s.q = 1 - s.q;
            s.osc = osc;
            if (ev.rise('+TR') || ev.fall('-TR') || ev.rise('RTR')) s.rem = 1.6;
            if (io.RST) { s.q = 0; s.rem = 0; }
            const q = ast ? s.q : (s.rem > 0 ? 1 : 0);
            out.OSC = osc; out.Q = q; out['~Q'] = 1 - q;
        },
        auto(t, io) {
            const c = t % 12;
            io.AST = c < 6 ? 1 : 0;
            io['+TR'] = c > 7 && c < 7.3 ? 1 : 0;
        }
    });

    // --- 4538 : deux monostables redéclenchables ---
    M.c4538 = () => ({
        inputs: [1, 2].flatMap(k => ['+T' + k, '-T' + k, '~R' + k]),
        defaults: { '-T1': 1, '-T2': 1, '~R1': 1, '~R2': 1 },
        init: s => { s.rem = { 1: 0, 2: 0 }; },
        step(dt, io, s) { [1, 2].forEach(k => { s.rem[k] = Math.max(0, s.rem[k] - dt); }); },
        eval(io, out, s, ev) {
            [1, 2].forEach(k => {
                if ((ev.rise('+T' + k) && io['-T' + k]) || (ev.fall('-T' + k) && !io['+T' + k])) s.rem[k] = k === 1 ? 1.2 : 2;
                if (!io['~R' + k]) s.rem[k] = 0;
                out['Q' + k] = s.rem[k] > 0 ? 1 : 0;
                out['~Q' + k] = s.rem[k] > 0 ? 0 : 1;
            });
        },
        auto(t, io) { io['+T1'] = pulse(t, 2.5, 0.2); io['-T2'] = 1 - pulse(t + 1, 3.5, 0.2); }
    });

    return M;
})();

const ChipLive = {
    active: [],

    mountAll() {
        this.active = this.active.filter(c => {
            if (document.body.contains(c.root)) return true;
            c.stop();
            return false;
        });
        document.querySelectorAll('[data-chip-live]').forEach(el => {
            if (el._chipLive) return;
            try {
                const c = new ChipLiveInstance(el, JSON.parse(el.dataset.chipLive));
                el._chipLive = c;
                this.active.push(c);
            } catch (e) {
                console.warn('ChipLive : brochage interactif impossible', e);
            }
        });
    }
};

class ChipLiveInstance {
    constructor(root, cfg) {
        this.root = root;
        this.pins = cfg.pins;
        const build = ChipModels[cfg.model];
        if (!build) throw new Error('modèle inconnu : ' + cfg.model);
        this.model = build(this.pins, cfg.opts || {});
        this.inputs = new Set(this.model.inputs.filter(n => this.pins.includes(n)));
        this.state = {};
        if (this.model.init) this.model.init(this.state);
        this.io = {};
        this.prev = {};
        this.out = {};
        this.t = 0;
        this.resetInputs();
        Object.assign(this.prev, this.io);

        // Barre de mode au-dessus du schéma
        const bar = LS.el('div', 'chip-live-bar');
        bar.innerHTML = `
            <div class="lsim-choice" role="group" aria-label="Mode du brochage">
                <button type="button" data-mode="auto">▶ Auto</button>
                <button type="button" data-mode="manual">✋ Manuel</button>
            </div>
            <span class="chip-live-hint"></span>`;
        root.prepend(bar);
        this.hint = bar.querySelector('.chip-live-hint');
        this.modeButtons = bar.querySelectorAll('[data-mode]');
        this.modeButtons.forEach(b => b.addEventListener('click', () => this.setMode(b.dataset.mode)));

        // Broches
        this.pinEls = [];
        root.querySelectorAll('svg .pin').forEach(g => {
            const name = this.pins[parseInt(g.dataset.pin, 10) - 1];
            const isIn = this.inputs.has(name);
            this.pinEls.push({ g, name, v: g.querySelector('.pin-v') });
            if (!isIn) return;
            g.classList.add('in');
            g.setAttribute('tabindex', '0');
            g.setAttribute('role', 'button');
            g.setAttribute('aria-label', 'Basculer l\'entrée ' + name.replace('~', '/'));
            const toggle = () => {
                if (this.mode !== 'manual') this.setMode('manual');
                this.io[name] = this.io[name] ? 0 : 1;
                this.evaluate(0);
                this.render();
            };
            g.addEventListener('click', toggle);
            g.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
            });
        });

        this.setMode('auto');
        this.last = performance.now();
        this.running = true;
        const loop = now => {
            if (!this.running) return;
            const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
            this.last = now;
            this.tick(dt);
            this.raf = requestAnimationFrame(loop);
        };
        this.raf = requestAnimationFrame(loop);
    }

    resetInputs() {
        this.inputs.forEach(n => { this.io[n] = 0; });
        Object.assign(this.io, this.model.defaults || {});
    }

    setMode(mode) {
        if (mode === this.mode) return;
        this.mode = mode;
        if (mode === 'auto') {
            this.resetInputs();
            this.t = 0;
        }
        this.root.classList.toggle('manual', mode === 'manual');
        this.modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        this.hint.textContent = mode === 'auto'
            ? 'Les entrées changent toutes seules. Cliquez sur le nom d\'une entrée pour passer en manuel.'
            : 'Cliquez sur le nom d\'une entrée pour la mettre à 1 ou à 0.';
    }

    evaluate(dt) {
        if (this.model.step) this.model.step(dt, this.io, this.state);
        const prev = this.prev, io = this.io;
        const ev = {
            rise: n => !prev[n] && !!io[n],
            fall: n => !!prev[n] && !io[n]
        };
        this.out = {};
        this.model.eval(io, this.out, this.state, ev);
        Object.assign(this.prev, io);
    }

    tick(dt) {
        this.t += dt;
        if (this.mode === 'auto') this.model.auto(this.t, this.io, this.state);
        this.evaluate(dt);
        this.render();
    }

    render() {
        this.pinEls.forEach(p => {
            let v = p.name in this.out ? this.out[p.name] : this.io[p.name];
            if (v === undefined) return;
            if (v !== 'Z') v = v ? 1 : 0;
            if (p.lastV === v) return;
            p.lastV = v;
            p.g.classList.toggle('v1', v === 1);
            p.g.classList.toggle('v0', v === 0);
            p.g.classList.toggle('vz', v === 'Z');
            if (p.v) p.v.textContent = v;
        });
    }

    stop() {
        this.running = false;
        cancelAnimationFrame(this.raf);
    }
}
