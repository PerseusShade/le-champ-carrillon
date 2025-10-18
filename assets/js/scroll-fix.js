(function () {
    'use strict';

    function makeScrollableFocusable(el) {
        if (!el || el.dataset.scrollfix === '1') return;
        try {
            el.setAttribute('tabindex', '0');
            el.style.webkitOverflowScrolling = 'touch';
            el.style.touchAction = 'auto';
            el.style.overscrollBehavior = 'contain';
            el.style.outline = 'none';
            el.style.boxSizing = 'border-box';

            el.addEventListener('touchstart', function onTouchStart() {
                try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
            }, { passive: true });

            el.addEventListener('touchmove', (ev) => { ev.stopPropagation(); }, { passive: false });
            el.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); }, { passive: true });
            el.addEventListener('wheel', (ev) => { ev.stopPropagation(); }, { passive: true });

            el.addEventListener('keydown', (ev) => {
                const keys = ['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '];
                if (keys.includes(ev.key)) ev.stopPropagation();
            });

            el.dataset.scrollfix = '1';
        } catch (e) {
            console.warn('scroll-fix: failed to patch element', e);
        }
    }

    const SELECTORS = [
        '.morph-info-box',
        '.info-box',
        '.panel .info-box',
        '.morph-overlay .morph-info-box',
        '.info-wrap .info-box',
        '.scroll-fix-target'
    ];

    function patchExisting() {
        SELECTORS.forEach(sel => {
            document.querySelectorAll(sel).forEach(makeScrollableFocusable);
        });
    }

    function observeAddedNodes() {
        const mo = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'childList' && m.addedNodes && m.addedNodes.length) {
                    m.addedNodes.forEach(node => {
                        if (!(node instanceof Element)) return;
                        SELECTORS.forEach(sel => {
                            if (node.matches && node.matches(sel)) makeScrollableFocusable(node);
                        });
                        SELECTORS.forEach(sel => {
                            node.querySelectorAll && node.querySelectorAll(sel).forEach(makeScrollableFocusable);
                        });
                    });
                }
            }
        });

        mo.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { patchExisting(); observeAddedNodes(); });
    } else {
        patchExisting(); observeAddedNodes();
    }
})();
