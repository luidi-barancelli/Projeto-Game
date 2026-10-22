const CUSTOM_COLORS = [
    ['red', 'Vermelho', '#ef4444'],
    ['orange', 'Laranja', '#f97316'],
    ['amber', 'Âmbar', '#f59e0b'],
    ['yellow', 'Amarelo', '#facc15'],
    ['lime', 'Lima', '#a3e635'],
    ['green', 'Verde', '#22c55e'],
    ['emerald', 'Esmeralda', '#10b981'],
    ['teal', 'Turquesa', '#14b8a6'],
    ['cyan', 'Ciano', '#06b6d4'],
    ['sky', 'Azul-céu', '#38bdf8'],
    ['blue', 'Azul', '#3b82f6'],
    ['indigo', 'Índigo', '#6366f1'],
    ['violet', 'Violeta', '#8b5cf6'],
    ['purple', 'Roxo', '#a855f7'],
    ['magenta', 'Magenta', '#d946ef'],
    ['pink', 'Rosa', '#ec4899'],
    ['white', 'Branco', '#f8fafc'],
    ['silver', 'Prata', '#94a3b8']
];

const RAINBOW_GRADIENT = 'conic-gradient(#ef4444, #facc15, #22c55e, #06b6d4, #3b82f6, #d946ef, #ef4444)';

const TRAIL_DEFAULT_RGB = {
    '67': [34, 211, 238],
    '42': [250, 204, 21],
    sparks: [253, 224, 71],
    fire: [249, 115, 22],
    stars: [250, 204, 21],
    bubbles: [125, 211, 252]
};

const TRAIL_SPEED_MULT = { sparks: 1.6, fire: 0.5, bubbles: 0.4 };

function colorOptions(offId, offName, price, rainbowPrice, extras) {
    const list = [{ id: offId, name: offName, price: 0, off: true }];
    CUSTOM_COLORS.forEach((c) => {
        list.push({ id: c[0], name: c[1], hex: c[2], price });
    });
    extras.forEach((e) => {
        list.push({ id: e.id, name: e.name, hex: e.hex, price });
    });
    list.push({ id: 'rainbow', name: 'Arco-íris', rainbow: true, price: rainbowPrice });
    return list;
}

const CUSTOM_CATEGORIES = [
    {
        id: 'neon',
        title: 'Neon',
        desc: 'Luz neon embaixo do carro, no formato dele.',
        options: colorOptions('off', 'Desligado', 300, 2500, [])
    },
    {
        id: 'smoke',
        title: 'Fumaça do drift',
        desc: 'Cor da fumaça que sai dos pneus ao derrapar.',
        options: colorOptions('default', 'Padrão (cinza)', 150, 1200, [{ id: 'black', name: 'Preto', hex: '#0f172a' }])
    },
    {
        id: 'led',
        title: 'LED',
        desc: 'Faróis e lanternas em LED, com a luz do farol na mesma cor.',
        options: colorOptions('off', 'Desligado', 200, 1500, [])
    },
    {
        id: 'trail',
        title: 'Rastro',
        desc: 'O que o carro solta pra trás. Explode quando você ativa o nitro.',
        options: [
            { id: 'none', name: 'Nenhum', price: 0, off: true },
            { id: '67', name: 'Six Seven', glyph: '67', price: 800 },
            { id: '42', name: 'Four Two', glyph: '42', price: 800 },
            { id: 'mix', name: 'Six Seven + Four Two', glyph: '67|42', price: 1500 },
            { id: 'sparks', name: 'Faíscas', glyph: '//', price: 500 },
            { id: 'fire', name: 'Fogo', glyph: '~', price: 700 },
            { id: 'stars', name: 'Estrelas', glyph: '*', price: 600 },
            { id: 'bubbles', name: 'Bolhas', glyph: 'o', price: 400 }
        ]
    },
    {
        id: 'trailColor',
        title: 'Cor do rastro',
        desc: 'Cor do rastro escolhido. O padrão usa a cor original de cada rastro.',
        options: colorOptions('default', 'Padrão do rastro', 100, 1000, [])
    }
];

if (!saveData.custom) {
    saveData.custom = {};
}
if (!saveData.custom.equip) {
    saveData.custom.equip = {};
}
if (!saveData.custom.owned) {
    saveData.custom.owned = {};
}
CUSTOM_CATEGORIES.forEach((cat) => {
    const first = cat.options[0].id;
    if (!saveData.custom.equip[cat.id]) {
        saveData.custom.equip[cat.id] = first;
    }
    if (!saveData.custom.owned[cat.id]) {
        saveData.custom.owned[cat.id] = [first];
    }
});

