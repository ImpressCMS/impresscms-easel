import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import glob from 'glob';
import cssnano from 'cssnano';

function updateSmartyTemplates() {
    return {
        name: 'update-smarty-templates',
        closeBundle() {
            const manifestPath = resolve(__dirname, 'dist/manifest.json');
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

            const cssFile = 'style.css';
            const jsFile = manifest['src/js/main.js']?.file || '';

            const templates = [
                ...glob.sync('src/templates/**/*.{html.tpl,html}'),
                ...glob.sync('src/modules/**/*.{html.tpl,html}'),
                ...glob.sync('src/theme.html')
            ];

            templates.forEach((file) => {
                let content = fs.readFileSync(file, 'utf-8');

                // Zoek/vervang met <{ ... }> delimiters
                content = content.replace(/<\{theme_css\}>.*?\.css/, `<{theme_css}>${cssFile}`);
                content = content.replace(/<\{theme_js\}>.*?\.js/, `<{theme_js}>${jsFile}`);

                fs.writeFileSync(file, content, 'utf-8');
            });
        },
    };
}

export default defineConfig({
    root: 'src',
    base: '',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        manifest: true,
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true
            }
        },
        cssMinify: true,
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
    assetsInclude: ['**/*.woff', '**/*.woff2', '**/*.ttf', '**/*.eot', '**/*.svg'],
    plugins: [updateSmartyTemplates()],
});
