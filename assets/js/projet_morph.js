(function () {
    'use strict';

    const SAMPLE_POINTS = 64;
    const DURATION_MS = 700;
    const EASE = (t) => t * t * (3 - 2 * t);

    const BG_ANIM_DURATION_MS = Math.max(60, Math.round(DURATION_MS / 3));
    const MOVE_DELAY_MS = Math.max(80, BG_ANIM_DURATION_MS + 120);

    const INFO_FADE_MS = 260;
    let PROJECT_TEXTS = {};

    (function loadTextsJson() {
        fetch('../assets/img/projet/texts.json', { cache: 'no-cache' })
            .then(r => { if (!r.ok) throw r; return r.json(); })
            .then(j => { PROJECT_TEXTS = j || {}; })
            .catch(() => { PROJECT_TEXTS = {}; });
    })();

    function interpolatePoints(src, dst, t) {
        const out = [];
        for (let i = 0; i < src.length; i++) {
            const sx = src[i].x, sy = src[i].y;
            const dx = dst[i].x, dy = dst[i].y;
            out.push({ x: sx + (dx - sx) * t, y: sy + (dy - sy) * t });
        }
        return out;
    }

    function rectPerimeterPoints(w, h, n, inset = 0) {
        const pts = [];
        const W = Math.max(1, w - inset * 2);
        const H = Math.max(1, h - inset * 2);
        const perim = 2 * (W + H);
        for (let i = 0; i < n; i++) {
            const d = (i / n) * perim;
            if (d <= W) {
                pts.push({ x: inset + d, y: inset });
            } else if (d <= W + H) {
                pts.push({ x: inset + W, y: inset + (d - W) });
            } else if (d <= 2 * W + H) {
                pts.push({ x: inset + (W - (d - (W + H))), y: inset + H });
            } else {
                pts.push({ x: inset, y: inset + (H - (d - (2 * W + H))) });
            }
        }
        return pts;
    }

    function catmullRomToBezierPath(pts, closed = true) {
        const n = pts.length;
        if (n === 0) return '';
        if (n === 1) return `M ${pts[0].x} ${pts[0].y} Z`;
        let d = '';
        for (let i = 0; i < n; i++) {
            const p0 = pts[(i - 1 + n) % n];
            const p1 = pts[i];
            const p2 = pts[(i + 1) % n];
            const p3 = pts[(i + 2) % n];

            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;

            if (i === 0) d += `M ${p1.x} ${p1.y} `;
            d += `C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y} `;
        }
        if (closed) d += 'Z';
        return d;
    }

    function rectPathString(w, h, inset = 0) {
        const x0 = inset, y0 = inset;
        const x1 = w - inset, y1 = h - inset;
        return `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`;
    }

    function transformPointByMatrix(pt, matrix) {
        return {
            x: matrix.a * pt.x + matrix.c * pt.y + matrix.e,
            y: matrix.b * pt.x + matrix.d * pt.y + matrix.f
        };
    }

    function samplePathInScreenCoords(pathEl, useEl, samples = SAMPLE_POINTS) {
        const total = (typeof pathEl.getTotalLength === 'function') ? pathEl.getTotalLength() : 0;
        const screenMatrix = useEl.getScreenCTM();
        const pts = [];
        for (let i = 0; i < samples; i++) {
            const l = (i / samples) * total;
            let p;
            try {
                p = (typeof pathEl.getPointAtLength === 'function') ? pathEl.getPointAtLength(l) : { x: 0, y: 0 };
            } catch (e) {
                const bb = pathEl.getBBox();
                p = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
            }
            const sp = transformPointByMatrix(p, screenMatrix);
            pts.push({ x: sp.x, y: sp.y });
        }
        return pts;
    }

    function signedArea(pts) {
        let a = 0;
        for (let i = 0; i < pts.length; i++) {
            const j = (i + 1) % pts.length;
            a += (pts[i].x * pts[j].y - pts[j].x * pts[i].y);
        }
        return a / 2;
    }

    function reverseArrayInPlace(arr) {
        let i = 0, j = arr.length - 1;
        while (i < j) {
            const tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
            i++; j--;
        }
    }

    function rotateArray(arr, shift) {
        const n = arr.length;
        const out = new Array(n);
        for (let i = 0; i < n; i++) out[i] = arr[(i + shift) % n];
        return out;
    }

    function findBestShift(src, dst) {
        const n = src.length;
        let best = 0;
        let bestScore = Infinity;
        for (let s = 0; s < n; s++) {
            let score = 0;
            for (let i = 0; i < n; i++) {
                const d0 = dst[(i + s) % n];
                const dx = src[i].x - d0.x;
                const dy = src[i].y - d0.y;
                score += dx * dx + dy * dy;
                if (score >= bestScore) break;
            }
            if (score < bestScore) {
                bestScore = score;
                best = s;
            }
        }
        return best;
    }

    function animate(duration, tick) {
        return new Promise((resolve) => {
            const start = performance.now();
            function frame(now) {
                const elapsed = Math.max(0, now - start);
                const t = Math.min(1, elapsed / duration);
                tick(t, elapsed);
                if (t < 1) requestAnimationFrame(frame);
                else resolve();
            }
            requestAnimationFrame(frame);
        });
    }

    function matrixForTranslateRotate(dx, dy, cx, cy, angleDeg) {
        const rad = angleDeg * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const a = cos;
        const b = sin;
        const c = -sin;
        const d = cos;

        const e = cx - (a * cx + c * cy);
        const f = cy - (b * cx + d * cy);
        const e2 = e + dx;
        const f2 = f + dy;
        return `matrix(${a} ${b} ${c} ${d} ${e2} ${f2})`;
    }

    function matrixForTranslateRotateScale(dx, dy, cx, cy, angleDeg, scale) {
        const rad = angleDeg * Math.PI / 180;
        const cos = Math.cos(rad) * scale;
        const sin = Math.sin(rad) * scale;

        const a = cos;
        const b = sin;
        const c = -sin;
        const d = cos;

        const e = cx - (a * cx + c * cy) + dx;
        const f = cy - (b * cx + d * cy) + dy;
        return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;
    }


    function createInfoBoxElement(textHtml) {
        const el = document.createElement('div');
        el.className = 'morph-info-box';

        const inner = document.createElement('div');
        inner.className = 'morph-info-inner';
        inner.innerHTML = textHtml || '';
        el.appendChild(inner);

        el.style.opacity = '0';
        el.style.transform = 'translate(-50%, 8px)';
        el.style.pointerEvents = 'auto';
        return el;
    }

    function morphOpenFromZone(zoneUseEl, imageSrc) {
        if (!zoneUseEl) return;
        if (document.querySelector('.morph-overlay-svg')) return;

        const svgRoot = document.querySelector('svg');
        if (!svgRoot) return;

        const zones = Array.from(svgRoot.querySelectorAll('use.petal-zone'));
        const idx = zones.indexOf(zoneUseEl);
        if (idx === -1) return;

        const petals = Array.from(svgRoot.querySelectorAll('use.petal'));
        const petalUseEl = petals[idx];
        if (!petalUseEl) {
            console.warn('morph: corresponding use.petal not found for index', idx);
            return;
        }

        const ref = petalUseEl.getAttribute('href') || petalUseEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (!ref || !ref.startsWith('#')) {
            console.warn('morph: petal use does not reference a path', petalUseEl);
            return;
        }
        const pathTarget = svgRoot.querySelector(ref);
        if (!pathTarget) {
            console.warn('morph: referenced path not found', ref);
            return;
        }

        const rawSrcPts = samplePathInScreenCoords(pathTarget, petalUseEl, SAMPLE_POINTS);

        const headerHstr = getComputedStyle(document.documentElement).getPropertyValue('--header-height');
        const parsedHeader = parseInt(headerHstr, 10);
        const headerGuess = Number.isNaN(parsedHeader) ? 60 : Math.max(0, parsedHeader);

        const vw = window.innerWidth;
        const vhTotal = window.innerHeight;

        const overlayNS = 'http://www.w3.org/2000/svg';
        const overlay = document.createElementNS(overlayNS, 'svg');
        overlay.setAttribute('class', 'morph-overlay-svg');
        overlay.setAttribute('width', String(vw));
        overlay.setAttribute('height', String(Math.max(1, vhTotal - headerGuess)));
        overlay.style.left = '0px';
        overlay.style.top = `${headerGuess}px`;
        overlay.style.position = 'fixed';
        overlay.style.pointerEvents = 'auto';
        overlay.style.zIndex = 9998;

        const defs = document.createElementNS(overlayNS, 'defs');
        const clip = document.createElementNS(overlayNS, 'clipPath');
        const clipId = `morph-clip-${Date.now()}`;
        clip.setAttribute('id', clipId);
        const morphPath = document.createElementNS(overlayNS, 'path');
        morphPath.setAttribute('fill', '#fff');
        morphPath.setAttribute('stroke', 'none');
        clip.appendChild(morphPath);
        defs.appendChild(clip);
        overlay.appendChild(defs);

        const img = document.createElementNS(overlayNS, 'image');
        img.setAttribute('class', 'morph-overlay-image');
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', imageSrc || '');
        img.setAttribute('x', '0');
        img.setAttribute('y', '0');
        img.setAttribute('width', String(vw));
        img.setAttribute('height', String(Math.max(1, vhTotal - headerGuess)));
        img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        img.setAttribute('clip-path', `url(#${clipId})`);
        overlay.appendChild(img);

        document.body.appendChild(overlay);

        const overlayRect = overlay.getBoundingClientRect();
        const overlayLeft = overlayRect.left;
        const overlayTop = overlayRect.top;
        const overlayW = overlayRect.width;
        const overlayH = overlayRect.height;
        overlay.setAttribute('width', String(Math.round(overlayW)));
        overlay.setAttribute('height', String(Math.round(overlayH)));
        overlay.setAttribute('viewBox', `0 0 ${Math.round(overlayW)} ${Math.round(overlayH)}`);
        img.setAttribute('width', String(Math.round(overlayW)));
        img.setAttribute('height', String(Math.round(overlayH)));

        const srcPts = rawSrcPts.map(p => ({ x: p.x - overlayLeft, y: p.y - overlayTop }));

        let dstPts = rectPerimeterPoints(Math.round(overlayW), Math.round(overlayH), SAMPLE_POINTS, 0);

        const sa = signedArea(srcPts);
        const da = signedArea(dstPts);
        if (sa !== 0 && da !== 0 && ((sa > 0 && da < 0) || (sa < 0 && da > 0))) {
            reverseArrayInPlace(dstPts);
        }

        const bestShift = findBestShift(srcPts, dstPts);
        dstPts = rotateArray(dstPts, bestShift);

        let svgTextGroup = null;
        let petalTextEl = null;
        let originalPetalTextStyle = null;
        let clone = null;
        let bgRect = null;
        let bgCx = 0;
        let bgCy = 0;
        let wrapperGroup = null;
        try {
            const petalTexts = Array.from(svgRoot.querySelectorAll('.petal-text'));
            petalTextEl = petalTexts[idx] || null;
            if (petalTextEl) {
                originalPetalTextStyle = {
                    opacity: petalTextEl.style.opacity || '',
                    pointerEvents: petalTextEl.style.pointerEvents || '',
                    transition: petalTextEl.style.transition || ''
                };
                petalTextEl.style.opacity = '0';
                petalTextEl.style.pointerEvents = 'none';

                clone = petalTextEl.cloneNode(true);
                if (clone.hasAttribute && clone.hasAttribute('id')) clone.removeAttribute('id');

                (function removeTransformsRec(n) {
                    if (!n || !n.removeAttribute) return;
                    if (n.hasAttribute && n.hasAttribute('transform')) n.removeAttribute('transform');
                    if (n.hasAttribute && n.hasAttribute('style')) {
                        const s = n.getAttribute('style') || '';
                        const cleaned = s.replace(/transform\s*:\s*[^;]+;?/i, '').trim();
                        if (cleaned) n.setAttribute('style', cleaned); else n.removeAttribute('style');
                    }
                    const children = n.childNodes || [];
                    for (let i = 0; i < children.length; i++) removeTransformsRec(children[i]);
                })(clone);

                try {
                    const cs = window.getComputedStyle ? window.getComputedStyle(petalTextEl) : null;
                    const fill = petalTextEl.getAttribute('fill') || (cs && (cs.fill || cs.color)) || '#222';
                    const fontSize = petalTextEl.getAttribute('font-size') || (cs && cs.fontSize) || null;
                    const fontFamily = petalTextEl.getAttribute('font-family') || (cs && cs.fontFamily) || null;
                    const fontWeight = petalTextEl.getAttribute('font-weight') || (cs && cs.fontWeight) || null;
                    if (fill) clone.setAttribute('fill', fill);
                    if (fontSize) clone.setAttribute('font-size', fontSize);
                    if (fontFamily) clone.setAttribute('font-family', fontFamily);
                    if (fontWeight) clone.setAttribute('font-weight', fontWeight);
                } catch (e) {}

                svgTextGroup = document.createElementNS(overlayNS, 'g');
                svgTextGroup.setAttribute('class', 'morph-text-g');
                svgTextGroup.setAttribute('pointer-events', 'auto');
                svgTextGroup.appendChild(clone);

                try {
                    const prevStyle = clone.getAttribute('style') || '';
                    const forced = `${prevStyle};opacity:1;pointer-events:auto;`;
                    clone.setAttribute('style', forced);
                } catch (e) {}

                try {
                    const origCTM = petalTextEl.getScreenCTM();
                    const overlayCTM = overlay.getScreenCTM();
                    if (origCTM && overlayCTM && typeof overlayCTM.inverse === 'function') {
                        const invOverlay = overlayCTM.inverse();
                        const M = invOverlay.multiply(origCTM);
                        const a = M.a, b = M.b, c = M.c, d = M.d, e = M.e, f = M.f;
                        svgTextGroup.setAttribute('transform', `matrix(${a} ${b} ${c} ${d} ${e} ${f})`);
                    } else {
                        const pr = petalTextEl.getBoundingClientRect();
                        const tx = Math.round(pr.left - overlayLeft);
                        const ty = Math.round(pr.top - overlayTop);
                        svgTextGroup.setAttribute('transform', `translate(${tx}, ${ty})`);
                    }
                } catch (err) {
                    console.warn('morph: failed to compute transform for text clone, fallback to translate', err);
                    const pr = petalTextEl.getBoundingClientRect();
                    const tx = Math.round(pr.left - overlayLeft);
                    const ty = Math.round(pr.top - overlayTop);
                    svgTextGroup.setAttribute('transform', `translate(${tx}, ${ty})`);
                }

                overlay.appendChild(svgTextGroup);

                try {
                    const clonedTextEl = (clone.nodeName && clone.nodeName.toLowerCase() === 'text') ? clone :
                                          (clone.querySelector ? clone.querySelector('text') : null);
                    const measureEl = clonedTextEl || clone;
                    const bbox = (typeof measureEl.getBBox === 'function') ? measureEl.getBBox() : { x: 0, y: 0, width: 0, height: 0 };
                    const pad = Math.max(8, (parseFloat(measureEl.getAttribute('font-size')) || 16) * 0.45);
                    const rx = 6;

                    bgCx = bbox.x + bbox.width / 2;
                    bgCy = bbox.y + bbox.height / 2;

                    bgRect = document.createElementNS(overlayNS, 'rect');
                    bgRect.setAttribute('x', String(bbox.x - pad));
                    bgRect.setAttribute('y', String(bbox.y - pad));
                    bgRect.setAttribute('width', String(bbox.width + pad * 2));
                    bgRect.setAttribute('height', String(bbox.height + pad * 2));
                    bgRect.setAttribute('rx', String(rx));
                    bgRect.setAttribute('ry', String(rx));

                    let cssBg = getComputedStyle(document.documentElement).getPropertyValue('--main-bg') || '#f9f9f6';
                    let cssStroke = getComputedStyle(document.documentElement).getPropertyValue('--main-orange') || '#F7931E';
                    cssBg = cssBg.trim() || '#f9f9f6';
                    cssStroke = cssStroke.trim() || '#F7931E';
                    bgRect.setAttribute('fill', cssBg);
                    bgRect.setAttribute('stroke', cssStroke);
                    bgRect.setAttribute('stroke-width', '3');
                    bgRect.setAttribute('pointer-events', 'none');

                    const isMobileLocal = (overlayW <= 640) || (window.innerWidth <= 640);

                    const initialScale = isMobileLocal ? 1.0 : 0.15;
                    const targetScale  = isMobileLocal ? 1.15 : 1.0;

                    bgRect.setAttribute('transform', `translate(${bgCx} ${bgCy}) scale(${initialScale}) translate(${-bgCx} ${-bgCy})`);
                    bgRect.style.opacity = '0';

                    bgRect.dataset.initialScale = String(initialScale);
                    bgRect.dataset.targetScale = String(targetScale);

                    svgTextGroup.insertBefore(bgRect, clone);
                } catch (err) {
                    console.warn('morph: bgRect creation failed', err);
                    bgRect = null;
                }

                try {
                    const bb = clone.getBBox();
                    const gCTM = svgTextGroup.getCTM();
                    let currentCenterX = (overlayW / 2);
                    let currentCenterY = (bgRect ? (bgRect.getBBox().y + bgRect.getBBox().height / 2) : overlayH / 2);
                    if (bb && gCTM) {
                        const centerLocal = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
                        const mapped = transformPointByMatrix(centerLocal, gCTM);
                        currentCenterX = mapped.x;
                        currentCenterY = mapped.y;
                    } else {
                        try {
                            const rect = svgTextGroup.getBoundingClientRect();
                            currentCenterX = rect.left + rect.width / 2 - overlayLeft;
                            currentCenterY = rect.top + rect.height / 2 - overlayTop;
                        } catch (e) {}
                    }

                    const isPortrait = overlayH > overlayW;
                    const BOX_VERTICAL_RATIO = isPortrait ? 0.14 : 0.25;
                    const bgH = bgRect ? parseFloat(bgRect.getAttribute('height') || '0') : 0;
                    const targetCenterX = Math.round(overlayW / 2);
                    const topPadding = Math.max(8, Math.round(overlayH * (isPortrait ? 0.015 : 0.04)));
                    const computedYByRatio = Math.round(overlayH * BOX_VERTICAL_RATIO);
                    const targetCenterY = Math.max(topPadding + Math.round(bgH / 2), computedYByRatio);


                    const dxTotal = targetCenterX - currentCenterX;
                    const dyTotal = targetCenterY - currentCenterY;

                    let rotDeg = 0;
                    try {
                        const m = svgTextGroup.getCTM();
                        if (m) rotDeg = Math.atan2(m.b, m.a) * 180 / Math.PI;
                    } catch (e) {}

                    if (rotDeg > 180) rotDeg -= 360;
                    if (rotDeg < -180) rotDeg += 360;
                    const neededRotation = -rotDeg;

                    wrapperGroup = document.createElementNS(overlayNS, 'g');
                    wrapperGroup.setAttribute('class', 'morph-text-wrapper');
                    wrapperGroup.setAttribute('pointer-events', 'auto');
                    overlay.appendChild(wrapperGroup);
                    wrapperGroup.appendChild(svgTextGroup);

                    const isMobileLocal = (overlayW <= 640) || (window.innerWidth <= 640);
                        const initialScaleText = isMobileLocal ? 1.0 : 0.15;
                        const targetScaleText  = isMobileLocal ? 1.5 : 1.0;

                        wrapperGroup._anim = {
                            dxTotal, dyTotal, neededRotation,
                            currentCenterX, currentCenterY, targetCenterX, targetCenterY,
                            bgRectBBox: bgRect ? bgRect.getBBox() : null,
                            initialScale: initialScaleText,
                            targetScale: targetScaleText
                        };
                } catch (err) {
                    console.warn('morph: wrapper setup failed', err);
                    if (wrapperGroup && wrapperGroup.parentNode) wrapperGroup.parentNode.removeChild(wrapperGroup);
                    wrapperGroup = null;
                }
            }
        } catch (e) {
            console.warn('morph: svg-text clone failed', e);
            if (svgTextGroup && svgTextGroup.parentNode) svgTextGroup.parentNode.removeChild(svgTextGroup);
            svgTextGroup = null;
        }

        window.dispatchEvent(new CustomEvent('flower:pause'));

        let start = null;
        function stepOpen(ts) {
            if (!start) start = ts;
            const elapsed = ts - start;
            const t = Math.min(1, elapsed / DURATION_MS);
            const et = EASE(t);

            if (t < 1) {
                const interp = interpolatePoints(srcPts, dstPts, et);
                const d = catmullRomToBezierPath(interp, true);
                morphPath.setAttribute('d', d);
            } else {
                const rectD = rectPathString(Math.round(overlayW), Math.round(overlayH), 0);
                morphPath.setAttribute('d', rectD);
            }

            if (bgRect) {
                const bgElapsed = Math.min(BG_ANIM_DURATION_MS, elapsed);
                const bgT = Math.min(1, bgElapsed / BG_ANIM_DURATION_MS);
                const bgEt = EASE(bgT);

                const s0 = parseFloat(bgRect.dataset.initialScale || '0.15');
                const s1 = parseFloat(bgRect.dataset.targetScale  || '1.0');
                const sc = s0 + (s1 - s0) * bgEt;

                bgRect.setAttribute('transform', `translate(${bgCx} ${bgCy}) scale(${sc}) translate(${-bgCx} ${-bgCy})`);
                bgRect.style.opacity = String(Math.min(1, bgEt * 1.05));
            }

            if (wrapperGroup && wrapperGroup._anim) {
                const am = wrapperGroup._anim;
                const moveElapsed = Math.max(0, elapsed - MOVE_DELAY_MS);
                const moveDur = Math.max(1, DURATION_MS - MOVE_DELAY_MS);
                const moveT = Math.min(1, moveElapsed / moveDur);
                const moveEt = EASE(moveT);

                const dxNow = am.dxTotal * moveEt;
                const dyNow = am.dyTotal * moveEt;
                const rotNow = am.neededRotation * moveEt;

                const sNow = (typeof am.initialScale === 'number' ? am.initialScale : 1) +
                            ((typeof am.targetScale === 'number' ? am.targetScale : 1) - (typeof am.initialScale === 'number' ? am.initialScale : 1)) * moveEt;

                const mStr = matrixForTranslateRotateScale(dxNow, dyNow, am.currentCenterX, am.currentCenterY, rotNow, sNow);
                wrapperGroup.setAttribute('transform', mStr);
            }

            if (t < 1) requestAnimationFrame(stepOpen);
        }
        requestAnimationFrame(stepOpen);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'morph-close-btn';
        closeBtn.setAttribute('aria-label', 'Fermer');
        closeBtn.innerHTML = '&#10005;';
        closeBtn.style.top = `${Math.max(8, headerGuess + 8)}px`;
        closeBtn.style.right = '16px';
        closeBtn.style.position = 'fixed';
        closeBtn.style.zIndex = 10010;
        document.body.appendChild(closeBtn);

        setTimeout(() => {
            closeBtn.classList.add('show');
            closeBtn.style.pointerEvents = 'auto';
        }, Math.max(0, DURATION_MS - 120));

        let infoBoxEl = null;
        let infoBoxVisible = false;

        (function scheduleMoveEndHandler() {
            const moveDur = Math.max(1, DURATION_MS - MOVE_DELAY_MS);
            const totalDelay = MOVE_DELAY_MS + moveDur;
            setTimeout(() => {
                try {
                    const textEntry = (PROJECT_TEXTS && PROJECT_TEXTS[idx]) ? PROJECT_TEXTS[idx] : null;
                    const infoHtml = textEntry && (textEntry.text || textEntry.description) ? (textEntry.text || textEntry.description) : '';
                    infoBoxEl = createInfoBoxElement(infoHtml);

                    const anchorX = overlayLeft + Math.round(overlayW / 2);
                    let anchorY;
                    if (wrapperGroup && wrapperGroup._anim) {
                        anchorY = overlayTop + (typeof wrapperGroup._anim.targetCenterY === 'number' ? wrapperGroup._anim.targetCenterY : (overlayH *BOX_VERTICAL_RATIO));
                    } else {
                        anchorY = overlayTop + Math.round(overlayH * BOX_VERTICAL_RATIO);
                    }
                    const bgH = (wrapperGroup && wrapperGroup._anim && wrapperGroup._anim.bgRectBBox) ? wrapperGroup._anim.bgRectBBox.height : 0;
                    const isPortraitLocal = overlayH > overlayW;
                    const offsetY = Math.max(8, Math.round((bgH / 2) + (isPortraitLocal ? 100 : 160)));
                    let topPos = Math.round(anchorY + offsetY);

                    const minTopAllowed = overlayTop + 8;
                    if (topPos < minTopAllowed) topPos = minTopAllowed;

                    const infoBoxHeightEstimate = Math.min(window.innerHeight * 0.45, 420);
                    const overlayViewportBottom = overlayTop + overlayH;
                    if (topPos + infoBoxHeightEstimate > overlayViewportBottom - 20) {
                        topPos = Math.max(overlayTop + Math.round(overlayH * 0.35), overlayViewportBottom - infoBoxHeightEstimate - 20);
                    }

                    const isMobileInfo = (overlayW <= 640) || (window.innerWidth <= 640);
                    if (isMobileInfo) {
                        const sidePad = 16;
                        infoBoxEl.style.left = `${sidePad}px`;
                        infoBoxEl.style.right = `${sidePad}px`;
                        infoBoxEl.style.width = `calc(100% - ${sidePad * 2}px)`;
                        infoBoxEl.style.top = `${Math.round(topPos)}px`;
                        infoBoxEl.style.transform = 'translate(0, 8px)';
                    } else {
                        infoBoxEl.style.left = `${Math.round(anchorX)}px`;
                        infoBoxEl.style.top = `${Math.round(topPos)}px`;
                        infoBoxEl.style.transform = 'translate(-50%, 8px)';
                    }

                    const bottomMargin = 20;
                    const maxHeightPx = Math.max(80, overlayViewportBottom - topPos - bottomMargin);
                    infoBoxEl.style.maxHeight = `${maxHeightPx}px`;
                    infoBoxEl.style.overflowY = 'auto';
                    infoBoxEl.style.boxSizing = 'border-box';

                    infoBoxEl.style.opacity = '0';
                    infoBoxEl.style.pointerEvents = 'auto';
                    infoBoxEl.style.zIndex = 10005;
                    document.body.appendChild(infoBoxEl);

                    infoBoxEl.classList.add('scroll-fix-target');

                    requestAnimationFrame(() => {
                        infoBoxEl.style.transition = `opacity ${INFO_FADE_MS}ms ease, transform ${INFO_FADE_MS}ms cubic-bezier(.22,.9,.31,1)`;
                        infoBoxEl.style.transform = 'translate(-50%, 0)';
                        infoBoxEl.style.opacity = '1';
                        infoBoxVisible = true;
                    });
                } catch (e) {
                    console.warn('morph: move-end handler failed', e);
                }
            }, totalDelay + 20);
        })();

        function animateWrapperReverse() {
            if (!wrapperGroup || !wrapperGroup._anim) return Promise.resolve();
            const am = wrapperGroup._anim;
            const moveDur = Math.max(1, DURATION_MS - MOVE_DELAY_MS);
            return animate(moveDur, (tt) => {
                const et = EASE(tt);
                const rev = 1 - et;
                const dxNow = am.dxTotal * rev;
                const dyNow = am.dyTotal * rev;
                const rotNow = am.neededRotation * rev;

                const sNow = (typeof am.initialScale === 'number' ? am.initialScale : 1) +
                            ((typeof am.targetScale === 'number' ? am.targetScale : 1) - (typeof am.initialScale === 'number' ? am.initialScale : 1)) * rev;

                const m = matrixForTranslateRotateScale(dxNow, dyNow, am.currentCenterX, am.currentCenterY, rotNow, sNow);
                wrapperGroup.setAttribute('transform', m);
            });
        }

        function animateMorphReverse(duration) {
            return animate(duration, (tt) => {
                const et = EASE(tt);
                const interp = interpolatePoints(dstPts, srcPts, et);
                const d = catmullRomToBezierPath(interp, true);
                morphPath.setAttribute('d', d);
            });
        }

        function animateBgShrink() {
            if (!bgRect) return Promise.resolve();
            const s0 = parseFloat(bgRect.dataset.initialScale || '0.15');
            const s1 = parseFloat(bgRect.dataset.targetScale  || '1.0');
            return animate(BG_ANIM_DURATION_MS, (tt) => {
                const et = EASE(tt);
                const s = s1 + (s0 - s1) * et;
                bgRect.setAttribute('transform', `translate(${bgCx} ${bgCy}) scale(${s}) translate(${-bgCx} ${-bgCy})`);
                bgRect.style.opacity = String(Math.max(0, 1 - et * 1.05));
            });
        }


        let closing = false;
        function close() {
            if (closing) return;
            closing = true;

            closeBtn.classList.remove('show');
            closeBtn.style.pointerEvents = 'none';

            function hideInfoBoxIfAny() {
                return new Promise((resolve) => {
                    if (!infoBoxEl || !infoBoxVisible) return resolve();
                    infoBoxEl.style.transition = `opacity ${INFO_FADE_MS}ms ease, transform ${INFO_FADE_MS}ms cubic-bezier(.22,.9,.31,1)`;
                    infoBoxEl.style.transform = 'translate(-50%, 6px)';
                    infoBoxEl.style.opacity = '0';
                    setTimeout(() => {
                        try { if (infoBoxEl.parentNode) infoBoxEl.parentNode.removeChild(infoBoxEl); } catch (e) {}
                        infoBoxVisible = false;
                        infoBoxEl = null;
                    }, INFO_FADE_MS + 8);
                    setTimeout(resolve, INFO_FADE_MS + 20);
                });
            }

            hideInfoBoxIfAny().then(() => {
                const morphPromise = animateMorphReverse(DURATION_MS);
                const wrapperPromise = animateWrapperReverse();

                const shrinkAfterWrapper = wrapperPromise.then(() => {
                    if (bgRect && bgRect.parentNode) {
                        return animateBgShrink().then(() => {
                            try { if (bgRect.parentNode) bgRect.parentNode.removeChild(bgRect); } catch (e) {}
                        });
                    }
                    return Promise.resolve();
                });

                return Promise.all([morphPromise, shrinkAfterWrapper]);
            }).then(() => {
                try {
                    if (petalTextEl) {
                        const prevTrans = petalTextEl.style.transition || '';
                        petalTextEl.style.transition = 'none';
                        petalTextEl.style.opacity = originalPetalTextStyle.opacity || '1';
                        petalTextEl.style.pointerEvents = originalPetalTextStyle.pointerEvents || '';
                        void petalTextEl.getBoundingClientRect();
                        setTimeout(() => {
                            try { petalTextEl.style.transition = prevTrans; } catch (e) {}
                        }, 40);
                    }
                } catch (e) {}

                try { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch (e) {}
                try { if (closeBtn.parentNode) closeBtn.parentNode.removeChild(closeBtn); } catch (e) {}

                try { if (svgTextGroup && svgTextGroup.parentNode) svgTextGroup.parentNode.removeChild(svgTextGroup); } catch (e) {}

                window.dispatchEvent(new CustomEvent('flower:resume'));
            }).catch((err) => {
                console.warn('morph: close parallel sequence error', err);
                try { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch (e) {}
                try { if (closeBtn.parentNode) closeBtn.parentNode.removeChild(closeBtn); } catch (e) {}
                if (petalTextEl) {
                    petalTextEl.style.opacity = originalPetalTextStyle.opacity || '';
                    petalTextEl.style.pointerEvents = originalPetalTextStyle.pointerEvents || '';
                }
                window.dispatchEvent(new CustomEvent('flower:resume'));
            });
        }

        function onKey(e) {
            if (e.key === 'Escape') {
                close();
                window.removeEventListener('keydown', onKey);
            }
        }
        closeBtn.addEventListener('click', close);
        window.addEventListener('keydown', onKey);

        overlay.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    }

    function bindPetalZones() {
        const svgRoot = document.querySelector('svg');
        if (!svgRoot) return;
        const zones = svgRoot.querySelectorAll('use.petal-zone');
        zones.forEach((z, i) => {
            z.addEventListener('pointerdown', (ev) => {
                try {
                    ev.stopPropagation();
                    let imgSrc = null;
                    try { if (window.PROJET_IMAGES && window.PROJET_IMAGES[i]) imgSrc = window.PROJET_IMAGES[i]; } catch (e) {}
                    if (!imgSrc) imgSrc = z.getAttribute('data-img') || (PROJECT_TEXTS && PROJECT_TEXTS[i] && PROJECT_TEXTS[i].image) || '';
                    morphOpenFromZone(z, imgSrc || '');
                } catch (err) {
                    console.warn('morph: error on zone pointerdown', err);
                }
            }, { passive: true });
        });
    }

    window.projet_morph_bind = bindPetalZones;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindPetalZones);
    } else {
        bindPetalZones();
    }

})();
