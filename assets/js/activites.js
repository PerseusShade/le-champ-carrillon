document.addEventListener("DOMContentLoaded", () => {
    const container = document.querySelector(".activites-container");
    let animating = false;

    const JSON_URL = "../assets/img/activites/activites.json";

    const initialDelay = 250;
    const stagger = 120;

    fetch(JSON_URL)
        .then(res => {
            if (!res.ok) throw new Error("Impossible de charger le JSON des activités");
            return res.json();
        })
        .then(data => {
            if (!Array.isArray(data)) throw new Error("JSON invalide : attendu un tableau.");

            data.slice(0, 4).forEach(item => {
                const panel = document.createElement("div");
                panel.className = "panel hidden";
                panel.setAttribute("data-id", item.id ?? "");
                panel.dataset.infoText = item.text ?? "";

                const imagePath = item.image ? `../assets/img/activites/${item.image}` : "";
                if (imagePath) panel.style.backgroundImage = `url('${imagePath}')`;

                const inner = document.createElement("div");
                inner.className = "panel-inner";

                const label = document.createElement("div");
                label.className = "label";
                label.textContent = item.title ?? "";

                inner.appendChild(label);
                panel.appendChild(inner);
                container.appendChild(panel);
            });

            const panels = Array.from(container.querySelectorAll(".panel"));
            panels.forEach((p, i) => {
                setTimeout(() => {
                    p.classList.remove("hidden");
                    p.classList.add("visible");
                }, initialDelay + i * stagger);
            });

            setTimeout(() => {
                attachPanelHandlers(container);
            }, initialDelay + panels.length * stagger + 150);
        })
        .catch(err => {
            console.error("Erreur lors du chargement des activités :", err);
        });

    function attachPanelHandlers(container) {
        const panels = container.querySelectorAll(".panel");
        panels.forEach(panel => {
            panel.addEventListener("click", () => {
                if (animating) return;
                animating = true;

                const rect = panel.getBoundingClientRect();

                container.classList.add("locked");
                panel.classList.add("active");

                panels.forEach(p => {
                    if (p !== panel) {
                        p.style.transition = "opacity 0.5s ease";
                        p.style.opacity = "0";
                    }
                });

                const clone = panel.cloneNode(true);
                clone.classList.add("fullscreen-panel");

                document.body.appendChild(clone);

                Object.assign(clone.style, {
                    top:    `${rect.top}px`,
                    left:   `${rect.left}px`,
                    width:  `${rect.width}px`,
                    height: `${rect.height}px`
                });

                const cloneLabel = clone.querySelector(".label");
                if (cloneLabel) {
                    cloneLabel.classList.add("title-box");
                    cloneLabel.style.marginBottom = "0";
                }

                const closeBtn = document.createElement("button");
                closeBtn.classList.add("close-btn");
                closeBtn.innerHTML = "&#10005;";
                clone.appendChild(closeBtn);

                const infoWrap = document.createElement("div");
                infoWrap.className = "info-wrap";
                const infoBox = document.createElement("div");
                infoBox.className = "info-box";
                infoBox.innerHTML = panel.dataset.infoText || "";
                infoWrap.appendChild(infoBox);
                clone.appendChild(infoWrap);

                const originalLabel = panel.querySelector(".label");
                const labelRect = originalLabel ? originalLabel.getBoundingClientRect() : { top: rect.top };
                const initialLabelOffset = labelRect.top - rect.top;

                const headerHeightRaw = getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '60px';
                const headerHeight = parseFloat(headerHeightRaw) || 60;
                const finalLabelOffset = (headerHeight + 50) - rect.top;

                if (cloneLabel) {
                    cloneLabel.classList.add("title-box");
                    cloneLabel.style.position = "absolute";
                    cloneLabel.style.left = "50%";

                    const initialTopInClone = initialLabelOffset;
                    cloneLabel.style.top = `${initialTopInClone}px`;
                    cloneLabel.style.bottom = "auto";

                    cloneLabel.style.transform = "translateX(-50%) translateY(0)";
                    cloneLabel.style.transition = "transform 0.45s ease";
                    cloneLabel.style.marginBottom = "0";

                    var labelDelta = finalLabelOffset - initialLabelOffset;
                }

                requestAnimationFrame(() => {
                    void clone.offsetWidth;
                    clone.classList.add("fullscreen");

                    if (cloneLabel) {
                        cloneLabel.style.transform = `translateX(-50%) translateY(${labelDelta}px)`;
                    }

                    const expandTimeout = 900;
                    let expandDone = false;
                    const onExpandEnd = function handler(evt) {
                        if (evt.propertyName === "width") {
                            expandDone = true;
                            clone.removeEventListener("transitionend", handler);
                            clone.classList.add("show-content");
                        }
                    };
                    clone.addEventListener("transitionend", onExpandEnd);
                    setTimeout(() => {
                        if (!expandDone) {
                            try { clone.removeEventListener("transitionend", onExpandEnd); } catch (e) {}
                            clone.classList.add("show-content");
                        }
                    }, expandTimeout);
                });

                closeBtn.addEventListener("click", e => {
                    e.stopPropagation();

                    clone.classList.remove("show-content");

                    const contentTimeout = 450;
                    let contentHidden = false;

                    const listenTarget = infoWrap || clone.querySelector(".title-box");

                    const onContentHidden = function handlerContent(evt) {
                        if (evt.propertyName === "opacity") {
                            contentHidden = true;
                            listenTarget.removeEventListener("transitionend", handlerContent);
                            proceedToShrink();
                        }
                    };

                    if (listenTarget) {
                        listenTarget.addEventListener("transitionend", onContentHidden);
                        setTimeout(() => {
                            if (!contentHidden) {
                                try { listenTarget.removeEventListener("transitionend", onContentHidden); } catch (e) {}
                                proceedToShrink();
                            }
                        }, contentTimeout);
                    } else {
                        proceedToShrink();
                    }

                    function proceedToShrink() {
                        const cloneLabel = clone.querySelector(".label");
                        if (cloneLabel) {
                            cloneLabel.style.transform = "translateX(-50%) translateY(0)";
                        }

                        const labelBackDelay = 120;
                        setTimeout(() => {
                            clone.classList.remove("fullscreen");

                            const shrinkTimeout = 900;
                            let shrinkDone = false;
                            const onShrinkEnd = function handlerShrink(evt) {
                                if (evt.propertyName === "width") {
                                    shrinkDone = true;
                                    clone.removeEventListener("transitionend", handlerShrink);

                                    if (clone.parentNode) document.body.removeChild(clone);

                                    container.classList.remove("locked");
                                    panels.forEach(p => p.classList.remove("active"));
                                    panels.forEach(p => { p.style.transition = ""; p.style.opacity = ""; });

                                    animating = false;
                                }
                            };
                            clone.addEventListener("transitionend", onShrinkEnd);
                            setTimeout(() => {
                                if (!shrinkDone) {
                                    try { clone.removeEventListener("transitionend", onShrinkEnd); } catch (e) {}
                                    if (clone.parentNode) document.body.removeChild(clone);
                                    container.classList.remove("locked");
                                    panels.forEach(p => p.classList.remove("active"));
                                    panels.forEach(p => { p.style.transition = ""; p.style.opacity = ""; });
                                    animating = false;
                                }
                            }, shrinkTimeout);
                        }, labelBackDelay);
                    }

                });

            });

            panel.setAttribute("tabindex", "0");
            panel.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    panel.click();
                }
            });
        });
    }
});
