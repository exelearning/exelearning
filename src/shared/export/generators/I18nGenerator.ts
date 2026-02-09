/**
 * I18nGenerator
 *
 * Generates the common_i18n.js file dynamically based on project language.
 * This file is used by export runtime JavaScript (exe_export.js, common.js, etc.)
 * for translating UI elements like toggle buttons, navigation, feedback, etc.
 *
 * The translations are bundled directly in this file for browser compatibility.
 * The source strings come from translations/messages.{locale}.xlf files.
 *
 * NOTE: This file must be browser-compatible - no Node.js imports allowed.
 */

/**
 * Pre-bundled translations for all supported languages.
 * These are extracted from translations/messages.{locale}.xlf files.
 *
 * Structure: { [jsPropertyName]: { [language]: translatedString } }
 */
const TRANSLATIONS: Record<string, Record<string, string>> = {
    // Navigation
    previous: {
        en: 'Previous',
        es: 'Anterior',
        ca: 'Anterior',
        va: 'Anterior',
        gl: 'Anterior',
        eu: 'Aurrekoa',
        pt: 'Anterior',
        eo: 'Antauxe',
        ro: 'Anterior',
    },
    next: {
        en: 'Next',
        es: 'Siguiente',
        ca: 'Següent',
        va: 'Següent',
        gl: 'Seguinte',
        eu: 'Hurrengoa',
        pt: 'Próximo',
        eo: 'Sekvanta',
        ro: 'Următor',
    },
    menu: {
        en: 'Menu',
        es: 'Menú',
        ca: 'Menú',
        va: 'Menú',
        gl: 'Menú',
        eu: 'Menua',
        pt: 'Menu',
        eo: 'Menuo',
        ro: 'Meniu',
    },

    // Toggle/visibility
    show: {
        en: 'Show',
        es: 'Mostrar',
        ca: 'Mostra',
        va: 'Mostra',
        gl: 'Amosar',
        eu: 'Erakutsi',
        pt: 'Mostrar',
        eo: 'Montri',
        ro: 'Afișează',
    },
    hide: {
        en: 'Hide',
        es: 'Ocultar',
        ca: 'Amaga',
        va: 'Amaga',
        gl: 'Ocultar',
        eu: 'Ezkutatu',
        pt: 'Ocultar',
        eo: 'Kaŝi',
        ro: 'Ascunde',
    },
    toggleContent: {
        en: 'Toggle content',
        es: 'Ocultar/Mostrar contenido',
        ca: 'Commuta el contingut',
        va: 'Alternar contingut',
        gl: 'Ocultar/Amosar contido',
        eu: 'Edukia erakutsi/ezkutatu',
        pt: 'Alternar conteúdo',
        eo: 'Ŝalti enhavon',
        ro: 'Comută conținutul',
    },

    // Feedback
    showFeedback: {
        en: 'Show feedback',
        es: 'Mostrar retroalimentación',
        ca: 'Mostra la retroalimentació',
        va: 'Mostra la retroalimentació',
        gl: 'Mostrar retroalimentación',
        eu: 'Erakutsi feedbacka',
        pt: 'Mostrar feedback',
        eo: 'Montri komentaron',
        ro: 'Afișează feedback',
    },
    hideFeedback: {
        en: 'Hide feedback',
        es: 'Ocultar retroalimentación',
        ca: 'Amaga la retroalimentació',
        va: 'Amaga la retroalimentació',
        gl: 'Ocultar retroalimentación',
        eu: 'Ezkutatu feedbacka',
        pt: 'Ocultar feedback',
        eo: 'Kaŝi komentaron',
        ro: 'Ascunde feedback',
    },
    correct: {
        en: 'Correct',
        es: 'Correcto',
        ca: 'Correcte',
        va: 'Correcte',
        gl: 'Correcto',
        eu: 'Zuzena',
        pt: 'Correto',
        eo: 'Ĝuste',
        ro: 'Corect',
    },
    incorrect: {
        en: 'Incorrect',
        es: 'Incorrecto',
        ca: 'Incorrecte',
        va: 'Incorrecte',
        gl: 'Incorrecto',
        eu: 'Okerra',
        pt: 'Incorreto',
        eo: 'Malĝuste',
        ro: 'Incorect',
    },
    yourScoreIs: {
        en: 'Your score',
        es: 'Tu puntuación',
        ca: 'La teva puntuació',
        va: 'La teua puntuació',
        gl: 'A túa puntuación',
        eu: 'Zure puntuazioa',
        pt: 'Sua pontuação',
        eo: 'Via poentaro',
        ro: 'Scorul tău',
    },
    solution: {
        en: 'Solution',
        es: 'Solución',
        ca: 'Solució',
        va: 'Solució',
        gl: 'Solución',
        eu: 'Irtenbidea',
        pt: 'Solução',
        eo: 'Solvo',
        ro: 'Soluție',
    },

    // Actions
    download: {
        en: 'Download',
        es: 'Descargar',
        ca: 'Descarrega',
        va: 'Descarrega',
        gl: 'Descargar',
        eu: 'Deskargatu',
        pt: 'Baixar',
        eo: 'Elŝuti',
        ro: 'Descarcă',
    },
    print: {
        en: 'Print',
        es: 'Imprimir',
        ca: 'Imprimeix',
        va: 'Imprimeix',
        gl: 'Imprimir',
        eu: 'Inprimatu',
        pt: 'Imprimir',
        eo: 'Presi',
        ro: 'Imprimă',
    },
    search: {
        en: 'Search',
        es: 'Buscar',
        ca: 'Cerca',
        va: 'Cerca',
        gl: 'Buscar',
        eu: 'Bilatu',
        pt: 'Buscar',
        eo: 'Serĉi',
        ro: 'Caută',
    },

    // Errors and messages
    dataError: {
        en: 'Data error',
        es: 'Error de datos',
        ca: 'Error de dades',
        va: 'Error de dades',
        gl: 'Erro de datos',
        eu: 'Datu errorea',
        pt: 'Erro de dados',
        eo: 'Datenaro eraro',
        ro: 'Eroare de date',
    },
    epubJSerror: {
        en: 'This might not work in this ePub reader',
        es: 'Esto podría no funcionar en este lector ePub',
        ca: 'Això pot no funcionar en aquest lector ePub',
        va: 'Açò pot no funcionar en aquest lector ePub',
        gl: 'Isto podería non funcionar neste lector ePub',
        eu: 'Hau agian ez da ePub irakurgailu honetan funtzionatuko',
        pt: 'Isso pode não funcionar neste leitor ePub',
        eo: 'Tio eble ne funkcios en ĉi tiu ePub-legilo',
        ro: 'Aceasta ar putea să nu funcționeze în acest cititor ePub',
    },
    epubDisabled: {
        en: 'This activity does not work in ePub format',
        es: 'Esta actividad no funciona en formato ePub',
        ca: 'Aquesta activitat no funciona en format ePub',
        va: 'Aquesta activitat no funciona en format ePub',
        gl: 'Esta actividade non funciona en formato ePub',
        eu: 'Jarduera hau ez dabil ePub formatuan',
        pt: 'Esta atividade não funciona no formato ePub',
        eo: 'Ĉi tiu aktiveco ne funkcias en ePub-formato',
        ro: 'Această activitate nu funcționează în formatul ePub',
    },

    // Search
    fullSearch: {
        en: 'Full search',
        es: 'Búsqueda completa',
        ca: 'Cerca completa',
        va: 'Cerca completa',
        gl: 'Busca completa',
        eu: 'Bilaketa osoa',
        pt: 'Busca completa',
        eo: 'Plena serĉo',
        ro: 'Căutare completă',
    },
    noSearchResults: {
        en: 'No search results',
        es: 'Sin resultados de búsqueda',
        ca: 'Sense resultats de cerca',
        va: 'Sense resultats de cerca',
        gl: 'Sen resultados de busca',
        eu: 'Bilaketa emaitzarik ez',
        pt: 'Sem resultados de busca',
        eo: 'Neniuj serĉrezultoj',
        ro: 'Niciun rezultat de căutare',
    },
    searchResults: {
        en: 'Search results for',
        es: 'Resultados de búsqueda para',
        ca: 'Resultats de cerca per a',
        va: 'Resultats de cerca per a',
        gl: 'Resultados de busca para',
        eu: 'Bilaketa emaitzak honentzat',
        pt: 'Resultados de busca para',
        eo: 'Serĉrezultoj por',
        ro: 'Rezultate de căutare pentru',
    },
    hideResults: {
        en: 'Hide results',
        es: 'Ocultar resultados',
        ca: 'Amaga els resultats',
        va: 'Amaga els resultats',
        gl: 'Ocultar resultados',
        eu: 'Ezkutatu emaitzak',
        pt: 'Ocultar resultados',
        eo: 'Kaŝi rezultojn',
        ro: 'Ascunde rezultatele',
    },
    block: {
        en: 'block',
        es: 'bloque',
        ca: 'bloc',
        va: 'bloc',
        gl: 'bloque',
        eu: 'blokea',
        pt: 'bloco',
        eo: 'bloko',
        ro: 'bloc',
    },

    // UI elements
    more: {
        en: 'More',
        es: 'Más',
        ca: 'Més',
        va: 'Més',
        gl: 'Máis',
        eu: 'Gehiago',
        pt: 'Mais',
        eo: 'Pli',
        ro: 'Mai mult',
    },
    newWindow: {
        en: 'New window',
        es: 'Nueva ventana',
        ca: 'Nova finestra',
        va: 'Nova finestra',
        gl: 'Nova xanela',
        eu: 'Leiho berria',
        pt: 'Nova janela',
        eo: 'Nova fenestro',
        ro: 'Fereastră nouă',
    },
    fullSize: {
        en: 'Full size',
        es: 'Tamaño completo',
        ca: 'Mida completa',
        va: 'Mida completa',
        gl: 'Tamaño completo',
        eu: 'Tamaina osoa',
        pt: 'Tamanho completo',
        eo: 'Plena grandeco',
        ro: 'Dimensiune completă',
    },

    // Accessibility toolbar
    accessibility_tools: {
        en: 'Accessibility tools',
        es: 'Herramientas de accesibilidad',
        ca: "Eines d'accessibilitat",
        va: "Eines d'accessibilitat",
        gl: 'Ferramentas de accesibilidade',
        eu: 'Irisgarritasun tresnak',
        pt: 'Ferramentas de acessibilidade',
        eo: 'Alireblecaj iloj',
        ro: 'Instrumente de accesibilitate',
    },
    close_toolbar: {
        en: 'Close',
        es: 'Cerrar',
        ca: 'Tanca',
        va: 'Tanca',
        gl: 'Pechar',
        eu: 'Itxi',
        pt: 'Fechar',
        eo: 'Fermi',
        ro: 'Închide',
    },
    default_font: {
        en: 'Default font',
        es: 'Fuente predeterminada',
        ca: 'Lletra predeterminada',
        va: 'Lletra predeterminada',
        gl: 'Fonte predeterminada',
        eu: 'Letra lehenetsia',
        pt: 'Fonte padrão',
        eo: 'Defaŭlta tiparo',
        ro: 'Font implicit',
    },
    increase_text_size: {
        en: 'Increase text size',
        es: 'Aumentar tamaño del texto',
        ca: 'Augmenta la mida del text',
        va: 'Augmenta la mida del text',
        gl: 'Aumentar tamaño do texto',
        eu: 'Handitu testuaren tamaina',
        pt: 'Aumentar tamanho do texto',
        eo: 'Pligrandigi tekston',
        ro: 'Mărește dimensiunea textului',
    },
    decrease_text_size: {
        en: 'Decrease text size',
        es: 'Disminuir tamaño del texto',
        ca: 'Redueix la mida del text',
        va: 'Redueix la mida del text',
        gl: 'Diminuír tamaño do texto',
        eu: 'Txikitu testuaren tamaina',
        pt: 'Diminuir tamanho do texto',
        eo: 'Malpligrandigi tekston',
        ro: 'Micșorează dimensiunea textului',
    },
    read: {
        en: 'Read',
        es: 'Leer',
        ca: 'Llegeix',
        va: 'Llig',
        gl: 'Ler',
        eu: 'Irakurri',
        pt: 'Ler',
        eo: 'Legi',
        ro: 'Citește',
    },
    stop_reading: {
        en: 'Stop reading',
        es: 'Detener lectura',
        ca: 'Atura la lectura',
        va: 'Atura la lectura',
        gl: 'Deter lectura',
        eu: 'Gelditu irakurketa',
        pt: 'Parar leitura',
        eo: 'Ĉesi legadon',
        ro: 'Oprește citirea',
    },
    translate: {
        en: 'Translate',
        es: 'Traducir',
        ca: 'Tradueix',
        va: 'Tradueix',
        gl: 'Traducir',
        eu: 'Itzuli',
        pt: 'Traduzir',
        eo: 'Traduki',
        ro: 'Traduce',
    },
    drag_and_drop: {
        en: 'Drag and drop',
        es: 'Arrastrar y soltar',
        ca: 'Arrossega i deixa anar',
        va: 'Arrossega i deixa anar',
        gl: 'Arrastrar e soltar',
        eu: 'Arrastatu eta jaregin',
        pt: 'Arrastar e soltar',
        eo: 'Treni kaj faligi',
        ro: 'Trage și plasează',
    },
    reset: {
        en: 'Reset',
        es: 'Restablecer',
        ca: 'Restableix',
        va: 'Restableix',
        gl: 'Restablecer',
        eu: 'Berrezarri',
        pt: 'Reiniciar',
        eo: 'Restarigi',
        ro: 'Resetează',
    },
    mode_toggler: {
        en: 'Light/Dark mode',
        es: 'Modo claro/oscuro',
        ca: 'Mode clar/fosc',
        va: 'Mode clar/fosc',
        gl: 'Modo claro/escuro',
        eu: 'Modu argia/iluna',
        pt: 'Modo claro/escuro',
        eo: 'Hela/Malhela reĝimo',
        ro: 'Mod luminos/întunecat',
    },
    teacher_mode: {
        en: 'Teacher mode',
        es: 'Modo profesor',
        ca: 'Mode professor',
        va: 'Mode professor',
        gl: 'Modo profesor',
        eu: 'Irakasle modua',
        pt: 'Modo professor',
        eo: 'Instruista reĝimo',
        ro: 'Mod profesor',
    },

    // ELPX download
    elpxGenerating: {
        en: 'Generating...',
        es: 'Generando...',
        ca: 'Generant...',
        eu: 'Sortzen...',
        gl: 'Xerando...',
        fr: 'Génération...',
        de: 'Erstellen...',
        it: 'Generazione...',
        pt: 'Gerando...',
    },
    elpxFolderPickerTimeout: {
        en: 'The folder picker did not respond. This may happen when opening exported files directly from the filesystem (file:// protocol). Try opening the file through a local web server instead.',
        es: 'El selector de carpetas no respondió. Esto puede ocurrir al abrir archivos exportados directamente desde el sistema de archivos (protocolo file://). Intente abrir el archivo a través de un servidor web local.',
        ca: "El selector de carpetes no va respondre. Això pot passar en obrir fitxers exportats directament des del sistema de fitxers (protocol file://). Proveu d'obrir el fitxer a través d'un servidor web local.",
        eu: 'Karpeta-hautatzaileak ez du erantzun. Hori gerta daiteke esportatutako fitxategiak fitxategi-sistematik zuzenean irekitzean (file:// protokoloa). Saiatu fitxategia web zerbitzari lokal baten bidez irekitzen.',
        gl: 'O selector de cartafoles non respondeu. Isto pode ocorrer ao abrir ficheiros exportados directamente desde o sistema de ficheiros (protocolo file://). Intente abrir o ficheiro a través dun servidor web local.',
        fr: "Le sélecteur de dossier n'a pas répondu. Cela peut se produire lors de l'ouverture de fichiers exportés directement depuis le système de fichiers (protocole file://). Essayez d'ouvrir le fichier via un serveur web local.",
        de: 'Die Ordnerauswahl hat nicht reagiert. Dies kann auftreten, wenn exportierte Dateien direkt aus dem Dateisystem geöffnet werden (file://-Protokoll). Versuchen Sie, die Datei über einen lokalen Webserver zu öffnen.',
        it: 'Il selettore cartelle non ha risposto. Questo può accadere quando si aprono file esportati direttamente dal file system (protocollo file://). Provare ad aprire il file tramite un server web locale.',
        pt: 'O seletor de pastas não respondeu. Isso pode acontecer ao abrir arquivos exportados diretamente do sistema de arquivos (protocolo file://). Tente abrir o arquivo através de um servidor web local.',
    },
    elpxFolderPickerEmpty: {
        en: 'No files were returned by the folder picker. This is a known limitation when opening exported files with the file:// protocol in some browsers. Try using a different browser or opening the file through a local web server.',
        es: 'El selector de carpetas no devolvió archivos. Esta es una limitación conocida al abrir archivos exportados con el protocolo file:// en algunos navegadores. Intente usar un navegador diferente o abrir el archivo a través de un servidor web local.',
        ca: "El selector de carpetes no va retornar fitxers. Aquesta és una limitació coneguda en obrir fitxers exportats amb el protocol file:// en alguns navegadors. Proveu d'usar un navegador diferent o d'obrir el fitxer a través d'un servidor web local.",
        eu: 'Karpeta-hautatzaileak ez du fitxategirik itzuli. Hau muga ezaguna da fitxategi esportatuak file:// protokoloarekin nabigatzaile batzuetan irekitzean. Saiatu beste nabigatzaile bat erabiltzen edo fitxategia web zerbitzari lokal baten bidez irekitzen.',
        gl: 'O selector de cartafoles non devolveu ficheiros. Esta é unha limitación coñecida ao abrir ficheiros exportados co protocolo file:// nalgúns navegadores. Intente usar un navegador diferente ou abrir o ficheiro a través dun servidor web local.',
        fr: "Le sélecteur de dossier n'a renvoyé aucun fichier. C'est une limitation connue lors de l'ouverture de fichiers exportés avec le protocole file:// dans certains navigateurs. Essayez d'utiliser un autre navigateur ou d'ouvrir le fichier via un serveur web local.",
        de: 'Die Ordnerauswahl hat keine Dateien zurückgegeben. Dies ist eine bekannte Einschränkung beim Öffnen exportierter Dateien mit dem file://-Protokoll in einigen Browsern. Versuchen Sie, einen anderen Browser zu verwenden oder die Datei über einen lokalen Webserver zu öffnen.',
        it: 'Il selettore cartelle non ha restituito file. Questa è una limitazione nota quando si aprono file esportati con il protocollo file:// in alcuni browser. Provare a utilizzare un browser diverso o ad aprire il file tramite un server web locale.',
        pt: 'O seletor de pastas não retornou arquivos. Esta é uma limitação conhecida ao abrir arquivos exportados com o protocolo file:// em alguns navegadores. Tente usar um navegador diferente ou abrir o arquivo através de um servidor web local.',
    },
    elpxFileProtocolWarning: {
        en: 'Local mode: Due to browser security policy, you will need to select the folder from which you opened this file. On a web server this will not be necessary.',
        es: 'Modo local: Por política de seguridad del navegador, deberá seleccionar la carpeta desde donde abrió este fichero. En un servidor web esto no será necesario.',
        ca: "Mode local: Per política de seguretat del navegador, haurà de seleccionar la carpeta des d'on va obrir aquest fitxer. En un servidor web això no serà necessari.",
        eu: 'Modu lokala: Nabigatzailearen segurtasun-politikaren ondorioz, fitxategi hau ireki zenuen karpeta hautatu beharko duzu. Web zerbitzari batean hori ez da beharrezkoa izango.',
        gl: 'Modo local: Por política de seguridade do navegador, deberá seleccionar o cartafol desde onde abriu este ficheiro. Nun servidor web isto non será necesario.',
        fr: 'Mode local : En raison de la politique de sécurité du navigateur, vous devrez sélectionner le dossier à partir duquel vous avez ouvert ce fichier. Sur un serveur web, cela ne sera pas nécessaire.',
        de: 'Lokaler Modus: Aufgrund der Sicherheitsrichtlinie des Browsers müssen Sie den Ordner auswählen, aus dem Sie diese Datei geöffnet haben. Auf einem Webserver ist dies nicht erforderlich.',
        it: 'Modalità locale: A causa della politica di sicurezza del browser, dovrai selezionare la cartella da cui hai aperto questo file. Su un server web ciò non sarà necessario.',
        pt: 'Modo local: Devido à política de segurança do navegador, você precisará selecionar a pasta de onde abriu este arquivo. Em um servidor web isso não será necessário.',
    },
};

