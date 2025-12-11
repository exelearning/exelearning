import { Injectable } from '@nestjs/common';
import { TranslationService } from './translation.service';

/**
 * Service to generate common_i18n.js content for exports
 * Replicates Commoni18nUtil from Symfony
 */
@Injectable()
export class CommonI18nService {
    constructor(private readonly translationService: TranslationService) {}

    /**
     * Get common UI strings for frontend
     */
    getCommonStrings(locale: string): Record<string, string> {
        const t = (key: string) => this.translationService.trans(key, {}, null, locale);

        return {
            previous: t('Previous'),
            next: t('Next'),
            show: t('Show'),
            hide: t('Hide'),
            showFeedback: t('Show feedback'),
            hideFeedback: t('Hide feedback'),
            correct: t('Correct'),
            incorrect: t('Incorrect'),
            menu: t('Menu'),
            download: t('Download'),
            yourScoreIs: t('Your score is'),
            dataError: t('Error retrieving data'),
            epubJSerror: t("This might not work in this ePub reader."),
            epubDisabled: t('This activity does not work in ePub format.'),
            solution: t('Solution'),
            print: t('Print'),
            fullSearch: t('Search all pages'),
            noSearchResults: t('No results found for %'),
            searchResults: t('Search results for %'),
            hideResults: t('Hide results'),
            more: t('More'),
            newWindow: t('New window'),
            fullSize: t('Full size'),
            search: t('Search'),
            accessibility_tools: t('Accessibility tools'),
            close_toolbar: t('Close'),
            default_font: t('Default typography'),
            increase_text_size: t('Increase text size'),
            decrease_text_size: t('Decrease text size'),
            read: t('Read'),
            stop_reading: t('Stop reading'),
            translate: t('Translate'),
            drag_and_drop: t('Drag and drop'),
            reset: t('Reset'),
            mode_toggler: t('Light/dark mode'),
            teacher_mode: t('Teacher mode'),
        };
    }

    /**
     * Get game-related strings for frontend
     */
    getGamesStrings(locale: string): Record<string, string> {
        const t = (key: string) => this.translationService.trans(key, {}, null, locale);

        return {
            hangManGame: t('Hangman Game'),
            accept: t('Accept'),
            yes: t('Yes'),
            no: t('No'),
            right: t('Correct'),
            wrong: t('Incorrect'),
            rightAnswer: t('Correct answer'),
            stat: t('Stat'),
            selectedLetters: t('Selected letters'),
            word: t('Word'),
            words: t('Words'),
            play: t('Play'),
            playAgain: t('Play again'),
            results: t('Results'),
            total: t('Total'),
            otherWord: t('Other word'),
            gameOver: t('Game Over'),
            confirmReload: t('Reload the game?'),
            clickOnPlay: t('Click "Play" to start a new game.'),
            clickOnOtherWord: t('Click "Another word" to continue.'),
            az: t('abcdefghijklmnopqrstuvwxyz'),
        };
    }

    /**
     * Generate the complete common_i18n.js file content
     */
    generateCommonI18nJs(locale: string): string {
        const common = this.getCommonStrings(locale);
        const games = this.getGamesStrings(locale);

        // Escape strings for JavaScript
        const escapeJs = (str: string) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

        let js = '// The content of this file is dynamically generated in the language of the elp.\n';

        // Build $exe_i18n object
        const commonEntries = Object.entries(common)
            .map(([key, value]) => `${key}:"${escapeJs(value)}"`)
            .join(',');
        js += `$exe_i18n={${commonEntries}};\n`;

        // Build $exe_i18n.exeGames object
        const gamesEntries = Object.entries(games)
            .map(([key, value]) => `${key}:"${escapeJs(value)}"`)
            .join(',');
        js += `// This line is only present if the elp contains a hangman game:\n`;
        js += `$exe_i18n.exeGames={${gamesEntries}};\n`;

        return js;
    }

    /**
     * Add iDevice-specific translations to the JS content
     */
    appendIdeviceTranslations(
        jsContent: string,
        ideviceName: string,
        translations: Record<string, string>,
    ): string {
        let result = jsContent;

        for (const [key, value] of Object.entries(translations)) {
            const prefixedKey = `${ideviceName}_${key}`;
            const escapedValue = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            result += `$exe_i18n.exeGames["${prefixedKey}"] = "${escapedValue}";\n`;
        }

        return result;
    }
}
