import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Asset } from '../../entities/asset.entity';
import { AssetsController } from './controllers/assets.controller';
import { AssetsService } from './services/assets.service';
import { AssetChunkUploadService } from './services/asset-chunk-upload.service';
import { ProjectsModule } from '../projects/projects.module';
import { AuthModule } from '../auth/auth.module';

/**
 * AssetsModule
 * Handles file upload/download and asset management for projects.
 * Assets are stored in the filesystem with metadata in the database.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([Asset]),
        ProjectsModule,
        AuthModule,
        // Configure Multer globally for this module with generous limits
        MulterModule.register({
            limits: {
                fileSize: 50 * 1024 * 1024, // 50MB per file
                files: 100, // Max 100 files per request
                fieldSize: 10 * 1024 * 1024, // 10MB for text fields (metadata JSON)
            },
        }),
    ],
    controllers: [AssetsController],
    providers: [AssetsService, AssetChunkUploadService],
    exports: [AssetsService, AssetChunkUploadService],
})
export class AssetsModule {}
