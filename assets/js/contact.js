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

                const mailto = `mailto:lechampcarrillon@gmail.com`
                    + `?subject=Message de ${name}`
                    + `&body=Nom : ${name}%0D%0AEmail : ${email}%0D%0A%0D%0A${message}`;

                window.location.href = mailto;
            });
        }

        (function loadRandomGallery() {
            const photosContainer = document.querySelector('.photos');
            if (!photosContainer) return;

            fetch('./assets/img/galerie/manifest.json')
                .then(res => res.ok ? res.json() : Promise.reject('manifest non ok'))
                .then(images => {
                    if (!Array.isArray(images) || images.length === 0) return;
                    const shuffled = images.slice().sort(() => 0.5 - Math.random());
                    const selected = shuffled.slice(0, 4);

                    photosContainer.innerHTML = '';
                    selected.forEach(img => {
                        const el = document.createElement('img');
                        el.src = `./assets/img/galerie/${img}`;
                        el.alt = 'Photo du champ';
                        photosContainer.appendChild(el);
                    });
                })
        })();

        const vp = document.querySelector('.voirplus-btn');
        if (vp) {
            vp.addEventListener('click', async e => {
                e.preventDefault();

                const selector = '#header a[href="/pages/galerie.html"], #header a[href="/galerie.html"]';
                const galerieLink = await waitForSelector(selector, 4000);

                if (galerieLink) {
                    galerieLink.click();
                }
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