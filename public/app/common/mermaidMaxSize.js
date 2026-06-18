/**
 * Utility functions for Mermaid diagram max-width / max-height handling.
 *
 * Consumed by the exemermaid TinyMCE plugin via window.eXeLearning.mermaidMaxSize,
 * which is set up by the App constructor before any editor is opened.
 */

export function normalizeDimension(value) {
    if (typeof value !== 'string') return '';
    return value.trim();
}

export function isValidDimension(value) {
    if (value === '') return true;
    const matches = /^(\d+(?:\.\d+)?)(px|em|rem|%)$/i.exec(value);
    if (!matches) return false;
    return Number(matches[1]) > 0;
}

export function getStyleValue(value) {
    const normalized = normalizeDimension(value);
    return isValidDimension(normalized) ? normalized : '';
}

export function buildMaxSizeStyle(maxWidth, maxHeight) {
    const styles = [];
    const safeMaxWidth = getStyleValue(maxWidth);
    const safeMaxHeight = getStyleValue(maxHeight);
    if (safeMaxWidth !== '') styles.push('max-width:' + safeMaxWidth);
    if (safeMaxHeight !== '') styles.push('max-height:' + safeMaxHeight);
    return styles.join(';');
}

export function validateMaxSizeFields(maxWidth, maxHeight) {
    const normalizedMaxWidth = normalizeDimension(maxWidth);
    const normalizedMaxHeight = normalizeDimension(maxHeight);
    const errors = [];
    if (normalizedMaxWidth !== '' && !isValidDimension(normalizedMaxWidth)) {
        errors.push('invalid-max-width');
    }
    if (normalizedMaxHeight !== '' && !isValidDimension(normalizedMaxHeight)) {
        errors.push('invalid-max-height');
    }
    return {
        isValid: errors.length === 0,
        errors,
        maxWidth: normalizedMaxWidth,
        maxHeight: normalizedMaxHeight,
    };
}
