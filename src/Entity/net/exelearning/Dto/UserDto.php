<?php

namespace App\Entity\net\exelearning\Dto;

use App\Util\GravatarUrlGenerator;

/**
 * UserDto.
 */
class UserDto extends BaseDto
{
    /**
     * @var string
     */
    protected $username;

    /**
     * @var string
     */
    protected $initials;

    /**
     * @var string
     */
    protected $gravatarUrl;

    /**
     * @return string
     */
    public function getUsername()
    {
        return $this->username;
    }

    /**
     * Sets the user's username.
     * Updates the Gravatar URL based on the email.
     *
     * Parameters used in the Gravatar URL:
     * - `s=96`: Sets the image size to 96x96 pixels.
     * - `d=` + configured default image: Selects the default avatar style.
     * - `r=g`: Restricts the image to the 'G' rating (safe for all audiences).
     * - `initials=`: When using the "initials" style, sends the initials to display.
     *
     * @param string $username The user's email address
     *
     * @return void
     */
    public function setUsername($username)
    {
        $this->username = $username;
        $this->refreshGravatarUrl();
    }

    /**
     * @return string
     */
    public function getInitials()
    {
        return $this->initials;
    }

    /**
     * @param string $initials
     */
    public function setInitials($initials)
    {
        $this->initials = $initials;
        $this->refreshGravatarUrl();
    }

    /**
     * Returns the user's Gravatar URL.
     *
     * @return string
     */
    public function getGravatarUrl()
    {
        return $this->gravatarUrl;
    }

    private function refreshGravatarUrl(): void
    {
        $username = trim((string) $this->username);

        if ('' === $username) {
            $this->gravatarUrl = null;

            return;
        }

        $this->gravatarUrl = GravatarUrlGenerator::createFromIdentifier(
            $username,
            null,
            $this->username
        );
    }
}
