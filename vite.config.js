import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import fs from 'fs';
import { glob } from 'glob';
import cssnano from 'cssnano';

function updateSmartyTemplates() {
    return {
        name: 'update-smarty-templates',
        closeBundle() {
            const manifestPath = resolve(__dirname, 'dist/.vite/manifest.json');
            if (!fs.existsSync(manifestPath)) {
                console.warn(`⚠️ manifest.json niet gevonden op ${manifestPath}`);
                return;
            }

            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            const cssFile = 'style.css';
            const jsFile = manifest['src/js/main.js']?.file || '';

            // Zoek alle templates in src
            const templates = [
                ...glob.sync('src/templates/**/*.{html.tpl,html}'),
                ...glob.sync('src/modules/**/*.{html.tpl,html}'),
                ...glob.sync('src/theme.html')
            ];

            templates.forEach((srcFile) => {
                const relPath = srcFile.replace(/^src[\\/]/, '');
                const destFile = resolve(__dirname, 'dist', relPath);
                fs.mkdirSync(dirname(destFile), { recursive: true });

                let content = fs.readFileSync(srcFile, 'utf-8');
                content = content.replace(/<\{theme_css\}>.*?\.css/, `<{theme_css}>${cssFile}`);
                content = content.replace(/<\{theme_js\}>.*?\.js/, `<{theme_js}>${jsFile}`);
                fs.writeFileSync(destFile, content, 'utf-8');
            });

            // ✅ Verwijder .vite folder na succesvolle verwerking
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

    return {
        root: 'src',
        base: '',
        build: {
            outDir: '../dist',
            emptyOutDir: true,
            manifest: true,
            minify: noMinify ? false : 'terser',
            cssMinify: !noMinify,
            terserOptions: noMinify ? {} : {
                compress: {
                    drop_console: true,
                    drop_debugger: true
                }
            },
            rollupOptions: {
                input: {
                    main: resolve(__dirname, 'src/js/main.js'),
                },
                output: {
                    entryFileNames: 'assets/js/[name].[hash].js',
                    chunkFileNames: 'assets/js/[name].[hash].js',
                    assetFileNames: ({ name }) => {
                        if (/\.(css)$/.test(name ?? '')) {
                            return 'style[extname]';
                        }
                        if (/\.(woff2?|ttf|eot|svg)$/.test(name ?? '')) {
                            return 'assets/fonts/[name].[hash][extname]';
                        }
                        return 'assets/[name].[hash][extname]';
                    },
                },
            },
        },
        css: {
            postcss: {
                plugins: [
                    cssnano({ preset: 'default' })
                ]
            }
        },
        assetsInclude: [
            '**/*.woff',
            '**/*.woff2',
            '**/*.ttf',
            '**/*.eot',
            '**/*.svg'
        ],
        plugins: [updateSmartyTemplates()],
    };
});
