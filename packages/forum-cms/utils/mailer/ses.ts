import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import type { Mailer, SendMailOptions } from './index'

export interface SesMailerOptions {
  region: string
  from: string
}

export class SesMailer implements Mailer {
  private client: SESClient
  private from: string

  constructor(options: SesMailerOptions) {
    this.from = options.from
    // AWS SDK will automatically use credentials from:
    // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    // 2. Shared credentials file (~/.aws/credentials)
    // 3. IAM Role (when running on EC2, ECS, Lambda, etc.)
    this.client = new SESClient({
      region: options.region,
    })
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const command = new SendEmailCommand({
      Source: this.from,
      Destination: {
        ToAddresses: [options.to],
      },
      Message: {
        Subject: {
          Data: options.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data: options.text,
            Charset: 'UTF-8',
          },
          ...(options.html
            ? {
                Html: {
                  Data: options.html,
                  Charset: 'UTF-8',
                },
              }
            : {}),
        },
      },
    })

    try {
      await this.client.send(command)

      console.log(
        JSON.stringify({
          severity: 'INFO',
          message: 'Email sent via AWS SES',
          type: 'SES_MAILER',
          to: options.to,
          subject: options.subject,
          timestamp: new Date().toISOString(),
        })
      )
    } catch (error) {
      console.error(
        JSON.stringify({
          severity: 'ERROR',
          message: 'Failed to send email via AWS SES',
          type: 'SES_MAILER',
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
