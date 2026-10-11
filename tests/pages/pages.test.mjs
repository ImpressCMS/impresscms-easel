// Page tests against a running ImpressCMS site with the built theme (see "Page tests" in the README).
//   ICMS_TEST_URL=http://mysite.test npm run test:pages
// They are skipped when the site cannot be reached.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { after, before, describe, test } from 'node:test'
import { chromium } from 'playwright-core'
import { axeExclude, axeKnown, baseUrl, browserChannel, ignoredConsoleErrors, pages, viewports } from './config.mjs'

const require = createRequire(import.meta.url)
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

const reachable = await fetch(baseUrl, { signal: AbortSignal.timeout(5000) }).then(
    (response) => response.ok,
    () => false,
)
const skip = ! reachable && `${baseUrl} is not reachable`

let browser

before(async () => {
    if (reachable) {
        browser = await chromium.launch({ channel: browserChannel })
    }
})

after(async () => {
    await browser?.close()
})

const open = async (viewport, url, { onConsole } = {}) => {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()

    if (onConsole) {
        page.on('console', (message) => message.type() === 'error' && onConsole(`${message.text()} ${message.location().url}`))
        page.on('pageerror', (error) => onConsole(`${error.message} ${error.stack ?? ''}`))
    }

    const response = await page.goto(baseUrl + url, { waitUntil: 'load' })

    // A development site prints PHP notices straight into the body; they are not part of the theme
    await page.addStyleTag({ content: 'body > b, body > br { display: none !important; }' })

    return { page, context, response }
}

describe('theme', { skip }, () => {
    for (const spec of pages) {
        test(`${spec.name}: is served with the built theme and has at most one h1`, async () => {
            const { page, context, response } = await open(viewports.laptop, spec.url)
            const result = await page.evaluate(() => ({
                bundle: document.querySelector('link[rel="stylesheet"][href*="/themes/"][href*="/assets/"]') !== null,
                h1: document.querySelectorAll('h1').length,
            }))

            await context.close()

            assert.equal(response?.status(), 200)
            assert.ok(result.bundle, 'no stylesheet from the assets folder of a theme: is the built theme active?')
            assert.ok(result.h1 <= 1, `${result.h1} h1 elements`)
        })
    }
})

describe('layout', { skip }, () => {
    for (const [name, viewport] of Object.entries(viewports)) {
        for (const spec of pages) {
            test(`${spec.name} at ${name} (${viewport.width}px): no horizontal scroll`, async () => {
                const { page, context } = await open(viewport, spec.url)
                const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

                await context.close()

                assert.ok(overflow <= 0, `page scrolls horizontally by ${overflow}px`)
            })
        }
    }
})

describe('quality', { skip }, () => {
    for (const spec of pages) {
        test(`${spec.name}: no console errors`, async () => {
            const errors = []
            const { context } = await open(viewports.laptop, spec.url, { onConsole: (text) => errors.push(text) })

            await context.close()

            const unexpected = errors.filter((text) => ! ignoredConsoleErrors.some((pattern) => pattern.test(text)))

            assert.deepEqual(unexpected, [])
        })

        test(`${spec.name}: axe finds no WCAG 2.1 A/AA violations (375px and 1280px)`, async () => {
            const violations = []

            for (const viewport of [viewports.mobile, viewports.laptop]) {
                const { page, context } = await open(viewport, spec.url)

                await page.evaluate(axeSource)

                const result = await page.evaluate(
                    (exclude) =>
                        // eslint-disable-next-line no-undef
                        axe.run({ exclude: exclude.map((selector) => [selector]) }, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }),
                    axeExclude,
                )

                await context.close()

                for (const violation of result.violations) {
                    const nodes = violation.nodes.filter(
                        (node) => ! axeKnown.some((known) => known.rule === violation.id && known.html.test(node.html.replace(/\s+/g, ' ').trim())),
                    )

                    if (nodes.length > 0) {
                        violations.push(`${viewport.width}px ${violation.id} (${violation.impact}): ${nodes.map((node) => node.target.join(' ')).slice(0, 3).join(' | ')}`)
                    }
                }
            }

            assert.deepEqual([...new Set(violations)], [])
        })
    }
})

describe('navigation', { skip }, () => {
    test('the skip link is the first focusable element and jumps to the main content', async () => {
        const { page, context } = await open(viewports.laptop, '/')

        await page.keyboard.press('Tab')

        assert.equal(await page.evaluate(() => document.activeElement?.className), 'skip-link')

        await page.keyboard.press('Enter')

        assert.match(page.url(), /#main-content$/)

        await context.close()
    })
})
