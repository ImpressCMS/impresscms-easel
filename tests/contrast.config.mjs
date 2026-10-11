// Colour pairs for scripts/check-contrast.mjs (npm run check:contrast).
// WCAG 2.1: text needs 4.5:1 (1.4.3), UI components and meaningful graphics 3:1 (1.4.11).
// Colours can be custom properties from :root of the stylesheet (var(--name)) or literal hex colours.

export const TEXT = 4.5
export const UI = 3

export const stylesheet = 'src/css/theme.css'

/**
 * [foreground, background, minimum ratio, description, options]
 * options.external: a literal colour that does not come from the stylesheet (a framework, a module)
 * options.informational: report the ratio, but do not fail on it (decorative colours)
 */
export const pairs = [
    ['var(--theme-text)', 'var(--theme-background)', TEXT, 'body text'],
    ['var(--theme-text)', 'var(--theme-surface)', TEXT, 'text in blocks'],
    ['var(--theme-muted)', 'var(--theme-background)', TEXT, 'muted text'],
    ['var(--theme-muted)', 'var(--theme-surface)', TEXT, 'footer text'],
    ['var(--theme-link)', 'var(--theme-background)', TEXT, 'links'],
    ['var(--theme-link)', 'var(--theme-surface)', TEXT, 'links in blocks and the footer'],
    ['var(--theme-on-accent)', 'var(--theme-accent)', TEXT, 'buttons and the skip link'],
    ['var(--theme-header-text)', 'var(--theme-header-background)', TEXT, 'site name'],
    ['var(--theme-header-muted)', 'var(--theme-header-background)', TEXT, 'slogan'],
    ['var(--theme-focus)', 'var(--theme-background)', UI, 'focus outline'],
    ['var(--theme-focus)', 'var(--theme-surface)', UI, 'focus outline in blocks'],
    ['var(--theme-focus)', 'var(--theme-header-background)', UI, 'focus outline in the header'],
    ['var(--theme-border)', 'var(--theme-background)', UI, 'block borders (decorative)', { informational: true }],
]
