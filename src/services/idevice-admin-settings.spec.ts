import { describe, expect, it, mock } from 'bun:test';
import { parseDisabledIdeviceIds, setDisabledIdeviceIds } from './idevice-admin-settings';

describe('idevice-admin-settings', () => {
    describe('parseDisabledIdeviceIds', () => {
        it('returns an empty set for empty or invalid values', () => {
            expect([...parseDisabledIdeviceIds(null)]).toEqual([]);
            expect([...parseDisabledIdeviceIds('')]).toEqual([]);
            expect([...parseDisabledIdeviceIds('{bad json')]).toEqual([]);
            expect([...parseDisabledIdeviceIds('{"id":"text"}')]).toEqual([]);
        });

        it('keeps only non-empty string ids', () => {
            expect([...parseDisabledIdeviceIds('["text", "", 7, "rubric"]')]).toEqual(['text', 'rubric']);
        });
    });

    describe('setDisabledIdeviceIds', () => {
        it('stores unique sorted ids as JSON', async () => {
            const execute = mock(() => Promise.resolve());
            const executeTakeFirst = mock(() => Promise.resolve(undefined));
            const values = mock(() => ({ execute }));
            const insertInto = mock(() => ({ values }));
            const where = mock(() => ({ executeTakeFirst }));
            const selectAll = mock(() => ({ where }));
            const selectFrom = mock(() => ({ selectAll }));
            const db = { selectFrom, insertInto };

            await setDisabledIdeviceIds(db as never, ['rubric', 'text', 'rubric'], 9);

            expect(insertInto).toHaveBeenCalledWith('app_settings');
            const storedValue = values.mock.calls[0][0] as Record<string, unknown>;
            expect(storedValue).toEqual({
                key: 'ADMIN_DISABLED_IDEVICES',
                value: '["rubric","text"]',
                type: 'json',
                updated_at: storedValue.updated_at,
                updated_by: 9,
            });
            expect(typeof storedValue.updated_at).toBe('number');
        });
    });
});
