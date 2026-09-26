# CBT Diary

A mobile-first diary for the CBT "SMER" method: **S**ituation, thoughts (**M**ysli),
**E**motions, **R**eactions, plus conclusions. Plain HTML, CSS and JavaScript with no build step
and no runtime dependencies.

All data stays in your browser's `localStorage`. Nothing is sent anywhere. Export regularly as a
backup.

## Run locally

ES modules do not load from `file://`, so serve the folder:

```bash
npm run serve        # python3 -m http.server 8080
# open http://localhost:8080
```

## Test

```bash
npm test             # node --test, no dependencies
```

## Deploy

`.github/workflows/deploy.yml` runs the tests and publishes the site to GitHub Pages on every push
to `main`. In the repository settings, set **Pages -> Source** to **GitHub Actions** once.
