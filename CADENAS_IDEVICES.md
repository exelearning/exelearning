# Cadenas de texto utilizadas en iDevices de eXeLearning

Este documento resume las cadenas de texto más comunes utilizadas en diferentes iDevices para retroalimentación, sugerencias y mensajes al usuario.

## 1. SUGERENCIAS / PISTAS / AYUDAS

### Form iDevice (actual)
```javascript
msgSuggestion: 'Sugerencia'
```

### Otros iDevices
```javascript
// Guess, Trivial, Discover, Mathematical Operations, etc.
msgClue: c_('Cool! The clue is:')         // "¡Genial! La pista es:"
msgHint: c_('Hint')                        // "Pista"

// Challenge
msgClue: _('Help')                         // "Ayuda"

// Identify
msgClue: c_('Hint')                        // "Pista"
```

### Términos comunes en español:
- **Sugerencia** - Actualmente usado en Form
- **Pista** - Usado en la mayoría de iDevices de juegos
- **Ayuda** - Usado en Challenge
- **Consejo** - Alternativa no usada actualmente

### Términos en inglés:
- **Suggestion** - Form
- **Clue** - Guess, Trivial, Discover, etc.
- **Hint** - Identify
- **Help** - Challenge
- **Tip** - No usado actualmente


## 2. RETROALIMENTACIÓN POSITIVA (RESPUESTA CORRECTA)

### Form iDevice (actual)
```javascript
msgOk: 'Correcto'
feedbackRight: // HTML personalizado por pregunta
```

### Otros iDevices - Términos únicos
```javascript
msgCorrect: c_('Correct')                  // "Correcto"
msgSuccesses: c_('Right! | Excellent! | Great! | Very good! | Perfect!')
              // "¡Bien! | ¡Excelente! | ¡Genial! | ¡Muy bien! | ¡Perfecto!"
msgCool: c_('Cool!')                       // "¡Genial!"
```

### Términos comunes en español:
- **Correcto** - Más formal, usado en Form y otros
- **¡Bien!** - Casual, usado en varios juegos
- **¡Excelente!** - Entusiasta
- **¡Genial!** - Muy positivo
- **¡Muy bien!** - Moderadamente positivo
- **¡Perfecto!** - Máximo nivel

### Términos en inglés:
- **Correct** - Formal
- **Right** - Casual
- **Excellent** - Entusiasta
- **Great** - Muy positivo
- **Very good** - Moderadamente positivo
- **Perfect** - Máximo nivel
- **Cool** - Muy casual


## 3. RETROALIMENTACIÓN NEGATIVA (RESPUESTA INCORRECTA)

### Form iDevice (actual)
```javascript
msgKO: 'Incorrecto'
feedbackWrong: // HTML personalizado por pregunta
```

### Otros iDevices - Términos únicos
```javascript
msgIncorrect: c_('Incorrect')              // "Incorrecto"
msgFailures: c_('It was not that! | Incorrect! | Not correct! | Sorry! | Error!')
             // "¡No era eso! | ¡Incorrecto! | ¡No es correcto! | ¡Lo siento! | ¡Error!"
msgErrors: c_('Errors')                    // "Errores"
```

### Términos comunes en español:
- **Incorrecto** - Formal y directo, usado actualmente
- **¡No era eso!** - Suave y educativo
- **¡No es correcto!** - Formal pero menos directo
- **¡Lo siento!** - Empático
- **¡Error!** - Directo pero puede ser duro
- **Erróneo** - Muy formal, poco usado

### Términos en inglés:
- **Incorrect** - Formal y directo
- **It was not that** - Suave y educativo
- **Not correct** - Formal pero menos directo
- **Sorry** - Empático
- **Error** - Directo
- **Wrong** - Informal y directo


## 4. OTROS MENSAJES RELACIONADOS

### Actividad completa
```javascript
// Guess, Trivial, etc.
msgActityComply: c_('You have already done this activity.')
// "Ya has realizado esta actividad."

msgUncompletedActivity: c_('Incomplete activity')
// "Actividad incompleta"

msgSuccessfulActivity: c_('Activity: Passed. Score: %s')
// "Actividad: Superada. Puntuación: %s"

msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s')
// "Actividad: No superada. Puntuación: %s"
```

