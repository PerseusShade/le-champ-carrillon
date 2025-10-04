(function () {
    const petals = Array.from(document.querySelectorAll('.petal'));
    const petalTexts = Array.from(document.querySelectorAll('.petal-text'));
    const keywords = Array.from(document.querySelectorAll('.keyword'));
    const svg = document.querySelector('svg');
    const petales = document.querySelector('.petales');

    const APPEAR_DELAY_MS = 150;
    const ROTATION_STEP = 0.25;
    const V_DEFAULT = 0.2;
    const V_MAX = 4.0;
    const V_MIN = -3.0;
    const RELAXATION = 0.02;

    let angle = 0;
    let velocity = V_DEFAULT;

    let rotationPaused = false;
    let velocityFrozen = false;
    let savedVelocity = null;

    function resizeFlower() {
        const margin = 40;
        const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 60;

        const availableW = window.innerWidth - margin * 2;
        const availableH = window.innerHeight - headerH - margin * 2;
        const size = Math.min(availableW, availableH);

        const centerX = window.innerWidth / 2;
        const centerY = headerH + margin + (availableH / 2);

        Object.assign(svg.style, {
            width: `${size}px`,
            height: `${size}px`,
            position: "absolute",
            left: `${centerX}px`,
            top: `${centerY}px`,
            transform: `translate(-50%, -50%)`,
        });

        resizeKeywords(size);
        positionKeywords(size, { headerH, centerX, centerY });
    }

    function resizeKeywords(size) {
        const baseSize = size / 15;
        const scaleFactors = [1.3, 1.6, 1.1, 1.4, 1.2, 1.5, 1.0, 1.35];

        keywords.forEach((k, i) => {
            k.style.fontSize = `${baseSize * scaleFactors[i]}px`;
        });
    }

    function positionKeywords(size, ctx) {
        const { headerH, centerX, centerY } = ctx;
        const radius = size / 2 + size * 0.3;

        const isPortrait = window.innerHeight > window.innerWidth;

        if (isPortrait) {
            const arcSpan = 60;
            const startTop = -arcSpan / 2;
            const startBot = 180 - arcSpan / 2;

            for (let i = 0; i < 4; i++) {
                const angleDeg = startTop + (arcSpan / 3) * i;
                placeKeyword(keywords[i], centerX, centerY, radius, angleDeg);
            }
            for (let i = 4; i < 8; i++) {
                const angleDeg = startBot + (arcSpan / 3) * (i - 4);
                placeKeyword(keywords[i], centerX, centerY, radius, angleDeg);
            }
        } else {
            const arcSpan = 60;
            const startLeft = 180 - arcSpan / 2;
            const startRight = -arcSpan / 2;

            for (let i = 0; i < 4; i++) {
                const angleDeg = startLeft + (arcSpan / 3) * i;
                placeKeyword(keywords[i], centerX, centerY, radius, angleDeg);
            }
            for (let i = 4; i < 8; i++) {
                const angleDeg = startRight + (arcSpan / 3) * (i - 4);
                placeKeyword(keywords[i], centerX, centerY, radius, angleDeg);
            }
        }
    }

    function placeKeyword(el, cx, cy, r, angleDeg) {
        const angleRad = angleDeg * Math.PI / 180;
        const x = cx + r * Math.cos(angleRad);
        const y = cy + r * Math.sin(angleRad);

        const rect = el.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        el.style.left = `${x - w / 2}px`;
        el.style.top = `${y - h / 2}px`;

        el.style.transform = `rotate(${angleDeg + 90}deg)`;
    }

    function applyRotation() {
        petales.style.transform = `rotate(${angle}deg)`;
    }

    function loop() {
        if (!rotationPaused) {
            angle += velocity;
        }
        if (!velocityFrozen) {
            velocity += (V_DEFAULT - velocity) * RELAXATION;
        }

        applyRotation();

        window.dispatchEvent(new CustomEvent('flower:update', {
            detail: { angle, velocity, t: performance.now() }
        }));

        requestAnimationFrame(loop);
    }

    function onWheel(e) {
        velocity += (e.deltaY > 0 ? ROTATION_STEP : -ROTATION_STEP);

        if (velocity > V_MAX) velocity = V_MAX;
        if (velocity < V_MIN) velocity = V_MIN;
    }

    let touchStartY = null;
    function onTouchStart(e) {
        if (e.touches && e.touches.length) {
            touchStartY = e.touches[0].clientY;
        }
    }
    function onTouchMove(e) {
        if (!touchStartY) return;
        const y = e.touches[0].clientY;
        const dy = touchStartY - y;
        velocity += (dy > 0 ? ROTATION_STEP : -ROTATION_STEP);

        if (velocity > V_MAX) velocity = V_MAX;
        if (velocity < V_MIN) velocity = V_MIN;

        touchStartY = y;
        e.preventDefault();
    }
    function onTouchEnd() {
        touchStartY = null;
    }

    function sequentialShow() {
        const logo = document.querySelector(".logo-center");
        const LOGO_FADE_MS = 600;
        if (logo) logo.classList.add("visible");

        const petalsDelay = LOGO_FADE_MS + 200;
        petals.forEach((petal, i) => {
            const delay = petalsDelay + i * APPEAR_DELAY_MS;
            setTimeout(() => {
                petal.classList.add('visible');
                window.dispatchEvent(new CustomEvent('petal:visible', { detail: { index: i } }));
                if (petalTexts[i]) petalTexts[i].classList.add('visible');
            }, delay);
        });

        const totalDelay = petalsDelay + petals.length * APPEAR_DELAY_MS;

        setTimeout(() => {
            keywords.forEach((k, i) => {
                const appearDelay = Math.random() * 3000;
                setTimeout(() => {
                    k.classList.add("visible");
                    k.style.animation = "pulse 3s infinite ease-in-out";
                }, appearDelay);
            });
        }, totalDelay + 400);
    }

    window.addEventListener('flower:pause', () => {
        savedVelocity = velocity;
        velocity = 0;
        velocityFrozen = true;
        rotationPaused = true;
    });

    window.addEventListener('flower:resume', () => {
        if (typeof savedVelocity === 'number') {
            velocity = savedVelocity;
        }
        savedVelocity = null;
        velocityFrozen = false;
        rotationPaused = false;
    });

    function init() {
        sequentialShow();

        window.addEventListener('wheel', onWheel, { passive: true });
        window.addEventListener('touchstart', onTouchStart, { passive: false });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd, { passive: true });

        window.addEventListener('resize', resizeFlower);

        resizeFlower();
        requestAnimationFrame(loop);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
