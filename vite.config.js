import { defineConfig } from 'vite';
import { resolve, dirname, basename } from 'path';
import fs from 'fs';
import { glob } from 'glob';
import cssnano from 'cssnano';
import https from 'https';
import purgecssModule from '@fullhuman/postcss-purgecss';
import http from 'http';

const purgecss = purgecssModule.default || purgecssModule;

// Helper: download extern bestand
function downloadFile(url, dest) {
    return new Promise((resolvePromise, reject) => {
        const proto = url.startsWith('https') ? https : http;
        proto.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Download mislukt (${res.statusCode}): ${url}`));
                return;
            }
            fs.mkdirSync(dirname(dest), { recursive: true });
            const fileStream = fs.createWriteStream(dest);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close(resolvePromise);
            });
        }).on('error', reject);
    });
}

// Hulpfunctie: zoekt externe CSS en downloadt deze
async function processExternalCss(content, isHtml = false) {
    const importRegex = /@import\s+(?:url\()?["']?(https?:\/\/[^"')\s]+)["']?\)?\s*;?/gi;
    const linkRegex = /<link[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi;

    const matches = [
        ...content.matchAll(importRegex),
        ...(isHtml ? [...content.matchAll(linkRegex)] : [])
    ];

    for (const match of matches) {
        const url = match[1];
        const localName = basename(new URL(url).pathname) || 'external.css';
        const localPath = resolve(__dirname, 'src/css', localName);

        console.log(`⬇️  Download extern CSS: ${url} → ${localName}`);
        try {
            await downloadFile(url, localPath);
            const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            content = content.replace(new RegExp(escapedUrl, 'g'), `./${localName}`);
        } catch (err) {
            console.warn(`⚠️  Kon ${url} niet downloaden: ${err.message}`);
        }
    }

    return content;
}

// Plugin: externe CSS imports downloaden en herschrijven
function handleExternalCssImports() {
    return {
        name: 'handle-external-css-imports',
        async buildStart() {
            // CSS-bestanden
            const cssFiles = glob.sync('src/css/**/*.css');
            for (const file of cssFiles) {
                let content = fs.readFileSync(file, 'utf-8');
                content = await processExternalCss(content);
                fs.writeFileSync(file, content, 'utf-8');
            }

            // theme.html
            const themeFile = 'src/theme.html';
            if (fs.existsSync(themeFile)) {
                let content = fs.readFileSync(themeFile, 'utf-8');
                content = await processExternalCss(content, true);
                fs.writeFileSync(themeFile, content, 'utf-8');
            }

            // theme_admin.html (optional)
            const themeAdminFile = 'src/theme_admin.html';
            if (fs.existsSync(themeAdminFile)) {
                let content = fs.readFileSync(themeAdminFile, 'utf-8');
                content = await processExternalCss(content, true);
                fs.writeFileSync(themeAdminFile, content, 'utf-8');
            }
        }
    };
}

// Plugin: templates & assets kopiëren, paden herschrijven, .vite verwijderen
function copyTemplatesAndAssets() {
    return {
        name: 'copy-templates-and-assets',
        closeBundle() {
            const manifestPath = resolve(__dirname, 'dist/.vite/manifest.json');
            if (!fs.existsSync(manifestPath)) {
                console.warn(`⚠️ manifest.json niet gevonden op ${manifestPath}`);
                return;
            }

            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            const jsFile = manifest['src/js/main.js']
                ? `<{$icms_imageurl}>${manifest['src/js/main.js'].file.split('/').pop()}`
                : '';

            // Templates
            const templates = [
                ...glob.sync('src/templates/**/*.{html.tpl,html}'),
                ...glob.sync('src/modules/**/*.{html.tpl,html}'),
                ...glob.sync('src/theme.html'),
                ...glob.sync('src/theme_admin.html')
            ];

            templates.forEach((srcFile) => {
                if (!fs.existsSync(srcFile)) return;
                const relPath = srcFile.replace(/^src[\\/]/, '');
                const destFile = resolve(__dirname, 'dist', relPath);
                fs.mkdirSync(dirname(destFile), { recursive: true });

                let content = fs.readFileSync(srcFile, 'utf-8');

                // CSS in /css/ → <{$icms_imageurl}>css/bestandsnaam
                content = content.replace(
                    /(\.\/)?css\/([a-z0-9_\-\.]+\.css)/gi,
                    (_, _prefix, filename) => `<{$icms_imageurl}>css/${filename}`
                );

                // JS-bestand uit manifest
                if (jsFile) {
                    const jsName = manifest['src/js/main.js'].file.split('/').pop();
                    const jsRegex = new RegExp(`(\\.\\/)?js\\/${jsName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
                    content = content.replace(jsRegex, jsFile);
                }

                // Fonts en afbeeldingen
                const assetExts = ['woff2?', 'ttf', 'eot', 'svg', 'png', 'jpe?g', 'gif', 'webp', 'avif'];
                const assetRegex = new RegExp(`(\\.\\/)?(?:img|fonts)\\/([\\w\\-\\.]+\\.(${assetExts.join('|')}))`, 'gi');
                content = content.replace(assetRegex, (_, _prefix, filename) => `<{$icms_imageurl}>${filename}`);

                fs.writeFileSync(destFile, content, 'utf-8');
            });

            // Afbeeldingen fysiek kopiëren
            const images = glob.sync('src/img/**/*.{png,jpg,jpeg,gif,svg,webp,avif}');
            images.forEach((srcFile) => {
                const relPath = srcFile.replace(/^src[\\/]/, '');
                const destFile = resolve(__dirname, 'dist', relPath);
                fs.mkdirSync(dirname(destFile), { recursive: true });
                fs.copyFileSync(srcFile, destFile);
            });

            // .vite map verwijderen
            const viteDir = resolve(__dirname, 'dist/.vite');
            if (fs.existsSync(viteDir)) {
                fs.rmSync(viteDir, { recursive: true, force: true });
                console.log('🧹 dist/.vite map verwijderd');
            }
        },
    };
}

