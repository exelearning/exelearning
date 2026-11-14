// Test functions available globally from vitest setup

const COMMON_TAG = '<script src="./app/common/common.js?v=v9.9.9"></script>';

describe('mathJaxLoader', () => {
    let ensureMathJax;
    let getMathJaxUrl;

    beforeEach(async () => {
        vi.resetModules();
        ({ ensureMathJax, getMathJaxUrl } = await import('./mathJaxLoader.js'));
        document.head.innerHTML = COMMON_TAG;
        delete window.MathJax;
    });

    afterEach(() => {
        document.head.innerHTML = '';
        delete window.MathJax;
    });

    const injected = () => document.head.querySelector('script[src*="tex-mml-svg.js"]');

    describe('getMathJaxUrl', () => {
        it('keeps the ?v= cache-buster of a static build', () => {
            expect(getMathJaxUrl()).toBe('./app/common/exe_math/tex-mml-svg.js?v=v9.9.9');
        });

        it('keeps the base path and versioned path segment of a server deployment', () => {
            document.head.innerHTML = '<script src="/web/exe/v9.9.9/app/common/common.js"></script>';
            expect(getMathJaxUrl()).toBe('/web/exe/v9.9.9/app/common/exe_math/tex-mml-svg.js');
        });

        it('returns null when common.js is not on the page', () => {
            document.head.innerHTML = '';
            expect(getMathJaxUrl()).toBeNull();
        });
    });

    describe('ensureMathJax', () => {
        it('injects the script once and resolves after MathJax has started', async () => {
            let started;
            const first = ensureMathJax();
            const second = ensureMathJax();

            expect(second).toBe(first);
            expect(document.head.querySelectorAll('script[src*="tex-mml-svg.js"]').length).toBe(1);
            expect(injected().getAttribute('src')).toBe('./app/common/exe_math/tex-mml-svg.js?v=v9.9.9');

            let resolved = false;
            first.then(() => {
                resolved = true;
            });
            window.MathJax = {
                typesetPromise: () => Promise.resolve(),
                startup: {
                    promise: new Promise((resolve) => {
                        started = resolve;
                    }),
                },
            };
            injected().onload();
            await Promise.resolve();
            expect(resolved).toBe(false);

            started();
            await first;
            expect(resolved).toBe(true);
        });

        it('does nothing when MathJax is already loaded', async () => {
            window.MathJax = { typesetPromise: () => Promise.resolve() };

            await ensureMathJax();

            expect(injected()).toBeNull();
        });

        it('resolves without MathJax when the download fails, and retries on the next call', async () => {
            const failed = ensureMathJax();
            injected().onerror();
            await expect(failed).resolves.toBeUndefined();
            expect(injected()).toBeNull();

            ensureMathJax();
            expect(injected()).not.toBeNull();
        });

        it('resolves when MathJax startup rejects', async () => {
            const promise = ensureMathJax();
            window.MathJax = { startup: { promise: Promise.reject(new Error('boom')) } };
            injected().onload();

            await expect(promise).resolves.toBeUndefined();
        });

        it('resolves when the page has no common.js to derive the URL from', async () => {
            document.head.innerHTML = '';

            await expect(ensureMathJax()).resolves.toBeUndefined();
            expect(injected()).toBeNull();
        });
    });
});
