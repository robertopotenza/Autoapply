/**
 * Slack Alert Utility
 * Sends alerts to Slack via webhook for critical system events
 */

const https = require('https');
const { Logger } = require('./logger');

const logger = new Logger('SlackAlert');

/**
 * Send a Slack alert via webhook
 * @param {string} message - The alert message to send
 * @param {Object} options - Optional configuration
 * @param {string} options.environment - Environment (defaults to NODE_ENV)
 * @param {string} options.error - Error message or object
 * @returns {Promise<void>}
 */
async function sendSlackAlert(message, options = {}) {
    const webhook = process.env.ALERTS_SLACK_WEBHOOK;
    
    if (!webhook) {
        logger.debug('ALERTS_SLACK_WEBHOOK not configured, skipping Slack alert');
        return;
    }

    const environment = options.environment || process.env.NODE_ENV || 'development';
    const timestamp = new Date().toISOString();
    
    // Format the error details if provided
    let errorDetails = '';
    if (options.error) {
        if (typeof options.error === 'string') {
            errorDetails = options.error;
        } else if (options.error.message) {
            errorDetails = options.error.message;
        } else {
            errorDetails = JSON.stringify(options.error);
        }
    }

    // Build the full message
    let fullMessage = `🚨 AutoApply Admin Alert\n`;
    fullMessage += `Message: ${message}\n`;
    fullMessage += `Environment: ${environment}\n`;
    if (errorDetails) {
        fullMessage += `Error: ${errorDetails}\n`;
    }
    fullMessage += `Time: ${timestamp}`;

    const payload = {
        text: fullMessage
    };

    return new Promise((resolve, reject) => {
        const webhookUrl = new URL(webhook);
        const data = JSON.stringify(payload);

        const options = {
            hostname: webhookUrl.hostname,
            path: webhookUrl.pathname + webhookUrl.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            
            res.on('data', (chunk) => {
                responseBody += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    logger.info('Slack alert sent successfully');
                    resolve();
                } else {
                    const error = new Error(`Slack webhook failed with status ${res.statusCode}: ${responseBody}`);
                    logger.error('Slack alert failed', { 
                        statusCode: res.statusCode, 
                        response: responseBody 
                    });
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            logger.error('Slack alert request error', { error: error.message });
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

module.exports = { sendSlackAlert };
