const HEADER = '--- opencode-oxc-lint ---'
const FOOTER = '--- end opencode-oxc-lint ---'

export function formatAgentOutput(message: string): string {
  return `\n${HEADER}\n${message.trim()}\n${FOOTER}`
}

export function appendAgentOutput(current: string, message: string): string {
  return `${current}${formatAgentOutput(message)}`
}
