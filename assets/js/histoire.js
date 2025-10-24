document.addEventListener('DOMContentLoaded', () => {
    const timeline = document.getElementById('timeline');
    if (!timeline) return;
    const years = Array.from(timeline.querySelectorAll('.year'));
    const header = document.getElementById('header') || { getBoundingClientRect: () => ({ bottom: 0 }) };

    (function arrival() {
        if (!years.length) return;
        const raw = getComputedStyle(document.documentElement).getPropertyValue('--fade-dur') || '1.1s';
        const fadeMs = raw.endsWith('ms') ? parseFloat(raw) : parseFloat(raw) * 1000;
        const STAGGER = 140;
        years.forEach(y => y.classList.add('faded'));
        timeline.classList.add('no-hover');
        years.forEach((y, i) => setTimeout(() => y.classList.remove('faded'), i * STAGGER));
        setTimeout(() => timeline.classList.remove('no-hover'), (years.length - 1) * STAGGER + (fadeMs || 1100) + 60);
    })();

    const ANIM_MS = 1250;
    const POST_ANIM_BUFFER = 60;
    const GAP_BEFORE_BOX = 50;
    const BOTTOM_MARGIN = 50;
    const EXTRA_LEFT_OFFSET = 0;
    const minBoxWidth = 120;
    const GRID_GAP = 40;
    const TARGET_PAD_CM = 5.9;
    const PX_PER_CM = 96 / 2.54;
    const TARGET_PAD_PX = Math.round(TARGET_PAD_CM * PX_PER_CM);
    const REFERENCE_SELECTOR = '.galerie';
    const DATE_JSON_PATH = '../assets/img/histoire/dates.json';

    function isAbsolutePath(p) { return typeof p === 'string' && (p.startsWith('/') || p.startsWith('http://') || p.startsWith('https://')); }

    let _dateJsonCache = null;
    function loadDateJson() {
        if (_dateJsonCache) return Promise.resolve(_dateJsonCache);
        return fetch(DATE_JSON_PATH, { cache: 'no-cache' })
            .then(res => { if (!res.ok) throw new Error('failed to load dates.json'); return res.json(); })
            .then(j => { _dateJsonCache = j || {}; return _dateJsonCache; })
            .catch(() => { _dateJsonCache = {}; return _dateJsonCache; });
    }

    function preloadImagesFromDateJson() {
        loadDateJson().then(dateJson => {
            const all = [];
            Object.values(dateJson || {}).forEach(entry => {
                if (!entry || !Array.isArray(entry.images)) return;
                entry.images.forEach(s => { if (s) all.push(`../assets/img/histoire/${String(s).replace(/^\/+/, '')}`); });
            });
            const unique = Array.from(new Set(all));
            if (!unique.length) return;
            const doPreload = () => unique.forEach(src => { try { const i = new Image(); i.decoding = 'async'; i.src = src; } catch(e){} });
            if ('requestIdleCallback' in window) requestIdleCallback(doPreload, { timeout: 2000 }); else setTimeout(doPreload, 400);
        }).catch(() => {});
    }
    preloadImagesFromDateJson();

    function measureNaturalSize(el) {
        const clone = el.cloneNode(true);
        clone.style.position = 'absolute';
        clone.style.left = '-9999px';
        clone.style.top = '-9999px';
        clone.style.width = 'auto';
        clone.style.height = 'auto';
        clone.style.opacity = '0';
        clone.style.pointerEvents = 'none';
        clone.style.transform = 'none';
        document.body.appendChild(clone);
        const w = Math.ceil(clone.scrollWidth + 0);
        const h = Math.ceil(clone.scrollHeight + 0);
        document.body.removeChild(clone);
        return { w, h };
    }

    function readCssVarPx(varName, relativeTo = document.documentElement) {
        const raw = getComputedStyle(relativeTo).getPropertyValue(varName).trim();
        if (!raw) return null;
        if (raw.endsWith('px')) return parseFloat(raw);
        if (raw.endsWith('%')) return (parseFloat(raw) / 100) * (relativeTo.clientWidth || window.innerWidth);
        const num = parseFloat(raw);
        return isNaN(num) ? null : num;
    }

    function getVisualGuttersFromReference(selector) {
        const ref = document.querySelector(selector);
        if (!ref) return null;
        const rRect = ref.getBoundingClientRect();
        const rStyle = getComputedStyle(ref);
        const padLeft = parseFloat(rStyle.paddingLeft) || 0;
        const padRight = parseFloat(rStyle.paddingRight) || 0;
        const leftContent = Math.round(rRect.left + padLeft);
        const rightContent = Math.round(rRect.left + rRect.width - padRight);
        const leftGutter = leftContent;
        const rightGutter = Math.round(window.innerWidth - rightContent);
        return {
            leftGutterPx: leftGutter,
            rightGutterPx: rightGutter,
            contentWidthPx: Math.max(0, rightContent - leftContent),
            refRect: rRect
        };
    }

    function populateImageCell(cell, src, alt, galleryImagesForDate, galleryIndex) {
        cell.textContent = '';
        cell.classList.add('img-bleed');
        cell.style.padding = '0';
        cell.style.overflow = 'hidden';
        const finalSrc = isAbsolutePath(src) ? src : `../assets/img/histoire/${String(src).replace(/^\/+/, '')}`;
        const img = document.createElement('img');
        img.alt = alt || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.display = 'block';
        img.src = finalSrc;
        img.style.borderRadius = 'inherit';
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!Array.isArray(galleryImagesForDate) || galleryImagesForDate.length === 0) return;
            const galleryFullPaths = galleryImagesForDate.map(s => isAbsolutePath(s) ? s : `../assets/img/histoire/${String(s).replace(/^\/+/, '')}`);
            if (window.GalleryOverlay && typeof window.GalleryOverlay.open === 'function') {
                window.GalleryOverlay.open(Math.max(0, Math.min(galleryIndex || 0, galleryFullPaths.length - 1)), galleryFullPaths, { enableScroll: false });
            }
        });
        cell.appendChild(img);
    }

    function populateTextCell(cell, textHtml, fallbackHtml, mobileTextBoxMaxHeightPx) {
        cell.textContent = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'overlay-text scroll-fix-target';
        wrapper.innerHTML = (textHtml !== undefined && textHtml !== null) ? textHtml : (fallbackHtml || '');
        wrapper.style.lineHeight = '1.4';
        wrapper.style.padding = '8px';
        wrapper.setAttribute('tabindex', '0');
        wrapper.style.boxSizing = 'border-box';

        if (mobileTextBoxMaxHeightPx) {
            wrapper.style.maxHeight = `${mobileTextBoxMaxHeightPx}px`;
            wrapper.style.overflow = 'auto';
        } else {
            wrapper.style.maxHeight = '100%';
            wrapper.style.overflow = 'auto';
        }
        cell.appendChild(wrapper);
    }


    let lock = false;
    let activeState = null;

    years.forEach(year => {
        const chevron = year.querySelector('.chevron');
        const content = year.querySelector('.year-content');
        if (!chevron || !content) return;

        chevron.addEventListener('click', activate);
        chevron.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                activate();
            }
        });

        function activate() {
            if (lock) return;
            const isMobile = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
            lock = true;
            const animationTimers = [];
            function clearAnimationTimers() { animationTimers.forEach(id => clearTimeout(id)); animationTimers.length = 0; }

            timeline.classList.add('no-hover');
            years.forEach(y => { if (y !== year) y.classList.add('faded'); });

            const chevRect = chevron.getBoundingClientRect();
            const contentRect = content.getBoundingClientRect();
            const headerRect = header.getBoundingClientRect();

            activeState = {
                year, chevron, content,
                chevRect: { left: chevRect.left, top: chevRect.top, width: chevRect.width, height: chevRect.height },
                contentRect: { left: contentRect.left, top: contentRect.top, width: contentRect.width, height: contentRect.height }
            };

            const placeholder = document.createElement('div');
            placeholder.className = 'chevron-placeholder';
            placeholder.style.width = `${chevRect.width}px`;
            placeholder.style.height = `${chevRect.height}px`;
            year.insertBefore(placeholder, chevron);

            chevron.classList.add('active', 'fixed');
            chevron.style.left = `${chevRect.left}px`;
            chevron.style.top = `${chevRect.top}px`;
            chevron.style.width = `${chevRect.width}px`;
            chevron.style.height = `${chevRect.height}px`;
            chevron.style.margin = '0';
            chevron.style.transform = 'none';

            const clone = content.cloneNode(true);
            clone.classList.add('timeline-clone', 'no-arrow');
            clone.style.position = 'fixed';
            clone.style.left = `${contentRect.left}px`;
            clone.style.top = `${contentRect.top}px`;
            clone.style.width = `${contentRect.width}px`;
            clone.style.height = `${contentRect.height}px`;
            clone.style.margin = '0';
            clone.style.zIndex = '1195';
            clone.style.boxSizing = 'border-box';
            clone.style.overflow = 'hidden';
            clone.style.transition = `left ${ANIM_MS}ms cubic-bezier(.22,.9,.31,1), top ${ANIM_MS}ms cubic-bezier(.22,.9,.31,1), width ${ANIM_MS}ms cubic-bezier(.22,.9,.31,1), height ${ANIM_MS}ms cubic-bezier(.22,.9,.31,1), opacity 260ms ease, transform 260ms ease`;
            clone.style.transform = 'none';
            clone.style.pointerEvents = 'none';
            clone.style.opacity = '1';
            document.body.appendChild(clone);

            if (isMobile) {
                content.style.display = 'none';
            } else {
                content.style.visibility = 'hidden';
                content.style.pointerEvents = 'none';
            }

            const prev = document.querySelector('.timeline-overlay');
            if (prev && prev.parentElement) prev.parentElement.removeChild(prev);

            const overlayNode = document.createElement('div');
            overlayNode.className = 'timeline-overlay';
            document.body.appendChild(overlayNode);

            const wrapper = document.createElement('div');
            wrapper.className = 'overlay-wrapper';
            overlayNode.appendChild(wrapper);

            const area = document.createElement('div');
            area.className = 'overlay-area';
            area.style.top = `0px`;
            area.style.height = `100%`;
            wrapper.appendChild(area);

            const prevOverflow = document.body.style.overflow || '';
            document.body.style.overflow = 'hidden';

            const refGutters = getVisualGuttersFromReference(REFERENCE_SELECTOR);
            const wrapperClientW = wrapper.clientWidth;
            const wrapperStyle = getComputedStyle(wrapper);
            const wrapperPadLeft = parseFloat(wrapperStyle.paddingLeft) || 0;
            const wrapperPadRight = parseFloat(wrapperStyle.paddingRight) || 0;

            let pad = 0;
            if (refGutters) {
                pad = Math.max(0, refGutters.leftGutterPx - wrapper.getBoundingClientRect().left);
                const innerW = Math.max(0, wrapperClientW - wrapperPadLeft - wrapperPadRight);
                const clampMax = Math.max(0, (innerW - chevRect.width) / 2);
                pad = Math.min(pad, clampMax);
            } else {
                const cssGutterPx = readCssVarPx('--page-gutter', document.documentElement) || (wrapperClientW * 0.1);
                const innerW = Math.max(0, wrapperClientW - wrapperPadLeft - wrapperPadRight);
                const measuredPad = Math.max((innerW - chevRect.width) / 2, 0);
                pad = Math.min(measuredPad, TARGET_PAD_PX, cssGutterPx);
                if (measuredPad < TARGET_PAD_PX) pad = measuredPad;
            }

            const areaPadLeft = Math.max(0, Math.round(pad - wrapperPadLeft));
            const areaPadRight = Math.max(0, Math.round(pad - wrapperPadRight));
            area.style.paddingLeft = `${areaPadLeft}px`;
            area.style.paddingRight = `${areaPadRight}px`;

            const natural = measureNaturalSize(content);
            let desiredWidth = Math.max(minBoxWidth, Math.min(window.innerWidth - pad * 2 - 40, natural.w + 24));
            const desiredHeight = Math.max(Math.round(natural.h), 28);

            const wrapperRect = wrapper.getBoundingClientRect();
            const finalTop = headerRect.bottom + 40;

            let finalLeft = Math.max(8, wrapperRect.left + pad + EXTRA_LEFT_OFFSET);
            if (isMobile) {
                finalLeft = Math.round((window.innerWidth - chevRect.width) / 2);
            }

            const cloneTop = finalTop + Math.round((chevRect.height / 2) - (desiredHeight / 2));

            let areaLeftViewport, areaWidth;
            if (refGutters) {
                areaLeftViewport = Math.max(8, refGutters.leftGutterPx);
                areaWidth = Math.max(minBoxWidth, Math.round(Math.max(0, window.innerWidth - 2 * refGutters.leftGutterPx)));
            } else {
                areaLeftViewport = Math.max(8, wrapperRect.left + pad);
                areaWidth = Math.max(minBoxWidth, Math.round(Math.max(0, window.innerWidth - 2 * areaLeftViewport)));
            }

            if (isMobile) {
                areaLeftViewport = 8;
                areaWidth = Math.max(minBoxWidth, window.innerWidth - 16);
            }

            const maxCloneWidth = Math.max(minBoxWidth, areaWidth - 24);
            if (desiredWidth > maxCloneWidth) desiredWidth = maxCloneWidth;

            const areaRightViewport = areaLeftViewport + areaWidth;
            const cloneLeft = Math.max(8, Math.round(areaRightViewport - desiredWidth));

            const areaTopViewport = finalTop + chevRect.height + GAP_BEFORE_BOX;
            const areaHeight = Math.max(120, window.innerHeight - areaTopViewport - BOTTOM_MARGIN);

            const gridContainer = document.createElement('div');
            gridContainer.className = 'overlay-grid-container';
            gridContainer.style.position = 'fixed';
            gridContainer.style.left = `${areaLeftViewport}px`;
            gridContainer.style.top = `${areaTopViewport}px`;
            gridContainer.style.width = `${areaWidth}px`;
            gridContainer.style.height = `${areaHeight}px`;
            gridContainer.style.boxSizing = 'border-box';
            gridContainer.style.pointerEvents = 'auto';
            gridContainer.style.display = 'grid';
            gridContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
            gridContainer.style.gridTemplateRows = 'repeat(2, 1fr)';
            gridContainer.style.gap = `${GRID_GAP}px`;
            gridContainer.style.padding = '0';
            gridContainer.style.alignItems = 'stretch';
            gridContainer.style.justifyItems = 'stretch';
            gridContainer.style.opacity = '0';
            gridContainer.style.transform = 'translateY(10px)';
            gridContainer.style.transition = 'opacity 360ms ease, transform 360ms cubic-bezier(.22,.9,.31,1)';
            overlayNode.appendChild(gridContainer);

            const cellBorder = '2px solid var(--main-orange)';
            const cellRadius = '6px';
            function makeCell(gridColumn, gridRow) {
                const cell = document.createElement('div');
                cell.className = 'overlay-cell';
                cell.style.boxSizing = 'border-box';
                cell.style.border = cellBorder;
                cell.style.borderRadius = cellRadius;
                cell.style.background = '#fff';
                cell.style.display = 'flex';
                cell.style.alignItems = 'center';
                cell.style.justifyContent = 'center';
                cell.style.padding = '12px';
                cell.style.paddingInlineEnd = '12px';
                cell.style.color = 'var(--main-brown, #7B2D2D)';
                cell.style.fontSize = '16px';
                cell.style.opacity = '0';
                cell.style.transform = 'translateY(8px)';
                cell.style.transition = 'opacity 320ms ease, transform 260ms cubic-bezier(.22,.9,.31,1)';
                cell.style.overflow = 'hidden';
                if (gridColumn) cell.style.gridColumn = gridColumn;
                if (gridRow) cell.style.gridRow = gridRow;
                return cell;
            }

            const cellA = makeCell('1', '1');
            gridContainer.appendChild(cellA);
            const cellB = makeCell('2', '1');
            gridContainer.appendChild(cellB);
            const cellC = makeCell('1 / span 2', '2');
            gridContainer.appendChild(cellC);
            const cellD = makeCell('3', '1 / span 2');
            gridContainer.appendChild(cellD);

            if (isMobile) {
                chevron.style.left = `${finalLeft}px`;
                chevron.style.top = `${finalTop}px`;

                gridContainer.style.left = `${areaLeftViewport}px`;
                gridContainer.style.width = `${areaWidth}px`;
                gridContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
                gridContainer.style.gridTemplateRows = 'auto 1fr';
                gridContainer.style.gap = '8px';
                gridContainer.style.padding = '8px';
                gridContainer.style.height = `${areaHeight}px`;
                gridContainer.style.overflow = 'hidden';

                cellB.style.gridColumn = '1 / span 3';
                cellB.style.gridRow = '1';

                cellA.style.gridColumn = '1';
                cellA.style.gridRow = '2';
                cellC.style.gridColumn = '2';
                cellC.style.gridRow = '2';
                cellD.style.gridColumn = '3';
                cellD.style.gridRow = '2';

                [cellA, cellC, cellD].forEach(c => {
                    c.style.alignSelf = 'stretch';
                    c.style.height = '100%';
                    c.style.display = 'flex';
                    c.style.flexDirection = 'column';
                });

                cellB.style.padding = '8px';
                cellB.style.overflow = 'hidden';

                const viewportAvail = Math.max(120, window.innerHeight - (finalTop + chevRect.height + GAP_BEFORE_BOX) - BOTTOM_MARGIN);
                const textBoxMax = Math.round(viewportAvail * 0.45);
                cellB._mobileTextBoxMax = textBoxMax;

                desiredWidth = Math.max(minBoxWidth, Math.round(areaWidth - 24));
                const newCloneLeft = Math.max(8, Math.round(areaLeftViewport + (areaWidth - desiredWidth) / 2));
                clone.style.left = `${newCloneLeft}px`;
                clone.style.top = `${cloneTop}px`;
                clone.style.width = `${desiredWidth}px`;
            }

            function createCloseButton() {
                let btn = document.querySelector('.timeline-close');
                if (btn) return btn;
                btn = document.createElement('button');
                btn.className = 'timeline-close';
                btn.setAttribute('aria-label', 'Fermer la timeline');
                btn.innerHTML = '&#10005;';
                document.body.appendChild(btn);
                return btn;
            }
            const closeBtn = createCloseButton();
            const headerRectForClose = header.getBoundingClientRect();
            const topClose = Math.max(8, headerRectForClose.bottom + 12);
            closeBtn.style.top = `${topClose}px`;
            closeBtn.style.right = '12px';
            closeBtn.classList.remove('show');
            closeBtn.style.pointerEvents = 'none';
            closeBtn.disabled = true;
            closeBtn._prevOverflow = prevOverflow;
            closeBtn._removeOverflow = () => { document.body.style.overflow = closeBtn._prevOverflow || ''; };

            const dataKey = (year.dataset.dateKey && year.dataset.dateKey.trim()) ||
                            (year.querySelector('.year-number') && year.querySelector('.year-number').textContent.trim()) ||
                            null;
            const originalContentHtml = content.innerHTML;

            loadDateJson().then(dateJson => {
                const entry = (dataKey && dateJson[dataKey]) ? dateJson[dataKey] : null;
                if (!entry || !Array.isArray(entry.images)) {
                    if (entry && (entry.text || entry.description)) {
                        if (isMobile && cellB._mobileTextBoxMax) {
                            populateTextCell(cellB, entry.text || entry.description, originalContentHtml, cellB._mobileTextBoxMax);
                        } else {
                            populateTextCell(cellB, entry.text || entry.description, originalContentHtml);
                        }
                    } else {
                        if (isMobile && cellB._mobileTextBoxMax) {
                            populateTextCell(cellB, originalContentHtml, originalContentHtml, cellB._mobileTextBoxMax);
                        } else {
                            populateTextCell(cellB, originalContentHtml, originalContentHtml);
                        }
                    }
                    return;
                }
                const images = entry.images.slice(0, 3);

                if (isMobile && cellB._mobileTextBoxMax) {
                    populateTextCell(cellB, entry.text || originalContentHtml, originalContentHtml, cellB._mobileTextBoxMax);
                } else {
                    populateTextCell(cellB, entry.text || originalContentHtml, originalContentHtml);
                }

                if (images[0]) populateImageCell(cellA, images[0], `${dataKey||''} - 1`, images, 0);
                if (images[1]) populateImageCell(cellC, images[1], `${dataKey||''} - 2`, images, 1);
                if (images[2]) populateImageCell(cellD, images[2], `${dataKey||''} - 3`, images, 2);
            }).catch(() => {
                if (isMobile && cellB._mobileTextBoxMax) {
                    populateTextCell(cellB, originalContentHtml, originalContentHtml, cellB._mobileTextBoxMax);
                } else {
                    populateTextCell(cellB, originalContentHtml, originalContentHtml);
                }
            });

            requestAnimationFrame(() => {
                chevron.style.left = `${finalLeft}px`;
                chevron.style.top = `${finalTop}px`;
                clone.style.left = `${cloneLeft}px`;
                clone.style.top = `${cloneTop}px`;
                clone.style.width = `${desiredWidth}px`;
                clone.style.height = `${desiredHeight}px`;
                clone.style.opacity = '1';
            });

            const PHASE_A_DELAY = ANIM_MS + 60;
            const phaseA_T = setTimeout(() => {
                closeBtn.classList.add('show');
                closeBtn.style.pointerEvents = 'auto';
                closeBtn.disabled = false;
                gridContainer.style.opacity = '1';
                gridContainer.style.transform = 'translateY(0)';
                chevron.classList.add('fade-hover');
                const cellDelay = 180;
                const reveal = (cell, delay) => animationTimers.push(setTimeout(() => { cell.style.opacity = '1'; cell.style.transform = 'translateY(0)'; }, delay));
                if (isMobile) {
                    reveal(cellB, 0);
                    reveal(cellA, cellDelay);
                    reveal(cellC, cellDelay * 2);
                    reveal(cellD, cellDelay * 3);
                } else {
                    reveal(cellA, 0);
                    reveal(cellB, cellDelay);
                    reveal(cellC, cellDelay * 2);
                    reveal(cellD, cellDelay * 3);
                }
                animationTimers.push(setTimeout(() => {}, cellDelay * 3 + 300));
            }, PHASE_A_DELAY);
            animationTimers.push(phaseA_T);

            const onClose = () => {
                if (!activeState) return;

                if (gridContainer) gridContainer.style.pointerEvents = 'none';
                if (timeline) {
                    timeline.classList.add('no-hover');
                    Array.from(timeline.querySelectorAll('.chevron, .year')).forEach(el => el.style.pointerEvents = 'none');
                }
                document.body.dataset.overlayClosing = '1';

                chevron.classList.remove('fade-hover');
                animationTimers.forEach(id => clearTimeout(id));

                closeBtn.removeEventListener('click', onClose);
                if (closeBtn._removeOverflow) closeBtn._removeOverflow();

                closeBtn.classList.remove('show');
                closeBtn.style.pointerEvents = 'none';

                gridContainer.style.opacity = '0';
                gridContainer.style.transform = 'translateY(10px)';
                clone.style.opacity = '0';
                clone.style.transform = 'translateY(8px)';

                chevron.style.left = `${activeState.chevRect.left}px`;
                chevron.style.top  = `${activeState.chevRect.top}px`;

                setTimeout(() => { years.forEach(y => { if (y !== activeState.year) y.classList.remove('faded'); }); }, 80);

                setTimeout(() => {
                    chevron.classList.remove('active', 'fixed', 'fade-hover');
                    chevron.style.left = '';
                    chevron.style.top = '';
                    chevron.style.width = '';
                    chevron.style.height = '';
                    chevron.style.margin = '';
                    chevron.style.transform = '';

                    if (clone && clone.parentElement) clone.parentElement.removeChild(clone);
                    if (isMobile) {
                        content.style.display = '';
                    } else {
                        content.style.visibility = '';
                        content.style.pointerEvents = '';
                    }

                    const ph = year.querySelector('.chevron-placeholder');
                    if (ph && ph.parentElement) ph.parentElement.removeChild(ph);

                    if (gridContainer && gridContainer.parentElement) gridContainer.parentElement.removeChild(gridContainer);
                    if (overlayNode && overlayNode.parentElement) overlayNode.parentElement.removeChild(overlayNode);
                    if (closeBtn && closeBtn.parentElement) closeBtn.parentElement.removeChild(closeBtn);

                    timeline.classList.remove('no-hover');
                    delete document.body.dataset.overlayClosing;
                    if (timeline) Array.from(timeline.querySelectorAll('.chevron, .year')).forEach(el => el.style.pointerEvents = '');
                    activeState = null;
                    lock = false;
                }, ANIM_MS + POST_ANIM_BUFFER);
            };

            closeBtn.addEventListener('click', onClose);

            const onResize = () => {
                if (!activeState) return;
                const newWrapperClientW = wrapper.clientWidth;
                const newWrapperStyle = getComputedStyle(wrapper);
                const newWrapperPadLeft = parseFloat(newWrapperStyle.paddingLeft) || 0;
                const newWrapperPadRight = parseFloat(newWrapperStyle.paddingRight) || 0;
                const newInnerW = Math.max(0, newWrapperClientW - newWrapperPadLeft - newWrapperPadRight);

                let newPad = 0;
                const newRef = getVisualGuttersFromReference(REFERENCE_SELECTOR);
                if (newRef) {
                    newPad = Math.max(0, newRef.leftGutterPx - wrapper.getBoundingClientRect().left);
                    const clampMax = Math.max(0, (newInnerW - chevRect.width) / 2);
                    newPad = Math.min(newPad, clampMax);
                } else {
                    const cssGutterPx = readCssVarPx('--page-gutter', document.documentElement) || (newWrapperClientW * 0.1);
                    const measuredPad = Math.max((newInnerW - chevRect.width) / 2, 0);
                    newPad = Math.min(measuredPad, TARGET_PAD_PX, cssGutterPx);
                    if (measuredPad < TARGET_PAD_PX) newPad = measuredPad;
                }

                const areaPadLeftNew = Math.max(0, Math.round(newPad - newWrapperPadLeft));
                const areaPadRightNew = Math.max(0, Math.round(newPad - newWrapperPadRight));
                area.style.paddingLeft = `${areaPadLeftNew}px`;
                area.style.paddingRight = `${areaPadRightNew}px`;

                const newWrapperRect = wrapper.getBoundingClientRect();
                let newFinalLeft = Math.max(8, newWrapperRect.left + newPad + EXTRA_LEFT_OFFSET);
                if (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) {
                    newFinalLeft = Math.round((window.innerWidth - chevRect.width) / 2);
                }
                chevron.style.left = `${newFinalLeft}px`;

                let newAreaLeft, newAreaWidth;
                const newRef2 = getVisualGuttersFromReference(REFERENCE_SELECTOR);
                if (newRef2) {
                    newAreaLeft = Math.max(8, newRef2.leftGutterPx);
                    newAreaWidth = Math.max(minBoxWidth, Math.round(Math.max(0, window.innerWidth - 2 * newRef2.leftGutterPx)));
                } else {
                    newAreaLeft = Math.max(8, newWrapperRect.left + newPad);
                    newAreaWidth = Math.max(minBoxWidth, Math.round(Math.max(0, window.innerWidth - 2 * newAreaLeft)));
                }

                if (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) {
                    newAreaLeft = 8;
                    newAreaWidth = Math.max(minBoxWidth, window.innerWidth - 16);
                }

                const newAreaTop = finalTop + chevRect.height + GAP_BEFORE_BOX;
                const newAreaHeight = Math.max(120, window.innerHeight - newAreaTop - BOTTOM_MARGIN);

                if (gridContainer) {
                    gridContainer.style.left = `${newAreaLeft}px`;
                    gridContainer.style.top = `${newAreaTop}px`;
                    gridContainer.style.width = `${newAreaWidth}px`;
                    gridContainer.style.height = `${newAreaHeight}px`;
                }

                const newMaxCloneWidth = Math.max(minBoxWidth, newAreaWidth - 24);
                if (desiredWidth > newMaxCloneWidth) desiredWidth = newMaxCloneWidth;
                const newAreaRight = newAreaLeft + newAreaWidth;
                const newCloneLeft = Math.max(8, Math.round(newAreaRight - desiredWidth));
                clone.style.left = `${newCloneLeft}px`;
                clone.style.width = `${desiredWidth}px`;
            };

            window.addEventListener('resize', onResize);
            closeBtn._removeResize = () => window.removeEventListener('resize', onResize);
            closeBtn.addEventListener('click', () => {
                if (closeBtn._removeResize) closeBtn._removeResize();
                animationTimers.forEach(id => clearTimeout(id));
            }, { once: true });
        }
    });
});
