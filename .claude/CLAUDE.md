# Reglas generales

- Responde siempre en español con tecnicismos en inglés
- Sigue principios SOLID y Clean Code
- Antes de entregar código largo, incluye manejo de errores (try/catch o similares)
- Si propones una función, añade un ejemplo de uso o test básico
- Prioriza las versiones de las librerías detectadas en el proyecto (ver package.json)
- Añade comentarios breves explicando el "porqué" en soluciones complejas

## Contexto del proyecto

- **Proyecto**: eXeLearning 4 — plataforma de autoría de contenido educativo (AGPL)
- **Repositorio**: https://github.com/exelearning/exelearning

## Stack técnico

### Backend
- **Runtime**: Bun
- **Framework**: Elysia (TypeScript)
- **Base de datos**: Kysely (query builder tipado)
- **WebSocket / colaboración**: Yjs

### Frontend
- **Lógica**: TypeScript con tipado fuerte — evita `any`
- **DOM**: jQuery 3.x de forma idiomática; tipa siempre los eventos (`e: JQuery.ClickEvent`, etc.)
- **Templates**: Nunjucks
- **UI**: Bootstrap + TinyMCE
- **CSS**: Flexbox/Grid moderno, mobile-first, sin floats

### Empaquetado desktop
- **Electron** (proceso principal en `main.js`)
- **Build**: Makefile + comandos Bun

## Convenciones de código

- TypeScript en toda la lógica de negocio; usa clases, módulos e interfaces
- Sanitización XSS: usa siempre **DOMPurify** para HTML de usuario y **stripHtml()** para texto plano
- Tests de integración en `/test/` ejecutados con `bun test`
- Tests E2E con Playwright

## Estructura del proyecto

    src/          → backend Elysia (routes, services, db, websocket)
    public/app/   → frontend Vanilla JS / TypeScript
    public/libs/  → jQuery, Bootstrap, TinyMCE
    views/        → templates Nunjucks
    test/         → tests de integración
    main.js       → proceso principal Electron