/**
 * AppError Class for Structured Error Handling
 * Provides consistent error structure with context, timestamps, and error codes
 */

class AppError extends Error {
    /**
     * Create an AppError
     * @param {string} message - Error message
     * @param {string} code - Error code (e.g., 'DB_QUERY_FAILED', 'API_ERROR')
     * @param {Object} context - Additional context information
     * @param {Error} cause - Original error that caused this error
     */
    constructor(message, code = 'INTERNAL_ERROR', context = {}, cause = null) {
        super(message);
        
        this.name = 'AppError';
        this.code = code;
        this.context = context;
        this.timestamp = new Date().toISOString();
        this.cause = cause;
        
        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
        
        // If there's a cause error, append its stack
        if (cause && cause.stack) {
            this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
        }
    }
    
    /**
     * Convert the error to a JSON-serializable object
     * @returns {Object} JSON representation of the error
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            context: this.context,
            timestamp: this.timestamp,
            stack: this.stack,
            cause: this.cause ? {
                message: this.cause.message,
                name: this.cause.name,
                stack: this.cause.stack
            } : null
        };
    }
    
    /**
     * Create a database error
     * @param {string} message - Error message
     * @param {Object} context - Database context (query, params, etc.)
     * @param {Error} cause - Original database error
     * @returns {AppError}
     */
    static database(message, context = {}, cause = null) {
        return new AppError(message, 'DB_ERROR', context, cause);
    }
    
    /**
     * Create an API error
     * @param {string} message - Error message
     * @param {Object} context - API context (endpoint, method, etc.)
     * @param {Error} cause - Original API error
     * @returns {AppError}
     */
    static api(message, context = {}, cause = null) {
        return new AppError(message, 'API_ERROR', context, cause);
    }
    
    /**
     * Create a validation error
     * @param {string} message - Error message
     * @param {Object} context - Validation context
     * @returns {AppError}
     */
    static validation(message, context = {}) {
        return new AppError(message, 'VALIDATION_ERROR', context);
    }
    
    /**
     * Create an authentication error
     * @param {string} message - Error message
     * @param {Object} context - Auth context
     * @returns {AppError}
     */
    static auth(message, context = {}) {
        return new AppError(message, 'AUTH_ERROR', context);
    }
}

module.exports = AppError;
