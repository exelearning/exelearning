import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
// import prettierConfig from 'eslint-config-prettier';
import globals from 'globals'; // Necesitarás instalar este paquete: npm install globals -D

export default [
  // Configuración base recomendada
  js.configs.recommended,
  // prettierConfig,
  // Configuración específica del proyecto
  {
    languageOptions: {
      globals: {
        ...globals.browser, // Agrega todos los globales del navegador
        ...globals.serviceworker // Opcional: si usas service workers
      }
    },
    plugins: {
      prettier
    },
    rules: {
      // Configuración básica de Prettier
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          trailingComma: 'es5',
          tabWidth: 4,
          useTabs: false,
          printWidth: 120,
          semi: true
        }
      ],

      // Reglas básicas de ESLint
      'indent': 'off', // Desactivamos para que lo maneje Prettier
      'quotes': ['error', 'single'],
      
      // Reglas desactivadas temporalmente
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-case-declarations': 'off',

      /* *************************************
       * REGLAS PARA ACTIVAR PROGRESIVAMENTE *
       ***************************************/
      // 'no-console': 'warn',
      // 'no-debugger': 'error',
      // 'eqeqeq': ['error', 'always'],
      // 'curly': 'error',
      // 'default-case': 'warn'
    },
    ignores: [
      'public/app/common/**',
      'public/libs/**',
      'public/files/perm/idevices/base/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/vendor/**',
      '**/tmp/**'
    ]
  }
];