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

            allImages.forEach((img, idx) => {
                img.addEventListener('click', () => {
                    if (window.GalleryOverlay && typeof window.GalleryOverlay.open === 'function') {
                        window.GalleryOverlay.open(idx, Array.from(allImages), { enableScroll: true });
                    }
                });
            });

            if (window.GalleryOverlay && typeof window.GalleryOverlay.attachFromNodeList === 'function') {
                window.GalleryOverlay.attachFromNodeList(allImages, { enableScroll: true });
            }
        })
});
