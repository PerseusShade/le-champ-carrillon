document.addEventListener('DOMContentLoaded', () => {
    fetch('../components/header.html')
        .then(res => res.text())
        .then(html => {
            const container = document.getElementById('header');
            container.innerHTML = html;
            updateHeaderHeight();
            initHeaderNavigation(container);
            playMenuAppearIfFromIndex(container);
        })
});

window.addEventListener('resize', updateHeaderHeight);

function updateHeaderHeight() {
    const header = document.getElementById('header');
    if (!header) return;
    const rect = header.getBoundingClientRect();
    const styles = getComputedStyle(header);
    const borderTop = parseFloat(styles.borderTopWidth) || 0;
    const borderBottom = parseFloat(styles.borderBottomWidth) || 0;
    const trueHeight = rect.height - borderTop - borderBottom;
    document.documentElement.style.setProperty('--header-height', `${trueHeight}px`);
}

function initHeaderNavigation(container) {
    const fade = document.getElementById("page-fade");
    const fadeLogo = document.getElementById("page-fade-logo");

    const navLinks = container.querySelectorAll(".main-nav a");
    const btnContact = container.querySelector(".btn-contact");
    const logoLink = container.querySelector(".logo-header");

    markActivePage(container, navLinks, btnContact);

    navLinks.forEach(link => {
        if (link.classList.contains('active') || link.getAttribute('aria-current') === 'page') {
            link.setAttribute('tabindex', '-1');
            return;
        }

        link.addEventListener("click", (e) => {
            e.preventDefault();
            const targetUrl = link.getAttribute("href");
            if (!fade) {
                window.location.href = targetUrl;
                return;
            }
            fade.classList.add("active");
            fade.addEventListener("transitionend", () => {
                window.location.href = targetUrl;
            }, { once: true });
        });
    });

    if (btnContact) {
        if (!btnContact.classList.contains('active')) {
            btnContact.addEventListener("click", (e) => {
                e.preventDefault();
                const targetUrl = btnContact.getAttribute("href");
                if (!fade) {
                    window.location.href = targetUrl;
                    return;
                }
                fade.classList.add("active");
                fade.addEventListener("transitionend", () => {
                    window.location.href = targetUrl;
                }, { once: true });
            });
        }
    }

    if (logoLink) {
        logoLink.addEventListener("click", (e) => {
            e.preventDefault();
            const targetUrl = logoLink.getAttribute("href");
            if (!fadeLogo) {
                window.location.href = targetUrl;
                return;
            }
            fadeLogo.classList.add("active");
            fadeLogo.addEventListener("transitionend", () => {
                window.location.href = targetUrl;
            }, { once: true });
        });
    }
}

function markActivePage(container, navLinks, btnContact) {
    const normalizePath = (p) => {
        if (!p) return '/';
        try {
            const resolved = new URL(p, document.baseURI).pathname;
            let clean = resolved.replace(/\/+$/, '');
            clean = clean.replace(/\/index\.html$/i, '') || '/';
            return clean;
        } catch (e) {
            let s = (p + '').replace(/\/+$/, '').replace(/\/index\.html$/i, '') || '/';
            return s;
        }
    };

    const currentPath = normalizePath(window.location.pathname);

    navLinks.forEach(link => {
        const href = link.getAttribute('href') || '';
        const linkPath = normalizePath(href);
        if (linkPath === currentPath) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        } else {
            link.classList.remove('active');
            link.removeAttribute('aria-current');
        }
    });

    if (btnContact) {
        const contactHref = btnContact.getAttribute('href') || '/pages/contact.html';
        if (normalizePath(contactHref) === currentPath) {
            btnContact.classList.add('active');
            btnContact.setAttribute('aria-current', 'page');
        } else {
            btnContact.classList.remove('active');
            btnContact.removeAttribute('aria-current');
        }
    }
}
