import React, { useMemo, useState } from 'react'
import { FieldProps } from '@keystone-6/core/types'
import {
  FieldContainer,
  FieldDescription,
  FieldLabel,
  TextArea,
} from '@keystone-ui/fields'
import {
  CardValue,
  Cell,
  controller as textController,
} from '@keystone-6/core/fields/types/text/views'

export { CardValue, Cell }
export const controller = textController

type TextFieldProps = FieldProps<typeof textController>
type TextValue = TextFieldProps['value']
type TextField = TextFieldProps['field']

type Validation = TextField['validation']
type MarkdownNode = {
  type:
    | 'paragraph'
    | 'heading'
    | 'unordered-list'
    | 'ordered-list'
    | 'blockquote'
    | 'code'
  text?: string
  level?: number
  items?: string[]
}

function readTextValue(value: TextValue): string {
  return value.inner.kind === 'null' ? '' : value.inner.value
}

function writeTextValue(value: TextValue, nextValue: string): TextValue {
  return {
    ...value,
    inner: {
      kind: 'value',
      value: nextValue,
    },
  }
}

function validate(value: TextValue, validation: Validation, fieldLabel: string): string[] {
  if (
    value.kind === 'update' &&
    ((value.initial.kind === 'null' && value.inner.kind === 'null') ||
      (value.initial.kind === 'value' &&
        value.inner.kind === 'value' &&
        value.inner.value === value.initial.value))
  ) {
    return []
  }

  if (value.inner.kind === 'null') {
    return validation.isRequired ? [`${fieldLabel} is required`] : []
  }

  const text = value.inner.value
  const messages: string[] = []
  if (validation.length.min !== null && text.length < validation.length.min) {
    messages.push(
      validation.length.min === 1
        ? `${fieldLabel} must not be empty`
        : `${fieldLabel} must be at least ${validation.length.min} characters long`
    )
  }
  if (validation.length.max !== null && text.length > validation.length.max) {
    messages.push(`${fieldLabel} must be no longer than ${validation.length.max} characters`)
  }
  if (validation.match && !validation.match.regex.test(text)) {
    messages.push(validation.match.explanation || `${fieldLabel} must match ${validation.match.regex}`)
  }
  return messages
}

function isSafeHref(value: string): boolean {
  return (
    value.startsWith('/') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('mailto:')
  )
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    const key = `${match.index}-${token}`
    if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*')) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>)
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (link && isSafeHref(link[2])) {
        nodes.push(
          <a key={key} href={link[2]} target="_blank" rel="noreferrer">
            {link[1]}
          </a>
        )
      } else {
        nodes.push(token)
      }
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}

