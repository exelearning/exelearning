import { Controller, Get, Render, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { WorkareaService } from './workarea.service';

@Controller()
export class WorkareaController {
    constructor(private readonly workareaService: WorkareaService) {}

    // Workarea endpoint moved to PagesController for proper authentication
    // This controller is kept for future workarea-specific API endpoints
}
