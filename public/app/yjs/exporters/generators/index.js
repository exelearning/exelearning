/**
 * Export Generators Index
 * Exports all manifest and metadata generators.
 */

// Generator classes
const Scorm12ManifestGenerator = require('./Scorm12ManifestGenerator');
const LomMetadataGenerator = require('./LomMetadataGenerator');

module.exports = {
  Scorm12ManifestGenerator,
  LomMetadataGenerator,
};
