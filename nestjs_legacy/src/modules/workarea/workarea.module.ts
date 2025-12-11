import { Module } from '@nestjs/common';
import { WorkareaController } from './workarea.controller';
import { WorkareaService } from './workarea.service';

@Module({
    controllers: [WorkareaController],
    providers: [WorkareaService],
    exports: [WorkareaService],
})
export class WorkareaModule {}
