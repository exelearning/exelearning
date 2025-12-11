import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from '../../entities/user.entity';
import { UserPreferencesModule } from '../user-preferences/user-preferences.module';
import { IDeviceModule } from '../idevice/idevice.module';
import { ThemeModule } from '../theme/theme.module';
import { SessionModule } from '../session/session.module';
import { ProjectModule } from '../project/project.module';
import { AuthBootstrapService } from './auth.bootstrap';
import { TranslationModule } from '../translation/translation.module';

// Get JWT secret from environment with fallback chain:
// 1. API_JWT_SECRET (specific for API tokens)
// 2. APP_SECRET (main application secret)
// 3. Development default (only acceptable in dev mode)
function getJwtSecret(): string {
    const secret =
        process.env.API_JWT_SECRET ||
        process.env.APP_SECRET ||
        'dev-secret-change-in-production';

    // Warn in production if using default secret
    if (
        process.env.APP_ENV === 'prod' &&
        secret === 'dev-secret-change-in-production'
    ) {
        console.warn(
            '[Auth] WARNING: Using default JWT secret in production! Set API_JWT_SECRET or APP_SECRET in .env',
        );
    }

    return secret;
}

@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
            secret: getJwtSecret(),
            signOptions: { expiresIn: '1d' },
        }),
        UserPreferencesModule,
        IDeviceModule,
        ThemeModule,
        forwardRef(() => SessionModule),
        forwardRef(() => ProjectModule),
        TranslationModule,
    ],
    controllers: [AuthController],
    providers: [AuthService, AuthBootstrapService],
    exports: [AuthService, TypeOrmModule, JwtModule],
})
export class AuthModule {}
