/**
 * djb2 string hash of a diagnostics message.
 *
 * Core is linter-agnostic, so it does **not** strip linter-specific noise here.
 * Each adapter is responsible for returning a stabilized `message` (volatile
 * summary lines removed) before this hash is computed — that keeps the
 * fingerprint stable across runs without the core knowing linter details.
 */
export function hashDiagnostics(message: string): number {
  let h = 5381
  for (let i = 0; i < message.length; i++) {
    h = ((h << 5) + h + message.charCodeAt(i)) | 0
  }
  return h
}
