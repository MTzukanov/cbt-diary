# CBT Diary

**Live:** https://mtzukanov.github.io/cbt-diary/

A mobile-first diary for the CBT "SMER" method: **S**ituation, thoughts (**M**ysli),
**E**motions, **R**eactions, plus conclusions. Plain HTML, CSS and JavaScript with no build step
and no runtime dependencies.

All data stays in your browser's `localStorage`. Nothing is sent anywhere. Export regularly as a
backup.

## Entries from an AI chat

**New entry -> Or talk it through with an AI chat** copies a prompt built from your fields and
emotions. Paste it into ChatGPT, Claude, Gemini or another chat; it interviews you and ends with a
JSON block (`"format": "cbt-diary/v1"`). Paste that back, review the entries, and save the ones you
want. The app itself still sends nothing anywhere; the chat is a service you choose.

## Run locally

ES modules do not load from `file://`, so serve the folder:

```bash
npm run serve        # python3 -m http.server 8080
# open http://localhost:8080
```

## Add to home screen

- **iPhone (Safari):** Share -> Add to Home Screen.
- **Android (Chrome):** menu -> Install app / Add to Home screen.

`sw.js` caches the app so it opens offline. It serves the cached copy first and refreshes it in the
background, so after a deploy (or a local edit) the new version appears on the *second* load. When
you add a file under `js/`, `css/` or `icons/`, list it in `SHELL` in `sw.js`. A test checks this.
Home-screen apps are also exempt from Safari's 7-day storage cleanup for websites.

## Test

```bash
npm test             # node --test, no dependencies
```

## Deploy

`.github/workflows/deploy.yml` runs the tests and publishes the site to GitHub Pages on every push
to `main`. In the repository settings, set **Pages -> Source** to **GitHub Actions** once.

## License

[MIT](LICENSE)
