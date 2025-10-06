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
        
        // Set current log level based on DEBUG_MODE
        this.currentLevel = this.determineLogLevel();
        
        // Initialize Winston logger if available
        this.winston = null;
        this.initializeWinston();
    }
    
    determineLogLevel() {
        // Check DEBUG_MODE environment variable
        if (process.env.DEBUG_MODE === 'true' || process.env.DEBUG_MODE === '1') {
            return this.levels.DEBUG;
        }
        
        // Check LOG_LEVEL environment variable
        const logLevel = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
        return this.levels[logLevel] !== undefined ? this.levels[logLevel] : this.levels.INFO;
    }
    
    initializeWinston() {
        try {
            // Determine Winston log level based on DEBUG_MODE
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
            // Fallback to console logging if Winston fails
            console.warn('Winston logger initialization failed, using console logging');
        }
    }
    
    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const levelStr = level.toUpperCase().padEnd(5);
        const contextStr = `[${this.context}]`.padEnd(12);
        
        let formattedMessage = `${timestamp} ${levelStr} ${contextStr} ${message}`;
        
        if (args.length > 0) {
            const additionalData = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            formattedMessage += ` ${additionalData}`;
        }
        
        return formattedMessage;
    }
    
    log(level, message, ...args) {
        const formattedMessage = this.formatMessage(level, message, ...args);
        
        // Check if this level should be logged based on currentLevel
        const levelValue = this.levels[level.toUpperCase()] || 0;
        if (levelValue > this.currentLevel) {
            return; // Skip logging if level is above current threshold
        }
        
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
                if (process.env.NODE_ENV === 'development' || process.env.DEBUG || process.env.DEBUG_MODE === 'true') {
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
    
    // Log SQL queries when DEBUG_MODE is enabled
    logSQL(query, params = [], duration = null) {
        if (process.env.DEBUG_MODE === 'true' || process.env.DEBUG_MODE === '1') {
            const logData = {
                query: query.trim(),
                timestamp: new Date().toISOString()
            };
            
            // Only log params if they exist and are not sensitive
            if (params && params.length > 0) {
                // Mask potential sensitive data (passwords, tokens, etc.)
                const maskedParams = params.map((param, index) => {
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

// Create default logger instance
const defaultLogger = new Logger('Default');

// Export both class and default instance
module.exports = {
    Logger,
    logger: defaultLogger
};
