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

    const baseOverlayZ = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--overlay-z')) || 999;

    function pxToNumber(px) { return px ? parseFloat(String(px).replace('px',''))||0 : 0; }
    function getHeaderHeightPx() {
        const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '0px';
        return pxToNumber(raw);
    }

    const basePath = IMG_PATH_POINTS_JSON.replace(/\/[^/]+$/, '');
    function resolveImagePath(imgPath) {
        if (!imgPath) return imgPath;
        const s = String(imgPath);
        if (s.startsWith(basePath) || s.startsWith('./') || s.startsWith('../') || /assets\/img\//.test(s)) return s;
        const clean = s.replace(/^\/+/, '');
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

        let framePromise = Promise.resolve();
        if (frame.classList.contains('rotated') && String(frame.style.opacity) !== '' && Number(frame.style.opacity) < 1) {
            const prev = frame.style.transition || '';
            frame.style.transition = 'opacity 320ms ease';
            frame.style.opacity = '1';
            framePromise = waitTransitionEnd(frame, 360).then(() => { frame.style.transition = prev; });
        }

        await Promise.all([...promises, panelPromise, framePromise]);

        oldThumbs.forEach(tb => tb.remove());
        bottomInfo.classList.remove('hiding');
        bottomInfo.classList.remove('show');
        bottomInfo.setAttribute('aria-hidden', 'true');

        const mainBox = document.querySelector('.thumb-box.main-image');
        if (mainBox) mainBox.remove();

        currentOpen = null;
    }

    const planRoot = document.getElementById('plan-root');
    const ROTATE_MQ = window.matchMedia('(max-width: 720px)');

    const ROTATION_MARGIN_V = 12;
    const ROTATED_SIDE_MARGIN = 12;
    const MAX_SCALE_VERTICAL = 1.5;

    const ROTATED_THUMB_TOP_OFFSET = 30;

    let currentOpen = null;

    let ro = null;
    if (window.ResizeObserver && planRoot) {
        ro = new ResizeObserver(() => updateFrameRotation());
        ro.observe(planRoot);
    }

    function applyTransformInstant(el, transformValue) {
        const prev = el.style.transition || '';
        el.style.transition = 'none';
        el.style.transformOrigin = 'center center';
        el.style.transform = transformValue;
        el.getBoundingClientRect();
        requestAnimationFrame(() => { el.style.transition = prev; });
    }

    function resetBottomInfoInline() {
        if (!bottomInfo) return;
        bottomInfo.style.left = '';
        bottomInfo.style.right = '';
        bottomInfo.style.width = '';
        bottomInfo.style.top = '';
        bottomInfo.style.zIndex = '';
    }

    function resetThumbBoxesInline() {
        const thumbs = document.querySelectorAll('.thumb-box');
        thumbs.forEach(b => {
            b.style.left = '';
            b.style.top = '';
            b.style.width = '';
            b.style.height = '';
            b.style.zIndex = '';
        });
    }

    function getRotatedArea() {
        const rootRect = planRoot.getBoundingClientRect();
        const rootStyles = getComputedStyle(planRoot);
        const rootPadL = pxToNumber(rootStyles.paddingLeft);
        const rootPadR = pxToNumber(rootStyles.paddingRight);

        const effectiveLeftPad = Math.min(rootPadL, ROTATED_SIDE_MARGIN);
        const effectiveRightPad = Math.min(rootPadR, ROTATED_SIDE_MARGIN);

        const left = Math.round(rootRect.left + effectiveLeftPad);
        const width = Math.max(40, Math.round(rootRect.width - effectiveLeftPad - effectiveRightPad));
        return { areaLeft: left, areaWidth: width };
    }

    function updateFrameRotation() {
        if (!frame || !planRoot) return;
        const shouldRotate = ROTATE_MQ.matches;

        const rootRect = planRoot.getBoundingClientRect();
        const rootStyles = getComputedStyle(planRoot);
        const rootPadL = pxToNumber(rootStyles.paddingLeft);
        const rootPadR = pxToNumber(rootStyles.paddingRight);
        const availW = Math.max(20, rootRect.width - rootPadL - rootPadR);
        const availH = Math.max(20, window.innerHeight - getHeaderHeightPx() - ROTATION_MARGIN_V * 2);

        const fw = Math.max(1, frame.clientWidth);
        const fh = Math.max(1, frame.clientHeight);

        if (!shouldRotate) {
            frame.classList.remove('rotated');
            applyTransformInstant(frame, '');
            frame.style.overflow = '';
            frame.style.opacity = '1';
            resetBottomInfoInline();
            resetThumbBoxesInline();
            const mainBox = document.querySelector('.thumb-box.main-image'); if (mainBox) mainBox.remove();
            positionPoints();
            updateOpenLayout();
            return;
        }

        const scale = Math.min(MAX_SCALE_VERTICAL, availW / fh, availH / fw);

        const transformValue = `rotate(90deg) scale(${scale})`;
        frame.classList.add('rotated');
        frame.style.overflow = 'visible';

        applyTransformInstant(frame, transformValue);

        if (currentOpen) {
            frame.style.transition = 'opacity 320ms ease';
            frame.style.opacity = '0.18';
        } else {
            frame.style.opacity = '1';
        }

        setTimeout(() => {
            positionPoints();
            const active = document.querySelector('.map-point.active');
            if (!frame.classList.contains('rotated') && tooltip.classList.contains('show') && active) {
                positionTooltip(active);
            } else {
                tooltip.classList.remove('show');
                tooltip.setAttribute('aria-hidden', 'true');
            }
            updateOpenLayout();
        }, 30);
    }

    updateFrameRotation();

    window.addEventListener('resize', () => {
        updateFrameRotation();
        positionPoints();
        updateOpenLayout();
        updateDotAndTextSizes();
        const active = document.querySelector('.map-point.active');
        if (tooltip.classList.contains('show') && active) positionTooltip(active);
    });
    window.addEventListener('orientationchange', () => { updateFrameRotation(); });
    if (ROTATE_MQ.addEventListener) ROTATE_MQ.addEventListener('change', updateFrameRotation); else if (ROTATE_MQ.addListener) ROTATE_MQ.addListener(updateFrameRotation);

    function positionPoints() {
        const cs = getComputedStyle(img);
        const borderLeft = pxToNumber(cs.borderLeftWidth);
        const borderTop = pxToNumber(cs.borderTopWidth);
        const borderRight = pxToNumber(cs.borderRightWidth);
        const borderBottom = pxToNumber(cs.borderBottomWidth);

        const contentWidth = Math.max(0, img.clientWidth - borderLeft - borderRight);
        const contentHeight = Math.max(0, img.clientHeight - borderTop - borderBottom);

        const imgOffsetLeft = img.offsetLeft || 0;
        const imgOffsetTop = img.offsetTop || 0;

        overlay.querySelectorAll('.map-point').forEach(btn => {
            const rawX = Number(btn.dataset.x);
            const rawY = Number(btn.dataset.y);
            if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
                btn.style.display = 'none'; return;
            }

            const pxInsideX = (rawX / 100) * contentWidth;
            const pxInsideY = (rawY / 100) * contentHeight;

            const localX = imgOffsetLeft + borderLeft + pxInsideX;
            const localY = imgOffsetTop + borderTop + pxInsideY;

            btn.style.position = 'absolute';
            btn.style.left = `${Math.round(localX)}px`;
            btn.style.top = `${Math.round(localY)}px`;
            btn.style.display = '';
        });

        const imgRect = img.getBoundingClientRect();
        positionBottomInfo(imgRect);

        updateDotAndTextSizes();
    }

    function positionBottomInfo(frameRect) {
        if (!bottomInfo) return;
        frameRect = frameRect || frame.getBoundingClientRect();
        if (!bottomInfo.classList.contains('show')) return;

        const panelRect = bottomInfo.getBoundingClientRect();

        const rootRect = planRoot.getBoundingClientRect();
        const rootStyles = getComputedStyle(planRoot);
        const rootPadL = pxToNumber(rootStyles.paddingLeft);
        const rootPadR = pxToNumber(rootStyles.paddingRight);

        if (frame.classList.contains('rotated')) {
            const { areaLeft, areaWidth } = getRotatedArea();
            bottomInfo.style.position = 'fixed';
            bottomInfo.style.left = `${areaLeft}px`;
            bottomInfo.style.right = '';
            bottomInfo.style.width = `${areaWidth}px`;

            let desiredTop = Math.round(frameRect.bottom - panelRect.height - 12);
            desiredTop = Math.max(ROTATION_MARGIN_V, Math.min(desiredTop, window.innerHeight - panelRect.height - ROTATION_MARGIN_V));
            desiredTop += ROTATED_THUMB_TOP_OFFSET;
            bottomInfo.style.top = `${desiredTop}px`;
            bottomInfo.style.zIndex = (baseOverlayZ || 999) + 40;

            const thumbs = Array.from(document.querySelectorAll('.thumb-box'));
            if (thumbs.length) updateOpenLayout();
            return;
        }

        const gapBottom = Math.max(0, window.innerHeight - frameRect.bottom);

        let desiredTop = Math.round(frameRect.bottom + (gapBottom / 2) - (panelRect.height / 2));
        const minTop = Math.round(frameRect.bottom + 8);
        const maxTop = Math.round(window.innerHeight - panelRect.height - 8);

        if (minTop > maxTop) {
            desiredTop = Math.max(8, window.innerHeight - panelRect.height - 8);
        } else {
            desiredTop = Math.min(Math.max(desiredTop, minTop), maxTop);
        }

        bottomInfo.style.left = bottomInfo.style.left || '';
        bottomInfo.style.right = bottomInfo.style.right || '';
        bottomInfo.style.width = '';

        bottomInfo.style.position = 'fixed';
        bottomInfo.style.left = bottomInfo.style.left || '10%';
        bottomInfo.style.right = bottomInfo.style.right || '10%';
        bottomInfo.style.top = `${desiredTop}px`;
        bottomInfo.style.zIndex = (baseOverlayZ || 999) + 12;
    }

    function clearGallery() {}

    function openGalleryWith(images, startIndex = 0) {
        if (!Array.isArray(images) || images.length === 0) return;
        const full = images.map(s => isAbsolutePath(s) ? s : resolveImagePath(s));
        if (window.GalleryOverlay && typeof window.GalleryOverlay.open === 'function') {
            window.GalleryOverlay.open(startIndex, full, { enableScroll: false });
        }
    }

    function isAbsolutePath(p) { return typeof p === 'string' && (p.startsWith('/') || p.startsWith('http://') || p.startsWith('https://')); }

    closeGallery = function() {
        if (window.GalleryOverlay && typeof window.GalleryOverlay.close === 'function') window.GalleryOverlay.close();
        clearGallery();
    };

    function updateOpenLayout() {
        if (!currentOpen) return;
        const images = currentOpen.images || [];

        const cs = getComputedStyle(img);
        const borderLeft = pxToNumber(cs.borderLeftWidth);
        const borderRight = pxToNumber(cs.borderRightWidth);
        const borderTop = pxToNumber(cs.borderTopWidth);
        const borderBottom = pxToNumber(cs.borderBottomWidth);

        const contentWidth = Math.max(0, img.clientWidth - borderLeft - borderRight);
        const contentHeight = Math.max(0, img.clientHeight - borderTop - borderBottom);

        const rootRect = planRoot.getBoundingClientRect();
        const rootStyles = getComputedStyle(planRoot);
        const rootPadL = pxToNumber(rootStyles.paddingLeft);
        const rootPadR = pxToNumber(rootStyles.paddingRight);
        let areaLeft = Math.round(rootRect.left + rootPadL);
        let areaWidth = Math.max(24, Math.round(rootRect.width - rootPadL - rootPadR));

        const headerH = getHeaderHeightPx();
        const imgRect = img.getBoundingClientRect();
        const gapTop = Math.max(0, imgRect.top - headerH);

        const MIN_THUMB_HEIGHT = 40;
        const MARGIN_AROUND = 12;
        let thumbHeight = Math.max(MIN_THUMB_HEIGHT, gapTop - (MARGIN_AROUND * 2));

        const GAP_BETWEEN = 10;
        const n = Math.max(1, images.length);
        let thumbWidth = Math.floor(Math.max(24, (contentWidth - GAP_BETWEEN * (n - 1)) / n));
        if (thumbWidth * n + GAP_BETWEEN * (n - 1) > contentWidth) {
            const reducedGap = Math.max(4, Math.round((contentWidth - (24 * n)) / Math.max(1, n - 1)));
            thumbWidth = Math.floor(Math.max(24, (contentWidth - reducedGap * (n - 1)) / n));
        }

        let topForThumbs = frame.classList.contains('rotated')
            ? Math.max(8, Math.round(imgRect.top + 8))
            : Math.max(8, headerH + Math.round((gapTop - thumbHeight) / 2));

        if (frame.classList.contains('rotated')) topForThumbs += ROTATED_THUMB_TOP_OFFSET;

        if (frame.classList.contains('rotated')) {
            const area = getRotatedArea();
            areaLeft = area.areaLeft; areaWidth = area.areaWidth;

            document.querySelectorAll('.thumb-box:not(.main-image)').forEach(b => b.remove());

            if (currentOpen && currentOpen.images && currentOpen.images.length) {
                const halfH = Math.floor((window.innerHeight - getHeaderHeightPx()) / 2);
                const mainImgH = Math.max(120, Math.min(halfH - 24, Math.floor(halfH * 0.9)));
                const aspect = Math.max(0.5, Math.min(2, contentWidth / Math.max(1, contentHeight)));
                const mainImgW = Math.min(areaWidth, Math.floor(mainImgH * aspect));

                let mainBox = document.querySelector('.thumb-box.main-image');
                if (!mainBox) {
                    mainBox = document.createElement('div');
                    mainBox.className = 'thumb-box main-image';
                    mainBox.style.border = getComputedStyle(document.documentElement).getPropertyValue('--panel-border') || '2px solid var(--main-orange)';
                    mainBox.style.boxSizing = 'border-box';
                    mainBox.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (currentOpen && currentOpen.images) openGalleryWith(currentOpen.images, 0);
                    });
                    document.body.appendChild(mainBox);
                }

                let mi = mainBox.querySelector('img');
                if (!mi) {
                    mi = document.createElement('img');
                    mi.style.width = '100%';
                    mi.style.height = '100%';
                    mi.style.objectFit = 'cover';
                    mainBox.appendChild(mi);
                }
                mi.src = currentOpen.images && currentOpen.images[0] ? (isAbsolutePath(currentOpen.images[0]) ? currentOpen.images[0] : resolveImagePath(currentOpen.images[0])) : '';

                const mainLeft = areaLeft + Math.round((areaWidth - mainImgW) / 2);
                const mainTop = Math.round(getHeaderHeightPx() + Math.round((halfH - mainImgH) / 2)) + ROTATED_THUMB_TOP_OFFSET;

                mainBox.style.position = 'fixed';
                mainBox.style.left = `${mainLeft}px`;
                mainBox.style.top = `${mainTop}px`;
                mainBox.style.width = `${mainImgW}px`;
                mainBox.style.height = `${mainImgH}px`;
                mainBox.style.zIndex = (baseOverlayZ || 999) + 60;
                mainBox.classList.add('showing');

                bottomInfo.style.position = 'fixed';
                bottomInfo.style.left = `${areaLeft}px`;
                bottomInfo.style.width = `${areaWidth}px`;
                const textPanelH = Math.min(Math.floor(halfH * 0.9), 320);
                const textTop = Math.round(getHeaderHeightPx() + halfH + Math.round((halfH - textPanelH) / 2)) + ROTATED_THUMB_TOP_OFFSET;
                bottomInfo.style.top = `${textTop}px`;
                bottomInfo.style.zIndex = (baseOverlayZ || 999) + 60;

                return;
            }
        }

        let thumbEls = Array.from(document.querySelectorAll('.thumb-box'));
        thumbEls = thumbEls.filter(b => !b.classList.contains('main-image'));

        if (thumbEls.length === 0 && currentOpen && currentOpen.images && currentOpen.images.length) {
            const frag = document.createDocumentFragment();
            currentOpen.images.forEach((src, idx) => {
                const box = document.createElement('div');
                box.className = 'thumb-box';
                box.classList.remove('showing', 'hiding');

                let leftX = Math.round(imgRect.left + borderLeft + idx * (thumbWidth + GAP_BETWEEN));
                box.style.position = 'fixed';
                box.style.left = `${leftX}px`;
                box.style.top = `${topForThumbs}px`;
                box.style.width = `${thumbWidth}px`;
                box.style.height = `${thumbHeight}px`;
                box.style.zIndex = (baseOverlayZ || 999) + 50;
                box.dataset.index = String(idx);

                const imgEl = document.createElement('img');
                imgEl.alt = (bottomInfo && bottomInfo.textContent) ? `${bottomInfo.textContent} (${idx + 1})` : `photo ${idx + 1}`;
                imgEl.src = src;

                box.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const full = (currentOpen.images || []).map(s => isAbsolutePath(s) ? s : resolveImagePath(s));
                    if (window.GalleryOverlay && typeof window.GalleryOverlay.open === 'function') {
                        window.GalleryOverlay.open(idx, full, { enableScroll: false });
                    }
                });

                box.appendChild(imgEl);
                frag.appendChild(box);
            });
            document.body.appendChild(frag);

            thumbEls = Array.from(document.querySelectorAll('.thumb-box')).filter(b => !b.classList.contains('main-image'));
            thumbEls.forEach(b => b.classList.add('showing'));
        }

        let startLeft = Math.round(imgRect.left + borderLeft);
        thumbEls.forEach((box, idx) => {
            let leftX = Math.round(startLeft + idx * (thumbWidth + GAP_BETWEEN));
            box.style.left = `${leftX}px`;
            box.style.top = `${topForThumbs}px`;
            box.style.width = `${thumbWidth}px`;
            box.style.height = `${thumbHeight}px`;
        });

        resetBottomInfoInline();
        positionBottomInfo(imgRect);
    }

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
                    const isRotated = frame && frame.classList.contains('rotated');
                    if (isRotated && btn.classList.contains('active')) return;

                    const payload = JSON.parse(btn.dataset.payload || '{}');
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

                btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); } });
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

        if (frame && frame.classList.contains('rotated')) {
            tooltip.classList.remove('show');
            tooltip.setAttribute('aria-hidden', 'true');
        }

        await fadeOutExistingContent();

        const images = Array.isArray(payload.images) ? payload.images.slice() : [];

        const cs = getComputedStyle(img);
        const borderLeft = pxToNumber(cs.borderLeftWidth);
        const borderTop = pxToNumber(cs.borderTopWidth);
        const borderRight = pxToNumber(cs.borderRightWidth);
        const borderBottom = pxToNumber(cs.borderBottomWidth);

        const contentWidth = Math.max(0, img.clientWidth - borderLeft - borderRight);
        const contentHeight = Math.max(0, img.clientHeight - borderTop - borderBottom);

        const imgRect = img.getBoundingClientRect();

        const headerH = getHeaderHeightPx();
        const gapTop = Math.max(0, imgRect.top - headerH);

        const MIN_THUMB_HEIGHT = 40;
        const MARGIN_AROUND = 12;
        let thumbHeight = Math.max(MIN_THUMB_HEIGHT, gapTop - (MARGIN_AROUND * 2));

        const GAP_BETWEEN = 10;
        const n = Math.max(1, images.length);
        const totalGaps = GAP_BETWEEN * (n - 1);

        let thumbWidth = Math.floor(Math.max(24, (contentWidth - totalGaps) / n));
        if (thumbWidth * n + totalGaps > contentWidth) {
            const reducedGap = Math.max(4, Math.round((contentWidth - (24 * n)) / Math.max(1, n - 1)));
            thumbWidth = Math.floor(Math.max(24, (contentWidth - reducedGap * (n - 1)) / n));
        }

        const rootRect = planRoot.getBoundingClientRect();
        const rootStyles = getComputedStyle(planRoot);
        const rootPadL = pxToNumber(rootStyles.paddingLeft);
        const rootPadR = pxToNumber(rootStyles.paddingRight);
        const { areaLeft, areaWidth } = frame.classList.contains('rotated') ? getRotatedArea() : { areaLeft: Math.round(rootRect.left + rootPadL), areaWidth: Math.max(24, Math.round(rootRect.width - rootPadL - rootPadR)) };

        let startLeft = Math.round(imgRect.left + borderLeft);
        if (frame.classList.contains('rotated')) {
            startLeft = areaLeft;
        }

        const topForThumbs = frame.classList.contains('rotated')
            ? Math.max(8, Math.round(imgRect.top + 8)) + ROTATED_THUMB_TOP_OFFSET
            : Math.max(8, headerH + Math.round((gapTop - thumbHeight) / 2));

        const frag = document.createDocumentFragment();
        const thumbEls = [];

        if (frame.classList.contains('rotated')) {
            const halfH = Math.floor((window.innerHeight - getHeaderHeightPx()) / 2);
            const mainImgH = Math.max(120, Math.min(halfH - 24, Math.floor(halfH * 0.9)));
            const aspect = Math.max(0.5, Math.min(2, contentWidth / Math.max(1, contentHeight)));
            const mainImgW = Math.min(areaWidth, Math.floor(mainImgH * aspect));

            let mainBox = document.querySelector('.thumb-box.main-image');
            if (!mainBox) {
                mainBox = document.createElement('div');
                mainBox.className = 'thumb-box main-image';
                mainBox.style.border = getComputedStyle(document.documentElement).getPropertyValue('--panel-border') || '2px solid var(--main-orange)';
                mainBox.style.boxSizing = 'border-box';
                mainBox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (images && images.length) openGalleryWith(images, 0);
                });
                document.body.appendChild(mainBox);
            }

            document.querySelectorAll('.thumb-box:not(.main-image)').forEach(b => b.remove());

            let mi = mainBox.querySelector('img');
            if (!mi) {
                mi = document.createElement('img');
                mi.style.width = '100%';
                mi.style.height = '100%';
                mi.style.objectFit = 'cover';
                mainBox.appendChild(mi);
            }

            mi.src = images && images[0] ? (isAbsolutePath(images[0]) ? images[0] : resolveImagePath(images[0])) : '';

            const mainLeft = areaLeft + Math.round((areaWidth - mainImgW) / 2);
            const mainTop = Math.round(getHeaderHeightPx() + Math.round((halfH - mainImgH) / 2)) + ROTATED_THUMB_TOP_OFFSET;

            mainBox.style.position = 'fixed';
            mainBox.style.left = `${mainLeft}px`;
            mainBox.style.top = `${mainTop}px`;
            mainBox.style.width = `${mainImgW}px`;
            mainBox.style.height = `${mainImgH}px`;
            mainBox.style.zIndex = (baseOverlayZ || 999) + 60;
            mainBox.classList.add('showing');

            thumbEls.push(mainBox);

            bottomInfo.innerHTML = '';
            const title = payload.title ? `<h3 style="margin-top:0;margin-bottom:6px;">${payload.title}</h3>` : '';
            bottomInfo.innerHTML = title + (payload.text || '');
            bottomInfo.classList.remove('hiding');

            bottomInfo.style.position = 'fixed';
            bottomInfo.style.left = `${areaLeft}px`;
            bottomInfo.style.width = `${areaWidth}px`;
            const textPanelH = Math.min(Math.floor(halfH * 0.9), 320);
            const textTop = Math.round(getHeaderHeightPx() + halfH + Math.round((halfH - textPanelH) / 2)) + ROTATED_THUMB_TOP_OFFSET;
            bottomInfo.style.top = `${textTop}px`;
            bottomInfo.style.zIndex = (baseOverlayZ || 999) + 60;
            requestAnimationFrame(() => {
                bottomInfo.classList.add('show');
                bottomInfo.setAttribute('aria-hidden', 'false');
            });
        } else {
            images.forEach((src, idx) => {
                const box = document.createElement('div');
                box.className = 'thumb-box';
                box.classList.remove('showing', 'hiding');

                let leftX = Math.round(startLeft + idx * (thumbWidth + GAP_BETWEEN));
                leftX = Math.round(startLeft + idx * (thumbWidth + GAP_BETWEEN));

                box.style.position = 'fixed';
                box.style.left = `${leftX}px`;
                box.style.top = `${topForThumbs}px`;
                box.style.width = `${thumbWidth}px`;
                box.style.height = `${thumbHeight}px`;
                box.style.zIndex = (baseOverlayZ || 999) + 50;

                box.dataset.index = String(idx);

                const imgEl = document.createElement('img');
                imgEl.alt = payload.title ? `${payload.title} (${idx + 1})` : `photo ${idx + 1}`;
                imgEl.src = src;

                box.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const full = images.map(s => isAbsolutePath(s) ? s : resolveImagePath(s));
                    if (window.GalleryOverlay && typeof window.GalleryOverlay.open === 'function') {
                        window.GalleryOverlay.open(idx, full, { enableScroll: false });
                    }
                });

                box.appendChild(imgEl);
                frag.appendChild(box);
                thumbEls.push(box);
            });

            bottomInfo.innerHTML = '';
            const title = payload.title ? `<h3 style="margin-top:0;margin-bottom:6px;">${payload.title}</h3>` : '';
            bottomInfo.innerHTML = title + (payload.text || '');
            bottomInfo.classList.remove('hiding');
        }

        if (frag.childNodes && frag.childNodes.length) document.body.appendChild(frag);

        await new Promise(resolve => {
            requestAnimationFrame(() => {
                thumbEls.forEach(t => t.getBoundingClientRect());
                resolve();
            });
        });

        thumbEls.forEach(box => { box.classList.remove('hiding'); box.classList.add('showing'); });

        if (!frame.classList.contains('rotated')) {
            requestAnimationFrame(() => {
                bottomInfo.classList.add('show');
                bottomInfo.setAttribute('aria-hidden', 'false');
                const imgRectNow = img.getBoundingClientRect();
                positionBottomInfo(imgRectNow);
                bottomInfo.style.zIndex = (baseOverlayZ || 999) + 40;
            });
        }

        if (frame.classList.contains('rotated')) {
            frame.style.transition = 'opacity 320ms ease';
            frame.style.opacity = '0.18';
        }

        currentOpen = { btn, images, thumbEls };

        setTimeout(() => {
            positionPoints();
            thumbEls.forEach((box, idx) => {
                if (!box.classList.contains('main-image')) {}
            });
        }, 20);

        setTimeout(() => { document.addEventListener('click', outsideClickListener); }, 10);
    }

    async function closeAll() {
        overlay.querySelectorAll('.map-point.active').forEach(p => p.classList.remove('active'));
        const mainBox = document.querySelector('.thumb-box.main-image');
        if (mainBox) mainBox.remove();

        tooltip.classList.remove('show');
        tooltip.setAttribute('aria-hidden', 'true');

        await fadeOutExistingContent();
        document.removeEventListener('click', outsideClickListener);
    }

    function outsideClickListener(e) {
        if (e.target.closest('.map-point') || e.target.closest('.thumb-box') || e.target.closest('.plan-bottom-info') || e.target.closest('.gallery-overlay')) return;
        fadeOutExistingContent();
        overlay.querySelectorAll('.map-point.active').forEach(p => p.classList.remove('active'));
        document.removeEventListener('click', outsideClickListener);
    }

    window.addEventListener('scroll', () => positionPoints(), true);

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (window.GalleryOverlay && typeof window.GalleryOverlay.close === 'function') window.GalleryOverlay.close(); fadeOutExistingContent(); } });

    let initialRevealDone = false;

    function shuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

    function revealPointsSequentially({stagger = 80} = {}) {
        const pts = Array.from(overlay.querySelectorAll('.map-point'));
        if (!pts.length) return;
        const idxs = shuffleArray(pts.map((_, i) => i));
        idxs.forEach((idx, i) => {
            const el = pts[idx];
            const jitter = Math.round(Math.random() * 40) - 20;
            setTimeout(() => { el.classList.add('visible'); el.removeAttribute('tabindex'); el.style.pointerEvents = ''; }, i * stagger + jitter);
        });
    }

    async function runMapIntroZoom() {
        if (!img.complete) {
            await new Promise(resolve => { img.addEventListener('load', resolve, { once: true }); setTimeout(resolve, 1000); });
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

        if (prevTransition) img.style.transition = prevTransition; else img.style.transition = '';
    }

    function clampNumber(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function updateDotAndTextSizes() {
        if (!img) return;
        const cs = getComputedStyle(img);
        const borderLeft = pxToNumber(cs.borderLeftWidth);
        const borderRight = pxToNumber(cs.borderRightWidth);
        const contentWidth = Math.max(0, img.clientWidth - borderLeft - borderRight);
        const contentHeight = Math.max(0, img.clientHeight - pxToNumber(cs.borderTopWidth) - pxToNumber(cs.borderBottomWidth));

        document.documentElement.style.setProperty('--plan-width', `${Math.round(contentWidth)}px`);

        const computedDot = Math.round(clampNumber(contentWidth * 0.025, 8, 28));
        document.documentElement.style.setProperty('--dot-size', `${computedDot}px`);

        const halo = Math.max(1, Math.round(computedDot * 0.18));
        document.documentElement.style.setProperty('--halo-border-size', `${halo}px`);
    }

    (async function initSequence() {
        await loadPoints();
        await new Promise(r => setTimeout(r, 60));

        updateDotAndTextSizes();

        if (!initialRevealDone) {
            await runMapIntroZoom();
            revealPointsSequentially({stagger: 80});
            initialRevealDone = true;
        } else {
            overlay.querySelectorAll('.map-point').forEach(p => { p.classList.add('visible'); p.removeAttribute('tabindex'); p.style.pointerEvents = ''; });
        }
    })();

    window.planUI = {
        reload: async function() { await loadPoints(); overlay.querySelectorAll('.map-point').forEach(p => { p.classList.add('visible'); p.removeAttribute('tabindex'); p.style.pointerEvents = ''; }); initialRevealDone = true; },
        openById(id) {
            const btn = overlay.querySelector(`.map-point[data-id="${id}"]`);
            if (btn) (async ()=> { await openPoint(btn); })();
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
