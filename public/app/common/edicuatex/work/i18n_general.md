# Guía de internacionalización para eXeLearning

## Instrucciones generales para preparar archivos web para traducción en eXeLearning

### 1. Conceptos básicos

Esta guía permite preparar cualquier archivo web (HTML, JSON, JS, CSS) para que funcione con el sistema de traducción de eXeLearning. Los archivos preparados:
- Usarán inglés como idioma base
- Detectarán automáticamente el idioma cuando se ejecuten desde eXeLearning
- Funcionarán en español/catalán cuando se ejecuten de forma independiente

### 2. Proceso general para cualquier archivo

#### 2.1 Análisis inicial del archivo

Cuando recibas un archivo, primero identifica:
- **Tipo de archivo**: HTML, JSON, JS, CSS, etc.
- **Textos visibles**: Todo lo que el usuario final verá
- **Textos dinámicos**: Mensajes generados por JavaScript
- **Estructura actual**: Si ya tiene algún sistema de traducción
- **Origen de cada texto**: Anota de qué archivo proviene cada cadena

#### 2.2 Creación del archivo translations.js con mapeo de origen

Para CUALQUIER proyecto, crea un archivo `translations.js` con esta estructura mejorada:

```javascript
$i18n = {
    // Inglés - idioma base para compatibilidad con eXe
    eXe : {
        // Origen: index.html
        'Welcome to our application': 'Welcome to our application',
        'Click here to start': 'Click here to start',
        
        // Origen: main.js
        'Processing, please wait...': 'Processing, please wait...',
        'Operation completed': 'Operation completed',
        
        // Origen: config.json
        'Settings': 'Settings',
        'User preferences': 'User preferences',
    },
    
    // Español - para funcionamiento autónomo
    es : {
        // Origen: index.html
        'Welcome to our application': 'Bienvenido a nuestra aplicación',
        'Click here to start': 'Haz clic aquí para comenzar',
        
        // Origen: main.js
        'Processing, please wait...': 'Procesando, por favor espera...',
        'Operation completed': 'Operación completada',
        
        // Origen: config.json
        'Settings': 'Configuración',
        'User preferences': 'Preferencias de usuario',
    },
    
    // Catalán - para funcionamiento autónomo
    ca : {
        // Origen: index.html
        'Welcome to our application': 'Benvingut a la nostra aplicació',
        'Click here to start': 'Fes clic aquí per començar',
        
        // Origen: main.js
        'Processing, please wait...': 'Processant, si us plau espera...',
        'Operation completed': 'Operació completada',
        
        // Origen: config.json
        'Settings': 'Configuració',
        'User preferences': 'Preferències d\'usuari',
    }
}
```

**Ventajas del mapeo de origen:**
- Facilita el mantenimiento cuando el proyecto crece
- Permite localizar rápidamente dónde se usa cada texto
- Ayuda a identificar textos duplicados entre archivos
- Simplifica las actualizaciones futuras

### 3. Modificaciones específicas por tipo de archivo

#### 3.1 Archivos HTML

**Paso 1 - Cambiar el idioma base:**
```html
<!-- Cambiar de: -->
<html lang="es"> o <html lang="ca">
<!-- A: -->
<html lang="en">
```

**Paso 2 - Añadir el script de internacionalización robusto (después del `<title>`):**
```html
<script>
    // Verificación de eXeLearning y configuración inicial
    let isInExe = parent && typeof(parent.eXeLearning) == 'object' && typeof(parent.tinymce) == 'object';
    if (isInExe) {
        // Establecer el idioma del documento según eXeLearning
        document.documentElement.lang = parent.eXeLearning.app.locale.lang;
        // Usar la función de traducción de eXeLearning
        _ = parent._;
    } else {
        // Función temporal para evitar errores antes de cargar translations.js
        _ = function(str) {
            return str;
        }
    }
    // Redefinir _ después de que se cargue el DOM y translations.js esté disponible
    document.addEventListener("DOMContentLoaded", function() {
        _ = function(str){
            let res = str;
            let appLang = document.documentElement.lang;
            // Idioma por defecto (inglés)
            let translations = $i18n['eXe'];
            // Verificar si existe traducción para el idioma actual
            if (typeof $i18n[appLang] == 'object') translations = $i18n[appLang];
            // Devolver la traducción si existe
            if (typeof translations[str] == 'string') return translations[str];
            // Si estamos en eXe, intentar usar su función de traducción
            if (isInExe) return parent._(str);
            // Si no hay traducción, devolver la cadena original
            return res;
        }
    });
</script>
<script src="translations.js"></script>
```

**Paso 3 - Traducir todo el contenido estático al inglés:**
- Títulos, párrafos, botones, labels
- Atributos `title`, `placeholder`, `alt`
- Opciones de `<select>`
- Contenido de modales y alertas

