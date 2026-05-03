/**
 * UDL Content iDevice - Edition Tests
 */

/* eslint-disable no-undef */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('udl-content iDevice (edition)', () => {
  let $exeDevice;
  let originalCommon;
  let sanitizeTextMock;
  let sanitizeHtmlMock;
  let sanitizeUrlMock;

  beforeEach(() => {
    global.$exeDevice = undefined;
    document.body.innerHTML = '';

    originalCommon = $exeDevicesEdition.iDevice.common;
    sanitizeTextMock = vi.fn((value = '') => String(value ?? '').replace(/<[^>]*>/g, ''));
    sanitizeHtmlMock = vi.fn((value = '') =>
      String(value ?? '').replace(/<script[\s\S]*?<\/script>/gi, '')
    );
    sanitizeUrlMock = vi.fn((value = '') => String(value ?? ''));

    $exeDevicesEdition.iDevice.common = {
      ...originalCommon,
      sanitizeText: sanitizeTextMock,
      sanitizeHtml: sanitizeHtmlMock,
      sanitizeUrl: sanitizeUrlMock,
    };

    $exeDevice = global.loadIdevice(join(__dirname, 'udl-content.js'));
  });

  afterEach(() => {
    $exeDevicesEdition.iDevice.common = originalCommon;
    global.$exeDevice = undefined;
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('sanitizes form values in formToJSON', () => {
    document.body.innerHTML = `
      <article class="udlContentFormBlock" id="udlContentFormBlock-0">
        <input type="text" value="<b>Button</b>">
        <input type="radio" checked value="99">
      </article>
      <textarea id="udlContentFormTxt-0-0"><p>Main</p><script>alert(1)</script></textarea>
      <textarea id="udlContentFormTxt-0-1"><p>Alt1</p><script>alert(1)</script></textarea>
      <textarea id="udlContentFormTxt-0-2"><p>Alt2</p><script>alert(1)</script></textarea>
      <textarea id="udlContentFormTxt-0-3"><p>Alt3</p><script>alert(1)</script></textarea>
    `;

    const data = $exeDevice.formToJSON();

    expect(data).toHaveLength(1);
    expect(data[0].btnTxt).toBe('Button');
    expect(data[0].btnType).toBe(0);
    expect(data[0].contMain).not.toContain('<script');
    expect(data[0].contAlt1).not.toContain('<script');
    expect(data[0].contAlt2).not.toContain('<script');
    expect(data[0].contAlt3).not.toContain('<script');
    expect(sanitizeHtmlMock).toHaveBeenCalled();
  });

  it('sanitizes save output and normalizes invalid type values', () => {
    document.body.innerHTML = `
      <input id="ci18n_simplified" value="Read<script>x</script>">
      <input id="ci18n_audio" value="Audio<script>x</script>">
      <input id="ci18n_visual" value="Visual<script>x</script>">
      <input id="ci18n_hide" value="Close<script>x</script>">
      <input type="radio" name="udlContentType" value="hacked" checked>
    `;

    vi.spyOn($exeDevice, 'formToJSON').mockReturnValue([
      {
        btnTxt: '<img src=x onerror=alert(1)>Title | <svg onload=alert(1)>Visible',
        btnType: '4<script>',
        contMain: '<p>Main</p><script>alert(1)</script>',
        contAlt1: '<p>Alternative</p><script>alert(1)</script>',
        contAlt2: '',
        contAlt3: '',
      },
    ]);

    const html = $exeDevice.save();

    expect(html).toContain('exe-udlContent-engagement');
    expect(html).toContain('exe-udlContent-character-4');
    expect(html).toContain('<span class="sr-av">Title </span>Visible');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onerror=');
  });

  it('escapes textarea-breaking payloads when building block forms', () => {
    document.body.innerHTML = '<div id="udlContentFormBlocks"></div>';

    $exeDevice.createBlockForm({
      btnTxt: 'Button',
      btnType: 0,
      contMain: '</textarea><script>alert(1)</script>',
      contAlt1: '',
      contAlt2: '',
      contAlt3: '',
    });

    const formHtml = document.getElementById('udlContentFormBlocks').innerHTML;
    expect(formHtml).not.toContain('</textarea><script>');
    expect(formHtml).not.toContain('<script>alert(1)</script>');
  });
});
