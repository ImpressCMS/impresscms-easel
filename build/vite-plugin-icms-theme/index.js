import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { minifySmarty } from './smarty-minify.js'

export const defaultOptions = {
    root: 'src',
    outDir: 'dist',
    outDirEnv: 'ICMS_THEME_OUT_DIR',
    entries: [],
    templates: ['**/*.html', '**/*.tpl'],
    exclude: [],
    static: [
        'img/**',
        'images/**',
        'icons/**',
        'fonts/**',
        'language/**',
        'screenshot.*',
        'favicon.*',
        '**/*.php',
        '**/*.ini',
        '**/*.txt',
    ],
    assetsDir: 'assets',
    assetUrlPrefix: '<{$icms_imageurl}>',
    delimiters: ['<{', '}>'],
    minifyTemplates: true,
    minifyOptions: {},
    keepManifest: false,
}

const directivePattern = /<!--\s*vite:\s*(\S+?)\s*-->/g

const normalize = (file) => file.split(path.sep).join('/').replace(/^\.\//, '')

function collectCss(manifest, key, seen = new Set()) {
    if (seen.has(key)) {
        return []
    }

    seen.add(key)

    const chunk = manifest[key]
    const imported = (chunk.imports ?? []).flatMap((importKey) => collectCss(manifest, importKey, seen))

    return [...imported, ...(chunk.css ?? [])]
}

/**
 * Vite puts CSS that several entries share into a separate file and lists it
 * after the entry's own CSS. Shared CSS is usually the framework, so it has to
 * come first for the theme styles to override it.
 */
function sharedFirst(manifest, styles) {
    const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry)
    const usage = (file) => entries.filter((key) => collectCss(manifest, key).includes(file)).length

    return [...styles].sort((a, b) => Number(usage(b) > 1) - Number(usage(a) > 1))
}

export function assetTags(manifest, entry, prefix) {
    const chunk = manifest[entry]
    const styles = sharedFirst(manifest, [...new Set(collectCss(manifest, entry))])

    if (chunk.file.endsWith('.css')) {
        styles.push(chunk.file)
    }

    const tags = styles.map((file) => `<link rel="stylesheet" href="${prefix}${file}">`)

    if (! chunk.file.endsWith('.js')) {
        return tags.join('\n')
    }

    const preloads = (chunk.imports ?? []).map((key) => `<link rel="modulepreload" href="${prefix}${manifest[key].file}">`)

    return [...tags, ...preloads, `<script type="module" src="${prefix}${chunk.file}"></script>`].join('\n')
}

/**
 * Builds an ImpressCMS theme: Vite bundles the JS/CSS entries, Smarty
 * templates are linked to the hashed bundles, minified and copied together
 * with the static theme files.
 *
 * @param {Partial<typeof defaultOptions>} userOptions
 * @returns {import('vite').Plugin}
 */
export default function icmsTheme(userOptions = {}) {
    const options = { ...defaultOptions, ...userOptions }
    const srcDir = path.resolve(options.root)
    const customOutDir = process.env[options.outDirEnv]
    const outDir = path.resolve(customOutDir ?? options.outDir)
    let logger
    let manifestFile

    const templateFiles = () => fg(options.templates, { cwd: srcDir, ignore: options.exclude, dot: false })
    const staticFiles = () => fg(options.static, { cwd: srcDir, ignore: [...options.exclude, ...options.templates] })

    async function readManifest() {
        const file = path.join(outDir, manifestFile)

        return JSON.parse(await fs.readFile(file, 'utf8'))
    }

    function injectAssets(html, template, manifest) {
        return html.replace(directivePattern, (directive, entry) => {
            const key = normalize(entry)

            if (! manifest[key]?.isEntry) {
                throw new Error(`${template}: "${entry}" is not one of the configured entries (${options.entries.join(', ')})`)
            }

            return assetTags(manifest, key, options.assetUrlPrefix)
        })
    }

    async function writeTemplate(template, manifest) {
        const source = await fs.readFile(path.join(srcDir, template), 'utf8')
        const html = injectAssets(source, template, manifest)
        const target = path.join(outDir, template)

        await fs.mkdir(path.dirname(target), { recursive: true })

        if (! options.minifyTemplates) {
            await fs.writeFile(target, html)

            return
        }

        const { code, warning } = await minifySmarty(html, {
            delimiters: options.delimiters,
            ...options.minifyOptions,
        })

        if (warning) {
            logger.warn(`[icms-theme] ${template} copied without minification: ${warning}`)
        }

        await fs.writeFile(target, code)
    }

    async function copyStatic(file) {
        const target = path.join(outDir, file)

        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.copyFile(path.join(srcDir, file), target)
    }

    return {
        name: 'icms-theme',

        config() {
            return {
                root: srcDir,
                base: './',
                build: {
                    outDir,
                    assetsDir: options.assetsDir,
                    emptyOutDir: customOutDir === undefined,
                    manifest: true,
                    rolldownOptions: {
                        input: options.entries.map((entry) => path.join(srcDir, entry)),
                    },
                },
            }
        },

        configResolved(config) {
            logger = config.logger
            manifestFile = typeof config.build.manifest === 'string' ?
                config.build.manifest :
                '.vite/manifest.json'
        },

        async buildStart() {
            const files = [...await templateFiles(), ...await staticFiles()]

            for (const file of files) {
                this.addWatchFile(path.join(srcDir, file))
            }

            if (customOutDir === undefined) {
                return
            }

            // Vite does not empty an external outDir, so drop stale hashed bundles ourselves
            await fs.rm(path.join(outDir, options.assetsDir), { recursive: true, force: true })
        },

        async writeBundle() {
            const manifest = await readManifest()
            const templates = await templateFiles()
            const statics = await staticFiles()

            try {
                await Promise.all(templates.map((template) => writeTemplate(template, manifest)))
            } catch (error) {
                this.error(error.message)
            }

            await Promise.all(statics.map(copyStatic))

            if (! options.keepManifest) {
                await fs.rm(path.join(outDir, manifestFile), { force: true })
                await fs.rm(path.join(outDir, '.vite'), { recursive: true, force: true })
            }

            logger.info(`[icms-theme] ${templates.length} templates and ${statics.length} static files written to ${outDir}`)
        },
    }
}
