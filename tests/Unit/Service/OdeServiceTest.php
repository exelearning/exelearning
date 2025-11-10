<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Service\net\exelearning\Service\Api\OdeService;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for OdeService, specifically testing the fix for opening files
 * from user files directory (OdeFiles). This tests the addition of the
 * $isImportIdevices parameter to the openElp() method.
 *
 * @see https://github.com/exelearning/iteexe/commit/f18e0b7e - Fix open file from user files
 */
final class OdeServiceTest extends TestCase
{
    /**
     * Test that the openElp method has the $isImportIdevices parameter.
     *
     * This is the PRIMARY test that validates the fix. Before the fix, the
     * openElp() method had only 4 parameters. After the fix, it should have
     * 5 parameters, with the 5th being $isImportIdevices.
     */
    public function testOpenElpMethodHasIsImportIdevicesParameter(): void
    {
        $reflectionClass = new \ReflectionClass(OdeService::class);
        $reflectionMethod = $reflectionClass->getMethod('openElp');

        // Verify method has 5 parameters (was 4 before the fix)
        $parameters = $reflectionMethod->getParameters();
        self::assertCount(
            5,
            $parameters,
            'openElp method should have 5 parameters including $isImportIdevices'
        );

        // Verify parameter names in order
        self::assertEquals('newOdeSessionId', $parameters[0]->getName(), 'First parameter should be $newOdeSessionId');
        self::assertEquals('elpFileName', $parameters[1]->getName(), 'Second parameter should be $elpFileName');
        self::assertEquals('odeSessionDistDirPath', $parameters[2]->getName(), 'Third parameter should be $odeSessionDistDirPath');
        self::assertEquals('checkElpFile', $parameters[3]->getName(), 'Fourth parameter should be $checkElpFile');
        self::assertEquals('isImportIdevices', $parameters[4]->getName(), 'Fifth parameter should be $isImportIdevices');
    }

    /**
     * Test that the $isImportIdevices parameter has a default value of false.
     *
     * This ensures backward compatibility. Existing code that calls openElp()
     * without the new parameter will default to isImportIdevices=false, which
     * means resources will be flattened (normal file opening behavior).
     */
    public function testOpenElpMethodIsImportIdevicesDefaultsToFalse(): void
    {
        $reflectionClass = new \ReflectionClass(OdeService::class);
        $reflectionMethod = $reflectionClass->getMethod('openElp');
        $parameters = $reflectionMethod->getParameters();

        // Get the 5th parameter (isImportIdevices)
        $isImportIdevicesParam = $parameters[4];

        // Verify it has a default value
        self::assertTrue(
            $isImportIdevicesParam->isDefaultValueAvailable(),
            'isImportIdevices parameter should have a default value'
        );

        // Verify the default value is false
        self::assertFalse(
            $isImportIdevicesParam->getDefaultValue(),
            'Default value of isImportIdevices should be false (backward compatible)'
        );
    }

    /**
     * Test that the $isImportIdevices parameter is optional.
     *
     * This ensures the parameter can be omitted when calling the method,
     * maintaining backward compatibility with existing code.
     */
    public function testOpenElpMethodIsImportIdevicesIsOptional(): void
    {
        $reflectionClass = new \ReflectionClass(OdeService::class);
        $reflectionMethod = $reflectionClass->getMethod('openElp');
        $parameters = $reflectionMethod->getParameters();

        // Get the 5th parameter (isImportIdevices)
        $isImportIdevicesParam = $parameters[4];

        // Verify it's optional (has default value)
        self::assertTrue(
            $isImportIdevicesParam->isOptional(),
            'isImportIdevices parameter should be optional'
        );
    }

    /**
     * Test that the openElp method is private.
     *
     * This verifies the method's visibility hasn't changed. It should remain
     * private as it's an internal method called by public methods like
     * checkContentXmlAndCurrentUser().
     */
    public function testOpenElpMethodIsPrivate(): void
    {
        $reflectionClass = new \ReflectionClass(OdeService::class);
        $reflectionMethod = $reflectionClass->getMethod('openElp');

        self::assertTrue(
            $reflectionMethod->isPrivate(),
            'openElp method should be private'
        );
    }

    /**
     * Test that all required parameters (1-4) do not have default values.
     *
     * This ensures the first 4 parameters remain required, only the new
     * $isImportIdevices parameter is optional.
     */
    public function testOpenElpMethodRequiredParametersHaveNoDefaults(): void
    {
        $reflectionClass = new \ReflectionClass(OdeService::class);
        $reflectionMethod = $reflectionClass->getMethod('openElp');
        $parameters = $reflectionMethod->getParameters();

        // Check first 4 parameters are required (no default values)
        for ($i = 0; $i < 4; $i++) {
            self::assertFalse(
                $parameters[$i]->isDefaultValueAvailable(),
                "Parameter {$parameters[$i]->getName()} should be required (no default value)"
            );
        }
    }

    /**
     * Test that the parameter default value is boolean false.
     *
     * The $isImportIdevices parameter's default value should be the boolean
     * value false (not null, not 0, not empty string).
     */
    public function testOpenElpMethodIsImportIdevicesDefaultValueIsBoolean(): void
    {
        $reflectionClass = new \ReflectionClass(OdeService::class);
        $reflectionMethod = $reflectionClass->getMethod('openElp');
        $parameters = $reflectionMethod->getParameters();

        // Get the 5th parameter (isImportIdevices)
        $isImportIdevicesParam = $parameters[4];

        // Get the default value
        $defaultValue = $isImportIdevicesParam->getDefaultValue();

        // Verify it's specifically the boolean false, not other falsy values
        self::assertIsBool(
            $defaultValue,
            'Default value should be a boolean type'
        );
        self::assertFalse(
            $defaultValue,
            'Default value should be boolean false'
        );
    }

    /**
     * Test the method signature documentation.
     *
     * This test verifies that the docblock has been updated to reflect
     * the new parameter.
     */
    public function testOpenElpMethodDocBlockIncludesIsImportIdevicesParameter(): void
    {
        $reflectionClass = new \ReflectionClass(OdeService::class);
        $reflectionMethod = $reflectionClass->getMethod('openElp');

        $docComment = $reflectionMethod->getDocComment();

        self::assertNotFalse($docComment, 'openElp method should have a docblock');
        self::assertStringContainsString(
            '@param',
            $docComment,
            'Docblock should contain @param annotations'
        );
        self::assertStringContainsString(
            'isImportIdevices',
            $docComment,
            'Docblock should document the $isImportIdevices parameter'
        );
    }
}
