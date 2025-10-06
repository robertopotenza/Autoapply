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
                if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MODE === 'true' || process.env.DEBUG === 'true') {
                    console.debug(formattedMessage);
                }
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

