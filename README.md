# Nibras (نبراس)

React + TypeScript + Vite. See `.env.example` for client-side config —
copy to `.env` and fill in as needed (never commit `.env`).

## AI features (Reading Buddy voice, AI Assistant, Mind Maps)

These run in DEMO mode out of the box — no setup needed. A real,
server-side AI backend can be wired in later by deploying the
contract documented in `server/README.md` and setting
`VITE_AI_BACKEND_URL`. Provider API keys are server-side only and must
never be added to this project's client-side `.env`.

## Deployment (SPA fallback required)

This is a single-page app; all navigation between pages happens on the
client via `react-router`. Any static host serving the built `dist/`
folder needs a fallback rule that rewrites unknown paths back to
`index.html`. Without one, a deep link (typing `/reader` directly, or
just refreshing the page on any route other than `/`) returns a 404 in
production, even though the same build works fine locally under
`npm run preview`.

Rules for common hosts:

- **nginx**
  ```
  location / {
    try_files $uri $uri/ /index.html;
  }
  ```
- **Netlify**: add `public/_redirects` (so it ships inside `dist/`)
  containing:
  ```
  /*    /index.html   200
  ```
  or the equivalent in `netlify.toml`:
  ```toml
  [[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
  ```
- **Vercel**: add `vercel.json` at the project root:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```
- **Apache**: add to `.htaccess` in the served root:
  ```
  FallbackResource /index.html
  ```

None of these rules affect real static files (the JS/CSS/images under
`/assets`): each host resolves an actual file first and only falls
back to `index.html` once nothing on disk matches the request path, so
normal asset loading is unaffected. Pick the one rule that matches
whichever host the co-owning company deploys to; the others are here
for reference in case that changes.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
