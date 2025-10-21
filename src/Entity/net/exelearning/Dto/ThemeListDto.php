<?php

namespace App\Entity\net\exelearning\Dto;

use App\Constants;

/**
 * ThemeListDto.
 */
class ThemeListDto extends BaseDto
{
    /**
     * @var ThemeDto[]
     */
    protected $themes;

    public function __construct()
    {
        $this->themes = [];
    }

    /**
     * @return multitype:\App\Entity\net\exelearning\Dto\ThemeDto
     */
    public function getThemes()
    {
        return $this->themes;
    }

    /**
     * @param multitype:\App\Entity\net\exelearning\Dto\ThemeDto  $themes
     */
    public function setThemes($themes)
    {
        $this->themes = $themes;
    }

    /**
     * @param ThemeDto $theme
     */
    public function addTheme($theme)
    {
        $this->themes[] = $theme;
    }

    /**
     * @param string $name
     */
    public function removeTheme($name, $user, $themeHelper, $fileHelper)
    {
        $response = ['name' => $name, 'found' => false, 'deleted' => false, 'path' => ''];
        foreach ($this->themes as $theme) {
            if ($theme->getName() == $name) {
                $response['found'] = true;
                // Theme dir
                $themeDir = $themeHelper->getThemeDir(
                    $theme->getDirName(),
                    Constants::THEME_TYPE_USER,
                    $user
                );
                $response['path'] = $themeDir;
                // Delete style dir
                try {
                    $fileHelper->deleteDir($themeDir);
                    $response['deleted'] = true;
                } catch (\Exception $e) {
                }
            }
        }

        return $response;
    }
}
