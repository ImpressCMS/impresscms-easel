import { randomBytes } from 'node:crypto'
import { tokenizer } from 'acorn'
import { transform as transformCss, transformStyleAttribute } from 'lightningcss'
import { minify as minifyJs } from 'terser'

/*
 * A structure preserving HTML minifier for Smarty templates.
 *
 * Generic HTML minifiers parse the document into a tree and serialise it
 * again, which drops unmatched closing tags and closes unclosed ones. Smarty
 * templates are fragments (`<{if}><div a><{else}><div b><{/if}>`, a header
 * opening what the footer closes), so this minifier only works on a flat
 * token stream and never adds, removes or reorders tags.
 */

export const defaultDelimiters = ['<{', '}>']

export const defaultMinifyOptions = {
    removeComments: true,
    collapseWhitespace: true,
    trimAroundBlockTags: true,
    minifyJs: true,
    minifyCss: true,
    keepComments: [],
}

const blockTags = new Set([
    'address', 'article', 'aside', 'base', 'blockquote', 'body', 'br', 'caption', 'col', 'colgroup',
    'dd', 'details', 'dialog', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer',
    'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'legend',
    'li', 'link', 'main', 'meta', 'nav', 'noscript', 'ol', 'optgroup', 'option', 'p', 'pre',
    'script', 'section', 'style', 'summary', 'table', 'tbody', 'td', 'template', 'tfoot', 'th',
    'thead', 'title', 'tr', 'ul',
])

const javascriptTypes = new Set(['', 'module', 'text/javascript', 'application/javascript'])

const tokenPattern = new RegExp(
    [
        '(?<comment><!--[\\s\\S]*?-->)',
        '(?<raw><(?<rawName>script|style|pre|textarea)\\b(?:"[^"]*"|\'[^\']*\'|[^\'">])*>[\\s\\S]*?</\\k<rawName>\\s*>)',
        '(?<declaration><![a-zA-Z][^>]*>)',
        '(?<tag></?(?<tagName>[a-zA-Z_][^\\s/>]*)(?:"[^"]*"|\'[^\']*\'|[^\'">])*>)',
    ].join('|'),
    'gi',
)

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function smartyPattern([left, right]) {
    const l = escapeRegExp(left)
    const r = escapeRegExp(right)

    return new RegExp(
        [
            `(?<comment>${l}\\*[\\s\\S]*?\\*${r})`,
            `(?<literal>${l}\\s*literal\\s*${r}[\\s\\S]*?${l}\\s*/literal\\s*${r})`,
            // Smarty's auto_literal: a left delimiter followed by whitespace is not a tag
            `(?<tag>${l}(?!\\s)[\\s\\S]*?${r})`,
        ].join('|'),
        'g',
    )
}

/**
 * Replaces every Smarty tag with a placeholder that is a valid HTML attribute
 * name, text node, JavaScript identifier and CSS identifier at the same time.
 *
 * @param {string} source
 * @param {[string, string]} delimiters
 * @param {boolean} stripComments
 * @returns {{ html: string, tags: string[], placeholder: RegExp }}
 */
export function protectSmarty(source, delimiters = defaultDelimiters, stripComments = true) {
    const prefix = `__smarty${randomBytes(4).toString('hex')}_`
    const tags = []

    const html = source.replace(smartyPattern(delimiters), (match, ...args) => {
        const groups = args.at(-1)

        if (groups.comment && stripComments) {
            return ''
        }

        tags.push(match)

        return `${prefix}${tags.length - 1}__`
    })

    return { html, tags, placeholder: new RegExp(`${prefix}(\\d+)__`, 'g') }
}

/**
 * @param {string} html
 * @param {string[]} tags
 * @param {RegExp} placeholder
 * @param {Set<number>} optional placeholders that may legitimately disappear
 * @returns {string}
 */
export function restoreSmarty(html, tags, placeholder, optional = new Set()) {
    const seen = new Array(tags.length).fill(0)

    const restored = html.replace(placeholder, (match, index) => {
        seen[index]++

        return tags[index] ?? match
    })

    const broken = seen
        .map((count, index) => ({ count, index }))
        .filter(({ count, index }) => count > 1 || (count === 0 && ! optional.has(index)))

    if (broken.length > 0) {
        const list = broken.map(({ index }) => tags[index]).join(', ')

        throw new Error(`Smarty tags lost or duplicated during minification: ${list}`)
    }

    return restored
}

