// Settings of the page tests (npm run test:pages), see "Page tests" in the README.

export const baseUrl = (process.env.ICMS_TEST_URL ?? 'http://localhost').replace(/\/$/, '')

// Playwright drives a locally installed browser, so nothing has to be downloaded: chrome, msedge, …
export const browserChannel = process.env.ICMS_TEST_BROWSER ?? 'chrome'

export const viewports = {
    mobile: { width: 375, height: 812 },
    laptop: { width: 1280, height: 800 },
    wide: { width: 1920, height: 1000 },
}

/**
 * The pages to test, relative to baseUrl. Add the pages of the modules the theme overrides templates for.
 * The core pages below exist on every ImpressCMS site.
 */
export const pages = [
    { name: 'home', url: '/' },
    { name: 'login', url: '/user.php' },
    { name: 'search', url: '/search.php' },
]

// Console errors that come from modules or third parties and not from the theme, as regular expressions
export const ignoredConsoleErrors = []

// CSS selectors of elements that axe skips, e.g. widgets that a module adds to every page
export const axeExclude = []

/**
 * Known axe findings that come from content or from the core, not from the theme templates.
 * Each entry: { rule: 'axe rule id', html: /pattern for the HTML of the node/, reason: 'why it is not fixed here' }
 */
export const axeKnown = []
