const MUSIC_MAX = 12;
let musicVolume = parseFloat(localStorage.getItem('drift_chase_music_volume'));
if (isNaN(musicVolume)) {
    musicVolume = 0.5;
}

let musicDbPromise = null;

function openMusicDb() {
    if (!musicDbPromise) {
        musicDbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open('drift_chase_music', 1);
            req.onupgradeneeded = () => {
                req.result.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
            };
            req.onsuccess = () => {
                resolve(req.result);
            };
            req.onerror = () => {
                reject(req.error);
            };
        });
    }
    return musicDbPromise;
}

function musicDbRequest(mode, action) {
    return openMusicDb().then((db) => {
        return new Promise((resolve, reject) => {
            const store = db.transaction('tracks', mode).objectStore('tracks');
            const req = action(store);
            req.onsuccess = () => {
                resolve(req.result);
            };
            req.onerror = () => {
                reject(req.error);
            };
        });
    });
}

const musicPlayer = {
    tracks: [],
    currentId: null,
    audio: new Audio(),

    async fetchTracks() {
        try {
            this.tracks = await musicDbRequest('readonly', (store) => store.getAll());
        } catch (e) {
            this.tracks = [];
        }
    },

    async load() {
        await this.fetchTracks();
        this.refreshViews();
    },

    async addFiles(files) {
        for (const file of files) {
            if (this.tracks.length >= MUSIC_MAX) {
                break;
            }
            if (!file.type.startsWith('audio/')) {
                continue;
            }
            const name = file.name.replace(/\.[^/.]+$/, '');
            await musicDbRequest('readwrite', (store) => store.add({ name, blob: file }));
            await this.fetchTracks();
        }
        this.refreshViews();
    },

    async remove(id) {
        if (this.currentId === id) {
            this.stop();
        }
        await musicDbRequest('readwrite', (store) => store.delete(id));
        await this.fetchTracks();
        this.refreshViews();
    },

    play(id) {
        const track = this.tracks.find((t) => t.id === id);
        if (!track) {
            return;
        }

        if (this.audio.src) {
            URL.revokeObjectURL(this.audio.src);
        }

        this.currentId = id;
        this.audio.src = URL.createObjectURL(track.blob);
        this.audio.volume = musicVolume;
        this.audio.loop = this.tracks.length === 1;
        this.audio.play().catch(() => { });
    },

    stop() {
        this.currentId = null;
        this.audio.pause();
        if (this.audio.src) {
            URL.revokeObjectURL(this.audio.src);
        }
        this.audio.removeAttribute('src');
        this.audio.load();
    },

    setActive(on) {
        if (this.currentId === null) {
            return;
        }
        if (on && this.audio.paused) {
            this.audio.play().catch(() => { });
        }
        if (!on && !this.audio.paused) {
            this.audio.pause();
        }
    },

    refreshViews() {
        renderMusicList();
        renderMusicWheel();
    },
};

changeMusicVolume(0);

musicPlayer.audio.addEventListener('ended', () => {
    const list = musicPlayer.tracks;
    const index = list.findIndex((t) => t.id === musicPlayer.currentId);
    if (index === -1 || list.length === 0) {
        return;
    }
    musicPlayer.play(list[(index + 1) % list.length].id);
});

function renderMusicList() {
    const box = document.getElementById('musicList');
    box.innerHTML = '';

    if (musicPlayer.tracks.length === 0) {
        box.innerHTML = '<p class="text-slate-500 text-sm text-center py-4">Nenhuma música adicionada.</p>';
        return;
    }

    musicPlayer.tracks.forEach((track) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800';

        const name = document.createElement('span');
        name.className = 'text-sm text-slate-200 truncate';
        name.innerText = track.name;

        const btn = document.createElement('button');
        btn.className = 'px-3 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40 font-bold font-orbitron text-xs';
        btn.innerText = 'REMOVER';
        btn.onclick = () => musicPlayer.remove(track.id);

        row.appendChild(name);
        row.appendChild(btn);
        box.appendChild(row);
    });
}

