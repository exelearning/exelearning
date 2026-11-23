/**
 * The helps (common.getHelpTooltip) of a form that open their explanation on a click: those started, and not yet
 * released when the edition closed. A help started twice does not open, as its second handler closes it again. Each
 * one is closed afterwards, so the form is left as it was.
 */
export function openingHelps(scope: ParentNode = document): HTMLElement[] {
    return [...scope.querySelectorAll<HTMLElement>('.exe-idevice-help')].filter(button => {
        button.click();
        const opened = button.getAttribute('aria-expanded') === 'true';
        if (opened) button.click();
        return opened;
    });
}
