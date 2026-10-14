const CANVAS = document.getElementById('gameCanvas');
            const CTX = CANVAS.getContext('2d');
            const PROP_TARGET_COUNT = 90;   
            const PROP_SPAWN_RADIUS = 1600;    
            const PROP_DESPAWN_RADIUS = 2400;  
            const COIN_TARGET_COUNT = 20;    
            const COIN_SPAWN_RADIUS = 1400;
            const COIN_DESPAWN_RADIUS = 2200;
            const MAP_SIZE = 3600;

            const PLAYER_SIZE_SCALE = 1.5;
            const COP_SIZE_SCALE = 1.3;

            const COIN_NITRO_RESTORE = 0.5;

            const HEALTH_PICKUP_HEAL_AMOUNT = 30;
            const COP_HIT_DAMAGE = 25;          // vida perdida a cada batida de policial
            const COP_HIT_COOLDOWN = 60;        // frames (~1s) entre batidas do mesmo policial
            const COP_RETREAT_FRAMES = 30;      // frames que o policial recua depois de bater
            const COP_KNOCKBACK_SPEED = 5;      // velocidade com que o policial é jogado pra trás ao bater
            const DEATH_ANIM_MS = 2000;         // duração da explosão antes do game over (em milissegundos)
            const DEATH_SHOWS_GAME_OVER = true; // true = abre a tela de game over | false = volta direto pro menu principal
            const DEATH_ANIM_FRAMES = 110;      // duração da explosão antes do menu (60 frames = 1s)
            const COP_CLOSE_RANGE = 220;
            const HEALTH_PICKUP_TARGET_COUNT = 4;
            const HEALTH_PICKUP_SPAWN_RADIUS = 1500;
            const HEALTH_PICKUP_DESPAWN_RADIUS = 2200;

            const COIN_ORB_SCALE = 1.2;
            const HEALTH_ORB_SCALE = 1.2;

            const DRIFT_HANDBRAKE_GRIP = 0.62;
            const DRIFT_TURN_BOOST = 1.6;
            const DRIFT_SMOKE_COUNT = 3;
            const DRIFT_CAMERA_SHAKE = 4;
            const SKIDMARK_WIDTH = 6;
            const SKIDMARK_ALPHA = 0.45;

            // Audio Context Synthesizer Engine
            class AudioEngine {
                constructor() {
                    this.ctx = null;
                    this.isMuted = false;
                    this.engineOsc = null;
                    this.engineGain = null;
                }

                init() {
                    if (this.ctx) return;
                    const AudioCtx = window.AudioContext || window.webkitAudioContext;
                    if (!AudioCtx) return;
                    this.ctx = new AudioCtx();

                    // Continuous Engine Hum Oscillator
                    try {
                        this.engineOsc = this.ctx.createOscillator();
                        this.engineGain = this.ctx.createGain();
                        this.engineOsc.type = 'sawtooth';
                        this.engineOsc.frequency.setValueAtTime(40, this.ctx.currentTime);
                        this.engineGain.gain.setValueAtTime(0.02, this.ctx.currentTime);
                        this.engineOsc.connect(this.engineGain);
                        this.engineGain.connect(this.ctx.destination);
                        this.engineOsc.start();
                    } catch(e) {}
                }

                updateEnginePitch(speedRatio) {
                    if (!this.ctx || !this.engineOsc) return;
                    const freq = 30 + speedRatio * 160;
                    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
                }

                playSkidSound() {
                    if (!this.ctx) return;
                    const bufferSize = this.ctx.sampleRate * 0.1;
                    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        data[i] = Math.random() * 2 - 1;
                    }
                    const noise = this.ctx.createBufferSource();
                    noise.buffer = buffer;
                    const filter = this.ctx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.value = 1200;
                    const gain = this.ctx.createGain();
                    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
                    noise.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.ctx.destination);
                    noise.start();
                }

                playExplosion() {
                    if (!this.ctx) return;
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.4);
                    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.4);
                }

                playCoin() {
                    if (!this.ctx) return;
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(987.77, this.ctx.currentTime); // B5
                    osc.frequency.setValueAtTime(1318.51, this.ctx.currentTime + 0.08); // E6
                    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.2);
                }
            }

            const audio = new AudioEngine();

            // Save System Data Structure
            const DEFAULT_SAVE = {
                coins: 250,
                highScore: 0,
                selectedCar: 0,
                unlockedCars: [true, false, false, false],
                upgrades: { engine: 0, armor: 0 }
            };

            let saveData = JSON.parse(localStorage.getItem('drift_chase_save')) || DEFAULT_SAVE;

            function saveGame() {
                localStorage.setItem('drift_chase_save', JSON.stringify(saveData));
            }

            // Available Cars Specifications
            const CAR_CATALOG = [
                {
                    id: 0,
                    name: 'Rookie Coupe',
                    desc: 'Nimble tuner car with balanced drift mechanics.',
                    price: 0,
                    color: '#06b6d4',
                    accent: '#ffffff',
                    topSpeed: 10.5,
                    accel: 0.22,
                    handling: 0.055,
                    driftGrip: 0.94,
                    maxHealth: 100,
                    nitroMax: 3.0
                },
                {
                    id: 1,
                    name: 'Drift Spec RX',
                    desc: 'Tail-happy drift monster with high combo potential.',
                    price: 800,
                    color: '#f59e0b',
                    accent: '#1e293b',
                    topSpeed: 12.0,
                    accel: 0.25,
                    handling: 0.065,
                    driftGrip: 0.88,
                    maxHealth: 90,
                    nitroMax: 3.5
                },
                {
                    id: 2,
                    name: 'Enforcer V8',
                    desc: 'Heavyweight muscle car that crushes police pursuit.',
                    price: 1500,
                    color: '#ef4444',
                    accent: '#fbcfe8',
                    topSpeed: 11.5,
                    accel: 0.28,
                    handling: 0.048,
                    driftGrip: 0.95,
                    maxHealth: 180,
                    nitroMax: 4.0
                },
                {
                    id: 3,
                    name: 'Apex Hypercar',
                    desc: 'Extreme supercar with ultra top speed and nitro output.',
                    price: 3000,
                    color: '#10b981',
                    accent: '#38bdf8',
                    topSpeed: 14.5,
                    accel: 0.35,
                    handling: 0.060,
                    driftGrip: 0.92,
                    maxHealth: 120,
                    nitroMax: 5.0
                }
            ];

            class ParticleSystem {
                constructor() {
                    this.particles = [];
                    this.fx = [];
                }
            
                spawnSmoke(x, y, vx, vy, color = 'rgba(200, 200, 200, 0.4)', maxRadius = 12) {
                    this.particles.push({
                        x, y,
                        vx: vx + (Math.random() - 0.5) * 1.5,
                        vy: vy + (Math.random() - 0.5) * 1.5,
                        radius: 3 + Math.random() * 4,
                        maxRadius,
                        alpha: 0.5,
                        color,
                        life: 1.0,
                        decay: 0.02 + Math.random() * 0.02
                    });
                }
            
                spawnSpark(x, y) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 2 + Math.random() * 6;
                    this.particles.push({
                        x, y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        radius: 1 + Math.random() * 2,
                        color: '#fbbf24',
                        alpha: 1.0,
                        life: 1.0,
                        decay: 0.05 + Math.random() * 0.05
                    });
                }
            
                spawnExplosion(x, y) {
                    for (let i = 0; i < 35; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 1 + Math.random() * 8;
                        const isFire = Math.random() > 0.3;
                        this.particles.push({
                            x, y,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            radius: isFire ? (4 + Math.random() * 6) : (2 + Math.random() * 3),
                            maxRadius: 18,
                            color: isFire ? (Math.random() > 0.5 ? '#ef4444' : '#f59e0b') : '#475569',
                            alpha: 1.0,
                            life: 1.0,
                            decay: 0.02 + Math.random() * 0.02
                        });
                    }
                }

                spawnDeathExplosion(x, y, colorA, colorB) {
                    // Flash gigante
                    this.fx.push({ type: 'flash', x, y, radius: 30, grow: 20, life: 1, decay: 0.07 });
                
                    // Ondas de choque
                    this.fx.push({ type: 'ring', x, y, radius: 10, grow: 22, width: 16, color: '#ffffff', life: 1, decay: 0.035 });
                    this.fx.push({ type: 'ring', x, y, radius: 6, grow: 15, width: 10, color: '#fbbf24', life: 1, decay: 0.03 });
                    this.fx.push({ type: 'ring', x, y, radius: 4, grow: 9, width: 7, color: '#ef4444', life: 1, decay: 0.025 });
                
                    // Estrela gigante
                    this.fx.push({
                        type: 'star', x, y, radius: 30, grow: 12,
                        rot: Math.random() * Math.PI, spin: 0.03, spikes: 12,
                        life: 1, decay: 0.05
                    });
                
                    // Bola de fogo
                    const fireColors = ['#ffffff', '#fde047', '#fbbf24', '#f97316', '#ef4444', '#b91c1c'];
                    for (let i = 0; i < 60; i++) {
                        const a = Math.random() * Math.PI * 2;
                        const speed = 0.5 + Math.random() * 4.5;
                        this.particles.push({
                            x, y,
                            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                            radius: 8 + Math.random() * 10, maxRadius: 38,
                            color: fireColors[Math.floor(Math.random() * fireColors.length)],
                            alpha: 0.9, life: 1.0, decay: 0.018 + Math.random() * 0.02
                        });
                    }
                
                    // Fumaça preta que demora a sumir
                    for (let i = 0; i < 22; i++) {
                        const a = Math.random() * Math.PI * 2;
                        const speed = 0.3 + Math.random() * 1.9;
                        this.particles.push({
                            x, y,
                            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                            radius: 10 + Math.random() * 8, maxRadius: 55,
                            color: Math.random() > 0.5 ? 'rgba(20, 20, 25, 0.8)' : 'rgba(70, 70, 80, 0.7)',
                            alpha: 0.8, life: 1.0, decay: 0.011 + Math.random() * 0.006
                        });
                    }
                
                    // Brasas
                    for (let i = 0; i < 40; i++) {
                        const a = Math.random() * Math.PI * 2;
                        const speed = 3 + Math.random() * 8;
                        this.particles.push({
                            x, y,
                            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                            radius: 1.5 + Math.random() * 2, color: '#fbbf24',
                            alpha: 1.0, life: 1.0, decay: 0.02 + Math.random() * 0.02
                        });
                    }
                
                    // Faíscas em risco
                    const sparkColors = ['#ffffff', '#fde68a', '#fbbf24', '#f97316'];
                    for (let i = 0; i < 60; i++) {
                        const a = Math.random() * Math.PI * 2;
                        const speed = 6 + Math.random() * 20;
                        this.fx.push({
                            type: 'streak', x, y,
                            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                            friction: 0.94, width: 2 + Math.random() * 2.5,
                            color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
                            life: 1, decay: 0.02 + Math.random() * 0.03
                        });
                    }
                
                    // Pedaços do carro
                    const shardColors = [colorA, colorB, '#1e293b'];
                    for (let i = 0; i < 26; i++) {
                        const a = Math.random() * Math.PI * 2;
                        const speed = 3 + Math.random() * 12;
                        this.fx.push({
                            type: 'shard', x, y,
                            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                            friction: 0.95, size: 4 + Math.random() * 6,
                            rot: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.6,
                            color: shardColors[Math.floor(Math.random() * shardColors.length)],
                            life: 1, decay: 0.012 + Math.random() * 0.013
                        });
                    }
                
                    // Mancha de queimado no chão (fica por último para ser desenhada por baixo)
                    this.fx.push({ type: 'scorch', x, y, radius: 70, life: 1, decay: 0.008 });
                }
                
                spawnSecondaryBlast(x, y) {
                    this.fx.push({ type: 'flash', x, y, radius: 18, grow: 14, life: 1, decay: 0.1 });
                    this.fx.push({ type: 'ring', x, y, radius: 6, grow: 12, width: 8, color: '#fbbf24', life: 1, decay: 0.05 });
                
                    const fireColors = ['#fde047', '#f97316', '#ef4444'];
                    for (let i = 0; i < 14; i++) {
                        const a = Math.random() * Math.PI * 2;
                        const speed = 0.5 + Math.random() * 3;
                        this.particles.push({
                            x, y,
                            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                            radius: 6 + Math.random() * 6, maxRadius: 26,
                            color: fireColors[Math.floor(Math.random() * fireColors.length)],
                            alpha: 0.9, life: 1.0, decay: 0.03 + Math.random() * 0.02
                        });
                    }
                
                    for (let i = 0; i < 14; i++) {
                        const a = Math.random() * Math.PI * 2;
                        const speed = 4 + Math.random() * 11;
                        this.fx.push({
                            type: 'streak', x, y,
                            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                            friction: 0.93, width: 1.5 + Math.random() * 2,
                            color: Math.random() > 0.5 ? '#ffffff' : '#fbbf24',
                            life: 1, decay: 0.035 + Math.random() * 0.03
                        });
                    }
                }
            
                spawnImpact(x, y, nx, ny, colorA, colorB, damage) {
                    const base = Math.atan2(ny, nx);
            
                    // Flash branco do impacto
                    this.fx.push({ type: 'flash', x, y, radius: 14, grow: 8, life: 1, decay: 0.16 });
            
                    // Ondas de choque
                    this.fx.push({ type: 'ring', x, y, radius: 6, grow: 10, width: 8, color: '#ffffff', life: 1, decay: 0.07 });
                    this.fx.push({ type: 'ring', x, y, radius: 4, grow: 6, width: 5, color: '#fbbf24', life: 1, decay: 0.05 });
            
                    // Estrela de impacto (estilo quadrinhos)
                    this.fx.push({
                        type: 'star', x, y, radius: 12, grow: 5,
                        rot: Math.random() * Math.PI, spin: 0.05, spikes: 9,
                        life: 1, decay: 0.09
                    });
            
                    // Faíscas em risco
                    const sparkColors = ['#ffffff', '#fde68a', '#fbbf24', '#f97316'];
                    for (let i = 0; i < 28; i++) {
                        const a = base + (Math.random() - 0.5) * Math.PI * 1.6;
                        const speed = 4 + Math.random() * 12;
                        this.fx.push({
                            type: 'streak', x, y,
                            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                            friction: 0.92, width: 1.5 + Math.random() * 2,
                            color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
                            life: 1, decay: 0.035 + Math.random() * 0.04
                        });
                    }
            
                    // Estilhaços de lataria (cores dos dois carros)
                    for (let i = 0; i < 12; i++) {
                        const a = Math.random() * Math.PI * 2;
                        const speed = 2 + Math.random() * 7;
                        this.fx.push({
                            type: 'shard', x, y,
                            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                            friction: 0.94, size: 3 + Math.random() * 4,
                            rot: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.5,
                            color: Math.random() > 0.5 ? colorA : colorB,
                            life: 1, decay: 0.025 + Math.random() * 0.02
                        });
                    }
            
                    // Fumaça / poeira
                    for (let i = 0; i < 8; i++) {
                        this.spawnSmoke(x, y, nx * 1.5, ny * 1.5, 'rgba(160, 160, 170, 0.45)', 22);
                    }
            
                    // Número de dano subindo
                    this.fx.push({ type: 'text', x, y: y - 24, text: `-${damage}`, vy: -1.4, life: 1, decay: 0.018 });
                }
            
                updateAndDrawFx(ctx) {
                    for (let i = this.fx.length - 1; i >= 0; i--) {
                        const e = this.fx[i];
                        e.life -= e.decay;
                        if (e.life <= 0) {
                            this.fx.splice(i, 1);
                            continue;
                        }
            
                        ctx.save();
            
                        if (e.type === 'flash') {
                            e.radius += e.grow;
                            ctx.globalCompositeOperation = 'lighter';
                            const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius);
                            g.addColorStop(0, `rgba(255, 255, 255, ${e.life})`);
                            g.addColorStop(0.4, `rgba(253, 224, 71, ${e.life * 0.7})`);
                            g.addColorStop(1, 'rgba(249, 115, 22, 0)');
                            ctx.fillStyle = g;
                            ctx.beginPath();
                            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
                            ctx.fill();
            
                        } else if (e.type === 'ring') {
                            e.radius += e.grow;
                            e.grow *= 0.94;
                            ctx.globalCompositeOperation = 'lighter';
                            ctx.globalAlpha = e.life;
                            ctx.strokeStyle = e.color;
                            ctx.lineWidth = Math.max(0.5, e.width * e.life);
                            ctx.beginPath();
                            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
                            ctx.stroke();
            
                        } else if (e.type === 'star') {
                            e.radius += e.grow;
                            e.rot += e.spin;
                            ctx.globalCompositeOperation = 'lighter';
                            ctx.globalAlpha = e.life;
                            ctx.translate(e.x, e.y);
                            ctx.rotate(e.rot);
                            ctx.fillStyle = '#fde047';
                            ctx.strokeStyle = '#ffffff';
                            ctx.lineWidth = 2;
                            ctx.beginPath();
                            const points = e.spikes * 2;
                            for (let k = 0; k < points; k++) {
                                const r = k % 2 === 0 ? e.radius : e.radius * 0.45;
                                const a = (k / points) * Math.PI * 2;
                                const px = Math.cos(a) * r;
                                const py = Math.sin(a) * r;
                                if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                            }
                            ctx.closePath();
                            ctx.fill();
                            ctx.stroke();
            
                        } else if (e.type === 'streak') {
                            e.x += e.vx;
                            e.y += e.vy;
                            e.vx *= e.friction;
                            e.vy *= e.friction;
                            ctx.globalCompositeOperation = 'lighter';
                            ctx.globalAlpha = Math.min(1, e.life * 1.5);
                            ctx.strokeStyle = e.color;
                            ctx.lineWidth = e.width;
                            ctx.lineCap = 'round';
                            ctx.beginPath();
                            ctx.moveTo(e.x, e.y);
                            ctx.lineTo(e.x - e.vx * 2.2, e.y - e.vy * 2.2);
                            ctx.stroke();
            
                        } else if (e.type === 'shard') {
                            e.x += e.vx;
                            e.y += e.vy;
                            e.vx *= e.friction;
                            e.vy *= e.friction;
                            e.rot += e.spin;
                            ctx.globalAlpha = Math.min(1, e.life * 1.5);
                            ctx.translate(e.x, e.y);
                            ctx.rotate(e.rot);
                            ctx.fillStyle = e.color;
                            ctx.fillRect(-e.size, -e.size * 0.5, e.size * 2, e.size);
            
                        } else if (e.type === 'scorch') {
                            const a = Math.min(0.6, e.life);
                            const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius);
                            g.addColorStop(0, `rgba(0, 0, 0, ${a})`);
                            g.addColorStop(0.6, `rgba(10, 10, 15, ${a * 0.6})`);
                            g.addColorStop(1, 'rgba(10, 10, 15, 0)');
                            ctx.fillStyle = g;
                            ctx.beginPath();
                            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
                            ctx.fill();
                        } else if (e.type === 'text') {
                            e.y += e.vy;
                            e.vy *= 0.97;
                            const pop = e.life > 0.9 ? 1 + (e.life - 0.9) * 8 : 1;
                            ctx.globalAlpha = Math.min(1, e.life * 2);
                            ctx.translate(e.x, e.y);
                            ctx.scale(pop, pop);
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.font = 'bold 30px "Segoe UI", Arial, sans-serif';
                            ctx.lineJoin = 'round';
                            ctx.lineWidth = 5;
                            ctx.strokeStyle = '#ffffff';
                            ctx.strokeText(e.text, 0, 0);
                            ctx.fillStyle = '#ef4444';
                            ctx.fillText(e.text, 0, 0);
                        }
                        ctx.restore();
                    }
                }
            
                updateAndDraw(ctx) {
                    this.updateAndDrawFx(ctx);
            
                    for (let i = this.particles.length - 1; i >= 0; i--) {
                        const p = this.particles[i];
                        p.x += p.vx;
                        p.y += p.vy;
                        p.life -= p.decay;
                        if (p.maxRadius && p.radius < p.maxRadius) {
                            p.radius += 0.3;
                        }
            
                        if (p.life <= 0) {
                            this.particles.splice(i, 1);
                            continue;
                        }
            
                        ctx.save();
                        ctx.globalAlpha = Math.max(0, p.life * p.alpha);
                        ctx.fillStyle = p.color;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }
    
            class SkidmarkManager {
                // Stores skid marks as world-space line segments instead of a fixed-size
                // canvas, so they keep working no matter how far the player drives.
                constructor() {
                    this.marks = [];
                    this.maxMarks = 2500; // cap to avoid unbounded memory growth
                }
            
                clear() {
                    this.marks = [];
                }
            
                addSkidLine(p1, p2, alpha = 0.3) {
                    this.marks.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, alpha });
                    if (this.marks.length > this.maxMarks) {
                        this.marks.shift();
                    }
                }
            
                render(ctx) {
                    ctx.save();
                    ctx.lineWidth = SKIDMARK_WIDTH;
                    ctx.lineCap = 'round';
                    for (const m of this.marks) {
                        ctx.strokeStyle = `rgba(15, 23, 42, ${m.alpha})`;
                        ctx.beginPath();
                        ctx.moveTo(m.x1, m.y1);
                        ctx.lineTo(m.x2, m.y2);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            }

            class Vehicle {
                constructor(x, y, carConfig) {
                    this.x = x;
                    this.y = y;
                    this.angle = 0;
                    this.vx = 0;
                    this.vy = 0;
                    this.width = 44 * PLAYER_SIZE_SCALE;
                    this.height = 22 * PLAYER_SIZE_SCALE;

                    this.config = carConfig;
                    this.topSpeed = carConfig.topSpeed;
                    this.accel = carConfig.accel;
                    this.handling = carConfig.handling;
                    this.driftGrip = carConfig.driftGrip;
                    this.maxHealth = carConfig.maxHealth;
                    this.health = this.maxHealth;

                    this.isHandbraking = false;
                    this.isDrifting = false;
                    this.isNitro = false;
                    this.lastRearLeft = null;
                    this.lastRearRight = null;
                }

                updatePhysics(inputs) {
                    // Determine engine acceleration & nitro state
                    let currentAccel = this.accel;
                    let currentTopSpeed = this.topSpeed;

                    if (inputs.nitro && this.nitroEnergy > 0) {
                        this.isNitro = true;
                        currentAccel *= 2.2;
                        currentTopSpeed *= 1.45;
                        this.nitroEnergy = Math.max(0, this.nitroEnergy - 0.016);
                    } else {
                        this.isNitro = false;
                    }

                    // Throttle / Reverse
                    if (inputs.up) {
                        this.vx += Math.cos(this.angle) * currentAccel;
                        this.vy += Math.sin(this.angle) * currentAccel;
                    } else if (inputs.down) {
                        this.vx -= Math.cos(this.angle) * (currentAccel * 0.6);
                        this.vy -= Math.sin(this.angle) * (currentAccel * 0.6);
                    }

                    // Speed calculation
                    let currentSpeed = Math.hypot(this.vx, this.vy);

                    // Cap Top Speed
                    if (currentSpeed > currentTopSpeed) {
                        this.vx = (this.vx / currentSpeed) * currentTopSpeed;
                        this.vy = (this.vy / currentSpeed) * currentTopSpeed;
                        currentSpeed = currentTopSpeed;
                    }

                    // Steering (scaled by movement speed)
                    this.isHandbraking = inputs.handbrake;
                    if (currentSpeed > 0.5) {
                        const dir = currentSpeed > 0 ? 1 : -1;
                        const turnMult = this.isHandbraking ? DRIFT_TURN_BOOST : 1.0;
                        if (inputs.left) this.angle -= this.handling * turnMult * dir;
                        if (inputs.right) this.angle += this.handling * turnMult * dir;
                    }

                    // Split velocity into forward & lateral vectors
                    const forwardDir = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
                    const rightDir = { x: -Math.sin(this.angle), y: Math.cos(this.angle) };

                    let forwardVel = this.vx * forwardDir.x + this.vy * forwardDir.y;
                    let lateralVel = this.vx * rightDir.x + this.vy * rightDir.y;

                    // Drift grip physics calculation
                    let grip = this.isHandbraking ? DRIFT_HANDBRAKE_GRIP : (this.driftGrip || 0.92);
                    lateralVel *= grip;
                    forwardVel *= 0.985; // Rolling drag

                    // Reconstruct velocity vectors
                    this.vx = forwardDir.x * forwardVel + rightDir.x * lateralVel;
                    this.vy = forwardDir.y * forwardVel + rightDir.y * lateralVel;

                    // Update position
                    this.x += this.vx;
                    this.y += this.vy;

                    // Detect drift condition (high speed & lateral movement)
                    const lateralSlip = Math.abs(this.vx * rightDir.x + this.vy * rightDir.y);
                    this.isDrifting = (currentSpeed > 4.5 && (lateralSlip > 1.8 || this.isHandbraking));

                    // Position calculation for rear tires (skidmarks)
                    const rearOffset = -this.width * 0.4;
                    const sideOffset = this.height * 0.38;
                    const rl = {
                        x: this.x + Math.cos(this.angle) * rearOffset - Math.sin(this.angle) * (-sideOffset),
                        y: this.y + Math.sin(this.angle) * rearOffset + Math.cos(this.angle) * (-sideOffset)
                    };
                    const rr = {
                        x: this.x + Math.cos(this.angle) * rearOffset - Math.sin(this.angle) * (sideOffset),
                        y: this.y + Math.sin(this.angle) * rearOffset + Math.cos(this.angle) * (sideOffset)
                    };

                    if (this.isDrifting && game) {
                        if (this.lastRearLeft && this.lastRearRight) {
                            game.skidmarks.addSkidLine(this.lastRearLeft, rl, SKIDMARK_ALPHA);
                            game.skidmarks.addSkidLine(this.lastRearRight, rr, SKIDMARK_ALPHA);
                        }
                        // Spawn smoke particles
                        for (let i = 0; i < DRIFT_SMOKE_COUNT; i++) {
                            game.particles.spawnSmoke(rl.x, rl.y, -this.vx * 0.2, -this.vy * 0.2);
                            game.particles.spawnSmoke(rr.x, rr.y, -this.vx * 0.2, -this.vy * 0.2);
                        }
                    
                        game.camera.shake = Math.max(game.camera.shake, DRIFT_CAMERA_SHAKE);
                    
                        if (Math.random() < 0.2) audio.playSkidSound();
                    }

                    this.lastRearLeft = rl;
                    this.lastRearRight = rr;
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    // Nitro Flame Trail
                    if (this.isNitro) {
                        ctx.fillStyle = '#06b6d4';
                        ctx.beginPath();
                        ctx.moveTo(-this.width / 2, -6);
                        ctx.lineTo(-this.width / 2 - 18 - Math.random() * 10, 0);
                        ctx.lineTo(-this.width / 2, 6);
                        ctx.fill();
                    }

                    // Vehicle Shadow
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
                    ctx.fillRect(-this.width / 2 + 4, -this.height / 2 + 4, this.width, this.height);

                    // Body Chassis
                    ctx.fillStyle = this.config.color || '#06b6d4';
                    ctx.beginPath();
                    ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, 6);
                    ctx.fill();
                    ctx.strokeStyle = '#0f172a';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // Roof/Windshield details
                    ctx.fillStyle = '#1e293b';
                    ctx.beginPath();
                    ctx.roundRect(-this.width * 0.15, -this.height * 0.35, this.width * 0.45, this.height * 0.7, 3);
                    ctx.fill();

                    // Headlight beams glow
                    ctx.fillStyle = 'rgba(254, 240, 138, 0.8)';
                    ctx.fillRect(this.width / 2 - 2, -this.height / 2 + 2, 3, 5);
                    ctx.fillRect(this.width / 2 - 2, this.height / 2 - 7, 3, 5);

                    ctx.restore();

                    // Headlight Light Cone in world space
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);
                    const lightGrad = ctx.createRadialGradient(this.width / 2, 0, 5, this.width / 2 + 120, 0, 120);
                    lightGrad.addColorStop(0, 'rgba(254, 240, 138, 0.25)');
                    lightGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
                    ctx.fillStyle = lightGrad;
                    ctx.beginPath();
                    ctx.moveTo(this.width / 2, 0);
                    ctx.lineTo(this.width / 2 + 150, -60);
                    ctx.lineTo(this.width / 2 + 150, 60);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
            }

            class CopVehicle extends Vehicle {
                constructor(x, y, copType) {
                    let config = {
                        topSpeed: 10.0,
                        accel: 0.20,
                        handling: 0.05,
                        driftGrip: 0.90,
                        maxHealth: 60,
                        color: '#ffffff'
                    };

                    if (copType === 'INTERCEPTOR') {
                        config.topSpeed = 12.8;
                        config.accel = 0.26;
                        config.handling = 0.06;
                        config.color = '#f59e0b'; // Yellow fast cop
                        config.maxHealth = 45;
                    } else if (copType === 'SWAT') {
                        config.topSpeed = 9.2;
                        config.accel = 0.18;
                        config.handling = 0.04;
                        config.color = '#1e293b'; // Heavy SWAT SUV
                        config.maxHealth = 140;
                    }

                    super(x, y, config);

                    this.width = 44 * COP_SIZE_SCALE;
                    this.height = 22 * COP_SIZE_SCALE;
                    this.copType = copType;
                    this.sirenTimer = 0;
                    this.hitCooldown = 0;
                    this.retreatTimer = 0;
                }

                updateAI(targetPlayer) {
                    this.sirenTimer += 0.1;
                
                    const dx = targetPlayer.x - this.x;
                    const dy = targetPlayer.y - this.y;
                    const dist = Math.hypot(dx, dy);
                    const targetAngle = Math.atan2(dy, dx);
                
                    // Angle difference normalization
                    let angleDiff = targetAngle - this.angle;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                
                    // RECUO: depois de bater, volta de ré olhando pro jogador
                    if (this.retreatTimer > 0) {
                        this.retreatTimer--;
                        const maxTurn = this.handling * 1.6;
                        this.angle += Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
                        this.updatePhysics({
                            up: false, down: true, left: false, right: false,
                            handbrake: false, nitro: false
                        });
                        return;
                    }
                
                    const close = dist < COP_CLOSE_RANGE;
                    const aligned = Math.abs(angleDiff) < 0.6;
                
                    if (close) {
                        // Perto do jogador: gira no lugar até alinhar (evita ficar orbitando)
                        const maxTurn = this.handling * 1.6;
                        this.angle += Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
                
                        // Se ainda não está de frente pro jogador, freia em vez de acelerar
                        if (!aligned) {
                            this.vx *= 0.92;
                            this.vy *= 0.92;
                        }
                    }
                
                    const steerInput = {
                        up: close ? aligned : true,
                        down: false,
                        left: !close && angleDiff < -0.1,
                        right: !close && angleDiff > 0.1,
                        handbrake: !close && Math.abs(angleDiff) > 1.2, // Handbrake turn on tight angles
                        nitro: false
                    };
                
                    this.updatePhysics(steerInput);
                }

                draw(ctx) {
                    super.draw(ctx);

                    // Flashy Siren Lights (Red & Blue)
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.angle);

                    const flash = Math.sin(this.sirenTimer * 10) > 0;
                    ctx.fillStyle = flash ? '#ef4444' : '#3b82f6';
                    ctx.beginPath();
                    ctx.arc(0, -this.height * 0.2, 4, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = !flash ? '#ef4444' : '#3b82f6';
                    ctx.beginPath();
                    ctx.arc(0, this.height * 0.2, 4, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();
                }
            }

            class MapProp {
                constructor(x, y, type) {
                    this.x = x;
                    this.y = y;
                    this.type = type; // 'BARREL' or 'CRATE'
                    this.radius = type === 'BARREL' ? 14 : 18;
                    this.destroyed = false;
                }

                draw(ctx) {
                    if (this.destroyed) return;
                    ctx.save();
                    ctx.translate(this.x, this.y);

                    if (this.type === 'BARREL') {
                        ctx.fillStyle = '#ef4444';
                        ctx.beginPath();
                        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = '#7f1d1d';
                        ctx.lineWidth = 3;
                        ctx.stroke();
                    } else {
                        ctx.fillStyle = '#d97706';
                        ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
                        ctx.strokeStyle = '#78350f';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
                    }

                    ctx.restore();
                }
            }

            class CoinPickup {
                constructor(x, y, value = 25) {
                    this.x = x;
                    this.y = y;
                    this.value = value;
                    this.radius = 10 * COIN_ORB_SCALE;
                    this.bobble = Math.random() * 10;
                }

                draw(ctx) {
                    this.bobble += 0.08;
                    const offset = Math.sin(this.bobble) * 3;

                    ctx.save();
                    ctx.translate(this.x, this.y + offset);

                    // Golden Glow
                    ctx.fillStyle = '#f59e0b';
                    ctx.beginPath();
                    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#fef08a';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    ctx.fillStyle = '#78350f';
                    ctx.font = '900 10px Orbitron';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('$', 0, 1);

                    ctx.restore();
                }
            }

            class HealthPickup {
                constructor(x, y) {
                    this.x = x;
                    this.y = y;
                    this.radius = 12 * HEALTH_ORB_SCALE;
                    this.bobble = Math.random() * 10;
                }
            
                draw(ctx) {
                    this.bobble += 0.08;
                    const offset = Math.sin(this.bobble) * 3;
            
                    ctx.save();
                    ctx.translate(this.x, this.y + offset);
            
                    ctx.fillStyle = '#22c55e';
                    ctx.beginPath();
                    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#bbf7d0';
                    ctx.lineWidth = 2;
                    ctx.stroke();
            
                    ctx.fillStyle = '#052e16';
                    ctx.fillRect(-6, -1.5, 12, 3);
                    ctx.fillRect(-1.5, -6, 3, 12);
            
                    ctx.restore();
                }
            }

            class Camera {
                constructor() {
                    this.x = 0;
                    this.y = 0;
                    this.zoom = 1.0;
                    this.targetZoom = 1.0;
                    this.shake = 0;
                }

                follow(target, viewportWidth, viewportHeight) {
                    // Smooth Lerp Camera tracking
                    this.x += (target.x - this.x) * 0.08;
                    this.y += (target.y - this.y) * 0.08;

                    // Speed-based dynamic zoom
                    const speed = Math.hypot(target.vx, target.vy);
                    this.targetZoom = 1.0 - Math.min(0.25, speed * 0.015);
                    this.zoom += (this.targetZoom - this.zoom) * 0.05;

                    // Screen Shake Decay
                    if (this.shake > 0) this.shake *= 0.88;
                }

                applyTransform(ctx, viewportWidth, viewportHeight) {
                    ctx.save();
                    ctx.translate(viewportWidth / 2, viewportHeight / 2);
                    ctx.scale(this.zoom, this.zoom);

                    let shakeX = (Math.random() - 0.5) * this.shake;
                    let shakeY = (Math.random() - 0.5) * this.shake;
                    ctx.translate(-this.x + shakeX, -this.y + shakeY);
                }

                restoreTransform(ctx) {
                    ctx.restore();
                }
            }

            class GameEngine {
                constructor() {
                    this.state = 'MENU'; // MENU, PLAYING, PAUSED, GAMEOVER
                    this.player = null;
                    this.cops = [];
                    this.props = [];
                    this.coins = [];
                    this.particles = new ParticleSystem();
                    this.skidmarks = new SkidmarkManager();
                    this.camera = new Camera();

                    this.score = 0;
                    this.coinsEarnedSession = 0;
                    this.copsWrecked = 0;
                    this.survivalTimer = 0;
                    this.copSpawnTimer = 0;

                    this.driftComboScore = 0;
                    this.driftMultiplier = 1.0;

                    this.inputs = {
                        up: false,
                        down: false,
                        left: false,
                        right: false,
                        handbrake: false,
                        nitro: false
                    };

                }

                // Keeps a steady number of barrels/crates near the player, spawning new
                // ones ahead and dropping old ones that were left far behind.
                maintainProps() {
                    if (!this.player) return;
                    this.props = this.props.filter(p => !p.destroyed &&
                        Math.hypot(p.x - this.player.x, p.y - this.player.y) < PROP_DESPAWN_RADIUS);

                    while (this.props.length < PROP_TARGET_COUNT) {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = 300 + Math.random() * (PROP_SPAWN_RADIUS - 300);
                        const x = this.player.x + Math.cos(angle) * dist;
                        const y = this.player.y + Math.sin(angle) * dist;
                        const type = Math.random() > 0.5 ? 'BARREL' : 'CRATE';
                        this.props.push(new MapProp(x, y, type));
                    }
                }

                // Same idea as maintainProps() but for coin pickups.
                maintainCoins() {
                    if (!this.player) return;
                    this.coins = this.coins.filter(c =>
                        Math.hypot(c.x - this.player.x, c.y - this.player.y) < COIN_DESPAWN_RADIUS);

                    while (this.coins.length < COIN_TARGET_COUNT) {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = 200 + Math.random() * (COIN_SPAWN_RADIUS - 200);
                        const x = this.player.x + Math.cos(angle) * dist;
                        const y = this.player.y + Math.sin(angle) * dist;
                        this.coins.push(new CoinPickup(x, y, 25));
                    }
                }

                maintainHealthPickups() {
                    if (!this.player) return;
                    this.healthPickups = this.healthPickups.filter(h =>
                        Math.hypot(h.x - this.player.x, h.y - this.player.y) < HEALTH_PICKUP_DESPAWN_RADIUS);
                
                    while (this.healthPickups.length < HEALTH_PICKUP_TARGET_COUNT) {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = 200 + Math.random() * (HEALTH_PICKUP_SPAWN_RADIUS - 200);
                        const x = this.player.x + Math.cos(angle) * dist;
                        const y = this.player.y + Math.sin(angle) * dist;
                        this.healthPickups.push(new HealthPickup(x, y));
                    }
                }

                startNewGame() {
                    audio.init();
                
                    const carConfig = CAR_CATALOG[saveData.selectedCar || 0];
                
                    // Apply Upgrades
                    const upgradedConfig = { ...carConfig };
                    upgradedConfig.topSpeed += (saveData.upgrades.engine || 0) * 0.8;
                    upgradedConfig.accel += (saveData.upgrades.engine || 0) * 0.03;
                    upgradedConfig.maxHealth += (saveData.upgrades.armor || 0) * 25;
                
                    this.player = new Vehicle(0, 0, upgradedConfig);
                    this.player.nitroEnergy = upgradedConfig.nitroMax;
                    this.player.nitroMax = upgradedConfig.nitroMax;
                
                    this.cops = [];
                    this.coins = [];
                    this.healthPickups = [];
                    this.props = [];
                    this.skidmarks.clear();
                    this.particles.particles = [];
                    this.particles.fx = [];
                    this.camera.x = 0;
                    this.camera.y = 0;
                
                    this.score = 0;
                    this.coinsEarnedSession = 0;
                    this.copsWrecked = 0;
                    this.survivalTimer = 0;
                    this.copSpawnTimer = 0;
                    this.driftComboScore = 0;
                    this.driftMultiplier = 1.0;

                    this.spawnCop('STANDARD');
                    this.spawnCop('STANDARD');
                
                    this.maintainProps();
                    this.maintainCoins();
                    this.maintainHealthPickups();
                
                    this.state = 'PLAYING';
                
                    document.getElementById('mainMenu').classList.add('hidden');
                    document.getElementById('gameOverModal').classList.add('hidden');
                    document.getElementById('hudOverlay').classList.remove('hidden');
                }

                spawnCop(type) {
                    // Spawn cops in a ring around the player, wherever they currently are
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 900 + Math.random() * 300;
                    const x = this.player.x + Math.cos(angle) * dist;
                    const y = this.player.y + Math.sin(angle) * dist;
                    this.cops.push(new CopVehicle(x, y, type));
                }

                startDeathExplosion() {
                    this.state = 'EXPLODING';
                    this.deathStart = performance.now();
                    this.deathFrames = 0;
                    this.deathBlasts = [130, 300, 520, 760]; // explosões secundárias (ms)
                
                    const p = this.player;
                    p.vx = 0;
                    p.vy = 0;
                    p.dead = true;
                
                    this.camera.shake = 45;
                    audio.playExplosion();
                    this.particles.spawnDeathExplosion(p.x, p.y, p.config.color, p.config.accent || '#ffffff');
                
                    document.getElementById('hudOverlay').classList.add('hidden');
                    document.getElementById('driftComboContainer').style.opacity = '0';
                }
                
                updateDeathAnimation() {
                    this.deathFrames++;
                    const elapsed = performance.now() - this.deathStart;
                
                    // Policiais continuam andando
                    for (const cop of this.cops) cop.updateAI(this.player);
                
                    // Explosões secundárias
                    while (this.deathBlasts.length && elapsed >= this.deathBlasts[0]) {
                        this.deathBlasts.shift();
                        const ox = (Math.random() - 0.5) * 70;
                        const oy = (Math.random() - 0.5) * 70;
                        this.particles.spawnSecondaryBlast(this.player.x + ox, this.player.y + oy);
                        this.camera.shake = Math.max(this.camera.shake, 24);
                        audio.playExplosion();
                    }
                
                    this.camera.follow(this.player, CANVAS.width, CANVAS.height);
                
                    // Termina por tempo (ou por segurança, depois de muitos frames)
                    if (!(elapsed < DEATH_ANIM_MS) || this.deathFrames > 400) {
                        this.endDeathAnimation();
                    }
                }
                
                endDeathAnimation() {
                    // Para tudo: sem tremor de câmera, sem partículas, sem movimento
                    this.camera.shake = 0;
                    this.particles.particles = [];
                    this.particles.fx = [];
                
                    this.triggerGameOver(); // salva moedas/recorde e abre a tela de game over
                
                    if (!DEATH_SHOWS_GAME_OVER) {
                        this.state = 'MENU';
                        document.getElementById('gameOverModal').classList.add('hidden');
                        document.getElementById('mainMenu').classList.remove('hidden');
                        updateMenuData();
                    }
                }
                
                update() {
                    if (this.state === 'EXPLODING') {
                        this.updateDeathAnimation();
                        return;
                    }
                    if (this.state !== 'PLAYING') return;
                
                    this.survivalTimer += 1 / 60;
                    this.copSpawnTimer += 1 / 60;
                
                    // Dynamic Cop Spawns (increasing intensity)
                    const spawnInterval = Math.max(4, 12 - Math.floor(this.survivalTimer / 20));
                    if (this.copSpawnTimer >= spawnInterval && this.cops.length < 12) {
                        this.copSpawnTimer = 0;
                        const r = Math.random();
                        const copType = r > 0.7 ? 'SWAT' : (r > 0.4 ? 'INTERCEPTOR' : 'STANDARD');
                        this.spawnCop(copType);
                    }
                
                    // Update Player
                    this.player.updatePhysics(this.inputs);
                    audio.updateEnginePitch(Math.hypot(this.player.vx, this.player.vy) / this.player.topSpeed);
                
                    this.maintainProps();
                    this.maintainCoins();
                    this.maintainHealthPickups();
                
                    // Drift Combo Logic
                    if (this.player.isDrifting) {
                        this.driftComboScore += 12;
                        this.driftMultiplier = Math.min(5.0, this.driftMultiplier + 0.005);
                        this.score += Math.floor(2 * this.driftMultiplier);
                
                        // Show drift overlay
                        const comboElem = document.getElementById('driftComboContainer');
                        comboElem.style.opacity = '1';
                        document.getElementById('driftComboMultiplier').innerText = `DRIFT x${this.driftMultiplier.toFixed(1)}`;
                        document.getElementById('driftComboScore').innerText = `+${Math.floor(this.driftComboScore)}`;
                    } else {
                        if (this.driftComboScore > 0) {
                            this.score += Math.floor(this.driftComboScore * this.driftMultiplier);
                            this.driftComboScore = 0;
                            this.driftMultiplier = 1.0;
                        }
                        document.getElementById('driftComboContainer').style.opacity = '0';
                    }
                
                    // Update Cops & Cop Collisions
                    for (let i = this.cops.length - 1; i >= 0; i--) {
                        const cop = this.cops[i];
                        cop.updateAI(this.player);
                        if (cop.hitCooldown > 0) cop.hitCooldown--;
                
                        // Cop vs Player Collision
                        const distToPlayer = Math.hypot(cop.x - this.player.x, cop.y - this.player.y);
                        if (distToPlayer < 36) {
                            this.camera.shake = 18;
                            this.particles.spawnSpark((cop.x + this.player.x) / 2, (cop.y + this.player.y) / 2);
                
                            // Batida: joga o policial pra trás e faz ele recuar antes de atacar de novo
                            if (cop.retreatTimer <= 0) {
                                const kdx = cop.x - this.player.x;
                                const kdy = cop.y - this.player.y;
                                const kd = Math.hypot(kdx, kdy) || 1;
                                cop.x = this.player.x + (kdx / kd) * 40;
                                cop.y = this.player.y + (kdy / kd) * 40;
                                cop.vx = (kdx / kd) * COP_KNOCKBACK_SPEED;
                                cop.vy = (kdy / kd) * COP_KNOCKBACK_SPEED;
                                cop.retreatTimer = COP_RETREAT_FRAMES;
                            }
                
                            if (this.player.isNitro) {
                                // Player rams cop in nitro state!
                                cop.health -= 60;
                                this.player.health -= 5;
                            } else {
                                // Cada batida do policial tira COP_HIT_DAMAGE de vida (com cooldown por policial)
                                if (cop.hitCooldown <= 0) {
                                    this.player.health -= COP_HIT_DAMAGE;
                                    cop.hitCooldown = COP_HIT_COOLDOWN;
                
                                    // Efeito visual do impacto
                                    const ix = cop.x - this.player.x;
                                    const iy = cop.y - this.player.y;
                                    const id = Math.hypot(ix, iy) || 1;
                                    this.particles.spawnImpact(
                                        this.player.x + (ix / id) * 20,
                                        this.player.y + (iy / id) * 20,
                                        ix / id, iy / id,
                                        cop.config.color, this.player.config.color,
                                        COP_HIT_DAMAGE
                                    );
                                }
                                cop.health -= 0.4;
                            }
                        }
                
                        // Cop vs Cop Collisions
                        for (let j = i - 1; j >= 0; j--) {
                            const otherCop = this.cops[j];
                            const dC = Math.hypot(cop.x - otherCop.x, cop.y - otherCop.y);
                            if (dC < 32) {
                                cop.health -= 1.5;
                                otherCop.health -= 1.5;
                                this.particles.spawnSpark((cop.x + otherCop.x) / 2, (cop.y + otherCop.y) / 2);
                            }
                        }
                
                        // Wreck Cop condition
                        if (cop.health <= 0) {
                            this.particles.spawnExplosion(cop.x, cop.y);
                            audio.playExplosion();
                            this.cops.splice(i, 1);
                            this.copsWrecked++;
                            this.score += 500;
                            this.coinsEarnedSession += 100;
                
                            // Spawn reward coins
                            for (let c = 0; c < 3; c++) {
                                this.coins.push(new CoinPickup(cop.x + (Math.random() - 0.5) * 40, cop.y + (Math.random() - 0.5) * 40, 50));
                            }
                        }
                    }
                
                    // Coin Collection
                    for (let i = this.coins.length - 1; i >= 0; i--) {
                        const coin = this.coins[i];
                        if (Math.hypot(coin.x - this.player.x, coin.y - this.player.y) < 32) {
                            this.coinsEarnedSession += coin.value;
                            this.score += 100;
                            this.player.nitroEnergy = Math.min(this.player.nitroMax, this.player.nitroEnergy + COIN_NITRO_RESTORE);
                            audio.playCoin();
                            this.coins.splice(i, 1);
                        }
                    }
                
                    // Health Pickup Collection
                    for (let i = this.healthPickups.length - 1; i >= 0; i--) {
                        const pickup = this.healthPickups[i];
                        if (Math.hypot(pickup.x - this.player.x, pickup.y - this.player.y) < 32) {
                            this.player.health = Math.min(this.player.maxHealth, this.player.health + HEALTH_PICKUP_HEAL_AMOUNT);
                            audio.playCoin();
                            this.healthPickups.splice(i, 1);
                        }
                    }
                
                    // Map Prop Collisions
                    for (let p of this.props) {
                        if (p.destroyed) continue;
                        if (Math.hypot(p.x - this.player.x, p.y - this.player.y) < p.radius + 18) {
                            p.destroyed = true;
                            this.particles.spawnExplosion(p.x, p.y);
                            this.camera.shake = 8;
                        }
                    }
                
                    // Camera Follow
                    this.camera.follow(this.player, CANVAS.width, CANVAS.height);
                
                    // Check Game Over Condition
                    if (this.player.health <= 0) {
                        this.startDeathExplosion();
                    }
                
                    this.updateHUD();
                }

                updateHUD() {
                    document.getElementById('hudHealthText').innerText = `${Math.max(0, Math.ceil((this.player.health / this.player.maxHealth) * 100))}%`;
                    document.getElementById('hudHealthBar').style.width = `${Math.max(0, (this.player.health / this.player.maxHealth) * 100)}%`;

                    document.getElementById('hudNitroText').innerText = `${Math.ceil((this.player.nitroEnergy / this.player.nitroMax) * 100)}%`;
                    document.getElementById('hudNitroBar').style.width = `${(this.player.nitroEnergy / this.player.nitroMax) * 100}%`;

                    document.getElementById('hudScore').innerText = this.score;
                    document.getElementById('hudCoins').innerText = `$${this.coinsEarnedSession}`;

                    const mins = Math.floor(this.survivalTimer / 60).toString().padStart(2, '0');
                    const secs = Math.floor(this.survivalTimer % 60).toString().padStart(2, '0');
                    document.getElementById('hudTimer').innerText = `${mins}:${secs}`;
                    document.getElementById('hudCopsWrecked').innerText = `${this.copsWrecked} COPS`;

                    const speed = Math.floor(Math.hypot(this.player.vx, this.player.vy) * 12);
                    document.getElementById('hudSpeed').innerText = speed;
                }

                triggerGameOver() {
                    this.state = 'GAMEOVER';

                    saveData.coins += this.coinsEarnedSession;
                    if (this.score > saveData.highScore) {
                        saveData.highScore = this.score;
                    }
                    saveGame();

                    document.getElementById('goScore').innerText = this.score;
                    const mins = Math.floor(this.survivalTimer / 60).toString().padStart(2, '0');
                    const secs = Math.floor(this.survivalTimer % 60).toString().padStart(2, '0');
                    document.getElementById('goTime').innerText = `${mins}:${secs}`;
                    document.getElementById('goCops').innerText = this.copsWrecked;
                    document.getElementById('goCash').innerText = `+$${this.coinsEarnedSession}`;

                    document.getElementById('hudOverlay').classList.add('hidden');
                    document.getElementById('gameOverModal').classList.remove('hidden');
                }

                render() {
                    CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);

                    if (this.state === 'MENU' || !this.player) {
                        // Render animated background on menu
                        CTX.fillStyle = '#0f172a';
                        CTX.fillRect(0, 0, CANVAS.width, CANVAS.height);
                        return;
                    }

                    // Render In-Game World
                    this.camera.applyTransform(CTX, CANVAS.width, CANVAS.height);

                    // Asphalt Ground
                    CTX.fillStyle = '#1e293b';
                    CTX.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

                    const viewMargin = 200;
                    const halfW = (CANVAS.width / this.camera.zoom) / 2 + viewMargin;
                    const halfH = (CANVAS.height / this.camera.zoom) / 2 + viewMargin;
                    const viewLeft = this.camera.x - halfW;
                    const viewRight = this.camera.x + halfW;
                    const viewTop = this.camera.y - halfH;
                    const viewBottom = this.camera.y + halfH;

                    // Asphalt Ground (covers only the visible area, infinitely follows the camera)
                    CTX.fillStyle = '#1e293b';
                    CTX.fillRect(viewLeft, viewTop, viewRight - viewLeft, viewBottom - viewTop);

                    // Grid Lines
                    CTX.strokeStyle = '#334155';
                    CTX.lineWidth = 2;
                    const gridSize = 120;
                    const startX = Math.floor(viewLeft / gridSize) * gridSize;
                    const startY = Math.floor(viewTop / gridSize) * gridSize;
                    for (let x = startX; x < viewRight; x += gridSize) {
                        CTX.beginPath();
                        CTX.moveTo(x, viewTop);
                        CTX.lineTo(x, viewBottom);
                        CTX.stroke();
                    }
                    for (let y = startY; y < viewBottom; y += gridSize) {
                        CTX.beginPath();
                        CTX.moveTo(viewLeft, y);
                        CTX.lineTo(viewRight, y);
                        CTX.stroke();
                    }

                    // Render Permanent Skidmarks
                    this.skidmarks.render(CTX);

                    // Render Map Props
                    for (let p of this.props) p.draw(CTX);

                    // Render Coins
                    for (let c of this.coins) c.draw(CTX);

                    for (let h of this.healthPickups) h.draw(CTX);

                    // Render Player & Cops
                    if (!this.player.dead) this.player.draw(CTX);
                    for (let cop of this.cops) cop.draw(CTX);

                    // Render Particle System
                    this.particles.updateAndDraw(CTX);

                    this.camera.restoreTransform(CTX);
                }
            }

            const game = new GameEngine();

            function resizeCanvas() {
                CANVAS.width = window.innerWidth;
                CANVAS.height = window.innerHeight;
            }
            window.addEventListener('resize', resizeCanvas);
            resizeCanvas();

            // Keyboard Event Listeners
            window.addEventListener('keydown', (e) => {
                if (e.code === 'KeyW' || e.code === 'ArrowUp') game.inputs.up = true;
                if (e.code === 'KeyS' || e.code === 'ArrowDown') game.inputs.down = true;
                if (e.code === 'KeyA' || e.code === 'ArrowLeft') game.inputs.left = true;
                if (e.code === 'KeyD' || e.code === 'ArrowRight') game.inputs.right = true;
                if (e.code === 'Space') game.inputs.handbrake = true;
                if (e.code === 'ShiftLeft' || e.code === 'KeyE') game.inputs.nitro = true;
            });

            window.addEventListener('keyup', (e) => {
                if (e.code === 'KeyW' || e.code === 'ArrowUp') game.inputs.up = false;
                if (e.code === 'KeyS' || e.code === 'ArrowDown') game.inputs.down = false;
                if (e.code === 'KeyA' || e.code === 'ArrowLeft') game.inputs.left = false;
                if (e.code === 'KeyD' || e.code === 'ArrowRight') game.inputs.right = false;
                if (e.code === 'Space') game.inputs.handbrake = false;
                if (e.code === 'ShiftLeft' || e.code === 'KeyE') game.inputs.nitro = false;
            });

            // Mobile Touch Button Listeners
            function bindTouchBtn(id, keyProp) {
                const btn = document.getElementById(id);
                if (!btn) return;
                const start = (e) => { e.preventDefault(); game.inputs[keyProp] = true; btn.classList.add('active'); };
                const end = (e) => { e.preventDefault(); game.inputs[keyProp] = false; btn.classList.remove('active'); };
                btn.addEventListener('touchstart', start);
                btn.addEventListener('touchend', end);
                btn.addEventListener('mousedown', start);
                btn.addEventListener('mouseup', end);
            }

            bindTouchBtn('btnTouchLeft', 'left');
            bindTouchBtn('btnTouchRight', 'right');
            bindTouchBtn('btnTouchGas', 'up');
            bindTouchBtn('btnTouchBrake', 'down');
            bindTouchBtn('btnTouchDrift', 'handbrake');
            bindTouchBtn('btnTouchNitro', 'nitro');

            function updateMenuData() {
                document.getElementById('menuHighScore').innerText = saveData.highScore;
                document.getElementById('menuTotalCoins').innerText = `$${saveData.coins}`;
                document.getElementById('garageCashDisplay').innerText = `$${saveData.coins}`;
            }

            // Render Garage Vehicles
            function renderGarageList() {
                const container = document.getElementById('carListContainer');
                container.innerHTML = '';

                CAR_CATALOG.forEach((car, index) => {
                    const isUnlocked = saveData.unlockedCars[index];
                    const isSelected = saveData.selectedCar === index;

                    const card = document.createElement('div');
                    card.className = `p-4 rounded-2xl border cursor-pointer transition flex justify-between items-center ${isSelected ? 'bg-cyan-950/40 border-cyan-400 neon-border-cyan' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'}`;
                    card.onclick = () => selectGarageCar(index);

                    card.innerHTML = `
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl flex items-center justify-center font-black font-orbitron text-lg" style="background: ${car.color}; color: #0f172a;">
                                🏎️
                            </div>
                            <div>
                                <h4 class="font-bold font-orbitron text-white text-sm md:text-base">${car.name}</h4>
                                <p class="text-xs text-slate-400">${isUnlocked ? 'UNLOCKED' : `$${car.price}`}</p>
                            </div>
                        </div>
                        <div>
                            ${isSelected ? '<span class="px-3 py-1 bg-cyan-500 text-slate-950 font-black font-orbitron text-xs rounded-full">EQUIPPED</span>' : (isUnlocked ? '<span class="text-xs font-bold text-slate-400">SELECT</span>' : '<span class="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold font-orbitron text-xs rounded-full">BUY</span>')}
                        </div>
                    `;
                    container.appendChild(card);
                });
            }

            let tempSelectedCar = saveData.selectedCar || 0;

            function selectGarageCar(index) {
                tempSelectedCar = index;
                const car = CAR_CATALOG[index];

                document.getElementById('selectedCarName').innerText = car.name;
                document.getElementById('selectedCarDesc').innerText = car.desc;

                // Stat Bars
                document.getElementById('statSpeedVal').innerText = `${Math.floor(car.topSpeed * 12)} KM/H`;
                document.getElementById('statSpeedBar').style.width = `${(car.topSpeed / 16) * 100}%`;

                document.getElementById('statDriftVal').innerText = car.driftGrip < 0.90 ? 'HIGH' : 'MEDIUM';
                document.getElementById('statDriftBar').style.width = `${(1.0 - car.driftGrip) * 500}%`;

                document.getElementById('statArmorVal').innerText = `${car.maxHealth} HP`;
                document.getElementById('statArmorBar').style.width = `${(car.maxHealth / 200) * 100}%`;

                document.getElementById('statNitroVal').innerText = `${car.nitroMax.toFixed(1)} SEC`;
                document.getElementById('statNitroBar').style.width = `${(car.nitroMax / 5.0) * 100}%`;

                const isUnlocked = saveData.unlockedCars[index];
                const btn = document.getElementById('btnSelectOrBuyCar');

                if (isUnlocked) {
                    btn.innerText = 'SELECT VEHICLE';
                    btn.className = 'w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black font-orbitron text-lg rounded-xl transition';
                } else {
                    btn.innerText = `BUY VEHICLE ($${car.price})`;
                    btn.className = 'w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black font-orbitron text-lg rounded-xl transition';
                }

                renderGarageList();
            }

            // Modal Button Handlers
            document.getElementById('btnStartGame').onclick = () => game.startNewGame();
            document.getElementById('btnRetry').onclick = () => game.startNewGame();
            document.getElementById('btnGoMenu').onclick = () => {
                game.state = 'MENU';
                document.getElementById('gameOverModal').classList.add('hidden');
                document.getElementById('mainMenu').classList.remove('hidden');
                updateMenuData();
            };

            document.getElementById('btnOpenGarage').onclick = () => {
                updateMenuData();
                selectGarageCar(saveData.selectedCar || 0);
                document.getElementById('garageModal').classList.remove('hidden');
            };
            document.getElementById('btnCloseGarage').onclick = () => document.getElementById('garageModal').classList.add('hidden');

            document.getElementById('btnHowToPlay').onclick = () => document.getElementById('howToPlayModal').classList.remove('hidden');
            document.getElementById('btnCloseHowToPlay').onclick = () => document.getElementById('howToPlayModal').classList.add('hidden');
            document.getElementById('btnGotIt').onclick = () => document.getElementById('howToPlayModal').classList.add('hidden');

            document.getElementById('btnSelectOrBuyCar').onclick = () => {
                const car = CAR_CATALOG[tempSelectedCar];
                const isUnlocked = saveData.unlockedCars[tempSelectedCar];

                if (isUnlocked) {
                    saveData.selectedCar = tempSelectedCar;
                    saveGame();
                    selectGarageCar(tempSelectedCar);
                } else {
                    if (saveData.coins >= car.price) {
                        saveData.coins -= car.price;
                        saveData.unlockedCars[tempSelectedCar] = true;
                        saveData.selectedCar = tempSelectedCar;
                        saveGame();
                        updateMenuData();
                        selectGarageCar(tempSelectedCar);
                    }
                }
            };

            // Upgrade Buttons
            document.getElementById('btnUpgradeEngine').onclick = () => {
                if (saveData.coins >= 500) {
                    saveData.coins -= 500;
                    saveData.upgrades.engine = (saveData.upgrades.engine || 0) + 1;
                    saveGame();
                    updateMenuData();
                }
            };

            document.getElementById('btnUpgradeArmor').onclick = () => {
                if (saveData.coins >= 500) {
                    saveData.coins -= 500;
                    saveData.upgrades.armor = (saveData.upgrades.armor || 0) + 1;
                    saveGame();
                    updateMenuData();
                }
            };

            // Main Animation Loop
            updateMenuData();

            function gameLoop() {
                game.update();
                game.render();
                requestAnimationFrame(gameLoop);
            }

            requestAnimationFrame(gameLoop);
            //67