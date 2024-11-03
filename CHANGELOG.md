## [1.5.2](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.5.1...v1.5.2) (2024-11-03)


### Bug Fixes

* support censoring for `#define` in cpp / c ([143776d](https://github.com/1nVitr0/plugin-vscode-censitive/commit/143776d5d92265f088f8ffd910050d3c2494d36b))

## [1.5.1](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.5.0...v1.5.1) (2024-10-28)


### Bug Fixes

* always use default censoring if enabled ([ddbe0dd](https://github.com/1nVitr0/plugin-vscode-censitive/commit/ddbe0dd8e05cfe3afa50c13f8a747c3b81ed3879))
* init and watch only config file in home directory ([8b3d2e8](https://github.com/1nVitr0/plugin-vscode-censitive/commit/8b3d2e8920038a1e7c16dc3591527c2239b895f1))

# [1.5.0](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.4.1...v1.5.0) (2024-10-11)


### Bug Fixes

* always update censoring config on change across workspaces ([3a3649d](https://github.com/1nVitr0/plugin-vscode-censitive/commit/3a3649dd9b2e26bca15cda7ba31532cd9d526dde))
* make changing config more efficient ([0060451](https://github.com/1nVitr0/plugin-vscode-censitive/commit/0060451fdac55f46c98ca970958a4a706ebf7368))


### Features

* support  subdirectories and .censitive files outside workspace ([2bdbe93](https://github.com/1nVitr0/plugin-vscode-censitive/commit/2bdbe93ef7cb3a1247f13522072264cbfeb591d0))
* support subdirectories inside workspace ([c32ab0d](https://github.com/1nVitr0/plugin-vscode-censitive/commit/c32ab0d050b9faf81284282214d8f8d9910c592b))

## [1.4.1](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.4.0...v1.4.1) (2024-09-09)


### Bug Fixes

* skip recalculating ranges when document is unchanged ([2707bc1](https://github.com/1nVitr0/plugin-vscode-censitive/commit/2707bc12c6b68dbac6c5afbe9ac80747b18febc6))

# [1.4.0](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.3.1...v1.4.0) (2024-06-14)


### Features

* add config for default censoring ([1e0b650](https://github.com/1nVitr0/plugin-vscode-censitive/commit/1e0b650bdbfadeeebf8f2470880694ea92a59666))
* add option to exclude globs from censoring ([c58c189](https://github.com/1nVitr0/plugin-vscode-censitive/commit/c58c189f8025b37f6777c406c23d3770432ccf93))

## [1.3.1](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.3.0...v1.3.1) (2023-06-21)


### Bug Fixes

* prevent censoring every line ([f64e022](https://github.com/1nVitr0/plugin-vscode-censitive/commit/f64e0229404af47d86b4a19e58b63652862eae9c))

# [1.3.0](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.2.7...v1.3.0) (2023-06-12)


### Features

* make code languages & assignment configurable ([782cc88](https://github.com/1nVitr0/plugin-vscode-censitive/commit/782cc88781f7be4e01044f5f73ed376283eaa407))
* support fenced censored blocks ([8922078](https://github.com/1nVitr0/plugin-vscode-censitive/commit/8922078362cfe7f935acd39fee07647e6017d005))

## [1.2.7](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.2.6...v1.2.7) (2023-03-25)


### Bug Fixes

* document `**/` glob patterns ([4848888](https://github.com/1nVitr0/plugin-vscode-censitive/commit/48488883e8fa1a2e9827824647cb070f132410e8))

## [1.2.6](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.2.5...v1.2.6) (2023-03-25)


### Bug Fixes

* censor visible editors on launch ([d05fc51](https://github.com/1nVitr0/plugin-vscode-censitive/commit/d05fc518b1b6acac2b8a04fc52688b8da5e7ad47))
* dispose censoring when file is removed from config ([311737a](https://github.com/1nVitr0/plugin-vscode-censitive/commit/311737a618d6b45bf0c8e86918f40892c0de44c8))
* global censitive configuration was permanently merged into workspaces ([a091aea](https://github.com/1nVitr0/plugin-vscode-censitive/commit/a091aea4e8037a301b2ebf2574ab13f5d79d0a48))
* update global and workspace censoring config on create/delete ([4b76cb3](https://github.com/1nVitr0/plugin-vscode-censitive/commit/4b76cb33d1e556e354fdcb6562bdb6e6ebda0aaf))
* watch global `.censtitive` file in userhome ([2b9126d](https://github.com/1nVitr0/plugin-vscode-censitive/commit/2b9126d6746ebb1f6fa0bccad900f78f735211dc))

## [1.2.5](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.2.4...v1.2.5) (2023-03-22)


### Bug Fixes

* censor files without active workspace ([0ed489a](https://github.com/1nVitr0/plugin-vscode-censitive/commit/0ed489ae90dff3d0a8a611d9eecd1eda6ea15f14))

## [1.2.5](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.2.4...v1.2.5) (2023-03-22)


### Bug Fixes

* censor files without active workspace ([0ed489a](https://github.com/1nVitr0/plugin-vscode-censitive/commit/0ed489ae90dff3d0a8a611d9eecd1eda6ea15f14))

## [1.2.4](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.2.3...v1.2.4) (2023-02-15)


### Bug Fixes

* trigger release ([16dba90](https://github.com/1nVitr0/plugin-vscode-censitive/commit/16dba90439e3da2faa7c3f8c56df1677c067242b))

## [1.2.3](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.2.2...v1.2.3) (2023-02-15)


### Bug Fixes

* deploy to OpenVSX ([793a3db](https://github.com/1nVitr0/plugin-vscode-censitive/commit/793a3db4ca905df120352b487207239c470c96c1))

## [1.2.3](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.2.2...v1.2.3) (2023-02-15)


### Bug Fixes

* deploy to OpenVSX ([793a3db](https://github.com/1nVitr0/plugin-vscode-censitive/commit/793a3db4ca905df120352b487207239c470c96c1))

## [1.2.2](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.2.1...v1.2.2) (2022-12-21)


### Bug Fixes

* update svg badges in readme ([4ea9251](https://github.com/1nVitr0/plugin-vscode-censitive/commit/4ea9251c0500af428dcaa33298a949bac812a481))

## [1.2.1](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.2.0...v1.2.1) (2022-12-18)


### Bug Fixes

* allow `//` in `.censitive` files ([3f16364](https://github.com/1nVitr0/plugin-vscode-censitive/commit/3f16364e85accd17fbc66278b44577823dcef88f))

# [1.2.0](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.1.4...v1.2.0) (2022-11-15)


### Bug Fixes

* apply global config relative to workspace ([16408d3](https://github.com/1nVitr0/plugin-vscode-censitive/commit/16408d3db3abd9dda32ff248fd31f154c9b573d0))


### Features

* use global censoring config in home directory ([5ab9077](https://github.com/1nVitr0/plugin-vscode-censitive/commit/5ab907717c064a242df71b9be881e4f213f317fb))

## [1.1.4](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.1.3...v1.1.4) (2022-06-20)


### Bug Fixes

* updgrade dependencies ([a4331d1](https://github.com/1nVitr0/plugin-vscode-censitive/commit/a4331d113c0d67f0aef8b52ce6afb6e34a0acef6))

## [1.1.3](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.1.2...v1.1.3) (2022-04-22)


### Bug Fixes

* fix censoring of values containing `=` ([8c58258](https://github.com/1nVitr0/plugin-vscode-censitive/commit/8c582589e9d0c35d614d8111944eee86cd5159b8))
* update extension icon ([af66d1c](https://github.com/1nVitr0/plugin-vscode-censitive/commit/af66d1c2ff79635c31c8e23f0eba31d9158582a6))

## [1.1.2](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.1.1...v1.1.2) (2022-04-12)


### Bug Fixes

* fix non-quoted censoring ([878672a](https://github.com/1nVitr0/plugin-vscode-censitive/commit/878672a6fe63de7005e3cef06cbf5978ca6a6ef6))

## [1.1.1](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.1.0...v1.1.1) (2022-04-10)


### Bug Fixes

* correctly include escaped quotes ([3246908](https://github.com/1nVitr0/plugin-vscode-censitive/commit/3246908d95f802e7c2c63cc0b06e425867a89062))
* display line censoring index in code lenses ([0336b70](https://github.com/1nVitr0/plugin-vscode-censitive/commit/0336b706ccc924b2b7aeeb3c7491fd26169a78a9))


### Performance Improvements

* increase caching performance ([6026dab](https://github.com/1nVitr0/plugin-vscode-censitive/commit/6026dab0755eb0f842b7e09301344e474d7c46ec))

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.1.0](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.0.2...v1.1.0) (2021-12-17)


### Features

* allow censoring of entire files ([fd4d60b](https://github.com/1nVitr0/plugin-vscode-censitive/commit/fd4d60bb1a43e71d8adcc1b089fd70cea4e1f647))
* censor multiline values ([8c1418b](https://github.com/1nVitr0/plugin-vscode-censitive/commit/8c1418b7dd1dc58e52a0a62f6d1a406603d3acbc))


### Bug Fixes

* fix caching on multiline edits ([a5377f5](https://github.com/1nVitr0/plugin-vscode-censitive/commit/a5377f59855719d330a0c0bf672e072c64c25d6b))

### [1.0.2](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.0.1...v1.0.2) (2021-12-17)


### Bug Fixes

* updat documentation and name ([a066980](https://github.com/1nVitr0/plugin-vscode-censitive/commit/a0669806dbd7f7b1dd617da751e4d5e23f22d58d))

### [1.0.1](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v1.0.0...v1.0.1) (2021-12-17)


### Bug Fixes

* fix inline censoring ([9647fd4](https://github.com/1nVitr0/plugin-vscode-censitive/commit/9647fd4e917555e5a4af645a5dfd94e576f010f5))

## [1.0.0](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v0.1.0...v1.0.0) (2021-04-21)


### Features

* add code actions for copying and showing ([9c9b401](https://github.com/1nVitr0/plugin-vscode-censitive/commit/9c9b4010c07aa0cb3d42977b0d25424023ec0050))
* add configuration for display time ([d4cd205](https://github.com/1nVitr0/plugin-vscode-censitive/commit/d4cd20514a5ea4929b6dc81b1d71a113735b46cc))

## [0.1.0](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v0.0.4...v0.1.0) (2021-03-15)


### ⚠ BREAKING CHANGES

* removed opacity settings for censoring
* languages option no longer available, combined censoring types

### Features

* allow theme values ([dc72017](https://github.com/1nVitr0/plugin-vscode-censitive/commit/dc720179f249b2d9a9e4d912a188ee3798db836a))
* fast(ish) censoring for large documents ([b748e20](https://github.com/1nVitr0/plugin-vscode-censitive/commit/b748e20d735a6a06afe8b50df7730b1698540dbe))


* clean up configuration ([334d051](https://github.com/1nVitr0/plugin-vscode-censitive/commit/334d051a13be9798cbf6b478137e1885fca64060))

### [0.0.4](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v0.0.3...v0.0.4) (2021-02-18)

### [0.0.3](https://github.com/1nVitr0/plugin-vscode-censitive/compare/v0.0.2...v0.0.3) (2021-02-18)


### Features

* :sparkler: allow comments in .censitive file ([c74bcb6](https://github.com/1nVitr0/plugin-vscode-censitive/commit/c74bcb64b0fc196f6fdfd5c85b94ce0cb7611ba7))

### 0.0.2 (2021-02-18)


### Features

* :sparkles: add syntax highlighting ([57621c3](https://github.com/1nVitr0/plugin-vscode-censitive/commit/57621c303e442535e5a128ddd9655fc0356bbd03))
* add icon ([6531358](https://github.com/1nVitr0/plugin-vscode-censitive/commit/653135867bf03e0828a295220ca890f29fdc31a3))


### Bug Fixes

* :bug: dont apply ranges twice on extension install ([2e4d63f](https://github.com/1nVitr0/plugin-vscode-censitive/commit/2e4d63f47b5662080dccf8690ddb01f897fe416c))
* :pencil: fix image visibility in readme ([258a99b](https://github.com/1nVitr0/plugin-vscode-censitive/commit/258a99b8a0ce0c3bb41cddbc447a78b0654c2a77))

## 0.0.1

- Initial release
