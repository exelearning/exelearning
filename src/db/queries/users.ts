/**
 * User Queries - Kysely ORM
 * Type-safe queries for SQLite, PostgreSQL, and MySQL
 * All functions accept db as first parameter for dependency injection
 */
import type { Kysely } from 'kysely';
import type { Database, User, NewUser, UserUpdate } from '../types';
import { now, stringifyRoles } from '../types';
import { supportsReturning, updateByIdAndReturn } from '../helpers';

// ============================================================================
// READ QUERIES
// ============================================================================

export async function findUserById(db: Kysely<Database>, id: number): Promise<User | undefined> {
    return db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function findUserByEmail(db: Kysely<Database>, email: string): Promise<User | undefined> {
    return db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst();
}

export async function findUserByExternalId(
    db: Kysely<Database>,
    externalIdentifier: string,
): Promise<User | undefined> {
    return db.selectFrom('users').selectAll().where('external_identifier', '=', externalIdentifier).executeTakeFirst();
}

export async function findUserByApiToken(db: Kysely<Database>, apiToken: string): Promise<User | undefined> {
    return db.selectFrom('users').selectAll().where('api_token', '=', apiToken).executeTakeFirst();
}

export async function getAllUsers(db: Kysely<Database>): Promise<User[]> {
    return db.selectFrom('users').selectAll().execute();
}

export async function countUsers(db: Kysely<Database>): Promise<number> {
    const result = await db
        .selectFrom('users')
        .select(eb => eb.fn.count<number>('id').as('count'))
        .executeTakeFirst();
    return result?.count ?? 0;
}

// ============================================================================
// WRITE QUERIES
// ============================================================================

export async function createUser(db: Kysely<Database>, data: NewUser): Promise<User> {
    const timestamp = now();
    const values = {
        ...data,
        roles: typeof data.roles === 'string' ? data.roles : stringifyRoles((data.roles as string[]) || []),
        is_lopd_accepted: data.is_lopd_accepted ?? 0,
        is_active: data.is_active ?? 1,
        created_at: timestamp,
        updated_at: timestamp,
    };

    if (supportsReturning()) {
        return db.insertInto('users').values(values).returningAll().executeTakeFirstOrThrow();
    }

    await db.insertInto('users').values(values).executeTakeFirstOrThrow();
    return db.selectFrom('users').selectAll().where('email', '=', values.email).executeTakeFirstOrThrow();
}

export async function updateUser(db: Kysely<Database>, id: number, data: UserUpdate): Promise<User | undefined> {
    return updateByIdAndReturn(db, 'users', id, {
        ...data,
        updated_at: now(),
    });
}

export async function deleteUser(db: Kysely<Database>, id: number): Promise<void> {
    await db.deleteFrom('users').where('id', '=', id).execute();
}

// ============================================================================
// SPECIALIZED QUERIES
// ============================================================================

export async function findOrCreateExternalUser(
    db: Kysely<Database>,
    externalIdentifier: string,
    email: string,
    userId: string,
    password: string,
    roles: string[] = ['ROLE_USER'],
): Promise<User> {
    // Try to find existing user
    let user = await findUserByExternalId(db, externalIdentifier);
    if (user) return user;

    user = await findUserByEmail(db, email);
    if (user) return user;

    // Create new user
    return createUser(db, {
        email,
        user_id: userId,
        password,
        roles: stringifyRoles(roles),
        external_identifier: externalIdentifier,
        is_lopd_accepted: 0,
        is_active: 1,
    });
}

export async function updateApiToken(db: Kysely<Database>, userId: number, apiToken: string | null): Promise<void> {
    await db
        .updateTable('users')
        .set({
            api_token: apiToken,
            updated_at: now(),
        })
        .where('id', '=', userId)
        .execute();
}

export async function findFirstUser(db: Kysely<Database>): Promise<User | undefined> {
    return db.selectFrom('users').selectAll().limit(1).executeTakeFirst();
}

export async function updateUserRoles(db: Kysely<Database>, id: number, roles: string[]): Promise<User | undefined> {
    return updateByIdAndReturn(db, 'users', id, {
        roles: stringifyRoles(roles),
        updated_at: now(),
    });
}
