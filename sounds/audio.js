// menu_audio.js — trilha sonora da tela inicial (perseguição policial)
// Tudo gerado por código com Web Audio, sem arquivos de som.
(function () {
    const menuEl = document.getElementById('mainMenu');
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!menuEl || !AudioCtx) {
        return;
    }

    // ===== AJUSTES =====
    const MASTER_VOLUME = 0.9;
    const MUSIC_VOLUME = 0.5;     // volume da música
    const SIREN_VOLUME = 0.8;     // volume das sirenes
    const SKID_VOLUME = 1.0;      // volume da derrapagem
    const VOICE_ENABLED = true;   // false = sem fala de policial
    const VOICE_VOLUME = 0.9;
    const BPM = 138;
    const STORAGE_KEY = 'drift_chase_menu_muted';

    const COP_LINES = [
        'Atenção, motorista! Encoste o veículo agora!',
        'Central, suspeito em fuga! Solicito reforços!',
        'Todas as unidades, ele está acelerando pela avenida!',
        'Não deixem ele escapar!',
        'Parado! Polícia! Encoste o carro!',
        'Estamos em perseguição! Câmbio!',
        'Unidade três, feche o cruzamento!',
        'Ele está derrapando! Cuidado com a curva!'
    ];

    let ctx = null, master = null, musicBus = null, fxBus = null, noiseBuf = null;
    let started = false;
    let muted = false;
    try { muted = localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { }

    const STEP = 60 / BPM / 4;
    let nextTime = 0;
    let step = 0;

    function isMenuVisible() {
        return !menuEl.classList.contains('hidden') && !document.hidden;
    }
    function audible() {
        return started && !muted && isMenuVisible();
    }

    // ===== BOTÃO DE SOM =====
    const btn = document.createElement('button');
    btn.id = 'menuSoundBtn';
    btn.type = 'button';
    btn.className = 'fixed bottom-4 right-4 px-4 py-2 rounded-xl text-xs font-bold font-orbitron tracking-widest text-slate-200 bg-slate-900/70 border border-slate-600 hover:border-cyan-400 transition';
    btn.style.zIndex = '35';
    document.body.appendChild(btn);

    function updateButton() {
        if (!started && !muted) btn.textContent = 'CLIQUE PARA ATIVAR O SOM';
        else btn.textContent = muted ? 'SOM DESLIGADO' : 'SOM LIGADO';
        btn.classList.toggle('animate-pulse', !started && !muted);
    }
    btn.onclick = () => {
        if (!started) {
            muted = false;
            start();
        } else {
            muted = !muted;
        }
        try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); } catch (e) { }
        updateButton();
    };
    updateButton();

    // O navegador só libera o áudio depois de um clique ou tecla do jogador
    function onGesture(e) {
        if (started || muted || !isMenuVisible()) return;
        if (e.target && e.target.closest && e.target.closest('#menuSoundBtn')) return;
        start();
        updateButton();
    }
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);

    // ===== FERRAMENTAS =====
    function makePan(value) {
        if (!ctx.createStereoPanner) return null;
        const p = ctx.createStereoPanner();
        p.pan.value = value;
        return p;
    }

    function noiseHit(t, type, freq, dur, vol, dest) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(f); f.connect(g); g.connect(dest || musicBus);
        src.start(t, Math.random() * 0.5, dur + 0.05);
    }

    function kick(t) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(160, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        g.gain.setValueAtTime(0.9, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        o.connect(g); g.connect(musicBus);
        o.start(t); o.stop(t + 0.26);
    }

    function snare(t) {
        noiseHit(t, 'bandpass', 1800, 0.14, 0.38);
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(190, t);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(g); g.connect(musicBus);
        o.start(t); o.stop(t + 0.12);
    }

    function bass(t, f) {
        const o = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = f;
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(950, t);
        lp.frequency.exponentialRampToValueAtTime(180, t + STEP * 1.6);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 1.9);
        o.connect(lp); lp.connect(g); g.connect(musicBus);
        o.start(t); o.stop(t + STEP * 2);
    }

    function arp(t, f) {
        const o = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = f;
        lp.type = 'lowpass';
        lp.frequency.value = 2200;
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
        o.connect(lp); lp.connect(g); g.connect(musicBus);
        o.start(t); o.stop(t + 0.13);
    }

    // ===== MÚSICA (4 compassos em loop: Am - F - C - G) =====
    const ROOTS = [55, 43.65, 65.41, 49];
    const CHORDS = [
        [220, 261.63, 329.63],
        [174.61, 220, 261.63],
        [261.63, 329.63, 392],
        [196, 246.94, 293.66]
    ];
    const ARP_PATTERN = [0, 1, 2, 1];

    function playStep(s, t) {
        const bar = Math.floor(s / 16) % 4;
        const i = s % 16;

        if (i % 4 === 0) kick(t);
        if (i === 4 || i === 12) snare(t);
        if (i % 2 === 1) noiseHit(t, 'highpass', 7000, 0.04, 0.11);

        if (i % 2 === 0) bass(t, ROOTS[bar] * (i % 8 === 6 ? 2 : 1));

        const chord = CHORDS[bar];
        const octave = i >= 8 ? 2 : 1;
        arp(t, chord[ARP_PATTERN[i % 4]] * octave);
    }

    function scheduler() {
        if (!ctx || ctx.state !== 'running') return;
        while (nextTime < ctx.currentTime + 0.15) {
            playStep(step, nextTime);
            nextTime += STEP;
            step = (step + 1) % 64;
        }
    }

    // ===== MOTOR DE FUNDO =====
    function startEngine() {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 320;
        const g = ctx.createGain();
        g.gain.value = 0.05;
        lp.connect(g); g.connect(fxBus);

        const o1 = ctx.createOscillator();
        o1.type = 'sawtooth';
        o1.frequency.value = 48;
        const o2 = ctx.createOscillator();
        o2.type = 'square';
        o2.frequency.value = 96;
        const g2 = ctx.createGain();
        g2.gain.value = 0.3;
        o1.connect(lp); o2.connect(g2); g2.connect(lp);

        // o motor "respira" devagar, como se acelerasse e aliviasse
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.35;
        const lfoG = ctx.createGain();
        lfoG.gain.value = 7;
        lfo.connect(lfoG); lfoG.connect(o1.frequency);
        const lfoG2 = ctx.createGain();
        lfoG2.gain.value = 14;
        lfo.connect(lfoG2); lfoG2.connect(o2.frequency);

        o1.start(); o2.start(); lfo.start();
    }

    // ===== SIRENES (passam de um lado pro outro) =====
    function sirenPass(base, depth, lfoHz, vol, dur) {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = base;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = lfoHz;
        const lfoG = ctx.createGain();
        lfoG.gain.value = depth;
        lfo.connect(lfoG); lfoG.connect(osc.frequency);

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = base;
        bp.Q.value = 0.7;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol * SIREN_VOLUME, t + dur * 0.5);
        g.gain.linearRampToValueAtTime(0, t + dur);

        osc.connect(bp); bp.connect(g);
        const pan = makePan(0);
        if (pan) {
            const dir = Math.random() < 0.5 ? -1 : 1;
            pan.pan.setValueAtTime(-0.9 * dir, t);
            pan.pan.linearRampToValueAtTime(0.9 * dir, t + dur);
            g.connect(pan); pan.connect(fxBus);
        } else {
            g.connect(fxBus);
        }

        osc.start(t); lfo.start(t);
        osc.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
    }

    function loopSiren(minMs, maxMs, fn) {
        setTimeout(() => {
            if (audible()) fn();
            loopSiren(minMs, maxMs, fn);
        }, minMs + Math.random() * (maxMs - minMs));
    }

    // ===== DERRAPAGEM =====
    function skidBurst() {
        const t = ctx.currentTime;
        const dur = 0.8 + Math.random() * 0.5;
        const dest = ctx.createGain();
        dest.gain.value = 1;
        const pan = makePan((Math.random() - 0.5) * 1.0);
        if (pan) { dest.connect(pan); pan.connect(fxBus); } else { dest.connect(fxBus); }

        // chiado do pneu
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 4;
        bp.frequency.setValueAtTime(1400, t);
        bp.frequency.linearRampToValueAtTime(2800, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.16 * SKID_VOLUME, t + 0.12);
        g.gain.linearRampToValueAtTime(0, t + dur);
        src.connect(bp); bp.connect(g); g.connect(dest);
        src.start(t, Math.random()); src.stop(t + dur + 0.05);

        // guincho agudo
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(820, t);
        o.frequency.linearRampToValueAtTime(1250, t + dur);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 700;
        const og = ctx.createGain();
        og.gain.setValueAtTime(0, t);
        og.gain.linearRampToValueAtTime(0.035 * SKID_VOLUME, t + 0.15);
        og.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(hp); hp.connect(og); og.connect(dest);
        o.start(t); o.stop(t + dur + 0.05);
    }

    // ===== FALA DO POLICIAL =====
    let voice = null;
    let lastLine = -1;
    const synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;

    function pickVoice() {
        if (!synth) return;
        const list = synth.getVoices();
        voice =
            list.find(v => /pt[-_]BR/i.test(v.lang) && /(daniel|antonio|male|masc)/i.test(v.name)) ||
            list.find(v => /pt[-_]BR/i.test(v.lang)) ||
            list.find(v => /^pt/i.test(v.lang)) ||
            null;
    }
    if (synth) {
        pickVoice();
        synth.onvoiceschanged = pickVoice;
    }

    // clique de rádio (antes e depois da fala)
    function radioClick() {
        if (!ctx) return;
        const t = ctx.currentTime;
        noiseHit(t, 'bandpass', 2500, 0.07, 0.12, fxBus);
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = 1500;
        g.gain.setValueAtTime(0.03, t + 0.07);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o.connect(g); g.connect(fxBus);
        o.start(t + 0.07); o.stop(t + 0.17);
    }

    function duck(on) {
        if (!ctx) return;
        musicBus.gain.setTargetAtTime(on ? MUSIC_VOLUME * 0.45 : MUSIC_VOLUME, ctx.currentTime, 0.15);
    }

    function copSpeak() {
        if (!VOICE_ENABLED || !synth || !audible() || synth.speaking) return;

        let idx;
        do {
            idx = Math.floor(Math.random() * COP_LINES.length); 
        } while (idx === lastLine && COP_LINES.length > 1)

        lastLine = idx;

        radioClick();
        const u = new SpeechSynthesisUtterance(COP_LINES[idx]);
        u.lang = 'pt-BR';
        if (voice) u.voice = voice;
        u.pitch = 0.6;
        u.rate = 1.12;
        u.volume = VOICE_VOLUME;
        u.onstart = () => duck(true);
        u.onend = u.onerror = () => { duck(false); radioClick(); };
        setTimeout(() => { if (audible()) synth.speak(u); }, 200);
    }

    function loopVoice() {
        setTimeout(() => {
            copSpeak();
            loopVoice();
        }, 8000 + Math.random() * 6000);
    }

    // ===== INÍCIO =====
    function start() {
        if (started) return;
        started = true;

        ctx = new AudioCtx();
        master = ctx.createGain();
        master.gain.value = 0;
        const comp = ctx.createDynamicsCompressor();
        master.connect(comp);
        comp.connect(ctx.destination);

        musicBus = ctx.createGain();
        musicBus.gain.value = MUSIC_VOLUME;
        musicBus.connect(master);
        fxBus = ctx.createGain();
        fxBus.gain.value = 1;
        fxBus.connect(master);

        // 1 segundo de ruído branco, reaproveitado por chimbal, caixa e pneus
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

        startEngine();
        nextTime = ctx.currentTime + 0.1;
        setInterval(scheduler, 40);

        loopSiren(9000, 14000, () => sirenPass(950, 380, 0.35, 0.06, 7));
        loopSiren(14000, 22000, () => sirenPass(1100, 300, 3.0, 0.035, 5));
        (function skidLoop() {
            setTimeout(() => {
                if (audible()) skidBurst();
                skidLoop();
            }, 2600 + Math.random() * 1800);
        })();
        loopVoice();

        ctx.resume();
    }

    // ===== SÓ TOCA COM O MENU ABERTO =====
    let offSince = 0;
    setInterval(() => {
        btn.style.display = menuEl.classList.contains('hidden') ? 'none' : '';
        if (!started) return;

        if (audible()) {
            offSince = 0;
            if (ctx.state === 'suspended') ctx.resume();
            master.gain.setTargetAtTime(MASTER_VOLUME, ctx.currentTime, 0.3);
        } else {
            master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
            if (synth && synth.speaking) synth.cancel();
            if (!offSince) offSince = Date.now();
            if (Date.now() - offSince > 1500 && ctx.state === 'running') ctx.suspend();
        }
    }, 250);
})();