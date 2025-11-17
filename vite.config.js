import { defineConfig } from 'vite';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { glob } from 'glob';
import cssnano from 'cssnano';
import https from 'https';
import http from 'http';
import { faviconsPlugin } from 'vite-plugin-favicons';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper: find favicon source file (returns path relative to project root)
function findFaviconSource() {
    const searchDir = 'src/images';

    // Priority order: SVG > AVIF > WebP > PNG > JPEG
    const patterns = [
        'favicon.svg', '*.svg',
        'favicon.avif', '*.avif',
        'favicon.webp', '*.webp',
        'favicon.png', '*.png',
        'favicon.jpeg', 'favicon.jpg', '*.jpeg', '*.jpg'
    ];

    for (const pattern of patterns) {
        const files = glob.sync(`${searchDir}/${pattern}`);
        if (files.length > 0) {
            console.log(`✅ Found favicon source: ${files[0]}`);
            // Return path with ./ prefix for Vite plugin
            return `./${files[0]}`;
        }
    }

    console.warn('⚠️  No favicon source file found in src/images/');
    return null;
}

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

// Plugin: externe CSS imports downloaden en herschrijven
function handleExternalCssImports() {
    return {
        name: 'handle-external-css-imports',
        async buildStart() {
            // 1️⃣ CSS-bestanden scannen
            const cssFiles = glob.sync('src/css/**/*.css');
            for (const file of cssFiles) {
                let content = fs.readFileSync(file, 'utf-8');
                content = await processExternalCss(content);
                fs.writeFileSync(file, content, 'utf-8');
            }

            // 2️⃣ theme.html scannen op externe CSS
            const themeFile = 'src/theme.html';
            if (fs.existsSync(themeFile)) {
                let content = fs.readFileSync(themeFile, 'utf-8');
                content = await processExternalCss(content, true);
                fs.writeFileSync(themeFile, content, 'utf-8');
            }
        }
    };
}

// Hulpfunctie: zoekt externe CSS en downloadt deze
async function processExternalCss(content, isHtml = false) {
    // @import in CSS of inline <style>
    const importRegex = /@import\s+(?:url\()?["']?(https?:\/\/[^"')\s]+)["']?\)?\s*;?/gi;
    // <link rel="stylesheet" href="https://...">
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


// Plugin: templates & assets kopiëren, placeholders vervangen, .vite verwijderen
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
            const cssFile = `<{$icms_imageurl}>style.css`;
            const jsFile = manifest['src/js/main.js']
                ? `<{$icms_imageurl}>${manifest['src/js/main.js'].file}`
                : '';

            // 1️⃣ Templates ophalen
            const templates = [
                ...glob.sync('src/templates/**/*.{html.tpl,html}'),
                ...glob.sync('src/modules/**/*.{html.tpl,html}'),
                ...glob.sync('src/theme.html')
            ];

            templates.forEach((srcFile) => {
                if (!fs.existsSync(srcFile)) return;
                const relPath = srcFile.replace(/^src[\\/]/, '');
                const destFile = resolve(__dirname, 'dist', relPath);
                fs.mkdirSync(dirname(destFile), { recursive: true });

                let content = fs.readFileSync(srcFile, 'utf-8');

                // CSS en JS vervangen
                content = content.replace(/style\.css/g, cssFile);
                if (jsFile) {
                    const jsName = manifest['src/js/main.js'].file.split('/').pop();
                    const jsRegex = new RegExp(jsName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                    content = content.replace(jsRegex, jsFile);
                }

                // Fonts en afbeeldingen vervangen
                const assetExts = ['woff2?', 'ttf', 'eot', 'svg', 'png', 'jpe?g', 'gif', 'webp', 'avif', 'ico', 'webmanifest'];
                const assetRegex = new RegExp(`([\\w\\-\\/]+\\.(${assetExts.join('|')}))`, 'gi');
                content = content.replace(assetRegex, `<{$icms_imageurl}>$1`);

                // Template includes herschrijven naar $theme_name
                content = content.replace(
                    /<\{include(q?)\s+([^>]*?)file=["']([^"']+)["']([^>]*?)\}>/gi,
                    (match, q, before, filePath, after) => {
                        // Alleen aanpassen als het geen variabele is en niet al met $theme_name begint
                        if (!filePath.startsWith('$') && !filePath.startsWith('$theme_name')) {
                            const newPath = `$theme_name/${filePath.replace(/^.*?templates[\\/]/, '')}`;
                            return `<{include${q} ${before}file="${newPath}"${after}}>`;
                        }
                        return match;
                    }
                );

                fs.writeFileSync(destFile, content, 'utf-8');
            });

            // 2️⃣ Afbeeldingen fysiek kopiëren
            const images = glob.sync('src/img/**/*.{png,jpg,jpeg,gif,svg,webp,avif}');
            images.forEach((srcFile) => {
                const relPath = srcFile.replace(/^src[\\/]/, '');
                const destFile = resolve(__dirname, 'dist', relPath);
                fs.mkdirSync(dirname(destFile), { recursive: true });
                fs.copyFileSync(srcFile, destFile);
            });

            // 2.5️⃣ Generated favicons kopiëren (if they exist)
            const faviconDir = resolve(__dirname, 'src/public/img');
            if (fs.existsSync(faviconDir)) {
                const favicons = glob.sync('src/public/img/**/*.{png,ico,webmanifest,html}');
                favicons.forEach((srcFile) => {
                    const fileName = basename(srcFile);
                    const destFile = resolve(__dirname, 'dist/img', fileName);
                    fs.mkdirSync(dirname(destFile), { recursive: true });
                    fs.copyFileSync(srcFile, destFile);
                });
                console.log('✅ Favicons gekopieerd naar dist/img');
            }

            // 3️⃣ .vite map verwijderen
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
    const cssEntry = resolve(__dirname, 'src/css/style.css'); // dummy entry
    const faviconSource = findFaviconSource();

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
                input: { style: cssEntry },
                output: {
                    entryFileNames: 'assets/js/[name].[hash].js',
                    chunkFileNames: 'assets/js/[name].[hash].js',
                    assetFileNames: ({ name }) => {
                        if (/\.(css)$/.test(name ?? '')) return 'style[extname]';
                        if (/\.(woff2?|ttf|eot|svg|png|jpe?g|gif|webp|avif)$/.test(name ?? '')) {
                            return 'assets/[name].[hash][extname]';
                        }
                        return 'assets/[name].[hash][extname]';
                    }
                }
            }
        },
        css: {
            postcss: { plugins: [cssnano({ preset: 'default' })] }
        },
        assetsInclude: [
            '**/*.woff','**/*.woff2','**/*.ttf','**/*.eot','**/*.svg',
            '**/*.png','**/*.jpg','**/*.jpeg','**/*.gif','**/*.webp','**/*.avif'
        ],
        plugins: [
            handleExternalCssImports(), // eerst externe CSS binnenhalen
            ...(faviconSource ? [faviconsPlugin({
                imgSrc: faviconSource,
                path: '/img',  // Output path for favicons (relative to public dir)
                appName: 'ImpressCMS',
                appDescription: 'ImpressCMS Theme',
                developerName: 'ImpressCMS',
                developerURL: 'https://www.impresscms.org/',
                background: '#006699',
                theme_color: '#006699',
                icons: {
                    android: true,
                    appleIcon: true,
                    appleStartup: false,
                    favicons: true,
                    windows: false,
                    yandex: false
                }
            })] : []),
            copyTemplatesAndAssets()    // daarna templates & assets kopiëren
        ]
    };
});
