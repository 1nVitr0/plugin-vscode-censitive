import { readFile } from "fs";
import { promisify } from "util";
import {
  DocumentSelector,
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

export default class ConfigurationProvider {
  public static censorKeys: { [workspace: string]: CensoringKeys[] } = {};
  private static _config: WorkspaceConfiguration;
  private static _globalWorkspaceName = "global";

  public static get globalCensorKeys(): CensoringKeys[] {
    return ConfigurationProvider.censorKeys[ConfigurationProvider._globalWorkspaceName] ?? [];
  }

  public static async init() {
    await this.updateConfig();
    await this.loadCensoringConfigFile();
  }

  public static async updateConfig() {
    ConfigurationProvider._config = workspace.getConfiguration("censitive");
  }

  public static async updateCensoringKeys(workspace: WorkspaceFolder | Uri, configFile?: Uri) {
    const name = "name" in workspace ? workspace.name : ConfigurationProvider._globalWorkspaceName;
    if (!configFile) {
      return (ConfigurationProvider.censorKeys[name] = []);
    }

    try {
      const content = await promisify(readFile)(configFile.fsPath);
      return (ConfigurationProvider.censorKeys[name] = content
        .toString()
        .split(/\r?\n/g)
        .filter((line) => line.trim() && line[0] !== "#")
        .map((line) => {
          const [pattern, keys] = line.split(":");
          const selector = { pattern: new RelativePattern(workspace, pattern) };
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
  }

  public getCensorOptions(): CensorOptions {
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

  public getConfig(): Configuration {
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
      mergeGlobal = this.getConfig().mergeGlobalCensoring;
    }
    const folder = workspace.getWorkspaceFolder(document.uri);
    const censorKeys = this.getCensoringKeysForFolder(folder, mergeGlobal);

    if (censorKeys.length === 0) {
      return false;
    }

    for (const { selector } of censorKeys) {
      if (languages.match(selector, document) > 0) {
        return true;
      }
    }

    return false;
  }

  public getCensoredKeys(document: TextDocument, mergeGlobal?: boolean): string[] {
    if (mergeGlobal === undefined) {
      mergeGlobal = this.getConfig().mergeGlobalCensoring;
    }
    const folder = workspace.getWorkspaceFolder(document.uri);
    const censorKeys = this.getCensoringKeysForFolder(folder, mergeGlobal);

    if (censorKeys.length === 0) {
      return [];
    }

    return censorKeys.reduce(
      (acc, { selector, keys }) => (languages.match(selector, document) > 0 ? [...acc, ...keys] : acc),
      [] as string[]
    );
  }

  private getCensoringKeysForFolder(folder?: WorkspaceFolder, mergeGlobal = true): CensoringKeys[] {
    const censorKeys = (folder && ConfigurationProvider.censorKeys[folder.name]) ?? [];
    if (mergeGlobal || !folder || !ConfigurationProvider.censorKeys[folder.name]) {
      censorKeys.push(
        ...ConfigurationProvider.globalCensorKeys.filter((censorKey) =>
          censorKeys.every((key) => !ConfigurationProvider.isCensoringKeyEqual(key, censorKey))
        )
      );
    }

    return censorKeys;
  }
}
