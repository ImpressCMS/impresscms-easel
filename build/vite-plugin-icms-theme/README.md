# vite-plugin-icms-theme

A Vite plugin that builds an ImpressCMS theme:

- bundles and minifies the theme's JS/CSS/SCSS entries (with hashed file names),
- links those bundles into the Smarty templates,
- minifies the Smarty templates without breaking them,
- copies the static theme files (images, fonts, language files, …),

so the output folder can be dropped into `htdocs/themes/<theme>` as is.

## Usage

The plugin ships with the ImpressCMS Easel template and is configured in its `vite.config.js`:

```js
import { defineConfig } from 'vite'
import icmsTheme from './build/vite-plugin-icms-theme/index.js'

export default defineConfig({
    plugins: [
        icmsTheme({
            entries: ['js/theme.js'],
            exclude: ['index.html'],
        }),
    ],
})
```

It needs Vite 8 and `fast-glob`, `terser`, `lightningcss` and `acorn` as dev dependencies. For SCSS entries, add
`sass` as well.

Put the theme sources in `src/` and reference an entry from a template with an asset directive:

```html
<{$icms_module_header}>
<!-- vite: js/theme.js -->
```

At build time the directive is replaced by the `<link rel="stylesheet">`, `<link rel="modulepreload">` and
`<script type="module">` tags of that entry, all prefixed with `<{$icms_imageurl}>` (the URL of the theme folder).
CSS/SCSS files can be entries too; their directive only produces a stylesheet link.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `root` | `'src'` | Folder with the theme sources. Also the root of the Vite dev server. |
| `outDir` | `'dist'` | Output folder, i.e. the installable theme. Emptied before every build. |
| `outDirEnv` | `'ICMS_THEME_OUT_DIR'` | Environment variable that overrides `outDir`, to build straight into a local ImpressCMS install. That folder is **not** emptied; only its `assetsDir` is cleared. |
| `entries` | `[]` | JS/CSS/SCSS entry points, relative to `root`. |
| `templates` | `['**/*.html', '**/*.tpl']` | Smarty templates to process, relative to `root`. |
| `exclude` | `[]` | Globs to skip, e.g. static HTML mockups that are only used with the dev server. |
| `static` | `img/**`, `images/**`, `icons/**`, `fonts/**`, `language/**`, `shot.*`, `screenshot.*`, `favicon.*`, `**/*.php`, `**/*.ini`, `**/*.txt` | Files copied verbatim. |
| `assetsDir` | `'assets'` | Folder in the output for the bundles. |
| `assetUrlPrefix` | `'<{$icms_imageurl}>'` | Prefix for bundle URLs in the templates. |
| `delimiters` | `['<{', '}>']` | Smarty delimiters, use `['{', '}']` for themes with the Smarty defaults. |
| `minifyTemplates` | `true` | Set to `false` to only inject the assets. |
| `minifyOptions` | `{}` | Overrides for the template minifier, see below. |
| `keepManifest` | `false` | Keep Vite's `.vite/manifest.json` in the output. |

## Template minification

General purpose HTML minifiers parse a document into a tree and serialise it again. That breaks Smarty templates,
which are fragments: they drop the `</div>` that closes what `header.html` opened, and add a `</div>` to
`<{if $a}><div class="a"><{else}><div class="b"><{/if}>`. The minifier in `smarty-minify.js` therefore works on a
flat token stream and never adds, removes or reorders a tag:

1. Smarty comments are removed and every other Smarty tag (including whole `<{literal}>` blocks) is replaced by a
   placeholder that is valid as text, attribute name, JS identifier and CSS identifier.
2. HTML comments are removed (conditional comments are kept), whitespace in text and between attributes is
   collapsed, and whitespace next to block level tags is dropped. `<pre>` and `<textarea>` are left alone.
3. Inline `<script>`, `<style>` and `style=""` are minified with terser and lightningcss, but only when every
   Smarty tag inside sits in a string or is a complete value (`var count = <{$count}>;`,
   `width: <{$width}>px`). A block like `<{if $debug}>log();<{/if}>` is left as it is.
4. The Smarty tags are put back and checked: if any tag got lost or duplicated, the template is written
   unminified and the build prints a warning.

`minifyOptions` accepts `removeComments`, `collapseWhitespace`, `trimAroundBlockTags`, `minifyJs`, `minifyCss`, `keepComments`
(an array of regular expressions; matching HTML comments survive `removeComments`, e.g. markers that a template reads back)
and `stripSmartyComments` (all `true` by default).

## Tests

```bash
node --test "build/**/*.test.js"
```
