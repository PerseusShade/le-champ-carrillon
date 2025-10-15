(function() {
    const css = `
#header.initial-hidden { opacity: 0; pointer-events: none; }

#header .site-header.intro {
    border-bottom-color: transparent !important;
    transition: border-bottom-color 700ms cubic-bezier(.2,.9,.2,1), box-shadow 300ms ease;
}
#header .site-header.intro.show-border {
    border-bottom-color: #7B2D2D !important;
}

#header .site-header .logo-header img {
    transform-origin: center bottom !important;
    transform: scaleY(0) translateY(8px) !important;
    opacity: 0;
    transition: transform 1000ms cubic-bezier(.2,.9,.2,1), opacity 420ms ease;
}
#header .site-header.logo-animate .logo-header img {
    transform: scaleY(1) translateY(0) !important;
    opacity: 1 !important;
}

#header .site-header .main-nav ul li {
    opacity: 0;
    transform: translateY(8px);
}

@keyframes navFadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
}

#header .site-header.menu-animate .main-nav ul li {
    animation: navFadeUp 420ms ease forwards;
}
#header .site-header.menu-animate .main-nav ul li:nth-child(1) { animation-delay: 0.00s; }
#header .site-header.menu-animate .main-nav ul li:nth-child(2) { animation-delay: 0.09s; }
#header .site-header.menu-animate .main-nav ul li:nth-child(3) { animation-delay: 0.18s; }
#header .site-header.menu-animate .main-nav ul li:nth-child(4) { animation-delay: 0.27s; }
#header .site-header.menu-animate .main-nav ul li:nth-child(5) { animation-delay: 0.36s; }
#header .site-header.menu-animate .main-nav ul li:nth-child(6) { animation-delay: 0.45s; }
#header .site-header.menu-animate .main-nav ul li:nth-child(7) { animation-delay: 0.54s; }

#header .site-header .btn-contact {
    transform-origin: center center;
    transform: scale(0);
    opacity: 0;
    transition: transform 420ms cubic-bezier(.2,.9,.2,1), opacity 220ms ease;
}
#header .site-header.contact-animate .btn-contact {
    transform: scale(1) !important;
    opacity: 1 !important;
}

#header .site-header .main-nav a.hover-sim {
    color: #F7931E !important;
}
#header .site-header .main-nav a.hover-sim::after {
    width: 100% !important;
}

#header.showing { pointer-events: auto; opacity: 1; transition: opacity 250ms ease; }

#header.initial-hidden { transition: opacity 300ms ease; }

`;
    const style = document.createElement('style');
    style.setAttribute('data-transition-styles', '1');
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    const headerWrapper = document.getElementById('header');
    if (!headerWrapper) return;

    headerWrapper.classList.add('initial-hidden');

    let played = false;

    function waitForTransition(target, matchProp, timeout = 1200) {
        return new Promise(resolve => {
            if (!target) return resolve();
            let done = false;
            const onEnd = (e) => {
                if (!matchProp || (e.propertyName && e.propertyName.includes(matchProp))) {
                    if (done) return;
                    done = true;
                    cleanup();
                    resolve();
                }
            };
            const cleanup = () => {
                try { target.removeEventListener('transitionend', onEnd); } catch(e){}
                clearTimeout(timer);
            };
            try { target.addEventListener('transitionend', onEnd); } catch(e){}
            const timer = setTimeout(() => {
                if (done) return;
                done = true;
                cleanup();
                resolve();
            }, timeout);
        });
    }

    function waitForAnimationEnd(target, timeout = 2000) {
        return new Promise(resolve => {
            if (!target) return resolve();
            let done = false;
            const onEnd = (e) => {
                if (done) return;
                done = true;
                cleanup();
                resolve(e);
            };
            const cleanup = () => {
                try { target.removeEventListener('animationend', onEnd); } catch(e){}
                clearTimeout(timer);
            };
            try { target.addEventListener('animationend', onEnd); } catch(e){}
            const timer = setTimeout(() => {
                if (done) return;
                done = true;
                cleanup();
                resolve();
            }, timeout);
        });
    }

    async function playIntroSequential(siteHeader) {
        if (played || !siteHeader) return;
        played = true;

        headerWrapper.classList.remove('initial-hidden');

        siteHeader.offsetHeight;

        siteHeader.classList.add('intro');
        await new Promise(r => requestAnimationFrame(r));

        siteHeader.classList.add('show-border');
        await waitForTransition(siteHeader, 'border', 600);

        siteHeader.classList.add('logo-animate');
        const logoImg = siteHeader.querySelector('.logo-header img');
        await waitForTransition(logoImg || siteHeader, 'transform', 1600);

        siteHeader.classList.add('menu-animate');
        const navItems = siteHeader.querySelectorAll('.main-nav ul li');
        if (navItems && navItems.length) {
            const last = navItems[navItems.length - 1];
            await waitForAnimationEnd(last, 2200);
        } else {
            await new Promise(r => setTimeout(r, 300));
        }

        siteHeader.classList.add('contact-animate');
        const contactBtn = siteHeader.querySelector('.btn-contact');
        await waitForTransition(contactBtn || siteHeader, 'transform', 700);

        headerWrapper.classList.add('showing');

        let accueilLink = siteHeader.querySelector('.main-nav a[href*="/pages/accueil.html"]');
        if (!accueilLink) {
            const links = siteHeader.querySelectorAll('.main-nav a');
            for (const a of links) {
                if (a.textContent && a.textContent.trim().toLowerCase() === 'accueil') {
                    accueilLink = a;
                    break;
                }
            }
        }

        if (accueilLink) {
            accueilLink.classList.add('hover-sim');
            accueilLink.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
            accueilLink.click();
        }
    }

    function resolveHrefFromHeader(siteHeader) {
        let firstLink = null;
        if (siteHeader) {
            firstLink = siteHeader.querySelector('.main-nav a') || siteHeader.querySelector('a');
        }
        if (!firstLink) firstLink = headerWrapper.querySelector('.main-nav a') || headerWrapper.querySelector('a');
        const href = firstLink ? (firstLink.getAttribute('href') || '/') : '/';
        try { return new URL(href, document.baseURI).href; } catch(e) { return href; }
    }

    function pollForBurger(maxWait = 700) {
        const start = performance.now();
        return new Promise(resolve => {
            const tryFind = () => {
                const b = headerWrapper.querySelector('.burger-btn') || document.querySelector('.burger-btn');
                if (b) return resolve(b);
                if (performance.now() - start >= maxWait) return resolve(null);
                requestAnimationFrame(tryFind);
            };
            tryFind();
        });
    }

    async function fadeInBurgerAndRedirect(siteHeader, destHref) {
        try {
            const burger = await pollForBurger(700);
            if (!burger) {
                window.location.href = destHref;
                return;
            }

            const prevTransition = burger.style.transition || '';
            const prevOpacity = burger.style.opacity || '';
            const prevTransform = burger.style.transform || '';
            const prevPointerEvents = burger.style.pointerEvents || '';

            burger.style.transition = 'opacity 420ms ease, transform 320ms cubic-bezier(.2,.9,.3,1)';
            burger.style.opacity = '0';
            burger.style.transform = 'scale(0.92) translateZ(0)';
            burger.style.pointerEvents = 'auto';

            void burger.offsetHeight;

            let done = false;
            const onEnd = (ev) => {
                if (ev && ev.propertyName && ev.propertyName !== 'opacity' && ev.propertyName !== 'transform') return;
                if (done) return;
                done = true;
                cleanup();
                setTimeout(() => { window.location.href = destHref; }, 30);
            };
            const cleanup = () => {
                try { burger.removeEventListener('transitionend', onEnd); } catch(e){}
                clearTimeout(fallbackTimer);
                try {
                    if (prevTransition) burger.style.setProperty('transition', prevTransition);
                    else burger.style.removeProperty('transition');
                    if (prevOpacity) burger.style.setProperty('opacity', prevOpacity);
                    else burger.style.removeProperty('opacity');
                    if (prevTransform) burger.style.setProperty('transform', prevTransform);
                    else burger.style.removeProperty('transform');
                    if (prevPointerEvents) burger.style.setProperty('pointer-events', prevPointerEvents);
                    else burger.style.removeProperty('pointer-events');
                } catch(e){}
            };

            try { burger.addEventListener('transitionend', onEnd); } catch(e){}

            requestAnimationFrame(() => {
                burger.style.opacity = '1';
                burger.style.transform = 'scale(1) translateZ(0)';
            });

            const fallbackTimer = setTimeout(() => {
                if (done) return;
                done = true;
                cleanup();
                window.location.href = destHref;
            }, 900);

        } catch (e) {
            try { window.location.href = destHref; } catch(e){}
        }
    }

    function maybeCompactRedirect(siteHeader) {
        try {
            const isCompact = document.documentElement.classList.contains('position-compact');
            if (!isCompact) return false;

            const dest = resolveHrefFromHeader(siteHeader);
            fadeInBurgerAndRedirect(siteHeader, dest);
            return true;
        } catch (e) {
            return false;
        }
    }

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.type === 'childList' && m.addedNodes.length) {
                const siteHeader = headerWrapper.querySelector('.site-header');
                if (siteHeader) {
                    if (!maybeCompactRedirect(siteHeader)) {
                        playIntroSequential(siteHeader).catch(() => {});
                    }
                    observer.disconnect();
                    return;
                }
            }
        }
    });

    observer.observe(headerWrapper, { childList: true, subtree: true });

    setTimeout(() => {
        const existing = headerWrapper.querySelector('.site-header');
        if (existing && !played) {
            if (!maybeCompactRedirect(existing)) {
                playIntroSequential(existing).catch(() => {});
            }
            observer.disconnect();
        }
    }, 400);

    setTimeout(() => {
        const existing = headerWrapper.querySelector('.site-header');
        if (existing && !played) {
            if (!maybeCompactRedirect(existing)) {
                playIntroSequential(existing).catch(() => {});
            }
        }
    }, 2500);
})();
