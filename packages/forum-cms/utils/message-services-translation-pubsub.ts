import { GoogleAuth } from 'google-auth-library'
import envVar from '../environment-variables'
import type { MessageServicesEntityType } from './message-services-translation-hook'

type TranslationPayload = {
  type: MessageServicesEntityType
  id: string
  source_text: string
  source_title?: string
}

const PUBSUB_SCOPE = 'https://www.googleapis.com/auth/pubsub'
let warnedMissingTopic = false

function getTopicName() {
  return envVar.messageServices.translationPubsubTopic?.trim() || ''
}

function getProjectId() {
  return (
    envVar.messageServices.translationPubsubProjectId?.trim() ||
    envVar.firebase.projectId?.trim() ||
    ''
  )
}

function buildTopicPath() {
  const topic = getTopicName()
  if (!topic) return ''
  if (topic.startsWith('projects/')) return topic

  const projectId = getProjectId()
  if (!projectId) {
    throw new Error(
      'MESSAGE_SERVICES_TRANSLATION_PUBSUB_PROJECT_ID or FIREBASE_PROJECT_ID is required'
    )
  }

  return `projects/${projectId}/topics/${topic}`
}

export function shouldPublishTranslationViaPubSub(
  entityType: MessageServicesEntityType
) {
  return (entityType === 'post' || entityType === 'comment') && Boolean(getTopicName())
}

export function warnMissingPubSubTopicOnce() {
  if (warnedMissingTopic) return
  warnedMissingTopic = true
  console.warn(
    JSON.stringify({
      severity: 'WARN',
      message:
        'MESSAGE_SERVICES_TRANSLATION_PUBSUB_TOPIC 未設定，post/comment 翻譯仍會走同步 HTTP request。',
      timestamp: new Date().toISOString(),
    })
  )
}

export async function publishMessageServicesTranslationJob(
  payload: TranslationPayload
) {
  const topicPath = buildTopicPath()
  if (!topicPath) {
    throw new Error('MESSAGE_SERVICES_TRANSLATION_PUBSUB_TOPIC is required')
  }

  const auth = new GoogleAuth({
    scopes: [PUBSUB_SCOPE],
    projectId: getProjectId() || undefined,
  })
  const client = await auth.getClient()
  const tokenResponse = await client.getAccessToken()
  const accessToken =
    typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token

  if (!accessToken) {
    throw new Error('Failed to acquire Google access token for Pub/Sub')
  }

  const response = await fetch(
    `https://pubsub.googleapis.com/v1/${topicPath}:publish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messages: [
          {
            data: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'),
            attributes: {
              type: payload.type,
              entityId: payload.id,
              source: 'forum-cms',
            },
          },
        ],
      }),
    }
  )

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(
      `Pub/Sub publish failed (${response.status}): ${detail.slice(0, 2000)}`
    )
  }

  const result = (await response.json()) as { messageIds?: string[] }
  return {
    topicPath,
    messageIds: result.messageIds ?? [],
  }
}
