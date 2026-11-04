# Kis napok

Családi naptár étkezések, megfigyelések és jegyzetek rögzítéséhez.

## GitHub Pages

The `Deploy to GitHub Pages` workflow builds the app as a static site and publishes it at:

<https://buikrisz.github.io/food-calendar/>

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. Each push to `master` then builds and deploys the site.

## Local development

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>.
