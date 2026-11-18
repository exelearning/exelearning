import { describe, expect, it } from 'vitest';
import { SlideCanvasAdapter } from './canvasAdapter.ts';

describe('SlideCanvasAdapter.serialize', () => {
    it('asks Fabric for the custom properties and swaps image src for its asset URL', () => {
        let requested;
        const canvas = {
            toObject: props => {
                requested = props;
                return {
                    objects: [
                        { type: 'Image', src: 'blob:http://x/1', slideAssetUrl: 'asset://a.png', slideMeta: { role: 'image' } },
                        { type: 'Rect', slideMeta: { role: 'rect' } },
                    ],
                };
            },
        };
        const json = SlideCanvasAdapter.prototype.serialize.call({ canvas });

        expect(requested).toEqual(expect.arrayContaining(['slideMeta', 'slideAssetUrl', 'slideAssetName']));
        expect(json.objects[0].src).toBe('asset://a.png');
        expect(json.objects[1].slideMeta).toEqual({ role: 'rect' });
    });
});
