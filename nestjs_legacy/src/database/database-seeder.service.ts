import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';

/**
 * DatabaseSeederService - Seeds the database with initial data
 * Works with any database type supported by TypeORM (SQLite, MariaDB, PostgreSQL)
 */
export class DatabaseSeederService {
    constructor(private readonly dataSource: DataSource) {}

    /**
     * Run the seeder - creates test user if no users exist
     * Safe to run multiple times (idempotent)
     */
    async seed(): Promise<void> {
        console.log('[DatabaseSeeder] Checking if database needs seeding...');

        try {
            // First, ensure the schema is synchronized (creates tables if they don't exist)
            await this.ensureSchema();

            // Check if users table has data
            const userRepository = this.dataSource.getRepository(User);
            const userCount = await userRepository.count();

            if (userCount > 0) {
                console.log(`[DatabaseSeeder] Database already has ${userCount} user(s), skipping seed.`);
                return;
            }

            // Create test user from environment variables
            await this.createTestUser();

            console.log('[DatabaseSeeder] ✓ Database seeding completed successfully!');
        } catch (error) {
            console.error('[DatabaseSeeder] Error during seeding:', error.message);
            // Don't throw - allow app to start even if seeding fails
            // This prevents boot loops in case of transient DB issues
        }
    }

    /**
     * Ensure database schema exists
     * This is especially important for production where synchronize is disabled
     */
    private async ensureSchema(): Promise<void> {
        console.log('[DatabaseSeeder] Ensuring database schema...');

        try {
            // Try to run pending migrations first
            const pendingMigrations = await this.dataSource.showMigrations();
            if (pendingMigrations) {
                console.log('[DatabaseSeeder] Running pending migrations...');
                await this.dataSource.runMigrations();
            }
        } catch {
            // Migrations might not be set up, continue with synchronize fallback
            console.log('[DatabaseSeeder] No migrations to run or migrations not configured.');
        }

        // Check if users table exists by trying a simple query
        const queryRunner = this.dataSource.createQueryRunner();
        try {
            const tableExists = await queryRunner.hasTable('users');
            if (!tableExists) {
                console.log('[DatabaseSeeder] Users table not found, synchronizing schema...');
                // Force synchronize to create tables
                await this.dataSource.synchronize();
                console.log('[DatabaseSeeder] ✓ Schema synchronized.');
            } else {
                console.log('[DatabaseSeeder] ✓ Users table exists.');
            }
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Create the test user from environment variables
     */
    private async createTestUser(): Promise<void> {
        const email = process.env.TEST_USER_EMAIL || 'user@exelearning.net';
        const password = process.env.TEST_USER_PASSWORD || '1234';
        const username = process.env.TEST_USER_USERNAME || 'user';

        console.log(`[DatabaseSeeder] Creating test user: ${email}`);

        const userRepository = this.dataSource.getRepository(User);

        // Check if user already exists (by email)
        const existingUser = await userRepository.findOne({ where: { email } });
        if (existingUser) {
            console.log(`[DatabaseSeeder] User ${email} already exists, skipping.`);
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user entity
        const user = new User();
        user.email = email;
        user.userId = username;
        user.password = hashedPassword;
        user.roles = ['ROLE_USER'];
        user.isLopdAccepted = true;
        user.quotaMb = 4096;
        user.isActive = true;

        // Save user
        await userRepository.save(user);

        console.log('[DatabaseSeeder] ✓ Test user created:');
        console.log(`    Email: ${email}`);
        console.log(`    Password: ${password}`);
    }
}

/**
 * Seed the database using the provided DataSource
 * Call this from main.ts after NestFactory.create() but before app.listen()
 */
export async function seedDatabase(dataSource: DataSource): Promise<void> {
    const seeder = new DatabaseSeederService(dataSource);
    await seeder.seed();
}