function parseMarkdown(markdown: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = []
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let paragraph: string[] = []
  let codeBlock: string[] | null = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    nodes.push({ type: 'paragraph', text: paragraph.join(' ') })
    paragraph = []
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (codeBlock) {
        nodes.push({ type: 'code', text: codeBlock.join('\n') })
        codeBlock = null
      } else {
        flushParagraph()
        codeBlock = []
      }
      continue
    }

    if (codeBlock) {
      codeBlock.push(line)
      continue
    }

    if (!line.trim()) {
      flushParagraph()
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      nodes.push({
        type: 'heading',
        level: heading[1].length,
        text: heading[2],
      })
      continue
    }

    const unorderedList = line.match(/^\s*[-*]\s+(.+)$/)
    if (unorderedList) {
      flushParagraph()
      const previous = nodes[nodes.length - 1]
      if (previous?.type === 'unordered-list') {
        previous.items?.push(unorderedList[1])
      } else {
        nodes.push({ type: 'unordered-list', items: [unorderedList[1]] })
      }
      continue
    }

    const orderedList = line.match(/^\s*\d+\.\s+(.+)$/)
    if (orderedList) {
      flushParagraph()
      const previous = nodes[nodes.length - 1]
      if (previous?.type === 'ordered-list') {
        previous.items?.push(orderedList[1])
      } else {
        nodes.push({ type: 'ordered-list', items: [orderedList[1]] })
      }
      continue
    }

    const quote = line.match(/^\s*>\s?(.+)$/)
    if (quote) {
      flushParagraph()
      nodes.push({ type: 'blockquote', text: quote[1] })
      continue
    }

    paragraph.push(line.trim())
  }

  flushParagraph()
  if (codeBlock) {
    nodes.push({ type: 'code', text: codeBlock.join('\n') })
  }
  return nodes
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  const nodes = useMemo(() => parseMarkdown(markdown), [markdown])

  if (!markdown.trim()) {
    return <p style={{ color: '#6b7280', margin: 0 }}>尚未輸入內容</p>
  }

  return (
    <div>
      {nodes.map((node, index) => {
        if (node.type === 'heading') {
          const HeadingTag = `h${node.level ?? 2}` as keyof JSX.IntrinsicElements
          return (
            <HeadingTag key={index} style={{ margin: '0 0 12px', lineHeight: 1.25 }}>
              {renderInline(node.text ?? '')}
            </HeadingTag>
          )
        }
        if (node.type === 'unordered-list') {
          return (
            <ul key={index} style={{ margin: '0 0 12px', paddingLeft: 24 }}>
              {(node.items ?? []).map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          )
        }
        if (node.type === 'ordered-list') {
          return (
            <ol key={index} style={{ margin: '0 0 12px', paddingLeft: 24 }}>
              {(node.items ?? []).map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ol>
          )
        }
        if (node.type === 'blockquote') {
          return (
            <blockquote
              key={index}
              style={{
                borderLeft: '3px solid #d1d5db',
                color: '#4b5563',
                margin: '0 0 12px',
                paddingLeft: 12,
              }}
            >
              {renderInline(node.text ?? '')}
            </blockquote>
          )
        }
        if (node.type === 'code') {
          return (
            <pre
              key={index}
              style={{
                background: '#f3f4f6',
                borderRadius: 6,
                margin: '0 0 12px',
                overflowX: 'auto',
                padding: 12,
              }}
            >
              <code>{node.text}</code>
            </pre>
          )
        }
        return (
          <p key={index} style={{ lineHeight: 1.7, margin: '0 0 12px' }}>
            {renderInline(node.text ?? '')}
          </p>
        )
      })}
    </div>
  )
}

function applyMarkdown(
  text: string,
  fieldPath: string,
  before: string,
  after = before
): string {
  const input = document.getElementById(fieldPath) as HTMLTextAreaElement | null
  if (!input) return `${text}${before}${after === before ? '' : after}`

  const start = input.selectionStart
  const end = input.selectionEnd
  const selected = text.slice(start, end)
  const nextSelected = selected ? `${before}${selected}${after}` : `${before}${after}`
  const nextValue = `${text.slice(0, start)}${nextSelected}${text.slice(end)}`

  window.requestAnimationFrame(() => {
    const nextCursor = selected
      ? start + before.length + selected.length + after.length
      : start + before.length
    input.focus()
    input.setSelectionRange(nextCursor, nextCursor)
  })

  return nextValue
}

function applyList(text: string, fieldPath: string, prefix: string): string {
  const input = document.getElementById(fieldPath) as HTMLTextAreaElement | null
  if (!input) return `${text}\n${prefix}`

  const start = input.selectionStart
  const end = input.selectionEnd
  const selected = text.slice(start, end)
  const selectedLines = selected ? selected.split('\n') : ['']
  const nextSelected = selectedLines.map((line) => `${prefix}${line}`).join('\n')
  const nextValue = `${text.slice(0, start)}${nextSelected}${text.slice(end)}`

  window.requestAnimationFrame(() => {
    input.focus()
    input.setSelectionRange(start + prefix.length, start + nextSelected.length)
  })

  return nextValue
}

const toolbarButtons = [
  { label: 'H2', title: 'Heading', before: '## ', after: '' },
  { label: 'B', title: 'Bold', before: '**', after: '**' },
  { label: 'I', title: 'Italic', before: '*', after: '*' },
  { label: '<>', title: 'Inline code', before: '`', after: '`' },
  { label: 'Link', title: 'Link', before: '[', after: '](https://)' },
]

export function Field({
  field,
  value,
  onChange,
  autoFocus,
  forceValidation,
}: TextFieldProps) {
  const [shouldShowErrors, setShouldShowErrors] = useState(false)
  const text = readTextValue(value)
  const validationMessages = validate(value, field.validation, field.label)
  const descriptionId = `${field.path}-description`

  const updateValue = (nextValue: string) => {
    onChange?.(writeTextValue(value, nextValue))
  }

  return (
    <FieldContainer>
      <FieldLabel htmlFor={field.path}>{field.label}</FieldLabel>
      <FieldDescription id={descriptionId}>{field.description}</FieldDescription>
      {onChange ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {toolbarButtons.map((button) => (
              <button
                key={button.title}
                type="button"
                title={button.title}
                onClick={() =>
                  updateValue(applyMarkdown(text, field.path, button.before, button.after))
                }
                style={{
                  background: '#fff',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  minHeight: 32,
                  padding: '5px 10px',
                }}
              >
                {button.label}
              </button>
            ))}
            <button
              type="button"
              title="Bullet list"
              onClick={() => updateValue(applyList(text, field.path, '- '))}
              style={{
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: 'pointer',
                minHeight: 32,
                padding: '5px 10px',
              }}
            >
              List
            </button>
            <button
              type="button"
              title="Numbered list"
              onClick={() => updateValue(applyList(text, field.path, '1. '))}
              style={{
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: 'pointer',
                minHeight: 32,
                padding: '5px 10px',
              }}
            >
              1.
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            }}
          >
            <TextArea
              id={field.path}
              autoFocus={autoFocus}
              value={text}
              onBlur={() => setShouldShowErrors(true)}
              onChange={(event) => updateValue(event.target.value)}
              aria-describedby={field.description === null ? undefined : descriptionId}
              style={{ minHeight: 360, resize: 'vertical' }}
            />
            <div
              aria-label="Markdown preview"
              style={{
                border: '1px solid #d1d5db',
                borderRadius: 6,
                minHeight: 360,
                overflow: 'auto',
                padding: 16,
              }}
            >
              <MarkdownPreview markdown={text} />
            </div>
          </div>
          {!!validationMessages.length &&
            (shouldShowErrors || forceValidation) &&
            validationMessages.map((message, index) => (
              <span key={index} style={{ color: 'red' }}>
                {message}
              </span>
            ))}
        </div>
      ) : (
        <MarkdownPreview markdown={text} />
      )}
    </FieldContainer>
  )
}
