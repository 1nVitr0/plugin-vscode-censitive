[![Visual Studio Code extension 1nVitr0.censitive](https://vsmarketplacebadge.apphb.com/version/1nVitr0.censitive.svg)](https://marketplace.visualstudio.com/items?itemName=1nVitr0.censitive)
[![Installs for Visual Studio Code extension 1nVitr0.censitive](https://vsmarketplacebadge.apphb.com/installs/1nVitr0.censitive.svg)](https://marketplace.visualstudio.com/items?itemName=1nVitr0.censitive)
[![Rating for Visual Studio Code extension 1nVitr0.censitive](https://vsmarketplacebadge.apphb.com/rating/1nVitr0.censitive.svg)](https://marketplace.visualstudio.com/items?itemName=1nVitr0.censitive)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

# Censitive

Censitive censores all your sensitve information, such as database logins, tokens or keys.
*Remember to reload the window after creating a .censitive file.*

![demo for .env files](https://raw.githubusercontent.com/1nVitr0/plugin-vscode-censitive/main/resources/demo.gif)

*Please be aware that this extension does NOT guarantee that your private information stays hidden!*
*There is some unavoidable delay between opening a document and the data being censored.*

**THIS EXTENSION IS NOT SUITABLE FOR CRITICAL DATA THAT IS DEPENDENT ON BEING INVISIBLE!**

## Features

The extension uses decorations to block out sensitive information as set in a .censitive file in the workspace.
If no such file is present, the extension will not be activated.

When active, the extension will censor all content set in .censitive file by using a key-value approach.
This means, the .censitive file specifies key regexes and the extension automatically finds values assigned to these keys.
However as the censoring is based solely on regex, not all assignment formats might be recognized.

![demo for js files](https://raw.githubusercontent.com/1nVitr0/plugin-vscode-censitive/main/resources/demo_smart.gif)

Two code actions "Copy to Clipboard" and "Show Censored Text" are provided for convenient access to the censored text.

## Extension Settings

This extension contributes the following settings:

* `censtitive.enable`: enable/disable this extension
* `censitive.useFastModeMinLines`: above this line threshold the document is censored twice: once for the visible range and once for the entire document. This speeds up censoring marginally, but can still be slow
* `censtitive.censor`: Visual settings used for censoring
* `censtitive.showTimeoutSeconds`: Controls the time the password is shown after clicking on 'Show Censored Text'

The values being censored can be controlled using a `.censitive` file in the workspace root.
The keys are matched case insensitive: It's basic format is:

```
# Comment
<globPattern>:[keyRegex]
```

For example:

```
# Hide the following variables in .env files
.env:.*_KEY,.*_token,.*_PassWord

# Hide all passwords and api tokens in js and ts files
*.{js,ts}:apitoken,.*password
```

## Known Issues

- For large documents it will take some time for the values to get censored. This is unavoidable due to VS Code processing the document before any extensions.
- At the moment there is no option to add custom regular expressions
- The window must be reloaded after creating a new `.censitive` file
