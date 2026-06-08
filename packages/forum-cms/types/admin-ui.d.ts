/// <reference types="@emotion/react/types/css-prop" />

declare module 'bytes' {
  function bytes(value: number, options?: Record<string, unknown>): string
  export = bytes
}

declare module 'uuid' {
  export function validate(value: string): boolean
}
