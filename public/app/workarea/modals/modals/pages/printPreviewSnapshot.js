/**
 * Copy the rendered preview without running its initializers again. Reloading the original HTML
 * loses the user's folds and can redraw activities with different random values.
 */
export function printPreviewSnapshot(doc) {
    const copy = doc.documentElement.cloneNode(true);
    copy.querySelectorAll('script, meta[http-equiv="refresh" i]').forEach((element) => element.remove());
    const policy = doc.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    policy.content = "script-src 'none'";
    copy.querySelector('head').prepend(policy);
    for (const element of [copy, ...copy.querySelectorAll('*')]) {
        for (const attribute of element.getAttributeNames()) {
            if (attribute.toLowerCase().startsWith('on')) element.removeAttribute(attribute);
        }
    }

    // Canvas pixels and form values belong to the live DOM, not its serialized attributes.
    // A canvas that cannot be read, because it shows an image from another origin, stays a
    // canvas: it prints blank, rather than stopping the whole copy and so the print.
    const canvases = copy.querySelectorAll('canvas');
    doc.querySelectorAll('canvas').forEach((canvas, index) => {
        let pixels;
        try {
            pixels = canvas.toDataURL();
        } catch {
            return;
        }
        const image = doc.createElement('img');
        for (const attribute of canvases[index].attributes) image.setAttribute(attribute.name, attribute.value);
        image.src = pixels;
        image.width = canvas.width;
        image.height = canvas.height;
        canvases[index].replaceWith(image);
    });
    const controls = copy.querySelectorAll('input, textarea, option');
    doc.querySelectorAll('input, textarea, option').forEach((control, index) => {
        const target = controls[index];
        if (control.tagName === 'TEXTAREA') target.textContent = control.value;
        else if (control.tagName === 'OPTION') target.toggleAttribute('selected', control.selected);
        else {
            target.setAttribute('value', control.value);
            target.toggleAttribute('checked', control.checked);
        }
    });

    // A <model-viewer> draws its model inside its shadow root, which the copy does not carry, with
    // scripts the copy leaves out. It can picture its current frame, so the copy shows that picture
    // in its place, as wide as it is on the page. One that is not shown (the 3D viewer hides it
    // while it draws an STL model itself) is left as it is. This runs last: the passes above pair
    // elements by their position, which taking a viewer out of the copy would upset.
    const viewers = copy.querySelectorAll('model-viewer');
    doc.querySelectorAll('model-viewer').forEach((viewer, index) => {
        const { width, height } = viewer.getBoundingClientRect();
        if (!width || !height || typeof viewer.toDataURL !== 'function') return;
        let pixels;
        try {
            pixels = viewer.toDataURL();
        } catch {
            return;
        }
        const image = doc.createElement('img');
        for (const name of ['id', 'class', 'style', 'alt']) {
            const value = viewers[index].getAttribute(name);
            if (value !== null) image.setAttribute(name, value);
        }
        image.src = pixels;
        image.style.width = `${width}px`;
        image.style.maxWidth = '100%';
        image.style.height = 'auto';
        viewers[index].replaceWith(image);
    });
    return '<!DOCTYPE html>\n' + copy.outerHTML;
}