/**
 * Game-specific translations for hangman and other games.
 * These are stored in $exe_i18n.exeGames object.
 */
const GAME_TRANSLATIONS: Record<string, Record<string, string>> = {
    hangManGame: {
        en: 'Hangman game',
        es: 'Juego del ahorcado',
        ca: 'Joc del penjat',
        va: 'Joc del penjat',
        gl: 'Xogo do aforcado',
        eu: 'Urkamenduaren jokoa',
        pt: 'Jogo da forca',
        eo: 'Pendumita ludo',
        ro: 'Jocul spânzurătoarea',
    },
    accept: {
        en: 'Accept',
        es: 'Aceptar',
        ca: 'Accepta',
        va: 'Accepta',
        gl: 'Aceptar',
        eu: 'Onartu',
        pt: 'Aceitar',
        eo: 'Akcepti',
        ro: 'Acceptă',
    },
    yes: {
        en: 'Yes',
        es: 'Sí',
        ca: 'Sí',
        va: 'Sí',
        gl: 'Si',
        eu: 'Bai',
        pt: 'Sim',
        eo: 'Jes',
        ro: 'Da',
    },
    no: {
        en: 'No',
        es: 'No',
        ca: 'No',
        va: 'No',
        gl: 'Non',
        eu: 'Ez',
        pt: 'Não',
        eo: 'Ne',
        ro: 'Nu',
    },
    right: {
        en: 'Right',
        es: 'Correcto',
        ca: 'Correcte',
        va: 'Correcte',
        gl: 'Correcto',
        eu: 'Zuzena',
        pt: 'Correto',
        eo: 'Ĝuste',
        ro: 'Corect',
    },
    wrong: {
        en: 'Wrong',
        es: 'Incorrecto',
        ca: 'Incorrecte',
        va: 'Incorrecte',
        gl: 'Incorrecto',
        eu: 'Okerra',
        pt: 'Incorreto',
        eo: 'Malĝuste',
        ro: 'Greșit',
    },
    rightAnswer: {
        en: 'Right answer',
        es: 'Respuesta correcta',
        ca: 'Resposta correcta',
        va: 'Resposta correcta',
        gl: 'Resposta correcta',
        eu: 'Erantzun zuzena',
        pt: 'Resposta correta',
        eo: 'Ĝusta respondo',
        ro: 'Răspuns corect',
    },
    stat: {
        en: 'Status',
        es: 'Estado',
        ca: 'Estat',
        va: 'Estat',
        gl: 'Estado',
        eu: 'Egoera',
        pt: 'Estado',
        eo: 'Stato',
        ro: 'Stare',
    },
    selectedLetters: {
        en: 'Selected letters',
        es: 'Letras seleccionadas',
        ca: 'Lletres seleccionades',
        va: 'Lletres seleccionades',
        gl: 'Letras seleccionadas',
        eu: 'Hautatutako hizkiak',
        pt: 'Letras selecionadas',
        eo: 'Elektitaj literoj',
        ro: 'Litere selectate',
    },
    word: {
        en: 'Word',
        es: 'Palabra',
        ca: 'Paraula',
        va: 'Paraula',
        gl: 'Palabra',
        eu: 'Hitza',
        pt: 'Palavra',
        eo: 'Vorto',
        ro: 'Cuvânt',
    },
    words: {
        en: 'Words',
        es: 'Palabras',
        ca: 'Paraules',
        va: 'Paraules',
        gl: 'Palabras',
        eu: 'Hitzak',
        pt: 'Palavras',
        eo: 'Vortoj',
        ro: 'Cuvinte',
    },
    play: {
        en: 'Play',
        es: 'Jugar',
        ca: 'Juga',
        va: 'Juga',
        gl: 'Xogar',
        eu: 'Jolastu',
        pt: 'Jogar',
        eo: 'Ludi',
        ro: 'Joacă',
    },
    playAgain: {
        en: 'Restart',
        es: 'Reiniciar',
        ca: 'Reinicia',
        va: 'Reinicia',
        gl: 'Reiniciar',
        eu: 'Berrabiarazi',
        pt: 'Reiniciar',
        eo: 'Reludi',
        ro: 'Repornește',
    },
    results: {
        en: 'Results',
        es: 'Resultados',
        ca: 'Resultats',
        va: 'Resultats',
        gl: 'Resultados',
        eu: 'Emaitzak',
        pt: 'Resultados',
        eo: 'Rezultoj',
        ro: 'Rezultate',
    },
    total: {
        en: 'Total',
        es: 'Total',
        ca: 'Total',
        va: 'Total',
        gl: 'Total',
        eu: 'Guztira',
        pt: 'Total',
        eo: 'Sumo',
        ro: 'Total',
    },
    otherWord: {
        en: 'Other word',
        es: 'Otra palabra',
        ca: 'Altra paraula',
        va: 'Altra paraula',
        gl: 'Outra palabra',
        eu: 'Beste hitza',
        pt: 'Outra palavra',
        eo: 'Alia vorto',
        ro: 'Alt cuvânt',
    },
    gameOver: {
        en: 'Game over',
        es: 'Fin del juego',
        ca: 'Fi del joc',
        va: 'Fi del joc',
        gl: 'Fin do xogo',
        eu: 'Jokoa amaitu da',
        pt: 'Fim de jogo',
        eo: 'Ludo finita',
        ro: 'Jocul s-a terminat',
    },
    confirmReload: {
        en: 'Reload game?',
        es: '¿Recargar el juego?',
        ca: 'Recarregar el joc?',
        va: 'Recarregar el joc?',
        gl: 'Recargar o xogo?',
        eu: 'Jokoa birkargatu?',
        pt: 'Recarregar o jogo?',
        eo: 'Reŝarĝi la ludon?',
        ro: 'Reîncarcă jocul?',
    },
    clickOnPlay: {
        en: 'Click Play to start',
        es: 'Haz clic en Jugar para empezar',
        ca: 'Fes clic a Juga per començar',
        va: 'Fes clic a Juga per a començar',
        gl: 'Fai clic en Xogar para comezar',
        eu: 'Sakatu Jolastu hasteko',
        pt: 'Clique em Jogar para começar',
        eo: 'Klaku Ludi por komenci',
        ro: 'Apasă pe Joacă pentru a începe',
    },
    clickOnOtherWord: {
        en: 'Click Other word to continue',
        es: 'Haz clic en Otra palabra para continuar',
        ca: 'Fes clic a Altra paraula per continuar',
        va: 'Fes clic a Altra paraula per a continuar',
        gl: 'Fai clic en Outra palabra para continuar',
        eu: 'Sakatu Beste hitza jarraitzeko',
        pt: 'Clique em Outra palavra para continuar',
        eo: 'Klaku Alia vorto por daŭrigi',
        ro: 'Apasă pe Alt cuvânt pentru a continua',
    },
};