**Paso 4 - Registrar cada texto traducido en translations.js con su origen**

#### 3.2 Archivos JavaScript

**Para textos en JavaScript:**

1. **Identifica todos los strings visibles al usuario:**
   ```javascript
   // Antes:
   alert('Error al cargar');
   button.textContent = 'Guardar';
   console.log('Proceso completado');
   
   // Después:
   alert(_('Error loading'));
   button.textContent = _('Save');
   console.log(_('Process completed'));
   ```

2. **Añade cada texto a translations.js con comentario de origen:**
   ```javascript
   // Origen: app.js
   'Error loading': 'Error loading',        // eXe
   'Save': 'Save',                          // eXe
   'Process completed': 'Process completed', // eXe
   ```

#### 3.3 Archivos JSON

Si dispones de instrucciones específicas sobre como actual con los JSON, síguelas.

En ausencia de otras instrucciones:

- Para internacionalizarlo, deberás preguntar al usuario qué claves deben ser traducidas o bien pedirle el achivo que llama al json para ver qué claves están identificadas mediante _(...) y traducir esas. 
- Cuando crees el archivo translations.js deberás proceder del mismo modo.

### 4. Buenas prácticas y consejos avanzados

#### 4.1 Organización del archivo translations.js

- **Agrupa las traducciones por archivo de origen** usando comentarios
- **Ordena los archivos** de forma lógica (HTML → JS → JSON)
- **Mantén el mismo orden** en todos los idiomas para facilitar la comparación

#### 4.2 Manejo de textos complejos

**Textos con variables:**
```javascript
// Evitar:
mensaje = 'Tienes ' + count + ' mensajes';

// Mejor:
mensaje = _('You have {count} messages').replace('{count}', count);
```

**Textos largos o con formato:**
```javascript
// Para textos con saltos de línea o formato especial
'Long text with\nmultiple lines': 'Texto largo con\nvarias líneas',
```

## 5. Flujo de Trabajo Avanzado con el Editor de Traducciones

Para simplificar radicalmente la edición y fusión de traducciones, se ha desarrollado una herramienta de edición visual (un archivo `.html` independiente). Esta herramienta permite gestionar el archivo `translations.js` sin necesidad de editarlo manualmente, reduciendo errores y agilizando enormemente el proceso, especialmente al incorporar nuevas traducciones.

### 5.1. Características Principales del Editor

* **Carga Visual**: Permite cargar el `translations.js` pegando su contenido o seleccionando el archivo.
* **Edición Intuitiva**: Edición de claves y valores en una tabla organizada por categorías.
* **Gestión de Categorías**: Los nombres de las categorías (`// === ... ===`) se pueden editar directamente.
* **Fusión Inteligente**: Permite incorporar nuevas traducciones desde otro archivo o un bloque de texto, añadiendo las claves a las categorías correspondientes de forma automática.

### 5.2. Formato de Snippets de la IA para Fusión

Para aprovechar la funcionalidad de fusión del editor, la IA debe proporcionar las nuevas traducciones en un formato de "snippet" autocontenido. Esto permite al usuario copiar un solo bloque de texto y pegarlo en la herramienta para una integración perfecta.

**Reglas que la IA debe seguir para generar snippets:**

1.  **Formato Completo y Autocontenido**: El snippet siempre debe ser un objeto `$i18n` completo y válido, aunque solo contenga unas pocas claves.
2.  **Incluir la Categoría (Obligatorio)**: Es **mandatorio** que el snippet incluya el comentario de la categoría (`// === NOMBRE DE LA CATEGORÍA ===`). Así es como el editor sabe dónde ubicar las nuevas traducciones. Si la categoría no existe, el editor la creará.
3.  **Incluir Todos los Idiomas**: El snippet debe contener las traducciones para todos los idiomas relevantes (`eXe`, `es`, `ca`, etc.) para asegurar la consistencia.

#### Ejemplo de Snippet Correcto

Si un usuario pide añadir traducciones para una nueva sección de "Biología", la IA no debe proporcionar solo las líneas, sino el bloque completo y listo para fusionar:

```javascript
$i18n = {
    eXe: {
        // === BIOLOGY ===
        'pH and acid-base balance': 'pH and acid-base balance',
        'Enzyme kinetics': 'Enzyme kinetics',
    },
    es: {
        // === BIOLOGY ===
        'pH and acid-base balance': 'pH y equilibrio ácido-base',
        'Enzyme kinetics': 'Cinética enzimática',
    },
    ca: {
        // === BIOLOGY ===
        'pH and acid-base balance': 'pH i equilibri àcid-base',
        'Enzyme kinetics': 'Cinètica enzimàtica',
    }
};
```

### 5. Proceso paso a paso para la IA

Cuando un usuario te envíe un archivo:

