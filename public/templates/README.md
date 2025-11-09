# eXeLearning Templates

This directory contains template `.elpx` files that users can use to create new projects.

## Directory Structure

Templates are organized by language code:

```
templates/
├── en/          # English templates
├── es/          # Spanish templates
├── ca/          # Catalan templates
├── gl/          # Galician templates
├── eu/          # Basque templates
├── va/          # Valencian templates
├── eo/          # Esperanto templates
└── fr/          # French templates
```

## Adding Templates

1. Place your `.elpx` files in the appropriate language folder
2. The filename (without extension) will be displayed as the template name
3. You can use spaces and special characters in filenames
4. Templates appear in the **File → New from Template** menu

## Docker Volume Mounting

To use custom templates in a Docker deployment, mount a volume:

```yaml
volumes:
  - ./my-templates:/app/public/templates
```

Or for a specific language:

```yaml
volumes:
  - ./my-en-templates:/app/public/templates/en
```

## Template Creation

To create a template:

1. Design your project in eXeLearning
2. Export it as an `.elpx` file
3. Place it in the appropriate language folder
4. Restart the application (if needed)

The template will automatically appear in the "New from Template" menu for users with that language selected.
