/*
 * MojoMagnify 
 * Based on MojoMagnify 0.1.10 - JavaScript Image Magnifier
 * Copyright (c) 2008-2010 Jacob Seidelin, ...
 * Modified by Fran Macías 2013 for exelearning.net
 * Modified by Manuel Narváez Martínez 2025 for eXe 3.0
 */

var MojoMagnify = (function () {
    const dfstyle = 'background:#fff;width:80px;padding:3px;border:1px solid #ccc;height:28px;margin:5px';
    const dc = tag => document.createElement(tag);
    const addEvent = (el, ev, handler) => el.addEventListener(ev, handler, false);
    const removeEvent = (el, ev, handler) => el.removeEventListener(ev, handler, false);

    const getEventMousePos = (el, e) => {
        const rect = el.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const setZoomPos = (img, x, y, pos) => {
        const zoomImg = img.__mojoMagnifyImage;
        if (!zoomImg) return;

        const zoom = img.__mojoMagnifyZoomer;
        const maskWidth = zoom.offsetWidth;
        const maskHeight = zoom.offsetHeight;
        const w = img.offsetWidth || img.naturalWidth;
        const h = img.offsetHeight || img.naturalHeight;

        const left = pos.x - maskWidth / 2;
        const top = pos.y - maskHeight / 2;
        zoom.style.left = `${left}px`;
        zoom.style.top = `${top}px`;

        const zoomFactor = img.__mojoMagnifyZoomFactor;
        const zoomWidth = w * zoomFactor;
        const zoomHeight = h * zoomFactor;
        zoomImg.style.width = `${zoomWidth}px`;
        zoomImg.style.height = `${zoomHeight}px`;

        const ratioX = zoomWidth / w;
        const ratioY = zoomHeight / h;
        const zx = -Math.round(x * ratioX) + maskWidth / 2;
        const zy = -Math.round(y * ratioY) + maskHeight / 2;
        zoomImg.style.left = `${zx}px`;
        zoomImg.style.top = `${zy}px`;
    };

    const makeMagnifiable = (img, zoomSrc, opt = {}, zSize = 100, zZoom = 1) => {
        if (img.__mojoMagnifyImage) {
            img.__mojoMagnifyImage.src = zoomSrc;
            return;
        }

        let rawZoom = parseFloat(zZoom);
        rawZoom = isNaN(rawZoom) ? 1 : rawZoom;
        const zoomFactor = rawZoom > 8
            ? parseFloat((rawZoom / 100).toFixed(1))
            : rawZoom;
        img.__mojoMagnifyZoomFactor = zoomFactor;

        let rawSize = parseFloat(zSize) || 100;
        const lensSize = rawSize < 7 ? rawSize * 50 : rawSize;

        img.__mojoMagnifyOptions = opt;
        if (!img.complete) {
            addEvent(img, 'load', () =>
                makeMagnifiable(img, zoomSrc, opt, lensSize, zoomFactor)
            );
            return;
        }

        const w = img.offsetWidth || img.naturalWidth;
        const h = img.offsetHeight || img.naturalHeight;
        const wrapper = dc('div');
        img.parentNode.replaceChild(wrapper, img);
        wrapper.append(img);
        Object.assign(wrapper.style, {
            position: 'relative',
            display: 'block',
            width: `${w}px`,
            height: `${h}px`,
            marginBottom: '40px'
        });

        const overlay = dc('div');
        Object.assign(overlay.style, {
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${w}px`,
            height: `${h}px`,
            overflow: 'hidden',
            display: 'none',
            pointerEvents: 'none',
            zIndex: 10
        });
        wrapper.append(overlay);

        const zoom = dc('div');
        zoom.className = 'zoomglass';
        Object.assign(zoom.style, {
            position: 'absolute',
            overflow: 'hidden',
            width: `${lensSize}px`,
            height: `${lensSize}px`,
            left: '-9999px',
            borderRadius: `${lensSize / 2}px` 
        });
        overlay.append(zoom);
        
        const zoomImg = dc('img');
        Object.assign(zoomImg.style, {
            position: 'absolute',
            maxWidth: 'none',
            maxHeight: 'none'
        });
        zoom.append(zoomImg);

        const border = dc('div');
        border.className = 'mojomagnify_border';
        zoom.append(border);

        img.__mojoMagnifyImage = zoomImg;
        img.__mojoMagnifyZoomer = zoom;
        img.__mojoMagnifyOverlay = overlay;

        if (img.__mojoControls) img.__mojoControls.remove();
        const controls = dc('div');
        controls.style.margin = '10px 0';


        const selectZoom = dc('select');
        const zOpts = [1, 1.5, 2, 2.5, 3, 4, 6];
        if (!zOpts.includes(zoomFactor)) zOpts.push(zoomFactor);
        zOpts.sort((a, b) => a - b).forEach(v => {
            const o = dc('option');
            o.value = v;
            o.textContent = `x${v}`;
            if (v === zoomFactor) o.selected = true;
            selectZoom.append(o);
        });
        selectZoom.style = dfstyle;
        selectZoom.onchange = () => {
            const newFactor = parseFloat(selectZoom.value);
            img.__mojoMagnifyZoomFactor = newFactor;
            img.setAttribute('data-zoom', selectZoom.value);
            zoomImg.style.width = `${w * newFactor}px`;
            zoomImg.style.height = `${h * newFactor}px`;
        };

        const selectSize = dc('select');
        const sOpts = [50, 100, 150, 200, 250, 300, 400];
        if (!sOpts.includes(lensSize)) sOpts.push(lensSize);
        sOpts.sort((a, b) => a - b).forEach(v => {
            const o = dc('option');
            o.value = v;
            o.textContent = `${v}`;
            if (v === lensSize) o.selected = true;
            selectSize.append(o);
        });
        selectSize.style = dfstyle;
        selectSize.onchange = () => {
            const sz = parseInt(selectSize.value, 10);
            zoom.style.width = `${sz}px`;
            zoom.style.height = `${sz}px`;
            zoom.style.borderRadius = `${sz / 2}px`;
            img.setAttribute('data-size', sz);
        };

        controls.append(selectZoom, selectSize);
        wrapper.append(controls);
        img.__mojoControls = controls;

        let last = 0;
        addEvent(img, 'mousemove', e => {
            const now = Date.now();
            if (now - last < 50) return;
            last = now;
            overlay.style.display = 'block';
            const pos = getEventMousePos(img, e);
            setZoomPos(img, pos.x, pos.y, pos);
        });
        addEvent(img, 'mouseleave', () => overlay.style.display = 'none');

        setTimeout(() => zoomImg.src = zoomSrc, 1);
    };

    const init = () => {
        document.querySelectorAll('img[data-magnifysrc]').forEach(img => {
            const zoomSrc = img.getAttribute('data-magnifysrc');
            const opt = { full: img.getAttribute('data-magnifyfull') === 'true' };
            makeMagnifiable(
                img,
                zoomSrc,
                opt,
                parseFloat(img.getAttribute('data-size')),
                parseFloat(img.getAttribute('data-zoom'))
            );
        });
    };

    return { addEvent, init, makeMagnifiable };
})();
