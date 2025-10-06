/**
 * Comprehensive Logger Utility for Apply Autonomously Platform
 * Provides structured logging with different levels, contexts, and output formatting
 */

const winston = require('winston');

class Logger {
    constructor(context = 'App') {
        this.context = context;
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        
        // Set log level based on DEBUG_MODE env var
        this._level = this._getLogLevel();
        
        // Initialize Winston logger if available
        this.winston = null;
        this.initializeWinston();
    }
    
    _getLogLevel() {
        if (process.env.DEBUG_MODE === 'true' || process.env.DEBUG === 'true') {
            return 'DEBUG';
        }
        const envLevel = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
        return this.levels.hasOwnProperty(envLevel) ? envLevel : 'INFO';
    }
    
    get level() {
        return this._level;
    }
    
    set level(newLevel) {
        const upperLevel = newLevel.toUpperCase();
        if (this.levels.hasOwnProperty(upperLevel)) {
            this._level = upperLevel;
        }
    }
    
    _shouldLog(level) {
        const levelValue = this.levels[level.toUpperCase()];
        const currentLevelValue = this.levels[this._level];
        return levelValue <= currentLevelValue;
    }
    
    initializeWinston() {
        try {
            this.winston = winston.createLogger({
                level: process.env.LOG_LEVEL || 'info',
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.errors({ stack: true }),
                    winston.format.json()
                ),
                defaultMeta: { service: 'apply-autonomously', context: this.context },
                transports: [
                    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
                    new winston.transports.File({ filename: 'logs/combined.log' })
                ]
            });

            if (process.env.NODE_ENV !== 'production') {
                this.winston.add(new winston.transports.Console({
                    format: winston.format.simple()
                }));
            }
        } catch (error) {
            // Fallback to console logging if Winston fails
            console.warn('Winston logger initialization failed, using console logging');
        }
    }
    
    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            context: this.context,
            message
        };
        
        // Merge additional context objects
        if (args.length > 0) {
            for (const arg of args) {
                if (typeof arg === 'object' && arg !== null && !Array.isArray(arg)) {
                    Object.assign(logEntry, arg);
                } else {
                    // For non-object args, add them as additional data
                    if (!logEntry.data) {
                        logEntry.data = [];
                    }
                    logEntry.data.push(arg);
                }
            }
        }
        
        return JSON.stringify(logEntry);
    }
    
    log(level, message, ...args) {
        // Check if this log level should be output
        if (!this._shouldLog(level)) {
            return;
        }
        
        const formattedMessage = this.formatMessage(level, message, ...args);
        
        // Use Winston if available
        if (this.winston) {
            this.winston.log(level, message, { args, context: this.context });
        }
        
        // Always log to console for immediate feedback
        switch (level.toLowerCase()) {
            case 'error':
                console.error(formattedMessage);
                break;
            case 'warn':
                console.warn(formattedMessage);
                break;
            case 'debug':
                console.debug(formattedMessage);
                break;
            default:
                console.log(formattedMessage);
        }
    }
    
    error(message, ...args) {
        this.log('error', message, ...args);
    }
    
    warn(message, ...args) {
        this.log('warn', message, ...args);
    }
    
    info(message, ...args) {
        this.log('info', message, ...args);
    }
    
    debug(message, ...args) {
        this.log('debug', message, ...args);
    }
    
    // Utility methods for structured logging
    logJobScan(platform, jobCount, duration) {
        this.info(`Job scan completed`, {
            platform,
            jobCount,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
        });
    }
    
    logApplication(jobTitle, company, status) {
        this.info(`Application ${status}`, {
            jobTitle,
            company,
            status,
            timestamp: new Date().toISOString()
        });
    }
    
    logUserAction(userId, action, details = {}) {
        this.info(`User action: ${action}`, {
            userId,
            action,
            details,
            timestamp: new Date().toISOString()
        });
    }
    
    logAPIRequest(method, endpoint, userId, responseTime) {
        this.debug(`API Request`, {
            method,
            endpoint,
            userId,
            responseTime: `${responseTime}ms`,
            timestamp: new Date().toISOString()
        });
    }
    
    logError(error, context = {}) {
        this.error(`Error occurred`, {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        });
    }
}

// Create default logger instance
const defaultLogger = new Logger('Default');

// Export both class and default instance
module.exports = {
    Logger,
    logger: defaultLogger
};
