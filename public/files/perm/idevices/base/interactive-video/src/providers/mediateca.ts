/**
 * EducaMadrid Mediateca: plays through a native `<video>` over the legacy
 * streaming URL (HTTPS-forced), sharing the HTML5 adapter.
 */

const MEDIATECA_STREAM = 'https://mediateca.educa.madrid.org/streaming.php?id=';

/** The legacy Mediateca stream URL (fed to a native `<video>`). */
export function mediatecaStreamUrl(videoId: unknown): string {
    return MEDIATECA_STREAM + encodeURIComponent(videoId == null ? '' : String(videoId));
}
