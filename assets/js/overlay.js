(function(){
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
    overlay.style.zIndex = '9999';
    overlay.style.boxSizing = 'border-box';
    overlay.style.pointerEvents = 'auto';
    const mainImg = overlay.querySelector('.main-view');
    const closeBtn = overlay.querySelector('.gallery-close');
    const prevBtn = overlay.querySelector('.gallery-prev');
    const nextBtn = overlay.querySelector('.gallery-next');
    const carousel = overlay.querySelector('.gallery-carousel');
    const carouselInner = overlay.querySelector('.gallery-carousel-inner');
    let currentGroup = [];
    let currentIndex = 0;
    let enableScrollHandlers = false;
    let SWIPE_THRESHOLD = 60;
    let startX = 0;
    let startY = 0;
    let isPointerDown = false;
    function clearCarousel() { carouselInner.innerHTML = ''; }
    function buildCarouselFromGroup(group){
        clearCarousel();
        group.forEach((item, idx)=>{
            const thumb = document.createElement('img');
            thumb.src = item.src || item;
            thumb.dataset.index = idx;
            thumb.alt = item.alt || '';
            thumb.addEventListener('click', e=>{ e.stopPropagation(); showImage(idx); });
            carouselInner.appendChild(thumb);
        });
    }
    function showImage(index){
        currentIndex = index;
        if (!currentGroup[currentIndex]) return;
        mainImg.style.opacity = 0;
        setTimeout(()=>{
            mainImg.src = currentGroup[currentIndex].src || currentGroup[currentIndex];
            mainImg.alt = currentGroup[currentIndex].alt || '';
            mainImg.style.opacity = 1;
        },100);
        const thumbs = carouselInner.querySelectorAll('img');
        thumbs.forEach(t=> t.classList.toggle('active', parseInt(t.dataset.index,10)===currentIndex));
        requestAnimationFrame(()=>{
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
        });
    }
    function openOverlay(index, group, opts = {}){
        currentGroup = group.slice ? group.slice() : Array.from(group);
        currentIndex = Math.min(Math.max(0, index|0), Math.max(0, currentGroup.length-1));
        buildCarouselFromGroup(currentGroup);
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(()=>{
            overlay.style.opacity = 1;
            showImage(currentIndex);
        });
        enableScrollHandlers = !!opts.enableScroll;
    }
    function closeOverlay(){
        overlay.style.opacity = 0;
        overlay.addEventListener('transitionend', hide, { once: true });
    }
    function hide(){ overlay.style.display = 'none'; document.body.style.overflow = ''; }
    function navigate(dir){ if (!currentGroup || !currentGroup.length) return; currentIndex = (currentIndex + dir + currentGroup.length) % currentGroup.length; showImage(currentIndex); }
    closeBtn.addEventListener('click', e=>{ e.stopPropagation(); closeOverlay(); });
    prevBtn.addEventListener('click', e=>{ e.stopPropagation(); navigate(-1); });
    nextBtn.addEventListener('click', e=>{ e.stopPropagation(); navigate(1); });
    overlay.addEventListener('click', e=>{ if (e.target === overlay) closeOverlay(); });
    document.addEventListener('keydown', e=>{
        if (overlay.style.display === 'flex'){
            if (e.key === 'ArrowRight') navigate(1);
            else if (e.key === 'ArrowLeft') navigate(-1);
            else if (e.key === 'Escape') closeOverlay();
        }
    });
    function onTouchStart(e){ const t = e.touches ? e.touches[0] : e; startX = t.clientX; startY = t.clientY; }
    function onTouchEnd(e){ const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e; const dx = t.clientX - startX; const dy = t.clientY - startY; if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) navigate(dx < 0 ? 1 : -1); }
    mainImg.addEventListener('touchstart', onTouchStart, { passive: true });
    mainImg.addEventListener('touchend', onTouchEnd, { passive: true });
    overlay.addEventListener('touchstart', onTouchStart, { passive: true });
    overlay.addEventListener('touchend', onTouchEnd, { passive: true });
    mainImg.addEventListener('pointerdown', e=>{ isPointerDown = true; startX = e.clientX; startY = e.clientY; try{ mainImg.setPointerCapture(e.pointerId); }catch(_){} });
    mainImg.addEventListener('pointerup', e=>{ if (!isPointerDown) return; isPointerDown = false; const dx = e.clientX - startX; const dy = e.clientY - startY; if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) navigate(dx < 0 ? 1 : -1); });
    mainImg.addEventListener('pointercancel', ()=>{ isPointerDown = false; });
    overlay.addEventListener('wheel', e=>{
        if (!enableScrollHandlers) return;
        if (Math.abs(e.deltaX) > 10){ navigate(e.deltaX > 0 ? 1 : -1); e.preventDefault(); }
    }, { passive: false });
    function attachFromNodeList(nodes, opts = {}){ const arr = Array.from(nodes); arr.forEach((img, idx)=>{ img.addEventListener('click', ()=> openOverlay(idx, arr, { enableScroll: !!opts.enableScroll })); }); }
    function attachGroupsByContainer(containerSelector, imgSelector, opts = {}){ const containers = document.querySelectorAll(containerSelector); containers.forEach(container=>{ const imgs = Array.from(container.querySelectorAll(imgSelector)); imgs.forEach((img, idx)=> img.addEventListener('click', ()=> openOverlay(idx, imgs, { enableScroll: !!opts.enableScroll }))); }); }
    window.GalleryOverlay = { open: openOverlay, close: closeOverlay, attachFromNodeList, attachGroupsByContainer };
})();
