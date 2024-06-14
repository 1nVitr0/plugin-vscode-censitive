import { readFile } from "fs";
import { promisify } from "util";
import {
  DocumentSelector,
  env,
  FileStat,
  languages,
  RelativePattern,
  TextDocument,
  Uri,
  window,
  workspace,
  WorkspaceConfiguration,
  WorkspaceFolder,
} from "vscode";
import { CensorOptions } from "../decorations/CensorBar";

export type DefaultCensoringConfig =
  | {
      match: string;
      exclude?: string;
      censor: (string | { start: string; end: string })[];
    }
  | { exclude: string };

export interface Configuration {
  censoring: CensorOptions;
  showTimeoutSeconds: number;
  useFastModeMinLines: number;
  enable: boolean;
  mergeGlobalCensoring: boolean;
  codeLanguages: string[];
  assignmentRegex: Record<string, string> & { default: string };
  defaultCensoring: DefaultCensoringConfig[];
  mergeDefaultCensoring?: boolean;
}

export interface FencingPattern {
  start: string;
  end: string;
}

export type CensoringKeysBase = {
  keys: string[];
  fencingPatterns?: FencingPattern[];
  selector: DocumentSelector | null;
  exclude?: DocumentSelector;
};

export interface CensoringKeysWithSelector extends CensoringKeysBase {
  selector: DocumentSelector;
}

export interface CensoringKeysIgnore extends CensoringKeysBase {
  selector: null;
  exclude: DocumentSelector;
}

export type CensoringKeys = CensoringKeysWithSelector | CensoringKeysIgnore;

export const defaults: Configuration = {
  enable: true,
  mergeGlobalCensoring: true,
  useFastModeMinLines: 10000,
  showTimeoutSeconds: 10,
  codeLanguages: [
    "coffeescript",
    "c",
    "cpp",
    "csharp",
    "fsharp",
    "go",
    "groovy",
    "handlebars",
    "html",
    "java",
    "javascript",
    "lua",
    "objective-c",
    "objective-cpp",
    "perl",
    "php",
    "jade",
    "pug",
    "python",
    "r",
    "razor",
    "ruby",
    "rust",
    "slim",
    "typescript",
    "vb",
    "vue",
    "vue-html",
  ],
  assignmentRegex: {
    default: "[\\t ]*[:=][=>]?[\\t ]*",
    yaml: "[\\t ]*:[\\t ]*(?!>|\\|)",
  },
  censoring: {
    color: "theme.editorInfo.background",
    prefix: "🔒",
    border: "2px solid grey",
    grow: true,
  },
  defaultCensoring: [
    {
      match: "**/{env,.env,env.*,.env.*}",
      exclude: "**/{env.example,.env.example}",
      censor: [".*password", ".*token", ".*secret.*"],
    },
    {
      match: "**/id_{rsa,dsa,ecdsa,eddsa,dss,sha2}",
      censor: [{ start: "-----BEGIN.*PRIVATE KEY-----", end: "-----END.*PRIVATE KEY-----" }],
    },
  ],
};

function isWorkspaceFolder(folder: WorkspaceFolder | Uri): folder is WorkspaceFolder {
  return (folder as WorkspaceFolder).uri !== undefined;
}

function isCensoringKeyWithSelector(key: CensoringKeys): key is CensoringKeysWithSelector {
  return key.selector !== null;
}

function isCensoringKeyIgnore(key: CensoringKeys): key is CensoringKeysIgnore {
  return key.selector === null;
}

export default class ConfigurationProvider {
  public static censorKeys: { [workspace: string]: CensoringKeys[] } = {};
  private static _config: WorkspaceConfiguration;
  private static _globalWorkspaceName = "global";
  private static _defaultWorkspaceName = "default";
  private static _userHome = env.appRoot;

  public static async init() {
    if (ConfigurationProvider._userHome) {
      try {
        // Try to set the correct user home path
        ConfigurationProvider._userHome = require("os").homedir();
      } catch (e) {
        window.showErrorMessage(".censitive could not get user home directory, global config will not be loaded");
      }
    }
    await this.updateConfig();
    await this.loadCensoringConfigFile();
  }

