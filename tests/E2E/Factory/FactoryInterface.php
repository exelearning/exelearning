<?php
declare(strict_types=1);

namespace App\Tests\E2E\Factory;

/**
 * Contract for UI-driven factories used across the E2E suite.
 * Implementations stay framework-agnostic and operate via page objects.
 */
interface FactoryInterface
{
    /**
     * Creates a resource and returns its identifier when available.
     *
     * @param array<string, mixed> $args
     */
    public function create(array $args = []);

    /**
     * Convenience helper for creating multiple resources at once.
     *
     * @return array<int, mixed>
     */
    public function createMany(int $count, array $args = []): array;

    /**
     * Creates a resource and returns the richer model object, when supported.
     *
     * @param array<string, mixed> $args
     */
    public function createAndGet(array $args = []);

    /**
     * Attempts to find a resource matching the provided criteria or creates it.
     *
     * @param array<string, mixed> $criteria
     * @param array<string, mixed> $args
     */
    public function findOrCreate(array $criteria, array $args = []);

    /**
     * Checks if the factory is currently tracking a resource that matches criteria.
     *
     * @param array<string, mixed> $criteria
     */
    public function exists(array $criteria): bool;

    /**
     * Removes a resource created by the factory when possible.
     *
     * @param mixed $identifier
     */
    public function delete($identifier): bool;

    /**
     * Attempts to duplicate an existing resource (best-effort).
     *
     * @param mixed $identifier
     */
    public function duplicate($identifier): bool;

    /**
     * Clears any resource bookkeeping and performs UI level cleanup.
     */
    public function cleanup(): void;
}
