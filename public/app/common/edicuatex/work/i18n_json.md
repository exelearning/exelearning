### **Instrucciones para la IA: Internacionalización de Archivos JSON para EdiCuaTeX**

Tu tarea es analizar un archivo JSON de menú para la aplicación EdiCuaTeX e internacionalizar su contenido. Para ello, debes generar un `snippet` de código para el archivo `translations.js`.

#### 1\. Objetivo Principal

Al recibir un fragmento o un archivo JSON completo, debes identificar todos los valores de texto que son visibles para el usuario y generar las entradas correspondientes en un objeto `$i18n` para los idiomas `eXe` (inglés), `es` (español) y `ca` (catalán).

#### 2\. Análisis de Claves del JSON

El sistema lee múltiples claves, pero solo los valores de cuatro (4) de ellas deben ser traducidos.

##### **A. Claves a Traducir:**

Estas son las únicas claves cuyos valores debes procesar para la traducción:

1.  **`nombre`**:

      * **Propósito**: Es el nombre de la categoría que se muestra en las pestañas (ej: "Operators", "Arrows").
      * **Tratamiento**: Su valor de texto se traduce directamente.

2.  **`title`**:

      * **Propósito**: Es la descripción emergente (tooltip) que aparece al pasar el ratón sobre un botón (ej: "Fraction with numerator and denominator").
      * **Tratamiento**: Su valor de texto se traduce directamente.

3.  **`display`**:

      * **Propósito**: Es el código LaTeX que se muestra *visualmente* en el botón.
      * **Tratamiento**: **Solo se traduce si contiene texto legible dentro de un comando LaTeX como `\text{...}`**. La cadena completa en inglés (ej: `\text{the sky is blue}`) se usa como clave de traducción.

4.  **`latex`**:

      * **Propósito**: Es el código LaTeX que se inserta. Actúa como alternativa si `display` está vacío.
      * **Tratamiento**: Se trata exactamente igual que `display`. Se traduce solo si contiene texto legible (ej: `\text{...}`).

##### **B. Claves que NO se deben traducir:**

Ignora los valores de las siguientes claves. Son para la estructura, identificación o configuración del programa y deben permanecer intactos:

  * `id`
  * `type`
  * `categorias`
  * `elementos`
  * `grid_template_columns`

#### 3\. Proceso de Generación del Snippet

Sigue estos pasos para crear el `snippet` de `translations.js`:

1.  **Escanear el JSON**: Lee el archivo JSON de entrada e identifica todos los valores asociados a las cuatro claves traducibles (`nombre`, `title`, `display`, `latex`).

2.  **Usar Inglés como Clave**: El valor original en inglés de cada campo se convertirá en la **clave** dentro de los objetos de traducción.

3.  **Generar el Objeto `$i18n`**: Construye la respuesta usando la siguiente estructura. Asegúrate de incluir los tres idiomas y los comentarios de categoría para mantener la organización, tal como se especifica en la guía de internacionalización.

#### 4\. Ejemplo Completo

**Si recibes este `elemento` JSON de entrada:**

```json
{
    "id": "geometria_basica",
    "nombre": "Geometry",
    "elementos": [
        {
          "latex": "\\text{Area} = \\pi r^2",
          "display": "\\text{Area} = \\pi r^2",
          "title": "Area of a circle"
        }
    ]
}
```

**Tu `snippet` de salida para `translations.js` debe ser:**

```javascript
$i18n = {
    eXe: {
        // === GEOMETRY ===
        'Geometry': 'Geometry',
        'Area of a circle': 'Area of a circle',
        '\\text{Area} = \\pi r^2': '\\text{Area} = \\pi r^2'
    },
    es: {
        // === GEOMETRY ===
        'Geometry': 'Geometría',
        'Area of a circle': 'Área de un círculo',
        '\\text{Area} = \\pi r^2': '\\text{Área} = \\pi r^2'
    },
    ca: {
        // === GEOMETRY ===
        'Geometry': 'Geometria',
        'Area of a circle': 'Àrea d\'un cercle',
        '\\text{Area} = \\pi r^2': '\\text{Àrea} = \\pi r^2'
    }
};
```

#### 5\. Reglas Fundamentales

  * **Regla 1**: Los comandos de LaTeX como `\frac`, `\int`, `\sqrt` nunca se traducen. Solo se traduce el texto natural dentro de comandos como `\text{}`.
  * **Regla 2**: La clave en el objeto de traducción es siempre la cadena **completa y exacta** del valor en inglés.
  * **Regla 3**: Mantén siempre la estructura `$i18n` con los objetos `eXe`, `es`, y `ca`.