  public static async updateConfig() {
    ConfigurationProvider._config = workspace.getConfiguration("censitive");
    ConfigurationProvider.censorKeys[ConfigurationProvider._defaultWorkspaceName] = (
      ((ConfigurationProvider._config as unknown) || defaults) as Configuration
    ).defaultCensoring?.map(({ exclude, ...options }) => {
      return "match" in options
        ? {
            selector: { pattern: options.match },
            exclude: exclude && { pattern: exclude },
            keys: options.censor.filter((key): key is string => typeof key === "string"),
            fencingPatterns: options.censor.filter((key): key is FencingPattern => typeof key !== "string"),
          }
        : { selector: null, exclude: { pattern: exclude! }, keys: [] };
    });
  }

  public static async updateCensoringKeys(workspace: WorkspaceFolder | Uri, configFile?: Uri | null) {
    const name = isWorkspaceFolder(workspace) ? workspace.name : ConfigurationProvider._globalWorkspaceName;
    if (!configFile) {
      return (ConfigurationProvider.censorKeys[name] = []);
    }

    try {
      const content = await promisify(readFile)(configFile.fsPath);
      return (ConfigurationProvider.censorKeys[name] = content
        .toString()
        .split(/\r?\n/g)
        .filter((line) => line.trim() && !line.startsWith("#") && !line.startsWith("//"))
        .map((line) => {
          const [patternRaw, keyList = "", fenceList] = line.split(/(?<!\\):/);
          const [pattern, excludePattern] = patternRaw.replace(/\\:/g, ":").split(/(?<!\\)!/);

          const selector = pattern
            ? isWorkspaceFolder(workspace)
              ? { pattern: new RelativePattern(workspace, pattern.replace(/\\!/g, "!")) }
              : pattern.replace(/\\!/g, "!")
            : null;
          const exclude =
            excludePattern &&
            (isWorkspaceFolder(workspace)
              ? { pattern: new RelativePattern(workspace, excludePattern.replace(/\\!/g, "!")) }
              : excludePattern.replace(/\\!/g, "!"));
          const keys = keyList
            .replace(/\\:/g, ":")
            .split(/,\s*/g)
            .filter((key) => !!key);
          const fencingPatterns = fenceList
            ? fenceList
                .replace(/\\:/g, ":")
                .split(/,\s*/g)
                .map((fence) => ({
                  start: keys.shift() || "",
                  end: fence,
                }))
                .filter(({ start }) => !!start)
            : undefined;
          return { selector, exclude, keys, fencingPatterns };
        }));
    } catch (e) {
      window.showErrorMessage("Failed to load censitive config (see console for more info)");
      console.error(e);
      return (ConfigurationProvider.censorKeys[name] = []);
    }
  }

  private static async loadCensoringConfigFile() {
    const { stat } = workspace.fs;
    const workspaces = workspace.workspaceFolders || [];
    for (const folder of workspaces) {
      const [configFile] = await workspace.findFiles(new RelativePattern(folder, ".censitive"), null, 1);
      await ConfigurationProvider.updateCensoringKeys(folder, configFile);
    }
    if (ConfigurationProvider._userHome) {
      const globalConfigFile = Uri.joinPath(Uri.file(ConfigurationProvider._userHome), ".censitive");
      const { size } = await new Promise<FileStat>((resolve, reject) =>
        stat(globalConfigFile).then(resolve, reject)
      ).catch(() => ({ size: 0 }));
      if (size > 0) {
        await ConfigurationProvider.updateCensoringKeys(globalConfigFile, globalConfigFile);
      }
    }
  }

  public get userHome(): string {
    return ConfigurationProvider._userHome;
  }

  public get globalCensorKeys(): CensoringKeys[] {
    return ConfigurationProvider.censorKeys[ConfigurationProvider._globalWorkspaceName] ?? [];
  }

  public get defaultCensorKeys(): CensoringKeys[] {
    return ConfigurationProvider.censorKeys[ConfigurationProvider._defaultWorkspaceName] ?? [];
  }

  public get hasGlobalCensorKeys(): boolean {
    return !!this.globalCensorKeys;
  }

  public get hasDefaultCensorKeys(): boolean {
    return !!this.defaultCensorKeys;
  }