/**
 * Alphabet for hangman game by language.
 * This is used to display the available letters for the game.
 */
const GAME_ALPHABETS: Record<string, string> = {
    es: 'abcdefghijklmnñopqrstuvwxyz',
    ca: 'abcdefghijklmnopqrstuvwxyz',
    va: 'abcdefghijklmnopqrstuvwxyz',
    gl: 'abcdefghijklmnñopqrstuvwxyz',
    eu: 'abcdefghijklmnopqrstuvwxyz',
    pt: 'abcdefghijklmnopqrstuvwxyz',
    eo: 'abcĉdefgĝhĥijĵklmnoprsŝtuŭvz',
    ro: 'aăâbcdefghiîjklmnopqrsștțuvwxyz',
    en: 'abcdefghijklmnopqrstuvwxyz',
};

/**
 * Get translation for a key in a specific language.
 * Falls back to English if the language is not available.
 */
function getTranslation(translations: Record<string, Record<string, string>>, key: string, language: string): string {
    const langTranslations = translations[key];
    if (!langTranslations) {
        return key;
    }
    return langTranslations[language] || langTranslations.en || key;
}

/**
 * Build a flat translation object for a specific language from a translation dictionary.
 */
function buildTranslationsForLanguage(
    translations: Record<string, Record<string, string>>,
    language: string,
): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of Object.keys(translations)) {
        result[key] = getTranslation(translations, key, language);
    }
    return result;
}

