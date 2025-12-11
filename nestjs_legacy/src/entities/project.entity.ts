import {
    Entity,
    Column,
    ManyToOne,
    ManyToMany,
    JoinTable,
    OneToOne,
    JoinColumn,
    BeforeInsert,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * Project Entity
 * Represents a collaborative document/project in the new Yjs-based architecture.
 * Replaces the old ODE session-based model.
 */
@Entity('projects')
export class Project extends BaseEntity {
    /**
     * Unique UUID identifier for the project.
     * Used in URLs and API calls instead of numeric ID.
     * Auto-generated on insert.
     */
    @Column({ name: 'uuid', type: 'varchar', length: 36, unique: true })
    uuid: string;

    @Column({ name: 'title', type: 'varchar', length: 255 })
    title: string;

    @BeforeInsert()
    generateUuid() {
        if (!this.uuid) {
            this.uuid = uuidv4();
        }
    }

    @Column({ name: 'description', type: 'text', nullable: true })
    description: string | null;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'owner_id' })
    owner: User;

    @Column({ name: 'owner_id', type: 'integer' })
    ownerId: number;

    @ManyToMany(() => User)
    @JoinTable({
        name: 'project_collaborators',
        joinColumn: { name: 'project_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
    })
    collaborators: User[];

    @Column({
        name: 'status',
        type: 'varchar',
        length: 50,
        default: 'active',
    })
    status: 'active' | 'archived' | 'deleted';

    /**
     * Project visibility:
     * - 'public': Anyone with the link can view/edit
     * - 'private': Only owner and collaborators can access (default)
     */
    @Column({
        name: 'visibility',
        type: 'varchar',
        length: 20,
        default: 'private',
    })
    visibility: 'public' | 'private';

    @Column({ name: 'language', type: 'varchar', length: 10, nullable: true })
    language: string | null;

    @Column({ name: 'author', type: 'varchar', length: 255, nullable: true })
    author: string | null;

    @Column({ name: 'license', type: 'varchar', length: 255, nullable: true })
    license: string | null;

    @Column({ name: 'last_accessed_at', type: 'datetime', nullable: true })
    lastAccessedAt: Date | null;

    /**
     * Whether the project has been saved at least once.
     * Projects with savedOnce=false are considered drafts and won't appear
     * in the "Open project" dialog until they are explicitly saved.
     * This prevents cluttering the project list with abandoned new projects.
     */
    @Column({ name: 'saved_once', type: 'boolean', default: false })
    savedOnce: boolean;
}
