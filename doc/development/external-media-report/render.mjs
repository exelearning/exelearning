import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Beside this file, so the renderer and its evidence never drift apart. */
const DIR = dirname(fileURLToPath(import.meta.url));
const ev = JSON.parse(readFileSync(join(DIR, 'evidence.json'), 'utf8'));

/** A capture as an inline data URI, or null when the file was never produced. */
const toDataUri = (...segments) => {
    const file = join(DIR, ...segments);
    return existsSync(file) ? `data:image/png;base64,${readFileSync(file).toString('base64')}` : null;
};
const shot = id => toDataUri('shots', id);
const runtime = id => {
    const p = join(DIR, 'shots', `${id}.json`);
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
};
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const yn = ok => `<span class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'}</span>`;

/**
 * Whether every iDevice the host SERVED on this page also MOUNTED.
 *
 * Compared by type rather than by count: a page can legitimately render more nodes than the
 * served markup declares (the runtime adds state classes), but a type that was sent and is
 * absent means an iDevice died inside the sandbox.
 */
const mountedAll = p =>
    (p.servedIdeviceTypes || []).every(t => (p.mountedIdeviceTypes || []).includes(t));

const cards = ev.plugins.map(p => {
    const r = runtime(p.id);
    const img = shot(p.id);
    const browserVerified = r && r.canonicalHost === 'object' && r.contentFrames > 0;
    return `
<section class="card">
  <h3>${esc(p.name)} <span class="badge ${p.ok ? 'good' : 'warn'}">${p.ok ? 'migrado y verificado' : 'ver notas'}</span></h3>
  <dl>
    <dt>URL probada</dt><dd><code>${esc(p.url)}</code></dd>
    <dt>Artefacto vendorizado</dt><dd><code>${esc(p.vendored)}</code></dd>
    <dt>buildHash idéntico al core</dt><dd>${yn(p.matchesCore)} <code>${esc((p.vendoredBuildHash || '—').slice(0, 24))}…</code></dd>
    <dt>Bytes idénticos (child / host)</dt><dd>${yn(p.bytesIdentical.child)} child &nbsp; ${yn(p.bytesIdentical.host)} host</dd>
    <dt><code>verify.mjs --build-hash</code></dt><dd>${yn(p.verifier === 'pass')} ${esc(p.verifier)}</dd>
  </dl>
  <table>
    <tr><th>Comprobación en la página servida</th><th></th></tr>
    ${p.markers.map(m => `<tr><td>${esc(m.why)}</td><td>${yn(m.ok)}</td></tr>`).join('')}
  </table>
  ${r ? `<table>
    <tr><th>Estado del runtime (navegador real)</th><th></th></tr>
    <tr><td><code>window.exeExternalMediaHost</code> presente</td><td>${yn(r.canonicalHost === 'object')}</td></tr>
    <tr><td>Fachadas legacy (<code>exeEmbedRelay</code>, <code>exeMediaHost</code>) siguen vivas</td><td>${yn(r.legacyRelayFacade === 'object' && r.legacyMediaFacade === 'object')}</td></tr>
    <tr><td>SDK de YouTube ausente</td><td>${yn(r.youtubeSdk === 'undefined')}</td></tr>
    <tr><td>SDK de Vimeo ausente</td><td>${yn(r.vimeoSdk === 'undefined')}</td></tr>
    <tr><td>Scripts obsoletos cargados</td><td>${yn(r.oldScripts.length === 0)} ${r.oldScripts.length}</td></tr>
    <tr><td>iframes de contenido / players promovidos</td><td>${r.contentFrames} / ${r.promotedPlayers}</td></tr>
  </table>` : '<p class="note">Sin captura de runtime.</p>'}
  ${!browserVerified ? `<p class="note"><strong>Nota honesta:</strong> este entorno está levantado y su artefacto verifica contra el manifest, pero <strong>no se pudo verificar en navegador con contenido real</strong> porque no tiene recursos sembrados. Lo que se afirma arriba es lo comprobado; lo demás no se afirma.</p>` : ''}
  ${img ? `<figure><img src="${img}" alt="Captura de ${esc(p.name)}"><figcaption>${esc(p.name)} — captura real del entorno local</figcaption></figure>` : ''}
</section>`;
}).join('\n');

