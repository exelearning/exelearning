import { projectTools } from './projectTools.js';
import { pageTools } from './pageTools.js';
import { blockTools } from './blockTools.js';
import { componentTools } from './componentTools.js';
import { ideviceTextTools } from './ideviceTextTools.js';
import { ideviceSpecializedTools } from './ideviceSpecializedTools.js';
import { assetTools } from './assetTools.js';

// Complete tool catalog - all 27 tools
export const toolCatalog = [
    ...projectTools,
    ...pageTools,
    ...blockTools,
    ...componentTools,
    ...ideviceTextTools,
    ...ideviceSpecializedTools,
    ...assetTools,
];

// Lookup by name
export function getToolDefinition(name) {
    return toolCatalog.find((tool) => tool.name === name) || null;
}

// Filter by category
export function getToolsByCategory(category) {
    return toolCatalog.filter((tool) => tool.category === category);
}

// Get all categories
export function getCategories() {
    return [...new Set(toolCatalog.map((tool) => tool.category))].sort();
}

// Get read-only tools
export function getReadOnlyTools() {
    return toolCatalog.filter((tool) => !tool.writes);
}

// Get write tools
export function getWriteTools() {
    return toolCatalog.filter((tool) => tool.writes);
}

// Re-export individual collections
export { projectTools, pageTools, blockTools, componentTools, ideviceTextTools, ideviceSpecializedTools, assetTools };
