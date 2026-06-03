/** Result of a lint check (no fix). */
export interface LintCheckResult {
  passed: boolean
  output: string
}

/** Result of a lint fix attempt. */
export interface LintFixResult {
  fixed: boolean
  remaining: number
  output: string
}
