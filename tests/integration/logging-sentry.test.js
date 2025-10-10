/**
 * Integration test for logging and Sentry
 */

const path = require('path');
const fs = require('fs');

describe('Logging and Sentry Integration', () => {
    describe('Logger Module', () => {
        test('should load Logger module', () => {
            const { Logger } = require('../../src/utils/logger');
            expect(Logger).toBeDefined();
            expect(typeof Logger).toBe('function');
        });

        test('should create logger instance', () => {
            const { Logger } = require('../../src/utils/logger');
            const logger = new Logger('TestContext');
            expect(logger).toBeDefined();
            expect(logger.info).toBeDefined();
            expect(logger.error).toBeDefined();
        });

        test('should have logs directory created', () => {
            const logsDir = path.join(__dirname, '../../logs');
            expect(fs.existsSync(logsDir)).toBe(true);
        });
    });

    describe('Sentry Module', () => {
        test('should load Sentry module', () => {
            const Sentry = require('@sentry/node');
            expect(Sentry).toBeDefined();
            expect(Sentry.SDK_VERSION).toBeDefined();
        });
    });

    describe('Winston Daily Rotate File', () => {
        test('should load winston-daily-rotate-file module', () => {
            const DailyRotateFile = require('winston-daily-rotate-file');
            expect(DailyRotateFile).toBeDefined();
        });
    });
});
