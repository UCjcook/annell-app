# Build Annell App for Windows

## Best option
Build on a real Windows machine.

## Steps
1. Install Node.js LTS
2. Clone the repo
3. Open PowerShell in the project folder
4. Run:

```powershell
npm install
npm run dist
```

## Output
The Windows installer will be created in:

```text
release/
```

## Why build on Windows?
The current Linux/WSL environment can build the app itself, but Windows installer generation through electron-builder needs Windows tooling (or extra compatibility tooling like Wine). Building on Windows is the cleanest path for a real installable `.exe`.
