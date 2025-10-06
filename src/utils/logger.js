/**
 * Comprehensive Logger Utility for Apply Autonomously Platform
 * Provides structured logging with different levels, contexts, and output formatting
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
require('winston-daily-rotate-file');

class Logger {
    constructor(context = 'App') {
        this.context = context;
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };

        // Set current log level based on DEBUG_MODE or LOG_LEVEL
        this._level = this._getLogLevel();

        // Initialize Winston logger if available
        this.winston = null;
        this.initializeWinston();
    }

    _getLogLevel() {
        if (process.env.DEBUG_MODE === 'true' || process.env.DEBUG === 'true' || process.env.DEBUG_MODE === '1') {
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
            // Ensure logs directory exists
            const logsDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }

            const transports = [];

            // In production, use rotating file transports
            if (process.env.NODE_ENV === 'production') {
                // Error log with daily rotation
                transports.push(
                    new winston.transports.DailyRotateFile({
                        filename: path.join(logsDir, 'error-%DATE%.log'),
                        datePattern: 'YYYY-MM-DD',
                        level: 'error',
                        maxSize: '20m',
                        maxFiles: '14d',
                        zippedArchive: true
                    })
                );

                // Combined log with daily rotation
                transports.push(
                    new winston.transports.DailyRotateFile({
                        filename: path.join(logsDir, 'combined-%DATE%.log'),
                        datePattern: 'YYYY-MM-DD',
                        maxSize: '20m',
                        maxFiles: '30d',
                        zippedArchive: true
                    })
                );
            } else {
                // In non-production, use simple file transports
                transports.push(
                    new winston.transports.File({ 
                        filename: path.join(logsDir, 'error.log'), 
                        level: 'error' 
                    })
                );
                transports.push(
                    new winston.transports.File({ 
                        filename: path.join(logsDir, 'combined.log') 
                    })
                );
            }

            // Always add console transport in non-production
            if (process.env.NODE_ENV !== 'production') {
                transports.push(
                    new winston.transports.Console({
                        format: winston.format.simple()
                    })
                );
            }

            let winstonLevel = 'info';
            if (process.env.DEBUG_MODE === 'true' || process.env.DEBUG_MODE === '1') {
                winstonLevel = 'debug';
            } else if (process.env.LOG_LEVEL) {
                winstonLevel = process.env.LOG_LEVEL.toLowerCase();
            }

            this.winston = winston.createLogger({
                level: winstonLevel,
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.errors({ stack: true }),
                    winston.format.json()
                ),
                defaultMeta: { service: 'apply-autonomously', context: this.context },
                transports
            });
        } catch (error) {
            // Fallback to console logging if Winston fails
            console.warn('Winston logger initialization failed, using console logging:', error.message, '\nStack trace:', error.stack);
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

        if (args.length > 0) {
            for (const arg of args) {
                if (typeof arg === 'object' && arg !== null && !Array.isArray(arg)) {
                    Object.assign(logEntry, arg);
                } else {
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
        if (!this._shouldLog(level)) {
            return;
        }

        const formattedMessage = this.formatMessage(level, message, ...args);

        if (this.winston) {
            this.winston.log(level, message, { args, context: this.context });
        }

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

    // Structured logging helpers
    logJobScan(platform, jobCount, duration) {
        this.info('Job scan completed', {
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
        this.debug('API Request', {
            method,
            endpoint,
            userId,
            responseTime: `${responseTime}ms`,
            timestamp: new Date().toISOString()
        });
    }

    logError(error, context = {}) {
        this.error('Error occurred', {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        });
    }

    logSQL(query, params = [], duration = null) {
        if (process.env.DEBUG_MODE === 'true' || process.env.DEBUG_MODE === '1') {
            const logData = {
                query: query.trim(),
                timestamp: new Date().toISOString()
            };

            if (params && params.length > 0) {
                const maskedParams = params.map(param => {
                    if (typeof param === 'string' &&
                        (query.toLowerCase().includes('password') ||
                         query.toLowerCase().includes('token') ||
                         query.toLowerCase().includes('secret'))) {
                        return '[REDACTED]';
                    }
                    return param;
                });
                logData.params = maskedParams;
            }

            if (duration !== null) {
                logData.duration = `${duration}ms`;
            }

            this.debug('SQL Query', logData);
        }
    }
}

// Default logger instance
const defaultLogger = new Logger('Default');

module.exports = {
    Logger,
    logger: defaultLogger
};

