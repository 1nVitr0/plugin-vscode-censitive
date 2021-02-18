# Censitive

Censitive censores all your sensitve information, such as database logins, tokens or keys.

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

## Extension Settings

This extension contributes the following settings:

* `censtitive.enable`: enable/disable this extension
* `censtitive.languages`: An array of language ids which should be censored. "*" to trigger on any language; Prepend language id with "!" to exclude the language (i.e "!typescript", "!javascript")
* `censtitive.censor`: Visual settings used for censoring

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

- For large documents it will take some time for the values to get censored. This is unavoidable.
- At the moment there is no option to add custom regular expressions
