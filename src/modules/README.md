# Module template overrides

Templates in this folder replace the templates of a module when the theme is active. Use the folder name of the
module and the file name of the template it ships with:

```
src/modules/<module dirname>/<template>.html          # module templates
src/modules/<module dirname>/blocks/<template>.html   # block templates
```

For example, `src/modules/system/blocks/system_block_login.html` replaces the login block of the system module.
Copy the original from `htdocs/modules/<module>/templates/` as a starting point.

The build minifies these templates like the theme templates and copies them to `dist/modules/`. Smarty keeps
compiled copies in `templates_c/`, so clear those after changing an override.
