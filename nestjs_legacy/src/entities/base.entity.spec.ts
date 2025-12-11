import { Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

// Create a concrete test entity that extends BaseEntity
@Entity('test_entities')
class TestEntity extends BaseEntity {
    // No additional fields needed for testing BaseEntity functionality
}

describe('BaseEntity', () => {
    describe('Lifecycle Hooks', () => {
        describe('@BeforeInsert - setCreatedAt()', () => {
            it('should set createdAt and updatedAt on insert', () => {
                const entity = new TestEntity();
                const beforeInsert = new Date();

                entity.setCreatedAt();

                const afterInsert = new Date();

                expect(entity.createdAt).toBeDefined();
                expect(entity.updatedAt).toBeDefined();
                expect(entity.createdAt).toBeInstanceOf(Date);
                expect(entity.updatedAt).toBeInstanceOf(Date);

                // Verify timestamps are within expected range
                expect(entity.createdAt!.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime());
                expect(entity.createdAt!.getTime()).toBeLessThanOrEqual(afterInsert.getTime());
                expect(entity.updatedAt!.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime());
                expect(entity.updatedAt!.getTime()).toBeLessThanOrEqual(afterInsert.getTime());
            });

            it('should set createdAt and updatedAt to the same value on insert', () => {
                const entity = new TestEntity();

                entity.setCreatedAt();

                expect(entity.createdAt).toBeDefined();
                expect(entity.updatedAt).toBeDefined();
                expect(entity.createdAt!.getTime()).toBe(entity.updatedAt!.getTime());
            });

            it('should set isActive to true if not explicitly set', () => {
                const entity = new TestEntity();

                entity.setCreatedAt();

                expect(entity.isActive).toBe(true);
            });

            it('should not override isActive if explicitly set to false', () => {
                const entity = new TestEntity();
                entity.isActive = false;

                entity.setCreatedAt();

                expect(entity.isActive).toBe(false);
            });

            it('should not override isActive if explicitly set to true', () => {
                const entity = new TestEntity();
                entity.isActive = true;

                entity.setCreatedAt();

                expect(entity.isActive).toBe(true);
            });
        });

        describe('@BeforeUpdate - setUpdatedAt()', () => {
            it('should update updatedAt timestamp on update', async () => {
                const entity = new TestEntity();

                // Simulate insert
                entity.setCreatedAt();
                const originalCreatedAt = entity.createdAt;
                const originalUpdatedAt = entity.updatedAt;

                // Wait 10ms to ensure different timestamp
                await new Promise((resolve) => setTimeout(resolve, 10));

                const beforeUpdate = new Date();

                // Simulate update
                entity.setUpdatedAt();

                const afterUpdate = new Date();

                expect(entity.updatedAt).toBeDefined();
                expect(entity.updatedAt).toBeInstanceOf(Date);

                // createdAt should not change
                expect(entity.createdAt).toBe(originalCreatedAt);

                // updatedAt should be different from original
                expect(entity.updatedAt!.getTime()).not.toBe(originalUpdatedAt!.getTime());

                // updatedAt should be later than original
                expect(entity.updatedAt!.getTime()).toBeGreaterThan(originalUpdatedAt!.getTime());

                // Verify new updatedAt is within expected range
                expect(entity.updatedAt!.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
                expect(entity.updatedAt!.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
            });

            it('should only update updatedAt, not createdAt', () => {
                const entity = new TestEntity();

                // Simulate insert
                entity.setCreatedAt();
                const createdAtSnapshot = entity.createdAt;

                // Simulate update
                entity.setUpdatedAt();

                // createdAt should remain unchanged
                expect(entity.createdAt).toBe(createdAtSnapshot);
                expect(entity.createdAt).toEqual(createdAtSnapshot);
            });
        });

        describe('Field Defaults', () => {
            it('should have all BaseEntity fields accessible', () => {
                const entity = new TestEntity();

                // Fields are accessible even if undefined before lifecycle hooks
                // id is not set until database insertion
                expect(entity.id).toBeUndefined();
                expect(entity.isActive).toBeUndefined();
                expect(entity.createdAt).toBeUndefined();
                expect(entity.updatedAt).toBeUndefined();
            });

            it('should allow manual timestamp setting before insert', () => {
                const entity = new TestEntity();
                const customDate = new Date('2024-01-01T00:00:00.000Z');

                entity.createdAt = customDate;
                entity.updatedAt = customDate;

                // Note: setCreatedAt() will override these, so this tests that
                // the fields are assignable
                expect(entity.createdAt).toBe(customDate);
                expect(entity.updatedAt).toBe(customDate);
            });
        });

        describe('Multiple Insert/Update Cycles', () => {
            it('should handle multiple update cycles correctly', async () => {
                const entity = new TestEntity();

                // Insert
                entity.setCreatedAt();
                const createdAt = entity.createdAt;
                let previousUpdatedAt = entity.updatedAt;

                // First update
                await new Promise((resolve) => setTimeout(resolve, 10));
                entity.setUpdatedAt();
                const firstUpdatedAt = entity.updatedAt;

                expect(firstUpdatedAt!.getTime()).toBeGreaterThan(previousUpdatedAt!.getTime());
                expect(entity.createdAt).toBe(createdAt);

                previousUpdatedAt = firstUpdatedAt;

                // Second update
                await new Promise((resolve) => setTimeout(resolve, 10));
                entity.setUpdatedAt();
                const secondUpdatedAt = entity.updatedAt;

                expect(secondUpdatedAt!.getTime()).toBeGreaterThan(previousUpdatedAt!.getTime());
                expect(entity.createdAt).toBe(createdAt);

                // Third update
                await new Promise((resolve) => setTimeout(resolve, 10));
                entity.setUpdatedAt();
                const thirdUpdatedAt = entity.updatedAt;

                expect(thirdUpdatedAt!.getTime()).toBeGreaterThan(secondUpdatedAt!.getTime());
                expect(entity.createdAt).toBe(createdAt);
            });
        });
    });
});