// --- surfaces ---------------------------------------------------------------------
const SURFACE_IDS = ['wordpress-block', 'wordpress-shortcode', 'wordpress-admin', 'omeka-public', 'omeka-admin'];
const surfaces = SURFACE_IDS.map(id => {
    const f = join(DIR, 'surfaces', `${id}.json`);
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}).filter(Boolean);

const surfaceShot = id => toDataUri('surfaces', id);

const surfacesSection = surfaces.length
    ? `
<section class="card">
  <h3>Superficies por plataforma <span class="badge good">${surfaces.length}</span></h3>
  <p>El mismo paquete llega al lector por más de un camino, y <strong>no son el mismo código</strong>.
  WordPress lo renderiza por el bloque de Gutenberg (<code>render_block()</code>), por el shortcode
  <code>[exelearning]</code> —con sus propios atributos por defecto— y por el componente
  <code>edit</code> del bloque en el backend. Omeka tiene la página pública del ítem y la ficha de
  administración, que inyecta el visor desde otro hook. Una regresión puede vivir en exactamente
  uno de ellos, y el recorrido de 21 páginas, que corre sobre una sola superficie por plataforma,
  no la vería.</p>
  <table>
    <tr><th>Superficie</th><th>Qué ejercita</th><th>Contenido opaco</th><th>Vídeo</th><th>Sin SDK</th></tr>
    ${surfaces
        .map(
            s => `<tr>
              <td><strong>${esc(s.platform)}</strong><br>${esc(s.name)}</td>
              <td>${esc(s.note)}</td>
              <td>${yn(s.contentOpaque)}</td>
              <td>${s.expect === 'promoted' ? `${s.players.length} promocionado(s)` : 'nativo dentro del frame'}</td>
              <td>${yn(s.youtubeSdk === 'undefined' && s.vimeoSdk === 'undefined')}</td>
            </tr>`,
        )
        .join('')}
  </table>
  <p class="note"><strong>El backend de WordPress era la excepción, y ha dejado de serlo.</strong>
  Su vista previa del editor servía el contenido con <code>allow-same-origin</code>: un paquete
  subido corría con el origen del propio sitio justo en la pantalla donde quien mira contenido no
  confiable es quien tiene las credenciales. Ahora los tokens salen de la misma fuente que la
  página pública, y el relay se inicializa también ahí, así que la superficie del autor tiene la
  misma frontera y la misma promoción que la del lector.</p>
  <p class="note">Arreglarlo destapó dos cosas más en el camino. El modo profesor se inyectaba como
  CSS dentro del iframe —lo único que un origen opaco prohíbe— y habría dejado de funcionar en
  silencio; ahora viaja por la URL (<code>?exe-teacher=1</code>), como en el front. Y el
  <em>attach</em> del host de medios no estaba guardado: esa pantalla servía <strong>38 copias</strong>
  del mismo bucle y ningún <code>init</code>. La idempotencia ya no depende de un flag estático que
  se ponía antes de que la línea llegara a añadirse, sino de lo que la página lleva de verdad.</p>
  <div class="grid">
    ${surfaces
        .map(s => {
            const img = surfaceShot(s.id);
            return img
                ? `<figure><img src="${img}" alt="${esc(s.id)}"><figcaption>${esc(s.platform)} — ${esc(s.name)}</figcaption></figure>`
                : '';
        })
        .join('')}
  </div>
</section>`
    : '';

// --- page walks -----------------------------------------------------------------
const walks = ['moodle', 'wordpress', 'omeka', 'procomun', 'nextcloud']
    .map(id => {
        const f = join(DIR, 'pages', `${id}-pages.json`);
        return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
    })
    .filter(Boolean);

const pageShot = name => toDataUri('pages', name);

