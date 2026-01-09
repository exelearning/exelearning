/**
 * LoggerContext - Centralized Logging Abstraction
 *
 * Replaces direct console.* calls with a structured logging interface.
 * Supports log levels, structured context, and test-friendly silent mode.
 *
 * Usage:
 *   import { getLogger, createLoggerContext, silentLogger } from './contexts/logger.context';
 *
 *   // Production: use default singleton
 *   const logger = getLogger();
 *   logger.info('User logged in', { userId: 123 });
 *
 *   // Testing: use silent logger
 *   const logger = silentLogger;
 *
 *   // Scoped logging:
 *   const requestLogger = logger.child({ requestId: 'abc123' });
 *   requestLogger.info('Processing request');  // includes requestId in output
 */
import { getConfig, type ConfigContext, type LogLevel } from './config.context';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Context data that can be attached to log messages
 */
export type LogContext = Record<string, unknown>;

/**
 * Logger interface with standard log levels and child logger support
 */
export interface LoggerContext {
    /**
     * Log a debug message (most verbose, typically disabled in production)
     */
    debug(message: string, context?: LogContext): void;

    /**
     * Log an informational message
     */
    info(message: string, context?: LogContext): void;

    /**
     * Log a warning message
     */
    warn(message: string, context?: LogContext): void;

    /**
     * Log an error message with optional error object
     */
    error(message: string, error?: Error | null, context?: LogContext): void;

    /**
     * Create a child logger with additional context
     * Child loggers inherit parent context and merge with new context
     */
    child(context: LogContext): LoggerContext;

    /**
     * Get the current log level
     */
    readonly level: LogLevel;
}

// ============================================================================
// LOG LEVEL UTILITIES
// ============================================================================

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

function shouldLog(currentLevel: LogLevel, messageLevel: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[messageLevel] >= LOG_LEVEL_PRIORITY[currentLevel];
}

// ============================================================================
// STRUCTURED LOGGER IMPLEMENTATION
// ============================================================================

/**
 * Structured JSON logger that outputs to console
 */
class StructuredLogger implements LoggerContext {
    constructor(
        public readonly level: LogLevel,
        private readonly baseContext: LogContext = {},
    ) {}

    debug(message: string, context?: LogContext): void {
        if (shouldLog(this.level, 'debug')) {
            this.log('debug', message, context);
        }
    }

    info(message: string, context?: LogContext): void {
        if (shouldLog(this.level, 'info')) {
            this.log('info', message, context);
        }
    }

    warn(message: string, context?: LogContext): void {
        if (shouldLog(this.level, 'warn')) {
            this.log('warn', message, context);
        }
    }

    error(message: string, error?: Error | null, context?: LogContext): void {
        if (shouldLog(this.level, 'error')) {
            const errorContext: LogContext = { ...context };
            if (error) {
                errorContext.error = {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                };
            }
            this.log('error', message, errorContext);
        }
    }

    child(context: LogContext): LoggerContext {
        return new StructuredLogger(this.level, {
            ...this.baseContext,
            ...context,
        });
    }

    private log(level: LogLevel, message: string, context?: LogContext): void {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...this.baseContext,
            ...context,
        };

        // Use appropriate console method based on level
        switch (level) {
            case 'debug':
                console.debug(JSON.stringify(logEntry));
                break;
            case 'info':
                console.info(JSON.stringify(logEntry));
                break;
            case 'warn':
                console.warn(JSON.stringify(logEntry));
                break;
            case 'error':
                console.error(JSON.stringify(logEntry));
                break;
        }
    }
}

// ============================================================================
// LEGACY LOGGER (Backward Compatible)
// ============================================================================

/**
 * Legacy logger that outputs in the original console format
 * Used for gradual migration - maintains existing log format
 */
class LegacyLogger implements LoggerContext {
    constructor(
        public readonly level: LogLevel,
        private readonly prefix: string = '',
    ) {}

    debug(message: string, context?: LogContext): void {
        if (shouldLog(this.level, 'debug')) {
            this.logLegacy('debug', message, context);
        }
    }

    info(message: string, context?: LogContext): void {
        if (shouldLog(this.level, 'info')) {
            this.logLegacy('info', message, context);
        }
    }

    warn(message: string, context?: LogContext): void {
        if (shouldLog(this.level, 'warn')) {
            this.logLegacy('warn', message, context);
        }
    }

    error(message: string, error?: Error | null, context?: LogContext): void {
        if (shouldLog(this.level, 'error')) {
            const prefix = this.prefix ? `[${this.prefix}] ` : '';
            if (error) {
                console.error(`${prefix}${message}`, error.message, context || '');
            } else {
                console.error(`${prefix}${message}`, context || '');
            }
        }
    }