#### 5.1 Paso 1: Análisis y mapeo
```
"He recibido tu archivo [nombre]. Voy a analizarlo para identificar todos los textos que necesitan traducción y su ubicación."

Textos encontrados en [nombre_archivo]:
- "[Texto 1]" (línea X)
- "[Texto 2]" (línea Y)
- ...
```

#### 5.2 Paso 2: Creación de translations.js con origen
```
"Voy a crear el archivo translations.js organizando las traducciones por archivo de origen:"

[Muestra la estructura completa con comentarios de origen]
```

#### 5.3 Paso 3: Modificación del archivo original
```
"Ahora modificaré tu archivo [nombre] con estos cambios:"

1. Cambio de idioma base a inglés
2. Inclusión del script de traducción robusto
3. Traducción de todos los textos al inglés
4. [Otros cambios específicos]

[Muestra el archivo modificado completo]
```

### 6. Plantilla de respuesta mejorada para la IA

```markdown
## Internacionalización de [nombre_archivo]

### 1. Análisis del archivo y mapeo de textos

He identificado los siguientes elementos que necesitan traducción:

**Archivo: [nombre_archivo]**
- Línea X: "[Texto 1]"
- Línea Y: "[Texto 2]"
- ...

**Textos dinámicos encontrados:**
- Función/línea: "[Mensaje 1]"
- Función/línea: "[Mensaje 2]"
- ...

### 2. Archivo translations.js con mapeo de origen

```javascript
$i18n = {
    eXe : {
        // Origen: [nombre_archivo]
        '[English text]': '[English text]',
        // ... más traducciones
    },
    es : {
        // Origen: [nombre_archivo]
        '[English text]': '[Texto español]',
        // ... más traducciones
    },
    ca : {
        // Origen: [nombre_archivo]
        '[English text]': '[Text català]',
        // ... más traducciones
    }
}
```

### 3. Archivo [nombre] modificado

[Aquí el contenido completo del archivo modificado]

### 4. Instrucciones de implementación

1. Guarda el archivo `translations.js` en la misma carpeta que tu archivo principal
2. Reemplaza tu archivo original con la versión modificada
3. Verifica que todos los textos aparezcan correctamente

### 5. Notas de mantenimiento

- Los comentarios de origen en translations.js te ayudarán a localizar rápidamente cada texto
- Si necesitas actualizar un texto, búscalo por su origen en el archivo
- Mantén la misma estructura de comentarios al añadir nuevas traducciones

¿Necesitas que traduzca algún texto adicional o que modifique algo más?
```

### 7. Casos especiales y consideraciones

#### 7.1 Archivos con JavaScript embebido en HTML
- Trata cada sección por separado
- Asegúrate de que `_()` esté disponible antes de usarla

#### 7.2 Archivos con plantillas o templates
- Identifica si usan sistemas como Handlebars, Vue, etc.
- Adapta el método según el sistema de plantillas

#### 7.3 Mensajes con variables
```javascript
// Antes:
mensaje = 'Tienes ' + count + ' mensajes';

// Después (opción 1 - simple):
mensaje = _('You have') + ' ' + count + ' ' + _('messages');

// Después (opción 2 - recomendada):
mensaje = _('You have {count} messages').replace('{count}', count);
```

### 8. Lista de verificación final ampliada

Antes de entregar los archivos modificados, verifica:

- [ ] El archivo HTML tiene `lang="en"`
- [ ] Se incluyó el script de detección de idioma robusto
- [ ] Se incluyó la referencia a `translations.js`
- [ ] Todos los textos visibles están en inglés
- [ ] Todos los textos dinámicos usan `_()`
- [ ] El archivo `translations.js` contiene todas las traducciones
- [ ] **Las traducciones están organizadas con comentarios de origen**
- [ ] Los archivos JSON tienen sus campos en inglés
- [ ] No quedó ningún texto sin traducir
- [ ] **El script de inicialización es robusto y maneja todos los casos**

### 9. Respuestas a preguntas frecuentes

**P: ¿Qué hago si el archivo ya tiene un sistema de traducción?**
R: Analiza el sistema existente y adáptalo al formato eXeLearning, migrando las traducciones existentes.

**P: ¿Cómo manejo textos que no deben traducirse (como códigos)?**
R: Déjalos sin modificar y no los incluyas en `translations.js`.

**P: ¿Qué hago con imágenes con texto?**
R: Menciona al usuario que las imágenes con texto necesitarán versiones traducidas separadas.

**P: ¿Cómo manejo archivos CSS con contenido de texto?**
R: Los textos en CSS (como `content:`) también deben ser traducidos. Usa clases específicas por idioma o variables CSS.

**P: ¿Qué pasa si un texto aparece en múltiples archivos?**
R: Inclúyelo una sola vez en `translations.js` pero documenta todos los orígenes en el comentario.


