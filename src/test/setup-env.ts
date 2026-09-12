// Test-only defaults for modules that require env vars at import time.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://localhost:5432/test_db'
}
if (!process.env.NEXTAUTH_SECRET) {
  // Dummy value — middleware tests mock next-auth/jwt, so the secret is never
  // used for real signing; getAuthSecret() only requires its presence.
  process.env.NEXTAUTH_SECRET = 'test-only-secret-not-used-for-signing'
}
