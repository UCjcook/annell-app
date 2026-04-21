# Annell App

Windows-first order urgency board for handmade sellers.

Current app highlights:
- local SQLite persistence for orders and settings
- manual order entry with status + notes
- Shopify sync with saved last-sync result
- optional background auto-sync while the app is open
- desktop reminders for urgent orders

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
