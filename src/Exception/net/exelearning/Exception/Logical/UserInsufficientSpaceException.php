<?php

namespace App\Exception\net\exelearning\Exception\Logical;

/**
 * UserInsufficientSpaceException.
 */
class UserInsufficientSpaceException extends LogicalException
{
    // Constants
    public const USER_ISSUFFICIENT_SPACE_ERROR = 'The user does not have enough space';

    private int $usedSpace;
    private int $maxSpace;
    private int $requiredSpace;
    private int $availableSpace;

    /**
     * @param int $usedSpace     Current space used by user in bytes
     * @param int $maxSpace      Maximum space allowed for user in bytes
     * @param int $requiredSpace Space required for the current file in bytes
     */
    public function __construct(int $usedSpace = 0, int $maxSpace = 0, int $requiredSpace = 0)
    {
        $this->usedSpace = $usedSpace;
        $this->maxSpace = $maxSpace;
        $this->requiredSpace = $requiredSpace;
        $this->availableSpace = max(0, $maxSpace - $usedSpace);

        parent::__construct(self::USER_ISSUFFICIENT_SPACE_ERROR);
    }

    public function getUsedSpace(): int
    {
        return $this->usedSpace;
    }

    public function getMaxSpace(): int
    {
        return $this->maxSpace;
    }

    public function getRequiredSpace(): int
    {
        return $this->requiredSpace;
    }

    public function getAvailableSpace(): int
    {
        return $this->availableSpace;
    }
}
