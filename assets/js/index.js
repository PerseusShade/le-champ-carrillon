document.addEventListener('DOMContentLoaded', async () => {
    const container = document.querySelector('.slideshow');
    if (!container) return;

    const resp = await fetch('./assets/img/index/manifest.json');
    const slides = await resp.json();

    for (let i = slides.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [slides[i], slides[j]] = [slides[j], slides[i]];
    }

    const durationPerSlide = 8;
    const totalDuration = durationPerSlide * slides.length;

    slides.forEach((img, index) => {
        const slide = document.createElement('div');
        slide.className = 'slide';
        slide.style.backgroundImage = `url('./assets/img/index/${img}')`;

        const delay = durationPerSlide * index;
        slide.style.animation = `slideAnimation ${totalDuration}s infinite ease-in-out`;
        slide.style.animationDelay = `${delay}s`;

        container.appendChild(slide);
    });

    const overlayInner = document.querySelector('.overlay-inner');
    if (overlayInner) {
        overlayInner.style.animation = `overlayEntrance ${totalDuration}s ease forwards`;
        overlayInner.style.animationDelay = `0s`;
        overlayInner.style.animationIterationCount = '1';
        overlayInner.style.animationFillMode = 'forwards';
    }

    const fade = document.getElementById("index-overlay");
    const btnEnter = document.querySelector(".btn-enter");
    const FALLBACK_MS = 800;

    function goTo(url) {
        window.location.href = url;
    }

    if (btnEnter && fade) {
        document.addEventListener('click', function captureClick(e) {
            const anchor = e.target.closest('.btn-enter');
            if (!anchor) return;

            if (e.ctrlKey || e.shiftKey || e.metaKey || e.altKey || e.button === 1) {
                return;
            }

            e.preventDefault();
            e.stopImmediatePropagation();

            const targetUrl = anchor.getAttribute('href');
            if (!targetUrl) return;

            fade.classList.add('active');

            let done = false;
            const onDone = () => {
                if (done) return;
                done = true;
                goTo(targetUrl);
            };

            const onTransitionEnd = (ev) => {
                if (ev.target === fade && (ev.propertyName === 'opacity' || ev.propertyName === 'all')) {
                    onDone();
                }
            };
            fade.addEventListener('transitionend', onTransitionEnd, { once: true });
            setTimeout(onDone, FALLBACK_MS);
        }, true);
    }

});

