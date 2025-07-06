/*
 * MojoMagnify 
 * Based on MojoMagnify 0.1.10 - JavaScript Image Magnifier
 * Copyright (c) 2008-2010 Jacob Seidelin, cupboy@gmail.com, http://blog.nihilogic.dk/
 * Licensed under the MPL License [http://www.nihilogic.dk/licenses/mpl-license.txt]
 * Modified by Fran Macías 2013 for exelearning.net
 * Modified by Manuel Narváez Martínez 2025 for eXe 3.0
 *
 * Requirements:
 *   - Images must follow this format:
 *     <img src="..." data-magnifysrc="..." data-size="..." data-zoom="..." />
 *   - Optional style classes:
 *       .selectsizeglass { ... }  // for lens size dropdown
 *       .selectzoomglass { ... }  // for zoom dropdown
 *       .zoomglass { ... }        // for lens appearance
 *
 */

var MojoMagnify = (function () {
    const dfstyle = 'background:#fff;width:80px;padding:3px;border:1px solid #ccc;height:28px;margin:5px';

    const dc = tag => document.createElement(tag);

    const addEvent = (el, ev, handler) => el.addEventListener(ev, handler, false);
    const removeEvent = (el, ev, handler) => el.removeEventListener(ev, handler, false);

    const getElementPos = el => {
        let x = el.offsetLeft, y = el.offsetTop, parent = el.offsetParent;
        while (parent) {
            x += parent.offsetLeft;
            y += parent.offsetTop;
            parent = parent.offsetParent;
        }
        return { x, y };
    };

    const getEventMousePos = (el, e) => {
        const scrollX = document.body.scrollLeft || document.documentElement.scrollLeft;
        const scrollY = document.body.scrollTop || document.documentElement.scrollTop;
        const pos = getElementPos(el);
        return {
            x: e.clientX - pos.x + scrollX,
            y: e.clientY - pos.y + scrollY
        };
    };

    const setZoomPos = (img, x, y, pos) => {
        const zoomImg = img.__mojoMagnifyImage;
        if (!zoomImg) return;

        const full = img.__mojoMagnifyOptions.full;
        const zoom = img.__mojoMagnifyZoomer;
        const maskWidth = zoom.offsetWidth;
        const maskHeight = zoom.offsetHeight;
        const imgLeft = img.offsetLeft;
        const imgTop = img.offsetTop;
        const w = img.offsetWidth || img.naturalWidth;
        const h = img.offsetHeight || img.naturalHeight;

        let left, top;
        if (full) {
            const fx = x / w, fy = y / h;
            left = -(maskWidth - w) * fx;
            top = -(maskHeight - h) * fy;
        } else {
            left = pos.x - maskWidth / 2 - imgLeft;
            top = pos.y - maskHeight / 2 - imgTop;
        }
        zoom.style.left = `${left}px`;
        zoom.style.top = `${top}px`;

        const zoomWidth = zoomImg.offsetWidth || zoomImg.naturalWidth;
        const zoomHeight = zoomImg.offsetHeight || zoomImg.naturalHeight;

        let zx, zy;
        if (full) {
            zx = zy = 0;
        } else {
            zx = -Math.round(x * (zoomWidth / w)) + maskWidth / 2;
            zy = -Math.round(y * (zoomHeight / h)) + maskHeight / 2;
        }
        zoomImg.style.left = `${zx}px`;
        zoomImg.style.top = `${zy}px`;
    };

    const makeMagnifiable = (img, zoomSrc, opt = {}, zSize, zZoom) => {
        if (img.__mojoMagnifyImage) {
            img.__mojoMagnifyImage.src = zoomSrc;
            return;
        }

        if (!img.complete && !img.__mojoMagnifyQueued) {
            img.__mojoMagnifyQueued = true;
            addEvent(img, "load", () => makeMagnifiable(img, zoomSrc, opt, zSize, zZoom));
            return;
        }

        // Leer valores directamente desde los atributos del <img>
        zSize = parseInt(img.getAttribute("data-size")) || 100;
        zZoom = parseFloat(img.getAttribute("data-zoom")) || 1;

        const w = img.offsetWidth || img.naturalWidth;
        const h = img.offsetHeight || img.naturalHeight;

        const linkParent = dc("div");
        img.parentNode.replaceChild(linkParent, img);
        linkParent.appendChild(img);
        Object.assign(linkParent.style, {
            position: "relative",
            display: "block",
            width: `${w}px`,
            height: `${h}px`,
            marginBottom: "40px"
        });

        const zoom = dc("div");
        Object.assign(zoom.style, {
            position: "absolute",
            width: `${zSize}px`,
            height: `${zSize}px`,
            overflow: "hidden",
            cursor: "none",
            border: "2px solid #ccc",
            boxShadow: "5px 5px 10px #333",
            borderRadius: `${zSize / 2}px`,
            left: "-9999px"
        });

        const zoomImg = dc("img");
        Object.assign(zoomImg.style, {
            position: "absolute",
            maxWidth: "none",
            maxHeight: "none",
            width: `${w * zZoom}px`,
            height: `${h * zZoom}px`
        });
        zoom.appendChild(zoomImg);

        const ctr = dc("div");
        Object.assign(ctr.style, {
            position: "absolute",
            left: `${img.offsetLeft}px`,
            top: `${img.offsetTop}px`,
            width: `${w}px`,
            height: `${h}px`,
            overflow: "hidden",
            display: "block"
        });
        ctr.appendChild(zoom);
        linkParent.appendChild(ctr);

        const zoomBorder = dc("div");
        zoomBorder.className = "mojomagnify_border";
        zoom.appendChild(zoomBorder);

        img.__mojoMagnifyImage = zoomImg;
        img.__mojoMagnifyZoomer = zoom;
        img.__mojoMagnifyBorder = zoomBorder;
        img.__mojoMagnifyOverlay = ctr;
        img.__mojoMagnifyOptions = opt;

        // Controles
        const controls = dc("div");
        controls.style.margin = "10px 0";

        const selectZoom = dc("select");
        [1, 1.5, 2, 2.5, 3, 4, 6].forEach(v => {
            const opt = dc("option");
            opt.value = v;
            opt.textContent = `x${v}`;
            if (parseFloat(zZoom) === v) opt.selected = true;
            selectZoom.appendChild(opt);
        });
        selectZoom.style = dfstyle;
        selectZoom.onchange = () => {
            const zoomLevel = parseFloat(selectZoom.value);
            zoomImg.style.width = `${w * zoomLevel}px`;
            zoomImg.style.height = `${h * zoomLevel}px`;
        };

        const selectSize = dc("select");
        [50, 100, 150, 200, 250, 300, 400].forEach(v => {
            const opt = dc("option");
            opt.value = v;
            opt.textContent = `${v}`;
            if (parseInt(zSize) === v) opt.selected = true;
            selectSize.appendChild(opt);
        });
        selectSize.style = dfstyle;
        selectSize.onchange = () => {
            const size = parseInt(selectSize.value);
            zoom.style.width = `${size}px`;
            zoom.style.height = `${size}px`;
            zoom.style.borderRadius = `${size / 2}px`;
        };

        controls.appendChild(selectZoom);
        controls.appendChild(selectSize);
        linkParent.appendChild(controls);

        addEvent(linkParent, "mousemove", e => {
            ctr.style.display = "block";
            const pos = getEventMousePos(linkParent, e);
            const x = e.clientX - getElementPos(img).x;
            const y = e.clientY - getElementPos(img).y;
            setZoomPos(img, x, y, pos);
        });

        addEvent(linkParent, "mouseleave", () => {
            ctr.style.display = "none";
        });

        setTimeout(() => zoomImg.src = zoomSrc, 1);
    };

    const init = () => {
        const images = document.querySelectorAll("img[data-magnifysrc]");
        images.forEach(img => {
            const zoomSrc = img.getAttribute("data-magnifysrc");
            const opt = {
                full: img.getAttribute("data-magnifyfull") === "true",
                animate: img.getAttribute("data-magnifyanimate") === "true"
            };
            makeMagnifiable(img, zoomSrc, opt);
        });
    };

    return {
        addEvent,
        init,
        makeMagnifiable,
        setCoords: (img, x, y) => {
            if (!img.__mojoMagnifyOverlay) return;
            img.__mojoMagnifyOverlay.style.display = "block";
            setZoomPos(img, x, y, { x, y });
        }
    };
})();