const placeholdersIn = (code, placeholder) => [...code.matchAll(placeholder)].map(([match]) => match).sort()

const samePlaceholders = (before, after, placeholder) =>
    placeholdersIn(before, placeholder).join() === placeholdersIn(after, placeholder).join()

function tokenize(html) {
    const tokens = []
    let offset = 0

    for (const match of html.matchAll(tokenPattern)) {
        if (match.index > offset) {
            tokens.push({ type: 'text', value: html.slice(offset, match.index) })
        }

        const { comment, raw, rawName, declaration, tagName } = match.groups

        if (comment) {
            tokens.push({ type: 'comment', value: comment })
        } else if (raw) {
            tokens.push({ type: 'raw', name: rawName.toLowerCase(), value: raw })
        } else if (declaration) {
            tokens.push({ type: 'tag', name: '!doctype', value: declaration })
        } else {
            tokens.push({ type: 'tag', name: tagName.toLowerCase(), value: match[0] })
        }

        offset = match.index + match[0].length
    }

    if (offset < html.length) {
        tokens.push({ type: 'text', value: html.slice(offset) })
    }

    return tokens
}

const isConditionalComment = (comment) => /^<!--\[if\b|<!\[endif\]-->$/i.test(comment)

function collapseTag(tag) {
    let result = ''
    let quote = null

    for (const char of tag) {
        if (quote) {
            result += char
            quote = char === quote ? null : quote

            continue
        }

        if (char === '"' || char === '\'') {
            quote = char
        }

        if (/\s/.test(char) && /\s$/.test(result)) {
            continue
        }

        result += /\s/.test(char) ? ' ' : char
    }

    return result.replace(/\s+>$/, '>')
}

function attribute(openingTag, name) {
    const match = openingTag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))

    return match ? (match[1] ?? match[2] ?? match[3]).trim().toLowerCase() : null
}

/*
 * A tag is only safe for a JS minifier when it is part of a string literal or
 * is a complete expression on its own (`var count = <{$count}>;`). Anything
 * else (`<{if $a}>run();<{/if}>`) would let the minifier restructure code
 * around what it believes is an identifier.
 */
function placeholdersAreJsValues(code, placeholder, sourceType) {
    const tokens = [...tokenizer(code, { ecmaVersion: 'latest', sourceType })]

    return [...code.matchAll(placeholder)].every(({ index, 0: match }) => {
        const end = index + match.length
        const token = tokens.find(({ start, end: tokenEnd }) => start <= index && end <= tokenEnd)

        if (token === undefined) {
            return false
        }

        if (token.type.label === 'name') {
            return token.start === index && token.end === end
        }

        return token.type.label === 'string' || token.type.label === 'template'
    })
}

/*
 * A tag is only safe for a CSS minifier inside a declaration value
 * (`width: <{$width}>px;`). In a selector or as a whole declaration the
 * minifier could merge or reorder the rules around it.
 */
function placeholdersAreCssValues(code, placeholder) {
    return [...code.matchAll(placeholder)].every(({ index, 0: match }) => {
        const before = code.slice(0, index)
        const after = code.slice(index + match.length)
        const depth = (before.match(/\{/g)?.length ?? 0) - (before.match(/\}/g)?.length ?? 0)
        const declaration = before.slice(Math.max(before.lastIndexOf('{'), before.lastIndexOf(';'), before.lastIndexOf('}')) + 1)
        const nextStructure = after.match(/[{};]/)?.[0] ?? '}'

        return depth > 0 && declaration.includes(':') && nextStructure !== '{'
    })
}

async function minifyScript(openingTag, body, placeholder) {
    const type = attribute(openingTag, 'type') ?? ''
    const sourceType = type === 'module' ? 'module' : 'script'

    if (! javascriptTypes.has(type) || attribute(openingTag, 'src') !== null || body.trim() === '') {
        return body
    }

    try {
        if (! placeholdersAreJsValues(body, placeholder, sourceType)) {
            return body
        }

        const { code } = await minifyJs(body, { module: sourceType === 'module' })

        return samePlaceholders(body, code, placeholder) ? code : body
    } catch {
        return body
    }
}

function minifyStyle(body, placeholder) {
    try {
        if (! placeholdersAreCssValues(body, placeholder)) {
            return body
        }

        const code = transformCss({ filename: 'inline.css', code: Buffer.from(body), minify: true }).code.toString()

        return samePlaceholders(body, code, placeholder) ? code : body
    } catch {
        return body
    }
}

