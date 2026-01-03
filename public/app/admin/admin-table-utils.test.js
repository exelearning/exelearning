/**
 * Tests for Admin Table Utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    escapeHtml,
    showNotification,
    createApiClient,
    createToggleHandler,
    createDeleteHandler,
    createUploadHandler,
    renderEmptyState,
    renderErrorState,
} from './admin-table-utils.js';

// Setup window.alert and window.confirm for happy-dom
beforeEach(() => {
    if (!window.alert) {
        window.alert = () => {};
    }
    if (!window.confirm) {
        window.confirm = () => true;
    }
});

describe('Admin Table Utilities', () => {
    describe('escapeHtml', () => {
        it('should escape HTML entities', () => {
            expect(escapeHtml('<script>alert("xss")</script>')).toBe(
                '&lt;script&gt;alert("xss")&lt;/script&gt;',
            );
        });

        it('should escape ampersands', () => {
            expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
        });

        it('should escape angle brackets', () => {
            expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
        });

        it('should handle empty string', () => {
            expect(escapeHtml('')).toBe('');
        });

        it('should handle null', () => {
            expect(escapeHtml(null)).toBe('');
        });

        it('should handle undefined', () => {
            expect(escapeHtml(undefined)).toBe('');
        });

        it('should handle plain text', () => {
            expect(escapeHtml('Hello World')).toBe('Hello World');
        });
    });

    describe('showNotification', () => {
        it('should show success message without prefix', () => {
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
            showNotification('Success!', 'success');
            expect(alertSpy).toHaveBeenCalledWith('Success!');
            alertSpy.mockRestore();
        });

        it('should show error message with Error prefix', () => {
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
            showNotification('Something went wrong', 'error');
            expect(alertSpy).toHaveBeenCalledWith('Error: Something went wrong');
            alertSpy.mockRestore();
        });

        it('should show info message with Info prefix', () => {
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
            showNotification('Note this', 'info');
            expect(alertSpy).toHaveBeenCalledWith('Info: Note this');
            alertSpy.mockRestore();
        });

        it('should default to info type', () => {
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
            showNotification('Default message');
            expect(alertSpy).toHaveBeenCalledWith('Info: Default message');
            alertSpy.mockRestore();
        });
    });

    describe('createApiClient', () => {
        let fetchSpy;

        beforeEach(() => {
            fetchSpy = vi.spyOn(global, 'fetch');
        });

        afterEach(() => {
            fetchSpy.mockRestore();
        });

        it('should create client with base path', () => {
            const client = createApiClient('/api/admin/themes');
            expect(client).toHaveProperty('get');
            expect(client).toHaveProperty('post');
            expect(client).toHaveProperty('patch');
            expect(client).toHaveProperty('delete');
        });

        it('should make GET request', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ data: 'test' }),
            });

            const client = createApiClient('/api/admin/themes');
            const result = await client.get('/1');

            expect(fetchSpy).toHaveBeenCalledWith('/api/admin/themes/1', {
                method: 'GET',
                credentials: 'include',
            });
            expect(result).toEqual({ data: 'test' });
        });

        it('should make POST request with JSON body', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ id: 1 }),
            });

            const client = createApiClient('/api/admin/themes');
            await client.post('', { name: 'Test' });

            expect(fetchSpy).toHaveBeenCalledWith('/api/admin/themes', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test' }),
            });
        });

        it('should make POST request with FormData', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ id: 1 }),
            });

            const formData = new FormData();
            formData.append('file', new Blob(['test']));

            const client = createApiClient('/api/admin/themes');
            await client.post('/upload', formData);

            expect(fetchSpy).toHaveBeenCalledWith('/api/admin/themes/upload', {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });
        });

        it('should throw error on non-ok response', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: () => Promise.resolve({ message: 'Validation failed' }),
            });

            const client = createApiClient('/api/admin/themes');

            await expect(client.get('/invalid')).rejects.toThrow('Validation failed');
        });

        it('should handle JSON parse error gracefully', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.reject(new Error('Invalid JSON')),
            });

            const client = createApiClient('/api/admin/themes');
            const result = await client.get('/1');

            expect(result).toEqual({});
        });

        it('should throw status error when no message in response', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: () => Promise.resolve({}),
            });

            const client = createApiClient('/api/admin/themes');

            await expect(client.get('/error')).rejects.toThrow('Request failed with status 500');
        });

        it('should make PATCH request with JSON body', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ id: 1, updated: true }),
            });

            const client = createApiClient('/api/admin/themes');
            await client.patch('/1', { name: 'Updated Theme' });

            expect(fetchSpy).toHaveBeenCalledWith('/api/admin/themes/1', {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Updated Theme' }),
            });
        });

        it('should make DELETE request', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({}),
            });

            const client = createApiClient('/api/admin/themes');
            await client.delete('/1');

            expect(fetchSpy).toHaveBeenCalledWith('/api/admin/themes/1', {
                method: 'DELETE',
                credentials: 'include',
            });
        });

        it('should call get without path', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve([{ id: 1 }]),
            });

            const client = createApiClient('/api/admin/themes');
            const result = await client.get();

            expect(fetchSpy).toHaveBeenCalledWith('/api/admin/themes', {
                method: 'GET',
                credentials: 'include',
            });
            expect(result).toEqual([{ id: 1 }]);
        });
    });

    describe('createToggleHandler', () => {
        let fetchSpy;
        let reloadFn;

        beforeEach(() => {
            fetchSpy = vi.spyOn(global, 'fetch');
            reloadFn = vi.fn();
        });

        afterEach(() => {
            fetchSpy.mockRestore();
        });

        it('should make PATCH request to toggle endpoint', async () => {
            fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

            const toggle = createToggleHandler('/api/admin/themes', reloadFn);
            await toggle(1, true);

            expect(fetchSpy).toHaveBeenCalledWith('/api/admin/themes/1/enabled', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isEnabled: true }),
                credentials: 'include',
            });
            expect(reloadFn).toHaveBeenCalled();
        });

        it('should reload on error', async () => {
            fetchSpy.mockResolvedValueOnce({ ok: false });

            const toggle = createToggleHandler('/api/admin/themes', reloadFn);
            await toggle(1, false);

            expect(reloadFn).toHaveBeenCalled();
        });
    });

    describe('createDeleteHandler', () => {
        let fetchSpy;
        let reloadFn;

        beforeEach(() => {
            fetchSpy = vi.spyOn(global, 'fetch');
            reloadFn = vi.fn();
        });

        afterEach(() => {
            fetchSpy.mockRestore();
        });

        it('should show confirmation dialog', async () => {
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

            const deleteHandler = createDeleteHandler(
                '/api/admin/themes',
                reloadFn,
                'Delete %s?',
                'Deleted!',
            );
            await deleteHandler(1, 'Neo Theme');

            expect(confirmSpy).toHaveBeenCalledWith('Delete Neo Theme?');
            expect(fetchSpy).not.toHaveBeenCalled();
            confirmSpy.mockRestore();
        });

        it('should make DELETE request on confirmation', async () => {
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
            fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

            const deleteHandler = createDeleteHandler(
                '/api/admin/themes',
                reloadFn,
                'Delete %s?',
                'Deleted!',
            );
            await deleteHandler(1, 'Neo Theme');

            expect(fetchSpy).toHaveBeenCalledWith('/api/admin/themes/1', {
                method: 'DELETE',
                credentials: 'include',
            });
            expect(reloadFn).toHaveBeenCalled();
            confirmSpy.mockRestore();
        });

        it('should handle delete error', async () => {
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
            fetchSpy.mockResolvedValueOnce({ ok: false });

            const deleteHandler = createDeleteHandler(
                '/api/admin/themes',
                reloadFn,
                'Delete %s?',
                'Deleted!',
            );
            await deleteHandler(1, 'Neo Theme');

            expect(alertSpy).toHaveBeenCalledWith('Error: Failed to delete');
            confirmSpy.mockRestore();
            alertSpy.mockRestore();
        });
    });

    describe('createUploadHandler', () => {
        let fetchSpy;
        let reloadFn;

        beforeEach(() => {
            fetchSpy = vi.spyOn(global, 'fetch');
            reloadFn = vi.fn();
        });

        afterEach(() => {
            fetchSpy.mockRestore();
        });

        it('should upload file with FormData', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ id: 1 }),
            });

            const upload = createUploadHandler('/api/admin/themes/upload', reloadFn, 'Uploaded!');
            const file = new File(['content'], 'theme.zip');
            await upload(file);

            expect(fetchSpy).toHaveBeenCalled();
            const [url, options] = fetchSpy.mock.calls[0];
            expect(url).toBe('/api/admin/themes/upload');
            expect(options.method).toBe('POST');
            expect(options.body).toBeInstanceOf(FormData);
            expect(reloadFn).toHaveBeenCalled();
        });

        it('should include extra fields', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ id: 1 }),
            });

            const upload = createUploadHandler('/api/admin/templates/upload', reloadFn, 'Uploaded!', {
                locale: 'es',
            });
            const file = new File(['content'], 'template.elpx');
            await upload(file);

            const [, options] = fetchSpy.mock.calls[0];
            const formData = options.body;
            expect(formData.get('locale')).toBe('es');
        });

        it('should support function for extra fields', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ id: 1 }),
            });

            let currentLocale = 'fr';
            const upload = createUploadHandler('/api/admin/templates/upload', reloadFn, 'Uploaded!', {
                locale: () => currentLocale,
            });
            const file = new File(['content'], 'template.elpx');
            await upload(file);

            const [, options] = fetchSpy.mock.calls[0];
            const formData = options.body;
            expect(formData.get('locale')).toBe('fr');
        });

        it('should handle upload error from response', async () => {
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
            fetchSpy.mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({ message: 'File too large' }),
            });

            const upload = createUploadHandler('/api/admin/themes/upload', reloadFn, 'Uploaded!');
            const file = new File(['content'], 'theme.zip');
            await upload(file);

            expect(alertSpy).toHaveBeenCalledWith('Error: File too large');
            expect(reloadFn).not.toHaveBeenCalled();
            alertSpy.mockRestore();
        });

        it('should handle upload error without message', async () => {
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
            fetchSpy.mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({}),
            });

            const upload = createUploadHandler('/api/admin/themes/upload', reloadFn, 'Uploaded!');
            const file = new File(['content'], 'theme.zip');
            await upload(file);

            expect(alertSpy).toHaveBeenCalledWith('Error: Upload failed');
            alertSpy.mockRestore();
        });

        it('should handle network error during upload', async () => {
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
            fetchSpy.mockRejectedValueOnce(new Error('Network error'));

            const upload = createUploadHandler('/api/admin/themes/upload', reloadFn, 'Uploaded!');
            const file = new File(['content'], 'theme.zip');
            await upload(file);

            expect(alertSpy).toHaveBeenCalledWith('Error: Network error');
            alertSpy.mockRestore();
        });
    });

    describe('renderEmptyState', () => {
        it('should render empty row with colspan', () => {
            const html = renderEmptyState(5, 'No data');
            expect(html).toBe('<tr><td colspan="5" class="text-center">No data</td></tr>');
        });

        it('should escape HTML in message', () => {
            const html = renderEmptyState(3, '<script>xss</script>');
            expect(html).toContain('&lt;script&gt;');
        });
    });

    describe('renderErrorState', () => {
        it('should render error row with danger class', () => {
            const html = renderErrorState(5, 'Error occurred');
            expect(html).toBe(
                '<tr><td colspan="5" class="text-center text-danger">Error occurred</td></tr>',
            );
        });

        it('should escape HTML in message', () => {
            const html = renderErrorState(3, '<img onerror="xss">');
            expect(html).toContain('&lt;img');
        });
    });
});
