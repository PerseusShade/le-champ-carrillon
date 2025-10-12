(() => {
    'use strict';

    let INITIAL_HEADER_HEIGHT_PX = null;
    const STATE = { overlayMoved: false, escapeBound: false };
    let PREV_HEADER_HEIGHT = null;

    const $ = sel => document.querySelector(sel);
    const $$ = sel => Array.from(document.querySelectorAll(sel));
    const nearestHeader = (placeholder = null) => {
        if (placeholder) return placeholder.querySelector('header.site-header') || placeholder.firstElementChild || placeholder;
        return document.querySelector('header.site-header') || document.getElementById('header') || document.body;
    };

    const readInitialCSSHeader = () => {
        if (INITIAL_HEADER_HEIGHT_PX !== null) return;
        const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '';
        const v = parseFloat(raw);
        INITIAL_HEADER_HEIGHT_PX = Number.isFinite(v) ? Math.round(v) : null;
    };

    function updateHeaderHeight(headerEl) {
        try {
            if (document.documentElement.classList.contains('position-compact')) {
                document.documentElement.style.setProperty('--header-height', '0px');
                return;
            }
        } catch (e) {}

        const header = headerEl || nearestHeader();
        if (!header) return;
        const rect = header.getBoundingClientRect();
        const st = getComputedStyle(header);
        const measured = Math.round(Math.max(0, rect.height - (parseFloat(st.borderTopWidth)||0) - (parseFloat(st.borderBottomWidth)||0)));
        const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
        let newVal = measured;

        if (INITIAL_HEADER_HEIGHT_PX !== null) {
            newVal = Math.max(INITIAL_HEADER_HEIGHT_PX, measured);
        }

        if (Math.abs(newVal - current) >= 1) {
            document.documentElement.style.setProperty('--header-height', `${newVal}px`);
        }
    }

    function markActivePage(container) {
        const normalize = p => {
            if (!p) return '/';
            try {
                let s = new URL(p, document.baseURI).pathname;
                s = s.replace(/\/index\.html$/i, '').replace(/\/+$/, '') || '/';
                return s;
            } catch { return (p+'').replace(/\/index\.html$/i,'').replace(/\/+$/,'') || '/'; }
        };
        const cur = normalize(window.location.pathname);
        const links = container.querySelectorAll('.main-nav a');
        links.forEach(a => {
            const lp = normalize(a.getAttribute('href')||'');
            if (lp === cur) { a.classList.add('active'); a.setAttribute('aria-current','page'); a.setAttribute('tabindex','-1'); }
            else { a.classList.remove('active'); a.removeAttribute('aria-current'); a.removeAttribute('tabindex'); }
        });
        const btn = container.querySelector('.btn-contact');
        if (btn) {
            const bh = btn.getAttribute('href') || '/pages/contact.html';
            if (normalize(bh) === cur) { btn.classList.add('active'); btn.setAttribute('aria-current','page'); }
            else { btn.classList.remove('active'); btn.removeAttribute('aria-current'); }
        }
    }

    function initHeaderNavigation(container) {
        if (!container) return;
        const fade = $('#page-fade');
        const fadeLogo = $('#page-fade-logo');
        markActivePage(container);

        container.querySelectorAll('.main-nav a').forEach(a => {
            if (a.classList.contains('active') || a.getAttribute('aria-current') === 'page') return;
            a.addEventListener('click', e => {
                e.preventDefault();
                const href = a.getAttribute('href');
                if (!fade) return void (window.location.href = href);
                showFadeAndNavigate(fade, href);
            });
        });

        const btn = container.querySelector('.btn-contact');
        if (btn && !btn.classList.contains('active')) {
            btn.addEventListener('click', e => {
                e.preventDefault();
                const href = btn.getAttribute('href');
                if (!fade) return void (window.location.href = href);
                showFadeAndNavigate(fade, href);
            });
        }

        const logo = container.querySelector('.logo-header');
        if (logo) {
            logo.addEventListener('click', e => {
                e.preventDefault();
                const href = logo.getAttribute('href');
                if (!fadeLogo) return void (window.location.href = href);
                showFadeAndNavigate(fadeLogo, href);
            });
        }
    }

    const waitForImages = (root, timeout = 700) => {
        return new Promise(resolve => {
            if (!root) return resolve();
            const imgs = Array.from(root.querySelectorAll('img'));
            if (!imgs.length) return resolve();
            let settled = 0;
            let done = false;
            const check = () => {
                if (done) return;
                if (settled >= imgs.length) { done = true; resolve(); }
            };
            imgs.forEach(img => {
                if (img.complete) { settled++; check(); }
                else {
                    img.addEventListener('load', () => { settled++; check(); }, { once: true });
                    img.addEventListener('error', () => { settled++; check(); }, { once: true });
                }
            });
            setTimeout(() => { if (!done) { done = true; resolve(); } }, timeout);
        });
    };

    function setupResponsiveHeader(container) {
        if (!container) return;
        const overlay = container.querySelector('#menu-overlay');
        if (!overlay) return;

        if (!STATE.overlayMoved && overlay.parentElement !== document.body) {
            const prev = overlay.style.display;
            try { document.body.appendChild(overlay); }
            catch(e) {}
            overlay.style.display = prev || 'flex';
            STATE.overlayMoved = true;
        }

        try {
            const fade = document.getElementById('page-fade');
            const fadeLogo = document.getElementById('page-fade-logo');
            [fade, fadeLogo].forEach(f => {
                if (f && f.parentElement !== document.body) {
                    try { document.body.appendChild(f); } catch(e) {}
                }
            });
        } catch(e) {}

        const safeClone = (sourceEl) => {
            if (!sourceEl) return null;
            const clone = sourceEl.cloneNode(true);
            try {
                if (clone.removeAttribute) clone.removeAttribute('id');
                const nodesWithId = clone.querySelectorAll ? clone.querySelectorAll('[id]') : [];
                nodesWithId.forEach(n => n.removeAttribute('id'));
            } catch (e) {}
            return clone;
        };

        const overlayNav = overlay.querySelector('.overlay-nav');
        const overlayLogo = overlay.querySelector('.logo-placeholder');
        const overlayContact = overlay.querySelector('.contact-placeholder');
        const origNav = container.querySelector('.main-nav');
        const origLogo = container.querySelector('.logo-header');
        const origContact = container.querySelector('.btn-contact');

        try {
            if (overlayNav && origNav) {
                overlayNav.innerHTML = '';
                const navClone = safeClone(origNav);
                if (navClone) {
                    navClone.classList.add('overlay-clone');
                    overlayNav.appendChild(navClone);
                }
            }
            if (overlayLogo && origLogo) {
                overlayLogo.innerHTML = '';
                const logoClone = safeClone(origLogo);
                if (logoClone) {
                    logoClone.classList.add('overlay-clone');
                    overlayLogo.appendChild(logoClone);
                }
            }
            if (overlayContact && origContact) {
                overlayContact.innerHTML = '';
                const contactClone = safeClone(origContact);
                if (contactClone) {
                    contactClone.classList.add('overlay-clone');
                    overlayContact.appendChild(contactClone);
                }
            }

            try { markActivePage(overlay); } catch(e) {}

        } catch (err) {
            console.warn('[header] cloning overlay elements failed:', err);
        }


        let burger = container.querySelector('.burger-btn') || document.querySelector('.burger-btn');
        const overlayElem = document.getElementById('menu-overlay');

        if (burger) {
            try {
                if (burger.parentElement !== document.body) {
                    const ariaExpanded = burger.getAttribute('aria-expanded') || 'false';
                    document.body.appendChild(burger);
                    burger.setAttribute('aria-expanded', ariaExpanded);
                }
                burger.style.position = 'fixed';
                burger.style.top = '16px';
                burger.style.left = '16px';
                if (!burger.style.zIndex) burger.style.zIndex = '21001';
                burger.style.pointerEvents = 'auto';
                burger.style.background = 'transparent';
                burger.style.transform = 'translateZ(0)';
            } catch (err) {
                console.warn('[header] could not reparent burger to body:', err);
            }
        }


        if (burger && overlayElem && !burger._hbBound) {
            burger._hbBound = true;
            burger.setAttribute('aria-expanded', 'false');
            burger.addEventListener('click', () => {
                const open = overlayElem.classList.toggle('open');
                overlayElem.setAttribute('aria-hidden', open ? 'false' : 'true');
                document.documentElement.classList.toggle('menu-open', open);
                document.body.style.overflow = open ? 'hidden' : '';
                burger.setAttribute('aria-expanded', open ? 'true' : 'false');
                if (open) burger.classList.add('active'); else burger.classList.remove('active');
                if (open) {
                    const first = overlayElem.querySelector('.main-nav a');
                    if (first) first.focus();
                } else {
                    try { burger.focus(); } catch(e){}
                }
            });
        }

        try {
            const candidates = Array.from(overlay.querySelectorAll('.overlay-clone a, .overlay-clone'));
            candidates.forEach(node => {
                let a = null;
                if (node.tagName && node.tagName.toUpperCase() === 'A') a = node;
                else a = node.querySelector ? node.querySelector('a') : null;
                if (!a) return;
                if (a._hbAnchorBound) return;
                a._hbAnchorBound = true;

                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const href = a.getAttribute('href') || '/';
                    const isLogo = !!a.closest('.logo-placeholder') || !!a.closest('.logo-header');
                    const fadeEl = isLogo ? document.getElementById('page-fade-logo') : document.getElementById('page-fade');

                    if (!fadeEl) {
                        if (!isLogo) {
                            overlayElem.classList.remove('open');
                            overlayElem.setAttribute('aria-hidden','true');
                            document.documentElement.classList.remove('menu-open');
                            document.body.style.overflow = '';
                            if (burger) { burger.setAttribute('aria-expanded','false'); burger.classList.remove('active'); }
                        }
                        window.location.href = href;
                        return;
                    }

                    const closeOverlay = () => {
                        if (!overlayElem) return;
                        overlayElem.classList.remove('open');
                        overlayElem.setAttribute('aria-hidden','true');
                        document.documentElement.classList.remove('menu-open');
                        document.body.style.overflow = '';
                        if (burger) { burger.setAttribute('aria-expanded','false'); burger.classList.remove('active'); }
                    };

                    if (isLogo) {
                        closeOverlay();
                        showFadeAndNavigate(fadeEl, href, overlayElem);
                    } else {
                        closeOverlay();
                        showFadeAndNavigate(fadeEl, href, overlayElem);
                    }
                });
            });
        } catch (err) {
            console.warn('[header] binding overlay anchors failed:', err);
        }

        try {
            const contactClone = overlay.querySelector('.overlay-clone .btn-contact') || overlay.querySelector('.contact-placeholder .overlay-clone .btn-contact');
            if (contactClone && !contactClone._hbAnchorBound) {
                contactClone._hbAnchorBound = true;
                contactClone.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const href = contactClone.getAttribute('href') || (origContact ? origContact.getAttribute('href') : '/');

                    overlayElem.classList.remove('open');
                    overlayElem.setAttribute('aria-hidden','true');
                    document.documentElement.classList.remove('menu-open');
                    document.body.style.overflow = '';
                    if (burger) { burger.setAttribute('aria-expanded','false'); burger.classList.remove('active'); }

                    const fadeEl = document.getElementById('page-fade');
                    if (!fadeEl) { window.location.href = href; return; }
                    showFadeAndNavigate(fadeEl, href);
                });
            }
        } catch (err) {}

        if (!overlayElem._hbBgBound) {
            overlayElem._hbBgBound = true;
            overlayElem.addEventListener('click', (e) => {
                if (e.target === overlayElem) {
                    overlayElem.classList.remove('open');
                    overlayElem.setAttribute('aria-hidden','true');
                    document.documentElement.classList.remove('menu-open');
                    document.body.style.overflow = '';
                    if (burger) { burger.setAttribute('aria-expanded','false'); burger.classList.remove('active'); try { burger.focus(); } catch(e){} }
                }
            });
        }

        if (!STATE.escapeBound) {
            document.addEventListener('keydown', e => {
                if (e.key === 'Escape') {
                    const ov = document.getElementById('menu-overlay');
                    if (ov && ov.classList.contains('open')) {
                        ov.classList.remove('open');
                        ov.setAttribute('aria-hidden','true');
                        document.documentElement.classList.remove('menu-open');
                        document.body.style.overflow = '';
                        let burgerLocal = container.querySelector('.burger-btn') || document.querySelector('.burger-btn');
                        if (burgerLocal) { burgerLocal.setAttribute('aria-expanded','false'); burgerLocal.classList.remove('active'); try { burgerLocal.focus(); } catch(e){} }
                    }
                }
            });
            STATE.escapeBound = true;
        }
    }

    function checkHeaderMode() {
        const placeholder = document.getElementById('header');
        const headerRoot = nearestHeader(placeholder);
        if (!headerRoot) return;
        const logo = headerRoot.querySelector('.logo-header');
        const navUl = headerRoot.querySelector('.main-nav ul');
        const btn = headerRoot.querySelector('.btn-contact');

        let needed = 80;
        try {
            if (logo) needed += Math.ceil(logo.getBoundingClientRect().width);
            if (navUl) needed += Math.ceil(navUl.scrollWidth);
            if (btn) needed += Math.ceil(btn.getBoundingClientRect().width);
        } catch { needed = 800; }

        const smallScreenFallback = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
        const shouldCompact = (window.innerWidth < needed) || smallScreenFallback;
        const wasCompact = document.documentElement.classList.contains('position-compact');

        if (shouldCompact && !wasCompact) {
            try {
                const cur = getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '';
                if (PREV_HEADER_HEIGHT === null) PREV_HEADER_HEIGHT = cur.trim() || null;
            } catch(e) {}

            document.documentElement.classList.add('position-compact');
            document.documentElement.style.setProperty('--header-height','0px');
        }

        if (!shouldCompact && wasCompact) {
            document.documentElement.classList.remove('position-compact');
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    try {
                        const overlayNow = document.getElementById('menu-overlay');
                        const burgers = Array.from(document.querySelectorAll('.burger-btn'));
                        if (overlayNow && overlayNow.classList.contains('open')) {
                            const prevTrans = overlayNow.style.transition || '';
                            overlayNow.style.transition = 'none';

                            overlayNow.classList.remove('open');
                            overlayNow.setAttribute('aria-hidden', 'true');

                            document.documentElement.classList.remove('menu-open');
                            document.body.style.overflow = '';

                            burgers.forEach(b => {
                                try { b.setAttribute('aria-expanded', 'false'); } catch(e){}
                                try { b.classList.remove('active'); } catch(e){}
                            });

                            void overlayNow.offsetHeight;
                            window.requestAnimationFrame(() => {
                                try {
                                    if (prevTrans) overlayNow.style.transition = prevTrans;
                                    else overlayNow.style.removeProperty('transition');
                                } catch(e){}
                            });
                        }
                    } catch(e) {}

                    PREV_HEADER_HEIGHT = null;
                });
            });

            setTimeout(() => {
                try {
                    const containerEl = headerRoot.querySelector('.container');
                    let restored = false;
                    if (containerEl && getComputedStyle(containerEl).display === 'none') {
                        const prevDisplay = containerEl.style.display || '';
                        const prevVisibility = containerEl.style.visibility || '';
                        containerEl.style.visibility = 'hidden';
                        containerEl.style.display = 'flex';
                        updateHeaderHeight(headerRoot);
                        containerEl.style.display = prevDisplay;
                        containerEl.style.visibility = prevVisibility;
                        restored = true;
                    }
                    if (!restored) updateHeaderHeight(headerRoot);

                    const computed = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
                    if ((computed < 1) && PREV_HEADER_HEIGHT) {
                        document.documentElement.style.setProperty('--header-height', PREV_HEADER_HEIGHT);
                    }
                } catch(e){}
                PREV_HEADER_HEIGHT = null;
            }, 160);
        }

        updateHeaderHeight(headerRoot);
    }

    async function waitForHeaderVisible(headerEl, timeout = 800) {
        if (!headerEl) return;
        const container = headerEl.querySelector('.container') || headerEl;
        const start = performance.now();

        const isMeasurable = () => {
            try {
                const cs = getComputedStyle(container);
                const displayOk = cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
                const rect = container.getBoundingClientRect();
                return displayOk && rect.height > 0 && rect.width > 0;
            } catch (e) { return false; }
        };

        if (isMeasurable()) return;

        return new Promise(resolve => {
            const mo = new MutationObserver(() => {
                if (isMeasurable()) {
                    mo.disconnect();
                    clearTimeout(to);
                    resolve();
                }
            });
            mo.observe(container, { attributes: true, childList: true, subtree: true });

            const tryTempMeasure = () => {
                try {
                    if (!isMeasurable()) {
                        const prevDisplay = container.style.display || '';
                        const prevVisibility = container.style.visibility || '';
                        container.style.visibility = 'hidden';
                        container.style.display = 'flex';
                        void container.getBoundingClientRect();
                        container.style.display = prevDisplay;
                        container.style.visibility = prevVisibility;
                    }
                } catch(e){}
            };

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (isMeasurable()) { mo.disconnect(); clearTimeout(to); resolve(); return; }
                    tryTempMeasure();
                    if (isMeasurable()) { mo.disconnect(); clearTimeout(to); resolve(); return; }
                    const retryInterval = setInterval(() => {
                        if (isMeasurable()) { clearInterval(retryInterval); mo.disconnect(); clearTimeout(to); resolve(); }
                        else tryTempMeasure();
                    }, 40);
                    to = setTimeout(() => { clearInterval(retryInterval); mo.disconnect(); resolve(); }, timeout);
                });
            });

            let to = setTimeout(() => { mo.disconnect(); resolve(); }, timeout);
        });
    }

    async function bootstrap() {
        readInitialCSSHeader();
        const placeholder = document.getElementById('header');
        if (!placeholder) return console.error('[header] placeholder #header introuvable');
        try {
            const r = await fetch('../components/header.html');
            const html = await r.text();
            placeholder.innerHTML = html;
            const headerEl = nearestHeader(placeholder);

            await waitForImages(headerEl, 700);

            setupResponsiveHeader(headerEl);
            initHeaderNavigation(headerEl);

            await waitForHeaderVisible(headerEl, 1000);
            updateHeaderHeight(headerEl);

            checkHeaderMode();
            setTimeout(checkHeaderMode, 80);
            setTimeout(checkHeaderMode, 300);
            setTimeout(checkHeaderMode, 800);

            const mo = new MutationObserver(() => { checkHeaderMode(); });
            mo.observe(headerEl, { childList: true, subtree: true, attributes: true });
            setTimeout(() => mo.disconnect(), 2000);

            setTimeout(() => { updateHeaderHeight(headerEl); checkHeaderMode(); }, 260);
            if (typeof playMenuAppearIfFromIndex === 'function') try { playMenuAppearIfFromIndex(headerEl); } catch(e){}
        } catch (err) {
            console.error('Erreur chargement header:', err);
        }
    }

    function showFadeAndNavigate(fadeEl, href, overlayElem) {
        if (!fadeEl) { window.location.href = href; return; }

        const isCompact = document.documentElement.classList.contains('position-compact');

        const getEffectiveHeaderHeightPx = () => {
            try {
                if (document.documentElement.classList.contains('position-compact')) return 0;
            } catch(e){}

            try {
                const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '';
                const v = parseFloat(raw);
                if (Number.isFinite(v) && v > 0) return Math.round(v);
            } catch(e){}

            try {
                if (typeof PREV_HEADER_HEIGHT !== 'undefined' && PREV_HEADER_HEIGHT !== null) {
                    const pv = parseFloat((PREV_HEADER_HEIGHT+'').replace('px','').trim());
                    if (Number.isFinite(pv) && pv > 0) return Math.round(pv);
                }
            } catch(e){}

            try {
                const h = document.querySelector('header.site-header') || document.getElementById('header');
                if (h) {
                    const r = h.getBoundingClientRect();
                    if (r && r.height > 0) return Math.round(r.height);
                }
            } catch(e){}

            return 0;
        };

        const cleanupInlinePosition = (el) => {
            try {
                if (!el) return;
                el.style.removeProperty('top');
                el.style.removeProperty('height');
                el.style.removeProperty('width');
                el.style.removeProperty('left');
            } catch(e){}
        };

        const simpleFadeFlow = () => {
            try {
                const overlayZ = overlayElem ? (parseInt(getComputedStyle(overlayElem).zIndex, 10) || 20000) : 20000;

                if (fadeEl.id === 'page-fade') {
                    const headerH = getEffectiveHeaderHeightPx();
                    try {
                        fadeEl.style.top = `${headerH}px`;
                        fadeEl.style.height = `calc(100% - ${headerH}px)`;
                    } catch(e){}

                    try { fadeEl.style.setProperty('z-index', String(Math.max(0, overlayZ - 1)), 'important'); } catch(e) { fadeEl.style.zIndex = String(Math.max(0, overlayZ - 1)); }
                    fadeEl.classList.remove('overlay-above');
                } else {
                    fadeEl.classList.add('overlay-above');
                    try { fadeEl.style.setProperty('z-index', String(overlayZ + 1), 'important'); } catch(e) { fadeEl.style.zIndex = String(overlayZ + 1); }
                }
            } catch(e) {}

            if (fadeEl.classList.contains('active')) { window.location.href = href; return; }

            let done = false;
            const onEnd = (ev) => {
                if (!ev.propertyName || ev.propertyName === 'opacity') {
                    if (done) return; done = true;
                    try { fadeEl.removeEventListener('transitionend', onEnd); } catch(e){}
                    try { fadeEl.classList.remove('overlay-above'); fadeEl.style.removeProperty('z-index'); } catch(e){}
                    if (fadeEl.id === 'page-fade') cleanupInlinePosition(fadeEl);
                    window.location.href = href;
                }
            };
            try { fadeEl.addEventListener('transitionend', onEnd); } catch(e){}

            const fallback = setTimeout(() => {
                if (done) return; done = true;
                try { fadeEl.removeEventListener('transitionend', onEnd); } catch(e){}
                try { fadeEl.classList.remove('overlay-above'); fadeEl.style.removeProperty('z-index'); } catch(e){}
                if (fadeEl.id === 'page-fade') cleanupInlinePosition(fadeEl);
                window.location.href = href;
            }, 900);

            try { void fadeEl.getBoundingClientRect(); } catch(e){}
            fadeEl.classList.add('active');
        };

        const advancedFadeFlow = () => {
            const restoreBurgers = () => {
                try {
                    const saved = fadeEl._burgerReset;
                    if (!saved) return;
                    saved.forEach(item => {
                        try {
                            if (item.prevZExists) {
                                item.el.style.setProperty('z-index', item.prevZ, item.prevZPrio || '');
                            } else {
                                item.el.style.removeProperty('z-index');
                            }
                        } catch (e) {}
                        try {
                            if (item.prevPEExists) {
                                item.el.style.setProperty('pointer-events', item.prevPE, item.prevPEPrio || '');
                            } else {
                                item.el.style.removeProperty('pointer-events');
                            }
                        } catch (e) {}
                    });
                } catch (e) {}
                try { delete fadeEl._burgerReset; } catch(e){}
            };

            const cleanupFadeInline = () => {
                try {
                    fadeEl.style.removeProperty('z-index');
                    fadeEl.classList.remove('overlay-above');
                    if (fadeEl.id === 'page-fade') cleanupInlinePosition(fadeEl);
                } catch(e){}
            };

            try {
                const overlayZ = overlayElem ? (parseInt(getComputedStyle(overlayElem).zIndex, 10) || 20000) : 20000;

                if (fadeEl.id === 'page-fade') {
                    const headerH = getEffectiveHeaderHeightPx();
                    try {
                        fadeEl.style.top = `${headerH}px`;
                        fadeEl.style.height = `calc(100% - ${headerH}px)`;
                        fadeEl.style.left = '0';
                        fadeEl.style.width = '100%';
                    } catch(e){}
                    try { fadeEl.style.setProperty('z-index', String(Math.max(0, overlayZ - 1)), 'important'); } catch(e) { fadeEl.style.zIndex = String(Math.max(0, overlayZ - 1)); }
                } else {
                    let burgerMaxZ = 0;
                    try {
                        const burgers = Array.from(document.querySelectorAll('.burger-btn'));
                        burgers.forEach(b => {
                            const csZ = parseInt(getComputedStyle(b).zIndex, 10);
                            if (Number.isFinite(csZ)) burgerMaxZ = Math.max(burgerMaxZ, csZ);
                            const inlineZ = parseInt(b.style && b.style.zIndex, 10);
                            if (Number.isFinite(inlineZ)) burgerMaxZ = Math.max(burgerMaxZ, inlineZ);
                        });
                    } catch(e){}

                    let targetTop = Math.max(overlayZ, burgerMaxZ, 20000);
                    if (fadeEl.id === 'page-fade-logo') {
                        targetTop = Math.max(targetTop, 2147483600);
                    }

                    fadeEl.classList.add('overlay-above');
                    fadeEl.style.top = '0';
                    fadeEl.style.left = '0';
                    fadeEl.style.width = '100%';
                    fadeEl.style.height = '100%';
                    try { fadeEl.style.setProperty('z-index', String(targetTop + 2), 'important'); } catch(e){ fadeEl.style.zIndex = String(targetTop + 2); }

                    if (fadeEl.id === 'page-fade-logo') {
                        const burgers = Array.from(document.querySelectorAll('.burger-btn'));
                        const saved = [];
                        burgers.forEach(b => {
                            try {
                                const prevZ = b.style.getPropertyValue('z-index');
                                const prevZPrio = b.style.getPropertyPriority('z-index');
                                const prevPE = b.style.getPropertyValue('pointer-events');
                                const prevPEPrio = b.style.getPropertyPriority('pointer-events');

                                saved.push({
                                    el: b,
                                    prevZ: prevZ,
                                    prevZPrio: prevZPrio,
                                    prevZExists: prevZ !== '',
                                    prevPE: prevPE,
                                    prevPEPrio: prevPEPrio,
                                    prevPEExists: prevPE !== ''
                                });

                                try { b.style.setProperty('z-index', String(targetTop - 1), 'important'); } catch(e) { b.style.zIndex = String(targetTop - 1); }
                                try { b.style.setProperty('pointer-events', 'none', 'important'); } catch(e) { b.style.pointerEvents = 'none'; }
                            } catch(e){}
                        });
                        if (saved.length) fadeEl._burgerReset = saved;
                    }
                }
            } catch(err) {}

            if (fadeEl.classList.contains('active')) {
                try { restoreBurgers(); } catch(e){}
                try { cleanupFadeInline(); } catch(e){}
                window.location.href = href;
                return;
            }

            let done = false;
            const onEnd = (ev) => {
                if (!ev.propertyName || ev.propertyName === 'opacity') {
                    if (done) return; done = true;
                    try { fadeEl.removeEventListener('transitionend', onEnd); } catch(e){}
                    try { restoreBurgers(); } catch(e){}
                    setTimeout(() => { try { cleanupFadeInline(); } catch(e){} }, 60);
                    window.location.href = href;
                }
            };
            try { fadeEl.addEventListener('transitionend', onEnd); } catch(e){}

            const fallback = setTimeout(() => {
                if (done) return; done = true;
                try { fadeEl.removeEventListener('transitionend', onEnd); } catch(e){}
                try { restoreBurgers(); } catch(e){}
                try { cleanupFadeInline(); } catch(e){}
                window.location.href = href;
            }, 900);

            try { void fadeEl.getBoundingClientRect(); } catch(e){}
            fadeEl.classList.add('active');
        };

        if (!isCompact) simpleFadeFlow(); else advancedFadeFlow();
    }

    window.addEventListener('resize', () => {
        updateHeaderHeight();
        checkHeaderMode();
    });
    window.addEventListener('load', () => setTimeout(() => { updateHeaderHeight(); checkHeaderMode(); }, 60));
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => { checkHeaderMode(); }, 60));

    bootstrap();

    function _cleanupOverlaysAndBurgers() {
        try {
            const overlay = document.getElementById('menu-overlay');
            const fade = document.getElementById('page-fade');
            const fadeLogo = document.getElementById('page-fade-logo');
            const burgers = Array.from(document.querySelectorAll('.burger-btn'));

            const cleanEl = (el) => {
                if (!el) return;
                el.classList.remove('open', 'active', 'overlay-above');
                try { el.setAttribute('aria-hidden', 'true'); } catch(e){}
                try {
                    el.style.removeProperty('z-index');
                    el.style.removeProperty('top');
                    el.style.removeProperty('height');
                    el.style.removeProperty('width');
                    el.style.removeProperty('left');
                } catch(e){}
            };

            [overlay, fade, fadeLogo].forEach(cleanEl);

            burgers.forEach(b => {
                try { b.classList.remove('active'); } catch(e){}
                try { b.setAttribute('aria-expanded', 'false'); } catch(e){}
                try { b.style.removeProperty('pointer-events'); } catch(e){}
            });

            try { document.documentElement.classList.remove('menu-open'); } catch(e){}
            try { document.body.style.overflow = ''; } catch(e){}

            [fade, fadeLogo].forEach(f => {
                try {
                    if (!f) return;
                    const saved = f._burgerReset;
                    if (!saved || !saved.length) return;
                    saved.forEach(item => {
                        try {
                            if (item.prevZExists) {
                                item.el.style.setProperty('z-index', item.prevZ, item.prevZPrio || '');
                            } else {
                                item.el.style.removeProperty('z-index');
                            }
                        } catch(e){}
                        try {
                            if (item.prevPEExists) {
                                item.el.style.setProperty('pointer-events', item.prevPE, item.prevPEPrio || '');
                            } else {
                                item.el.style.removeProperty('pointer-events');
                            }
                        } catch(e){}
                    });
                    try { delete f._burgerReset; } catch(e){}
                } catch(e){}
            });

            try { updateHeaderHeight(); } catch(e){}
            try { checkHeaderMode(); } catch(e){}
        } catch(e) {}
    }

    window.addEventListener('pageshow', (ev) => {
        _cleanupOverlaysAndBurgers();
    });

    window.addEventListener('popstate', () => {
        _cleanupOverlaysAndBurgers();
    });

    window.__HEADER_SIMPLE = { updateHeaderHeight, checkHeaderMode, _initial: () => INITIAL_HEADER_HEIGHT_PX };
})();
