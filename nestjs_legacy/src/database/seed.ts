import { DataSource, DataSourceOptions } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { User } from '../entities/user.entity';
import {
    mapPdoDriverToTypeOrm,
    isSqlite,
    getDefaultPort,
    getDefaultCharset,
    TypeOrmDriver,
} from '../config/database-driver.helper';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.dist') });

/**
 * Build TypeORM DataSource options based on the database driver.
 */
function buildDataSourceOptions(): DataSourceOptions {
    const pdoDriver = process.env.DB_DRIVER;
    const driver: TypeOrmDriver = mapPdoDriverToTypeOrm(pdoDriver);

    console.log(`Database driver: ${driver} (from DB_DRIVER=${pdoDriver || 'default'})`);

    // SQLite configuration
    if (isSqlite(pdoDriver)) {
        const dbPathFromEnv = process.env.DB_PATH || 'data/exelearning.db';
        const dbPath = path.isAbsolute(dbPathFromEnv)
            ? dbPathFromEnv
            : path.resolve(__dirname, '../..', dbPathFromEnv);

        // Create data directory if needed
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        console.log(`SQLite database path: ${dbPath}`);

        // Load existing database or create empty
        let database: Uint8Array = new Uint8Array();
        if (fs.existsSync(dbPath)) {
            database = fs.readFileSync(dbPath);
        }

        return {
            type: 'sqljs',
            database,
            location: dbPath,
            autoSave: true,
            entities: [User],
            synchronize: true,
        };
    }

    // MySQL/MariaDB configuration
    if (driver === 'mysql') {
        const host = process.env.DB_HOST || 'localhost';
        const port = parseInt(process.env.DB_PORT, 10) || getDefaultPort('mysql');
        const database = process.env.DB_NAME || 'exelearning';
        const username = process.env.DB_USER || 'root';
        const password = process.env.DB_PASSWORD || '';
        const charset = process.env.DB_CHARSET || getDefaultCharset('mysql');

        console.log(`MySQL database: ${username}@${host}:${port}/${database}`);

        return {
            type: 'mysql',
            host,
            port,
            database,
            username,
            password,
            charset,
            entities: [User],
            synchronize: true,
        };
    }

    // PostgreSQL configuration
    if (driver === 'postgres') {
        const host = process.env.DB_HOST || 'localhost';
        const port = parseInt(process.env.DB_PORT, 10) || getDefaultPort('postgres');
        const database = process.env.DB_NAME || 'exelearning';
        const username = process.env.DB_USER || 'postgres';
        const password = process.env.DB_PASSWORD || '';

        console.log(`PostgreSQL database: ${username}@${host}:${port}/${database}`);

        return {
            type: 'postgres',
            host,
            port,
            database,
            username,
            password,
            entities: [User],
            synchronize: true,
        };
    }

    // Fallback to SQLite
    console.warn(`Unknown driver, falling back to SQLite`);
    const dbPath = path.resolve(__dirname, '../../data/exelearning.db');
    return {
        type: 'sqljs',
        database: new Uint8Array(),
        location: dbPath,
        autoSave: true,
        entities: [User],
        synchronize: true,
    };
}

async function seed() {
    console.log('Initializing database...');

    const dataSourceOptions = buildDataSourceOptions();
    const dataSource = new DataSource(dataSourceOptions);

    try {
        await dataSource.initialize();
        console.log('Database connection established');

        // Get User repository
        const userRepository = dataSource.getRepository(User);

        // Check if test user already exists
        const email = process.env.TEST_USER_EMAIL || 'user@exelearning.net';
        const existingUser = await userRepository.findOne({ where: { email } });

        if (existingUser) {
            console.log(`User "${email}" already exists, skipping creation`);
        } else {
            // Create test user
            console.log('Creating test user...');
            const password = process.env.TEST_USER_PASSWORD || '1234';
            const username = process.env.TEST_USER_USERNAME || 'user';
            const hashedPassword = await bcrypt.hash(password, 10);

            const user = userRepository.create({
                email,
                userId: username,
                password: hashedPassword,
                roles: ['ROLE_USER'],
                isLopdAccepted: true,
                quotaMb: 4096,
            });

            await userRepository.save(user);
            console.log('Test user created successfully');
        }

        console.log('');
        console.log('Database initialized successfully!');
        console.log('Test user credentials:');
        console.log(`  Email: ${email}`);
        console.log(`  Password: ${process.env.TEST_USER_PASSWORD || '1234'}`);
    } catch (error) {
        console.error('Error seeding database:', error.message);
        throw error;
    } finally {
        await dataSource.destroy();
    }
}

seed().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
});
