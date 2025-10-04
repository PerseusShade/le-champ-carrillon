function debounce(fn, ms = 100) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

function fixOddImages() {
    document.querySelectorAll('.post').forEach(post => {
        const texte = post.querySelector('.post-text');
        const photosGrid = post.querySelector('.photos-grid');
        const postPhotosWrapper = post.querySelector('.post-photos');
        const postBody = post.querySelector('.post-body');

        if (texte) {
            texte.style.display = '';
            texte.style.gridColumn = '';
        }
        if (postPhotosWrapper) {
            postPhotosWrapper.style.flex = '';
        }
        if (photosGrid) {
            photosGrid.style.gridTemplateColumns = '';
            photosGrid.style.width = '';
        }
        if (!photosGrid) {
            if (texte) {
                texte.style.display = 'block';
                if (postBody && getComputedStyle(postBody).display === 'flex') {
                    texte.style.flex = '1 1 100%';
                }
            }
            return;
        }

        const imgs = Array.from(photosGrid.querySelectorAll('img'));
        if (imgs.length === 0) {
            if (texte) {
                texte.style.display = 'block';
                if (postBody && getComputedStyle(postBody).display === 'flex') {
                    texte.style.flex = '1 1 100%';
                }
            }
            return;
        }

        const textEmpty = !texte || !(texte.textContent || '').trim().length;
        if (textEmpty) {
            if (texte) {
                texte.style.display = 'none';
            }
            if (postPhotosWrapper) {
                postPhotosWrapper.style.flex = '1 1 100%';
            }
            photosGrid.style.width = '100%';
            photosGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
            imgs.forEach(img => {
                img.style.gridColumn = '';
                img.style.height = '';
                img.style.objectFit = '';
            });
            return;
        }

        if (texte) {
            texte.style.display = '';
            texte.style.flex = '';
        }
        if (postPhotosWrapper) {
            postPhotosWrapper.style.flex = '';
        }
        imgs.forEach(img => {
            img.style.gridColumn = '';
            img.style.height = '';
            img.style.objectFit = '';
        });

        if (imgs.length % 2 === 1) {
            const hTexte = texte ? texte.getBoundingClientRect().height : 0;
            const rows = Math.ceil(imgs.length / 2);
            const rowH = hTexte > 0 ? hTexte / rows : null;
            const last = imgs[imgs.length - 1];

            last.style.gridColumn = 'span 2';
            last.style.objectFit = 'cover';
            if (rowH) last.style.height = `${rowH}px`;
            else last.style.height = '';
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    fixOddImages();
    window.addEventListener("resize", debounce(fixOddImages, 100));

    (function(){
        const title = document.querySelector('.actualites-title');
        const posts = Array.from(document.querySelectorAll('.post'));
        if (!posts.length) return;

        if (title && !title.classList.contains('fade-in')) title.classList.add('fade-in');
        posts.forEach(p => p.classList.add('fade-in'));

        let animationTimers = [];
        let postsAnimated = false;

        function clearPostTimers() {
            animationTimers.forEach(id => clearTimeout(id));
            animationTimers = [];
        }

        function animatePostsByVisibility() {
            clearPostTimers();
            postsAnimated = false;

            requestAnimationFrame(() => {
                const viewportBottom = window.innerHeight;
                const margin = 20;
                const visible = posts.filter(p => p.getBoundingClientRect().top < viewportBottom - margin);
                const hidden = posts.filter(p => !visible.includes(p));

                hidden.forEach(p => p.classList.remove('fade-in'));

                if (title) title.classList.remove('show');
                posts.forEach(p => p.classList.remove('show'));

                const delayBeforeTitle = 250;
                const startAfterTitle = 220;
                const delayBetweenPosts = 240;

                const tTitle = setTimeout(() => {
                    if (title) title.classList.add('show');

                    visible.forEach((p, i) => {
                        const t = setTimeout(() => {
                            p.classList.add('show');
                            if (i === visible.length - 1) {
                                postsAnimated = true;
                            }
                        }, startAfterTitle + i * delayBetweenPosts);
                        animationTimers.push(t);
                    });

                    if (visible.length === 0) {
                        postsAnimated = true;
                    }
                }, delayBeforeTitle);

                animationTimers.push(tTitle);
            });
        }

        animatePostsByVisibility();

        let resizeDeb = null;
        window.addEventListener('resize', () => {
            if (postsAnimated) return;
            clearTimeout(resizeDeb);
            resizeDeb = setTimeout(() => {
                animatePostsByVisibility();
            }, 140);
        });
    })();


    const allImages = document.querySelectorAll('.post-photos img');
    if (!allImages.length) return;

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
    const carouselInner = overlay.querySelector('.gallery-carousel-inner');

    let currentIndex = 0;
    let currentGroup = [];

    function showImage(index) {
        currentIndex = index;

        const thumbs = carouselInner.querySelectorAll('img');
        const sourceImg = currentGroup[currentIndex];

        mainImg.style.opacity = 0;
        setTimeout(() => {
            mainImg.src = sourceImg.src;
            mainImg.alt = sourceImg.alt;
            mainImg.style.opacity = 1;
        }, 100);

        thumbs.forEach(thumb => {
            thumb.classList.toggle('active', parseInt(thumb.dataset.index) === currentIndex);
        });

        requestAnimationFrame(() => {
            const wrapperW = overlay.querySelector('.gallery-carousel').clientWidth;
            const active = thumbs[currentIndex];
            const thumbW = active.getBoundingClientRect().width;
            const pad = (wrapperW - thumbW) / 2;

            carouselInner.style.paddingLeft = `${pad}px`;
            carouselInner.style.paddingRight = `${pad}px`;

            const offset = active.offsetLeft + thumbW / 2;
            const translateX = wrapperW / 2 - offset;
            carouselInner.style.transform = `translateX(${translateX}px)`;
        });
    }

    function openOverlay(index, group) {
        currentGroup = group;
        currentIndex = index;

        carouselInner.innerHTML = '';

        group.forEach((img, idx) => {
            const thumb = document.createElement('img');
            thumb.src = img.src;
            thumb.dataset.index = idx;
            thumb.addEventListener('click', e => {
                e.stopPropagation();
                showImage(idx);
            });
            carouselInner.appendChild(thumb);
        });

        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        requestAnimationFrame(() => {
            overlay.style.opacity = 1;
            showImage(index);
        });
    }

    function closeOverlay() {
        overlay.style.opacity = 0;
        overlay.addEventListener('transitionend', () => {
            overlay.style.display = 'none';
            document.body.style.overflow = '';
        }, { once: true });
    }

    function navigate(dir) {
        currentIndex = (currentIndex + dir + currentGroup.length) % currentGroup.length;
        showImage(currentIndex);
    }

    closeBtn.addEventListener('click', e => {
        e.stopPropagation();
        closeOverlay();
    });

    prevBtn.addEventListener('click', e => {
        e.stopPropagation();
        navigate(-1);
    });

    nextBtn.addEventListener('click', e => {
        e.stopPropagation();
        navigate(1);
    });

    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeOverlay();
    });

    document.addEventListener('keydown', e => {
        if (overlay.style.display === 'flex') {
            if (e.key === 'ArrowRight') navigate(1);
            else if (e.key === 'ArrowLeft') navigate(-1);
            else if (e.key === 'Escape') closeOverlay();
        }
    });

    allImages.forEach(img => {
        const postPhotos = img.closest('.post-photos');
        const groupImages = [...postPhotos.querySelectorAll('img')];
        const indexInGroup = groupImages.indexOf(img);

        img.addEventListener('click', () => {
            openOverlay(indexInGroup, groupImages);
        });
    });
});