const walkSections = walks.map(w => {
    const id = w.platform.toLowerCase().replace(/[^a-z]/g, '').slice(0, 9);
    // Match the screenshot filenames, which use the platform ID: lowercase, unaccented and
    // first word only. Deriving it from the display name without stripping accents silently
    // dropped every Procomún figure (files are `procomun-*`, the name is `Procomún`).
    const prefix = w.platform
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(' ')[0];
    const players = w.pages.reduce((n, p) => n + ((p.promotedPlayers || []).length), 0);
    const rows = w.pages.map(p => `<tr>
        <td>${p.index}. <code>${esc(p.slug)}</code></td>
        <td>${p.unreachable ? '—' : (p.elapsedMs + ' ms')}</td>
        <td>${(p.promotedPlayers || []).length || ''}</td>
        <td>${p.servedIdevices == null ? '—' : `${p.mountedIdevices}/${p.servedIdevices} ${yn(mountedAll(p))}`}</td>
        <td>${yn(!p.sdkLeaked)}</td>
        <td>${esc(String(p.navigatedBy ?? '—'))}</td></tr>`).join('');
    const shots = w.pages
        .map(p => {
            const file = `${prefix}-${String(p.index).padStart(2, '0')}-${p.slug}.png`;
            const src = pageShot(file);
            return src ? `<figure><img src="${src}" alt="${esc(p.slug)}"><figcaption>${p.index}. ${esc(p.slug)}</figcaption></figure>` : '';
        })
        .join('');
    return `
<section class="card">
  <h3>${esc(w.platform)} — recorrido del paquete <span class="badge good">${w.pages.length} páginas</span></h3>
  <dl>
    <dt>Paquete servido</dt><dd>${esc(w.package || 'evil.elpx (sonda del paper)')}</dd>
    <dt>Vía de importación</dt><dd>${esc(w.ingestion || 'no registrada')}</dd>
    <dt>URL</dt><dd><code>${esc(w.url || w.activity)}</code></dd>
    <dt>Tiempo por página</dt><dd>${Math.round(w.totalMs / w.pages.length)} ms de media · ${w.totalMs} ms sumados${w.wallClockMs ? ` <span class="note">(reloj de pared del recorrido, capturas incluidas: ${w.wallClockMs} ms)</span>` : ''}</dd>
    <dt>Players promovidos</dt><dd>${players}</dd>
    <dt>Mitad de medios</dt><dd>${w.mediaHostAnswered == null
        ? 'no medida'
        : `${yn(w.mediaHostAnswered)} ${w.mediaHostAnswered ? 'responde al saludo' : 'no responde al saludo'}${w.mediaHostDeclared ? '' : ' <span class="note">(no declarada por esta plataforma)</span>'}`}</dd>
  </dl>
  <table><tr><th>Página</th><th>Tiempo</th><th>Players</th><th>iDevices montados</th><th>Sin SDK</th><th>Navegación</th></tr>${rows}</table>
  <div class="grid">${shots}</div>
</section>`;
}).join('\n');

// --- playback ---------------------------------------------------------------------
const playbackRuns = ['youtube', 'vimeo']
    .flatMap(provider =>
        ['chromium', 'firefox', 'static'].map(engine => {
            const f = join(DIR, 'shots', `playback-${provider}-${engine}.json`);
            return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
        }),
    )
    .filter(Boolean);

