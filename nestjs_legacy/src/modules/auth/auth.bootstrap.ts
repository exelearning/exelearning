import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';

/**
 * Ensures a default local user exists so packaged apps can log in.
 */
@Injectable()
export class AuthBootstrapService implements OnApplicationBootstrap {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly configService: ConfigService,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        const email =
            this.configService.get<string>('DEFAULT_USER_EMAIL') ||
            this.configService.get<string>('TEST_USER_EMAIL') ||
            'user@exelearning.net';
        const password =
            this.configService.get<string>('DEFAULT_USER_PASSWORD') ||
            this.configService.get<string>('TEST_USER_PASSWORD') ||
            '1234';
        const username =
            this.configService.get<string>('DEFAULT_USER_USERNAME') ||
            this.configService.get<string>('TEST_USER_USERNAME') ||
            'user';

        if (!email || !password) {
            return;
        }

        const existing = await this.userRepository.findOne({ where: { email } });
        if (existing) {
            return;
        }

        const hashed = await bcrypt.hash(password, 10);
        const user = this.userRepository.create({
            email,
            userId: username.slice(0, 40),
            password: hashed,
            roles: ['ROLE_USER'],
            isLopdAccepted: true,
            quotaMb: 4096,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await this.userRepository.save(user);
        console.log(`Default user created: ${email}`);
    }
}
