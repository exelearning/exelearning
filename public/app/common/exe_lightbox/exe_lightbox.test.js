import { readFileSync } from 'node:fs';

// Run the exact prettyPhoto build shipped in exports and the workarea.
const source = readFileSync('public/app/common/exe_lightbox/exe_lightbox.js', 'utf8');

describe('exe_lightbox (prettyPhoto)', () => {
    let $;

    beforeAll(() => {
        (0, eval)(source);
        $ = window.jQuery;
        // Finish animations synchronously so the fadeIn callback that injects content runs inline.
        $.fx.off = true;
        // Assert on the injected iframes without loading YouTube, Vimeo, etc. happy-dom logs each skipped load.
        window.happyDOM.settings.disableIframePageLoading = true;
    });

    beforeEach(() => {
        window.pp_alreadyInitialized = false;
        window.location.href = 'http://localhost:3001/';
        window.__pwned = false;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        $('.pp_pic_holder, .pp_overlay, .ppt').remove();
        document.body.innerHTML = '';
    });

    function open(html, options = {}) {
        document.body.innerHTML = html;
        const links = $("a[rel^='lightbox']");
        links.prettyPhoto({ social_tools: '', deeplinking: false, ...options });
        links.first().trigger('click');
    }

    const fullRes = () => document.querySelector('#pp_full_res');

    describe('injection payloads', () => {
        it('renders a URL-encoded markup title as text', () => {
            const payload = '%3Cimg src=x onerror=window.__pwned=true%3E';
            open(`<a href="photo.jpg" rel="lightbox" title="${payload}"><img src="t.jpg" alt="${payload}"></a>`);

            expect($('.ppt').text()).toBe(payload);
            expect($('.pp_description').text()).toBe(payload);
            expect(document.querySelector('.ppt img, .pp_description img')).toBeNull();
            expect(window.__pwned).toBe(false);
        });

        it('renders markup already decoded by the attribute as text', () => {
            open(
                '<a href="photo.jpg" rel="lightbox" title="&lt;img src=x onerror=window.__pwned=true&gt;">' +
                    '<img src="t.jpg" alt="&lt;b&gt;bold&lt;/b&gt;"></a>',
            );

            expect($('.ppt').text()).toBe('<b>bold</b>');
            expect($('.pp_description').text()).toBe('<img src=x onerror=window.__pwned=true>');
            expect(document.querySelector('.ppt b, .pp_description img')).toBeNull();
        });

        it('keeps a quote in an image href inside the src attribute', () => {
            const href = 'x.jpg" onerror="window.__pwned=true';
            document.body.innerHTML = '<a rel="lightbox">x</a>';
            $('a').attr('href', href);
            $("a[rel^='lightbox']").prettyPhoto({ social_tools: '', deeplinking: false });
            $('a').trigger('click');

            const img = document.querySelector('#fullResImage');
            expect(img.getAttribute('src')).toBe(href);
            expect(img.hasAttribute('onerror')).toBe(false);
            expect(fullRes().querySelectorAll('*')).toHaveLength(1);
        });

        it('does not expand String.replace patterns from the href', () => {
            const href = "x.jpg$'$`$&";
            document.body.innerHTML = '<a rel="lightbox">x</a>';
            $('a').attr('href', href);
            $("a[rel^='lightbox']").prettyPhoto({ social_tools: '', deeplinking: false });
            $('a').trigger('click');

            expect(document.querySelector('#fullResImage').getAttribute('src')).toBe(href);
            expect(fullRes().querySelectorAll('*')).toHaveLength(1);
        });

        it('keeps a quote in an iframe href inside the src attribute', () => {
            const href = 'page.html?"><img src=x onerror=window.__pwned=true>&iframe=true&width=600&height=400';
            document.body.innerHTML = '<a rel="lightbox">x</a>';
            $('a').attr('href', href);
            $("a[rel^='lightbox']").prettyPhoto({ social_tools: '', deeplinking: false });
            $('a').trigger('click');

            const frames = fullRes().querySelectorAll('iframe');
            expect(frames).toHaveLength(1);
            expect(frames[0].getAttribute('src')).toBe('page.html?"><img src=x onerror=window.__pwned=true>');
            expect(fullRes().querySelector('img')).toBeNull();
        });

        it('escapes gallery thumbnails', () => {
            document.body.innerHTML = '<a rel="lightbox[g]">1</a><a rel="lightbox[g]" href="b.jpg">2</a>';
            $('a').first().attr('href', "a.jpg'><img src=x onerror=window.__pwned=true>");
            $("a[rel^='lightbox']").prettyPhoto({ social_tools: '', deeplinking: false });
            $('a').first().trigger('click');

            const thumbs = document.querySelectorAll('.pp_gallery img');
            expect(thumbs).toHaveLength(2);
            expect(thumbs[0].getAttribute('src')).toBe("a.jpg'><img src=x onerror=window.__pwned=true>");
        });

        it('no longer fetches and injects ajax=true links', () => {
            const get = vi.spyOn($, 'get');
            const ajax = vi.spyOn($, 'ajax');
            open('<a href="evil.html?ajax=true&width=300&height=200" rel="lightbox">x</a>');

            expect(get).not.toHaveBeenCalled();
            expect(ajax).not.toHaveBeenCalled();
            expect(document.querySelector('.pp_inline')).toBeNull();
            expect(document.querySelector('#fullResImage').getAttribute('src')).toBe(
                'evil.html?ajax=true&width=300&height=200',
            );
        });

        // The deep link clicks the matching link through `:eq()`, which happy-dom cannot resolve,
        // so these assert on the delayed trigger itself.
        it('ignores the location hash when deeplinking is off', () => {
            vi.useFakeTimers();
            window.location.href = 'http://localhost:3001/#prettyPhoto/0/';
            document.body.innerHTML = '<a href="a.jpg" rel="prettyPhoto[g]">1</a>';
            $('a').prettyPhoto({ social_tools: '', deeplinking: false });
            const trigger = vi.spyOn($.fn, 'trigger');
            vi.advanceTimersByTime(100);

            expect(trigger).not.toHaveBeenCalled();
            expect(window.pp_alreadyInitialized).toBe(false);
        });

        it('still follows the location hash when deeplinking is on', () => {
            vi.useFakeTimers();
            window.location.href = 'http://localhost:3001/#prettyPhoto/0/';
            document.body.innerHTML = '<a href="a.jpg" rel="prettyPhoto[g]">1</a>';
            $('a').prettyPhoto({ social_tools: '' });
            const trigger = vi.spyOn($.fn, 'trigger');
            vi.advanceTimersByTime(100);

            expect(trigger).toHaveBeenCalledWith('click');
            expect(window.pp_alreadyInitialized).toBe(true);
        });
    });

    describe('regressions', () => {
        it('opens an image with its alt as title and its title as description', () => {
            open('<a href="img/photo.jpg?v=1&amp;s=2" rel="lightbox" title="A &amp; B"><img src="t.jpg" alt="Photo 50%"></a>');

            expect(document.querySelector('#fullResImage').getAttribute('src')).toBe('img/photo.jpg?v=1&s=2');
            expect($('.ppt').text()).toBe('Photo 50%');
            expect($('.pp_description').css('display')).not.toBe('none');
            expect($('.pp_description').text()).toBe('A & B');
        });

        it('shows a non-breaking space when there is no title', () => {
            open('<a href="photo.jpg" rel="lightbox">x</a>');

            expect($('.ppt').text()).toBe(' ');
            expect($('.pp_description').css('display')).toBe('none');
        });

        it('lets eXe append its download link after the description', () => {
            open('<a href="#media-box-0" rel="lightbox" title="Song">x</a><div id="media-box-0"><audio src="a.mp3"></audio></div>', {
                changepicturecallback: () =>
                    $('.pp_details .pp_description').append(' <span class="exe-media-download"><a href="a.mp3" download>mp3</a></span>'),
            });

            expect($('.pp_description').text()).toBe('Song mp3');
            expect(document.querySelector('.pp_description .exe-media-download a[download]')).not.toBeNull();
            expect(fullRes().querySelector('.pp_inline audio').getAttribute('src')).toBe('a.mp3');
        });

        it('opens an inline #id dialog with its markup', () => {
            open('<a href="#dialog" rel="lightbox">x</a><div id="dialog"><h2 class="pp_title">Hi</h2><p>Text $\' kept</p></div>');

            const inline = fullRes().querySelector('.pp_inline');
            expect(inline.querySelector('h2.pp_title').textContent).toBe('Hi');
            expect(inline.querySelector('p').textContent).toBe("Text $' kept");
        });

        it('opens an iframe=true link with its size', () => {
            open('<a href="https://example.org/page.html?a=1&amp;iframe=true&amp;width=600&amp;height=400" rel="lightbox">x</a>', {
                // happy-dom has no viewport size, so skip fitting the frame to the window.
                allow_resize: false,
            });

            const frame = fullRes().querySelector('iframe');
            expect(frame.getAttribute('src')).toBe('https://example.org/page.html?a=1');
            expect(frame.getAttribute('width')).toBe('600');
            expect(frame.getAttribute('height')).toBe('400');
        });

        it('embeds YouTube with the start time', () => {
            open('<a href="https://www.youtube.com/watch?v=abc123&amp;t=90s" rel="lightbox">x</a>');

            expect(fullRes().querySelector('iframe').getAttribute('src')).toBe(
                'https://www.youtube.com/embed/abc123?rel=1&autoplay=1&start=90',
            );
        });

        it('embeds youtu.be links', () => {
            open('<a href="https://youtu.be/abc123?t=5" rel="lightbox">x</a>');

            expect(fullRes().querySelector('iframe').getAttribute('src')).toBe(
                'https://www.youtube.com/embed/abc123?rel=1&autoplay=1&start=5',
            );
        });

        it('embeds Vimeo', () => {
            open('<a href="https://vimeo.com/123456" rel="lightbox">x</a>');

            expect(fullRes().querySelector('iframe').getAttribute('src')).toMatch(
                /^https:\/\/player\.vimeo\.com\/video\/123456\?title=0&byline=0&portrait=0&autoplay=1/,
            );
        });

        it('embeds Mediateca in full-screen mode', () => {
            open('<a href="https://mediateca.educa.madrid.org/video/xyz/?a=1" rel="lightbox">x</a>');

            expect(fullRes().querySelector('iframe').getAttribute('src')).toBe(
                'https://mediateca.educa.madrid.org/video/xyz/fs',
            );
        });
    });
});
