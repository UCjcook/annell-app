# Annell App

Windows-first order urgency board for handmade sellers.

Current app highlights:
- local SQLite persistence for orders and settings
- Shopify client-credentials sync flow
- manual order entry with status + notes
- search and hide-done filtering
- optional background auto-sync while the app is open
- desktop reminders for urgent orders
- saved sync result state for easier troubleshooting

## Run in development

```bash
npm install
npm run dev
```

## Build renderer

```bash
npm run build
```

## Package Windows app

```bash
npm run dist
```

This uses electron-builder to create a Windows installer in `release/`.

For the cleanest packaging path, see [WINDOWS-BUILD.md](./WINDOWS-BUILD.md).

## First-time setup inside the app

1. Enter your Shopify store domain
2. Enter your client ID
3. Enter your client secret
4. Save settings
5. Click **Sync Shopify orders**

After that, the app can auto-sync while open and you can use manual orders as a fallback.