const playbackSection = playbackRuns.length
    ? `
<section class="card">
  <h3>Reproducción real <span class="badge good">${playbackRuns.length} combinaciones</span></h3>
  <p>Un documento opaco pide un vídeo, el host monta el reproductor y el contenido lo conduce por
  el puerto transferido. La afirmación no es «hay un reproductor», es <strong>el reloj del propio
  reproductor avanza</strong>: se envía <code>play</code>, se lee el tiempo de vuelta desde dentro
  del iframe opaco, y luego <code>pause</code> tiene que detenerlo.</p>
  <table>
    <tr><th>Proveedor</th><th>Motor</th><th>Segundos tras <code>play</code></th><th>Tras 2,5 s en pausa</th><th>Eventos recibidos</th></tr>
    ${playbackRuns
        .map(
            r => `<tr><td>${esc(r.provider)}</td><td>${esc(r.engine)}</td><td>${r.secondsAfterPlay} s</td>
                  <td>${r.secondsAfterPausing2500ms} s</td>
                  <td><code>${esc((r.events || []).join(' → '))}</code></td></tr>`,
        )
        .join('')}
  </table>
  <p class="note">Son los proveedores de verdad, no dobles: un stub no puede fallar como falla un
  proveedor. Y la prueba no pasa en vacío — rompiendo el comando <code>play</code> del dialecto
  (<code>playVideo</code> → un nombre inexistente) el reloj se queda en <code>0</code> y el test
  cae. Si el entorno no llega al proveedor, el test se salta explícitamente en vez de dar un verde
  que no ha ganado.</p>
  <p class="note"><strong>Añadir Vimeo encontró dos fallos que YouTube no podía encontrar.</strong>
  Cada proveedor habla su propio protocolo y el host tiene una traducción por proveedor: que
  YouTube funcione no dice nada de la de al lado. (1) Con <code>api=1</code> Vimeo emite
  <code>playProgress</code>, no <code>timeupdate</code>, así que la caché de tiempo no se
  actualizaba nunca. (2) Vimeo acepta las suscripciones enviadas al <code>load</code> del iframe y
  no conecta ninguna: solo escucha tras su propio <code>ready</code>. Las dos fallaban en silencio
  — el reproductor cargaba, se reproducía a mano y no reportaba nada — así que cualquier pregunta
  de vídeo interactivo anclada a un segundo jamás se habría disparado en Vimeo.</p>
</section>`
    : '';

// --- editor preview -------------------------------------------------------------
const editorShot = n => toDataUri('shots', n);
const editorJson = existsSync(join(DIR, 'shots', 'editor-preview.json'))
    ? JSON.parse(readFileSync(join(DIR, 'shots', 'editor-preview.json'), 'utf8'))
    : null;
const editorSection = editorJson ? `
<section class="card">
  <h3>Vista previa del editor <span class="badge good">promoción bajo consentimiento</span></h3>
  <p>Las dos mitades del argumento de la ADR-2199-02: por defecto el contenido activo se
  <strong>detecta y no se ejecuta</strong>; solo al habilitarlo el transporte pasa a opaco y el
  embed se promueve a un player real.</p>
  <table>
    <tr><th>Comprobación</th><th></th></tr>
    <tr><td>Preview opaco (<code>sandbox</code> sin <code>allow-same-origin</code>)</td><td>${yn(editorJson.previewOpaque)}</td></tr>
    <tr><td>Host canónico en ejecución</td><td>${yn(editorJson.canonicalHost === 'object')}</td></tr>
    <tr><td>SDK de YouTube ausente del editor</td><td>${yn(editorJson.youtubeSdk === 'undefined')}</td></tr>
    <tr><td>Players promovidos</td><td>${(editorJson.players || []).length}</td></tr>
  </table>
  ${(editorJson.players || []).map(s => `<p><code>${esc(s)}</code></p>`).join('')}
  <div class="grid grid--pair">
    ${editorShot('editor-preview-filtered.png') ? `<figure><img src="${editorShot('editor-preview-filtered.png')}"><figcaption>Por defecto: filtrado, el embed no se ejecuta</figcaption></figure>` : ''}
    ${editorShot('editor-preview.png') ? `<figure><img src="${editorShot('editor-preview.png')}"><figcaption>Tras habilitar: opaco, player real superpuesto</figcaption></figure>` : ''}
  </div>
</section>` : '';


// --- iDevices served vs mounted, and the media half ----------------------------------
/**
 * The check that turns a silent failure into a loud one.
 *
 * An iDevice that dies inside the sandbox leaves no trace: the node is simply absent, which
 * is indistinguishable from a page that never had one. Comparing what the host SENT against
 * what actually mounted is what makes the difference visible, and it is reported per
 * platform because a package that mounts everywhere except one host is the interesting case.
 */