function minifyStyleAttributes(tag, placeholder) {
    return tag.replace(/(\sstyle\s*=\s*)(["'])([\s\S]*?)\2/gi, (match, prefix, quote, value) => {
        try {
            if (! placeholdersAreCssValues(`x{${value}}`, placeholder)) {
                return match
            }

            const code = transformStyleAttribute({ code: Buffer.from(value), minify: true }).code.toString()

            if (! samePlaceholders(value, code, placeholder) || code.includes(quote)) {
                return match
            }

            return `${prefix}${quote}${code}${quote}`
        } catch {
            return match
        }
    })
}

async function minifyRaw(token, options, placeholder) {
    const [, openingTag, body, closingTag] = token.value.match(/^(<[^>]*(?:"[^"]*"|'[^']*'|[^'">])*>)([\s\S]*?)(<\/[^>]+>)$/)
    const tag = options.collapseWhitespace ? collapseTag(openingTag) : openingTag

    if (token.name === 'script' && options.minifyJs) {
        return `${tag}${await minifyScript(openingTag, body, placeholder)}${closingTag}`
    }

    if (token.name === 'style' && options.minifyCss) {
        return `${tag}${minifyStyle(body, placeholder)}${closingTag}`
    }

    return `${tag}${body}${closingTag}`
}

const isBlock = (token) => token !== undefined && blockTags.has(token.name)

function collapseText(tokens, index, options) {
    let text = tokens[index].value.replace(/\s+/g, ' ')

    if (! options.trimAroundBlockTags) {
        return text
    }

    if (index === 0 || isBlock(tokens[index - 1])) {
        text = text.trimStart()
    }

    if (index === tokens.length - 1 || isBlock(tokens[index + 1])) {
        text = text.trimEnd()
    }

    return text
}

/**
 * Removes comments and merges the text around them, so whitespace on both
 * sides of a removed comment collapses as one.
 */
function dropComments(tokens, removedPlaceholders, placeholder, keepComments = []) {
    const result = []
    const isKept = (comment) => isConditionalComment(comment) || keepComments.some((pattern) => pattern.test(comment))

    for (const token of tokens) {
        if (token.type === 'comment' && ! isKept(token.value)) {
            for (const [, index] of token.value.matchAll(placeholder)) {
                removedPlaceholders.add(Number(index))
            }

            continue
        }

        if (token.type === 'text' && result.at(-1)?.type === 'text') {
            result.at(-1).value += token.value

            continue
        }

        result.push({ ...token })
    }

    return result
}

/**
 * Minifies an HTML Smarty template without touching its Smarty tags.
 * Never throws: when minification fails, the original template is returned
 * together with a warning.
 *
 * @param {string} source
 * @param {{
 *     delimiters?: [string, string],
 *     stripSmartyComments?: boolean,
 *     removeComments?: boolean,
 *     collapseWhitespace?: boolean,
 *     trimAroundBlockTags?: boolean,
 *     minifyJs?: boolean,
 *     minifyCss?: boolean,
 *     keepComments?: RegExp[]
 * }} options
 * @returns {Promise<{ code: string, warning?: string }>}
 */
export async function minifySmarty(source, options = {}) {
    const settings = { ...defaultMinifyOptions, ...options }

    try {
        const { html, tags, placeholder } = protectSmarty(
            source,
            settings.delimiters ?? defaultDelimiters,
            settings.stripSmartyComments ?? true,
        )
        const removedPlaceholders = new Set()
        const tokens = settings.removeComments ?
            dropComments(tokenize(html), removedPlaceholders, placeholder, settings.keepComments) :
            tokenize(html)
        const output = []

        for (const [index, token] of tokens.entries()) {
            if (token.type === 'raw') {
                output.push(await minifyRaw(token, settings, placeholder))

                continue
            }

            if (! settings.collapseWhitespace) {
                output.push(token.value)

                continue
            }

            if (token.type === 'text') {
                output.push(collapseText(tokens, index, settings))

                continue
            }

            const tag = token.type === 'tag' ? collapseTag(token.value) : token.value

            output.push(settings.minifyCss ? minifyStyleAttributes(tag, placeholder) : tag)
        }

        return { code: restoreSmarty(output.join(''), tags, placeholder, removedPlaceholders) }
    } catch (error) {
        return { code: source, warning: error.message }
    }
}