### Intentar de nuevo
```javascript
msgTryAgain: c_('You need at least %s% of correct answers to get the information. Please try again.')
// "Necesitas al menos un %s% de respuestas correctas para obtener la información. Inténtalo de nuevo."

msgPlayAgain: c_('Play Again')
// "Jugar de nuevo"
```

### Puntuación
```javascript
msgScore: c_('Score')                      // "Puntuación"
msgYouScore: c_('Your score')              // "Tu puntuación"
msgYouLastScore: c_('The last score saved is')  // "La última puntuación guardada es"
msgPoints: c_('points')                    // "puntos"
```


## 5. RECOMENDACIONES PARA FORM IDEVICE

### Mantener consistencia
Las cadenas actuales del Form iDevice están bien elegidas:

1. **msgSuggestion: 'Sugerencia'** - Es un término neutral y educativo
   - Alternativas: "Pista", "Ayuda", "Consejo"
   - Recomendación: **Mantener "Sugerencia"** (es más formal que "pista" y más educativo que "ayuda")

2. **msgOk: 'Correcto'** - Es formal y claro
   - Alternativas: "¡Bien!", "¡Excelente!", "¡Perfecto!"
   - Recomendación: **Mantener "Correcto"** para consistencia, pero considerar variantes aleatorias para hacer más dinámico

3. **msgKO: 'Incorrecto'** - Es formal pero puede ser percibido como duro
   - Alternativas: "¡No era eso!", "¡No es correcto!", "Inténtalo de nuevo"
   - Recomendación: **Considerar "No es correcto"** o "Inténtalo de nuevo" para ser más suave

### Implementación con variantes (opcional)
```javascript
// Retroalimentación positiva variada (similar a Guess/Trivial)
msgSuccesses: 'Correcto|¡Bien!|¡Excelente!|¡Muy bien!|¡Perfecto!'

// Retroalimentación negativa variada y suave
msgFailures: 'No es correcto|Inténtalo de nuevo|No era eso|Revisa tu respuesta'
```

### Traducciones actuales
```javascript
msgs: {
    msgSuggestion: 'Sugerencia',           // EN: 'Suggestion'
    msgOk: 'Correcto',                     // EN: 'Correct'
    msgKO: 'Incorrecto',                   // EN: 'Incorrect'
}
```


## 6. RESUMEN DE CAMPOS EN FORM IDEVICE

### Por pregunta (questionsData)
```javascript
{
    baseText: "Texto de la pregunta...",
    suggestion: "Texto HTML de sugerencia",      // ← Campo para sugerencia
    feedbackRight: "Texto HTML retroalimentación positiva",   // ← Retroalimentación correcta
    feedbackWrong: "Texto HTML retroalimentación negativa",   // ← Retroalimentación incorrecta
    // ... otros campos según tipo de pregunta
}
```

### Mensajes globales (msgs)
```javascript
msgs: {
    msgSuggestion: 'Sugerencia',        // Texto del botón/enlace
    msgOk: 'Correcto',                  // Retroalimentación por defecto si feedbackRight está vacío
    msgKO: 'Incorrecto',                // Retroalimentación por defecto si feedbackWrong está vacío
    // ... otros mensajes
}
```


## 7. CAMPOS HTML VS CADENAS DE TEXTO

### En Form iDevice:
- **suggestion**: Campo HTML personalizable (como baseText)
- **feedbackRight**: Campo HTML personalizable
- **feedbackWrong**: Campo HTML personalizable
- **msgSuggestion**: Cadena de texto para el botón/icono
- **msgOk/msgKO**: Cadenas de texto usadas como fallback

### En otros iDevices:
- Algunos usan solo texto plano para pistas
- Otros permiten HTML completo
- Form es más flexible al permitir HTML en todos estos campos


## 8. CONCLUSIÓN

El Form iDevice ya utiliza una terminología apropiada y consistente:
- **"Sugerencia"** es educativo y neutral
- **"Correcto"** / **"Incorrecto"** son claros y directos
- Los campos HTML personalizables ofrecen máxima flexibilidad

**Recomendación**: Mantener las cadenas actuales. Son apropiadas para un contexto educativo formal.
