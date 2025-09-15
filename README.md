# ImpressCMS Base Theme

[![ImpressCMS](https://img.shields.io/badge/ImpressCMS-Theme-blue.svg)](https://www.impresscms.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0+-yellow.svg)](https://vitejs.dev/)

A starter template for building ImpressCMS themes using [Vite 5.0+](https://vitejs.dev/). This theme provides a modern frontend workflow and tooling for theme development, including fast builds and support for modern JavaScript and CSS.

## Features

- ⚡ **Powered by Vite 5.0+**: Enjoy super-fast development and build speeds.
- 🎨 **Designed for ImpressCMS**: All necessary hooks and templates for seamless integration.
- 🛠️ **ESNext & CSS Support**: Write modern JavaScript and styles.
- 📦 **Production-ready**: Minified and optimized for performance.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- [ImpressCMS](https://www.impresscms.org/) 2.0 or newer

### Installation

1. **Clone this repository:**

   ```bash
   git clone https://github.com/ImpressCMS/impresscms-base-theme.git
   cd impresscms-base-theme
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```
3. **Build for tests:**

   ```bash
   npm run preview
   ```

   The non-optimized theme files will be output to the `dist/` directory to enable you to see the result, but still allow you to do tests and debugging.


4. **Build for production:**

   ```bash
   npm run build
   ```

   The optimized theme files will be output to the `dist/` directory.

### Using With ImpressCMS

Copy the contents of the `dist/` directory to your ImpressCMS themes folder (e.g., `/themes/your-theme-name`). Activate the theme in the ImpressCMS admin interface.

## Structure

```
impresscms-base-theme/
│
├─ src/              # Source files (pages, layouts, assets, scripts)
│   ├─ css/          # Stylesheets
│   ├─ js/           # JavaScript
│   ├─ modules/      # Module-specific Smarty templates
│   ├─ templates/    # General-use theme layouts
│   └─ theme.html    # Main entry point
│
├─ dist/             # Production build output
├─ vite.config.js    # Vite configuration
├─ package.json      # NPM scripts and dependencies
└─ README.md         # This file
```

## Customization

- Edit the files in the `src/` directory to modify layouts, styles, and scripts.
- Update or extend the Vite configuration in `vite.config.js` for advanced usage.
- Add ImpressCMS-specific templates and hooks as needed.

## Scripts

- `npm run preview` – Preview the production build locally, without minification and optimization.
- `npm run build` – Create a production build.


## Contributing

Contributions are welcome! Please open issues or pull requests to suggest improvements or report bugs.

## License

[MIT](LICENSE)

---

**ImpressCMS Base Theme** is maintained by the [ImpressCMS Project](https://github.com/ImpressCMS).  
For documentation and community support, visit [impresscms.org](https://www.impresscms.org/).
