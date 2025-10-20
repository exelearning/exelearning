<?php

namespace App\Entity\net\exelearning\Dto;

/**
 * BaseDto.
 */
class BaseDto
{
    /**
     * Export DTO protected properties as an associative array.
     */
    public function toArray(): array
    {
        $data = [];
        $reflection = new \ReflectionClass($this);

        foreach ($reflection->getProperties() as $property) {
            $property->setAccessible(true);
            $data[$property->getName()] = $property->getValue($this);
        }

        return $data;
    }
}
