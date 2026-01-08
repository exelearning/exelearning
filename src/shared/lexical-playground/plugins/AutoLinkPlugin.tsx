/**
 * AutoLinkPlugin - Automatically converts URLs and emails to links
 */
import { AutoLinkPlugin as LexicalAutoLinkPlugin } from '@lexical/react/LexicalAutoLinkPlugin';

const URL_REGEX =
    /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

const EMAIL_REGEX =
    /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;

const MATCHERS = [
    (text: string) => {
        const match = URL_REGEX.exec(text);
        if (match === null) return null;
        const fullMatch = match[0];
        return {
            index: match.index,
            length: fullMatch.length,
            text: fullMatch,
            url: fullMatch.startsWith('http') ? fullMatch : `https://${fullMatch}`,
            attributes: { rel: 'noopener', target: '_blank' },
        };
    },
    (text: string) => {
        const match = EMAIL_REGEX.exec(text);
        if (match === null) return null;
        return {
            index: match.index,
            length: match[0].length,
            text: match[0],
            url: `mailto:${match[0]}`,
        };
    },
];

export function AutoLinkPlugin() {
    return <LexicalAutoLinkPlugin matchers={MATCHERS} />;
}
