/**
 * ODE XML Validator
 *
 * Validates ODE XML content against the DTD structure.
 * Since fast-xml-parser doesn't support DTD validation natively,
 * this module implements structural validation based on the ODE DTD rules.
 *
 * DTD Structure:
 * <!ELEMENT ode (userPreferences?, odeResources?, odeProperties?, odeNavStructures)>
 * <!ELEMENT odeNavStructures (odeNavStructure+)>
 * <!ELEMENT odeNavStructure (odePageId, odeParentPageId, pageName, odeNavStructureOrder, ...)>
 */

export interface ValidationError {
    code: string;
    message: string;
    path: string;
    severity: 'error' | 'warning';
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

/**
 * Validate parsed ODE XML structure
 * @param parsed - The parsed XML object from fast-xml-parser
 * @returns Validation result with errors and warnings
 */
export function validateOdeXml(parsed: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Type guard for parsed object
    if (!parsed || typeof parsed !== 'object') {
        errors.push({
            code: 'INVALID_STRUCTURE',
            message: 'Parsed XML is not a valid object',
            path: '/',
            severity: 'error',
        });
        return { valid: false, errors, warnings };
    }

    const doc = parsed as Record<string, unknown>;

    // Check for root element
    if (!doc.ode) {
        // Check for legacy formats (not errors, just different formats)
        if (doc.exe_document || doc.instance) {
            // Legacy formats are valid but don't need ODE validation
            return { valid: true, errors: [], warnings: [] };
        }

        errors.push({
            code: 'MISSING_ROOT',
            message: 'Missing <ode> root element',
            path: '/',
            severity: 'error',
        });
        return { valid: false, errors, warnings };
    }

    const ode = doc.ode as Record<string, unknown>;

    // Validate ode attributes
    validateOdeAttributes(ode, errors, warnings);

    // Validate optional sections
    if (ode.userPreferences !== undefined) {
        validateUserPreferences(ode.userPreferences, errors, warnings);
    }

    if (ode.odeResources !== undefined) {
        validateOdeResources(ode.odeResources, errors, warnings);
    }

    if (ode.odeProperties !== undefined) {
        validateOdeProperties(ode.odeProperties, errors, warnings);
    }

    // Validate required odeNavStructures
    if (!ode.odeNavStructures) {
        errors.push({
            code: 'MISSING_NAV_STRUCTURES',
            message: 'Missing required <odeNavStructures> element',
            path: '/ode',
            severity: 'error',
        });
    } else {
        validateOdeNavStructures(ode.odeNavStructures, errors, warnings);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Validate ODE root element attributes
 */
function validateOdeAttributes(
    ode: Record<string, unknown>,
    errors: ValidationError[],
    warnings: ValidationError[],
): void {
    // xmlns is expected (FIXED in DTD)
    const xmlns = ode['@_xmlns'];
    if (xmlns && xmlns !== 'http://www.intef.es/xsd/ode') {
        warnings.push({
            code: 'INVALID_NAMESPACE',
            message: `Unexpected namespace: ${xmlns}. Expected: http://www.intef.es/xsd/ode`,
            path: '/ode/@xmlns',
            severity: 'warning',
        });
    }

    // version is optional but should be valid
    const version = ode['@_version'];
    if (version && typeof version !== 'string' && typeof version !== 'number') {
        warnings.push({
            code: 'INVALID_VERSION',
            message: `Version should be a string or number, got: ${typeof version}`,
            path: '/ode/@version',
            severity: 'warning',
        });
    }
}

/**
 * Validate userPreferences section
 */
function validateUserPreferences(userPrefs: unknown, errors: ValidationError[], _warnings: ValidationError[]): void {
    if (!userPrefs || typeof userPrefs !== 'object') return;

    const prefs = userPrefs as Record<string, unknown>;
    const userPref = prefs.userPreference;

    if (userPref !== undefined) {
        const prefArray = Array.isArray(userPref) ? userPref : [userPref];
        for (let i = 0; i < prefArray.length; i++) {
            validateKeyValuePair(prefArray[i], `/ode/userPreferences/userPreference[${i}]`, errors);
        }
    }
}

/**
 * Validate odeResources section
 */
function validateOdeResources(odeResources: unknown, errors: ValidationError[], _warnings: ValidationError[]): void {
    if (!odeResources || typeof odeResources !== 'object') return;

    const resources = odeResources as Record<string, unknown>;
    const odeResource = resources.odeResource;

    if (odeResource !== undefined) {
        const resourceArray = Array.isArray(odeResource) ? odeResource : [odeResource];
        for (let i = 0; i < resourceArray.length; i++) {
            validateKeyValuePair(resourceArray[i], `/ode/odeResources/odeResource[${i}]`, errors);
        }
    }
}

/**
 * Validate odeProperties section
 */
function validateOdeProperties(odeProperties: unknown, errors: ValidationError[], _warnings: ValidationError[]): void {
    if (!odeProperties || typeof odeProperties !== 'object') return;

    const properties = odeProperties as Record<string, unknown>;
    const odeProperty = properties.odeProperty;

    if (odeProperty !== undefined) {
        const propArray = Array.isArray(odeProperty) ? odeProperty : [odeProperty];
        for (let i = 0; i < propArray.length; i++) {
            validateKeyValuePair(propArray[i], `/ode/odeProperties/odeProperty[${i}]`, errors);
        }
    }
}

/**
 * Validate a key-value pair element (using key/value)
 */
function validateKeyValuePair(item: unknown, path: string, errors: ValidationError[]): void {
    if (!item || typeof item !== 'object') {
        errors.push({
            code: 'INVALID_KEY_VALUE',
            message: 'Key-value pair is not a valid object',
            path,
            severity: 'error',
        });
        return;
    }

    const pair = item as Record<string, unknown>;

    // Key is required
    if (pair.key === undefined) {
        errors.push({
            code: 'MISSING_KEY',
            message: 'Missing required <key> element',
            path,
            severity: 'error',
        });
    }

    // Value is required (but can be empty string)
    if (pair.value === undefined) {
        errors.push({
            code: 'MISSING_VALUE',
            message: 'Missing required <value> element',
            path,
            severity: 'error',
        });
    }
}

/**
 * Validate odeNavStructures section
 */
function validateOdeNavStructures(
    navStructures: unknown,
    errors: ValidationError[],
    warnings: ValidationError[],
): void {
    if (!navStructures || typeof navStructures !== 'object') {
        errors.push({
            code: 'INVALID_NAV_STRUCTURES',
            message: 'odeNavStructures is not a valid object',
            path: '/ode/odeNavStructures',
            severity: 'error',
        });
        return;
    }

    const structures = navStructures as Record<string, unknown>;
    const odeNavStructure = structures.odeNavStructure;

    // DTD: odeNavStructure+ (at least one required)
    if (!odeNavStructure) {
        errors.push({
            code: 'MISSING_NAV_STRUCTURE',
            message: 'odeNavStructures must contain at least one <odeNavStructure> element',
            path: '/ode/odeNavStructures',
            severity: 'error',
        });
        return;
    }

    const navArray = Array.isArray(odeNavStructure) ? odeNavStructure : [odeNavStructure];

    if (navArray.length === 0) {
        errors.push({
            code: 'EMPTY_NAV_STRUCTURES',
            message: 'odeNavStructures must contain at least one page',
            path: '/ode/odeNavStructures',
            severity: 'error',
        });
        return;
    }

    // Validate each navigation structure (page)
    for (let i = 0; i < navArray.length; i++) {
        validateOdeNavStructure(navArray[i], `/ode/odeNavStructures/odeNavStructure[${i}]`, errors, warnings);
    }
}

/**
 * Validate single odeNavStructure (page)
 */
function validateOdeNavStructure(
    navStructure: unknown,
    path: string,
    errors: ValidationError[],
    warnings: ValidationError[],
): void {
    if (!navStructure || typeof navStructure !== 'object') {
        errors.push({
            code: 'INVALID_NAV_STRUCTURE',
            message: 'odeNavStructure is not a valid object',
            path,
            severity: 'error',
        });
        return;
    }

    const nav = navStructure as Record<string, unknown>;

    // Required elements
    if (nav.odePageId === undefined) {
        errors.push({
            code: 'MISSING_PAGE_ID',
            message: 'Missing required <odePageId> element',
            path,
            severity: 'error',
        });
    }

    // odeParentPageId is required (but can be empty for root pages)
    if (nav.odeParentPageId === undefined) {
        warnings.push({
            code: 'MISSING_PARENT_PAGE_ID',
            message: 'Missing <odeParentPageId> element (should be empty string for root pages)',
            path,
            severity: 'warning',
        });
    }

    if (nav.pageName === undefined) {
        errors.push({
            code: 'MISSING_PAGE_NAME',
            message: 'Missing required <pageName> element',
            path,
            severity: 'error',
        });
    }

    if (nav.odeNavStructureOrder === undefined) {
        errors.push({
            code: 'MISSING_NAV_ORDER',
            message: 'Missing required <odeNavStructureOrder> element',
            path,
            severity: 'error',
        });
    }

    // Validate optional odePagStructures
    if (nav.odePagStructures !== undefined) {
        validateOdePagStructures(nav.odePagStructures, `${path}/odePagStructures`, errors, warnings);
    }
}

/**
 * Validate odePagStructures (blocks)
 */
function validateOdePagStructures(
    pagStructures: unknown,
    path: string,
    errors: ValidationError[],
    warnings: ValidationError[],
): void {
    if (!pagStructures || typeof pagStructures !== 'object') return;

    const structures = pagStructures as Record<string, unknown>;
    const odePagStructure = structures.odePagStructure;

    if (odePagStructure !== undefined) {
        const pagArray = Array.isArray(odePagStructure) ? odePagStructure : [odePagStructure];

        for (let i = 0; i < pagArray.length; i++) {
            validateOdePagStructure(pagArray[i], `${path}/odePagStructure[${i}]`, errors, warnings);
        }
    }
}

/**
 * Validate single odePagStructure (block)
 */
function validateOdePagStructure(
    pagStructure: unknown,
    path: string,
    errors: ValidationError[],
    warnings: ValidationError[],
): void {
    if (!pagStructure || typeof pagStructure !== 'object') {
        errors.push({
            code: 'INVALID_PAG_STRUCTURE',
            message: 'odePagStructure is not a valid object',
            path,
            severity: 'error',
        });
        return;
    }

    const pag = pagStructure as Record<string, unknown>;

    // Required elements
    if (pag.odePageId === undefined) {
        errors.push({
            code: 'MISSING_BLOCK_PAGE_ID',
            message: 'Missing required <odePageId> in block',
            path,
            severity: 'error',
        });
    }

    if (pag.odeBlockId === undefined) {
        errors.push({
            code: 'MISSING_BLOCK_ID',
            message: 'Missing required <odeBlockId> element',
            path,
            severity: 'error',
        });
    }

    if (pag.blockName === undefined) {
        warnings.push({
            code: 'MISSING_BLOCK_NAME',
            message: 'Missing <blockName> element',
            path,
            severity: 'warning',
        });
    }

    if (pag.odePagStructureOrder === undefined) {
        errors.push({
            code: 'MISSING_PAG_ORDER',
            message: 'Missing required <odePagStructureOrder> element',
            path,
            severity: 'error',
        });
    }

    // Validate optional odeComponents
    if (pag.odeComponents !== undefined) {
        validateOdeComponents(pag.odeComponents, `${path}/odeComponents`, errors, warnings);
    }
}

/**
 * Validate odeComponents (iDevices)
 */
function validateOdeComponents(
    odeComponents: unknown,
    path: string,
    errors: ValidationError[],
    warnings: ValidationError[],
): void {
    if (!odeComponents || typeof odeComponents !== 'object') return;

    const components = odeComponents as Record<string, unknown>;
    const odeComponent = components.odeComponent;

    if (odeComponent !== undefined) {
        const compArray = Array.isArray(odeComponent) ? odeComponent : [odeComponent];

        for (let i = 0; i < compArray.length; i++) {
            validateOdeComponent(compArray[i], `${path}/odeComponent[${i}]`, errors, warnings);
        }
    }
}

/**
 * Validate single odeComponent (iDevice)
 */
function validateOdeComponent(
    odeComponent: unknown,
    path: string,
    errors: ValidationError[],
    warnings: ValidationError[],
): void {
    if (!odeComponent || typeof odeComponent !== 'object') {
        errors.push({
            code: 'INVALID_COMPONENT',
            message: 'odeComponent is not a valid object',
            path,
            severity: 'error',
        });
        return;
    }

    const comp = odeComponent as Record<string, unknown>;

    // Required elements
    if (comp.odePageId === undefined) {
        errors.push({
            code: 'MISSING_COMP_PAGE_ID',
            message: 'Missing required <odePageId> in component',
            path,
            severity: 'error',
        });
    }

    if (comp.odeBlockId === undefined) {
        errors.push({
            code: 'MISSING_COMP_BLOCK_ID',
            message: 'Missing required <odeBlockId> in component',
            path,
            severity: 'error',
        });
    }

    if (comp.odeIdeviceId === undefined) {
        errors.push({
            code: 'MISSING_IDEVICE_ID',
            message: 'Missing required <odeIdeviceId> element',
            path,
            severity: 'error',
        });
    }

    if (comp.odeIdeviceTypeName === undefined) {
        errors.push({
            code: 'MISSING_IDEVICE_TYPE',
            message: 'Missing required <odeIdeviceTypeName> element',
            path,
            severity: 'error',
        });
    }

    if (comp.odeComponentsOrder === undefined) {
        errors.push({
            code: 'MISSING_COMP_ORDER',
            message: 'Missing required <odeComponentsOrder> element',
            path,
            severity: 'error',
        });
    }

    // htmlView and jsonProperties are optional
    // At least one should ideally be present for content
    if (comp.htmlView === undefined && comp.jsonProperties === undefined) {
        warnings.push({
            code: 'NO_CONTENT',
            message: 'Component has neither <htmlView> nor <jsonProperties> - component may be empty',
            path,
            severity: 'warning',
        });
    }
}

/**
 * Format validation errors for logging/display
 */
export function formatValidationErrors(result: ValidationResult): string {
    const lines: string[] = [];

    if (result.valid) {
        lines.push('XML validation passed.');
    } else {
        lines.push('XML validation failed:');
    }

    for (const error of result.errors) {
        lines.push(`  ERROR [${error.code}] ${error.path}: ${error.message}`);
    }

    for (const warning of result.warnings) {
        lines.push(`  WARNING [${warning.code}] ${warning.path}: ${warning.message}`);
    }

    return lines.join('\n');
}
