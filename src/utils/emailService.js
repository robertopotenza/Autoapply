const logger = require('./logger');
const axios = require('axios');

// Email service configuration
// For production, use services like SendGrid, Mailgun, AWS SES, or Resend
// For now, we'll use a simple SMTP or log-based approach

const EMAIL_SERVICE = process.env.EMAIL_SERVICE || 'console'; // 'console', 'smtp', 'sendgrid', 'resend'

class EmailService {
    async sendMagicLink(email, magicLink) {
        const subject = 'Your Auto-Apply Login Link';
        const html = this.getMagicLinkTemplate(magicLink);
        const text = `Click here to log in to Auto-Apply: ${magicLink}\n\nThis link will expire in 15 minutes.`;

        if (EMAIL_SERVICE === 'console') {
            // For development - log to console
            logger.info('='.repeat(60));
            logger.info('📧 MAGIC LINK EMAIL (Development Mode)');
            logger.info('='.repeat(60));
            logger.info(`To: ${email}`);
            logger.info(`Subject: ${subject}`);
            logger.info(`\nMagic Link: ${magicLink}`);
            logger.info('='.repeat(60));
            return { success: true, mode: 'console' };
        } else if (EMAIL_SERVICE === 'resend') {
            return await this.sendViaResend(email, subject, html, text);
        } else if (EMAIL_SERVICE === 'sendgrid') {
            return await this.sendViaSendGrid(email, subject, html, text);
        } else if (EMAIL_SERVICE === 'smtp') {
            return await this.sendViaSMTP(email, subject, html, text);
        }

        throw new Error('Invalid email service configured');
    }

    getMagicLinkTemplate(magicLink) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Login Link</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">🚀 Auto-Apply</h1>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 16px 0; font-size: 24px; color: #1f2937;">Your Login Link is Ready</h2>
                            <p style="margin: 0 0 24px 0; font-size: 16px; color: #6b7280; line-height: 1.6;">
                                Click the button below to securely log in to your Auto-Apply account. This link will expire in 15 minutes.
                            </p>

                            <!-- Button -->
                            <div style="text-align: center; margin: 32px 0;">
                                <a href="${magicLink}" style="display: inline-block; background-color: #7c3aed; color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                    Sign In to Auto-Apply
                                </a>
                            </div>

                            <p style="margin: 24px 0 0 0; font-size: 14px; color: #9ca3af;">
                                Or copy and paste this URL into your browser:<br>
                                <a href="${magicLink}" style="color: #7c3aed; word-break: break-all;">${magicLink}</a>
                            </p>

                            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

                            <p style="margin: 0; font-size: 14px; color: #9ca3af;">
                                If you didn't request this login link, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px; background-color: #f9fafb; text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                                Auto-Apply - Automated Job Application Platform<br>
                                Powered by AI
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    async sendViaResend(email, subject, html, text) {
        // Resend.com integration
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            throw new Error('RESEND_API_KEY not configured');
        }

        try {
            const response = await axios.post('https://api.resend.com/emails', {
                from: process.env.EMAIL_FROM || 'Auto-Apply <onboarding@resend.dev>',
                to: [email],
                subject: subject,
                html: html,
                text: text
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            logger.info(`Magic link email sent to ${email} via Resend (ID: ${response.data.id})`);
            return { success: true, mode: 'resend', id: response.data.id };
        } catch (error) {
            logger.error('Error sending email via Resend:', error.response?.data || error.message);
            throw new Error(`Resend API error: ${error.response?.data?.message || error.message}`);
        }
    }

    async sendViaSendGrid(email, subject, html, text) {
        // SendGrid integration
        const apiKey = process.env.SENDGRID_API_KEY;
        if (!apiKey) {
            throw new Error('SENDGRID_API_KEY not configured');
        }

        try {
            const response = await axios.post('https://api.sendgrid.com/v3/mail/send', {
                personalizations: [{
                    to: [{ email: email }]
                }],
                from: {
                    email: process.env.EMAIL_FROM || 'noreply@autoapply.com',
                    name: 'Auto-Apply'
                },
                subject: subject,
                content: [
                    { type: 'text/plain', value: text },
                    { type: 'text/html', value: html }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            logger.info(`Magic link email sent to ${email} via SendGrid`);
            return { success: true, mode: 'sendgrid' };
        } catch (error) {
            logger.error('Error sending email via SendGrid:', error.response?.data || error.message);
            throw new Error(`SendGrid API error: ${error.response?.data?.errors?.[0]?.message || error.message}`);
        }
    }

    async sendViaSMTP(email, subject, html, text) {
        // For SMTP, you would use nodemailer
        // This is a placeholder
        logger.info(`Would send email to ${email} via SMTP`);
        return { success: true, mode: 'smtp' };
    }
}

module.exports = new EmailService();
