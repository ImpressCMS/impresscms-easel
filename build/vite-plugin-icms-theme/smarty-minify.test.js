import assert from 'node:assert/strict'
import { test } from 'node:test'
import { minifySmarty, protectSmarty, restoreSmarty } from './smarty-minify.js'

const smartyTags = (html) => html.match(/<\{(?!\*)[\s\S]*?\}>/g) ?? []

test('collapses whitespace and keeps tags in text and attributes', async () => {
    const source = `
        <div class="card <{$extraClass}>">
            <h4>  <{$block.title}>  </h4>
            <input   type="text"
                     value="<{$x|default:"a"}>" />
        </div>
    `

    const { code, warning } = await minifySmarty(source)

    assert.equal(warning, undefined)
    assert.equal(code, '<div class="card <{$extraClass}>"><h4><{$block.title}></h4><input type="text" value="<{$x|default:"a"}>" /></div>')
})

test('keeps conditional attributes between other attributes', async () => {
    const source = '<input type="checkbox"  <{if $checked}>checked="checked"<{/if}>  name="a">'

    const { code } = await minifySmarty(source)

    assert.equal(code, '<input type="checkbox" <{if $checked}>checked="checked"<{/if}> name="a">')
})

test('never rebalances unmatched tags', async () => {
    const opening = '<{if $wide}>\n    <div class="col-12">\n<{else}>\n    <div class="col-6">\n<{/if}>\n<p>x</p>'
    const closing = '    </div>\n</main>\n<footer>  <{$icms_footer}>  </footer>'

    assert.equal((await minifySmarty(opening)).code, '<{if $wide}><div class="col-12"><{else}><div class="col-6"><{/if}><p>x</p>')
    assert.equal((await minifySmarty(closing)).code, '</div></main><footer><{$icms_footer}></footer>')
})

test('keeps a single space between inline content', async () => {
    const source = '<p>\n    Hello   <strong><{$name}></strong>\n    <a href="#">more</a>\n</p>'

    const { code } = await minifySmarty(source)

    assert.equal(code, '<p>Hello <strong><{$name}></strong> <a href="#">more</a></p>')
})

test('keeps comparison operators inside tags', async () => {
    const source = '<{if $count > 1}><p>many</p><{/if}>'

    assert.equal((await minifySmarty(source)).code, source)
})

test('leaves literal blocks untouched', async () => {
    const source = `<{literal}>
<script>
    var config = { a: 1 };
</script>
<{/literal}>`

    assert.equal((await minifySmarty(source)).code, source)
})

test('minifies inline javascript containing tags', async () => {
    const source = `<script>
        var siteUrl = "<{$icms_url}>";
        console.log( siteUrl );
    </script>`

    const { code } = await minifySmarty(source)

    assert.equal(code, '<script>var siteUrl="<{$icms_url}>";console.log(siteUrl);</script>')
})

test('keeps inline javascript that only parses with smarty applied', async () => {
    const source = '<script>\n    <{if $debug}>console.log("debug");<{/if}>\n</script>'

    assert.equal((await minifySmarty(source)).code, source)
})

test('minifies inline javascript with a tag as a complete expression', async () => {
    const source = '<script>\n    var count = <{$count}>;\n    console.log( count );\n</script>'

    assert.equal((await minifySmarty(source)).code, '<script>var count=<{$count}>;console.log(count);</script>')
})

test('keeps inline css with tags in selectors or around rules', async () => {
    const source = '<style>\n    <{if $dark}>.a { color: red; }<{/if}>\n    .b { color: red; }\n</style>'

    assert.equal((await minifySmarty(source)).code, source)
})

test('does not touch non javascript script blocks', async () => {
    const source = '<script type="text/template">\n    <div>  <{$x}>  </div>\n</script>'

    assert.equal((await minifySmarty(source)).code, source)
})

test('minifies inline css and style attributes', async () => {
    const source = `<style>
        .logo  { background: url(<{$icms_imageurl}>img/logo.svg);  margin: 0px; }
    </style>
    <div style="color : red;  width: <{$width}>px">x</div>`

    const { code } = await minifySmarty(source)

    assert.equal(code, '<style>.logo{background:url(<{$icms_imageurl}>img/logo.svg);margin:0}</style><div style="color:red;width:<{$width}>px">x</div>')
})

test('removes html and smarty comments but keeps conditional comments', async () => {
    const source = '<p>a</p>\n<!-- note -->\n<{* developer note *}>\n<!--[if IE]><p>old</p><![endif]-->\n<p>b</p>'

    assert.equal((await minifySmarty(source)).code, '<p>a</p><!--[if IE]><p>old</p><![endif]--><p>b</p>')
    assert.ok((await minifySmarty(source, { stripSmartyComments: false })).code.includes('<{* developer note *}>'))
})

test('allows tags inside removed html comments to disappear', async () => {
    const source = '<!-- debug: <{$debug}> --><p><{$text}></p>'

    const { code, warning } = await minifySmarty(source)

    assert.equal(warning, undefined)
    assert.equal(code, '<p><{$text}></p>')
})

test('keeps preformatted whitespace', async () => {
    const source = '<pre class="x">  <{$code}>\n    indented</pre>\n<textarea>  a\n b</textarea>'

    assert.equal((await minifySmarty(source)).code, '<pre class="x">  <{$code}>\n    indented</pre><textarea>  a\n b</textarea>')
})

test('keeps the doctype', async () => {
    const source = '<!doctype html>\n<html lang="<{$icms_langcode}>">\n<head>\n</head>\n</html>'

    assert.equal((await minifySmarty(source)).code, '<!doctype html><html lang="<{$icms_langcode}>"><head></head></html>')
})

test('supports alternative delimiters', async () => {
    const source = `
        <style>
            body { color: red; }
        </style>
        <p class="{$class}">  {$text}  </p>
    `

    const { code } = await minifySmarty(source, { delimiters: ['{', '}'] })

    assert.equal(code, '<style>body{color:red}</style><p class="{$class}">{$text}</p>')
})

test('restore fails when a placeholder went missing', () => {
    const { html, tags, placeholder } = protectSmarty('<p><{$a}></p>')

    assert.throws(() => restoreSmarty(html.replace(placeholder, ''), tags, placeholder), /lost or duplicated/)
})

test('restore fails when a placeholder was duplicated', () => {
    const { html, tags, placeholder } = protectSmarty('<p><{$a}></p>')

    assert.throws(() => restoreSmarty(`${html}${html}`, tags, placeholder), /lost or duplicated/)
})

test('keeps HTML comments that match keepComments', async () => {
    const source = '<!-- remove me -->\n<!--PAGEBAR_TITLE:<{$title}>-->\n<p>x</p>'

    const { code, warning } = await minifySmarty(source, { keepComments: [/^<!--PAGEBAR_/] })

    assert.equal(warning, undefined)
    assert.equal(code, '<!--PAGEBAR_TITLE:<{$title}>--><p>x</p>')
})

test('drops all HTML comments without keepComments', async () => {
    const { code } = await minifySmarty('<!--PAGEBAR_TITLE:<{$title}>--><p>x</p>')

    assert.equal(code, '<p>x</p>')
})
