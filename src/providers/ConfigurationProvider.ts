import { readFile } from "fs";
import { promisify } from "util";
import {
  DocumentSelector,
  env,
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

export interface Configuration {
  censoring: CensorOptions;
  showTimeoutSeconds: number;
  useFastModeMinLines: number;
  enable: boolean;
  mergeGlobalCensoring: boolean;
}

export interface CensoringKeys {
  keys: string[];
  selector: DocumentSelector;
}

export const defaults: Configuration = {
  enable: true,
  mergeGlobalCensoring: true,
  useFastModeMinLines: 10000,
  showTimeoutSeconds: 10,
  censoring: {
    color: "theme.editorInfo.background",
    prefix: "🔒",
    border: "2px solid grey",
    grow: true,
  },
};

function isWorkspaceFolder(folder: WorkspaceFolder | Uri): folder is WorkspaceFolder {
  return (folder as WorkspaceFolder).uri !== undefined;
}

export default class ConfigurationProvider {
  public static censorKeys: { [workspace: string]: CensoringKeys[] } = {};
  private static _config: WorkspaceConfiguration;
  private static _globalWorkspaceName = "global";
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
  }

  public static async updateCensoringKeys(workspace: WorkspaceFolder | Uri, configFile?: Uri) {
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
          const [pattern, keys] = line.split(":");
          const selector = isWorkspaceFolder(workspace)
            ? { pattern: new RelativePattern(workspace, pattern) }
            : pattern;
          return { selector, keys: keys.split(/,\s*/g) };
        }));
    } catch (e) {
      window.showErrorMessage("Failed to load censitive config (see console for more info)");
      console.error(e);
      return (ConfigurationProvider.censorKeys[name] = []);
    }
  }

  private static async loadCensoringConfigFile() {
    const workspaces = workspace.workspaceFolders || [];
    for (const folder of workspaces) {
      const [configFile] = await workspace.findFiles(new RelativePattern(folder, ".censitive"), null, 1);
      await ConfigurationProvider.updateCensoringKeys(folder, configFile);
    }
    if (ConfigurationProvider._userHome) {
      const globalConfigFile = Uri.joinPath(Uri.file(ConfigurationProvider._userHome), "/.censitive");
      const { size } = await workspace.fs.stat(globalConfigFile);
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

  public isDocumentInCensorConfig(document: TextDocument, mergeGlobal?: boolean): boolean {
    if (mergeGlobal === undefined) {
      mergeGlobal = this.config.mergeGlobalCensoring;
    }
    const folder = workspace.getWorkspaceFolder(document.uri);
    const censorKeys = this.getCensoringKeysForFolder(folder, mergeGlobal);

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

  public getCensoredKeys(document: TextDocument, mergeGlobal?: boolean): string[] {
    if (mergeGlobal === undefined) {
      mergeGlobal = this.config.mergeGlobalCensoring;
    }
    const folder = workspace.getWorkspaceFolder(document.uri);
    const censorKeys = this.getCensoringKeysForFolder(folder, mergeGlobal);

    if (censorKeys.length === 0) {
      return [];
    }

    return censorKeys.reduce((acc, { selector, keys }) => {
      return languages.match(selector, document) > 0 ? [...acc, ...keys] : acc;
    }, [] as string[]);
  }

  private getCensoringKeysForFolder(folder?: WorkspaceFolder, mergeGlobal = true): CensoringKeys[] {
    const censorKeys = (folder && ConfigurationProvider.censorKeys[folder.name]) ?? [];
    if (mergeGlobal || !folder || !ConfigurationProvider.censorKeys[folder.name]) {
      censorKeys.push(
        ...this.globalCensorKeys.filter((censorKey) =>
          censorKeys.every((key) => !ConfigurationProvider.isCensoringKeyEqual(key, censorKey))
        )
      );
    }

    return censorKeys.map((censorKey) => {
      const { keys, selector } = censorKey;
      if (typeof selector === "string") {
        const base = folder ?? "**";
        return {
          keys,
          selector: { pattern: new RelativePattern(base, selector) },
        };
      }

      return censorKey;
    });
  }
}
