# Testing

This document explains the testing framework used in eXeLearning Web, including both unit and end-to-end (E2E) tests.

## Test Structure

Tests are divided into two main categories:

1. **Unit Tests** – Test individual components in isolation.
2. **End-to-End (E2E) Tests** – Simulate real user interactions with the full application stack.

All tests are located in the `tests/` directory.

## Unit Tests

Unit tests use PHPUnit to validate isolated components such as controllers, services, and repositories.

### Unit Test Configuration

eXeLearning Web uses an SQLite in-memory database for unit testing to ensure:

* Clean data for each test run
* Fast execution without requiring an external database
* No conflicts between test sessions

The `tests/bootstrap.php` file:

* Configures the testing environment
* Runs migrations to build the schema
* Loads assets needed for test execution

### Running Unit Tests

To run unit tests:

```bash
make test
```

## End-to-End (E2E) & Real-Time Tests

E2E tests are implemented using Symfony Panther, which integrates WebDriver to run real browser tests on the application.

### E2E Architecture

The E2E framework follows these design principles:

1. **Page Object Model (POM)** – Separates UI interaction from test logic
2. **Factory Pattern** – Creates test data and scenarios consistently
3. **Utility Classes** – Provide helper functions for common operations

### Main Components

* **ExelearningE2EBase** – Base class extended by all test cases
* **ExelearningRealTimeE2EBase** – Specialized base for real-time multi-client tests
* **Page Objects** – Encapsulate UI actions for specific pages
* **Factories** – Generate test data, nodes, documents, assertions
* **Utilities** – Screenshot capture, modal handling, waiting, assertions, file upload, etc.

### Running E2E Tests

To run all E2E tests:

```bash
make test-e2e
```

> Note: Real-time and standard E2E tests are separated to avoid exceeding PHPUnit’s 5-minute timeout.

To run specific tests, use the test shell (starts the Selenium container and gives you an interactive shell):

```bash
make test-shell
```

Inside the shell:

```bash
# Run a specific test
composer phpunit tests/Command/CreateUserCommandTest.php

# Filter by class or name
vendor/bin/phpunit --filter=LoginTest
vendor/bin/phpunit --debug --filter=RealTime
```

### E2E Environment Variables

* `APP_ONLINE_MODE`: `1` for online, `0` for offline
* `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`: Main user
* `CAPTURE_SCREENSHOTS`: `true` to capture screenshots automatically on failures

### E2E Examples

#### Basic Login Test

```php
public function testLoginFlow(): void
{
    $workareaPage = $this->login();
    $this->assertStringContainsString('/workarea', $this->client->getCurrentURL());
}
```

#### Using Page Objects

```php
public function testLogin(): void
{
    $loginPage = new LoginPage($this->client);

    $workareaPage = $loginPage
        ->navigate(self::$baseUrl)
        ->login(self::$defaultUserEmail, self::$defaultUserPass);

    $this->assertStringContainsString('/workarea', $this->client->getCurrentURL());
}
```

#### Using Factories

```php
public function testCreateDocument(): void
{
    $workareaPage = $this->login();
    $documentFactory = $this->createDocumentFactory($workareaPage);

    $documentFactory->createNewDocument();
    $documentFactory->assertDocumentCreated($this);
}
```

## Continuous Integration

All tests are executed automatically on GitHub Actions when a pull request is submitted or changes are pushed to main branches. This ensures that regressions or breaking changes are caught before being merged.

## Best Practices

1. Use Page Objects for all UI interactions
2. Avoid using `sleep()`; prefer explicit waits
3. Use factories to generate test data
4. Keep tests independent and self-contained
5. Capture screenshots on failure for debugging
6. Use `TestLogger` for detailed logs during test runs
7. Use the real-time base class for collaborative feature testing
