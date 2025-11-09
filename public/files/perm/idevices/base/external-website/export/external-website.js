var $externalwebsite = {
    init: function () {
        let protocolWeb = location.protocol;
        let websiteIframes = document.querySelectorAll('#iframeWebsiteIdevice');
        websiteIframes.forEach((idevice) => {
            let iframe = idevice.querySelector('iframe');
            let iframeSource = iframe.src;
            let protocolIframe = iframeSource.split(':')[0] + ':';
            if (protocolWeb == 'https:' && protocolIframe == 'http:') {
                iframe.style.display = 'none';
                let containerError = idevice.querySelector(
                    '.iframe-error-message'
                );
                containerError.style.display = 'block';
            }
        });
    },
};

$(function () {
    $externalwebsite.init();
});
