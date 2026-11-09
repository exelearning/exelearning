/**
 * Unit tests for exe_lightbox.js, the adapter that opens `rel^="lightbox"`
 * content links with the stock Tobii build from npm.
 *
 * Tobii is loaded from node_modules (the same file copy-vendor-libs.js ships),
 * so these tests exercise the real library, not a mock.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const TOBII_PATH = join(process.cwd(), 'node_modules/@midzer/tobii/dist/tobii.min.js');

function loadTobii() {
  // The UMD build assigns `self.Tobii` when `module` is not defined.
  new Function('module', readFileSync(TOBII_PATH, 'utf-8'))(undefined);
}

function lightbox() {
  return document.querySelector('.tobii');
}

function visibleSlide() {
  const slider = document.querySelector('.tobii__slider:not([aria-hidden="true"])');
  return slider.children[window.exeLightbox.instance().slidesIndex()];
}

function click(el, init) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
}

describe('exe_lightbox (Tobii adapter)', () => {
  let exeLightbox;

  beforeAll(() => {
    loadTobii();
    require('./exe_lightbox.js');
    exeLightbox = window.exeLightbox;
  });

  beforeEach(() => {
    document.body.className = '';
    document.body.innerHTML = '';
    // happy-dom's window and document URLs differ in this suite, so Tobii's
    // "Back closes the lightbox" history entry cannot be created here.
    vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    global.$exe_i18n = {
      previous: 'Anterior',
      next: 'Siguiente',
      close_toolbar: 'Cerrar',
      download: 'Descargar',
      fullSize: 'Tamaño completo',
      newWindow: 'Nueva ventana',
    };
  });

  afterEach(() => {
    exeLightbox.destroy();
    delete global.$exe_i18n;
    vi.restoreAllMocks();
  });

  it('exposes the adapter and leaves prettyPhoto undefined', () => {
    expect(typeof exeLightbox.bind).toBe('function');
    expect(window.jQuery?.fn?.prettyPhoto).toBeUndefined();
  });

  describe('getItem: the href conventions of saved content', () => {
    function item(html) {
      document.body.innerHTML = html;
      return exeLightbox.getItem(document.querySelector('a'));
    }

    it('treats a plain href as an image', () => {
      expect(item('<a rel="lightbox" href="images/photo.jpg">x</a>')).toMatchObject({
        type: 'image',
        src: 'images/photo.jpg',
      });
    });

    it('treats #id as an inline dialog when the target exists', () => {
      const got = item('<a rel="lightbox" href="#box">x</a><div id="box">Body</div>');
      expect(got.type).toBe('html');
      expect(got.target).toBe(document.getElementById('box'));
    });

    it('ignores #id links whose target does not exist', () => {
      expect(item('<a rel="lightbox" href="#missing">x</a>')).toBeNull();
    });

    it.each([
      ['https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'https://www.youtube.com/embed/aqz-KE-bpKQ?rel=1&autoplay=1'],
      ['https://youtu.be/aqz-KE-bpKQ', 'https://www.youtube.com/embed/aqz-KE-bpKQ?rel=1&autoplay=1'],
      ['https://www.youtube.com/embed/aqz-KE-bpKQ', 'https://www.youtube.com/embed/aqz-KE-bpKQ?rel=1&autoplay=1'],
      ['https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=90', 'https://www.youtube.com/embed/aqz-KE-bpKQ?rel=1&autoplay=1&start=90'],
      ['https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=90s', 'https://www.youtube.com/embed/aqz-KE-bpKQ?rel=1&autoplay=1&start=90'],
      ['https://youtu.be/aqz-KE-bpKQ?t=1m30s', 'https://www.youtube.com/embed/aqz-KE-bpKQ?rel=1&autoplay=1&start=90'],
      ['https://youtu.be/aqz-KE-bpKQ?t=1h2m3s', 'https://www.youtube.com/embed/aqz-KE-bpKQ?rel=1&autoplay=1&start=3723'],
      ['https://www.youtube.com/embed/aqz-KE-bpKQ?start=42', 'https://www.youtube.com/embed/aqz-KE-bpKQ?rel=1&autoplay=1&start=42'],
      ['https://www.youtube.com/watch?v=aqz-KE-bpKQ&rel=0', 'https://www.youtube.com/embed/aqz-KE-bpKQ?rel=0&autoplay=1'],
    ])('embeds YouTube %s as %s', (href, src) => {
      expect(item(`<a rel="lightbox" href="${href}">x</a>`)).toMatchObject({ type: 'iframe', src });
    });

    it('ignores a YouTube link without a video id', () => {
      expect(item('<a rel="lightbox" href="https://www.youtube.com/watch?list=abc">x</a>')).toBeNull();
    });

    it('embeds Vimeo links in the Vimeo player', () => {
      expect(item('<a rel="lightbox" href="https://vimeo.com/76979871">x</a>')).toMatchObject({
        type: 'iframe',
        src: 'https://player.vimeo.com/video/76979871?title=0&byline=0&portrait=0&autoplay=1',
      });
      expect(item('<a rel="lightbox" href="https://vimeo.com/channels/staff">x</a>')).toBeNull();
    });

    it.each([
      ['https://mediateca.educa.madrid.org/video/abc123', 'https://mediateca.educa.madrid.org/video/abc123/fs'],
      ['https://mediateca.educa.madrid.org/video/abc123/', 'https://mediateca.educa.madrid.org/video/abc123/fs'],
      ['https://mediateca.educa.madrid.org/video/abc123?x=1#y', 'https://mediateca.educa.madrid.org/video/abc123/fs'],
      ['https://mediateca.educa.madrid.org/video/abc123/fs', 'https://mediateca.educa.madrid.org/video/abc123/fs'],
    ])('opens Mediateca %s full screen (%s)', (href, src) => {
      expect(item(`<a rel="lightbox" href="${href}">x</a>`)).toMatchObject({ type: 'iframe', src });
    });

    it('opens ?iframe=true links in an iframe sized by width/height', () => {
      expect(
        item('<a rel="lightbox" href="https://example.org/page.html?a=1&iframe=true&width=600&height=400">x</a>'),
      ).toMatchObject({ type: 'iframe', src: 'https://example.org/page.html?a=1', width: 600, height: 400 });
      expect(item('<a rel="lightbox" href="page.html?iframe=true">x</a>')).toMatchObject({
        type: 'iframe',
        src: 'page.html',
        width: 500,
        height: 344,
      });
    });

    it('sizes video embeds from width/height and defaults to 500×344', () => {
      expect(item('<a rel="lightbox" href="https://youtu.be/aqz-KE-bpKQ?width=800&height=450">x</a>')).toMatchObject({
        width: 800,
        height: 450,
      });
      expect(item('<a rel="lightbox" href="https://youtu.be/aqz-KE-bpKQ">x</a>')).toMatchObject({
        width: 500,
        height: 344,
      });
    });

    it.each([
      ['javascript:alert(1)?iframe=true', 'script scheme in an iframe'],
      ['JaVaScRiPt:alert(1)//?iframe=true', 'mixed-case script scheme'],
      ['data:text/html,<script>alert(1)</script>?iframe=true', 'data: document in an iframe'],
      ['page.html?ajax=true', 'ajax=true (prettyPhoto injected the response as HTML)'],
      ['page.html?custom=true', 'custom=true'],
      ['movie.swf', 'Flash'],
      ['movie.mov', 'QuickTime plug-in'],
    ])('does not open %s (%s)', href => {
      expect(item(`<a rel="lightbox" href="${href}">x</a>`)).toBeNull();
    });

    it('does not show a script-scheme image link', () => {
      expect(item('<a rel="lightbox" href="javascript:alert(1)">x</a>')).toBeNull();
    });

    it('takes the caption from the link title, URL-decoded, as text', () => {
      expect(item('<a rel="lightbox" href="a.jpg" title="Caf%C3%A9 %3Cb%3E">x</a>').caption).toBe('Café <b>');
      expect(item('<a rel="lightbox" href="a.jpg" title="100% sure">x</a>').caption).toBe('100% sure');
      expect(item('<a rel="lightbox" href="a.jpg"><img alt="Only alt"></a>').caption).toBe('');
    });

    it('groups lightbox[name] links and keeps plain lightbox links on their own', () => {
      document.body.innerHTML = `
        <a id="a" rel="lightbox[g1]" href="a.jpg">a</a>
        <a id="b" rel="lightbox[g1]" href="b.jpg">b</a>
        <a id="c" rel="lightbox" href="c.jpg">c</a>
        <a id="d" rel="lightbox" href="d.jpg">d</a>`;
      const group = id => exeLightbox.getItem(document.getElementById(id)).group;
      expect(group('a')).toBe('lightbox[g1]');
      expect(group('b')).toBe('lightbox[g1]');
      expect(group('c')).toBeNull();
    });
  });

  describe('bind: opening links with Tobii', () => {
    it('does nothing when there are no lightbox links', () => {
      exeLightbox.bind();
      expect(lightbox()).toBeNull();
    });

    it('does nothing when Tobii is not loaded', () => {
      const tobii = window.Tobii;
      delete window.Tobii;
      document.body.innerHTML = '<a rel="lightbox" href="a.jpg">a</a>';
      expect(() => exeLightbox.bind()).not.toThrow();
      expect(lightbox()).toBeNull();
      window.Tobii = tobii;
    });

    it('opens an image with its title as a text caption and closes with Escape', () => {
      document.body.innerHTML =
        '<a id="l" rel="lightbox" href="photo.jpg" title="%3Cimg src=x onerror=alert(1)%3E"><img src="t.jpg" alt="Thumb"></a>';
      exeLightbox.bind();
      const link = document.getElementById('l');
      click(link);

      expect(lightbox().getAttribute('aria-hidden')).toBe('false');
      const img = visibleSlide().querySelector('figure img');
      expect(img.getAttribute('src') || img.getAttribute('data-src')).toContain('photo.jpg');
      expect(img.alt).toBe('Thumb');
      const caption = visibleSlide().querySelector('figcaption');
      expect(caption.textContent).toBe('<img src=x onerror=alert(1)>');
      expect(caption.querySelector('img')).toBeNull();
      // The author's link is untouched.
      expect(link.getAttribute('href')).toBe('photo.jpg');
      expect(link.hasAttribute('data-type')).toBe(false);

      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
      expect(lightbox().getAttribute('aria-hidden')).toBe('true');
    });

    it('uses the eXe translations for the controls', () => {
      document.body.innerHTML = '<a rel="lightbox[g]" href="a.jpg">a</a><a rel="lightbox[g]" href="b.jpg">b</a>';
      exeLightbox.bind();
      expect(lightbox().querySelector('.tobii__btn--previous').getAttribute('aria-label')).toBe('Anterior');
      expect(lightbox().querySelector('.tobii__btn--next').getAttribute('aria-label')).toBe('Siguiente');
      expect(lightbox().querySelector('.tobii__btn--close').getAttribute('aria-label')).toBe('Cerrar');
    });

    it('navigates a lightbox[name] group and does not mix it with single links', () => {
      document.body.innerHTML = `
        <a id="a" rel="lightbox[g1]" href="a.jpg">a</a>
        <a id="b" rel="lightbox[g1]" href="b.jpg">b</a>
        <a id="c" rel="lightbox" href="c.jpg">c</a>`;
      exeLightbox.bind();

      click(document.getElementById('b'));
      const tobii = exeLightbox.instance();
      expect(tobii.slidesCount()).toBe(2);
      expect(tobii.slidesIndex()).toBe(1);
      tobii.previous();
      expect(tobii.slidesIndex()).toBe(0);
      tobii.close();

      click(document.getElementById('c'));
      expect(tobii.slidesCount()).toBe(1);
    });

    it('opens a clone of an inline dialog and keeps the original in the page', () => {
      document.body.innerHTML = `
        <a id="l" rel="lightbox" href="#dlg">Open</a>
        <div id="dlg" class="exe-dialog-text js-hidden"><h2 class="pp_title">Title</h2><p>Body</p></div>`;
      exeLightbox.bind();
      click(document.getElementById('l'));

      const html = visibleSlide().querySelector('.exe-lightbox-inline');
      expect(html.textContent).toContain('Body');
      expect(html.querySelector('.js-hidden')).toBeNull();
      expect(html.querySelector('#dlg')).toBeNull();
      const original = document.getElementById('dlg');
      expect(original.closest('.tobii')).toBeNull();
      expect(original.classList.contains('js-hidden')).toBe(true);

      // Rebinding (the editor does it after every render) keeps working.
      exeLightbox.instance().close();
      exeLightbox.bind();
      click(document.getElementById('l'));
      expect(visibleSlide().querySelector('.exe-lightbox-inline').textContent).toContain('Body');
      expect(document.querySelectorAll('#dlg')).toHaveLength(1);
    });

    it('gives YouTube and ?iframe=true links a sized iframe slide', () => {
      // The iframe itself is only created on open; its page load is covered by
      // the Playwright spec, so this test does not reach the network.
      document.body.innerHTML = `
        <a id="yt" rel="lightbox" href="https://youtu.be/aqz-KE-bpKQ?t=1m30s">yt</a>
        <a id="if" rel="lightbox" href="page.html?iframe=true&width=600&height=400">if</a>`;
      exeLightbox.bind();

      const slides = document.querySelectorAll('.tobii [data-type="iframe"]');
      expect(slides).toHaveLength(2);
      expect(slides[0].getAttribute('data-href')).toBe(
        'https://www.youtube.com/embed/aqz-KE-bpKQ?rel=1&autoplay=1&start=90',
      );
      expect(slides[0].getAttribute('data-width')).toBe('500px');
      expect(slides[1].getAttribute('data-href')).toBe('page.html');
      expect(slides[1].getAttribute('data-width')).toBe('600px');
      expect(slides[1].getAttribute('data-height')).toBe('400px');
    });

    it('never loads the YouTube iframe API (it needs network and breaks offline exports)', () => {
      document.body.innerHTML = '<a rel="lightbox" href="https://youtu.be/aqz-KE-bpKQ">yt</a>';
      exeLightbox.bind();
      expect(document.getElementById('iframe_api')).toBeNull();
    });

    it('leaves unsupported links as normal links', () => {
      document.body.innerHTML = '<a id="l" rel="lightbox" href="javascript:alert(1)?iframe=true">x</a>';
      exeLightbox.bind();
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      document.getElementById('l').dispatchEvent(event);
      expect(lightbox()).toBeNull();
      expect(event.defaultPrevented).toBe(false);
    });

    it('adds a download link and the title to audio and video boxes', () => {
      document.body.innerHTML = `
        <a id="a" rel="lightbox" href="#media-box-0" title="My song">a</a>
        <div class="exe-media-box js-hidden" id="media-box-0"><div class="exe-media-audio-box"><audio controls src="media/song.mp3?x=1" class="exe-media-box-element exe-media-box-audio"></audio></div></div>
        <a id="v" rel="lightbox" href="#media-box-1">v</a>
        <div class="exe-media-box js-hidden" id="media-box-1"><div class="exe-media-video-box"><video controls class="exe-media-box-element"><source src="blob:http://localhost/uuid"></video></div></div>`;
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
      exeLightbox.bind();

      click(document.getElementById('a'));
      let box = visibleSlide().querySelector('.exe-lightbox-inline');
      expect(box.classList.contains('with-audio')).toBe(true);
      expect(box.querySelector('.exe-lightbox-caption').textContent).toBe('My song');
      let download = box.querySelector('.exe-media-download a');
      expect(download.getAttribute('href')).toBe('media/song.mp3?x=1');
      expect(download.hasAttribute('download')).toBe(true);
      expect(download.getAttribute('title')).toBe('Descargar');
      expect(download.textContent).toBe('mp3');
      exeLightbox.instance().close();

      click(document.getElementById('v'));
      box = visibleSlide().querySelector('.exe-lightbox-inline');
      expect(box.classList.contains('with-audio')).toBe(false);
      expect(box.querySelector('.exe-lightbox-caption')).toBeNull();
      download = box.querySelector('.exe-media-download a');
      expect(download.getAttribute('href')).toBe('blob:http://localhost/uuid');
      expect(download.textContent).toBe('Descargar');
    });

    it('does not preload the media of the copies it prepares for the lightbox', () => {
      document.body.innerHTML = `
        <a rel="lightbox" href="#media-box-0">a</a>
        <div class="exe-media-box js-hidden" id="media-box-0"><audio controls src="song.mp3" class="exe-media-box-element exe-media-box-audio"></audio></div>
        <a rel="lightbox" href="#dlg">d</a>
        <div id="dlg"><video controls src="clip.mp4"></video></div>`;
      exeLightbox.bind();
      exeLightbox.bind();
      const copies = document.querySelectorAll('.tobii audio, .tobii video');
      expect(copies).toHaveLength(2);
      copies.forEach(media => expect(media.getAttribute('preload')).toBe('none'));
    });

    it('does not add a download link to inline dialogs', () => {
      document.body.innerHTML = '<a id="l" rel="lightbox" href="#dlg" title="T">x</a><div id="dlg">Body</div>';
      exeLightbox.bind();
      click(document.getElementById('l'));
      expect(visibleSlide().querySelector('.exe-media-download')).toBeNull();
      expect(visibleSlide().querySelector('.exe-lightbox-caption')).toBeNull();
    });

    it('rebinds after the page changes and drops links that were removed', () => {
      document.body.innerHTML = '<div id="c"><a id="a" rel="lightbox" href="a.jpg">a</a></div>';
      exeLightbox.bind();
      const old = document.getElementById('a');
      document.getElementById('c').innerHTML = '<a id="b" rel="lightbox" href="b.jpg">b</a>';
      exeLightbox.bind();

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      old.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      click(document.getElementById('b'));
      expect(exeLightbox.instance().isOpen()).toBe(true);
      expect(document.querySelectorAll('.tobii')).toHaveLength(1);
    });

    it('waits for the lightbox to close before rebinding', () => {
      document.body.innerHTML = '<a id="a" rel="lightbox" href="a.jpg">a</a>';
      exeLightbox.bind();
      click(document.getElementById('a'));
      document.body.insertAdjacentHTML('beforeend', '<a id="b" rel="lightbox" href="b.jpg">b</a>');

      exeLightbox.bind();
      expect(exeLightbox.instance().isOpen()).toBe(true);

      exeLightbox.instance().close();
      click(document.getElementById('b'));
      expect(exeLightbox.instance().isOpen()).toBe(true);
    });

    it('does not open a second time while it is already open', () => {
      document.body.innerHTML = '<a id="a" rel="lightbox" href="a.jpg">a</a><a id="b" rel="lightbox" href="b.jpg">b</a>';
      exeLightbox.bind();
      click(document.getElementById('a'));
      const group = exeLightbox.instance().currentGroup();
      expect(() => click(document.getElementById('b'))).not.toThrow();
      expect(exeLightbox.instance().currentGroup()).toBe(group);
    });
  });

  describe('full-size / new window button', () => {
    function openLargeImage() {
      document.body.innerHTML = '<a id="l" rel="lightbox" href="big.png">big</a>';
      exeLightbox.bind();
      click(document.getElementById('l'));
      const img = visibleSlide().querySelector('figure img');
      Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 4000 });
      Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 3000 });
      Object.defineProperty(img, 'clientWidth', { configurable: true, value: 800 });
      Object.defineProperty(img, 'clientHeight', { configurable: true, value: 600 });
      Object.defineProperty(img, 'complete', { configurable: true, value: true });
      exeLightbox.updateToolbar();
      return lightbox().querySelector('.exe-lightbox-full-size');
    }

    it('offers "Full size" for a resized image and opens the original', () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      const button = openLargeImage();
      expect(button.hidden).toBe(false);
      expect(button.textContent).toBe('Tamaño completo');
      click(button);
      expect(open).toHaveBeenCalledWith(expect.stringContaining('big.png'), '_blank');
      expect(exeLightbox.instance().isOpen()).toBe(true);
    });

    it('keeps pointer events on the button away from Tobii drag handling', () => {
      const button = openLargeImage();
      const seen = vi.fn();
      lightbox().addEventListener('pointerdown', seen);
      button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      button.dispatchEvent(new Event('pointerup', { bubbles: true }));
      expect(seen).not.toHaveBeenCalled();
    });

    it('says "New window" inside a SCORM or IMS package frame', () => {
      document.body.classList.add('exe-scorm');
      vi.spyOn(exeLightbox, 'isInPackageFrame').mockReturnValue(true);
      expect(openLargeImage().textContent).toBe('Nueva ventana');
    });

    it('detects a SCORM/IMS frame only when framed and the body says so', () => {
      expect(exeLightbox.isInPackageFrame()).toBe(false);
      document.body.classList.add('exe-ims');
      expect(exeLightbox.isInPackageFrame()).toBe(window.self !== window.top);
    });

    it('hides the button for an image that already fits and for non-image slides', () => {
      document.body.innerHTML = '<a id="l" rel="lightbox" href="small.png">s</a><a id="d" rel="lightbox" href="#dlg">d</a><div id="dlg">x</div>';
      exeLightbox.bind();
      click(document.getElementById('l'));
      const img = visibleSlide().querySelector('figure img');
      Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 100 });
      Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 100 });
      Object.defineProperty(img, 'clientWidth', { configurable: true, value: 100 });
      Object.defineProperty(img, 'clientHeight', { configurable: true, value: 100 });
      Object.defineProperty(img, 'complete', { configurable: true, value: true });
      exeLightbox.updateToolbar();
      expect(lightbox().querySelector('.exe-lightbox-full-size').hidden).toBe(true);
      exeLightbox.instance().close();

      click(document.getElementById('d'));
      expect(lightbox().querySelector('.exe-lightbox-full-size').hidden).toBe(true);
    });

    it('re-checks the button once the image has loaded', () => {
      document.body.innerHTML = '<a id="l" rel="lightbox" href="big.png">big</a>';
      exeLightbox.bind();
      click(document.getElementById('l'));
      const img = visibleSlide().querySelector('figure img');
      Object.defineProperty(img, 'complete', { configurable: true, value: false });
      exeLightbox.updateToolbar();
      const button = lightbox().querySelector('.exe-lightbox-full-size');
      expect(button.hidden).toBe(true);

      Object.defineProperty(img, 'complete', { configurable: true, value: true });
      Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 4000 });
      Object.defineProperty(img, 'clientWidth', { configurable: true, value: 800 });
      img.dispatchEvent(new Event('load'));
      expect(button.hidden).toBe(false);
    });
  });
});