let customPreviewMode = false;
let customActiveCat = 'neon';
const customSelected = {};

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hslToRgb(h, s, l) {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function customValue(catId) {
    if (customPreviewMode) {
        return customSelected[catId];
    }
    return saveData.custom.equip[catId];
}

function getCustomRGB(catId) {
    const id = customValue(catId);
    if (id === 'rainbow') {
        return hslToRgb((performance.now() / 6) % 360, 1, 0.55);
    }
    const cat = CUSTOM_CATEGORIES.find((c) => c.id === catId);
    const opt = cat.options.find((o) => o.id === id);
    if (opt && opt.hex) {
        return hexToRgb(opt.hex);
    }
    return null;
}

function smokeColor() {
    const rgb = getCustomRGB('smoke');
    if (rgb) {
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.85)`;
    }
    return undefined;
}

function ledRGB() {
    const rgb = getCustomRGB('led');
    if (rgb) {
        return rgb;
    }
    return [254, 240, 138];
}

function smokeColorFor(vehicle) {
    if (game.player !== vehicle) {
        return undefined;
    }
    return smokeColor();
}

function coneColorFor(vehicle) {
    if (game.player !== vehicle) {
        return [254, 240, 138];
    }
    return ledRGB();
}

function drawNeonGlow(ctx, w, h) {
    const rgb = getCustomRGB('neon');
    if (!rgb) {
        return;
    }
    const color = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    const pulse = 0.8 + 0.2 * Math.sin(performance.now() / 280);

    ctx.save();
    ctx.scale(1, (h * 0.5 + 34) / (w * 0.75));
    const halo = ctx.createRadialGradient(0, 0, w * 0.2, 0, 0, w * 0.75);
    halo.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${0.5 * pulse})`);
    halo.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.shadowColor = color;
    ctx.shadowBlur = 38;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-w * 0.38, -h * 0.32, w * 0.76, h * 0.64, 14);
    ctx.fill();
    ctx.fill();
    ctx.restore();
}

function drawLedLights(ctx, w, h) {
    const rgb = getCustomRGB('led');
    if (!rgb) {
        return;
    }
    const color = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 9, -h * 0.36 - 2.5, 9, 5, 2);
    ctx.roundRect(w / 2 - 9, h * 0.36 - 2.5, 9, 5, 2);
    ctx.roundRect(-w / 2 - 1, -h * 0.34, 4, h * 0.68, 2);
    ctx.fill();
    ctx.restore();
}

function drawCarNeon(vehicle, ctx) {
    if (game.player !== vehicle) {
        return;
    }
    drawNeonGlow(ctx, vehicle.width, vehicle.height);
}

function drawCarLed(vehicle, ctx) {
    if (game.player !== vehicle) {
        return;
    }
    drawLedLights(ctx, vehicle.width, vehicle.height);
}

const gameTrail = [];
const previewTrail = [];
let trailWasNitro = false;
let trailFrame = 0;

function spawnTrailParticle(list, x, y, angle, length, style, burst) {
    let spread = (Math.random() - 0.5) * 1.1;
    let speed = 2.5 + Math.random() * 3;
    if (burst) {
        spread = (Math.random() - 0.5) * Math.PI * 2;
        speed = 4 + Math.random() * 7;
    }
    let kind = style;
    let text = '';
    if (style === '67' || style === '42' || style === 'mix') {
        kind = 'text';
        text = style;
        if (style === 'mix') {
            text = '67';
            if (Math.random() < 0.5) {
                text = '42';
            }
        }
    }
    let rgb = getCustomRGB('trailColor');
    if (!rgb) {
        rgb = TRAIL_DEFAULT_RGB[text || style];
    }
    const mult = TRAIL_SPEED_MULT[kind] || 1;
    const dir = angle + Math.PI + spread;
    list.push({
        kind,
        text,
        rgb,
        rainbow: customValue('trailColor') === 'rainbow',
        hue: (performance.now() / 6) % 360,
        x: x - Math.cos(angle) * length * 0.5,
        y: y - Math.sin(angle) * length * 0.5,
        vx: Math.cos(dir) * speed * mult,
        vy: Math.sin(dir) * speed * mult,
        rot: (Math.random() - 0.5) * 0.8,
        spin: (Math.random() - 0.5) * 0.25,
        size: 0.5 + Math.random() * 0.9,
        life: 1,
        decay: 0.018 + Math.random() * 0.014
    });
    if (list.length > 160) {
        list.shift();
    }
}

function starPath(ctx, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        let radius = r;
        if (i % 2 === 1) {
            radius = r * 0.45;
        }
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    ctx.closePath();
}

