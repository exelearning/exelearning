import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
    @Get('healthcheck')
    healthCheck() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'exelearning-nestjs',
            environment: process.env.NODE_ENV || 'development',
        };
    }

    @Get('api/healthcheck')
    apiHealthCheck() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'exelearning-nestjs-api',
            environment: process.env.NODE_ENV || 'development',
        };
    }
}
