import envVar from '../../environment-variables'
import { SmtpMailer } from './smtp'
import { SesMailer } from './ses'

export interface SendMailOptions {
  to: string
  subject: string
  text: string
  html?: string
}

export interface Mailer {
  sendMail(options: SendMailOptions): Promise<void>
}

let mailerInstance: Mailer | null = null

/**
 * Creates a mailer instance based on the MAILER_PROVIDER environment variable.
 * Returns a singleton instance.
 */
export function createMailer(): Mailer {
  if (mailerInstance) {
    return mailerInstance
  }

  const provider = envVar.mailer.provider

  if (provider === 'ses') {
    mailerInstance = new SesMailer({
      region: envVar.ses.region,
      from: envVar.email.from,
    })
  } else {
    mailerInstance = new SmtpMailer({
      host: envVar.email.smtpHost,
      port: envVar.email.smtpPort,
      secure: envVar.email.smtpSecure,
      user: envVar.email.smtpUser,
      password: envVar.email.smtpPassword,
      from: envVar.email.from,
    })
  }

  console.log(
    JSON.stringify({
      severity: 'INFO',
      message: `Mailer initialized with provider: ${provider}`,
      type: 'MAILER_INIT',
      provider,
      timestamp: new Date().toISOString(),
    })
  )

  return mailerInstance
}

/**
 * Get the current mailer instance, creating one if it doesn't exist.
 */
export function getMailer(): Mailer {
  return createMailer()
}
