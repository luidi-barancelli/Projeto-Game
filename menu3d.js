// menu3d.js — cenário 3D da tela inicial (perseguição policial)
// Precisa do Three.js (carregado no index.html) e roda depois do main.js
(function () {
    if (typeof THREE === 'undefined') return;

    const canvas = document.getElementById('menuScene');
    const menuEl = document.getElementById('mainMenu');
    if (!canvas || !menuEl) return;

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch (e) {
        canvas.style.display = 'none';
        return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputEncoding = THREE.sRGBEncoding;

    // ===== AJUSTES =====
    const SPEED = 38;        // velocidade com que o cenário passa
    const SKY = 0x070b16;    // cor do céu/neblina
    const WRAP_LEN = 190;    // comprimento do trecho de rua que se repete

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY);
    scene.fog = new THREE.Fog(SKY, 35, 150);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);

    // ===== LUZES =====
    scene.add(new THREE.HemisphereLight(0x5a6fb0, 0x0a0d18, 0.9));
    const moon = new THREE.DirectionalLight(0x8fa6ff, 0.5);
    moon.position.set(-10, 20, 10);
    scene.add(moon);

    // ===== TEXTURAS GERADAS POR CÓDIGO =====
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 64;
    {
        const g = glowCanvas.getContext('2d');
        const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 64, 64);
    }
    const glowTex = new THREE.CanvasTexture(glowCanvas);

    function glow(color, size, opacity = 1) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTex, color, transparent: true, opacity,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        s.scale.set(size, size, 1);
        return s;
    }

    const winCanvas = document.createElement('canvas');
    winCanvas.width = winCanvas.height = 64;
    {
        const g = winCanvas.getContext('2d');
        g.fillStyle = '#000';
        g.fillRect(0, 0, 64, 64);
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                if (Math.random() < 0.45) {
                    g.fillStyle = Math.random() < 0.7 ? '#ffd27a' : '#7ad7ff';
                    g.fillRect(x * 16 + 3, y * 16 + 4, 10, 8);
                }
            }
        }
    }
    const winTex = new THREE.CanvasTexture(winCanvas);
    winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
    winTex.encoding = THREE.sRGBEncoding;

    // ===== CARROS =====
    const matBlack = new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.8 });
    const matGlass = new THREE.MeshStandardMaterial({ color: 0x0a1424, metalness: 0.9, roughness: 0.15 });
    const matRim = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.9, roughness: 0.3 });
    const matHead = new THREE.MeshBasicMaterial({ color: 0xfff1b0 });
    const matTail = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

    function box(w, h, d, mat, x, y, z) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        return m;
    }

    // A frente do carro aponta para +Z (em direção à câmera)
    function buildCar(color, isPolice) {
        const car = new THREE.Group();
        const body = new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.3 });
        car.userData.bodyMat = body;

        car.add(box(1.9, 0.5, 4.2, body, 0, 0.55, 0));           // carroceria
        car.add(box(1.7, 0.18, 1.3, body, 0, 0.88, 1.45));       // capô
        car.add(box(1.55, 0.5, 1.9, matGlass, 0, 1.08, -0.35));  // cabine
        car.add(box(1.4, 0.08, 1.4, body, 0, 1.36, -0.45));      // teto
        const ws = box(1.5, 0.05, 1.0, matGlass, 0, 1.12, 0.75); // pára-brisa inclinado
        ws.rotation.x = 0.75;
        car.add(ws);

        // rodas
        car.userData.wheels = [];
        for (const sx of [-1, 1]) {
            for (const sz of [-1.35, 1.3]) {
                const g = new THREE.Group();
                g.position.set(sx * 1.0, 0.42, sz);
                const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 20), matBlack);
                tire.rotation.z = Math.PI / 2;
                const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.36, 10), matRim);
                rim.rotation.z = Math.PI / 2;
                g.add(tire, rim);
                car.add(g);
                car.userData.wheels.push(g);
            }
        }

        // faróis e lanternas
        for (const sx of [-0.6, 0.6]) {
            car.add(box(0.5, 0.18, 0.08, matHead, sx, 0.62, 2.1));
            const hl = glow(0xfff1b0, 3.2, 0.9);
            hl.position.set(sx, 0.65, 2.3);
            car.add(hl);

            car.add(box(0.55, 0.14, 0.08, matTail, sx, 0.66, -2.1));
            const tl = glow(0xff2020, 1.8, 0.8);
            tl.position.set(sx, 0.66, -2.3);
            car.add(tl);
        }

        if (isPolice) {
            car.add(box(1.92, 0.22, 2.0, matBlack, 0, 0.55, -0.1)); // faixa preta lateral
            const red = box(0.55, 0.14, 0.28, new THREE.MeshBasicMaterial({ color: 0xff2222 }), -0.35, 1.5, -0.4);
            const blue = box(0.55, 0.14, 0.28, new THREE.MeshBasicMaterial({ color: 0x2266ff }), 0.35, 1.5, -0.4);
            const redGlow = glow(0xff2222, 4.5);
            const blueGlow = glow(0x2266ff, 4.5);
            redGlow.position.set(-0.35, 1.65, -0.4);
            blueGlow.position.set(0.35, 1.65, -0.4);
            car.add(red, blue, redGlow, blueGlow);
            car.userData.sirens = { red, blue, redGlow, blueGlow, lightR: null, lightB: null };
        } else {
            car.add(box(1.7, 0.08, 0.5, matBlack, 0, 1.3, -2.0)); // aerofólio
            car.add(box(0.08, 0.25, 0.1, matBlack, -0.6, 1.17, -1.95));
            car.add(box(0.08, 0.25, 0.1, matBlack, 0.6, 1.17, -1.95));
        }
        return car;
    }

    function selectedColor() {
        try {
            const c = CAR_CATALOG[saveData.selectedCar || 0];
            return c ? c.color : '#06b6d4';
        } catch (e) {
            return '#06b6d4';
        }
    }

    // jogador
    let heroColor = selectedColor();
    const hero = buildCar(heroColor, false);
    const under = new THREE.PointLight(0x22d3ee, 1.6, 10);
    under.position.set(0, 0.3, 0);
    hero.add(under);
    scene.add(hero);

    // policiais
    const copDefs = [
        { z: -9, base: -2.6, ph: 0.0, amp: 2.4, lights: true },
        { z: -15, base: 2.4, ph: 1.7, amp: 2.8, lights: true },
        { z: -22, base: 0, ph: 3.1, amp: 2.0, lights: false }
    ];
    const cops = copDefs.map(def => {
        const car = buildCar(0xf1f5f9, true);
        if (def.lights) {
            const s = car.userData.sirens;
            s.lightR = new THREE.PointLight(0xff2222, 0, 22);
            s.lightB = new THREE.PointLight(0x2266ff, 0, 22);
            s.lightR.position.set(-1.2, 2.2, -0.4);
            s.lightB.position.set(1.2, 2.2, -0.4);
            car.add(s.lightR, s.lightB);
        }
        scene.add(car);
        return { car, def };
    });

    // ===== RUA E CENÁRIO =====
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(400, 400),
        new THREE.MeshStandardMaterial({ color: 0x080a10, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);

    const road = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 400),
        new THREE.MeshStandardMaterial({ color: 0x14171f, roughness: 0.55, metalness: 0.3 })
    );
    road.rotation.x = -Math.PI / 2;
    scene.add(road);

    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x8e97aa });
    for (const sx of [-7.6, 7.6]) {
        scene.add(box(0.15, 0.02, 400, edgeMat, sx, 0.01, 0));
    }

    // itens que passam pela câmera (repetem em loop)
    const envItems = [];
    function addEnv(obj) {
        scene.add(obj);
        envItems.push(obj);
    }

    // faixas tracejadas
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xc9d1e0 });
    for (const lx of [-2.6, 2.6]) {
        for (let i = 0; i < 24; i++) {
            addEnv(box(0.2, 0.02, 2.2, dashMat, lx, 0.01, 20 - i * (WRAP_LEN / 24)));
        }
    }

    // prédios com janelas acesas
    for (const side of [-1, 1]) {
        for (let i = 0; i < 18; i++) {
            const w = 6 + Math.random() * 6;
            const h = 8 + Math.random() * 30;
            const d = 6 + Math.random() * 6;
            const tex = winTex.clone();
            tex.needsUpdate = true;
            tex.repeat.set(Math.ceil(w / 5), Math.ceil(h / 5));
            const mat = new THREE.MeshStandardMaterial({
                color: 0x0b1020, roughness: 0.9,
                emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9
            });
            const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            b.position.set(side * (10.5 + w / 2 + Math.random() * 5), h / 2, 20 - i * (WRAP_LEN / 18) + Math.random() * 3);
            addEnv(b);
        }
    }

    // postes de luz
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1b2030, roughness: 0.7 });
    for (const side of [-1, 1]) {
        for (let i = 0; i < 10; i++) {
            const lamp = new THREE.Group();
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 8), poleMat);
            pole.position.y = 3.5;
            const head = glow(0xffb347, 6);
            head.position.set(-side * 0.5, 7.2, 0);
            lamp.add(pole, head);
            lamp.position.set(side * 9.2, 0, 20 - i * (WRAP_LEN / 10));
            addEnv(lamp);
        }
    }

    // ===== FUMAÇA DO DRIFT =====
    const smoke = [];
    for (let i = 0; i < 40; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTex, color: 0xcfd6e6, transparent: true, opacity: 0, depthWrite: false
        }));
        s.userData.life = 0;
        s.visible = false;
        scene.add(s);
        smoke.push(s);
    }
    function emitSmoke(x, y, z) {
        const s = smoke.find(p => p.userData.life <= 0);
        if (!s) return;
        s.userData.life = 1;
        s.position.set(x, y, z);
        s.scale.set(0.9, 0.9, 1);
        s.visible = true;
    }

    // ===== TAMANHO DA TELA =====
    function resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.fov = (w / h) < 1 ? 62 : 46;
        const shift = w > 900 ? -w * 0.16 : 0; // desloca a cena pra direita (o menu fica à esquerda)
        camera.setViewOffset(w, h, shift, 0, w, h);
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    // ===== LOOP =====
    const clock = new THREE.Clock();
    let t = 0;
    let shown = true;

    function frame() {
        requestAnimationFrame(frame);

        const visible = !menuEl.classList.contains('hidden') && !document.hidden;
        if (visible !== shown) {
            shown = visible;
            canvas.style.display = visible ? 'block' : 'none';
        }
        if (!visible) {
            clock.getDelta(); // evita um pulo de tempo quando o menu voltar
            return;
        }

        const dt = Math.min(clock.getDelta(), 0.05);
        t += dt;

        // cor do carro selecionado na garagem
        const c = selectedColor();
        if (c !== heroColor) {
            heroColor = c;
            hero.userData.bodyMat.color.set(c);
            under.color.set(c);
        }

        // cenário passando
        for (const o of envItems) {
            o.position.z -= SPEED * dt;
            if (o.position.z < -170) o.position.z += WRAP_LEN;
        }

        // jogador derrapando de um lado pro outro
        const a = t * 0.9;
        const yaw = Math.cos(a) * 0.4;
        hero.position.x = Math.sin(a) * 1.8;
        hero.position.y = Math.sin(t * 14) * 0.01;
        hero.rotation.y = yaw;
        hero.rotation.z = -Math.sin(a) * 0.04;

        if (Math.abs(Math.cos(a)) > 0.3) {
            for (const ox of [-1.0, 1.0]) {
                const oz = -1.35;
                emitSmoke(
                    hero.position.x + Math.cos(yaw) * ox + Math.sin(yaw) * oz,
                    0.3,
                    -Math.sin(yaw) * ox + Math.cos(yaw) * oz
                );
            }
        }

        for (const s of smoke) {
            if (s.userData.life <= 0) continue;
            s.userData.life -= dt * 0.9;
            s.position.z -= SPEED * dt;
            s.position.y += dt * 0.6;
            const k = 0.9 + (1 - s.userData.life) * 3.2;
            s.scale.set(k, k, 1);
            s.material.opacity = Math.max(0, s.userData.life) * 0.45;
            if (s.userData.life <= 0) s.visible = false;
        }

        // policiais perseguindo
        for (const { car, def } of cops) {
            const p = t * 0.8 + def.ph;
            car.position.x = def.base + Math.sin(p) * def.amp * 0.6;
            car.position.z = def.z + Math.sin(t * 0.5 + def.ph) * 1.2;
            car.rotation.y = Math.cos(p) * 0.2;

            const s = car.userData.sirens;
            const flash = Math.sin(t * 14 + def.ph) > 0;
            s.red.material.color.setHex(flash ? 0xff2222 : 0x330606);
            s.blue.material.color.setHex(flash ? 0x061433 : 0x2266ff);
            s.redGlow.material.opacity = flash ? 1 : 0.08;
            s.blueGlow.material.opacity = flash ? 0.08 : 1;
            if (s.lightR) {
                s.lightR.intensity = flash ? 2.4 : 0;
                s.lightB.intensity = flash ? 0 : 2.4;
            }
        }

        // rodas girando
        const spin = SPEED * dt / 0.42;
        for (const w of hero.userData.wheels) w.rotation.x += spin;
        for (const { car } of cops) for (const w of car.userData.wheels) w.rotation.x += spin;

        // câmera balançando devagar
        camera.position.set(5.2 + Math.sin(t * 0.35) * 1.4, 2.1 + Math.sin(t * 0.5) * 0.25, 9.5);
        camera.lookAt(0, 1.0, -3);

        renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
})();