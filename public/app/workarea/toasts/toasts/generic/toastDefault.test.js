const toastConstructorSpy = vi.fn();

vi.mock('../toast.js', () => {
    return {
        default: class MockToast {
            constructor(manager, id) {
                toastConstructorSpy(manager, id);
                this.manager = manager;
                this.id = id;
            }
        },
    };
});

import ToastDefault from './toastDefault.js';

describe('ToastDefault helper', () => {
    beforeEach(() => {
        toastConstructorSpy.mockClear();
    });

    it('uses the generic toast identifier', () => {
        const manager = { name: 'workarea' };
        const toast = new ToastDefault(manager);

        expect(toastConstructorSpy).toHaveBeenCalledWith(manager, 'toastDefault');
        expect(toast.manager).toBe(manager);
        expect(toast.id).toBe('toastDefault');
    });
});
