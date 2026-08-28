# Tviy STEP Web

Landing page for the Tviy STEP community, built with Astro.

## Requirements

- Node.js 22.12.0 or newer

## Development

Run commands from this folder:

```sh
npm install
npm run dev
```

The dev server runs at http://localhost:4321 by default.

## Build and Preview

```sh
npm run build
npm run preview
```

## Project Structure

```text
web/
├── public/
│   ├── android-chrome-192x192.png
│   ├── android-chrome-512x512.png
│   ├── apple-touch-icon.png
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── favicon.ico
│   ├── images/
│   │   └── home/
│   │       ├── community-flag-group.webp
│   │       ├── community-skyline-group.webp
│   │       ├── community-view-selfie.webp
│   │       ├── cycling-crew-banner.webp
│   │       └── tviy_step_logo64.png
│   └── site.webmanifest
├── src/
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## Notes

- Files in `public/` are served at stable root URLs (for example `/favicon.ico` and `/images/home/...`).
- `src/pages/index.astro` contains the page content and styling.
- `src/layouts/Layout.astro` contains shared document metadata and favicon links.
