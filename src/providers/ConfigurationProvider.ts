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

export interface DefaultCensoringConfig {
  match: string;
  censor: (string | { start: string; end: string })[];
}

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

export interface CensoringKeys {
  keys: string[];
  fencingPatterns?: FencingPattern[];
  selector: DocumentSelector;
}

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
      match: "**/{env,.env,env.*.env.*}",
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
    ).defaultCensoring?.map(({ match, censor }) => ({
      selector: { pattern: match },
      keys: censor.filter<string>((key) => typeof key === "string"),
      fencingPatterns: censor.filter<FencingPattern>((key) => typeof key !== "string"),
    }));
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
          const [pattern, keyList, fenceList] = line.split(/(?<!\\):/);
          const keys = keyList.split(/,\s*/g);
          const fencingPatterns = fenceList
            ? fenceList
                .split(/,\s*/g)
                .map((fence) => ({
                  start: keys.shift() || "",
                  end: fence,
                }))
                .filter(({ start }) => !!start)
            : undefined;
          const selector = isWorkspaceFolder(workspace)
            ? { pattern: new RelativePattern(workspace, pattern) }
            : pattern;
          return { selector, keys, fencingPatterns };
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
      a.keys.every((key) => b.keys.includes(key)) &&
      b.keys.every((key) => a.keys.includes(key))
    );
  }

  public isDocumentInCensorConfig(document: TextDocument): boolean {
    const folder = workspace.getWorkspaceFolder(document.uri);
    const censorKeys = this.getCensoringKeysForFolder(folder);

    if (censorKeys.length === 0) {
      return false;
    }

    const { match } = languages;
    for (const { selector } of censorKeys) {
      if (match(selector, document) > 0) {
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
      return languages.match(selector, document) > 0 ? [...acc, ...keys, ...fencingPatterns] : acc;
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
      const { keys, selector } = censorKey;
      if (typeof selector === "string") {
        const dirGlob = selector.startsWith("**") || selector.startsWith("./**") ? "" : "**/";
        return {
          keys,
          selector: {
            pattern: folder ? new RelativePattern(folder, selector) : `${dirGlob}${selector}`,
          },
        };
      }

      return censorKey;
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
}
