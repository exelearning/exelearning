import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber } from 'class-validator';

/**
 * DTO for duplicating an iDevice (api_idevices_idevice_duplicate)
 * Accepts the iDevice component ID to duplicate.
 */
export class DuplicateIDeviceDto {
    @IsNotEmpty()
    @Transform(({ value }) => Number(value))
    @IsNumber()
    odeComponentsSyncId: number;
}
