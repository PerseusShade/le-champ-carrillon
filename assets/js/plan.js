document.addEventListener('DOMContentLoaded', () => {
    const IMG_PATH_POINTS_JSON = '../assets/img/plan/points/points.json';
    const img = document.querySelector('.plan-image');
    const frame = document.querySelector('.plan-frame');
    if (!img || !frame) return;

    let overlay = frame.querySelector('.points-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'points-overlay';
        frame.appendChild(overlay);
    }

    const bottomInfo = document.createElement('div');
    bottomInfo.className = 'plan-bottom-info';
    bottomInfo.setAttribute('aria-hidden', 'true');
    bottomInfo.setAttribute('aria-live', 'polite');
    document.body.appendChild(bottomInfo);

    const tooltip = document.createElement('div');
    tooltip.className = 'map-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltip);

    const galleryOverlay = document.createElement('div');
    galleryOverlay.className = 'gallery-overlay';
    galleryOverlay.innerHTML = `
        <div class="gallery-close" title="Fermer">&times;</div>
        <div class="gallery-nav gallery-prev">&#10094;</div>
        <img class="main-view" src="" alt="">
        <div class="gallery-nav gallery-next">&#10095;</div>
        <div class="gallery-carousel">
            <div class="gallery-carousel-inner"></div>
        </div>
    `;
    document.body.appendChild(galleryOverlay);

    const baseOverlayZ = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--overlay-z')) || 999;
    galleryOverlay.style.zIndex = String(baseOverlayZ + 100);

    galleryOverlay.style.display = 'none';
    galleryOverlay.style.opacity = 0;
    galleryOverlay.style.transition = 'opacity 200ms ease';
    const mainImg = galleryOverlay.querySelector('.main-view');
    const closeBtn = galleryOverlay.querySelector('.gallery-close');
    const prevBtn = galleryOverlay.querySelector('.gallery-prev');
    const nextBtn = galleryOverlay.querySelector('.gallery-next');
    const carouselInner = galleryOverlay.querySelector('.gallery-carousel-inner');

    function pxToNumber(px) { return px ? parseFloat(String(px).replace('px',''))||0 : 0; }

    function getHeaderHeightPx() {
        const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '0px';
        return pxToNumber(raw);
    }

    const basePath = IMG_PATH_POINTS_JSON.replace(/\/[^/]+$/, '');
    function resolveImagePath(imgPath) {
        if (!imgPath) return imgPath;
        const clean = String(imgPath).replace(/^\/+/, '');
        return basePath + '/' + clean;
    }

    function waitTransitionEnd(el, timeout = 380) {
        return new Promise(resolve => {
            let done = false;
            function onEnd(e) {
                if (e.target !== el) return;
                if (done) return;
                done = true;
                el.removeEventListener('transitionend', onEnd);
                resolve();
            }
            el.addEventListener('transitionend', onEnd);
            setTimeout(() => { if (!done) { done = true; el.removeEventListener('transitionend', onEnd); resolve(); } }, timeout);
        });
    }

    async function fadeOutExistingContent() {
        const oldThumbs = Array.from(document.querySelectorAll('.thumb-box'));
        const promises = oldThumbs.map(tb => {
            tb.classList.remove('showing');
            tb.classList.add('hiding');
            tb.style.pointerEvents = 'none';
            return waitTransitionEnd(tb, 420);
        });

        let panelPromise = Promise.resolve();
        if (bottomInfo.classList.contains('show')) {
            bottomInfo.classList.remove('show');
            bottomInfo.classList.add('hiding');
            bottomInfo.setAttribute('aria-hidden', 'true');
            panelPromise = waitTransitionEnd(bottomInfo, 420);
        }

        await Promise.all([...promises, panelPromise]);

        oldThumbs.forEach(tb => tb.remove());
        bottomInfo.classList.remove('hiding');
        bottomInfo.classList.remove('show');
        bottomInfo.setAttribute('aria-hidden', 'true');
    }

    function positionPoints() {
        const imgRect = img.getBoundingClientRect();
        const cs = getComputedStyle(img);
        const borderLeft = pxToNumber(cs.borderLeftWidth);
        const borderTop = pxToNumber(cs.borderTopWidth);
        const borderRight = pxToNumber(cs.borderRightWidth);
        const borderBottom = pxToNumber(cs.borderBottomWidth);

        const contentLeft = imgRect.left + borderLeft;
        const contentTop = imgRect.top + borderTop;
        const contentWidth = Math.max(0, imgRect.width - borderLeft - borderRight);
        const contentHeight = Math.max(0, imgRect.height - borderTop - borderBottom);

        const overlayRect = overlay.getBoundingClientRect();

        overlay.querySelectorAll('.map-point').forEach(btn => {
            const rawX = Number(btn.dataset.x);
            const rawY = Number(btn.dataset.y);
            if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
                btn.style.display = 'none'; return;
            }
            const pxInsideX = (rawX / 100) * contentWidth;
            const pxInsideY = (rawY / 100) * contentHeight;
            const pxAbsX = contentLeft + pxInsideX;
            const pxAbsY = contentTop + pxInsideY;
            const localX = pxAbsX - overlayRect.left;
            const localY = pxAbsY - overlayRect.top;
            btn.style.left = `${Math.round(localX)}px`;
            btn.style.top = `${Math.round(localY)}px`;
            btn.style.display = '';
        });
        positionBottomInfo(imgRect);
    }

    function positionBottomInfo(frameRect) {
        if (!bottomInfo) return;
        frameRect = frameRect || frame.getBoundingClientRect();
        if (!bottomInfo.classList.contains('show')) return;

        const panelRect = bottomInfo.getBoundingClientRect();
        const gapBottom = Math.max(0, window.innerHeight - frameRect.bottom);

        let desiredTop = Math.round(frameRect.bottom + (gapBottom / 2) - (panelRect.height / 2));
        const minTop = Math.round(frameRect.bottom + 8);
        const maxTop = Math.round(window.innerHeight - panelRect.height - 8);

        if (minTop > maxTop) {
            desiredTop = Math.max(8, window.innerHeight - panelRect.height - 8);
        } else {
            desiredTop = Math.min(Math.max(desiredTop, minTop), maxTop);
        }

        bottomInfo.style.position = 'fixed';
        bottomInfo.style.left = bottomInfo.style.left || '10%';
        bottomInfo.style.right = bottomInfo.style.right || '10%';
        bottomInfo.style.top = `${desiredTop}px`;
        bottomInfo.style.zIndex = (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--overlay-z')) || 999) + 12;
    }

    let galleryImages = [];
    let galleryCurrentIndex = 0;

    function clearGallery() {
        carouselInner.innerHTML = '';
        galleryImages = [];
        galleryCurrentIndex = 0;
    }

    function showGalleryImage(index) {
        galleryCurrentIndex = index;
        if (!galleryImages[galleryCurrentIndex]) return;

        mainImg.style.opacity = 0;
        setTimeout(() => {
            mainImg.src = galleryImages[galleryCurrentIndex];
            mainImg.alt = `Image ${galleryCurrentIndex + 1}`;
            mainImg.style.opacity = 1;
        }, 80);

        const thumbs = Array.from(carouselInner.querySelectorAll('img'));
        thumbs.forEach(thumb => {
            thumb.classList.toggle('active', parseInt(thumb.dataset.index, 10) === galleryCurrentIndex);
        });

        const wrapperW = galleryOverlay.querySelector('.gallery-carousel').clientWidth || window.innerWidth;
        const active = thumbs[galleryCurrentIndex];
        if (!active) return;
        const thumbW = active.getBoundingClientRect().width || 80;
        const pad = Math.max((wrapperW - thumbW) / 2, 0);
        carouselInner.style.paddingLeft = `${pad}px`;
        carouselInner.style.paddingRight = `${pad}px`;
        const offset = active.offsetLeft + thumbW / 2;
        const translateX = wrapperW / 2 - offset;
        carouselInner.style.transform = `translateX(${translateX}px)`;
    }

    function openGalleryWith(images, startIndex = 0) {
        if (!Array.isArray(images) || images.length === 0) return;
        clearGallery();
        galleryImages = images.slice();
        galleryImages.forEach((src, idx) => {
            const t = document.createElement('img');
            t.src = src;
            t.dataset.index = idx;
            t.alt = `vignette ${idx+1}`;
            t.addEventListener('click', (e) => {
                e.stopPropagation();
                showGalleryImage(idx);
            });
            carouselInner.appendChild(t);
        });

        galleryOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => {
            galleryOverlay.style.opacity = 1;
            showGalleryImage(Math.min(Math.max(0, startIndex), galleryImages.length - 1));
        });
    }

    function closeGallery() {
        galleryOverlay.style.opacity = 0;
        galleryOverlay.addEventListener('transitionend', function hide() {
            galleryOverlay.style.display = 'none';
            document.body.style.overflow = '';
            galleryOverlay.removeEventListener('transitionend', hide);
            clearGallery();
        }, { once: true });
    }

    function navigateGallery(direction) {
        if (galleryImages.length === 0) return;
        galleryCurrentIndex = (galleryCurrentIndex + direction + galleryImages.length) % galleryImages.length;
        showGalleryImage(galleryCurrentIndex);
    }

    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeGallery(); });
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateGallery(-1); });
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateGallery(1); });
    galleryOverlay.addEventListener('click', (e) => { if (e.target === galleryOverlay) closeGallery(); });

    async function loadPoints() {
        try {
            const res = await fetch(IMG_PATH_POINTS_JSON, {cache: "no-cache"});
            if (!res.ok) throw new Error('Erreur fetch points.json');
            const points = await res.json();

            overlay.innerHTML = '';

            points.forEach(pt => {
                const btn = document.createElement('button');
                btn.className = 'map-point';
                btn.setAttribute('data-x', String(pt.x));
                btn.setAttribute('data-y', String(pt.y));
                btn.setAttribute('data-id', pt.id || '');
                btn.setAttribute('aria-label', pt.title || '');
                btn.title = pt.title || '';

                btn.setAttribute('tabindex', '-1');
                btn.style.pointerEvents = 'none';

                const images = Array.isArray(pt.images) ? pt.images.map(resolveImagePath) : [];
                const payload = { title: pt.title || '', text: pt.text || '', images };
                btn.dataset.payload = JSON.stringify(payload);
                overlay.appendChild(btn);

                btn.addEventListener('mouseenter', () => {
                    const payload = JSON.parse(btn.dataset.payload);
                    tooltip.textContent = payload.title || '';
                    tooltip.classList.add('show');
                    positionTooltip(btn);
                });
                btn.addEventListener('mouseleave', () => {
                    tooltip.classList.remove('show');
                });

                btn.addEventListener('click', async (ev) => {
                    ev.stopPropagation();
                    const already = btn.classList.contains('active');
                    if (already) {
                        await closeAll();
                        return;
                    }
                    await openPoint(btn);
                });

                btn.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
                });
            });
            positionPoints();
        } catch (err) {
            console.error('loadPoints error', err);
        }
    }

    function positionTooltip(btn) {
        tooltip.style.left = '0px'; tooltip.style.top = '0px';
        tooltip.style.position = 'fixed';
        const r = btn.getBoundingClientRect();
        const tRect = tooltip.getBoundingClientRect();
        const gap = 8;
        let left = r.left + r.width/2 - tRect.width/2;
        let top = r.top - tRect.height - gap;
        left = Math.max(8, Math.min(left, window.innerWidth - tRect.width - 8));
        if (top < 8) top = r.bottom + gap;
        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
    }

    async function openPoint(btn) {
        const payload = JSON.parse(btn.dataset.payload || '{}');

        overlay.querySelectorAll('.map-point.active').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');

        await fadeOutExistingContent();

        const images = Array.isArray(payload.images) ? payload.images.slice() : [];

        const imgRect = img.getBoundingClientRect();
        const cs = getComputedStyle(img);
        const borderLeft = pxToNumber(cs.borderLeftWidth);
        const borderTop = pxToNumber(cs.borderTopWidth);
        const borderRight = pxToNumber(cs.borderRightWidth);
        const borderBottom = pxToNumber(cs.borderBottomWidth);

        const contentLeft = imgRect.left + borderLeft;
        const contentTop = imgRect.top + borderTop;
        const contentWidth = Math.max(0, imgRect.width - borderLeft - borderRight);
        const contentHeight = Math.max(0, imgRect.height - borderTop - borderBottom);

        const headerH = getHeaderHeightPx();
        const gapTop = Math.max(0, imgRect.top - headerH);

        const MIN_THUMB_HEIGHT = 40;
        const MARGIN_AROUND = 20;
        let thumbHeight = Math.max(MIN_THUMB_HEIGHT, gapTop - (MARGIN_AROUND * 2));

        const GAP_BETWEEN = 10;
        const n = Math.max(1, images.length);
        const totalGaps = GAP_BETWEEN * (n - 1);
        let thumbWidth = Math.floor(Math.max(24, (contentWidth - totalGaps) / n));

        if (thumbWidth * n + totalGaps > contentWidth) {
                const reducedGap = Math.max(4, Math.round((contentWidth - (24 * n)) / Math.max(1, n - 1)));
                thumbWidth = Math.floor(Math.max(24, (contentWidth - reducedGap * (n - 1)) / n));
        }

        const overlayLeft = contentLeft;
        const startLeft = overlayLeft;
        const topForThumbs = Math.max(8, headerH + Math.round((gapTop - thumbHeight) / 2));

        const frag = document.createDocumentFragment();
        const thumbEls = [];

        images.forEach((src, idx) => {
                const box = document.createElement('div');
                box.className = 'thumb-box';
                box.classList.remove('showing', 'hiding');

                const leftX = Math.round(startLeft + idx * (thumbWidth + GAP_BETWEEN));
                box.style.position = 'fixed';
                box.style.left = `${leftX}px`;
                box.style.top = `${topForThumbs}px`;
                box.style.width = `${thumbWidth}px`;
                box.style.height = `${thumbHeight}px`;

                box.dataset.index = String(idx);

                const imgEl = document.createElement('img');
                imgEl.alt = payload.title ? `${payload.title} (${idx + 1})` : `photo ${idx + 1}`;
                imgEl.src = src;

                box.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openGalleryWith(images, idx);
                });

                box.appendChild(imgEl);
                frag.appendChild(box);
                thumbEls.push(box);
        });

        document.body.appendChild(frag);

        await new Promise(resolve => {
                requestAnimationFrame(() => {
                        thumbEls.forEach(t => t.getBoundingClientRect());
                        resolve();
                });
        });

        thumbEls.forEach(box => {
                box.classList.remove('hiding');
                box.classList.add('showing');
        });

        bottomInfo.innerHTML = '';
        const title = payload.title ? `<h3 style="margin-top:0;margin-bottom:6px;">${payload.title}</h3>` : '';
        bottomInfo.innerHTML = title + (payload.text || '');
        bottomInfo.classList.remove('hiding');

        requestAnimationFrame(() => {
                bottomInfo.classList.add('show');
                bottomInfo.setAttribute('aria-hidden', 'false');
        });

        setTimeout(() => {
                positionPoints();
                thumbEls.forEach((box, idx) => {
                        const leftX = Math.round(startLeft + idx * (thumbWidth + GAP_BETWEEN));
                        box.style.left = `${leftX}px`;
                        box.style.top = `${topForThumbs}px`;
                        box.style.width = `${thumbWidth}px`;
                        box.style.height = `${thumbHeight}px`;
                });
        }, 20);

        setTimeout(() => {
                document.addEventListener('click', outsideClickListener);
        }, 10);
    }

    async function closeAll() {
        overlay.querySelectorAll('.map-point.active').forEach(p => p.classList.remove('active'));
        await fadeOutExistingContent();
        document.removeEventListener('click', outsideClickListener);
    }

    function outsideClickListener(e) {
        if (e.target.closest('.map-point') || e.target.closest('.thumb-box') || e.target.closest('.plan-bottom-info') || e.target.closest('.gallery-overlay')) return;
        fadeOutExistingContent();
        overlay.querySelectorAll('.map-point.active').forEach(p => p.classList.remove('active'));
        document.removeEventListener('click', outsideClickListener);
    }

    window.addEventListener('resize', () => {
        positionPoints();
        const active = document.querySelector('.map-point.active');
        if (tooltip.classList.contains('show') && active) positionTooltip(active);
    });
    window.addEventListener('scroll', () => positionPoints(), true);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeGallery();
            fadeOutExistingContent();
        } else if (e.key === 'ArrowRight' && galleryOverlay.style.display === 'flex') {
            navigateGallery(1);
        } else if (e.key === 'ArrowLeft' && galleryOverlay.style.display === 'flex') {
            navigateGallery(-1);
        }
    });

    let initialRevealDone = false;

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function revealPointsSequentially({stagger = 80} = {}) {
        const pts = Array.from(overlay.querySelectorAll('.map-point'));
        if (!pts.length) return;
        const idxs = shuffleArray(pts.map((_, i) => i));
        idxs.forEach((idx, i) => {
            const el = pts[idx];
            const jitter = Math.round(Math.random() * 40) - 20;
            setTimeout(() => {
                el.classList.add('visible');
                el.removeAttribute('tabindex');
                el.style.pointerEvents = '';
            }, i * stagger + jitter);
        });
    }

    async function runMapIntroZoom() {
        if (!img.complete) {
            await new Promise(resolve => {
                img.addEventListener('load', resolve, { once: true });
                setTimeout(resolve, 1000);
            });
        }

        const prevTransition = img.style.transition || '';
        img.style.transition = 'none';
        img.style.transformOrigin = 'center center';
        img.style.transform = 'scale(0.9)';
        img.style.opacity = '0';

        img.getBoundingClientRect();

        await new Promise(r => requestAnimationFrame(r));
        img.style.transition = 'transform 480ms cubic-bezier(.2,.9,.2,1), opacity 480ms ease';
        img.style.transform = 'scale(1)';
        img.style.opacity = '1';

        await waitTransitionEnd(img, 600);

        if (prevTransition) {
            img.style.transition = prevTransition;
        } else {
            img.style.transition = '';
        }
    }

    (async function initSequence() {
        await loadPoints();
        await new Promise(r => setTimeout(r, 60));

        if (!initialRevealDone) {
            await runMapIntroZoom();
            revealPointsSequentially({stagger: 80});
            initialRevealDone = true;
        } else {
            overlay.querySelectorAll('.map-point').forEach(p => {
                p.classList.add('visible');
                p.removeAttribute('tabindex');
                p.style.pointerEvents = '';
            });
        }
    })();

    window.planUI = {
        reload: async function() {
            await loadPoints();
            overlay.querySelectorAll('.map-point').forEach(p => {
                p.classList.add('visible');
                p.removeAttribute('tabindex');
                p.style.pointerEvents = '';
            });
            initialRevealDone = true;
        },
        openById(id) {
            const btn = overlay.querySelector(`.map-point[data-id="${id}"]`);
            if (btn) {
                (async ()=> {
                    await openPoint(btn);
                })();
            }
        },
        addPoint(obj) {
            const btn = document.createElement('button');
            btn.className = 'map-point';
            btn.setAttribute('data-x', String(obj.x));
            btn.setAttribute('data-y', String(obj.y));
            btn.setAttribute('data-id', obj.id || '');
            btn.setAttribute('aria-label', obj.title || '');
            btn.setAttribute('tabindex', '-1');
            btn.style.pointerEvents = 'none';
            const images = (obj.images||[]).map(resolveImagePath);
            btn.dataset.payload = JSON.stringify({ title: obj.title || '', text: obj.text || '', images });
            overlay.appendChild(btn);
            positionPoints();
            return btn;
        }
    };
});
