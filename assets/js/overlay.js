(function(){
    const existing = document.querySelector('.gallery-overlay');
    if (existing) existing.remove();
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
    let currentGroup = [];
    let currentIndex = 0;
    let enableScrollHandlers = false;
    const SWIPE_THRESHOLD = 60;
    let startX = 0;
    let startY = 0;
    let isPointerDown = false;
    let lastNavTime = 0;
    const NAV_DEBOUNCE = 300;
    function toSrc(item){ if (!item) return ''; if (typeof item === 'string') return item; if (item.src) return item.src; return '';}
    function toAlt(item){ if (!item) return ''; if (typeof item === 'string') return ''; if (item.alt) return item.alt; return '';}
    function clearCarousel(){ carouselInner.innerHTML = ''; }
    function buildCarouselFromGroup(group){
        clearCarousel();
        group.forEach((item, idx)=>{
            const thumb = document.createElement('img');
            thumb.src = toSrc(item);
            thumb.dataset.index = idx;
            thumb.alt = toAlt(item);
            thumb.addEventListener('click', e=>{ e.stopPropagation(); showImage(idx); });
            carouselInner.appendChild(thumb);
        });
    }
    function centerActiveThumb(){
        const thumbs = carouselInner.querySelectorAll('img');
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
    function showImage(index){
        currentIndex = index;
        if (!currentGroup[currentIndex]) return;
        mainImg.style.opacity = 0;
        setTimeout(()=>{
            mainImg.src = toSrc(currentGroup[currentIndex]);
            mainImg.alt = toAlt(currentGroup[currentIndex]);
            mainImg.style.opacity = 1;
        },100);
        const thumbs = carouselInner.querySelectorAll('img');
        thumbs.forEach(t=> t.classList.toggle('active', parseInt(t.dataset.index,10)===currentIndex));
        requestAnimationFrame(()=>{ centerActiveThumb(); });
    }
    function open(index, group, opts){
        const arr = Array.isArray(group) ? group.slice() : Array.from(group || []);
        currentGroup = arr;
        currentIndex = Math.min(Math.max(0, index|0), Math.max(0, arr.length-1));
        buildCarouselFromGroup(currentGroup);
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(()=>{
            overlay.style.opacity = 1;
            showImage(currentIndex);
        });
        enableScrollHandlers = !!(opts && opts.enableScroll);
    }
    function close(){
        overlay.style.opacity = 0;
        overlay.addEventListener('transitionend', function h(){ overlay.style.display = 'none'; document.body.style.overflow = ''; overlay.removeEventListener('transitionend', h); }, { once: true });
        enableScrollHandlers = false;
    }
    function navigate(dir){
        if (!currentGroup || !currentGroup.length) return;
        currentIndex = (currentIndex + dir + currentGroup.length) % currentGroup.length;
        showImage(currentIndex);
    }
    function triggerNavigate(dir){
        const now = Date.now();
        if (now - lastNavTime < NAV_DEBOUNCE) return;
        lastNavTime = now;
        navigate(dir);
    }
    closeBtn.addEventListener('click', e=>{ e.stopPropagation(); close(); });
    prevBtn.addEventListener('click', e=>{ e.stopPropagation(); triggerNavigate(-1); });
    nextBtn.addEventListener('click', e=>{ e.stopPropagation(); triggerNavigate(1); });
    overlay.addEventListener('click', e=>{ if (e.target === overlay) close(); });
    document.addEventListener('keydown', e=>{
        if (overlay.style.display === 'flex'){
            if (e.key === 'ArrowRight') triggerNavigate(1);
            else if (e.key === 'ArrowLeft') triggerNavigate(-1);
            else if (e.key === 'Escape') close();
        }
    });
    function onTouchStart(e){ const t = e.touches ? e.touches[0] : e; startX = t.clientX; startY = t.clientY; }
    function onTouchEnd(e){ const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e; const dx = t.clientX - startX; const dy = t.clientY - startY; if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) triggerNavigate(dx < 0 ? 1 : -1); }
    overlay.addEventListener('touchstart', onTouchStart, { passive: true });
    overlay.addEventListener('touchend', onTouchEnd, { passive: true });
    mainImg.addEventListener('pointerdown', e=>{ isPointerDown = true; startX = e.clientX; startY = e.clientY; try{ mainImg.setPointerCapture(e.pointerId); }catch(_){} });
    mainImg.addEventListener('pointerup', e=>{ if (!isPointerDown) return; isPointerDown = false; const dx = e.clientX - startX; const dy = e.clientY - startY; if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) triggerNavigate(dx < 0 ? 1 : -1); });
    mainImg.addEventListener('pointercancel', ()=>{ isPointerDown = false; });
    overlay.addEventListener('wheel', e=>{
        if (!enableScrollHandlers) return;
        if (Math.abs(e.deltaX) > 10){ triggerNavigate(e.deltaX > 0 ? 1 : -1); e.preventDefault(); }
        else if (Math.abs(e.deltaY) > 120 && Math.abs(e.deltaX) > Math.abs(e.deltaY)){ triggerNavigate(e.deltaX > 0 ? 1 : -1); e.preventDefault(); }
    }, { passive: false });
    function attachFromNodeList(nodes, opts){ const arr = Array.from(nodes||[]); arr.forEach((img, idx)=> img.addEventListener('click', ()=> open(idx, arr, { enableScroll: !!(opts&&opts.enableScroll) }))); }
    function attachGroupsByContainer(containerSelector, imgSelector, opts){
        const containers = document.querySelectorAll(containerSelector);
        containers.forEach(container=>{
            const imgs = Array.from(container.querySelectorAll(imgSelector));
            imgs.forEach((img, idx)=> img.addEventListener('click', ()=> open(idx, imgs, { enableScroll: !!(opts&&opts.enableScroll) })));
        });
    }
    window.GalleryOverlay = { open, close, attachFromNodeList, attachGroupsByContainer };
})();
