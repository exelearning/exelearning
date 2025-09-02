<?php

namespace App\Dto;

use Symfony\Component\Serializer\Annotation\Groups;

class UserStats
{
    #[Groups(['user:stats'])]
    public int $projectsCount = 0;

    #[Groups(['user:stats'])]
    public int $usedSpaceMb = 0;

    #[Groups(['user:stats'])]
    public ?int $quotaMb = null;

    public function __construct(int $projectsCount = 0, int $usedSpaceMb = 0, ?int $quotaMb = null)
    {
        $this->projectsCount = $projectsCount;
        $this->usedSpaceMb = $usedSpaceMb;
        $this->quotaMb = $quotaMb;
    }
}