function renderMusicWheel() {
    const ring = document.getElementById('musicWheelRing');
    ring.innerHTML = '';

    let centerClass = 'bg-slate-900/90 border-slate-600 text-slate-300';
    if (musicPlayer.currentId === null) {
        centerClass = 'bg-cyan-500 border-cyan-300 text-slate-950';
    }

    const center = document.createElement('button');
    center.className = `absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 font-black font-orbitron text-xs text-center px-2 ${centerClass}`;
    center.innerText = 'SIRENE (SEM MÚSICA)';
    center.onclick = () => {
        musicPlayer.stop();
        renderMusicWheel();
        closeMusicWheel();
    };
    ring.appendChild(center);

    const count = musicPlayer.tracks.length;
    const radius = 140;

    musicPlayer.tracks.forEach((track, i) => {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;

        let trackClass = 'bg-slate-900/90 border-slate-600 text-slate-200 hover:border-cyan-400';
        if (musicPlayer.currentId === track.id) {
            trackClass = 'bg-cyan-500 border-cyan-300 text-slate-950';
        }

        const btn = document.createElement('button');
        btn.className = `absolute w-16 h-16 rounded-full border-2 text-[10px] font-bold leading-tight px-1 overflow-hidden break-words ${trackClass}`;
        btn.style.left = `${190 + Math.cos(angle) * radius}px`;
        btn.style.top = `${190 + Math.sin(angle) * radius}px`;
        btn.style.transform = 'translate(-50%, -50%)';
        btn.title = track.name;
        btn.innerText = track.name.slice(0, 12);
        btn.onclick = () => {
            musicPlayer.play(track.id);
            renderMusicWheel();
            closeMusicWheel();
        };
        ring.appendChild(btn);
    });

    if (count === 0) {
        const hint = document.createElement('p');
        hint.className = 'absolute left-1/2 top-full mt-4 -translate-x-1/2 text-xs text-slate-300 whitespace-nowrap';
        hint.innerText = 'Adicione músicas em MÚSICAS, no menu principal.';
        ring.appendChild(hint);
    }
}

function openMusicWheel() {
    renderMusicWheel();
    document.getElementById('musicWheel').classList.remove('hidden');
}

function closeMusicWheel() {
    document.getElementById('musicWheel').classList.add('hidden');
}

function isMusicWheelOpen() {
    return !document.getElementById('musicWheel').classList.contains('hidden');
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
        e.preventDefault();
        if (e.repeat) {
            return;
        }
        if (isMusicWheelOpen()) {
            closeMusicWheel();
        } else if (game.state === 'PLAYING') {
            openMusicWheel();
        }
        return;
    }

    if ((e.code === 'Escape' || e.code === 'KeyP') && isMusicWheelOpen()) {
        closeMusicWheel();
    }
});

document.getElementById('musicWheel').addEventListener('click', (e) => {
    if (e.target.id === 'musicWheel') {
        closeMusicWheel();
    }
});

document.getElementById('btnOpenMusic').onclick = () => {
    document.getElementById('musicModal').classList.remove('hidden');
};

document.getElementById('btnCloseMusic').onclick = () => {
    document.getElementById('musicModal').classList.add('hidden');
};

document.getElementById('musicFileInput').onchange = (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    musicPlayer.addFiles(files);
};

function changeMusicVolume(delta) {
    musicVolume = Math.min(1, Math.max(0, Math.round((musicVolume + delta) * 100) / 100));
    musicPlayer.audio.volume = musicVolume;
    localStorage.setItem('drift_chase_music_volume', musicVolume);

    const label = document.getElementById('musicVolumeLabel');
    if (label) {
        label.innerText = `VOLUME ${Math.round(musicVolume * 100)}%`;
    }
}

window.addEventListener('wheel', (e) => {
    if (!isMusicWheelOpen()) {
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (e.deltaY < 0) {
        changeMusicVolume(0.05);
    } else {
        changeMusicVolume(-0.05);
    }
}, { passive: false, capture: true });

musicPlayer.load();