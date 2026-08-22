# Browser tests

These Playwright tests cover report submission controls, the map location
picker, ownership management, confirmation undo affordances, and invalid image
selection behavior.

Enable them in a development or CI environment with:

```powershell
npm install --save-dev @playwright/test
npx playwright install chromium
npx playwright test
```

The repository environment used for this change could not download new npm
packages, so the browser suite was added but not executed here. Unit tests,
typechecking, linting, and the production build remain independent of the
optional browser dependency.
