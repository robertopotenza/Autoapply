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
        
        // Initialize Winston logger if available
        this.winston = null;
        this.initializeWinston();
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

            this.winston = winston.createLogger({
                level: process.env.LOG_LEVEL || 'info',
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
            console.warn('Winston logger initialization failed, using console logging:', error.message);
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
                if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
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
}

// Create default logger instance
const defaultLogger = new Logger('Default');

// Export both class and default instance
module.exports = {
    Logger,
    logger: defaultLogger
};
