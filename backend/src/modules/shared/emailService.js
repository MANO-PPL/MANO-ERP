import nodemailer from 'nodemailer';
import AppError from '../../utils/AppError.js';

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail', // e.g., 'gmail', 'SendGrid'
            auth: process.env.EMAIL_CLIENT_ID ? {
                type: 'OAuth2',
                user: process.env.EMAIL_USER,
                clientId: process.env.EMAIL_CLIENT_ID,
                clientSecret: process.env.EMAIL_CLIENT_SECRET,
                refreshToken: process.env.EMAIL_REFRESH_TOKEN,
            } : {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }

    /**
     * Send an email
     * @param {string} to - Recipient email address
     * @param {string} subject - Email subject
     * @param {string} text - Plain text body
     * @param {string} html - HTML body (optional)
     */
    async sendEmail(to, subject, text, html = null) {
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to,
            subject,
            text,
            html: html || text, // Fallback to text if HTML not provided
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent: %s', info.messageId);
            return info;
        } catch (error) {
            console.error('Error sending email:', error);
            throw new AppError('Failed to send email', 500);
        }
    }
}

export default new EmailService();
