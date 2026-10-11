// Checks the built theme in dist/ (npm run build first; npm test does both).
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'src')
const dist = path.join(root, 'dist')
const mockups = ['index.html']

const sourceTemplates = fg.sync(['**/*.html', '**/*.tpl'], { cwd: src, ignore: mockups })
const builtTemplates = fg.sync(['**/*.html', '**/*.tpl'], { cwd: dist })
const read = (file) => readFileSync(path.join(dist, file), 'utf8')

test('dist contains every template and no mockups', () => {
    assert.ok(existsSync(path.join(dist, 'theme.html')), 'dist/theme.html is missing')
    assert.deepEqual([...builtTemplates].sort(), [...sourceTemplates].sort())
})

test('no vite directive is left in the templates', () => {
    const unresolved = builtTemplates.filter((file) => read(file).includes('<!-- vite:'))

    assert.deepEqual(unresolved, [])
})

test('every file referenced through $icms_imageurl exists', () => {
    const missing = builtTemplates.flatMap((file) =>
        [...read(file).matchAll(/<\{\$icms_imageurl\}>([\w./-]+)/g)]
            .map((match) => match[1])
            .filter((reference) => ! existsSync(path.join(dist, reference)))
            .map((reference) => `${file}: ${reference}`),
    )

    assert.deepEqual(missing, [])
})

test('the theme links its bundles', () => {
    const theme = read('theme.html')

    assert.match(theme, /<link rel="stylesheet" href="<\{\$icms_imageurl\}>assets\/[\w-]+\.css">/)
    assert.match(theme, /<script type="module" src="<\{\$icms_imageurl\}>assets\/[\w-]+\.js"><\/script>/)
})

test('the screenshot and images are copied and the manifest is removed', () => {
    assert.ok(existsSync(path.join(dist, 'shot.gif')), 'dist/shot.gif is missing')
    assert.ok(fg.sync('img/**', { cwd: dist }).length > 0, 'dist/img is empty')
    assert.equal(existsSync(path.join(dist, '.vite')), false)
})
