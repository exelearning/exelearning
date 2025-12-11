import {
    Entity,
    Column,
    ManyToOne,
    JoinColumn,
    PrimaryGeneratedColumn,
    BeforeInsert,
    BeforeUpdate,
    Index,
} from 'typeorm';
import { Project } from './project.entity';

/**
 * Asset Entity
 * Stores metadata for project assets (images, videos, documents, etc.)
 * Actual files are stored in the filesystem under FILES_DIR/projects/{projectId}/assets/
 */
@Entity('assets')
@Index('IDX_asset_client_project', ['clientId', 'projectId'], { unique: true })
export class Asset {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Project, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project: Project;

    @Column({ name: 'project_id', type: 'integer' })
    projectId: number;

    /**
     * Original filename as uploaded by the user
     */
    @Column({ name: 'filename', type: 'varchar', length: 255 })
    filename: string;

    /**
     * Relative storage path within the project's asset directory
     * Example: "images/logo.png" or "idevice-123/diagram.svg"
     */
    @Column({ name: 'storage_path', type: 'varchar', length: 500 })
    storagePath: string;

    /**
     * MIME type of the file
     */
    @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
    mimeType: string | null;

    /**
     * File size in bytes
     */
    @Column({ name: 'file_size', type: 'bigint', nullable: true })
    fileSize: string | null; // bigint stored as string

    /**
     * Client-side UUID (asset:// URL scheme)
     * This maps the frontend's asset://uuid to the backend's integer ID
     * With hash-based IDs, same file = same clientId across projects
     * Unique constraint is per project (see @Index on class)
     */
    @Column({
        name: 'client_id',
        type: 'varchar',
        length: 36,
        nullable: true,
    })
    clientId: string | null;

    /**
     * Optional: iDevice component ID if asset belongs to a specific iDevice
     * Stored as string reference to the Yjs document structure
     */
    @Column({
        name: 'component_id',
        type: 'varchar',
        length: 255,
        nullable: true,
    })
    componentId: string | null;

    /**
     * SHA-256 hash of file content for deduplication and integrity checks
     */
    @Column({ name: 'content_hash', type: 'varchar', length: 64, nullable: true })
    contentHash: string | null;

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
