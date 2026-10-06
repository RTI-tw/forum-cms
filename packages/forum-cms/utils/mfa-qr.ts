import QRCode from 'qrcode'

/** Generate locally; enrollment secrets must never be sent to a QR image service. */
export async function enrollmentQrCode(secret: string, email: string): Promise<string> {
  const issuer = 'RTI Forum CMS'
  const parameters = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' })
  const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?${parameters}`
  return QRCode.toDataURL(uri, { width: 300, margin: 4, errorCorrectionLevel: 'M' })
}
