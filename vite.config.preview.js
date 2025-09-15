import baseConfig from './vite.config.js';

export default {
    ...baseConfig,
    build: {
        ...baseConfig.build,
        minify: false,
        cssMinify: false,
        terserOptions: {}
    }
};
