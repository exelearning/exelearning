import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DOMTranslator from './domTranslator.js';

describe('DOMTranslator', () => {
    let translator;
    let mockTranslateFn;

    beforeEach(() => {
        // Create a mock translation function
        mockTranslateFn = vi.fn((key) => {
            const translations = {
                'Hello': 'Hola',
                'World': 'Mundo',
                'Close': 'Cerrar',
                'Save': 'Guardar',
                'Enter your name': 'Introduce tu nombre',
                'Search': 'Buscar',
                'Logo': 'Logotipo',
            };
            return translations[key] || key;
        });

        // Set up the global _ function
        window._ = mockTranslateFn;

        // Create translator with default options (uses window._)
        translator = new DOMTranslator();

        // Clean up DOM
        document.body.innerHTML = '';
    });

    afterEach(() => {
        translator.disconnect();
        delete window._;
    });

    describe('translateAll', () => {
        it('should translate elements with data-i18n attribute', () => {
            document.body.innerHTML = '<span data-i18n="Hello">Hello</span>';

            translator.translateAll();

            expect(document.querySelector('span').textContent).toBe('Hola');
            expect(mockTranslateFn).toHaveBeenCalledWith('Hello');
        });

        it('should translate multiple elements', () => {
            document.body.innerHTML = `
                <span data-i18n="Hello">Hello</span>
                <span data-i18n="World">World</span>
            `;

            translator.translateAll();

            const spans = document.querySelectorAll('span');
            expect(spans[0].textContent).toBe('Hola');
            expect(spans[1].textContent).toBe('Mundo');
        });

        it('should translate title attributes', () => {
            document.body.innerHTML = '<button data-i18n-title="Close" title="Close">X</button>';

            translator.translateAll();

            expect(document.querySelector('button').getAttribute('title')).toBe('Cerrar');
        });

        it('should translate placeholder attributes', () => {
            document.body.innerHTML = '<input data-i18n-placeholder="Enter your name" placeholder="Enter your name">';

            translator.translateAll();

            expect(document.querySelector('input').getAttribute('placeholder')).toBe('Introduce tu nombre');
        });

        it('should translate aria-label attributes', () => {
            document.body.innerHTML = '<button data-i18n-aria-label="Search" aria-label="Search">🔍</button>';

            translator.translateAll();

            expect(document.querySelector('button').getAttribute('aria-label')).toBe('Buscar');
        });

        it('should translate alt attributes', () => {
            document.body.innerHTML = '<img data-i18n-alt="Logo" alt="Logo" src="">';

            translator.translateAll();

            expect(document.querySelector('img').getAttribute('alt')).toBe('Logotipo');
        });

        it('should translate elements with multiple data-i18n attributes', () => {
            document.body.innerHTML = `
                <button
                    data-i18n="Save"
                    data-i18n-title="Save"
                    data-i18n-aria-label="Save"
                    title="Save"
                    aria-label="Save">Save</button>
            `;

            translator.translateAll();

            const button = document.querySelector('button');
            expect(button.textContent).toBe('Guardar');
            expect(button.getAttribute('title')).toBe('Guardar');
            expect(button.getAttribute('aria-label')).toBe('Guardar');
        });

        it('should work within a specific root element', () => {
            document.body.innerHTML = `
                <div id="outside"><span data-i18n="Hello">Hello</span></div>
                <div id="inside"><span data-i18n="World">World</span></div>
            `;

            const inside = document.getElementById('inside');
            translator.translateAll(inside);

            expect(document.querySelector('#outside span').textContent).toBe('Hello');
            expect(document.querySelector('#inside span').textContent).toBe('Mundo');
        });

        it('should handle empty data-i18n attribute gracefully', () => {
            document.body.innerHTML = '<span data-i18n="">Empty</span>';

            expect(() => translator.translateAll()).not.toThrow();
            expect(document.querySelector('span').textContent).toBe('Empty');
        });

        it('should return original key if no translation found', () => {
            document.body.innerHTML = '<span data-i18n="Unknown Key">Unknown Key</span>';

            translator.translateAll();

            expect(document.querySelector('span').textContent).toBe('Unknown Key');
        });

        it('should append suffix from data-i18n-suffix attribute', () => {
            document.body.innerHTML = '<label data-i18n="Save" data-i18n-suffix=":">Save:</label>';

            translator.translateAll();

            expect(document.querySelector('label').textContent).toBe('Guardar:');
        });

        it('should handle elements with data-i18n but no suffix', () => {
            document.body.innerHTML = '<span data-i18n="Hello">Hello</span>';

            translator.translateAll();

            expect(document.querySelector('span').textContent).toBe('Hola');
        });

        it('should append empty suffix when data-i18n-suffix is empty', () => {
            document.body.innerHTML = '<span data-i18n="Hello" data-i18n-suffix="">Hello</span>';

            translator.translateAll();

            expect(document.querySelector('span').textContent).toBe('Hola');
        });
    });

    describe('translateElement', () => {
        it('should translate a single element and its descendants', () => {
            document.body.innerHTML = `
                <div id="parent">
                    <span data-i18n="Hello">Hello</span>
                    <span data-i18n="World">World</span>
                </div>
            `;

            const parent = document.getElementById('parent');
            translator.translateElement(parent);

            const spans = parent.querySelectorAll('span');
            expect(spans[0].textContent).toBe('Hola');
            expect(spans[1].textContent).toBe('Mundo');
        });

        it('should handle null or undefined elements gracefully', () => {
            expect(() => translator.translateElement(null)).not.toThrow();
            expect(() => translator.translateElement(undefined)).not.toThrow();
        });

        it('should ignore non-element nodes', () => {
            const textNode = document.createTextNode('test');
            expect(() => translator.translateElement(textNode)).not.toThrow();
        });

        it('should translate element with data-i18n-suffix', () => {
            document.body.innerHTML = `
                <div id="parent">
                    <label data-i18n="Save" data-i18n-suffix=":">Save:</label>
                </div>
            `;

            const parent = document.getElementById('parent');
            translator.translateElement(parent);

            expect(parent.querySelector('label').textContent).toBe('Guardar:');
        });

        it('should translate element itself with suffix when it has data-i18n', () => {
            const label = document.createElement('label');
            label.setAttribute('data-i18n', 'Save');
            label.setAttribute('data-i18n-suffix', ':');
            label.textContent = 'Save:';
            document.body.appendChild(label);

            translator.translateElement(label);

            expect(label.textContent).toBe('Guardar:');
        });
    });

    describe('observeDOM', () => {
        // Helper to wait for MutationObserver and requestAnimationFrame to process
        const waitForTranslation = () => new Promise((resolve) => {
            // MutationObserver callbacks are microtasks, RAF is next frame
            // We need to wait for both to complete
            requestAnimationFrame(() => {
                setTimeout(resolve, 10);
            });
        });

        it('should translate dynamically added elements', async () => {
            translator.observeDOM();

            // Add an element dynamically
            const span = document.createElement('span');
            span.setAttribute('data-i18n', 'Hello');
            span.textContent = 'Hello';
            document.body.appendChild(span);

            // Wait for MutationObserver and requestAnimationFrame
            await waitForTranslation();

            expect(span.textContent).toBe('Hola');
        });

        it('should translate nested dynamically added elements', async () => {
            translator.observeDOM();

            // Add a container with nested elements
            const container = document.createElement('div');
            container.innerHTML = `
                <span data-i18n="Hello">Hello</span>
                <span data-i18n="World">World</span>
            `;
            document.body.appendChild(container);

            // Wait for MutationObserver and requestAnimationFrame
            await waitForTranslation();

            const spans = container.querySelectorAll('span');
            expect(spans[0].textContent).toBe('Hola');
            expect(spans[1].textContent).toBe('Mundo');
        });

        it('should return the MutationObserver instance', () => {
            const observer = translator.observeDOM();
            expect(observer).toBeInstanceOf(MutationObserver);
        });

        it('should disconnect previous observer when called multiple times', () => {
            const observer1 = translator.observeDOM();
            const disconnectSpy = vi.spyOn(observer1, 'disconnect');

            translator.observeDOM();

            expect(disconnectSpy).toHaveBeenCalled();
        });
    });

    describe('disconnect', () => {
        it('should stop observing the DOM', async () => {
            translator.observeDOM();
            translator.disconnect();

            // Add an element dynamically
            const span = document.createElement('span');
            span.setAttribute('data-i18n', 'Hello');
            span.textContent = 'Hello';
            document.body.appendChild(span);

            // Wait for potential MutationObserver callback
            await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

            // Should NOT be translated since observer was disconnected
            expect(span.textContent).toBe('Hello');
        });

        it('should handle multiple disconnect calls gracefully', () => {
            translator.observeDOM();
            expect(() => {
                translator.disconnect();
                translator.disconnect();
            }).not.toThrow();
        });
    });

    describe('refresh', () => {
        it('should re-translate all elements', () => {
            document.body.innerHTML = '<span data-i18n="Hello">Hello</span>';

            translator.translateAll();
            expect(document.querySelector('span').textContent).toBe('Hola');

            // Simulate language change
            mockTranslateFn.mockImplementation((key) => {
                return key === 'Hello' ? 'Bonjour' : key;
            });

            translator.refresh();
            expect(document.querySelector('span').textContent).toBe('Bonjour');
        });
    });

    describe('custom translate function', () => {
        it('should use custom translate function when provided', () => {
            const customTranslateFn = vi.fn((key) => `[${key}]`);
            const customTranslator = new DOMTranslator({
                translateFn: () => customTranslateFn,
            });

            document.body.innerHTML = '<span data-i18n="Hello">Hello</span>';
            customTranslator.translateAll();

            expect(document.querySelector('span').textContent).toBe('[Hello]');
            expect(customTranslateFn).toHaveBeenCalledWith('Hello');

            customTranslator.disconnect();
        });

        it('should handle missing translate function gracefully', () => {
            delete window._;
            const translatorWithoutFn = new DOMTranslator();

            document.body.innerHTML = '<span data-i18n="Hello">Hello</span>';

            expect(() => translatorWithoutFn.translateAll()).not.toThrow();
            // Should fall back to returning the key as-is
            expect(document.querySelector('span').textContent).toBe('Hello');

            translatorWithoutFn.disconnect();
        });
    });
});
