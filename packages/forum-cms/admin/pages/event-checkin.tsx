import { useCallback, useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import {
  gql,
  useApolloClient,
  useMutation,
} from '@keystone-6/core/admin-ui/apollo'
import jsQR from 'jsqr'

const PREVIEW_EVENT_CHECK_IN_TOKEN = gql`
  query PreviewEventCheckInToken($token: String!) {
    previewEventCheckInToken(token: $token) {
      ok
      canCheckIn
      code
      message
      registrationId
      registrationStatus
      eventTitle
      eventSlug
      memberId
      memberName
      memberNickname
      memberEmail
      registeredAt
      checkedInAt
    }
  }
`

const CONFIRM_EVENT_CHECK_IN = gql`
  mutation ConfirmEventCheckIn($token: String!) {
    confirmEventCheckIn(token: $token) {
      ok
      canCheckIn
      code
      message
      registrationId
      registrationStatus
      eventTitle
      eventSlug
      memberId
      memberName
      memberNickname
      memberEmail
      registeredAt
      checkedInAt
    }
  }
`

type PreviewResult = {
  ok: boolean
  canCheckIn: boolean
  code: string
  message: string
  registrationId?: string | null
  registrationStatus?: string | null
  eventTitle?: string | null
  eventSlug?: string | null
  memberId?: string | null
  memberName?: string | null
  memberNickname?: string | null
  memberEmail?: string | null
  registeredAt?: string | null
  checkedInAt?: string | null
}

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[]
}) => {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>
}

type BarcodeDetectorGlobal = BarcodeDetectorConstructor & {
  getSupportedFormats?: () => Promise<string[]>
}

type QrCodeDetector = {
  detect: (source: HTMLVideoElement) => Promise<string | null>
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '-'
  }
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getBarcodeDetector() {
  if (typeof window === 'undefined') {
    return null
  }
  return (window as typeof window & {
    BarcodeDetector?: BarcodeDetectorGlobal
  }).BarcodeDetector ?? null
}

function detectWithCanvas(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
) {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) {
    return null
  }

  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    return null
  }

  context.drawImage(video, 0, 0, width, height)
  const imageData = context.getImageData(0, 0, width, height)
  const code = jsQR(imageData.data, width, height, {
    inversionAttempts: 'attemptBoth',
  })

  return code?.data.trim() || null
}

async function createQrCodeDetector(
  canvas: HTMLCanvasElement
): Promise<QrCodeDetector> {
  const BarcodeDetector = getBarcodeDetector()
  if (BarcodeDetector) {
    try {
      const supportedFormats = await BarcodeDetector.getSupportedFormats?.()
      if (!supportedFormats || supportedFormats.includes('qr_code')) {
        const detector = new BarcodeDetector({ formats: ['qr_code'] })
        return {
          async detect(source) {
            const codes = await detector.detect(source)
            return codes[0]?.rawValue?.trim() || null
          },
        }
      }
    } catch (_error) {
      // Fall back to the JS decoder when native feature detection fails.
    }
  }

  return {
    async detect(source) {
      return detectWithCanvas(source, canvas)
    },
  }
}