export default defineConfig(({ mode }) => {
    const noMinify = mode === 'preview';
    const cssEntry = resolve(__dirname, 'src/css/style.css'); // dummy entry om altijd manifest te genereren
    const standaloneCss = glob.sync('src/css/standalone/**/*.css');
    const jsFiles = glob.sync('src/js/**/*.js');
    const input = Object.fromEntries([
        ['style', cssEntry],
        ...standaloneCss.map((p) => [basename(p, '.css'), resolve(__dirname, p)]),
        ...jsFiles.map((p) => [basename(p, '.js'), resolve(__dirname, p)]),
    ]);

    const purgePlugin = purgecss({
        content: ['src/**/*.html', 'src/**/*.html.tpl'],
        defaultExtractor: (content) =>
            (
                content
                    .replace(/<\{[\s\S]*?\}>/g, ' ')
                    .replace(/\{\$[^}]+\}/g, ' ')
                    .match(/[A-Za-z0-9-_:\/]+/g)
            ) || [],
        safelist: {
            standard: [/^is-/, /^has-/, /^has-text-/, /^has-background-/],
        },
        keyframes: true,
        fontFace: true,
    });


    return {
        root: 'src',
        base: '',
        build: {
            outDir: '../dist',
            emptyOutDir: true,
            manifest: true,
            minify: noMinify ? false : 'terser',
            cssMinify: !noMinify,
            terserOptions: noMinify
                ? {}
                : {
                    compress: {
                        drop_console: true,
                        drop_debugger: true
                    }
                },
            rollupOptions: {
                input,
                output: {
                    entryFileNames: 'js/[name].[hash].js',
                    chunkFileNames: 'js/[name].[hash].js',
                    assetFileNames: ({ name }) => {
                        if (/\.(css)$/.test(name ?? '')) {
                            const base = name ? name.split(/[\\/\\\\]/).pop() : 'style.css';
                            // Main style.css goes to root dist/ without hash, other CSS files go to dist/css/
                            return base === 'style.css' ? 'style.css' : `css/${base}`;
                        }
                        if (/\.(woff2?|ttf|eot|svg|png|jpe?g|gif|webp|avif)$/.test(name ?? '')) {
                            return 'assets/[name].[hash][extname]';
                        }
                        return 'assets/[name].[hash][extname]';
                    }
                }
            }
        },
        css: {
            postcss: {
                plugins: [
                    !noMinify && purgePlugin,
                    cssnano({ preset: 'default' })
                ].filter(Boolean)
            }
        },
        assetsInclude: [
            '**/*.woff',
            '**/*.woff2',
            '**/*.ttf',
            '**/*.eot',
            '**/*.svg',
            '**/*.png',
            '**/*.jpg',
            '**/*.jpeg',
            '**/*.gif',
            '**/*.webp',
            '**/*.avif'
        ],
        plugins: [
            handleExternalCssImports(), // eerst externe CSS binnenhalen (ook in theme.html)
            copyTemplatesAndAssets()    // daarna templates & assets kopiëren en paden herschrijven
        ]
    };
});
