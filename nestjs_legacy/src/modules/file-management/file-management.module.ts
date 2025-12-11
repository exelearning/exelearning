import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ZipService } from './services/zip.service';
import { FileHelperService } from './services/file-helper.service';
import { AssetCopyService } from './services/asset-copy.service';

@Module({
    imports: [ConfigModule],
    providers: [ZipService, FileHelperService, AssetCopyService],
    exports: [ZipService, FileHelperService, AssetCopyService],
})
export class FileManagementModule {}
