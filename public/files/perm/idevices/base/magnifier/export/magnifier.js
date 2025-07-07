var $magnifier = {
    msgs: {
        msgFullScreen: "Pantalla completa",
        msgNotImage: "La imagen no está disponible"
    },

    renderView: function (data, accesibility, template, ideviceId) {
        const ldata = $magnifier.transformObject(data, ideviceId);
        let html = this.createInterfaceMagnifier(ldata)
        return template.replace('{content}', html);
    },
    idevicePath: '',
    isInExe: true,
    defaultImage: '',

    transformObject: function (data, ideviceId) {
        this.isInExe = eXe.app.isInExe();
        this.idevicePath = this.isInExe
            ? eXe.app.getIdeviceInstalledExportPath("magnifier")
            : $('.idevice_node.magnifier').eq(0).attr('data-idevice-path');
        this.defaultImage = this.idevicePath + 'hood.jpg'

        const id = data.ideviceId || ideviceId || data.id

        const width = (!data.width || data.width > 1200) ? 600 : data.width;
        const height = data.height ?? '';
        const align = data.align ?? 'left';
        const defaultImage = $magnifier.defaultImage;
        const textTextarea = $magnifier.replaceResourceDirectoryPaths(data);
        const glassSize = data.glassSize ? data.glassSize : 1;
        const imageResource = $magnifier.changeDirectory(data);
        const initialZSize = data.initialZSize ?? 100;
        const isDefaultImage = data.isDefaultImage;
        const image = isDefaultImage == "0" ? imageResource : defaultImage;

        return {
            id: id,
            typeGame: 'magnifier',
            textTextarea,
            imageResource,
            defaultImage,
            image,
            width,
            height,
            align,
            glassSize,
            initialZSize,
            idevicePath: $magnifier.idevicePath,
            msgs: data.msgs || $magnifier.msgs,
            ideviceId: id
        };

    },

    getImageName: function (imgPath) {
        return imgPath.split('/').pop()
    },

    renderBehaviour: function (data, accesibility, ideviceId) {

        const ldata = $magnifier.transformObject(data, ideviceId);
        let $node = $('#' + data.ideviceId);
        if (!eXe.app.isInExe()) {
            let html = this.createInterfaceMagnifier(ldata)
            $node.html(`<div class="exe-magnifier-container">${html}</div>`)
        }


        if (typeof MojoMagnify !== 'undefined') {
            $magnifier.addEvents(ldata);
        } else {
            const cb = '$magnifier.addEvents(' + JSON.stringify(ldata) + ');';
            $exe.loadScript(ldata.idevicePath + 'mojomagnify.js', cb);
        }
    },

    changeDirectory(data) {
        const $node = $('#' + data.ideviceId),
            isInExe = eXe.app.isInExe();
        if (isInExe || $node.length == 0 || !data.imageResource) return data.imageResource;

        const pathMedia = $('html').is('#exe-index')
            ? 'content/resources/' + $node.attr('id-resource') + '/'
            : '../content/resources/' + $node.attr('id-resource') + '/';

        const parts = data.imageResource.split(/[/\\]/),
            name = parts.pop(),
            dir = pathMedia.replace(/[/\\]+$/, '');
        return dir + '/' + name;
    },

    replaceResourceDirectoryPaths(data) {
        const $node = $('#' + data.ideviceId),
            isInExe = eXe.app.isInExe();

        if (isInExe || $node.length == 0) return data.textTextarea;

        const dir = $('html').is('#exe-index')
            ? 'content/resources/' + $node.attr('id-resource') + '/'
            : '../content/resources/' + $node.attr('id-resource') + '/';



        const parser = new DOMParser();
        const doc = parser.parseFromString(data.textTextarea, 'text/html');
        doc.querySelectorAll('img[src], video[src], audio[src], a[href]')
            .forEach(el => {
                const attr = el.hasAttribute('src') ? 'src' : 'href';
                const val = el.getAttribute(attr).trim();
                if (/^\/?files\//.test(val)) {
                    const filename = val.split('/').pop() || '';
                    el.setAttribute(attr, dir + filename);
                }
            });
        return doc.body.innerHTML;
    },


    createInterfaceMagnifier: function (data) {
        const instance = data.ideviceId
        let flexDir = '', alignItems = '', textAlign = 'left'
        switch (data.align) {
            case 'right':
                flexDir = 'row'
                alignItems = 'start'
                textAlign = 'left'
                break
            case 'left':
                flexDir = 'row-reverse'
                alignItems = 'start'
                textAlign = 'left'
                break
            case 'center':
            default:
                flexDir = 'column'
                alignItems = 'center'
                textAlign = 'center'
        }

        return `
        <div class="MNF-MainContainer" id="mnfPMainContainer-${instance}" style="display:flex; flex-direction:${flexDir}; align-items:${alignItems};">
            <div class="MNF-instructions" style="flex:1; text-align:${textAlign}; margin:${data.align === 'center' ? '0 0 1rem' : '0 1rem'};">
                ${data.textTextarea}
            </div>
            <div id="mnfPNotImage-${instance}" style="display:none"><p>${data.msgs.msgNotImage}</p></div>
            <div class="MNF-image-wrapper" id="image-wrapper-${instance}" style="flex-shrink:0;">
                <a href="#" class="MNF-FullLinkImage" title="${data.msgs.msgFullScreen}" aria-label="${data.msgs.msgFullScreen}">
                    <div class="MNF-FullImage MNF-Activo" aria-hidden="true"></div>
                    <span class="sr-av">${data.msgs.msgFullScreen}</span>
                </a>                 
                <div class="ImageMagnifierIdevice">
                    <div class="image-thumbnail" id="image-thumbnail-${instance}">
                        <div style="position: relative; display: block; width:${data.width}; height: auto; margin-bottom: 50px;">
                            <img id="magnifier-${instance}"
                                 src="${data.image}"
                                 data-magnifysrc="${data.image}"
                                 width="${data.width}" height=""
                                 data-size="${data.glassSize}"
                                 data-zoom="${data.initialZSize}">
                        </div>
                    </div>                
                </div>
            </div>
        </div>`
    },

    loadImageWithFallback: function (data) {
        const instance = data.ideviceId;
        const $img = $(`#magnifier-${instance}`);
        const defaultSrc = $magnifier.defaultImage;
        const $notImage = $('#mnfPNotImage-' + instance);
        const $imageMagnifier = $('#image-wrapper-' + instance)


        if (data.isDefaultImage === "1") {
            $img.attr({
                'src': defaultSrc,
            });
            return;
        }

        $img
            .off('error')
            .on('error', function () {
                $notImage.show();
                $imageMagnifier.hide();
            })
            .attr({
                'data-magnifysrc': data.image,
                'src': data.image,
                'alt': 'Image'
            });
    },

    addEvents: function (data) {
        const instance = data.ideviceId;

        $magnifier.loadImageWithFallback(data);

        $('#mnfPMainContainer-' + instance)
            .off('click', '.MNF-FullLinkImage')
            .on('click', '.MNF-FullLinkImage', function (e) {
                e.stopPropagation();
                if (data.image) {
                    $exeDevices.iDevice.gamification.helpers
                        .showFullscreenImage(data.image, $('#mnfPMainContainer-' + instance));
                }
            });

        setTimeout(function () {
            MojoMagnify.init();
        }, 500)
    },

    init: function (data, accesibility) {

    }

};
