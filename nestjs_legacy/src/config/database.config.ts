import { registerAs } from '@nestjs/config';
import {
    mapPdoDriverToTypeOrm,
    getDefaultPort,
    getDefaultCharset,
} from './database-driver.helper';

/**
 * Database configuration factory.
 *
 * Reads database configuration from environment variables and provides
 * a normalized configuration object for use throughout the application.
 *
 * Supports three database drivers:
 * - pdo_sqlite (SQLite via sql.js)
 * - pdo_mysql (MySQL/MariaDB)
 * - pdo_pgsql (PostgreSQL)
 */
export default registerAs('database', () => {
    const pdoDriver = process.env.DB_DRIVER;
    const driver = mapPdoDriverToTypeOrm(pdoDriver);

    return {
        // TypeORM driver type (sqljs, mysql, postgres)
        driver,
        // Original PDO driver name for reference
        pdoDriver: pdoDriver || 'pdo_sqlite',
        // Connection settings
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || getDefaultPort(driver),
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        charset: process.env.DB_CHARSET || getDefaultCharset(driver),
        // SQLite-specific
        path: process.env.DB_PATH || 'data/exelearning.db',
        // General settings
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV === 'development',
    };
});
