// Image compressor translation file
// Uses IIFE to ensure proper initialization order
(function(global) {
	'use strict';

	// Define translation function with proper fallback
	var translateFn;
	try {
		if (typeof top !== 'undefined' && top !== null && typeof top._ === 'function') {
			translateFn = top._;
		} else if (typeof global._ === 'function') {
			translateFn = global._;
		} else {
			translateFn = function(str) { return str; };
		}
	} catch (e) {
		// Cross-origin or security error
		translateFn = function(str) { return str; };
	}

	// Export as global _ for this context
	global._ = translateFn;

	// Create i18n object
	global.$i18n = {
		imageOptimizer: translateFn("Image optimizer"),
		uploadInstructions: translateFn("Drop image here or $browse...$"),
		size: translateFn('Size'),
		maxWidth: translateFn("Max width"),
		maxHeight: translateFn("Max height"),
		width: translateFn("Width"),
		height: translateFn("Height"),
		quality: translateFn("Quality"),
		name: translateFn("Name"),
		originalSize: translateFn("Before"),
		resultSize: translateFn("After"),
		finish: translateFn("Finish"),
		newImageWarning: translateFn("You just added that image. Save the iDevice or select the image again to update it."),
		backupWarning: translateFn("$Save the current image$ before overwriting it.")
	};
})(typeof window !== 'undefined' ? window : this);
