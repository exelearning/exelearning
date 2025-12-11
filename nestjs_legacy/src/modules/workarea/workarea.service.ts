import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkareaService {
    async getConfig() {
        // Return configuration similar to Symfony
        return {
            locale: 'es',
            theme: 'default',
            autosaveInterval: 30000,
            maxFileSize: 10485760, // 10MB
            allowedExtensions: ['.jpg', '.png', '.gif', '.pdf', '.doc', '.docx'],
            features: {
                collaboration: true,
                export: true,
                import: true,
                templates: true,
            },
        };
    }
}