    child(context: LogContext): LoggerContext {
        const component = context.component as string | undefined;
        return new LegacyLogger(this.level, component || this.prefix);
    }

    private logLegacy(level: LogLevel, message: string, context?: LogContext): void {
        const prefix = this.prefix ? `[${this.prefix}] ` : '';
        const contextStr = context ? ` ${JSON.stringify(context)}` : '';

        switch (level) {
            case 'debug':
                console.debug(`${prefix}${message}${contextStr}`);
                break;
            case 'info':
                console.log(`${prefix}${message}${contextStr}`);
                break;
            case 'warn':
                console.warn(`${prefix}${message}${contextStr}`);
                break;
            case 'error':
                console.error(`${prefix}${message}${contextStr}`);
                break;
        }
    }
}

// ============================================================================
// SILENT LOGGER (for testing)
// ============================================================================

/**
 * Silent logger that discards all log messages
 * Use this in tests to prevent log pollution
 */
export const silentLogger: LoggerContext = {
    level: 'error',
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => silentLogger,
};

// ============================================================================
// CAPTURING LOGGER (for testing)
// ============================================================================

/**
 * Log entry captured by CapturingLogger
 */
export interface CapturedLog {
    level: LogLevel;
    message: string;
    error?: Error | null;
    context?: LogContext;
    timestamp: Date;
}

/**
 * Logger that captures all log messages for testing assertions
 */
export class CapturingLogger implements LoggerContext {
    public readonly logs: CapturedLog[] = [];

    constructor(
        public readonly level: LogLevel = 'debug',
        private readonly baseContext: LogContext = {},
    ) {}

    debug(message: string, context?: LogContext): void {
        if (shouldLog(this.level, 'debug')) {
            this.capture('debug', message, null, context);
        }
    }

    info(message: string, context?: LogContext): void {
        if (shouldLog(this.level, 'info')) {
            this.capture('info', message, null, context);
        }
    }

    warn(message: string, context?: LogContext): void {
        if (shouldLog(this.level, 'warn')) {
            this.capture('warn', message, null, context);
        }
    }

    error(message: string, error?: Error | null, context?: LogContext): void {
        if (shouldLog(this.level, 'error')) {
            this.capture('error', message, error, context);
        }
    }

    child(context: LogContext): LoggerContext {
        return new CapturingLogger(this.level, {
            ...this.baseContext,
            ...context,
        });
    }

    private capture(level: LogLevel, message: string, error?: Error | null, context?: LogContext): void {
        this.logs.push({
            level,
            message,
            error,
            context: { ...this.baseContext, ...context },
            timestamp: new Date(),
        });
    }

    /**
     * Clear all captured logs
     */
    clear(): void {
        this.logs.length = 0;
    }

    /**
     * Find logs matching a predicate
     */
    findLogs(predicate: (log: CapturedLog) => boolean): CapturedLog[] {
        return this.logs.filter(predicate);
    }

    /**
     * Check if any log matches the given criteria
     */
    hasLog(level: LogLevel, messagePattern: string | RegExp): boolean {
        return this.logs.some(log => {
            if (log.level !== level) return false;
            if (typeof messagePattern === 'string') {
                return log.message.includes(messagePattern);
            }
            return messagePattern.test(log.message);
        });
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export interface LoggerOptions {
    level?: LogLevel;
    structured?: boolean;
    prefix?: string;
}

/**
 * Create a LoggerContext with the specified options
 *
 * @param options - Logger configuration
 * @param config - Optional ConfigContext for default level
 */
export function createLoggerContext(options: LoggerOptions = {}, config?: ConfigContext): LoggerContext {
    const cfg = config ?? getConfig();
    const level = options.level ?? cfg.logLevel;
    const structured = options.structured ?? cfg.env === 'prod';

    if (structured) {
        return new StructuredLogger(level);
    }
    return new LegacyLogger(level, options.prefix);
}

// ============================================================================
// DEFAULT SINGLETON
// ============================================================================

let _logger: LoggerContext | null = null;

/**
 * Get the default LoggerContext singleton
 * Created lazily on first access
 */
export function getLogger(): LoggerContext {
    if (!_logger) {
        _logger = createLoggerContext();
    }
    return _logger;
}

/**
 * Reset the default LoggerContext (for testing only)
 */
export function resetLoggerContext(): void {
    _logger = null;
}

/**
 * Set a custom LoggerContext as the default (for testing only)
 */
export function setLoggerContext(logger: LoggerContext): void {
    _logger = logger;
}
