/**
 * Detail editor for a jump interaction: the target time.
 */

import { secondsToHms, toSeconds } from '../../shared/time';
import type { JumpInteraction } from '../../shared/types';
import { tr } from '../state';
import type { DetailHost } from './types';

export function detailJump(interaction: JumpInteraction): string {
    return (
        '<div class="exe-form-group"><label for="ivDetailJump">' +
        tr('Jump to time (mm:ss)') +
        '</label><input type="text" id="ivDetailJump" class="form-control exe-iv-time-input" value="' +
        secondsToHms(interaction.jump ? interaction.jump.toTime : 0) +
        '"></div>'
    );
}

export function bindJump(interaction: JumpInteraction, _host: DetailHost): void {
    $('#ivDetailJump').on('change', function () {
        interaction.jump = { toTime: toSeconds($(this).val()) };
    });
}
