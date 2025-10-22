<?php

namespace App\Translation\net\exelearning\Translation;

use Symfony\Component\Translation\MessageCatalogueInterface;
use Symfony\Component\Translation\TranslatorBagInterface;
use Symfony\Contracts\Translation\LocaleAwareInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

class Translator implements TranslatorInterface, TranslatorBagInterface, LocaleAwareInterface
{
    /** @var TranslatorBagInterface|TranslatorInterface */
    protected $translator;

    /** @var array */
    private $parameters;

    /** @var string|null */
    private $previousLocale;

    /**
     * Constructor to initialize the translator.
     *
     * @param TranslatorInterface|TranslatorBagInterface $translator
     */
    public function __construct(TranslatorInterface $translator, array $parameters = [])
    {
        $this->translator = $translator;
        $this->parameters = $parameters;
    }

    /**
     * Translates the given message or returns the original string if no translation exists.
     */
    public function trans(string $id, array $parameters = [], ?string $domain = null, ?string $locale = null): string
    {
        $parameters = $this->updateParameters($parameters);

        // Try to translate in the current locale
        $translated = $this->translator->trans($id, $parameters, $domain, $locale);

        // Fallback to English if translation is empty or the same as the ID
        if (empty($translated) || $translated === $id) {
            $translated = $this->translator->trans($id, $parameters, $domain, 'en');
        }

        // // elp → elpx (to review - #498)
        $translated = str_replace(' (elp)', ' (elpx)', $translated);
        $translated = str_replace(' .elp ', ' .elpx ', $translated);
        $translated = str_replace(' elp ', ' elpx ', $translated);
        if (str_ends_with($translated, '.elp')) {
            $translated .= 'x';
        }

        // Remove ~ prefix if present
        if (str_starts_with($translated, '~')) {
            return substr($translated, 1);
        }

        // If the English translation is also empty or identical to the ID, return the original string (ID)
        return empty($translated) || $translated === $id ? $id : $translated;
    }

    /**
     * Sets the locale for the translator.
     *
     * @param string $locale
     */
    public function setLocale($locale): void
    {
        $this->translator->setLocale($locale);
    }

    /**
     * Gets the current locale.
     */
    public function getLocale(): string
    {
        return $this->translator->getLocale();
    }

    /**
     * Returns the message catalogue for the given locale.
     */
    public function getCatalogue(?string $locale = null): MessageCatalogueInterface
    {
        return $this->translator->getCatalogue($locale);
    }

    /**
     * Updates the global parameters with the provided ones.
     */
    protected function updateParameters(array $parameters): array
    {
        return array_merge($this->parameters, $parameters);
    }

    /**
     * Returns an array of catalogues for all locales.
     *
     * @return MessageCatalogueInterface[]
     */
    public function getCatalogues(): array
    {
        return array_values($this->catalogues);
    }

    /**
     * Temporarily changes the locale for the translator.
     * Stores the current locale to be restored later.
     *
     * @param string $temporaryLocale The locale to temporarily switch to
     *
     * @return bool True if the locale was changed successfully, false otherwise
     *
     * @throws \InvalidArgumentException If the locale is invalid
     */
    public function switchTemporaryLocale(string $temporaryLocale): bool
    {
        // Validate locale format (p.ej. "es", "es_ES", "en_US", etc.)
        // if not valid default locale is used
        if (!preg_match('/^[a-z]{2}(?:_[A-Z]{2})?$/', $temporaryLocale)
            || !is_string($temporaryLocale)
            || '' === $temporaryLocale
            || empty($temporaryLocale)) {
            $temporaryLocale = $this->getLocale();
        }

        try {
            // Store the current locale before changing
            $this->previousLocale = $this->getLocale();

            // Set the new temporary locale
            $this->setLocale($temporaryLocale);

            // Verify the locale was actually changed
            return $this->getLocale() === $temporaryLocale;
        } catch (\Exception $e) {
            // If any error occurs, ensure we don't leave the system in an inconsistent state
            $this->previousLocale = null;
            throw new \RuntimeException('Error switching temporal locale: '.$e->getMessage(), 0, $e);
        }
    }

    /**
     * Restores the previous locale that was active before switchTemporaryLocale() was called.
     *
     * @return bool True if the previous locale was restored successfully, false if there was no previous locale or restoration failed
     */
    public function restorePreviousLocale(): bool
    {
        // Check if there is a previous locale to restore
        if (null === $this->previousLocale) {
            return false;
        }

        try {
            $currentLocale = $this->getLocale();

            // Only change if the current locale is different from the previous one
            if ($currentLocale !== $this->previousLocale) {
                $this->setLocale($this->previousLocale);

                // Verify the locale was actually restored
                $success = $this->getLocale() === $this->previousLocale;
            } else {
                // If current and previous locales are the same, consider it a success
                $success = true;
            }

            // Reset the previous locale regardless of success
            $this->previousLocale = null;

            return $success;
        } catch (\Exception $e) {
            // If any error occurs, ensure we don't leave the system in an inconsistent state
            $this->previousLocale = null;
            throw new \RuntimeException('Error restoring previous locale: '.$e->getMessage(), 0, $e);
        }
    }

    /**
     * Gets the previous locale that was stored before the temporary change.
     *
     * @return string|null The previous locale or null if no temporary change was made
     */
    public function getPreviousLocale(): ?string
    {
        return $this->previousLocale;
    }
}
