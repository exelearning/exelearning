import { Module } from '@nestjs/common';
import { StaticFilesController } from './static-files.controller';

@Module({
    controllers: [StaticFilesController],
})
export class StaticFilesModule {}
