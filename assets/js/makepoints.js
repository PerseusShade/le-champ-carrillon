document.addEventListener('DOMContentLoaded', () => {
    const img = document.querySelector('.plan-image');
    if (!img) return;

    function pxToNumber(px) {
        return px ? parseFloat(px.replace('px','')) || 0 : 0;
    }

    const PRECISION = 2;
    const FACTOR = Math.pow(10, PRECISION);

    img.addEventListener('click', (ev) => {
        const rect = img.getBoundingClientRect();

        const cs = getComputedStyle(img);
        const borderLeft = pxToNumber(cs.borderLeftWidth);
        const borderTop    = pxToNumber(cs.borderTopWidth);
        const borderRight = pxToNumber(cs.borderRightWidth);
        const borderBottom = pxToNumber(cs.borderBottomWidth);

        const contentLeft = rect.left + borderLeft;
        const contentTop    = rect.top    + borderTop;
        const contentWidth    = Math.max(0, rect.width - borderLeft - borderRight);
        const contentHeight = Math.max(0, rect.height - borderTop - borderBottom);

        const clickX = ev.clientX;
        const clickY = ev.clientY;

        let xInside = clickX - contentLeft;
        let yInside = clickY - contentTop;

        xInside = Math.max(0, Math.min(xInside, contentWidth));
        yInside = Math.max(0, Math.min(yInside, contentHeight));

        const dotSize = 14;
        const rawX = ((xInside + dotSize/2) / contentWidth) * 100;
        const rawY = ((yInside - 2) / contentHeight) * 100;
        const percentX = Math.round(rawX * FACTOR) / FACTOR;
        const percentY = Math.round(rawY * FACTOR) / FACTOR;

        const percentXStr = percentX.toFixed(PRECISION);
        const percentYStr = percentY.toFixed(PRECISION);

        console.log(`Coordinates (rounded ${PRECISION} decimals): x=${percentXStr}%, y=${percentYStr}%`);
        console.log(
            `HTML snippet:\n<button class="map-point" data-x="${percentXStr}" data-y="${percentYStr}" title="Titre"></button>`
        );

        const dot = document.createElement('div');
        dot.style.position = 'fixed';
        dot.style.left = `${ev.clientX}px`;
        dot.style.top = `${ev.clientY}px`;
        dot.style.transform = 'translate(-50%,-50%)';
        dot.style.width = '10px';
        dot.style.height = '10px';
        dot.style.borderRadius = '50%';
        dot.style.background = 'rgba(0,0,0,0.6)';
        dot.style.pointerEvents = 'none';
        dot.style.zIndex = 9999;
        document.body.appendChild(dot);
        setTimeout(() => dot.remove(), 800);
    });
});
