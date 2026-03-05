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
                img.classList.remove('span-2');
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
            last.classList.add('span-2');

            last.style.objectFit = 'cover';

            if (rowH) {
                last.style.height = `${rowH}px`;
            } else {
                last.style.height = '';
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    fixOddImages();
    window.addEventListener("resize", debounce(fixOddImages, 100));

    window.addEventListener('orientationchange', debounce(fixOddImages, 150));
    setTimeout(fixOddImages, 120);

    (function(){
        const title = document.querySelector('.actualites-title');
        const posts = Array.from(document.querySelectorAll('.post'));
        const loadMoreBtn = document.querySelector('.see-more-btn');

        if (!posts.length) return;

        const POSTS_PER_PAGE = 5;
        let visibleCount = POSTS_PER_PAGE;
        let allVisible = posts.length <= visibleCount;

        if (!allVisible) {
            posts.forEach((p, i) => {
                if (i >= visibleCount) {
                    p.style.display = 'none';
                }
            });
        }

        if (title && !title.classList.contains('fade-in')) title.classList.add('fade-in');

        posts.forEach(p => {
            if (p.style.display !== 'none') p.classList.add('fade-in');
        });

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

                const activePosts = posts.filter(p => p.style.display !== 'none');
                const visible = activePosts.filter(p => p.getBoundingClientRect().top < viewportBottom - margin);
                const hidden = activePosts.filter(p => !visible.includes(p));

                hidden.forEach(p => p.classList.remove('fade-in'));

                if (title) title.classList.remove('show');
                activePosts.forEach(p => p.classList.remove('show'));

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

        if (loadMoreBtn) {
            const originalText = loadMoreBtn.textContent;

            loadMoreBtn.addEventListener('click', async (e) => {
                if (allVisible) return;

                e.preventDefault();

                loadMoreBtn.textContent = 'Chargement...';
                loadMoreBtn.style.pointerEvents = 'none';
                loadMoreBtn.style.opacity = '0.7';

                const nextCount = visibleCount + POSTS_PER_PAGE;
                const newPosts = [];
                const imagePromises = [];

                for (let i = visibleCount; i < nextCount && i < posts.length; i++) {
                    newPosts.push(posts[i]);
                    const imgs = posts[i].querySelectorAll('img');

                    imgs.forEach(img => {
                        imagePromises.push(new Promise(resolve => {
                            if (img.complete && img.naturalHeight !== 0) {
                                resolve();
                            } else {
                                const tempImg = new Image();
                                tempImg.onload = resolve;
                                tempImg.onerror = resolve;
                                tempImg.src = img.src;
                            }
                        }));
                    });
                }

                await Promise.all(imagePromises);

                newPosts.forEach(p => {
                    p.style.display = '';
                    p.classList.add('fade-in');
                });

                visibleCount = nextCount;

                if (visibleCount >= posts.length) {
                    allVisible = true;
                }

                loadMoreBtn.textContent = originalText;
                loadMoreBtn.style.pointerEvents = '';
                loadMoreBtn.style.opacity = '1';

                fixOddImages();

                setTimeout(() => {
                    animatePostsByVisibility();
                }, 50);
            });
        }
    })();

    const allImages = document.querySelectorAll('.post-photos img');
    if (!allImages.length) return;

    if (window.GalleryOverlay && typeof window.GalleryOverlay.attachGroupsByContainer === 'function') {
        window.GalleryOverlay.attachGroupsByContainer('.post-photos', 'img', { enableScroll: false });
    } else {
        allImages.forEach(img => {
            const postPhotos = img.closest('.post-photos');
            const groupImages = Array.from(postPhotos.querySelectorAll('img'));
            const indexInGroup = groupImages.indexOf(img);
            img.addEventListener('click', () => {
                if (window.GalleryOverlay && typeof window.GalleryOverlay.open === 'function') {
                    window.GalleryOverlay.open(indexInGroup, groupImages, { enableScroll: false });
                }
            });
        });
    }
});
