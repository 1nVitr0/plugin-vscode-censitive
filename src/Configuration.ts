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
import { CensorOptions } from './CensorBar';

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

let _config: WorkspaceConfiguration;
export const censorKeys: { [workspace: string]: CensoringKeys[] } = {};

export async function initConfig() {
  await Promise.all([updateConfig(), loadCensoringConfigFile()]);
}

async function loadCensoringConfigFile() {
  const workspaces = workspace.workspaceFolders || [];
  for (const folder of workspaces) {
    const [configFile] = await workspace.findFiles(new RelativePattern(folder, '.censitive'), null, 1);
    await updateCensoringKeys(folder, configFile);
  }
}

export async function updateCensoringKeys(workspace: WorkspaceFolder, configFile?: Uri) {
  if (!configFile) return (censorKeys[workspace.name] = []);

  try {
    const content = await promisify(readFile)(configFile.fsPath);
    return (censorKeys[workspace.name] = content
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
    return (censorKeys[workspace.name] = []);
  }
}

export async function updateConfig() {
  _config = workspace.getConfiguration('censitive');
}

export function getCensorOptions(): CensorOptions {
  if (typeof _config?.censoring === 'object') return { ..._config?.censoring } as CensorOptions;

  return defaults.censoring;
}

export function toggleEnable() {
  const enabled = _config?.get('enable');
  _config?.update('enable', !enabled);

  return !enabled;
}

export default function getConfig(): Configuration {
  return ((_config as unknown) || defaults) as Configuration;
}

export function isDocumentInCensorConfig(document: TextDocument): boolean {
  const folder = workspace.getWorkspaceFolder(document.uri);
  if (!folder || !censorKeys[folder.name]) return false;

  for (const { selector } of censorKeys[folder.name]) if (languages.match(selector, document) > 0) return true;

  return false;
}

export function getCensoredKeys(document: TextDocument): string[] {
  const folder = workspace.getWorkspaceFolder(document.uri);
  if (!folder || !censorKeys[folder.name]) return [];

  return (
    censorKeys[folder.name].reduce(
      (acc, { selector, keys }) => (languages.match(selector, document) > 0 ? [...acc, ...keys] : acc),
      [] as string[]
    ) || []
  );
}
