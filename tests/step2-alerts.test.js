/**
 * @file tests/step2-alerts.test.js
 * @description Tests for Step 2 Slack alert monitoring system
 * 
 * Tests cover:
 * - Log entry parsing and warning detection
 * - Empty fields extraction
 * - Slack message formatting
 * - Alert toggle functionality
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Mock axios for Slack webhook calls
jest.mock('axios');

// Import the monitor script functions
const {
    parseLogEntry,
    sendSlackAlert,
    areAlertsEnabled
} = require('../scripts/monitor-step2-alerts');

describe('Step 2 Alert Monitor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Set default environment
        process.env.NODE_ENV = 'test';
        process.env.SLACK_STEP2_ALERT_WEBHOOK = 'https://hooks.slack.com/services/test/webhook';
    });

    afterEach(() => {
        delete process.env.SLACK_STEP2_ALERT_WEBHOOK;
    });

    describe('parseLogEntry', () => {
        test('should parse JSON log entry with INCOMPLETE STEP 2 SUBMISSION warning', () => {
            const logLine = JSON.stringify({
                message: '⚠️ INCOMPLETE STEP 2 SUBMISSION - User 123 submitted with empty critical fields:',
                args: [{
                    emptyFields: ['fullName', 'country'],
                    userId: '123'
                }],
                timestamp: '2025-10-09T13:17:01Z'
            });

            const result = parseLogEntry(logLine);

            expect(result).not.toBeNull();
            expect(result.userId).toBe('123');
            expect(result.emptyFields).toEqual(['fullName', 'country']);
            expect(result.severity).toBe('warning');
            expect(result.timestamp).toBe('2025-10-09T13:17:01Z');
        });

        test('should parse JSON log entry with CRITICAL empty fields warning', () => {
            const logLine = JSON.stringify({
                message: '❌ CRITICAL: All Step 2 fields are empty for user 456!',
                args: [{
                    userId: '456'
                }],
                timestamp: '2025-10-09T14:30:00Z'
            });

            const result = parseLogEntry(logLine);

            expect(result).not.toBeNull();
            expect(result.userId).toBe('456');
            expect(result.severity).toBe('critical');
            expect(result.timestamp).toBe('2025-10-09T14:30:00Z');
        });

        test('should parse plain text log entry with warning', () => {
            const logLine = 'warn: ⚠️ INCOMPLETE STEP 2 SUBMISSION - User 789 submitted with empty critical fields: emptyFields: ["email", "phone"]';

            const result = parseLogEntry(logLine);

            expect(result).not.toBeNull();
            expect(result.userId).toBe('789');
            expect(result.emptyFields).toContain('email');
            expect(result.emptyFields).toContain('phone');
            expect(result.severity).toBe('warning');
        });

        test('should return null for non-Step 2 log entries', () => {
            const logLine = JSON.stringify({
                message: 'User logged in successfully',
                args: []
            });

            const result = parseLogEntry(logLine);

            expect(result).toBeNull();
        });

        test('should handle log entries with missing args', () => {
            const logLine = JSON.stringify({
                message: '⚠️ INCOMPLETE STEP 2 SUBMISSION - User 999',
                timestamp: '2025-10-09T15:00:00Z'
            });

            const result = parseLogEntry(logLine);

            expect(result).not.toBeNull();
            expect(result.userId).toBe('999');
            expect(result.emptyFields).toEqual([]);
        });
    });

    describe('sendSlackAlert', () => {
        test('should send Slack message with correct format for warning', async () => {
            axios.post.mockResolvedValue({ status: 200 });

            const alertData = {
                userId: '123',
                emptyFields: ['fullName', 'country'],
                severity: 'warning',
                message: 'Test warning',
                timestamp: '2025-10-09T13:17:01Z',
                environment: 'production'
            };

            const result = await sendSlackAlert(alertData);

            expect(result).toBe(true);
            expect(axios.post).toHaveBeenCalledTimes(1);
            expect(axios.post).toHaveBeenCalledWith(
                'https://hooks.slack.com/services/test/webhook',
                expect.objectContaining({
                    text: expect.stringContaining('Incomplete Step 2 Submission Detected'),
                    attachments: expect.arrayContaining([
                        expect.objectContaining({
                            color: '#FFA500',
                            fields: expect.arrayContaining([
                                expect.objectContaining({
                                    title: 'User ID',
                                    value: '123'
                                }),
                                expect.objectContaining({
                                    title: 'Missing Fields',
                                    value: 'fullName, country'
                                })
                            ])
                        })
                    ])
                })
            );
        });

        test('should send Slack message with correct format for critical alert', async () => {
            axios.post.mockResolvedValue({ status: 200 });

            const alertData = {
                userId: '456',
                emptyFields: [],
                severity: 'critical',
                message: 'All fields empty',
                timestamp: '2025-10-09T14:30:00Z',
                environment: 'production'
            };

            const result = await sendSlackAlert(alertData);

            expect(result).toBe(true);
            expect(axios.post).toHaveBeenCalledWith(
                'https://hooks.slack.com/services/test/webhook',
                expect.objectContaining({
                    text: expect.stringContaining('Critical Step 2 Submission Detected'),
                    attachments: expect.arrayContaining([
                        expect.objectContaining({
                            color: '#FF0000',
                            fields: expect.arrayContaining([
                                expect.objectContaining({
                                    title: 'Missing Fields',
                                    value: 'All fields empty'
                                })
                            ])
                        })
                    ])
                })
            );
        });

        test('should skip Slack call when webhook not configured', async () => {
            delete process.env.SLACK_STEP2_ALERT_WEBHOOK;

            const alertData = {
                userId: '123',
                emptyFields: ['fullName'],
                severity: 'warning',
                timestamp: '2025-10-09T13:17:01Z',
                environment: 'test'
            };

            const result = await sendSlackAlert(alertData);

            expect(result).toBe(false);
            expect(axios.post).not.toHaveBeenCalled();
        });

        test('should handle Slack API errors gracefully', async () => {
            axios.post.mockRejectedValue(new Error('Network error'));

            const alertData = {
                userId: '123',
                emptyFields: ['fullName'],
                severity: 'warning',
                timestamp: '2025-10-09T13:17:01Z',
                environment: 'test'
            };

            const result = await sendSlackAlert(alertData);

            expect(result).toBe(false);
        });
    });

    describe('Alert Configuration', () => {
        test('should respect runtime config when alerts disabled', () => {
            // Mock runtime.json with alerts disabled
            const mockConfig = {
                alerts: {
                    step2Slack: false,
                    threshold: 'critical'
                }
            };

            // Write mock config
            const configPath = path.join(__dirname, '../config/runtime.json');
            const originalConfig = fs.existsSync(configPath) ? 
                fs.readFileSync(configPath, 'utf8') : null;
            
            fs.writeFileSync(configPath, JSON.stringify(mockConfig, null, 2));

            const enabled = areAlertsEnabled();

            // Restore original config
            if (originalConfig) {
                fs.writeFileSync(configPath, originalConfig);
            }

            expect(enabled).toBe(false);
        });

        test('should enable alerts by default when config missing', () => {
            // Mock missing config file scenario
            const configPath = path.join(__dirname, '../config/runtime.json');
            const originalConfig = fs.existsSync(configPath) ? 
                fs.readFileSync(configPath, 'utf8') : null;
            
            // Temporarily remove config
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
            }

            const enabled = areAlertsEnabled();

            // Restore original config
            if (originalConfig) {
                fs.writeFileSync(configPath, originalConfig);
            }

            expect(enabled).toBe(true);
        });
    });

    describe('Empty Fields Parsing', () => {
        test('should correctly parse multiple empty fields', () => {
            const logLine = JSON.stringify({
                message: '⚠️ INCOMPLETE STEP 2 SUBMISSION - User 111',
                args: [{
                    emptyFields: ['fullName', 'email', 'country', 'phone'],
                    userId: '111'
                }],
                timestamp: '2025-10-09T13:17:01Z'
            });

            const result = parseLogEntry(logLine);

            expect(result.emptyFields).toHaveLength(4);
            expect(result.emptyFields).toContain('fullName');
            expect(result.emptyFields).toContain('email');
            expect(result.emptyFields).toContain('country');
            expect(result.emptyFields).toContain('phone');
        });

        test('should handle single empty field', () => {
            const logLine = JSON.stringify({
                message: '⚠️ INCOMPLETE STEP 2 SUBMISSION - User 222',
                args: [{
                    emptyFields: ['fullName'],
                    userId: '222'
                }]
            });

            const result = parseLogEntry(logLine);

            expect(result.emptyFields).toEqual(['fullName']);
        });

        test('should handle no empty fields for critical alert', () => {
            const logLine = JSON.stringify({
                message: '❌ CRITICAL: All Step 2 fields are empty for user 333!',
                args: [{ userId: '333' }]
            });

            const result = parseLogEntry(logLine);

            expect(result.emptyFields).toEqual([]);
            expect(result.severity).toBe('critical');
        });
    });

    describe('Environment Detection', () => {
        test('should use NODE_ENV for environment', () => {
            process.env.NODE_ENV = 'production';

            const logLine = JSON.stringify({
                message: '⚠️ INCOMPLETE STEP 2 SUBMISSION - User 444',
                args: [{ userId: '444', emptyFields: [] }]
            });

            const result = parseLogEntry(logLine);

            expect(result.environment).toBe('production');
        });

        test('should default to development when NODE_ENV not set', () => {
            delete process.env.NODE_ENV;

            const logLine = JSON.stringify({
                message: '⚠️ INCOMPLETE STEP 2 SUBMISSION - User 555',
                args: [{ userId: '555', emptyFields: [] }]
            });

            const result = parseLogEntry(logLine);

            expect(result.environment).toBe('development');
        });
    });
});
