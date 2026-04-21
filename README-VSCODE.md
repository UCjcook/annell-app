# Annell App - VS Code Setup Guide

This file is for opening and finishing the app in **VS Code on Windows**.

## What this project is
Annell App is a Windows-first desktop app for Josh's household to help track handmade shop orders.

Current purpose:
- pull open Shopify orders into one board
- show what is new, due soon, overdue, or done
- let the household update status and notes quickly
- send reminders for urgent orders
- allow manual backup entry when needed

This is meant to be practical and easy to use, not a giant business suite.

## Current status
The app already has:
- Electron desktop shell
- React UI
- local SQLite persistence
- Shopify sync using **client credentials flow**
- manual orders
- notes editing
- status editing
- search/filtering
- auto-sync while the app is open
- reminder notifications
- Windows packaging config via electron-builder

## Important Shopify auth context
Do **not** look for a copied Admin API token in Shopify admin.
This app uses the newer **client credentials** flow.

That means the app needs:
- store domain
- client ID
- client secret

The app requests access tokens programmatically when syncing.

## Windows setup in VS Code
1. Install **Node.js LTS** if it is not already installed
2. Open this project folder in **VS Code**
3. Open the integrated terminal
4. Run:

```powershell
npm install
```

## Run the app in development
```powershell
npm run dev
```

## Build the Windows installer
```powershell
npm run dist
```

The installer output should appear in:

```text
release/
```

## First-time setup inside the app
Enter these in the app settings:
- **Store domain**: `hmpss1-y4.myshopify.com`
- **Client ID**: use the Shopify app client ID
- **Client secret**: use the Shopify app client secret
- set production window days if needed
- click **Save settings**
- click **Sync Shopify orders**

## If packaging fails
If `npm run dist` fails on Linux/WSL, build it on real Windows instead.
That is expected and normal for this project.

## Priority if continuing work
If someone continues building this app, the best next priorities are:
1. make Windows install/build smooth
2. improve startup behavior for normal non-technical use
3. test real order workflow with Josh's wife
4. fix annoyances found in real household use
5. optionally add Etsy later

## Design intent
This should feel:
- calm
- clear
- supportive
- low-friction
- not like ugly admin software

It is for a real household, not just a demo.
