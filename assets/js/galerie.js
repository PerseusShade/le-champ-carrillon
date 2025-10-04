document.addEventListener('DOMContentLoaded', () => {
    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    const manifestUrl = '../assets/img/galerie/manifest.json';

    fetch(manifestUrl)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
            return res.json();
        })
        .then(images => {
            const shuffled = shuffle(images.slice());
            const grid = document.getElementById('photos-grid');

            grid.innerHTML = '';
            shuffled.forEach((file, index) => {
                const div = document.createElement('div');
                div.className = 'gallery-item';
                const img = document.createElement('img');
                img.src = `../assets/img/galerie/${file}`;
                img.alt = `Photo ${index + 1}`;
                img.dataset.index = index;
                div.appendChild(img);
                grid.appendChild(div);
            });

            const title = document.querySelector('.galerie-title');
            const items = Array.from(grid.querySelectorAll('.gallery-item'));

            if (title) title.classList.add('fade-in');
            items.forEach(item => item.classList.add('fade-in'));

            let animationTimers = [];
            let rowsAnimated = false;
            function clearTimers() {
                animationTimers.forEach(id => clearTimeout(id));
                animationTimers = [];
            }

            function computeRows(tolerance = 8) {
                const rows = [];
                items.forEach(item => {
                    const top = Math.round(item.getBoundingClientRect().top);
                    let row = rows.find(r => Math.abs(r.top - top) <= tolerance);
                    if (!row) {
                        row = { top, items: [] };
                        rows.push(row);
                    }
                    row.items.push(item);
                });
                rows.sort((a, b) => a.top - b.top);
                return rows;
            }

            function animateByRows() {
                clearTimers();
                rowsAnimated = false;

                requestAnimationFrame(() => {
                    const rows = computeRows(8);

                    const delayBeforeTitle = 200;
                    const startAfterTitle = 300;
                    const delayBetweenRows = 200;

                    if (title) title.classList.remove('show');
                    items.forEach(it => it.classList.remove('show'));

                    const visibleRows = [];
                    const hiddenRows = [];
                    const viewportBottom = window.innerHeight;
                    const margin = 20;
                    rows.forEach(r => {
                        if (r.top < viewportBottom - margin) visibleRows.push(r);
                        else hiddenRows.push(r);
                    });

                    const tTitle = setTimeout(() => {
                        if (title) title.classList.add('show');
                        visibleRows.forEach((row, rowIndex) => {
                            const t = setTimeout(() => {
                                row.items.forEach(it => it.classList.add('show'));
                                if (rowIndex === visibleRows.length - 1) {
                                    rowsAnimated = true;
                                }
                            }, startAfterTitle + rowIndex * delayBetweenRows);
                            animationTimers.push(t);
                        });

                        if (hiddenRows.length > 0) {
                            const lastRowDelay = startAfterTitle + Math.max(0, visibleRows.length - 1) * delayBetweenRows;
                            const tHidden = setTimeout(() => {
                                hiddenRows.forEach(r => r.items.forEach(it => it.classList.add('show')));
                                if (visibleRows.length === 0) rowsAnimated = true;
                            }, lastRowDelay);
                            animationTimers.push(tHidden);
                        }

                        if (visibleRows.length === 0) {
                            items.forEach(it => it.classList.add('show'));
                            rowsAnimated = true;
                        }
                    }, delayBeforeTitle);

                    animationTimers.push(tTitle);
                });
            }

            animateByRows();

            let resizeDebounce = null;
            window.addEventListener('resize', () => {
                if (rowsAnimated) return;
                clearTimeout(resizeDebounce);
                resizeDebounce = setTimeout(() => {
                    animateByRows();
                }, 140);
            });

            const allImages = grid.querySelectorAll('img');
            let currentIndex = 0;

            const overlay = document.createElement('div');
            overlay.className = 'gallery-overlay';
            overlay.innerHTML = `
                <div class="gallery-close" title="Fermer">&times;</div>
                <div class="gallery-nav gallery-prev">&#10094;</div>
                <img class="main-view" src="" alt="">
                <div class="gallery-nav gallery-next">&#10095;</div>
                <div class="gallery-carousel">
                    <div class="gallery-carousel-inner"></div>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.style.display = 'none';
            overlay.style.opacity = 0;
            overlay.style.transition = 'opacity 200ms ease';

            const mainImg = overlay.querySelector('.main-view');
            const closeBtn = overlay.querySelector('.gallery-close');
            const prevBtn = overlay.querySelector('.gallery-prev');
            const nextBtn = overlay.querySelector('.gallery-next');
            const carousel = overlay.querySelector('.gallery-carousel');
            const carouselInner = overlay.querySelector('.gallery-carousel-inner');

            allImages.forEach((img, idx) => {
                const thumb = document.createElement('img');
                thumb.src = img.src;
                thumb.dataset.index = idx;
                thumb.addEventListener('click', e => {
                    e.stopPropagation();
                    showImage(idx);
                });
                carouselInner.appendChild(thumb);
            });

            function showImage(index) {
                currentIndex = index;
                if (!allImages[currentIndex]) return;

                mainImg.style.opacity = 0;
                setTimeout(() => {
                    mainImg.src = allImages[currentIndex].src;
                    mainImg.alt = allImages[currentIndex].alt;
                    mainImg.style.opacity = 1;
                }, 100);

                const thumbs = carouselInner.querySelectorAll('img');
                thumbs.forEach(thumb => {
                    thumb.classList.toggle('active', parseInt(thumb.dataset.index, 10) === currentIndex);
                });

                const wrapperW = carousel.clientWidth || window.innerWidth;
                const active = thumbs[currentIndex];
                if (!active) return;
                const thumbW = active.getBoundingClientRect().width || 80;
                const pad = Math.max((wrapperW - thumbW) / 2, 0);
                carouselInner.style.paddingLeft = `${pad}px`;
                carouselInner.style.paddingRight = `${pad}px`;
                const offset = active.offsetLeft + thumbW / 2;
                const translateX = wrapperW / 2 - offset;
                carouselInner.style.transform = `translateX(${translateX}px)`;
            }

            function openOverlay(index) {
                showImage(index);
                overlay.style.display = 'flex';
                document.body.style.overflow = 'hidden';
                requestAnimationFrame(() => {
                    overlay.style.opacity = 1;
                    showImage(index);
                });
            }

            function closeOverlay() {
                overlay.style.opacity = 0;
                overlay.addEventListener('transitionend', hideOverlay, { once: true });
            }

            function hideOverlay() {
                overlay.style.display = 'none';
                document.body.style.overflow = '';
            }

            function navigate(direction) {
                currentIndex = (currentIndex + direction + allImages.length) % allImages.length;
                showImage(currentIndex);
            }

            allImages.forEach((img, idx) => {
                img.addEventListener('click', () => openOverlay(idx));
            });

            closeBtn.addEventListener('click', e => { e.stopPropagation(); closeOverlay(); });
            prevBtn.addEventListener('click', e => { e.stopPropagation(); navigate(-1); });
            nextBtn.addEventListener('click', e => { e.stopPropagation(); navigate(1); });

            overlay.addEventListener('click', e => {
                if (e.target === overlay) closeOverlay();
            });

            document.addEventListener('keydown', (e) => {
                if (overlay.style.display === 'flex') {
                    if (e.key === 'ArrowRight') navigate(1);
                    if (e.key === 'ArrowLeft') navigate(-1);
                    if (e.key === 'Escape') closeOverlay();
                }
            });
        })
});
