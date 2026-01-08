import nodemailer from 'nodemailer'
import type { Mailer, SendMailOptions } from './index'

export interface SmtpMailerOptions {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from: string
}

export class SmtpMailer implements Mailer {
  private transporter: ReturnType<typeof nodemailer.createTransport> | null = null
  private from: string
  private options: SmtpMailerOptions

  constructor(options: SmtpMailerOptions) {
    this.options = options
    this.from = options.from

    if (options.host) {
      this.transporter = nodemailer.createTransport({
        host: options.host,
        port: options.port,
        secure: options.secure,
        auth:
          options.user && options.password
            ? {
                user: options.user,
                pass: options.password,
              }
            : undefined,
      })
    }
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    if (!this.transporter) {
      console.warn(
        JSON.stringify({
          severity: 'WARN',
          message: 'SMTP not configured, email not sent',
          type: 'SMTP_MAILER',
          to: options.to,
          subject: options.subject,
          timestamp: new Date().toISOString(),
        })
      )
      return
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      })

      console.log(
        JSON.stringify({
          severity: 'INFO',
          message: 'Email sent via SMTP',
          type: 'SMTP_MAILER',
          to: options.to,
          subject: options.subject,
          timestamp: new Date().toISOString(),
        })
      )
    } catch (error) {
      console.error(
        JSON.stringify({
          severity: 'ERROR',
          message: 'Failed to send email via SMTP',
          type: 'SMTP_MAILER',
          to: options.to,
          subject: options.subject,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      )
      throw error
    }
  }
}
