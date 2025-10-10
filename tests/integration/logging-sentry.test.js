/**
 * Integration tests for logging and Sentry modules.
 */

const path = require('path');
const fs = require('fs');

describe('Logging and Sentry Integration', () => {
    describe('Logger Module', () => {
        test('should load Logger module', () => {
            const { Logger } = require('../../src/utils/logger');
            expect(typeof Logger).toBe('function');
        });

        test('should create logger instance', () => {
            const { Logger } = require('../../src/utils/logger');
            const logger = new Logger('TestContext');
            expect(logger).toBeTruthy();
            expect(logger.info).toBeDefined();
            expect(logger.error).toBeDefined();
        });

        test('should have logs directory created', () => {
            const { Logger } = require('../../src/utils/logger');
            // Instantiate to trigger setup if needed
            new Logger('TestContext');

            const logsDir = path.join(__dirname, '../../logs');
            expect(fs.existsSync(logsDir)).toBe(true);
        });
    });

    describe('Sentry Module', () => {
        test('should load Sentry module', () => {
            const Sentry = require('@sentry/node');
            expect(Sentry).toBeTruthy();
            expect(typeof Sentry.SDK_VERSION).toBe('string');
            expect(Sentry.SDK_VERSION.length).toBeGreaterThan(0);
        });
    });

    describe('Winston Daily Rotate File', () => {
        test('should load winston-daily-rotate-file module', () => {
            const rotate = require('winston-daily-rotate-file');
            expect(rotate).toBeTruthy();
        });
    });
});
