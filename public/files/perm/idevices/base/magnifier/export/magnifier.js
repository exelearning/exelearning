var $magnifier = {
    msgs: {
        msgFullScreen: "Pantalla completa"
    },

    renderView: function (data, accesibility, template, ideviceId) {
        const ldata = $magnifier.transformObject(data, ideviceId);
        return template.replace('{content}', this.createInterfaceMagnifier(ldata));
    },

    transformObject: function (data, ideviceId) {
        this.isInExe = eXe.app.isInExe();
        this.idevicePath = this.isInExe
            ? eXe.app.getIdeviceInstalledExportPath("magnifier")
            : $('.idevice_node.magnifier').eq(0).attr('data-idevice-path');

        const instructions = data.instructions
            || $('<div>').html(data.textTextarea).text().trim();

        const id = data.ideviceId || ideviceId || data.id
        return {
            id: id,
            typeGame: 'magnifier',
            instructions,
            image: data.image || data.defaultImage || this.idevicePath + 'hood.jpg',
            width: data.width || '',
            height: data.height || '',
            align: data.align || 'left',
            glassSize: data.glassSize || 100,
            zoom: data.zoom || data.initalZoom || 1,
            idevicePath: this.idevicePath,
            msgs: data.msgs || $magnifier.msgs,
            ideviceId: id
        };
    },

    getImageName: function (imgPath) {
        return imgPath.split('/').pop()
    },

    renderBehaviour: function (data, accesibility, ideviceId) {

        const ldata = $magnifier.transformObject(data, ideviceId);
        const $node = $('#' + data.ideviceId).find('.idevice_body')
        $node.empty();
        let html = this.createInterfaceMagnifier(ldata)

        $node.html(`<div class="exe-magnifier-container">${html}</div>`)
        if (typeof MojoMagnify !== 'undefined') {
            $magnifier.addEvents(ldata);
        } else {
            const cb = '$magnifier.addEvents(' + JSON.stringify(ldata) + ');';
            $exe.loadScript(ldata.idevicePath + '0_mojomagnify.js', cb);
        }
    },
    createInterfaceMagnifier: function (data) {
        const i = data.ideviceId
        let flexDir = '', alignItems = '', textAlign = 'left';
        switch (data.align) {
            case 'right':
                flexDir = 'row';
                alignItems = 'start';
                textAlign = 'left';
                break;
            case 'left':
                flexDir = 'row-reverse';
                alignItems = 'start';
                textAlign = 'left';
                break;
            case 'center':
            default:
                flexDir = 'column';
                alignItems = 'center';
                textAlign = 'center';
        }

        html = `
            <div class="MNF-MainContainer" id="mnfPMainContainer-${i}" style="display:flex; flex-direction:${flexDir}; align-items:${alignItems};">
                <div class="MNF-instructions" style="flex:1; text-align:${textAlign}; margin:${data.align === 'center' ? '0 0 1rem' : '0 1rem'};">
                    ${data.instructions}
                </div>
                <div class="MNF-image-wrapper" id ="image-wrapper-${i}" style="flex-shrink:0;">
                    <div class="ImageMagnifierIdevice">
                        <div class="image-thumbnail" id="image-thumbnail-${i}">
                            <img src="${data.image}" id="mnfPPreviewImage-${i}" width="${data.width}" height="${data.height}"
                            class="magnifier-size-${data.glassSize} magnifier-zoom-${data.zoom}"
                        />
                        </div>
                    </div>                   
                </div>
            </div>`;
        return html;
    },

    addEvents: function (data) {
        const instance = data.ideviceId;

        let $container = $(`#image-wrapper-${data.ideviceId}`)
        $container.find(".ImageMagnifierIdevice .image-thumbnail").each(function () {
            var $img = $(this).find("img");
            if ($img.length === 1) {
                var hasMagnifyAttr = $img.attr("data-magnifysrc");
                var classes = $img.attr("class") || "";
                var isMagnifierImg = classes.indexOf("magnifier-size-") !== -1;
                if (!hasMagnifyAttr && isMagnifierImg) {
                    var imgElem = $img[0];
                    var newId = this.id.replace("image-thumbnail-", "magnifier");
                    var w = imgElem.width;
                    var h = imgElem.height;
                    var size = 100, zoom = 1;
                    var classParts = classes.split(" ");
                    if (classParts.length >= 2) {
                        size = classParts[0].replace("magnifier-size-", "") || 100;
                        zoom = classParts[1].replace("magnifier-zoom-", "") || 100;
                    }
                    var newImgHTML =
                        '<img id="' + newId + '" src="' + imgElem.src + '"' +
                        ' width="' + w + '" height="' + h + '"' +
                        ' data-magnifysrc="' + imgElem.src + '"' +
                        ' data-size="' + size + '" data-zoom="' + zoom + '"' +
                        ' alt="' + (imgElem.alt || "") + '" />';
                    $(this).html(newImgHTML);
                }
            }
        });


        $('#mnfPMainContainer-' + instance).off('click', '.MNF-FullLinkImage');
        $('#mnfPMainContainer-' + instance).on('click', '.MNF-FullLinkImage', function (e) {
            e.stopPropagation();
            const largeImageSrc = data.image;
            if (data.image && data.image.length > 3) {
                $exeDevices.iDevice.gamification.helpers.showFullscreenImage(
                    largeImageSrc,
                    $('#mnfPMainContainer-' + instance),
                );
            }
        });
        try {
            MojoMagnify.init();
        } catch (e) {
            if (e.name === 'SecurityError') {
                console.warn('mojomagnify: no se pudieron leer reglas CSS externas — lupa iniciada sin estilos dinámicos.');
                // Opcional: invoca un init alternativo que no dependa de cssRules
            } else {
                throw e;
            }
        }

        setTimeout(function () {
            if (typeof MojoMagnify !== 'undefined') {
                MojoMagnify.init();
            }
        }, 500);
    },

    init: function (data, accesibility) {

    }

};
