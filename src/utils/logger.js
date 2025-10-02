/**
 * Logger Utility for Enhanced AutoApply Platform
 * Provides structured logging with different levels and contexts
 */

class Logger {
    constructor(context = 'App') {
        this.context = context;
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        this.currentLevel = this.levels[process.env.LOG_LEVEL] || this.levels.info;
    }

    /**
     * Format log message with timestamp and context
     */
    formatMessage(level, message, metadata = null) {
        const timestamp = new Date().toISOString();
        const logLevel = level.toUpperCase();
        let formatted = `[${timestamp}] [${logLevel}] [${this.context}] ${message}`;
        
        if (metadata) {
            formatted += ` ${JSON.stringify(metadata)}`;
        }
        
        return formatted;
    }

    /**
     * Log error messages
     */
    error(message, metadata = null) {
        if (this.currentLevel >= this.levels.error) {
            console.error(this.formatMessage('error', message, metadata));
        }
    }

    /**
     * Log warning messages
     */
    warn(message, metadata = null) {
        if (this.currentLevel >= this.levels.warn) {
            console.warn(this.formatMessage('warn', message, metadata));
        }
    }

    /**
     * Log info messages
     */
    info(message, metadata = null) {
        if (this.currentLevel >= this.levels.info) {
            console.log(this.formatMessage('info', message, metadata));
        }
    }

    /**
     * Log debug messages
     */
    debug(message, metadata = null) {
        if (this.currentLevel >= this.levels.debug) {
            console.log(this.formatMessage('debug', message, metadata));
        }
    }

    /**
     * Create child logger with additional context
     */
    child(additionalContext) {
        return new Logger(`${this.context}:${additionalContext}`);
    }
}

module.exports = { Logger };