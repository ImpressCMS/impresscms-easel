import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assetTags } from './index.js'

const manifest = {
    'js/theme.js': { file: 'bundle/theme.js', isEntry: true, css: ['bundle/theme.css', 'bundle/shared.css'] },
    'js/admin.js': { file: 'bundle/admin.js', isEntry: true, css: ['bundle/admin.css', 'bundle/shared.css'] },
}

test('links CSS shared between entries before the entry CSS', () => {
    const tags = assetTags(manifest, 'js/theme.js', '<{$icms_imageurl}>').split('\n')

    assert.deepEqual(tags, [
        '<link rel="stylesheet" href="<{$icms_imageurl}>bundle/shared.css">',
        '<link rel="stylesheet" href="<{$icms_imageurl}>bundle/theme.css">',
        '<script type="module" src="<{$icms_imageurl}>bundle/theme.js"></script>',
    ])
})

test('keeps the order of CSS that no other entry uses', () => {
    const single = { 'js/theme.js': { file: 'bundle/theme.js', isEntry: true, css: ['bundle/a.css', 'bundle/b.css'] } }

    assert.deepEqual(assetTags(single, 'js/theme.js', '').split('\n').slice(0, 2), [
        '<link rel="stylesheet" href="bundle/a.css">',
        '<link rel="stylesheet" href="bundle/b.css">',
    ])
})
