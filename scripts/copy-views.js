/**
 * Script to copy views/ directory to dist/ after build
 * This ensures templates are available when NestJS runs from dist/
 */

const fs = require('fs-extra');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const viewsSource = path.join(projectRoot, 'views');
const viewsDestination = path.join(projectRoot, 'dist', 'views');

async function copyViews() {
  try {
    console.log('Copying views/ to dist/views/...');

    // Ensure dist/ directory exists
    await fs.ensureDir(path.join(projectRoot, 'dist'));

    // Copy views/ to dist/views/
    await fs.copy(viewsSource, viewsDestination, {
      overwrite: true,
      errorOnExist: false
    });

    console.log('✓ Successfully copied views/ to dist/views/');
  } catch (error) {
    console.error('Error copying views/:', error.message);
    process.exit(1);
  }
}

copyViews();
