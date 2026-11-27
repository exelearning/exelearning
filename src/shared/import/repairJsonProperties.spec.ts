import { describe, expect, it } from 'bun:test';
import { repairJsonProperties } from './repairJsonProperties';

describe('repairJsonProperties', () => {
    it('escapes the unescaped quotes of an HTML attribute spliced into a string', () => {
        // Shape found in a package edited by an AI generator: every quote of the
        // HTML is escaped except those of one image.
        const raw =
            '{"textTextarea":"<p style=\\"text-align: center;\\"><img src="{{context_path}}/content/resources/volcan.jpg" style="max-width: 100%; height: auto;" /></p>","textFeedbackInput":"Show Feedback"}';

        expect(() => JSON.parse(raw)).toThrow();
        expect(repairJsonProperties(raw)).toEqual({
            textTextarea:
                '<p style="text-align: center;"><img src="{{context_path}}/content/resources/volcan.jpg" style="max-width: 100%; height: auto;" /></p>',
            textFeedbackInput: 'Show Feedback',
        });
    });

    it('repairs empty attribute values and nested arrays (#2177 shape)', () => {
        const raw =
            '{"questionsData":[{"baseText":"<audio controls="controls" src=""><a href="">audio.webm</a></audio>","answer":"True"}]}';

        expect(repairJsonProperties(raw)).toEqual({
            questionsData: [
                { baseText: '<audio controls="controls" src=""><a href="">audio.webm</a></audio>', answer: 'True' },
            ],
        });
    });

    it('escapes raw line breaks and tabs inside strings', () => {
        expect(repairJsonProperties('{"text":"<p>one</p>\n<p>\ttwo</p>"}')).toEqual({
            text: '<p>one</p>\n<p>\ttwo</p>',
        });
    });

    it('escapes other raw control characters as unicode escapes', () => {
        expect(repairJsonProperties('{"text":"a\u0001b"}')).toEqual({ text: 'a\u0001b' });
    });

    it('keeps valid escapes and escapes a backslash that starts none', () => {
        expect(repairJsonProperties('{"path":"C:\\docs\\dir","quote":"\\"ok\\" \\u00e9\\n"}')).toEqual({
            path: 'C:\\docs\\dir',
            quote: '"ok" é\n',
        });
    });

    it('drops trailing commas before a closing brace or bracket', () => {
        expect(repairJsonProperties('{"list":[1,2,],"name":"a",}')).toEqual({ list: [1, 2], name: 'a' });
    });

    it('returns null for a truncated payload it cannot close', () => {
        expect(repairJsonProperties('{"text":"<img src="a.png">"')).toBeNull();
    });

    it('returns null when an inner quote looks like the end of the string', () => {
        // The quote before the comma is ambiguous; guessing would risk the data.
        expect(repairJsonProperties('{"text":"He said "hi", then left"}')).toBeNull();
    });

    it('returns null when the payload needs no rewrite', () => {
        expect(repairJsonProperties('{"a":1')).toBeNull();
        expect(repairJsonProperties('{"a":1}')).toBeNull();
    });

    it('returns null when the repaired payload is not an object', () => {
        expect(repairJsonProperties('["a",]')).toBeNull();
        expect(repairJsonProperties('"a\nb"')).toBeNull();
    });

    it('returns null for empty or non-string input', () => {
        expect(repairJsonProperties('')).toBeNull();
        expect(repairJsonProperties('   ')).toBeNull();
        expect(repairJsonProperties(undefined as unknown as string)).toBeNull();
    });
});
