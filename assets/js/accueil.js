(function () {
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const body = document.body;
    const textBox = () => document.querySelector('.text-box');
    const avatar = () => document.querySelector('.avatar');

    async function runAnimation() {
        if (reduce) {
            body.classList.remove('preload');
            body.classList.add('animate-ready');
            const t = textBox();
            if (t) t.classList.add('show');
            const a = avatar();
            if (a) a.classList.add('reveal');
            return;
        }

        body.classList.remove('preload');
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);

        body.classList.add('animate-ready');
        await wait(1000);
        const tb = textBox();
        if (tb) tb.classList.add('show');
        await wait(900);
        const av = avatar();
        if (av) av.classList.add('reveal');
    }

    function resetAnimationState() {
        body.classList.remove('animate-ready');
        body.classList.add('preload');
        const tb = textBox();
        if (tb) tb.classList.remove('show');
        const av = avatar();
        if (av) av.classList.remove('reveal');
    }

    document.addEventListener('DOMContentLoaded', () => {
        runAnimation().catch(console.error);
    });

    const active = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    resetAnimationState();
    runAnimation().catch(console.error).then(() => {
        try {
            if (active && document.contains(active)) {
                try { active.focus({ preventScroll: true }); } catch (e) { active.focus(); }
            }
        } catch (e) {  }
    });
    window.addEventListener('pagehide', () => {
        resetAnimationState();
    });
})();