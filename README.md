# Tviy STEP

Repository for the Tviy STEP project.

## Repository Layout

- concept: Strategy, notes, and source materials.
- web: Astro website codebase.

## Web App

The Astro app lives in the web folder.

Requirements:
- Node.js 22.12.0 or newer

Run locally:
- cd web
- npm install
- npm run dev

Default local URL: http://localhost:4321

Build and preview:
- cd web
- npm run build
- npm run preview

## Current Structure

- concept/
- concept/raw/
- web/
- web/public/
- web/public/images/home/
- web/src/layouts/Layout.astro
- web/src/pages/index.astro

## Notes

- Static public files are in web/public and served from root URLs at runtime.
- Shared document shell and metadata are defined in web/src/layouts/Layout.astro.
- Main landing page content and styles are in web/src/pages/index.astro.
