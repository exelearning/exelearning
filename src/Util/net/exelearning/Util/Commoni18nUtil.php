<?php

namespace App\Util\net\exelearning\Util;

use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * Commoni18nUtil.
 *
 * Utility functions for working with strings i18n
 */
class Commoni18nUtil
{
    private TranslatorInterface $translator;
    private string $lang;

    public function __construct(TranslatorInterface $translator, string $lang)
    {
        $this->translator = $translator;
        $this->lang = $lang;
    }

    /**
     * Generate strings for i18n.
     */
    public function getCommonStringsi18n()
    {
        return [
            'previous' => $this->translator->trans('Previous', [], null, $this->lang),
            'next' => $this->translator->trans('Next', [], null, $this->lang),
            'show' => $this->translator->trans('Show', [], null, $this->lang),
            'hide' => $this->translator->trans('Hide', [], null, $this->lang),
            'showFeedback' => $this->translator->trans('Show feedback', [], null, $this->lang),
            'hideFeedback' => $this->translator->trans('Hide feedback', [], null, $this->lang),
            'correct' => $this->translator->trans('Correct', [], null, $this->lang),
            'incorrect' => $this->translator->trans('Incorrect', [], null, $this->lang),
            'menu' => $this->translator->trans('Menu', [], null, $this->lang),
            'download' => $this->translator->trans('Download', [], null, $this->lang),
            'yourScoreIs' => $this->translator->trans('Your score is', [], null, $this->lang),
            'dataError' => $this->translator->trans('Error retrieving data', [], null, $this->lang),
            'epubJSerror' => $this->translator->trans('This might not work in this ePub reader.', [], null, $this->lang),
            'epubDisabled' => $this->translator->trans('This activity does not work in ePub format.', [], null, $this->lang),
            'solution' => $this->translator->trans('Solution', [], null, $this->lang),
            'print' => $this->translator->trans('Print', [], null, $this->lang),
            'fullSearch' => $this->translator->trans('Search all pages', [], null, $this->lang),
            'noSearchResults' => $this->translator->trans('No results found for %', [], null, $this->lang),
            'searchResults' => $this->translator->trans('Search results for %', [], null, $this->lang),
            'hideResults' => $this->translator->trans('Hide results', [], null, $this->lang),
            'more' => $this->translator->trans('More', [], null, $this->lang),
            'newWindow' => $this->translator->trans('New window', [], null, $this->lang),
            'fullSize' => $this->translator->trans('Full size', [], null, $this->lang),
            'search' => $this->translator->trans('Search', [], null, $this->lang),
            'accessibility_tools' => $this->translator->trans('Accessibility tools', [], null, $this->lang),
            'close_toolbar' => $this->translator->trans('Close', [], null, $this->lang),
            'default_font' => $this->translator->trans('Default typography', [], null, $this->lang),
            'increase_text_size' => $this->translator->trans('Increase text size', [], null, $this->lang),
            'decrease_text_size' => $this->translator->trans('Decrease text size', [], null, $this->lang),
            'read' => $this->translator->trans('Read', [], null, $this->lang),
            'stop_reading' => $this->translator->trans('Stop reading', [], null, $this->lang),
            'translate' => $this->translator->trans('Translate', [], null, $this->lang),
            'drag_and_drop' => $this->translator->trans('Drag and drop', [], null, $this->lang),
            'reset' => $this->translator->trans('Reset', [], null, $this->lang),
            'mode_toggler' => $this->translator->trans('Light/dark mode', [], null, $this->lang),
            'teacher_mode' => $this->translator->trans('Teacher mode', [], null, $this->lang),
        ];
    }

    /**
     * Generate strings for idevices in i18n.
     */
    public function getGamesStringsi18n()
    {
        return [
            'hangManGame' => $this->translator->trans('Hangman Game', [], null, $this->lang),
            'accept' => $this->translator->trans('Accept', [], null, $this->lang),
            'yes' => $this->translator->trans('Yes', [], null, $this->lang),
            'no' => $this->translator->trans('No', [], null, $this->lang),
            'right' => $this->translator->trans('Correct', [], null, $this->lang),
            'wrong' => $this->translator->trans('Incorrect', [], null, $this->lang),
            'rightAnswer' => $this->translator->trans('Correct answer', [], null, $this->lang),
            'stat' => $this->translator->trans('Stat', [], null, $this->lang),
            'selectedLetters' => $this->translator->trans('Selected letters', [], null, $this->lang),
            'word' => $this->translator->trans('Word', [], null, $this->lang),
            'words' => $this->translator->trans('Words', [], null, $this->lang),
            'play' => $this->translator->trans('Play', [], null, $this->lang),
            'playAgain' => $this->translator->trans('Play again', [], null, $this->lang),
            'results' => $this->translator->trans('Results', [], null, $this->lang),
            'total' => $this->translator->trans('Total', [], null, $this->lang),
            'otherWord' => $this->translator->trans('Other word', [], null, $this->lang),
            'gameOver' => $this->translator->trans('Game Over', [], null, $this->lang),
            'confirmReload' => $this->translator->trans('Reload the game?', [], null, $this->lang),
            'clickOnPlay' => $this->translator->trans('Click "Play" to start a new game.', [], null, $this->lang),
            'clickOnOtherWord' => $this->translator->trans('Click "Another word" to continue.', [], null, $this->lang),
            'az' => $this->translator->trans('abcdefghijklmnñopqrstuvwxyz', [], null, $this->lang),
        ];
    }
}