export default function EventCheckInPage() {
  const apolloClient = useApolloClient()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const lastScannedRef = useRef('')

  const [tokenInput, setTokenInput] = useState('')
  const [activeToken, setActiveToken] = useState('')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const [confirmCheckIn, { loading: isConfirming }] = useMutation(
    CONFIRM_EVENT_CHECK_IN
  )

  const stopCamera = useCallback(() => {
    if (frameRef.current != null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setIsCameraActive(false)
  }, [])

  const previewToken = useCallback(
    async (rawToken: string) => {
      const token = rawToken.trim()
      if (!token) {
        setStatusMessage('請輸入或掃描 QR Code')
        return
      }

      setIsPreviewing(true)
      setStatusMessage('')
      setActiveToken(token)
      setTokenInput(token)

      try {
        const result = await apolloClient.query<{
          previewEventCheckInToken: PreviewResult
        }>({
          query: PREVIEW_EVENT_CHECK_IN_TOKEN,
          variables: { token },
          fetchPolicy: 'no-cache',
        })

        setPreview(result.data.previewEventCheckInToken)
      } catch (error) {
        setPreview(null)
        setStatusMessage(error instanceof Error ? error.message : 'QR Code 預覽失敗')
      } finally {
        setIsPreviewing(false)
      }
    },
    [apolloClient]
  )

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('此瀏覽器不支援攝影機存取，請改用手動輸入。')
      return
    }

    try {
      setCameraError('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const canvas = canvasRef.current ?? document.createElement('canvas')
      canvasRef.current = canvas
      const detector = await createQrCodeDetector(canvas)
      setIsCameraActive(true)

      const scan = async () => {
        if (!videoRef.current || !streamRef.current) {
          return
        }

        try {
          const rawValue = await detector.detect(videoRef.current)
          if (rawValue && rawValue !== lastScannedRef.current) {
            lastScannedRef.current = rawValue
            await previewToken(rawValue)
          }
        } catch (_error) {
          // Keep scanning; individual frame decode errors are expected.
        }

        frameRef.current = window.requestAnimationFrame(scan)
      }

      frameRef.current = window.requestAnimationFrame(scan)
    } catch (error) {
      setCameraError(
        error instanceof Error ? error.message : '無法開啟攝影機'
      )
      stopCamera()
    }
  }, [previewToken, stopCamera])

  useEffect(() => stopCamera, [stopCamera])

  async function handleConfirm() {
    if (!activeToken || !preview?.canCheckIn) {
      return
    }

    setStatusMessage('')
    try {
      const result = await confirmCheckIn({
        variables: { token: activeToken },
      })
      const nextPreview = result.data?.confirmEventCheckIn as
        | PreviewResult
        | undefined
      if (nextPreview) {
        setPreview(nextPreview)
        setStatusMessage(nextPreview.message)
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '報到失敗')
    }
  }

  return (
    <>
      <Head>
        <title>活動報到</title>
      </Head>
      <main className="event-checkin-page">
        <h1 className="event-checkin-title">活動報到</h1>

        <section className="event-checkin-section">
          <video
            ref={videoRef}
            muted
            playsInline
            className="scanner-video"
          />
          <div className="scanner-actions">
            <button
              type="button"
              onClick={isCameraActive ? stopCamera : startCamera}
              className="secondary-action-button"
            >
              {isCameraActive ? '停止掃描' : '開始掃描'}
            </button>
          </div>
          {cameraError ? (
            <p className="camera-error">{cameraError}</p>
          ) : null}
        </section>

        <section className="event-checkin-section">
          <label htmlFor="event-check-in-token" className="token-label">
            QR Code token 或 URL
          </label>
          <div className="token-input-row">
            <input
              id="event-check-in-token"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              className="token-input"
            />
            <button
              type="button"
              onClick={() => previewToken(tokenInput)}
              disabled={isPreviewing}
              className="preview-button"
            >
              {isPreviewing ? '查詢中' : '預覽'}
            </button>
          </div>
        </section>

        {preview ? (
          <section className="check-in-card">
            <h2 className="check-in-heading">{preview.message}</h2>
            <dl className="check-in-details">
              <dt>活動</dt>
              <dd>{preview.eventTitle ?? '-'}</dd>
              <dt>會員</dt>
              <dd>
                {preview.memberNickname || preview.memberName || '-'}
                {preview.memberEmail ? ` (${preview.memberEmail})` : ''}
              </dd>
              <dt>狀態</dt>
              <dd>{preview.registrationStatus ?? '-'}</dd>
              <dt>報名時間</dt>
              <dd>{formatDateTime(preview.registeredAt)}</dd>
              <dt>報到時間</dt>
              <dd>{formatDateTime(preview.checkedInAt)}</dd>
            </dl>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!preview.canCheckIn || isConfirming}
              className="confirm-button"
            >
              {isConfirming ? '報到中' : '確認報到'}
            </button>
          </section>
        ) : null}

        {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
      </main>
      <style>{`
        .event-checkin-page {
          box-sizing: border-box;
          max-width: 960px;
          padding: 32px;
        }

        .event-checkin-page * {
          box-sizing: border-box;
        }

        .event-checkin-title {
          margin-top: 0;
        }

        .event-checkin-section {
          margin-bottom: 24px;
        }

        .scanner-video {
          aspect-ratio: 4 / 3;
          background: #0f172a;
          border-radius: 8px;
          display: block;
          max-width: 520px;
          object-fit: cover;
          width: 100%;
        }

        .scanner-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .secondary-action-button,
        .preview-button {
          font: inherit;
          padding: 8px 12px;
          white-space: nowrap;
        }

        .camera-error {
          color: #b45309;
          margin-bottom: 0;
        }

        .token-label {
          display: block;
        }

        .token-input-row {
          display: grid;
          gap: 8px;
          grid-template-columns: minmax(0, 1fr) auto;
          margin-top: 8px;
          max-width: 640px;
        }

        .token-input {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font: inherit;
          font-size: 16px;
          min-width: 0;
          padding: 8px 10px;
          width: 100%;
        }

        .check-in-card {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          max-width: 640px;
          padding: 20px;
          width: 100%;
        }

        .check-in-heading {
          font-size: 20px;
          margin-top: 0;
        }

        .check-in-details {
          display: grid;
          gap: 8px 12px;
          grid-template-columns: minmax(92px, 120px) minmax(0, 1fr);
          margin: 0;
        }

        .check-in-details dt,
        .check-in-details dd {
          margin: 0;
          min-width: 0;
        }

        .check-in-details dd {
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .confirm-button {
          background: #0f766e;
          border: 0;
          border-radius: 6px;
          color: white;
          cursor: pointer;
          font: inherit;
          margin-top: 16px;
          padding: 10px 14px;
        }

        .confirm-button:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        .status-message {
          margin-bottom: 0;
        }

        @media (max-width: 640px) {
          .event-checkin-page {
            max-width: none;
            padding: 20px 16px 32px;
            width: 100%;
          }

          .event-checkin-title {
            font-size: 24px;
          }

          .event-checkin-section {
            margin-bottom: 20px;
          }

          .scanner-video {
            max-width: 100%;
          }

          .check-in-card {
            max-width: none;
            padding: 16px;
          }

          .check-in-details {
            gap: 4px;
            grid-template-columns: 1fr;
          }

          .check-in-details dt {
            font-weight: 600;
            margin-top: 12px;
          }

          .check-in-details dt:first-child {
            margin-top: 0;
          }

          .confirm-button {
            margin-top: 20px;
            width: 100%;
          }
        }

        @media (max-width: 360px) {
          .token-input-row {
            grid-template-columns: 1fr;
          }

          .preview-button {
            width: 100%;
          }
        }
      `}</style>
    </>
  )
}
