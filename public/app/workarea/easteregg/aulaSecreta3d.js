const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeAngle = (angle) => {
    while (angle <= -Math.PI) angle += Math.PI * 2;
    while (angle > Math.PI) angle -= Math.PI * 2;
    return angle;
};

const distance = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

const defaultMap = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 2, 2, 0, 0, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1],
    [1, 0, 2, 2, 0, 0, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 2, 2, 0, 0, 2, 2, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 2, 2, 0, 0, 2, 2, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 2, 2, 0, 0, 2, 2, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 2, 2, 0, 0, 2, 2, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 2, 2, 0, 0, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1],
    [1, 0, 2, 2, 0, 0, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 3, 3, 3, 3, 3, 3, 0, 0, 3, 3, 3, 3, 3, 3, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const wallPalette = {
    1: [110, 128, 160], // walls
    2: [150, 105, 70], // desks
    3: [70, 150, 110], // blackboard
};

export default class AulaSecreta3D {
    constructor({
        canvas,
        statsEl,
        timerEl,
        overlayEl,
        overlayTitleEl,
        overlayTextEl,
        startButton,
        closeButton,
        onClose,
    }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.statsEl = statsEl;
        this.timerEl = timerEl;
        this.overlayEl = overlayEl;
        this.overlayTitleEl = overlayTitleEl;
        this.overlayTextEl = overlayTextEl;
        this.startButton = startButton;
        this.closeButton = closeButton;
        this.onClose = onClose;

        this.map = defaultMap.map((row) => row.slice());

        this.spawn = {
            x: 8.5,
            y: 13.5,
            a: -Math.PI / 2,
        };

        this.player = {
            x: this.spawn.x,
            y: this.spawn.y,
            a: this.spawn.a,
        };

        this.exit = {
            x: 8.0,
            y: 14.2,
            radius: 0.55,
        };

        this.pickups = [
            { x: 4.5, y: 2.5, collected: false },
            { x: 11.5, y: 5.5, collected: false },
            { x: 10.5, y: 10.5, collected: false },
            { x: 6.5, y: 7.5, collected: false },
        ];

        this.keysDown = new Set();
        this.showMap = false;
        this.fov = (65 * Math.PI) / 180;
        this.totalTime = 90;

        this._raf = null;
        this._lastFrameAt = 0;
        this._running = false;
        this._paused = true;
        this._action = null;

        this._zBuffer = [];

        this._onResize = this.resize.bind(this);
        this._onKeyDown = this.onKeyDown.bind(this);
        this._onKeyUp = this.onKeyUp.bind(this);
        this._onStartClick = () => this._action?.();
        this._onCloseClick = () => this.onClose?.();
        this._onCanvasPointerDown = () => {
            if (this.overlayEl && !this.overlayEl.classList.contains('hidden')) {
                this._action?.();
            }
        };
    }

    start() {
        if (this._running) return;
        this._running = true;
        this.attach();
        this.reset();
        this.showStartOverlay();
        this.resize();
        this._lastFrameAt = performance.now();
        this._raf = requestAnimationFrame(this.tick.bind(this));
    }

    stop() {
        this._running = false;
        this._paused = true;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = null;
        this.detach();
    }

    attach() {
        window.addEventListener('resize', this._onResize);
        window.addEventListener('keydown', this._onKeyDown, {
            passive: false,
            capture: true,
        });
        window.addEventListener('keyup', this._onKeyUp, {
            passive: false,
            capture: true,
        });
        this.startButton?.addEventListener('click', this._onStartClick);
        this.closeButton?.addEventListener('click', this._onCloseClick);
        this.canvas?.addEventListener('pointerdown', this._onCanvasPointerDown);
    }

    detach() {
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('keydown', this._onKeyDown, { capture: true });
        window.removeEventListener('keyup', this._onKeyUp, { capture: true });
        this.startButton?.removeEventListener('click', this._onStartClick);
        this.closeButton?.removeEventListener('click', this._onCloseClick);
        this.canvas?.removeEventListener('pointerdown', this._onCanvasPointerDown);
        this.keysDown.clear();
    }

    reset() {
        this.player.x = this.spawn.x;
        this.player.y = this.spawn.y;
        this.player.a = this.spawn.a;
        this.placePlayerInFreeSpace();
        this.pickups.forEach((pickup) => {
            pickup.collected = false;
        });
        this.remainingTime = this.totalTime;
        this._paused = true;
        this._won = false;
        this._lost = false;
        this.updateHud();
    }

    showOverlay({ title, text, primaryLabel, primaryAction }) {
        if (!this.overlayEl) return;
        if (this.overlayTitleEl) this.overlayTitleEl.textContent = title;
        if (this.overlayTextEl) this.overlayTextEl.innerHTML = text;
        if (this.startButton) this.startButton.textContent = primaryLabel;
        this._action = primaryAction;
        this.overlayEl.classList.remove('hidden');
    }

    hideOverlay() {
        this.overlayEl?.classList.add('hidden');
    }

    showStartOverlay() {
        this.showOverlay({
            title: 'Has encontrado el huevo de pascua',
            text: 'Recolecta los <strong>iDevices</strong> perdidos en el aula y vuelve a la puerta para “exportar” tu escape.',
            primaryLabel: 'Empezar',
            primaryAction: () => {
                this._paused = false;
                this.hideOverlay();
                this.canvas?.focus?.();
            },
        });
    }

    showWinOverlay() {
        this.showOverlay({
            title: '¡Exportación completada!',
            text: 'Has reunido todos los iDevices. Tu aula queda lista para aprender.',
            primaryLabel: 'Jugar otra vez',
            primaryAction: () => {
                this.reset();
                this._paused = false;
                this.hideOverlay();
            },
        });
    }

    showLoseOverlay() {
        this.showOverlay({
            title: 'Se acabó el tiempo',
            text: 'La campana sonó antes de terminar. ¿Reintentas la clase?',
            primaryLabel: 'Reintentar',
            primaryAction: () => {
                this.reset();
                this._paused = false;
                this.hideOverlay();
            },
        });
    }

    onKeyDown(event) {
        const key = event.key;
        const lower = typeof key === 'string' ? key.toLowerCase() : '';

        const handledKeys = new Set([
            'w',
            'a',
            's',
            'd',
            'arrowup',
            'arrowdown',
            'arrowleft',
            'arrowright',
            'm',
            'r',
            'escape',
        ]);

        if (handledKeys.has(lower) || handledKeys.has(key)) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (lower === 'escape') {
            this.onClose?.();
            return;
        }

        if (lower === 'm' && !event.repeat) {
            this.showMap = !this.showMap;
            return;
        }

        if (lower === 'r' && !event.repeat) {
            this.reset();
            this._paused = false;
            this.hideOverlay();
            return;
        }

        if (this._paused && !this._won && !this._lost && lower === 'enter') {
            this._action?.();
            return;
        }

        this.keysDown.add(lower);
    }

    onKeyUp(event) {
        const key = event.key;
        const lower = typeof key === 'string' ? key.toLowerCase() : '';
        const handledKeys = new Set([
            'w',
            'a',
            's',
            'd',
            'arrowup',
            'arrowdown',
            'arrowleft',
            'arrowright',
            'm',
            'r',
            'escape',
        ]);

        if (handledKeys.has(lower) || handledKeys.has(key)) {
            event.preventDefault();
            event.stopPropagation();
        }
        this.keysDown.delete(lower);
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
        const width = Math.max(320, Math.floor(rect.width * dpr));
        const height = Math.max(200, Math.floor(rect.height * dpr));

        if (this.canvas.width !== width) this.canvas.width = width;
        if (this.canvas.height !== height) this.canvas.height = height;

        this._zBuffer = new Array(width).fill(Infinity);
    }

    tick(now) {
        if (!this._running) return;
        const dt = clamp((now - this._lastFrameAt) / 1000, 0, 0.05);
        this._lastFrameAt = now;

        if (!this._paused) {
            this.update(dt);
        }
        this.render();

        this._raf = requestAnimationFrame(this.tick.bind(this));
    }

    update(dt) {
        if (this._won || this._lost) return;

        this.remainingTime = Math.max(0, this.remainingTime - dt);
        if (this.remainingTime <= 0) {
            this._lost = true;
            this._paused = true;
            this.showLoseOverlay();
            return;
        }

        const turnSpeed = 2.2;
        if (this.keysDown.has('arrowleft')) this.player.a -= turnSpeed * dt;
        if (this.keysDown.has('arrowright')) this.player.a += turnSpeed * dt;
        this.player.a = normalizeAngle(this.player.a);

        const speed = 3.0;
        let moveX = 0;
        let moveY = 0;

        const forwardX = Math.cos(this.player.a);
        const forwardY = Math.sin(this.player.a);
        const strafeX = Math.cos(this.player.a - Math.PI / 2);
        const strafeY = Math.sin(this.player.a - Math.PI / 2);

        if (this.keysDown.has('w') || this.keysDown.has('arrowup')) {
            moveX += forwardX * speed * dt;
            moveY += forwardY * speed * dt;
        }
        if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) {
            moveX -= forwardX * speed * dt;
            moveY -= forwardY * speed * dt;
        }
        if (this.keysDown.has('a')) {
            moveX += strafeX * speed * dt;
            moveY += strafeY * speed * dt;
        }
        if (this.keysDown.has('d')) {
            moveX -= strafeX * speed * dt;
            moveY -= strafeY * speed * dt;
        }

        const nextX = this.player.x + moveX;
        const nextY = this.player.y + moveY;
        const radius = 0.18;

        if (!this.isSolid(nextX + Math.sign(moveX) * radius, this.player.y)) {
            this.player.x = nextX;
        }
        if (!this.isSolid(this.player.x, nextY + Math.sign(moveY) * radius)) {
            this.player.y = nextY;
        }

        this.checkPickups();
        this.checkExit();
        this.updateHud();
    }

    isSolid(x, y) {
        const mx = Math.floor(x);
        const my = Math.floor(y);
        if (my < 0 || my >= this.map.length) return true;
        if (mx < 0 || mx >= this.map[0].length) return true;
        return this.map[my][mx] !== 0;
    }

    placePlayerInFreeSpace() {
        if (!this.isSolid(this.player.x, this.player.y)) return;

        const startCellX = Math.floor(this.player.x);
        const startCellY = Math.floor(this.player.y);
        const maxRadius = Math.max(this.map.length, this.map[0].length);

        for (let radius = 1; radius <= maxRadius; radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                    const cx = startCellX + dx;
                    const cy = startCellY + dy;
                    if (cy < 0 || cy >= this.map.length) continue;
                    if (cx < 0 || cx >= this.map[0].length) continue;
                    if (this.map[cy][cx] === 0) {
                        this.player.x = cx + 0.5;
                        this.player.y = cy + 0.5;
                        return;
                    }
                }
            }
        }
    }

    checkPickups() {
        const grabRadius = 0.55;
        this.pickups.forEach((pickup) => {
            if (pickup.collected) return;
            if (distance(this.player.x, this.player.y, pickup.x, pickup.y) <= grabRadius) {
                pickup.collected = true;
            }
        });
    }

    checkExit() {
        const total = this.pickups.length;
        const collected = this.pickups.filter((p) => p.collected).length;
        if (collected < total) return;
        if (distance(this.player.x, this.player.y, this.exit.x, this.exit.y) <= this.exit.radius) {
            this._won = true;
            this._paused = true;
            this.showWinOverlay();
        }
    }

    updateHud() {
        const total = this.pickups.length;
        const collected = this.pickups.filter((p) => p.collected).length;
        if (this.statsEl) {
            this.statsEl.textContent = `iDevices: ${collected}/${total}`;
        }
        if (this.timerEl) {
            this.timerEl.textContent = `⏱ ${Math.ceil(this.remainingTime)}s`;
        }
    }

    render() {
        if (!this.ctx) return;
        const { width, height } = this.canvas;
        const ctx = this.ctx;

        ctx.fillStyle = '#0b1020';
        ctx.fillRect(0, 0, width, height / 2);
        ctx.fillStyle = '#1b1522';
        ctx.fillRect(0, height / 2, width, height / 2);

        const columnWidth = Math.max(1, Math.floor(width / 520));
        for (let x = 0; x < width; x += columnWidth) {
            const rayAngle = this.player.a - this.fov / 2 + (x / width) * this.fov;
            const ray = this.castRay(rayAngle);
            const dist = Math.max(0.0001, ray.dist);

            for (let fill = 0; fill < columnWidth && x + fill < width; fill++) {
                this._zBuffer[x + fill] = dist;
            }

            const lineHeight = Math.min(height, height / dist);
            const drawStart = Math.floor(height / 2 - lineHeight / 2);
            const drawEnd = Math.floor(height / 2 + lineHeight / 2);

            const base = wallPalette[ray.cell] || wallPalette[1];
            const shade = clamp(1 / (1 + dist * dist * 0.12), 0.18, 1);
            const sideShade = ray.side === 1 ? 0.82 : 1;
            const r = Math.floor(base[0] * shade * sideShade);
            const g = Math.floor(base[1] * shade * sideShade);
            const b = Math.floor(base[2] * shade * sideShade);

            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x, drawStart, columnWidth, drawEnd - drawStart);

            ctx.fillStyle = `rgba(255,255,255,${clamp(0.15 * shade, 0, 0.12)})`;
            ctx.fillRect(x, drawStart, Math.max(1, Math.floor(columnWidth / 2)), drawEnd - drawStart);
        }

        this.renderSprites();
        this.renderCrosshair();
        if (this.showMap) this.renderMiniMap();
    }

    castRay(rayAngle) {
        const rayDirX = Math.cos(rayAngle);
        const rayDirY = Math.sin(rayAngle);

        let mapX = Math.floor(this.player.x);
        let mapY = Math.floor(this.player.y);

        const deltaDistX = rayDirX === 0 ? Infinity : Math.abs(1 / rayDirX);
        const deltaDistY = rayDirY === 0 ? Infinity : Math.abs(1 / rayDirY);

        let stepX;
        let stepY;
        let sideDistX;
        let sideDistY;

        if (rayDirX < 0) {
            stepX = -1;
            sideDistX = (this.player.x - mapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (mapX + 1 - this.player.x) * deltaDistX;
        }

        if (rayDirY < 0) {
            stepY = -1;
            sideDistY = (this.player.y - mapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (mapY + 1 - this.player.y) * deltaDistY;
        }

        let hit = false;
        let side = 0;
        let cell = 1;
        let guard = 0;
        while (!hit && guard < 2048) {
            guard++;
            if (sideDistX < sideDistY) {
                sideDistX += deltaDistX;
                mapX += stepX;
                side = 0;
            } else {
                sideDistY += deltaDistY;
                mapY += stepY;
                side = 1;
            }

            if (mapY < 0 || mapY >= this.map.length || mapX < 0 || mapX >= this.map[0].length) {
                hit = true;
                cell = 1;
                break;
            }

            cell = this.map[mapY][mapX];
            if (cell !== 0) hit = true;
        }

        const dist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
        return { dist, side, cell };
    }

    renderSprites() {
        const ctx = this.ctx;
        const { width, height } = this.canvas;

        const sprites = [];

        const total = this.pickups.length;
        const collected = this.pickups.filter((p) => p.collected).length;

        this.pickups.forEach((pickup) => {
            if (pickup.collected) return;
            sprites.push({ x: pickup.x, y: pickup.y, kind: 'pickup' });
        });

        sprites.push({
            x: this.exit.x,
            y: this.exit.y,
            kind: collected === total ? 'exit-open' : 'exit-locked',
        });

        sprites
            .map((sprite) => {
                const dx = sprite.x - this.player.x;
                const dy = sprite.y - this.player.y;
                const dist = Math.hypot(dx, dy);
                const angle = normalizeAngle(Math.atan2(dy, dx) - this.player.a);
                return { ...sprite, dist, angle };
            })
            .filter((sprite) => Math.abs(sprite.angle) < this.fov / 2 + 0.35)
            .sort((a, b) => b.dist - a.dist)
            .forEach((sprite) => {
                const dist = Math.max(0.0001, sprite.dist);
                const size = clamp(height / dist, 12, height * 0.9);
                const spriteWidth = size * 0.6;

                const screenX = (0.5 + sprite.angle / this.fov) * width;
                const startX = Math.floor(screenX - spriteWidth / 2);
                const endX = Math.floor(screenX + spriteWidth / 2);
                const startY = Math.floor(height / 2 - size / 2);

                const rgb =
                    sprite.kind === 'pickup'
                        ? [245, 214, 64]
                        : sprite.kind === 'exit-open'
                          ? [90, 220, 170]
                          : [235, 90, 90];

                for (let x = startX; x <= endX; x++) {
                    if (x < 0 || x >= width) continue;
                    if (dist >= this._zBuffer[x]) continue;
                    const alpha = clamp(1 - dist * 0.08, 0.22, 0.95);
                    ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
                    ctx.fillRect(x, startY, 1, size);
                }

                if (sprite.kind === 'pickup') {
                    ctx.fillStyle = 'rgba(10, 10, 18, 0.45)';
                    ctx.fillRect(
                        Math.floor(screenX - spriteWidth * 0.25),
                        Math.floor(height / 2 - size * 0.2),
                        Math.floor(spriteWidth * 0.5),
                        Math.floor(size * 0.4)
                    );
                }
            });
    }

    renderCrosshair() {
        const ctx = this.ctx;
        const { width, height } = this.canvas;
        const cx = Math.floor(width / 2);
        const cy = Math.floor(height / 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy);
        ctx.lineTo(cx + 10, cy);
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx, cy + 10);
        ctx.stroke();
    }

    renderMiniMap() {
        const ctx = this.ctx;
        const scale = 10;
        const padding = 12;
        const mapW = this.map[0].length * scale;
        const mapH = this.map.length * scale;

        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(padding - 6, padding - 6, mapW + 12, mapH + 12);

        for (let y = 0; y < this.map.length; y++) {
            for (let x = 0; x < this.map[0].length; x++) {
                const cell = this.map[y][x];
                if (cell === 0) continue;
                const base = wallPalette[cell] || wallPalette[1];
                ctx.fillStyle = `rgba(${base[0]}, ${base[1]}, ${base[2]}, 0.75)`;
                ctx.fillRect(padding + x * scale, padding + y * scale, scale, scale);
            }
        }

        this.pickups.forEach((pickup) => {
            if (pickup.collected) return;
            ctx.fillStyle = 'rgba(245, 214, 64, 0.95)';
            ctx.beginPath();
            ctx.arc(
                padding + pickup.x * scale,
                padding + pickup.y * scale,
                3,
                0,
                Math.PI * 2
            );
            ctx.fill();
        });

        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(padding + this.player.x * scale, padding + this.player.y * scale, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.moveTo(padding + this.player.x * scale, padding + this.player.y * scale);
        ctx.lineTo(
            padding + (this.player.x + Math.cos(this.player.a) * 0.7) * scale,
            padding + (this.player.y + Math.sin(this.player.a) * 0.7) * scale
        );
        ctx.stroke();

        const total = this.pickups.length;
        const collected = this.pickups.filter((p) => p.collected).length;
        ctx.fillStyle = collected === total ? 'rgba(90, 220, 170, 0.95)' : 'rgba(235, 90, 90, 0.95)';
        ctx.beginPath();
        ctx.arc(padding + this.exit.x * scale, padding + this.exit.y * scale, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}
