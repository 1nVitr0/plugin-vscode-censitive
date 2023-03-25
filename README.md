[![Visual Studio Code extension 1nVitr0.censitive](https://img.shields.io/visual-studio-marketplace/v/1nVitr0.censitive?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=1nVitr0.censitive)
[![Open VSX extension 1nVitr0.censitive](https://img.shields.io/open-vsx/v/1nVitr0/censitive)](https://open-vsx.org/extension/1nVitr0/censitive)
[![Installs for Visual Studio Code extension 1nVitr0.censitive](https://img.shields.io/visual-studio-marketplace/i/1nVitr0.censitive?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=1nVitr0.censitive)
[![Rating for Visual Studio Code extension 1nVitr0.censitive](https://img.shields.io/visual-studio-marketplace/r/1nVitr0.censitive?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=1nVitr0.censitive)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

# Censitive (Hide Passwords and Tokens)

Censitive censors all your sensitive information, such as database logins, tokens or keys.

![demo for .env files](https://raw.githubusercontent.com/1nVitr0/plugin-vscode-censitive/main/resources/demo.gif)

*Please be aware that this extension does __NOT__ guarantee that your private information stays hidden!*
*There is an __unavoidable delay__ between opening a document and the data being censored.*

### To get started

1. Create a `.censitive` file in the root of your workspace (or in your home folder), e.g.:
> ```censitive
> // Format <globPattern>:[keyRegex]
> .env:.*_KEY,.*_token,.*_PassWord
> id_rsa:*
> ```
2. Reload the window using `Developer: Reload Window`
3. Open a file of the type specified in `.censitive` and check the censoring

## Features

The extension uses decorations to block out sensitive information as set in a `.censitive` file in the workspace or in your home directory.
If both files are present and `censtitive.mergeGlobalCensoring` is enabled, their censoring will be merged.

When active, the extension will censor all content set in `.censitive` file by using a key-value approach.
This means, the `.censitive` file specifies key regexes and the extension automatically finds values assigned to these keys.
However, because the censoring is based solely on regex, some value formats may not be recognized.

![demo for js files](https://raw.githubusercontent.com/1nVitr0/plugin-vscode-censitive/main/resources/demo_smart.gif)

Two code actions "Copy to Clipboard" and "Show Censored Text" are provided for convenient access to the censored text.

## Extension Settings

This extension has the following settings:

* `censtitive.enable`: enable/disable this extension
* `censtitive.mergeGlobalCensoring`: merge configuration in your home directory with the workspace settings
* `censitive.useFastModeMinLines`: above this line threshold the document is censored twice: once for the visible range and once for the entire document. This speeds up censoring marginally, but can still be slow
* `censtitive.censor`: Visual settings used for censoring
* `censtitive.showTimeoutSeconds`: Controls the time the password is shown after clicking on 'Show Censored Text'

The values being censored can be controlled using a `.censitive` file in the workspace root.
The keys are matched case insensitive: Its basic format is:

```censitive
# Comment
<globPattern>:[keyRegex]
```

The glob pattern is always taken relative to the active workspace(s).
If there is no active workspace, all patterns are automatically prepended with `**/`.

For example:

```censitive
# Hide the following variables in .env files
.env:.*_KEY,.*_token,.*_PassWord

# Hide all passwords and api tokens in js and ts files
*.{js,ts}:apitoken,.*password
```

To completely hide the content of specific files, the shorthand `*` can be used as the key:

```censitive
# Hide the content of private keys
**/id_rsa:*
```

## Known Issues

* For large documents, it will take some time for the values to get censored. This is unavoidable due to VS Code processing the document before any extensions.
* At the moment, there is no option to add custom regular expressions.
* `.*` will be automatically transformed to `[^\s]*` to enable multiple censors in a single line. This means: keys with spaces might behave differently than expected.
