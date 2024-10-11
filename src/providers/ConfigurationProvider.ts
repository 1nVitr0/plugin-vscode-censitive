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
import { dirname, relative, isAbsolute } from "path";

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
  public static globalWorkspaceName = "global";
  public static defaultWorkspaceName = "default";
  private static _config: WorkspaceConfiguration;
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
    await this.loadCensoringConfigFiles();
  }

  public static async updateConfig() {
    ConfigurationProvider._config = workspace.getConfiguration("censitive");
    ConfigurationProvider.censorKeys[ConfigurationProvider.defaultWorkspaceName] = (
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

  public static async updateCensoringKeys(
    workspaceFolder: WorkspaceFolder | Uri | null,
    configFile: Uri | null,
    base: Uri | WorkspaceFolder | null = workspaceFolder
  ) {
    const name = base ? (isWorkspaceFolder(base) ? base.name : base.path) : ConfigurationProvider.globalWorkspaceName;
    if (!configFile) {
      return (ConfigurationProvider.censorKeys[name] = []);
    }

    try {
      const content = await workspace.fs.readFile(configFile);
      return (ConfigurationProvider.censorKeys[name] = content
        .toString()
        .split(/\r?\n/g)
        .filter((line) => line.trim() && !line.startsWith("#") && !line.startsWith("//"))
        .map((line) => {
          const [patternRaw, keyList = "", fenceList] = line.split(/(?<!\\):/);
          const [pattern, excludePattern] = patternRaw.replace(/\\:/g, ":").split(/(?<!\\)!/);

          const selector = pattern
            ? base
              ? { pattern: new RelativePattern(base, pattern.replace(/\\!/g, "!")) }
              : pattern.replace(/\\!/g, "!")
            : null;
          const exclude =
            excludePattern &&
            (base
              ? { pattern: new RelativePattern(base, excludePattern.replace(/\\!/g, "!")) }
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

  private static async loadCensoringConfigFiles(path?: Uri) {
    const { stat } = workspace.fs;
    const workspaces = workspace.workspaceFolders || [];
    const insideWorkspace =
      path &&
      workspaces.some(({ uri }) => {
        const relativePath = relative(uri.fsPath, path.fsPath);
        return relativePath && !relativePath.startsWith("..") && !isAbsolute(relativePath);
      });

    if (path && insideWorkspace) {
      // Workspace files are watched and updated on change
      return;
    } else if (path) {
      // We must reload the configuration for non-workspace directories
      // They are unwatched and opened on demand, caching would be inefficient
      const parentDirectories = ConfigurationProvider.getParentDirectories(path);

      await Promise.all(
        parentDirectories.map(async (directory) => {
          const censitiveFile = Uri.joinPath(directory, ".censitive");
          const { size } = await new Promise<FileStat>((resolve, reject) =>
            stat(censitiveFile).then(resolve, reject)
          ).catch(() => ({ size: 0 }));

          if (size > 0) {
            await ConfigurationProvider.updateCensoringKeys(null, censitiveFile, directory);
          }
        })
      );
      return;
    }

    for (const folder of workspaces) {
      const configFiles = await workspace.findFiles(new RelativePattern(folder, "**/.censitive"));
      await Promise.all(
        configFiles.map((censitiveUri) => {
          const base = censitiveUri.with({ path: censitiveUri.path.replace(/\/\.censitive$/, "") });
          return ConfigurationProvider.updateCensoringKeys(folder, censitiveUri, base);
        })
      );
    }

    if (ConfigurationProvider._userHome) {
      const globalConfigFile = Uri.joinPath(Uri.file(ConfigurationProvider._userHome), ".censitive");
      const { size } = await new Promise<FileStat>((resolve, reject) =>
        stat(globalConfigFile).then(resolve, reject)
      ).catch(() => ({ size: 0 }));
      if (size > 0) {
        await ConfigurationProvider.updateCensoringKeys(null, globalConfigFile);
      }
    }
  }

  private static getParentDirectories(path: string | Uri, ignoreHome = false) {
    const parentDirectories = [];
    const userHomePath = Uri.file(ConfigurationProvider._userHome).fsPath;

    let currentDirectory = typeof path === "string" ? path : path.fsPath;
    while (currentDirectory !== dirname(currentDirectory)) {
      if (!ignoreHome || currentDirectory !== userHomePath) {
        parentDirectories.push(Uri.file(currentDirectory));
      }
      currentDirectory = dirname(currentDirectory);
    }

    return parentDirectories;
  }

  public get userHome(): string {
    return ConfigurationProvider._userHome;
  }

  public get globalCensorKeys(): CensoringKeys[] {
    return ConfigurationProvider.censorKeys[ConfigurationProvider.globalWorkspaceName] ?? [];
  }

  public get defaultCensorKeys(): CensoringKeys[] {
    return ConfigurationProvider.censorKeys[ConfigurationProvider.defaultWorkspaceName] ?? [];
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

  public async isDocumentInCensorConfig(document: TextDocument): Promise<boolean> {
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
    const parentFolder = Uri.file(dirname(document.uri.fsPath));
    const allCensorKeys = await this.getCensoringKeysForFolder(workspaceFolder, parentFolder);
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

  public isDocumentInWorkspace(document: TextDocument): boolean {
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
    return !!workspaceFolder;
  }

  public async getCensoredKeys(document: TextDocument): Promise<(string | FencingPattern)[]> {
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
    const parentFolder = Uri.file(dirname(document.uri.fsPath));
    const censorKeys = await this.getCensoringKeysForFolder(workspaceFolder, parentFolder);

    if (censorKeys.length === 0) {
      return [];
    }

    return censorKeys.reduce<(string | FencingPattern)[]>((acc, { selector, keys, fencingPatterns = [] }) => {
      return selector && languages.match(selector, document) > 0 ? [...acc, ...keys, ...fencingPatterns] : acc;
    }, []);
  }

  private async getCensoringKeysForFolder(base?: WorkspaceFolder, subPath?: Uri): Promise<CensoringKeys[]> {
    const { mergeGlobalCensoring, mergeDefaultCensoring } = this.config;

    const baseCensoringKeys = base ? ConfigurationProvider.censorKeys[base.name] : undefined;
    const censorKeyGroups = [];

    if (subPath && !base) {
      // Load config for files outside the workspace
      const parentDirectories = ConfigurationProvider.getParentDirectories(subPath);
      await ConfigurationProvider.loadCensoringConfigFiles(subPath);

      for (const directory of parentDirectories) {
        if (ConfigurationProvider.censorKeys[directory.path]) {
          censorKeyGroups.push(ConfigurationProvider.censorKeys[directory.path]);
        }
      }
    }

    if ((mergeGlobalCensoring || !baseCensoringKeys) && this.hasGlobalCensorKeys) {
      censorKeyGroups.push(this.globalCensorKeys);
    } else if (mergeDefaultCensoring || !baseCensoringKeys) {
      censorKeyGroups.push(this.defaultCensorKeys);
    }

    const censorKeys = this.mergeCensoringKeys(baseCensoringKeys ?? [], ...censorKeyGroups);

    return censorKeys.map((censorKey) => {
      let { selector, exclude } = censorKey;
      selector = selector && this.extendGlobSelector(selector, base);
      exclude = exclude && this.extendGlobSelector(exclude, base);

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
