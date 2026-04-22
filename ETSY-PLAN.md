# Etsy integration plan for Annell App

## Goal
Add real Etsy connection and syncing using desktop-local OAuth.

## Verified auth shape
Etsy Open API v3 uses:
- OAuth 2.0 authorization code flow
- PKCE
- redirect URI / callback handling
- access token + refresh token

## Recommended architecture
Use a localhost callback inside Electron rather than a hosted backend.

### Flow
1. User opens Settings.
2. User clicks Connect Etsy.
3. Electron app starts a temporary local HTTP server on localhost.
4. App generates state + PKCE verifier/challenge.
5. App opens Etsy authorize URL in the browser.
6. Etsy redirects back to localhost callback.
7. App validates state.
8. App exchanges auth code for access + refresh tokens.
9. App stores Etsy tokens/settings in local SQLite settings table.
10. App fetches open/unfulfilled Etsy orders and maps them into local orders table.

## Data we need to store
- etsyClientId
- etsyRedirectPort
- etsyAccessToken
- etsyRefreshToken
- etsyTokenExpiresAt
- etsyShopId or selected shop identifier if required
- etsyLastSyncAt
- etsyLastSyncStatus
- etsyLastSyncMessage

## User-facing UX
Settings should include:
- Connect Etsy button
- Connected / not connected state
- Disconnect Etsy button
- Sync Etsy orders button
- plain language, no raw OAuth jargon unless absolutely necessary

## Implementation notes
- Keep Shopify flow working.
- Make changes incrementally because current repo has some recently hand-fixed JS.
- Prefer targeted edits over file rewrites.
- Remove or reduce seeded Etsy demo assumptions once real Etsy sync exists.
