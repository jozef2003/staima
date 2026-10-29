export const AUTH_COOKIE = 'crk_auth'

export function authConfig() {
  return {
    user: process.env.BASIC_AUTH_USER || 'crk',
    pass: process.env.BASIC_AUTH_PASSWORD || '',
  }
}

/** Deterministischer Token aus dem Passwort (SHA-256) — das Cookie enthält nie das Klartext-PW. */
export async function tokenFor(pass: string): Promise<string> {
  const data = new TextEncoder().encode('crk-lead-agent::v1::' + pass)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
