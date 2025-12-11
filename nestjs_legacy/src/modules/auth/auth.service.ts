import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { User } from '../../entities/user.entity';
import { UserPreferencesService } from '../user-preferences/user-preferences.service';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly userPreferencesService: UserPreferencesService,
    ) {}

    async login(email: string, password: string) {
        const user = await this.validateUser(email, password);

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload = { email: user.email, sub: user.id, roles: user.roles };

        return {
            access_token: this.jwtService.sign(payload),
            user,
        };
    }

    async validateUser(email: string, password: string): Promise<User | null> {
        const user = await this.userRepository.findOne({ where: { email } });

        if (!user) {
            return null;
        }

        // Check if password matches using bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return null;
        }

        return user;
    }

    async findById(id: number): Promise<User | null> {
        return this.userRepository.findOne({ where: { id } });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.userRepository.findOne({ where: { email } });
    }

    getAuthMethods(): string[] {
        const raw = this.configService.get<string>('APP_AUTH_METHODS') || 'password,guest';
        return raw
            .split(',')
            .map((method) => method.trim().toLowerCase())
            .filter(Boolean);
    }

    private canCreateExternalUsers(): boolean {
        const raw = this.configService.get<string>('AUTH_CREATE_USERS');
        if (raw === undefined || raw === null) return true;

        return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
    }

    private buildTempEmail(localPart: string): string {
        const safeLocalPart = localPart.replace(/[^a-zA-Z0-9._-]/g, '') || 'user';
        const domain = this.configService.get<string>('AUTH_TEMP_EMAIL_DOMAIN') || 'domain.local';
        return `${safeLocalPart}@${domain}`;
    }

    /**
     * Validate a JWT token and return the user if valid
     * Used for WebSocket authentication
     */
    async validateToken(token: string): Promise<User | null> {
        if (!token) return null;

        try {
            const payload = this.jwtService.verify(token);
            if (!payload.sub) return null;

            return this.findById(payload.sub);
        } catch {
            return null;
        }
    }

    /**
     * Generate a JWT token for a user by ID
     * Used to provide auth token to frontend for WebSocket connections
     */
    async generateTokenForUser(
        userId: number,
        email?: string,
        isGuest = false,
    ): Promise<string | null> {
        if (isGuest) {
            // For guest users, generate a token with limited claims
            const payload = {
                email: email || 'guest@guest.local',
                sub: userId,
                roles: ['ROLE_GUEST'],
                isGuest: true,
            };
            return this.jwtService.sign(payload);
        }

        const user = await this.findById(userId);
        if (!user) return null;

        const payload = { email: user.email, sub: user.id, roles: user.roles };
        return this.jwtService.sign(payload);
    }

    async findOrCreateExternalUser(
        identifier: string,
        email?: string,
        roles: string[] = ['ROLE_USER'],
        browserLocale?: string,
    ): Promise<User> {
        const tempEmail = email || this.buildTempEmail(identifier);

        let user =
            (await this.userRepository.findOne({ where: { externalIdentifier: identifier } })) ||
            (await this.userRepository.findOne({ where: { email: tempEmail } }));

        if (user) {
            return user;
        }

        if (!this.canCreateExternalUsers()) {
            throw new UnauthorizedException('External users are not allowed to login.');
        }

        const password = await bcrypt.hash(randomBytes(12).toString('hex'), 10);

        user = this.userRepository.create({
            email: tempEmail,
            userId: identifier.slice(0, 40),
            password,
            roles,
            isLopdAccepted: true,
            externalIdentifier: identifier,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const savedUser = await this.userRepository.save(user);

        // Save browser locale preference for new user
        if (browserLocale) {
            await this.userPreferencesService.upsertPreference(
                savedUser.id.toString(),
                'locale',
                browserLocale,
            );
        }

        return savedUser;
    }
}