/** Totals a per-page field across a walk, counting arrays by length. */
const sum = (walk, field) =>
    walk.pages.reduce((n, page) => {
        const value = page[field];
        return n + (Array.isArray(value) ? value.length : (value ?? 0));
    }, 0);

const integritySection = walks.length
    ? `
<section class="card">
  <h3>Integridad del contenido dentro del sandbox</h3>
  <p>Por página se compara el marcado <strong>servido</strong> por el host con los nodos que
  realmente <strong>montan</strong> dentro del iframe opaco. Un iDevice que falla aislado no
  deja rastro — el nodo no está, igual que en una página que nunca lo tuvo — así que sin esta
  comparación el fallo se lee como normalidad.</p>
  <p>La <strong>mitad de medios</strong> se adopta por separado de la de embeds: un host puede
  promocionar embeds correctamente y no responder a un iDevice que le pide conducir un vídeo.
  Se mide preguntando desde dentro del contenido, que es el único sitio donde la respuesta
  significa algo.</p>
  <table>
    <tr><th>Plataforma</th><th>Páginas</th><th>iDevices servidos</th><th>Montados</th>
        <th>Páginas completas</th><th>Mitad de medios</th>
        <th>Imágenes del paquete</th><th>Remotas bloqueadas</th><th>Marcos PDF</th></tr>
    ${walks.map(w => {
        const measured = w.pages.filter(p => p.servedIdevices != null);
        const served = measured.reduce((n, p) => n + p.servedIdevices, 0);
        const mounted = measured.reduce((n, p) => n + p.mountedIdevices, 0);
        const complete = measured.filter(mountedAll).length;
        return `<tr>
          <td>${esc(w.platform)}</td>
          <td>${w.pages.length}</td>
          <td>${served || '—'}</td>
          <td>${mounted || '—'}</td>
          <td>${measured.length ? `${complete}/${measured.length} ${yn(complete === measured.length)}` : '—'}</td>
          <td>${w.mediaHostAnswered == null ? 'no medida' : yn(w.mediaHostAnswered)}${w.mediaHostDeclared ? '' : ' <span class="note">no declarada</span>'}</td>
          <td>${sum(w, 'images')} · ${sum(w, 'localImagesBroken')} rotas ${yn(sum(w, 'localImagesBroken') === 0)}</td>
          <td>${sum(w, 'remoteImagesBlocked')}</td>
          <td>${sum(w, 'pdfFrames')} · ${sum(w, 'pdfFramesWithoutBox')} sin caja ${yn(sum(w, 'pdfFramesWithoutBox') === 0)}</td>
        </tr>`;
    }).join('')}
  </table>
  <p>Las tres últimas columnas responden a una pregunta que el resto del informe no hacía:
  <strong>¿se ve lo que el paquete referencia?</strong> Se exige que las imágenes que viajan
  <em>dentro</em> del paquete rendericen siempre — que falle una es el host sirviendo mal algo
  de lo que responde. Lo <strong>remoto</strong> se registra, no se exige: bajo el perfil CSP
  estricto el contenido recibe <code>img-src 'self' … data: blob:</code> y un
  <code>frame-src</code> limitado a los proveedores promocionados, así que una imagen o un PDF
  remotos quedan bloqueados <em>por diseño</em> — un <code>&lt;img&gt;</code> apuntando al host
  de un atacante es una baliza que filtra la dirección del lector y el hecho de que abrió el
  material. Exigir que cargue sería exigir que se debilite la frontera.</p>
  <p class="note">De ahí la única asimetría de la tabla: cuatro plataformas bloquean la imagen
  remota de la sonda y Procomún no. No es un fallo del arnés ni del paquete — es una diferencia
  de política entre hosts, y es justo lo que esta comparación existe para hacer visible.</p>
  <p class="note">Ambas comprobaciones nacen de un fallo real y medido: el iDevice de vídeo
  interactivo cargaba la API de YouTube desde dentro del paquete, la CSP del contenido la
  bloqueaba — correctamente — y el nodo no llegaba a montar. El aprendiz veía un panel en
  blanco tras pulsar iniciar, y el recorrido registraba una página con cero players
  promovidos, que es exactamente lo que registra una página sin vídeo.</p>
</section>`
    : '';

