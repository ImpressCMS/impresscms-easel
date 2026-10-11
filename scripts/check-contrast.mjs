// WCAG 2.1 contrast gate for the colour pairs in tests/contrast.config.mjs.
// Colours that come from a custom property in :root are read from the stylesheet, so changing the palette is
// checked automatically. Literal colours must still occur in the stylesheet, otherwise the pair list is out of
// date and the check fails.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { contrast } from './color.mjs'
import { pairs, stylesheet } from '../tests/contrast.config.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(path.join(root, stylesheet), 'utf8').toLowerCase()
const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
const properties = Object.fromEntries(
    [...rootBlock.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-f]{3,6})\s*;/g)].map((match) => [match[1], match[2]]),
)

const resolve = (value) => {
    const name = /^var\((--[\w-]+)\)$/.exec(value)?.[1]

    if (! name) {
        return value.toLowerCase()
    }

    if (! properties[name]) {
        throw new Error(`${name} is not a hex colour custom property in :root of ${stylesheet}`)
    }

    return properties[name]
}

const isLiteral = (value) => ! value.startsWith('var(') && ! ['#ffffff', '#fff', '#000000', '#000'].includes(value.toLowerCase())

const shortHex = (color) => color.replace(/^#(.)\1(.)\2(.)\3$/, '#$1$2$3')

let failures = 0

for (const [foreground, background, minimum, label, options = {}] of pairs) {
    const literals = options.external ? [] : [foreground, background].filter(isLiteral)

    for (const color of literals.map((value) => value.toLowerCase())) {
        if (css.includes(color) || css.includes(shortHex(color))) {
            continue
        }

        console.error(`FAIL  ${color} (${label}) does not occur in ${stylesheet}, update tests/contrast.config.mjs`)
        failures++
    }

    const [foregroundColor, backgroundColor] = [resolve(foreground), resolve(background)]
    const ratio = contrast(foregroundColor, backgroundColor)
    const pass = ratio >= minimum
    const status = pass ? 'ok  ' : options.informational ? 'info' : 'FAIL'

    console.log(`${status}  ${ratio.toFixed(2).padStart(5)}:1  (min ${minimum})  ${foregroundColor} on ${backgroundColor}  ${label}`)

    if (! pass && ! options.informational) {
        failures++
    }
}

if (failures > 0) {
    console.error(`\n${failures} contrast check(s) failed`)
    process.exitCode = 1
}
