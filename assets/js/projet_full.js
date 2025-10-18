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

    function rectIntersectsCircle(rect, cx, cy, r) {
        const rx = rect.left;
        const ry = rect.top;
        const rw = rect.width;
        const rh = rect.height;
        const closestX = Math.max(rx, Math.min(cx, rx + rw));
        const closestY = Math.max(ry, Math.min(cy, ry + rh));
        const dx = closestX - cx;
        const dy = closestY - cy;
        return (dx * dx + dy * dy) < (r * r);
    }

    function rectsOverlap(a, b) {
        return !(a.left + a.width < b.left ||
                 b.left + b.width < a.left ||
                 a.top + a.height < b.top ||
                 b.top + b.height < a.top);
    }

    function chooseRandomIndices(n) {
        const indices = keywords.map((_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        return indices.slice(0, n);
    }

    function computeFlowerForbiddenCircle(size, ctx) {
        const { centerX, centerY } = ctx;
        const radius = (size / 2) * 0.95;
        return { cx: centerX, cy: centerY, r: radius };
    }

    function restartVisibleAnimation(el) {
        el.classList.remove('visible');
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = 'pulse 3s infinite ease-in-out';
        el.classList.add('visible');
    }

    function updateKeywordVisibility() {
        keywords.forEach(k => {
            if (k.dataset.placed === '1') {
                k.style.transformOrigin = 'center center';
                restartVisibleAnimation(k);
                k.style.opacity = 1;
            } else {
                k.classList.remove('visible');
                k.style.animation = 'none';
                k.style.opacity = 0;
            }
        });
    }

    function resizeFlower() {
        const margin = 40;
        const bodyPadTop = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
        const headerH = bodyPadTop;

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
        const refW = 1920;
        const refH = 1080;
        const wScale = window.innerWidth / refW;
        const hScale = window.innerHeight / refH;
        const scale = Math.max(0.45, Math.min(1.25, Math.min(wScale, hScale)));
        const baseSize = Math.round((Math.min(window.innerWidth, window.innerHeight) / 15) * scale);
        const scaleFactors = [1.3, 1.6, 1.1, 1.4, 1.2, 1.5, 1.0, 1.35];

        keywords.forEach((k, i) => {
            const fs = Math.max(10, Math.round(baseSize * scaleFactors[i]));
            k.style.setProperty('font-size', `${fs}px`, 'important');
            k.dataset._baseFontSize = fs;
            k.style.transformOrigin = 'center center';
            k.style.willChange = 'transform, opacity';
            k.dataset.placed = '0';
            k.style.opacity = 0;
            k.classList.remove('visible');
            k.style.animation = 'none';
            void k.offsetWidth;
        });
    }

    function normalizeRotationAngle(rawDeg) {
        let rot = ((rawDeg % 360) + 360) % 360;
        if (rot > 90 && rot < 270) rot += 180;
        return rot;
    }

    function computeMaxRadiusGivenAngles(indices, startAngleDeg, ctx, size, margin) {
        const { centerX, centerY, headerH } = ctx;
        const span = 60;
        let r_max_global = Infinity;
        for (let i = 0; i < indices.length; i++) {
            const idx = indices[i];
            const angleDeg = startAngleDeg + (span / Math.max(1, indices.length - 1)) * i;
            const theta = angleDeg * Math.PI / 180;
            const cos = Math.cos(theta);
            const sin = Math.sin(theta);
            const kwRect = keywords[idx].getBoundingClientRect();
            const kwHalfW = kwRect.width / 2;
            const kwHalfH = kwRect.height / 2;

            const minCenterX = margin + kwHalfW;
            const maxCenterX = window.innerWidth - margin - kwHalfW;
            const minCenterY = headerH + margin + kwHalfH;
            const maxCenterY = window.innerHeight - margin - kwHalfH;

            let intervalX = null;
            if (Math.abs(cos) < 1e-6) {
                if (centerX < minCenterX || centerX > maxCenterX) {
                    return -1;
                } else {
                    intervalX = [-Infinity, Infinity];
                }
            } else {
                const a = (minCenterX - centerX) / cos;
                const b = (maxCenterX - centerX) / cos;
                intervalX = [Math.min(a, b), Math.max(a, b)];
            }

            let intervalY = null;
            if (Math.abs(sin) < 1e-6) {
                if (centerY < minCenterY || centerY > maxCenterY) {
                    return -1;
                } else {
                    intervalY = [-Infinity, Infinity];
                }
            } else {
                const a = (minCenterY - centerY) / sin;
                const b = (maxCenterY - centerY) / sin;
                intervalY = [Math.min(a, b), Math.max(a, b)];
            }

            const low = Math.max(intervalX[0], intervalY[0], 0);
            const high = Math.min(intervalX[1], intervalY[1]);

            if (high < low) {
                return -1;
            }
            r_max_global = Math.min(r_max_global, high);
        }
        if (!isFinite(r_max_global)) r_max_global = 1e6;
        return r_max_global;
    }

    function positionKeywords(size, ctx) {
        const margin = 18;
        const { headerH, centerX, centerY } = ctx;
        const forbidden = computeFlowerForbiddenCircle(size, ctx);

        const aspect = window.innerWidth / window.innerHeight;
        const placedRects = [];

        function collidesWithPlacedOrFlower(candidateRect) {
            if (rectIntersectsCircle(candidateRect, forbidden.cx, forbidden.cy, forbidden.r)) return true;
            for (const r of placedRects) {
                if (rectsOverlap(r, candidateRect)) return true;
            }
            return false;
        }

        keywords.forEach(k => {
            k.style.transition = 'none';
            k.style.left = '';
            k.style.top = '';
            k.style.transform = '';
            k.dataset.placed = '0';
            k.style.opacity = 0;
            k.classList.remove('visible');
            k.style.animation = 'none';
        });

        const WIDE_THRESHOLD = 1.4;
        const NARROW_THRESHOLD = 0.85;

        if (aspect >= WIDE_THRESHOLD) {
            const extraFactor = Math.min(1.2, (aspect - 1) * 0.9 + 0.5);
            const originalBaseRadius = (size / 2) + (size * 0.3 * extraFactor);

            const leftIndices = [0,1,2,3];
            const rightIndices = [4,5,6,7];
            const span = 60;
            const MIN_GAP_FROM_FLOWER = 24;

            let fontScale = 1.0;
            const minFontScale = 0.75;
            let finalRadius = originalBaseRadius;
            let success = false;

            for (let attempt = 0; attempt < 4; attempt++) {
                keywords.forEach(k => {
                    const baseFs = parseFloat(k.dataset._baseFontSize || getComputedStyle(k).fontSize);
                    const newFs = Math.max(8, Math.round(baseFs * fontScale));
                    k.style.setProperty('font-size', `${newFs}px`, 'important');
                    void k.offsetWidth;
                });

                const rMaxLeft = computeMaxRadiusGivenAngles(leftIndices, 150, {centerX, centerY, headerH}, size, margin);
                const rMaxRight = computeMaxRadiusGivenAngles(rightIndices, -30, {centerX, centerY, headerH}, size, margin);

                let rAllowed = Math.min(
                    rMaxLeft > 0 ? rMaxLeft : Infinity,
                    rMaxRight > 0 ? rMaxRight : Infinity
                );

                if (!isFinite(rAllowed)) rAllowed = -1;

                if (rAllowed <= 0) {
                    fontScale *= 0.9;
                    if (fontScale < minFontScale) break;
                    continue;
                }

                finalRadius = Math.min(originalBaseRadius, rAllowed);

                if (finalRadius >= (forbidden.r + MIN_GAP_FROM_FLOWER)) {
                    success = true;
                    break;
                } else {
                    fontScale *= 0.9;
                    if (fontScale < minFontScale) {
                        finalRadius = Math.min(originalBaseRadius, rAllowed);
                        success = true;
                        break;
                    }
                }
            }

            const placeAlongArc = (indices, startAngleDeg) => {
                const n = indices.length;
                for (let i = 0; i < n; i++) {
                    const idx = indices[i];
                    let attempts = 0;
                    let placed = false;
                    const angleDeg = startAngleDeg + (span / Math.max(1, n - 1)) * i;
                    while (!placed && attempts < 100) {
                        const jitter = (Math.random() - 0.5) * size * 0.02;
                        const r = finalRadius + jitter;
                        const angleRad = (angleDeg + (Math.random() - 0.5) * 4) * Math.PI / 180;
                        const x = centerX + r * Math.cos(angleRad);
                        const y = centerY + r * Math.sin(angleRad);
                        const base = keywords[idx].getBoundingClientRect();
                        const left = x - base.width / 2;
                        const top = y - base.height / 2;
                        const candidate = { left, top, width: base.width, height: base.height };

                        if (left < margin) { attempts++; continue; }
                        if (top < headerH + margin) { attempts++; continue; }
                        if (left + base.width > window.innerWidth - margin) { attempts++; continue; }
                        if (top + base.height > window.innerHeight - margin) { attempts++; continue; }

                        if (!collidesWithPlacedOrFlower(candidate)) {
                            const rawRot = angleDeg + 90;
                            const finalRot = normalizeRotationAngle(rawRot);
                            keywords[idx].style.left = `${left}px`;
                            keywords[idx].style.top = `${top}px`;
                            keywords[idx].style.transform = `rotate(${finalRot}deg)`;
                            keywords[idx].dataset.placed = '1';
                            keywords[idx].style.opacity = 1;
                            placedRects.push(candidate);
                            placed = true;
                        }
                        attempts++;
                    }

                    if (!placed) {
                        let fallbackR = finalRadius + size * 0.12;
                        for (let f = 0; f < 40 && !placed; f++) {
                            const angleRad = (angleDeg) * Math.PI / 180;
                            const x = centerX + fallbackR * Math.cos(angleRad);
                            const y = centerY + fallbackR * Math.sin(angleRad);
                            const base = keywords[idx].getBoundingClientRect();
                            const left = Math.min(Math.max(margin, x - base.width / 2), window.innerWidth - margin - base.width);
                            const top = Math.min(Math.max(headerH + margin, y - base.height / 2), window.innerHeight - margin - base.height);
                            const candidate = { left, top, width: base.width, height: base.height };
                            if (!collidesWithPlacedOrFlower(candidate)) {
                                const rawRot = angleDeg + 90;
                                const finalRot = normalizeRotationAngle(rawRot);
                                keywords[idx].style.left = `${left}px`;
                                keywords[idx].style.top = `${top}px`;
                                keywords[idx].style.transform = `rotate(${finalRot}deg)`;
                                keywords[idx].dataset.placed = '1';
                                keywords[idx].style.opacity = 1;
                                placedRects.push(candidate);
                                placed = true;
                            }
                            fallbackR += size * 0.01;
                        }
                    }
                }
            };

            placeAlongArc([0,1,2,3], 150);
            placeAlongArc([4,5,6,7], -30);

        } else if (aspect >= NARROW_THRESHOLD) {
            const chosen = chooseRandomIndices(4);
            const corners = [
                { x: 0.18, y: 0.12 },
                { x: 0.82, y: 0.12 },
                { x: 0.18, y: 0.88 },
                { x: 0.82, y: 0.88 }
            ];

            for (let i = 0; i < 4; i++) {
                const idx = chosen[i];
                const corner = corners[i];
                const x = Math.max(10, Math.min(window.innerWidth - 10, corner.x * window.innerWidth));
                const y = Math.max(10, Math.min(window.innerHeight - 10, corner.y * window.innerHeight));
                const base = keywords[idx].getBoundingClientRect();
                const left = x - base.width / 2;
                const top = y - base.height / 2;
                const candidate = { left, top, width: base.width, height: base.height };

                if (collidesWithPlacedOrFlower(candidate)) {
                    const nudgeX = corner.x < 0.5 ? 12 : -12;
                    const newLeft = Math.max(8, Math.min(window.innerWidth - base.width - 8, left + nudgeX));
                    const newTop = Math.max(8, Math.min(window.innerHeight - base.height - 8, top));
                    keywords[idx].style.left = `${newLeft}px`;
                    keywords[idx].style.top = `${newTop}px`;
                    keywords[idx].style.transform = `rotate(0deg)`;
                    keywords[idx].dataset.placed = '1';
                    keywords[idx].style.opacity = 1;
                    placedRects.push({ left: newLeft, top: newTop, width: base.width, height: base.height });
                } else {
                    keywords[idx].style.left = `${left}px`;
                    keywords[idx].style.top = `${top}px`;
                    keywords[idx].style.transform = `rotate(0deg)`;
                    keywords[idx].dataset.placed = '1';
                    keywords[idx].style.opacity = 1;
                    placedRects.push(candidate);
                }
            }
        } else {
            const chosen = chooseRandomIndices(2);

            const topViewportY = headerH + 8;
            const bottomViewportY = window.innerHeight - 8;
            const flowerTop = forbidden.cy - forbidden.r;
            const flowerBottom = forbidden.cy + forbidden.r;

            const yTop = Math.max(topViewportY + 20, Math.min(flowerTop - 10, (topViewportY + flowerTop) / 2));
            const yBottom = Math.min(bottomViewportY - 20, Math.max(flowerBottom + 10, (flowerBottom + bottomViewportY) / 2));

            const positions = [
                { x: centerX, y: yTop },
                { x: centerX, y: yBottom }
            ];

            for (let i = 0; i < 2; i++) {
                const idx = chosen[i];
                const pos = positions[i];
                const base = keywords[idx].getBoundingClientRect();
                const left = Math.max(8, Math.min(window.innerWidth - base.width - 8, pos.x - base.width / 2));
                const top = Math.max(8, Math.min(window.innerHeight - base.height - 8, pos.y - base.height / 2));
                const candidate = { left, top, width: base.width, height: base.height };
                if (!collidesWithPlacedOrFlower(candidate)) {
                    keywords[idx].style.left = `${left}px`;
                    keywords[idx].style.top = `${top}px`;
                    keywords[idx].style.transform = `rotate(0deg)`;
                    keywords[idx].dataset.placed = '1';
                    keywords[idx].style.opacity = 1;
                    placedRects.push(candidate);
                } else {
                    const fallbackY = pos.y + (i === 0 ? -size * 0.15 : size * 0.15);
                    const leftF = Math.max(8, Math.min(window.innerWidth - base.width - 8, centerX - base.width / 2));
                    const topF = Math.max(8, Math.min(window.innerHeight - base.height - 8, fallbackY - base.height / 2));
                    keywords[idx].style.left = `${leftF}px`;
                    keywords[idx].style.top = `${topF}px`;
                    keywords[idx].style.transform = `rotate(0deg)`;
                    keywords[idx].dataset.placed = '1';
                    keywords[idx].style.opacity = 1;
                    placedRects.push({ left: leftF, top: topF, width: base.width, height: base.height });
                }
            }
        }

        requestAnimationFrame(() => {
            keywords.forEach(k => k.style.transition = '');
            updateKeywordVisibility();
        });
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
            const placedKeywords = keywords.filter(k => k.dataset.placed === '1');
            placedKeywords.forEach((k, i) => {
                const appearDelay = i * 80 + Math.random() * 200;
                setTimeout(() => {
                    restartVisibleAnimation(k);
                    k.style.opacity = 1;
                }, appearDelay);
            });
        }, totalDelay + 200);
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
        resizeFlower();
        sequentialShow();

        window.addEventListener('wheel', onWheel, { passive: true });
        window.addEventListener('touchstart', onTouchStart, { passive: false });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd, { passive: true });

        window.addEventListener('resize', resizeFlower);

        requestAnimationFrame(loop);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