const html = `<h1>Migración external-media: los plugins sobre el artefacto canónico</h1>
<p class="lede">Cada plugin dejó de llevar su propia copia de la lógica y pasó a vendorizar los <strong>bytes</strong> que publica el core, verificándolos contra su manifest. Este informe recoge lo que se puede comprobar, y dice explícitamente lo que no.</p>

<section class="card">
  <h3>Origen</h3>
  <dl>
    <dt>buildHash del core</dt><dd><code>${esc(ev.core.buildHash)}</code></dd>
    <dt>Commit</dt><dd><code>${esc(ev.core.sourceCommit)}</code></dd>
    <dt>child</dt><dd><code>${esc(ev.core.files.child.sha256.slice(0, 32))}…</code> · ${ev.core.files.child.bytes} B</dd>
    <dt>host</dt><dd><code>${esc(ev.core.files.host.sha256.slice(0, 32))}…</code> · ${ev.core.files.host.bytes} B</dd>
  </dl>
</section>

${cards}

${editorSection}

${playbackSection}

${surfacesSection}

${integritySection}

${walkSections}

<section class="card">
  <h3>Qué demuestra y qué no</h3>
  <p><strong>Demuestra</strong> que cada plugin sirve el mismo artefacto, byte a byte, que publica el core; que el SDK de YouTube y el de Vimeo ya no se cargan en la página de confianza; que ningún fichero superado sigue enlazado; y que las fachadas antiguas siguen funcionando sobre el runtime nuevo.</p>
  <p>Las <strong>cinco</strong> plataformas sirven ahora <code>evil.elpx</code>, importado en cada
  una por su propia vía de ingesta (ver «Vía de importación» en cada tarjeta), y las cinco recorren
  el <strong>mismo conjunto de 21 páginas</strong> y promocionan los <strong>mismos tres
  proveedores</strong> — YouTube, Vimeo y Dailymotion. Esa coincidencia es lo que convierte la
  comparación en una comparación de <em>hosts</em> y no de contenidos.</p>
  <p><strong>Que el vídeo se reproduce sí está demostrado</strong>, y medido: ver «Reproducción
  real» más arriba. Es la mitad de <em>medios</em> del puente — la que usa el iDevice de vídeo
  interactivo — donde el contenido recibe un controlador por un puerto transferido y puede dar
  órdenes al reproductor. Se envía <code>play</code>, el reloj del reproductor avanza por encima de
  un segundo, y <code>pause</code> lo detiene; leído desde dentro del documento opaco, en tres
  motores y para <strong>los dos proveedores controlables</strong>, YouTube y Vimeo.</p>
  <p><strong>Lo que los recorridos no demuestran</strong> es eso mismo, y no por descuido. Los
  recorridos ejercitan la otra mitad, la de <em>embeds</em>: ahí el host promociona un iframe que el
  autor escribió en su página, y lo reconstruye a la URL canónica del proveedor
  <strong>sin</strong> <code>enablejsapi</code>. Sin ese parámetro el reproductor no acepta órdenes
  de nadie — que es justo lo que se quiere para contenido no confiable — así que en esas 105 páginas
  lo que se captura es presencia y aislamiento, no reproducción. Las dos mitades responden a
  preguntas distintas y ninguna sustituye a la otra.</p>
  <p>Sigue sin demostrarse que un vídeo llegue al último fotograma, y no se ha intentado: haría el
  informe diez minutos más lento por vídeo para no distinguir ningún fallo que el reloj avanzando ya
  no distinga.</p>
  <p>Sobre <strong>Nextcloud</strong>: se levanta en <code>:8081</code> porque el 8080 por defecto
  lo ocupa Omeka en este conjunto de entornos. Su recorrido navega el paquete con un click de DOM,
  no con un click real: en el ancho del visor el tema colapsa la navegación y Playwright — con
  razón — se niega a pulsar un enlace oculto. Se registra en la columna «Navegación» en vez de
  disimularlo, porque significa que esas páginas <em>no</em> son alcanzables a ratón en ese ancho.</p>
  <p class="note">Los tiempos miden desde el clic hasta que la página queda asentada, y
  <strong>excluyen a propósito</strong> el trabajo de este arnés (centrar el embed, esperar a que
  el overlay lo siga, capturar): incluirlo cuadruplicaba cada cifra y convertía una columna de
  tiempos de página en una medición de las esperas del propio script. Aun así son
  <strong>una ejecución, no un benchmark</strong>. Sirven para ver una
  regresión del tipo que importa aquí — una petición de más, un bundle que dobla — no para comparar
  plataformas entre sí: corren en contenedores distintos y con cargas distintas.</p>
  <p class="note">Un detalle que parece un error y no lo es: WordPress y Omeka registran <em>“Failed to read the 'localStorage' property … the document is sandboxed and lacks the 'allow-same-origin' flag”</em>. Viene de <strong>dentro</strong> del frame de contenido, y es exactamente la frontera de origen opaco funcionando.</p>
</section>`;

