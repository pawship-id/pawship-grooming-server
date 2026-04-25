import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { TransportOptions } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  private createTransporterConfigs(): TransportOptions[] {
    const user = this.configService.get<string>('EMAIL_USERNAME');
    const pass = this.configService.get<string>('EMAIL_PASSWORD');

    return [
      // Config 1: Gmail service (auto-selects port)
      {
        service: 'gmail',
        auth: { user, pass },
      } as TransportOptions,
      // Config 2: Gmail SMTP port 587 (STARTTLS)
      {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      } as TransportOptions,
      // Config 3: Gmail SMTP port 465 (SSL)
      {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
      } as TransportOptions,
    ];
  }

  private async getWorkingTransporter(): Promise<nodemailer.Transporter> {
    const user = this.configService.get<string>('EMAIL_USERNAME');
    const pass = this.configService.get<string>('EMAIL_PASSWORD');

    if (!user || !pass) {
      throw new Error(
        'Missing required email configuration: EMAIL_USERNAME or EMAIL_PASSWORD',
      );
    }

    const configs = this.createTransporterConfigs();
    let lastError: unknown;

    for (let i = 0; i < configs.length; i++) {
      try {
        this.logger.log(
          `Trying email transporter configuration ${i + 1}/${configs.length}`,
        );
        const transporter = nodemailer.createTransport(configs[i]);

        await Promise.race([
          transporter.verify(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 15000),
          ),
        ]);

        this.logger.log(`Email transporter configuration ${i + 1} connected`);
        return transporter;
      } catch (error) {
        this.logger.warn(`Configuration ${i + 1} failed: ${error}`);
        lastError = error;
      }
    }

    throw new Error(
      `All email configurations failed. Last error: ${lastError}`,
    );
  }

  async sendPasswordSetupEmail(data: {
    email: string;
    username: string;
    token: string;
  }): Promise<void> {
    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const setupLink = `${frontendUrl}/set-password?token=${data.token}`;
    const fromEmail = this.configService.get(
      'EMAIL_FROM',
      'dev.pawship@gmail.com',
    );

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Set Password - Pawship Grooming</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
        .container { background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #4a90e2; margin: 0; }
        .content { margin-bottom: 30px; }
        .button { display: inline-block; padding: 12px 30px; background-color: #4a90e2; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; }
        .button-container { text-align: center; margin: 30px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666; text-align: center; }
        .link { word-break: break-all; color: #4a90e2; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>🐾 Pawship Grooming</h1></div>
        <div class="content">
            <p>Halo <strong>${data.username}</strong>,</p>
            <p>Anda telah meminta untuk mengatur password akun Pawship Grooming Anda. Klik tombol di bawah ini untuk mengatur password Anda:</p>
            <div class="button-container"><a href="${setupLink}" class="button">Set Password</a></div>
            <p>Atau salin dan tempel link berikut ke browser Anda:</p>
            <p class="link">${setupLink}</p>
            <p><strong>Penting:</strong></p>
            <ul>
                <li>Link ini akan kadaluarsa dalam <strong>1 jam</strong></li>
                <li>Jika Anda tidak meminta pengaturan password, abaikan email ini</li>
                <li>Jangan bagikan link ini kepada siapapun</li>
            </ul>
        </div>
        <div class="footer">
            <p>Email ini dikirim secara otomatis, mohon tidak membalas email ini.</p>
            <p>&copy; 2026 Pawship Grooming. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    const mailOptions = {
      from: fromEmail,
      to: data.email,
      subject: 'Set Password - Pawship Grooming',
      html,
    };

    try {
      const transporter = await this.getWorkingTransporter();

      const maxRetries = 2;
      const retryDelay = 3000;
      let lastSendError: unknown;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          this.logger.log(
            `Email send attempt ${attempt}/${maxRetries} to ${data.email}`,
          );

          const result = await Promise.race([
            transporter.sendMail(mailOptions),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error('Send timeout after 30 seconds')),
                30000,
              ),
            ),
          ]);

          this.logger.log(`Password setup email sent to ${data.email}`, {
            messageId: result?.messageId ?? 'unknown',
            accepted: result?.accepted ?? [],
            rejected: result?.rejected ?? [],
          });
          return;
        } catch (sendError) {
          this.logger.warn(
            `Email send attempt ${attempt} failed: ${sendError}`,
          );
          lastSendError = sendError;

          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          }
        }
      }

      throw lastSendError;
    } catch (error) {
      this.logger.error(
        `Failed to send password setup email to ${data.email}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new Error('Failed to send email');
    }
  }
}
