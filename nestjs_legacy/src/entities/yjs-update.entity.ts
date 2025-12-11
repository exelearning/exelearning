import {
    Entity,
    Column,
    ManyToOne,
    JoinColumn,
    PrimaryGeneratedColumn,
    BeforeInsert,
    Index,
} from 'typeorm';
import { Project } from './project.entity';
import { getBinaryColumnType } from '../config/database-driver.helper';

/**
 * YjsUpdate Entity
 * Stores incremental Yjs updates for a project.
 * These are periodically consolidated into snapshots and pruned.
 */
@Entity('yjs_updates')
@Index(['projectId', 'version']) // Index for efficient querying by project and version
export class YjsUpdate {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Project, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project: Project;

    @Column({ name: 'project_id', type: 'integer' })
    projectId: number;

    /**
     * Binary update data from Yjs
     * Encoded using Y.encodeStateAsUpdate()
     */
    @Column({ name: 'update_data', type: getBinaryColumnType() })
    updateData: Buffer;

    /**
     * Sequential version number for this update
     * Used to order updates and track snapshot versions
     */
    @Column({ name: 'version', type: 'bigint' })
    version: string; // bigint stored as string in TypeORM

    /**
     * Client ID that generated this update
     * Optional, used for debugging and tracking update sources
     */
    @Column({ name: 'client_id', type: 'varchar', length: 255, nullable: true })
    clientId: string | null;

    @Column({ name: 'created_at', type: 'datetime', nullable: true })
    createdAt: Date | null;

    @BeforeInsert()
    setCreatedAt() {
        this.createdAt = new Date();
    }
}
