import {
    Entity,
    Column,
    OneToOne,
    JoinColumn,
    PrimaryGeneratedColumn,
    BeforeInsert,
    BeforeUpdate,
} from 'typeorm';
import { Project } from './project.entity';
import { getBinaryColumnType } from '../config/database-driver.helper';

/**
 * YjsDocument Entity
 * Stores Yjs document snapshots for fast loading.
 * Each project has one current snapshot that is periodically updated.
 */
@Entity('yjs_documents')
export class YjsDocument {
    @PrimaryGeneratedColumn()
    id: number;

    @OneToOne(() => Project, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project: Project;

    @Column({ name: 'project_id', type: 'integer', unique: true })
    projectId: number;

    /**
     * Binary snapshot data of the Yjs document
     * Type is dynamically set based on database driver (bytea/blob/longblob)
     */
    @Column({ name: 'snapshot_data', type: getBinaryColumnType() })
    snapshotData: Buffer;

    /**
     * Version number of this snapshot
     * Corresponds to the number of updates applied to create this snapshot
     */
    @Column({ name: 'snapshot_version', type: 'bigint', default: 0 })
    snapshotVersion: string; // bigint is stored as string in TypeORM

    @Column({ name: 'created_at', type: 'datetime', nullable: true })
    createdAt: Date | null;

    @Column({ name: 'updated_at', type: 'datetime', nullable: true })
    updatedAt: Date | null;

    @BeforeInsert()
    setCreatedAt() {
        const now = new Date();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @BeforeUpdate()
    setUpdatedAt() {
        this.updatedAt = new Date();
    }
}
