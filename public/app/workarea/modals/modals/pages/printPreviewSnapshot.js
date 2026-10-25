/**
 * Copy the rendered preview without running its initializers again. Reloading the original HTML
 * loses the user's folds and can redraw activities with different random values.
 */
export async function printPreviewSnapshot(doc) {
    // The pictures are taken first: the copy below is made in one go, so the page cannot change
    // while it is being made.
    const pictures = await Promise.all([...doc.querySelectorAll('model-viewer')].map(pictureModelViewer));
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
    copy.querySelectorAll('model-viewer').forEach((viewer, index) => {
        const picture = pictures[index];
        if (!picture) return;
        const image = doc.createElement('img');
        for (const name of ['id', 'class', 'style', 'alt']) {
            const value = viewer.getAttribute(name);
            if (value !== null) image.setAttribute(name, value);
        }
        image.src = picture.src;
        image.style.width = `${picture.width}px`;
        image.style.maxWidth = '100%';
        image.style.height = 'auto';
        viewer.replaceWith(image);
    });
    return '<!DOCTYPE html>\n' + copy.outerHTML;
}

/**
 * Picture the frame a <model-viewer> shows, or null for one that is not shown or cannot say.
 *
 * toBlob() rather than toDataURL(): every viewer on the page draws on a canvas as large as the
 * largest of them, in its top-left corner, and toDataURL() returns that whole canvas. Shrunk to
 * the viewer's width, a smaller viewer's model would shrink with it. toBlob() crops to the viewer.
 */
async function pictureModelViewer(viewer) {
    const { width, height } = viewer.getBoundingClientRect();
    if (!width || !height || typeof viewer.toBlob !== 'function') return null;
    try {
        return { width, src: await readAsDataUrl(await viewer.toBlob()) };
    } catch {
        return null;
    }
}

/** Read a blob as a data: URL, which the copy carries wherever it is loaded. */
function readAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}