  public get censorOptions(): CensorOptions {
    if (typeof ConfigurationProvider._config?.censoring === "object") {
      return { ...ConfigurationProvider._config?.censoring } as CensorOptions;
    }

    return defaults.censoring;
  }

  public toggleEnable() {
    const enabled = ConfigurationProvider._config?.get("enable");
    ConfigurationProvider._config?.update("enable", !enabled);

    return !enabled;
  }

  public get config(): Configuration {
    return ((ConfigurationProvider._config as unknown) || defaults) as Configuration;
  }

  public static isCensoringKeyEqual(a: CensoringKeys, b: CensoringKeys) {
    return (
      a.selector === b.selector &&
      a.exclude === b.exclude &&
      a.keys.every((key) => b.keys.includes(key)) &&
      b.keys.every((key) => a.keys.includes(key))
    );
  }

  public isDocumentInCensorConfig(document: TextDocument): boolean {
    const folder = workspace.getWorkspaceFolder(document.uri);
    const allCensorKeys = this.getCensoringKeysForFolder(folder);
    const censorKeys = allCensorKeys.filter<CensoringKeysWithSelector>(isCensoringKeyWithSelector);
    const ignoreKeys = allCensorKeys.filter<CensoringKeysIgnore>(isCensoringKeyIgnore);

    if (censorKeys.length === 0) {
      return false;
    }

    const { match } = languages;

    if (ignoreKeys.some(({ exclude = "" }) => match(exclude, document) > 0)) {
      return false;
    }

    for (const { selector, exclude } of censorKeys) {
      if (exclude && match(exclude, document) > 0) {
        continue;
      } else if (match(selector, document) > 0) {
        return true;
      }
    }

    return false;
  }

  public getCensoredKeys(document: TextDocument): (string | FencingPattern)[] {
    const folder = workspace.getWorkspaceFolder(document.uri);
    const censorKeys = this.getCensoringKeysForFolder(folder);

    if (censorKeys.length === 0) {
      return [];
    }

    return censorKeys.reduce<(string | FencingPattern)[]>((acc, { selector, keys, fencingPatterns = [] }) => {
      return selector && languages.match(selector, document) > 0 ? [...acc, ...keys, ...fencingPatterns] : acc;
    }, []);
  }

  private getCensoringKeysForFolder(folder?: WorkspaceFolder): CensoringKeys[] {
    const { mergeGlobalCensoring, mergeDefaultCensoring } = this.config;
    const hasGlobalCensoring = this.hasGlobalCensorKeys;
    const hasLocalCensoring = folder && ConfigurationProvider.censorKeys[folder.name];

    const censorKeyGroups = [
      mergeGlobalCensoring || !hasLocalCensoring ? this.globalCensorKeys : [],
      mergeDefaultCensoring || (!hasLocalCensoring && !hasGlobalCensoring) ? this.defaultCensorKeys : [],
    ];
    const censorKeys = this.mergeCensoringKeys(
      (folder && ConfigurationProvider.censorKeys[folder.name]) ?? [],
      ...censorKeyGroups
    );

    return censorKeys.map((censorKey) => {
      let { selector, exclude } = censorKey;
      selector = selector && this.extendGlobSelector(selector, folder);
      exclude = exclude && this.extendGlobSelector(exclude, folder);

      return { ...censorKey, selector, exclude } as CensoringKeys;
    });
  }

  private mergeCensoringKeys(base: CensoringKeys[], ...merge: CensoringKeys[][]) {
    const censorKeys = [...base];
    for (const keys of merge) {
      censorKeys.push(
        ...keys.filter((censorKey) =>
          censorKeys.every((key) => !ConfigurationProvider.isCensoringKeyEqual(key, censorKey))
        )
      );
    }

    return censorKeys;
  }

  private extendGlobSelector(selector: DocumentSelector, folder?: WorkspaceFolder) {
    if (typeof selector === "string") {
      const dirGlob = selector.startsWith("**") || selector.startsWith("./**") ? "" : "**/";
      return folder ? new RelativePattern(folder, selector) : `${dirGlob}${selector}`;
    } else {
      return selector;
    }
  }
}