function drawTrailShape(ctx, p, rgb, fill) {
    const rgbText = `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
    if (p.kind === 'text') {
        const grow = Math.min(1, (1 - p.life) * 6);
        const scale = p.size * (0.4 + grow * 0.6 + (1 - p.life) * 0.5);
        ctx.globalAlpha = Math.min(1, p.life * 1.6);
        ctx.rotate(p.rot);
        ctx.scale(scale, scale);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'italic 900 40px "Arial Black", Impact, sans-serif';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 6;
        // ctx.shadowColor = fill;
        // ctx.shadowBlur = 16;
        ctx.strokeStyle = '#0f172a';
        ctx.strokeText(p.text, 0, 0);
        ctx.fillStyle = fill;
        ctx.fillText(p.text, 0, 0);
    } else if (p.kind === 'sparks') {
        ctx.globalAlpha = p.fade;
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineWidth = 1 + p.size * 2;
        ctx.shadowColor = fill;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = fill;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-p.vx * 2.5, -p.vy * 2.5);
        ctx.stroke();
    } else if (p.kind === 'fire') {
        const radius = 4 + 16 * p.size * (0.4 + p.fade * 0.6);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        g.addColorStop(0, `rgba(255, 255, 255, ${p.fade * 0.6})`);
        g.addColorStop(0.4, `rgba(${rgbText}, ${p.fade * 0.8})`);
        g.addColorStop(1, `rgba(${rgbText}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
    } else if (p.kind === 'stars') {
        ctx.globalAlpha = p.fade;
        ctx.rotate(p.rot * 4);
        ctx.shadowColor = fill;
        ctx.shadowBlur = 12;
        ctx.fillStyle = fill;
        starPath(ctx, 5 + 9 * p.size * (0.5 + p.life * 0.5));
        ctx.fill();
    } else if (p.kind === 'bubbles') {
        const radius = 4 + 10 * p.size * (1.2 - p.life * 0.4);
        ctx.globalAlpha = p.fade;
        ctx.fillStyle = `rgba(${rgbText}, 0.15)`;
        ctx.strokeStyle = fill;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}

function drawTrail(list, ctx) {
    for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= p.decay;
        if (p.life <= 0) {
            list.splice(i, 1);
            continue;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.rot += p.spin;
        p.fade = Math.min(1, p.life * 3);
        let rgb = p.rgb;
        if (p.rainbow) {
            p.hue += 6;
            rgb = hslToRgb(p.hue % 360, 1, 0.6);
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        drawTrailShape(ctx, p, rgb, `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
        ctx.restore();
    }
}

function drawCustomTrail(ctx) {
    drawTrail(gameTrail, ctx);
}

function emitCustomTrail(vehicle) {
    if (game.player !== vehicle) {
        return;
    }
    const nitro = vehicle.isNitro;
    const burst = nitro && !trailWasNitro;
    trailWasNitro = nitro;
    const style = customValue('trail');
    if (style === 'none') {
        return;
    }
    trailFrame++;
    let count = 0;
    if (burst) {
        count = 6;
    } else if (nitro && trailFrame % 3 === 0) {
        count = 1;
    } else if (Math.hypot(vehicle.vx, vehicle.vy) > 3 && trailFrame % 6 === 0) {
        count = 1;
    }
    for (let i = 0; i < count; i++) {
        spawnTrailParticle(gameTrail, vehicle.x, vehicle.y, vehicle.angle, vehicle.width, style, burst);
    }
}

const customPreview = {
    canvas: null,
    ctx: null,
    puffs: [],
    frame: 0,
    raf: null,
    running: false
};

function drawPreviewScene(ctx, W, H) {
    const bg = ctx.createRadialGradient(W * 0.55, H * 0.5, 20, W * 0.55, H * 0.5, W * 0.7);
    bg.addColorStop(0, '#475569');
    bg.addColorStop(1, '#1e293b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const car = CAR_CATALOG[saveData.selectedCar || 0];
    const w = 190 * Math.min(1, 0.55 / car.ratio);
    const dh = w * car.ratio;
    const h = Math.max(dh, 20);
    const cx = W * 0.62;
    const cy = H * 0.5;
    const angle = -0.22;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    customPreview.frame++;
    const smoke = smokeColor() || 'rgba(200, 200, 200, 0.4)';
    for (const side of [-1, 1]) {
        const lx = -w * 0.4;
        const ly = side * h * 0.38;
        for (let i = 0; i < 2; i++) {
            customPreview.puffs.push({
                x: cx + cos * lx - sin * ly,
                y: cy + sin * lx + cos * ly,
                vx: -2.4 + (Math.random() - 0.5) * 1.5,
                vy: 0.6 + (Math.random() - 0.5) * 1.5,
                radius: 3 + Math.random() * 4,
                life: 1,
                decay: 0.012 + Math.random() * 0.012,
                color: smoke
            });
        }
    }
    for (let i = customPreview.puffs.length - 1; i >= 0; i--) {
        const p = customPreview.puffs[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.radius < 14) {
            p.radius += 0.3;
        }
        if (p.life <= 0) {
            customPreview.puffs.splice(i, 1);
            continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life * 0.5);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    const style = customValue('trail');
    if (style !== 'none') {
        const burst = customPreview.frame % 150 === 0;
        if (burst) {
            for (let i = 0; i < 6; i++) {
                spawnTrailParticle(previewTrail, cx, cy, angle, w, style, true);
            }
        } else if (customPreview.frame % 3 === 0) {
            spawnTrailParticle(previewTrail, cx, cy, angle, w, style, false);
        }
    }
    drawTrail(previewTrail, ctx);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    drawNeonGlow(ctx, w, h);
    if (car.img && car.img.complete && car.img.naturalWidth) {
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(car.img, -dh / 2, -w / 2, dh, w);
        ctx.rotate(-Math.PI / 2);
    } else {
        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 6);
        ctx.fill();
    }
    drawLedLights(ctx, w, h);
    const cone = ledRGB();
    const grad = ctx.createRadialGradient(w / 2, 0, 5, w / 2 + 120, 0, 120);
    grad.addColorStop(0, `rgba(${cone[0]}, ${cone[1]}, ${cone[2]}, 0.3)`);
    grad.addColorStop(1, `rgba(${cone[0]}, ${cone[1]}, ${cone[2]}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2 + 150, -60);
    ctx.lineTo(w / 2 + 150, 60);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function customPreviewFrame() {
    if (!customPreview.running) {
        return;
    }
    customPreviewMode = true;
    try {
        drawPreviewScene(customPreview.ctx, customPreview.canvas.width, customPreview.canvas.height);
    } finally {
        customPreviewMode = false;
    }
    customPreview.raf = requestAnimationFrame(customPreviewFrame);
}

function startCustomPreview() {
    if (customPreview.running) {
        return;
    }
    customPreview.canvas = document.getElementById('customPreview');
    customPreview.ctx = customPreview.canvas.getContext('2d');
    customPreview.puffs = [];
    previewTrail.length = 0;
    customPreview.running = true;
    customPreviewFrame();
}

function stopCustomPreview() {
    customPreview.running = false;
    cancelAnimationFrame(customPreview.raf);
}

function customOwned(catId, optId) {
    return saveData.custom.owned[catId].includes(optId);
}

function selectedOption(cat) {
    return cat.options.find((o) => o.id === customSelected[cat.id]);
}

function buildSwatch(opt) {
    const el = document.createElement('span');
    el.className = 'w-10 h-10 rounded-full flex items-center justify-center font-black font-orbitron text-[11px] text-cyan-300 shrink-0';
    if (opt.rainbow) {
        el.style.background = RAINBOW_GRADIENT;
        el.style.boxShadow = '0 0 12px rgba(217, 70, 239, 0.5)';
    } else if (opt.hex) {
        el.style.background = opt.hex;
        el.style.boxShadow = `0 0 12px ${opt.hex}99`;
    } else {
        el.classList.add('border-2', 'border-slate-600');
        if (opt.off) {
            el.classList.add('border-dashed', 'text-slate-500');
        }
        el.innerText = opt.glyph || 'X';
        if (el.innerText.length > 3) {
            el.classList.add('text-[9px]');
        }
    }
    return el;
}

function renderCustomCategories() {
    const box = document.getElementById('customCategories');
    box.innerHTML = '';
    CUSTOM_CATEGORIES.forEach((cat) => {
        const current = cat.options.find((o) => o.id === saveData.custom.equip[cat.id]);
        let cls = 'flex-1 md:flex-none flex items-center justify-between gap-3 p-3 rounded-xl border-2 text-left transition min-w-[140px] ';
        if (cat.id === customActiveCat) {
            cls += 'bg-cyan-500/15 border-cyan-400 text-white';
        } else {
            cls += 'bg-slate-900/70 border-slate-700 text-slate-300 hover:border-slate-500';
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = cls;
        const text = document.createElement('div');
        text.className = 'min-w-0';
        text.innerHTML = `<div class="font-orbitron font-black text-[11px] md:text-xs uppercase tracking-wide">${cat.title}</div><div class="text-[11px] text-slate-400 truncate">${current.name}</div>`;
        const dot = buildSwatch(current);
        dot.classList.remove('w-10', 'h-10');
        dot.classList.add('w-6', 'h-6');
        btn.appendChild(text);
        btn.appendChild(dot);
        btn.onclick = () => {
            customActiveCat = cat.id;
            renderCustomPanel();
        };
        box.appendChild(btn);
    });
}

function renderCustomOptions() {
    const cat = CUSTOM_CATEGORIES.find((c) => c.id === customActiveCat);
    document.getElementById('customCatTitle').innerText = cat.title;
    document.getElementById('customCatDesc').innerText = cat.desc;
    const grid = document.getElementById('customOptions');
    grid.innerHTML = '';
    cat.options.forEach((opt) => {
        const owned = customOwned(cat.id, opt.id);
        const equipped = saveData.custom.equip[cat.id] === opt.id;
        let cls = 'flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition ';
        if (customSelected[cat.id] === opt.id) {
            cls += 'bg-cyan-500/15 border-cyan-400';
        } else {
            cls += 'bg-slate-900/60 border-slate-800 hover:border-slate-500';
        }
        let tag = `$${opt.price}`;
        let tagCls = 'text-slate-500';
        if (equipped) {
            tag = 'EQUIPADO';
            tagCls = 'text-cyan-300';
        } else if (owned) {
            tag = 'COMPRADO';
            tagCls = 'text-emerald-400';
        } else if (saveData.coins >= opt.price) {
            tagCls = 'text-emerald-300';
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = cls;
        btn.appendChild(buildSwatch(opt));
        const name = document.createElement('span');
        name.className = 'text-[10px] leading-tight text-center font-bold text-slate-200';
        name.innerText = opt.name;
        const price = document.createElement('span');
        price.className = `text-[10px] font-black font-orbitron ${tagCls}`;
        price.innerText = tag;
        btn.appendChild(name);
        btn.appendChild(price);
        btn.onclick = () => {
            customSelected[cat.id] = opt.id;
            renderCustomPanel();
        };
        grid.appendChild(btn);
    });
}

function renderCustomAction() {
    const cat = CUSTOM_CATEGORIES.find((c) => c.id === customActiveCat);
    const opt = selectedOption(cat);
    const btn = document.getElementById('btnCustomAction');
    const base = 'w-full py-4 font-black font-orbitron text-lg rounded-xl transition ';
    btn.disabled = false;
    if (saveData.custom.equip[cat.id] === opt.id) {
        btn.innerText = 'EQUIPADO';
        btn.disabled = true;
        btn.className = base + 'bg-slate-800 text-slate-500';
    } else if (customOwned(cat.id, opt.id)) {
        btn.innerText = 'EQUIPAR';
        btn.className = base + 'bg-cyan-500 hover:bg-cyan-400 text-slate-950';
    } else if (saveData.coins >= opt.price) {
        btn.innerText = `COMPRAR $${opt.price}`;
        btn.className = base + 'bg-emerald-500 hover:bg-emerald-400 text-slate-950';
    } else {
        btn.innerText = `SEM DINHEIRO ($${opt.price})`;
        btn.disabled = true;
        btn.className = base + 'bg-slate-800 text-slate-500';
    }
}

function renderCustomPanel() {
    document.getElementById('customCashDisplay').innerText = `$${saveData.coins}`;
    renderCustomCategories();
    renderCustomOptions();
    renderCustomAction();
}

function customAction() {
    const cat = CUSTOM_CATEGORIES.find((c) => c.id === customActiveCat);
    const opt = selectedOption(cat);
    if (!customOwned(cat.id, opt.id)) {
        if (saveData.coins < opt.price) {
            return;
        }
        saveData.coins -= opt.price;
        saveData.custom.owned[cat.id].push(opt.id);
    }
    saveData.custom.equip[cat.id] = opt.id;
    saveGame();
    updateMenuData();
    renderCustomPanel();
}

function openCustomShop() {
    CUSTOM_CATEGORIES.forEach((cat) => {
        customSelected[cat.id] = saveData.custom.equip[cat.id];
    });
    renderCustomPanel();
    document.getElementById('customModal').classList.remove('hidden');
    startCustomPreview();
}

function closeCustomShop() {
    document.getElementById('customModal').classList.add('hidden');
    stopCustomPreview();
    updateMenuData();
}

document.getElementById('btnOpenCustom').onclick = openCustomShop;
document.getElementById('btnCloseCustom').onclick = closeCustomShop;
document.getElementById('btnCustomAction').onclick = customAction;