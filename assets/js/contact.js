(function () {
    function waitForSelector(selector, timeout = 3000, interval = 50) {
        return new Promise(resolve => {
            const found = document.querySelector(selector);
            if (found) return resolve(found);
            let elapsed = 0;
            const iv = setInterval(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(iv);
                    return resolve(el);
                }
                elapsed += interval;
                if (elapsed >= timeout) {
                    clearInterval(iv);
                    return resolve(null);
                }
            }, interval);
        });
    }

    function staggerReveal(nodes, baseDelay = 80, step = 120) {
        if (!nodes || nodes.length === 0) return;
        nodes.forEach((el, i) => {
            el.classList.add('pre-fade');
            el.style.transitionDelay = '';
        });
        requestAnimationFrame(() => {
            nodes.forEach((el, i) => {
                const delay = baseDelay + i * step;
                el.style.transitionDelay = `${delay}ms`;
                setTimeout(() => {
                    el.classList.add('fade-in');
                    el.classList.remove('pre-fade');
                }, delay);
            });
        });
    }

    function attachPhotoInteractions(containerSelector) {
        const imgs = Array.from(document.querySelectorAll(containerSelector + ' img'));
        if (!imgs.length) return;
        imgs.forEach(img => {
            if (!img.hasAttribute('tabindex')) img.setAttribute('tabindex', '0');
            img.addEventListener('pointerdown', (e) => {
                img.classList.add('hc-press');
                try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
            }, { passive: true });
            img.addEventListener('pointerup', (e) => {
                img.classList.remove('hc-press');
                try { e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId); } catch (_) {}
            });
            img.addEventListener('pointercancel', () => img.classList.remove('hc-press'));
            img.addEventListener('mouseleave', () => img.classList.remove('hc-press'));
            img.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    img.classList.add('hc-press');
                    setTimeout(() => img.classList.remove('hc-press'), 160);
                    img.click();
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const callBtn = document.getElementById('call-button');
        const tel = '33659434901';
        if (callBtn) {
            callBtn.addEventListener('click', e => {
                e.preventDefault();
                const url = `https://wa.me/${tel}`;
                window.open(url, '_blank');
            });
        }

        const form = document.getElementById('contact-form');
        if (form) {
            form.addEventListener('submit', e => {
                e.preventDefault();
                const name = encodeURIComponent(form.name.value || '');
                const email = encodeURIComponent(form.email.value || '');
                const message = encodeURIComponent(form.message.value || '');
                const mailto = `mailto:lechampcarrillon@gmail.com` + `?subject=Message de ${name}` + `&body=Nom : ${name}%0D%0AEmail : ${email}%0D%0A%0D%0A${message}`;
                window.location.href = mailto;
            });
        }

        (function loadRandomGallery() {
            const photosContainer = document.querySelector('.photos');
            if (!photosContainer) return;
            fetch('../assets/img/galerie/manifest.json')
                .then(res => res.ok ? res.json() : Promise.reject('manifest non ok'))
                .then(images => {
                    if (!Array.isArray(images) || images.length === 0) return;
                    const shuffled = images.slice().sort(() => 0.5 - Math.random());
                    const selected = shuffled.slice(0, 4);
                    let cycleIndex = 0;
                    while (selected.length < 4) {
                        selected.push(shuffled[cycleIndex % shuffled.length]);
                        cycleIndex++;
                    }
                    photosContainer.innerHTML = '';
                    selected.forEach(img => {
                        const el = document.createElement('img');
                        el.src = `../assets/img/galerie/${img}`;
                        el.alt = 'Photo du champ';
                        el.loading = 'lazy';
                        el.dataset.gallerySrc = el.src;
                        photosContainer.appendChild(el);
                    });
                    if (window.GalleryOverlay && typeof window.GalleryOverlay.attachGroupsByContainer === 'function') {
                        window.GalleryOverlay.attachGroupsByContainer('.gallery .photos', 'img', { enableScroll: true });
                    } else {
                        const imgs = Array.from(photosContainer.querySelectorAll('img'));
                        imgs.forEach((img, idx) => {
                            img.style.cursor = 'pointer';
                            img.addEventListener('click', () => {
                                const group = imgs.map(i => ({ src: i.dataset.gallerySrc || i.src, alt: i.alt || '' }));
                                if (window.GalleryOverlay && typeof window.GalleryOverlay.open === 'function') {
                                    window.GalleryOverlay.open(idx, group, { enableScroll: true });
                                }
                            });
                        });
                    }
                    attachPhotoInteractions('.gallery .photos');
                })
                .catch(err => {
                    console.error('Erreur chargement manifest galerie:', err);
                });
        })();

        const vp = document.querySelector('.voirplus-btn');
        if (vp) {
            vp.addEventListener('click', async e => {
                e.preventDefault();
                const findHeaderGalerie = () => {
                    const candidates = Array.from(document.querySelectorAll('#header a, header.site-header a, .main-nav a'));
                    for (const a of candidates) {
                        try {
                            const href = a.getAttribute('href') || '';
                            const url = new URL(href, document.baseURI);
                            const path = (url.pathname || '').replace(/\/+$/, '');
                            if (path === '/galerie' || path.endsWith('/galerie')) return a;
                        } catch (err) {}
                    }
                    return null;
                };
                const isCompact = document.documentElement.classList.contains('position-compact');
                if (!isCompact) {
                    const galerieLink = findHeaderGalerie();
                    if (galerieLink) {
                        if (!document.getElementById('hc-sim-hover-style')) {
                            const style = document.createElement('style');
                            style.id = 'hc-sim-hover-style';
                            style.textContent = `
.hc-sim-hover { color: var(--main-orange) !important; transition: color 0.25s ease; }
.hc-sim-hover::after { content: ""; position: absolute; left: 0; bottom: -5px; height: 3px; width: 100%; background-color: var(--main-orange); transition: width 0.3s ease; }
.hc-sim-press { transform: translateY(1px); transition: transform 120ms ease; }`;
                            document.head.appendChild(style);
                        }
                        const prevPos = galerieLink.style.position || '';
                        if (!getComputedStyle(galerieLink).position || getComputedStyle(galerieLink).position === 'static') {
                            galerieLink.style.position = 'relative';
                        }
                        galerieLink.classList.add('hc-sim-hover');
                        setTimeout(() => {
                            galerieLink.classList.add('hc-sim-press');
                            const NAV_DELAY = 140;
                            setTimeout(() => {
                                try { galerieLink.click(); } catch (e) { window.location.href = '../galerie/'; }
                                setTimeout(() => {
                                    galerieLink.classList.remove('hc-sim-hover', 'hc-sim-press');
                                    if (prevPos === '') galerieLink.style.removeProperty('position');
                                    else galerieLink.style.position = prevPos;
                                }, 300);
                            }, NAV_DELAY);
                        }, 20);
                        return;
                    }
                    const fallback = document.querySelector('#header a[href*="galerie"], header.site-header a[href*="galerie"], .main-nav a[href*="galerie"]');
                    if (fallback) { fallback.click(); return; }
                    window.location.href = '../galerie/';
                }
                try {
                    const overlay = document.getElementById('menu-overlay');
                    const burger = document.querySelector('.burger-btn');
                    if (overlay && !overlay.classList.contains('open')) {
                        overlay.classList.add('open');
                        overlay.setAttribute('aria-hidden', 'false');
                        document.documentElement.classList.add('menu-open');
                        document.body.style.overflow = 'hidden';
                        if (burger) { burger.setAttribute('aria-expanded', 'true'); burger.classList.add('active'); }
                    }
                    const selOverlayGalerie = '#menu-overlay a[href*="galerie"]';
                    const overlayGalerie = await waitForSelector(selOverlayGalerie, 1500);
                    if (overlayGalerie) {
                        overlayGalerie.click();
                        return;
                    }
                } catch (err) {}
                try {
                    const overlay = document.getElementById('menu-overlay');
                    const burger = document.querySelector('.burger-btn');
                    if (overlay) {
                        overlay.classList.remove('open');
                        overlay.setAttribute('aria-hidden', 'true');
                    }
                    document.documentElement.classList.remove('menu-open');
                    document.body.style.overflow = '';
                    if (burger) { burger.setAttribute('aria-expanded', 'false'); burger.classList.remove('active'); }
                } catch (e) {}
                window.location.href = '../galerie/';
            });
        }

        const selectorsInOrder = [
            '.intro',
            '.contact-info',
            '.map',
            '.gallery',
            '.formulaire',
            'footer'
        ];
        const nodes = selectorsInOrder
            .map(s => document.querySelector(s))
            .filter(Boolean);
        staggerReveal(nodes, 80, 120);
    });
})();
