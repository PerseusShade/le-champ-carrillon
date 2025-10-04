(function () {
    'use strict';

    const IMAGES = [
        "./assets/img/projet/img0.jpg",
        "./assets/img/projet/img1.png",
        "./assets/img/projet/img2.jpg",
        "./assets/img/projet/img3.png",
        "./assets/img/projet/img4.png",
        "./assets/img/projet/img5.jpg",
        "./assets/img/projet/img6.png",
        "./assets/img/projet/img7.png",
    ];
    window.PROJET_IMAGES = IMAGES;
    const ATTACH_TO_VIEWPORT = true;
    const IMAGE_FIT = 'cover';
    const IDLE_TIMEOUT_MS = 160;

    let canvas = null, ctx = null, dpr = 1;
    let svgEl = null;
    let petalUses = [];
    let perUsePath2D = [];
    let images = [];
    let imageRectCache = { w: 0, h: 0, rects: [] };
    let rafId = null;
    let lastActivityTs = 0;
    let isRendering = false;

    const FADE_DURATION_MS = 600;
    let perPetalAlpha = [];
    let perPetalFade = [];

    function ensureCanvas() {
        canvas = document.getElementById('petal-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'petal-canvas';
            Object.assign(canvas.style, {
                position: 'fixed',
                inset: '0',
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none',
                zIndex: '0'
            });
            document.body.insertBefore(canvas, document.querySelector('svg'));
        }
        ctx = canvas.getContext('2d', { alpha: true });
    }

    function setCanvasSize() {
        dpr = window.devicePixelRatio || 1;
        const w = Math.max(1, window.innerWidth);
        const h = Math.max(1, window.innerHeight);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        imageRectCache.w = w;
        imageRectCache.h = h;
        imageRectCache.rects = [];
    }

    function preloadImages(srcs) {
        return Promise.all(srcs.map(src => new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (e) => { console.warn('img load err', src, e); resolve(null); };
            img.src = src;
        })));
    }

    function computeImageDrawRect(img, viewportW, viewportH, fitMode) {
        const iw = img.width, ih = img.height;
        if (!iw || !ih) return { x: 0, y: 0, w: viewportW, h: viewportH };
        if (fitMode === 'fill') return { x: 0, y: 0, w: viewportW, h: viewportH };
        const scaleCover = Math.max(viewportW / iw, viewportH / ih);
        const scaleContain = Math.min(viewportW / iw, viewportH / ih);
        const scale = fitMode === 'cover' ? scaleCover : scaleContain;
        const w = Math.round(iw * scale);
        const h = Math.round(ih * scale);
        const x = Math.round((viewportW - w) / 2);
        const y = Math.round((viewportH - h) / 2);
        return { x, y, w, h };
    }

    function getImageRectForIndex(i, img) {
        const vw = window.innerWidth, vh = window.innerHeight;
        if (imageRectCache.w === vw && imageRectCache.h === vh && imageRectCache.rects[i]) {
            return imageRectCache.rects[i];
        }
        const rect = computeImageDrawRect(img, vw, vh, IMAGE_FIT);
        imageRectCache.rects[i] = rect;
        return rect;
    }

    function buildPath2DsForUses() {
        perUsePath2D = new Array(petalUses.length).fill(null);

        petalUses.forEach((useEl, i) => {
            if (!useEl.classList.contains('visible')) return;

            const img = images[i];
            const path2d = perUsePath2D[i];
            if (!img || !path2d) return;

            let alpha = perPetalAlpha[i] != null ? perPetalAlpha[i] : 0;
            const fade = perPetalFade[i];
            if (fade) {
                const now = performance.now();
                const t = Math.min(1, (now - fade.start) / FADE_DURATION_MS);
                const eased = t * t * (3 - 2 * t);
                alpha = fade.from + (fade.to - fade.from) * eased;
                if (t >= 1) {
                    alpha = fade.to;
                    perPetalFade[i] = null;
                }
                perPetalAlpha[i] = alpha;
            }

            const screenCTM = useEl.getScreenCTM();
            if (!screenCTM) return;

            ctx.save();

            if (ATTACH_TO_VIEWPORT) {
                const a = screenCTM.a, b = screenCTM.b, c = screenCTM.c, d = screenCTM.d, e = screenCTM.e, f = screenCTM.f;
                ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr);

                try { ctx.beginPath(); ctx.clip(path2d); } catch (err) {}

                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.globalAlpha = alpha;
                const rect = getImageRectForIndex(i, img);
                ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
                ctx.globalAlpha = 1.0;
            } else {
                const a = screenCTM.a, b = screenCTM.b, c = screenCTM.c, d = screenCTM.d, e = screenCTM.e, f = screenCTM.f;
                ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr);
                try { ctx.beginPath(); ctx.clip(path2d); } catch (err) {}
                ctx.globalAlpha = alpha;
                const huge = 4000;
                ctx.drawImage(img, -huge/2, -huge/2, huge, huge);
                ctx.globalAlpha = 1.0;
            }

            ctx.restore();
        });

    }

    function buildPath2DForIndex(idx) {
        const useEl = petalUses[idx];
        if (!useEl) return;
        try {
            let ref = useEl.getAttribute('href') || useEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
            if (!ref || !ref.startsWith('#')) return;
            const target = svgEl.querySelector(ref);
            if (!target) return;

            const aggregate = new Path2D();
            function addD(d) { if (!d) return; try { const p = new Path2D(d); if (typeof aggregate.addPath === 'function') aggregate.addPath(p); else perUsePath2D[idx] = p; } catch(e){} }
            if (target.tagName.toLowerCase() === 'path') addD(target.getAttribute('d'));
            else {
                const paths = target.querySelectorAll ? target.querySelectorAll('path') : [];
                if (paths.length) paths.forEach(p => addD(p.getAttribute('d')));
                else {
                    const fallback = svgEl.querySelector('#petal');
                    if (fallback && fallback.getAttribute('d')) addD(fallback.getAttribute('d'));
                }
            }
            if (!perUsePath2D[idx]) perUsePath2D[idx] = aggregate;
        } catch (err) {
            console.warn('buildPath2DForIndex error', err);
        }
    }

    function drawAll() {
        if (!ctx || !canvas) return;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        if (!perUsePath2D || perUsePath2D.length === 0) return;

        petalUses.forEach((useEl, i) => {
            if (!useEl.classList.contains('visible')) return;

            const img = images[i];
            const path2d = perUsePath2D[i];
            if (!img || !path2d) return;

            let alpha = perPetalAlpha[i] ?? 0;
            const fade = perPetalFade[i];
            if (fade) {
                const now = performance.now();
                const t = Math.min(1, (now - fade.start) / FADE_DURATION_MS);
                const eased = t * t * (3 - 2 * t);
                alpha = fade.from + (fade.to - fade.from) * eased;
                if (t >= 1) {
                    alpha = fade.to;
                    perPetalFade[i] = null;
                }
                perPetalAlpha[i] = alpha;
            }

            const screenCTM = useEl.getScreenCTM();
            if (!screenCTM) return;

            ctx.save();

            if (ATTACH_TO_VIEWPORT) {
                const {a,b,c,d,e,f} = screenCTM;
                ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr);

                try { ctx.beginPath(); ctx.clip(path2d); } catch (err) {}

                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.globalAlpha = alpha;
                const rect = getImageRectForIndex(i, img);
                ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
                ctx.globalAlpha = 1.0;
            } else {
                const {a,b,c,d,e,f} = screenCTM;
                ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr);
                try { ctx.beginPath(); ctx.clip(path2d); } catch (err) {}
                ctx.globalAlpha = alpha;
                const huge = 4000;
                ctx.drawImage(img, -huge/2, -huge/2, huge, huge);
                ctx.globalAlpha = 1.0;
            }

            ctx.restore();
        });
    }

    function scheduleRender() {
        lastActivityTs = performance.now();
        if (!isRendering) {
            isRendering = true;
            function frame() {
                const now = performance.now();
                drawAll();
                if (now - lastActivityTs < IDLE_TIMEOUT_MS) {
                    rafId = requestAnimationFrame(frame);
                } else {
                    isRendering = false;
                    rafId = null;
                }
            }
            rafId = requestAnimationFrame(frame);
        }
    }

    function watchSVGChanges() {
        const mo = new MutationObserver((mutations) => {
            let rebuild = false;
            for (const m of mutations) {
                if (m.type === 'attributes' && (m.attributeName === 'transform' || m.attributeName === 'd')) {
                    rebuild = true; break;
                }
                if (m.type === 'childList') { rebuild = true; break; }
            }
            if (rebuild) {
                petalUses = Array.from(svgEl.querySelectorAll('use.petal'));
                buildPath2DsForUses();
                scheduleRender();
            }
        });
        mo.observe(svgEl, { attributes: true, childList: true, subtree: true, attributeFilter: ['transform', 'd', 'href', 'xlink:href', 'style', 'class'] });
    }

    function startFade(idx) {
        if (!perPetalAlpha[idx] || perPetalAlpha[idx] < 1) {
            perPetalFade[idx] = { from: perPetalAlpha[idx] || 0, to: 1, start: performance.now() };
            scheduleRender();
        }
    }

    async function init() {
        window.addEventListener('petal:visible', (e) => {
            const idx = e && e.detail && Number(e.detail.index);
            if (!Number.isFinite(idx)) { scheduleRender(); return; }

            buildPath2DForIndex(idx);

            if (!images[idx]) {
                const img = new Image();
                img.onload = () => { images[idx] = img; startFade(idx); };
                img.onerror = () => { images[idx] = null; startFade(idx); };
                img.src = IMAGES[idx];
            } else {
                startFade(idx);
            }
        });


        svgEl = document.querySelector('svg');
        if (!svgEl) { console.warn('No svg'); return; }

        ensureCanvas();
        setCanvasSize();

        petalUses = Array.from(svgEl.querySelectorAll('use.petal'));

        buildPath2DsForUses();

        perPetalAlpha = new Array(petalUses.length).fill(0);
        perPetalFade  = new Array(petalUses.length).fill(null);

        images = await preloadImages(IMAGES);

        window.addEventListener('resize', () => { setCanvasSize(); scheduleRender(); }, { passive: true });
        window.addEventListener('scroll', () => scheduleRender(), { passive: true });
        window.addEventListener('flower:update', () => scheduleRender());
        const zones = svgEl.querySelectorAll('use.petal-zone');
        zones.forEach(z => z.addEventListener('pointerdown', () => scheduleRender()));

        watchSVGChanges();
        scheduleRender();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
