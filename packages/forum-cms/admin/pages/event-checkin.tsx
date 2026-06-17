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
      <main style={{ padding: '32px', maxWidth: 960 }}>
        <h1 style={{ marginTop: 0 }}>活動報到</h1>

        <section style={{ marginBottom: 24 }}>
          <video
            ref={videoRef}
            muted
            playsInline
            style={{
              width: '100%',
              maxWidth: 520,
              aspectRatio: '4 / 3',
              background: '#0f172a',
              borderRadius: 8,
              display: 'block',
              objectFit: 'cover',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={isCameraActive ? stopCamera : startCamera}
              style={{ padding: '8px 12px' }}
            >
              {isCameraActive ? '停止掃描' : '開始掃描'}
            </button>
          </div>
          {cameraError ? (
            <p style={{ color: '#b45309', marginBottom: 0 }}>{cameraError}</p>
          ) : null}
        </section>

        <section style={{ marginBottom: 24 }}>
          <label htmlFor="event-check-in-token" style={{ display: 'block' }}>
            QR Code token 或 URL
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              id="event-check-in-token"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '8px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
              }}
            />
            <button
              type="button"
              onClick={() => previewToken(tokenInput)}
              disabled={isPreviewing}
              style={{ padding: '8px 12px' }}
            >
              {isPreviewing ? '查詢中' : '預覽'}
            </button>
          </div>
        </section>

        {preview ? (
          <section
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: 20,
              maxWidth: 640,
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 20 }}>{preview.message}</h2>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr',
                gap: '8px 12px',
              }}
            >
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
              style={{
                marginTop: 16,
                padding: '10px 14px',
                background: preview.canCheckIn ? '#0f766e' : '#94a3b8',
                color: 'white',
                border: 0,
                borderRadius: 6,
                cursor: preview.canCheckIn ? 'pointer' : 'not-allowed',
              }}
            >
              {isConfirming ? '報到中' : '確認報到'}
            </button>
          </section>
        ) : null}

        {statusMessage ? <p>{statusMessage}</p> : null}
      </main>
    </>
  )
}
