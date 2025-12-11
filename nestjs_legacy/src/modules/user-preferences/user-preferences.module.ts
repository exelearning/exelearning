import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPreferences } from '../../entities/user-preferences.entity';
import { UserPreferencesService } from './user-preferences.service';

@Module({
    imports: [TypeOrmModule.forFeature([UserPreferences])],
    providers: [UserPreferencesService],
    exports: [UserPreferencesService, TypeOrmModule],
})
export class UserPreferencesModule {}