/**
 * Generate the common_i18n.js content for a specific language.
 *
 * @param language - The target language code (e.g., 'es', 'en', 'ca')
 * @returns The JavaScript content as a string
 */
export function generateI18nScript(language: string): string {
    const mainTranslations = buildTranslationsForLanguage(TRANSLATIONS, language);
    let script = `$exe_i18n=${JSON.stringify(mainTranslations)};`;

    const gameTranslations = buildTranslationsForLanguage(GAME_TRANSLATIONS, language);
    gameTranslations.az = GAME_ALPHABETS[language] || GAME_ALPHABETS.en;
    script += `\n$exe_i18n.exeGames=${JSON.stringify(gameTranslations)};`;

    script += `\n\n// Export for Node.js/CommonJS (tests)\nif (typeof module !== 'undefined' && module.exports) {\n    module.exports = $exe_i18n;\n}`;

    return script;
}

/**
 * Get a single i18n key translation for a language.
 * Useful for getting individual translations without generating the full script.
 *
 * @param key - The JavaScript property name (e.g., 'toggleContent')
 * @param language - The target language code (e.g., 'es', 'en', 'ca')
 * @returns The translated string
 */
export function getI18nTranslation(key: string, language: string): string {
    return getTranslation(TRANSLATIONS, key, language);
}
