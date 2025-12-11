import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

const toOptionalNumber = () =>
    Transform(({ value }) => {
        if (value === undefined || value === null || value === '') return undefined;
        const n = Number(value);
        return Number.isNaN(n) ? undefined : n;
    });

const toOptionalString = () =>
    Transform(({ value }) => {
        if (value === undefined || value === null) return null;
        if (typeof value === 'string') return value;
        // Convert objects/arrays to JSON string (replicates Symfony behavior)
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    });

/**
 * DTO for saving iDevice HTML view (api_idevices_html_view_save)
 * Accepts form-urlencoded payloads by coercing numeric fields.
 */
export class SaveHtmlViewDto {
    @IsOptional()
    @toOptionalNumber()
    @IsNumber()
    odeComponentsSyncId?: number;

    @IsOptional()
    @toOptionalNumber()
    @IsNumber()
    id?: number; // alias used by some callers

    @IsOptional()
    @IsString()
    odeSessionId?: string;

    @IsOptional()
    @IsString()
    odePageId?: string;

    @IsOptional()
    @IsString()
    odeBlockId?: string;

    @IsOptional()
    @IsString()
    odeIdeviceId?: string;

    @IsOptional()
    @IsString()
    odeIdeviceTypeName?: string;

    @toOptionalString()
    @IsString()
    @IsOptional()
    htmlView?: string;

    @toOptionalString()
    @IsString()
    @IsOptional()
    jsonProperties?: string;

    @IsOptional()
    @toOptionalNumber()
    @IsNumber()
    odeComponentsSyncOrder?: number;

    @IsOptional()
    @toOptionalNumber()
    @IsNumber()
    odePagStructureSyncId?: number;
}
