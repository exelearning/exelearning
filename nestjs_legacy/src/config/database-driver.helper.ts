/**
 * Database Driver Helper
 *
 * Maps PDO driver names (Symfony compatibility) to TypeORM driver types.
 * Supports SQLite (sql.js), MySQL/MariaDB, and PostgreSQL.
 */

export type TypeOrmDriver = 'sqljs' | 'mysql' | 'postgres';

/**
 * Maps PDO driver names to TypeORM driver types.
 *
 * @param pdoDriver - The PDO driver name (pdo_sqlite, pdo_mysql, pdo_pgsql)
 * @returns The corresponding TypeORM driver type
 */
export function mapPdoDriverToTypeOrm(pdoDriver: string | undefined): TypeOrmDriver {
    switch (pdoDriver) {
        case 'pdo_mysql':
        case 'mysql':
            return 'mysql';
        case 'pdo_pgsql':
        case 'postgres':
        case 'postgresql':
            return 'postgres';
        case 'pdo_sqlite':
        case 'sqlite':
        case 'sqljs':
        default:
            return 'sqljs';
    }
}

/**
 * Checks if the driver is SQLite (sql.js).
 *
 * @param driver - The driver name (PDO or TypeORM format)
 * @returns true if the driver is SQLite
 */
export function isSqlite(driver: string | undefined): boolean {
    return (
        !driver || driver === 'pdo_sqlite' || driver === 'sqlite' || driver === 'sqljs'
    );
}

/**
 * Gets the default port for a database driver.
 *
 * @param driver - The TypeORM driver type
 * @returns The default port number
 */
export function getDefaultPort(driver: TypeOrmDriver): number {
    switch (driver) {
        case 'mysql':
            return 3306;
        case 'postgres':
            return 5432;
        default:
            return 0; // SQLite doesn't use ports
    }
}

/**
 * Gets the default charset for a database driver.
 *
 * @param driver - The TypeORM driver type
 * @returns The default charset
 */
export function getDefaultCharset(driver: TypeOrmDriver): string {
    switch (driver) {
        case 'mysql':
            return 'utf8mb4';
        case 'postgres':
            return 'utf8';
        default:
            return 'utf8';
    }
}

/**
 * Gets the appropriate binary column type for the current database driver.
 * Reads DB_DRIVER from environment and returns the correct type.
 *
 * @returns 'bytea' for PostgreSQL, 'longblob' for MySQL, 'blob' for SQLite
 */
export function getBinaryColumnType(): 'bytea' | 'longblob' | 'blob' {
    const driver = mapPdoDriverToTypeOrm(process.env.DB_DRIVER);
    switch (driver) {
        case 'postgres':
            return 'bytea';
        case 'mysql':
            return 'longblob';
        default:
            return 'blob';
    }
}

/**
 * Gets the appropriate datetime column type for the current database driver.
 * Reads DB_DRIVER from environment and returns the correct type.
 *
 * @returns 'timestamp' for PostgreSQL/MySQL, 'datetime' for SQLite
 */
export function getDateTimeColumnType(): 'timestamp' | 'datetime' {
    const driver = mapPdoDriverToTypeOrm(process.env.DB_DRIVER);
    switch (driver) {
        case 'postgres':
        case 'mysql':
            return 'timestamp';
        default:
            return 'datetime';
    }
}