const style = `<style>
:root{color-scheme:light dark}
body{font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:60rem;margin:2rem auto;padding:0 1.25rem}
h1{font-size:1.6rem;line-height:1.25}
.lede{font-size:1.05rem;opacity:.85}
.card{border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:.6rem;padding:1rem 1.25rem;margin:1.25rem 0}
.card h3{margin:.2rem 0 .8rem;font-size:1.15rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
.badge{font-size:.72rem;font-weight:600;padding:.15rem .5rem;border-radius:1rem;text-transform:uppercase;letter-spacing:.03em}
.badge.good{background:#0a7f3f22;color:#0a7f3f}
.badge.warn{background:#a8620022;color:#a86200}
dl{display:grid;grid-template-columns:minmax(11rem,auto) 1fr;gap:.3rem .9rem;margin:0 0 .9rem}
dt{opacity:.7}dd{margin:0}
table{width:100%;border-collapse:collapse;margin:.6rem 0;font-size:.92rem}
th{text-align:left;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;opacity:.6;padding:.35rem 0;border-bottom:1px solid color-mix(in srgb,currentColor 15%,transparent)}
td{padding:.3rem 0;border-bottom:1px solid color-mix(in srgb,currentColor 8%,transparent)}
td:last-child,th:last-child{text-align:right;width:5rem}
code{font-size:.86em;background:color-mix(in srgb,currentColor 8%,transparent);padding:.1rem .3rem;border-radius:.25rem;word-break:break-all}
.ok{color:#0a7f3f;font-weight:700}.no{color:#c0392b;font-weight:700}
figure{margin:1rem 0 0}img{max-width:100%;border-radius:.4rem;border:1px solid color-mix(in srgb,currentColor 15%,transparent)}
.grid{display:grid;grid-template-columns:1fr;gap:1.2rem;margin-top:.8rem}
.grid--pair{grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))}
figure{break-inside:avoid;page-break-inside:avoid}
.grid figure{margin:0}
figcaption{font-size:.82rem;opacity:.65;margin-top:.4rem}
.note{font-size:.9rem;opacity:.8;background:color-mix(in srgb,currentColor 5%,transparent);padding:.7rem .9rem;border-radius:.4rem}
@media(max-width:34rem){dl{grid-template-columns:1fr}dt{margin-top:.5rem}}
</style>`;

writeFileSync(join(DIR, 'informe.html'), `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Migración external-media — informe</title>${style}</head><body>${html}</body></html>`);
console.log('informe.html escrito');
