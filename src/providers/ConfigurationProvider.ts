import { readFile } from 'fs';
import { promisify } from 'util';
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
} from 'vscode';
import { CensorOptions } from '../decorations/CensorBar';

export interface Configuration {
  censoring: CensorOptions;
  showTimeoutSeconds: number;
  useFastModeMinLines: number;
  enable: boolean;
}

export interface CensoringKeys {
  keys: string[];
  selector: DocumentSelector;
}

export const defaults: Configuration = {
  enable: true,
  useFastModeMinLines: 10000,
  showTimeoutSeconds: 10,
  censoring: {
    color: 'theme.editorInfo.background',
    prefix: '🔒',
    border: '2px solid grey',
    grow: true,
  },
};

export default class ConfigurationProvider {
  public static censorKeys: { [workspace: string]: CensoringKeys[] } = {};
  private static _config: WorkspaceConfiguration;

  public static async init() {
    await this.updateConfig();
    await this.loadCensoringConfigFile();
  }

  public static async updateConfig() {
    ConfigurationProvider._config = workspace.getConfiguration('censitive');
  }

  public static async updateCensoringKeys(workspace: WorkspaceFolder, configFile?: Uri) {
    if (!configFile) return (ConfigurationProvider.censorKeys[workspace.name] = []);

    try {
      const content = await promisify(readFile)(configFile.fsPath);
      return (ConfigurationProvider.censorKeys[workspace.name] = content
        .toString()
        .split(/\r?\n/g)
        .filter((line) => line.trim() && line[0] !== '#')
        .map((line) => {
          const [pattern, keys] = line.split(':');
          const selector = { pattern: new RelativePattern(workspace, pattern) };
          return { selector, keys: keys.split(/,\s*/g) };
        }));
    } catch (e) {
      window.showErrorMessage('Failed to load censitive config (see console for more info)');
      console.error(e);
      return (ConfigurationProvider.censorKeys[workspace.name] = []);
    }
  }
  private static async loadCensoringConfigFile() {
    const workspaces = workspace.workspaceFolders || [];
    for (const folder of workspaces) {
      const [configFile] = await workspace.findFiles(new RelativePattern(folder, '.censitive'), null, 1);
      await ConfigurationProvider.updateCensoringKeys(folder, configFile);
    }
  }

  public getCensorOptions(): CensorOptions {
    if (typeof ConfigurationProvider._config?.censoring === 'object')
      return { ...ConfigurationProvider._config?.censoring } as CensorOptions;

    return defaults.censoring;
  }

  public toggleEnable() {
    const enabled = ConfigurationProvider._config?.get('enable');
    ConfigurationProvider._config?.update('enable', !enabled);

    return !enabled;
  }

  public getConfig(): Configuration {
    return ((ConfigurationProvider._config as unknown) || defaults) as Configuration;
  }

  public isDocumentInCensorConfig(document: TextDocument): boolean {
    const folder = workspace.getWorkspaceFolder(document.uri);
    if (!folder || !ConfigurationProvider.censorKeys[folder.name]) return false;

    for (const { selector } of ConfigurationProvider.censorKeys[folder.name])
      if (languages.match(selector, document) > 0) return true;

    return false;
  }

  public getCensoredKeys(document: TextDocument): string[] {
    const folder = workspace.getWorkspaceFolder(document.uri);
    if (!folder || !ConfigurationProvider.censorKeys[folder.name]) return [];

    return (
      ConfigurationProvider.censorKeys[folder.name].reduce(
        (acc, { selector, keys }) => (languages.match(selector, document) > 0 ? [...acc, ...keys] : acc),
        [] as string[]
      ) || []
    );
  }
}
