import { PrimaryGeneratedColumn, Column, BeforeInsert, BeforeUpdate } from 'typeorm';

/**
 * BaseEntity - Abstract base class for all entities
 * Provides common fields and lifecycle hooks matching Symfony BaseEntity
 */
export abstract class BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;

    @Column({ name: 'created_at', type: 'datetime', nullable: true })
    createdAt: Date | null;

    @Column({ name: 'updated_at', type: 'datetime', nullable: true })
    updatedAt: Date | null;

    /**
     * Lifecycle hook: Before entity is inserted into database
     * Auto-sets createdAt, updatedAt, and isActive=true
     */
    @BeforeInsert()
    setCreatedAt() {
        const now = new Date();
        this.createdAt = now;
        this.updatedAt = now;

        // Set isActive to true if not explicitly set
        if (this.isActive === undefined || this.isActive === null) {
            this.isActive = true;
        }
    }

    /**
     * Lifecycle hook: Before entity is updated in database
     * Auto-updates updatedAt timestamp
     */
    @BeforeUpdate()
    setUpdatedAt() {
        this.updatedAt = new Date();
    }
}
