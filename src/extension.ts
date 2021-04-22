import {
  TextEditor,
  ExtensionContext,
  workspace,
  window,
  commands,
  TextDocument,
  FileSystemWatcher,
  RelativePattern,
  Uri,
  WorkspaceFolder,
  extensions,
  Range,
  env,
  languages,
} from 'vscode';
import CensoringCodeLensProvider from './providers/CensoringCodeLensProvider';
import CensoringProvider from './providers/CensoringProvider';
import ConfigurationProvider, { Configuration } from './providers/ConfigurationProvider';

let configurationProvider = new ConfigurationProvider();
let censoringCodeLensProvider: CensoringCodeLensProvider;
let instanceMap: CensoringProvider[] = [];
let watchers: FileSystemWatcher[] = [];

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    languages.registerCodeLensProvider(
      { pattern: '**/*' },
      (censoringCodeLensProvider = new CensoringCodeLensProvider())
    ),
    commands.registerCommand('censitive.toggleCensoring', () => {
      const enabled = configurationProvider.toggleEnable();
      window.showInformationMessage(`Censoring ${enabled ? 'enabled' : 'disabled'}.`);
    }),
    commands.registerTextEditorCommand('censitive.copyCensoredRange', (editor, _, range?: Range) => {
      if (!range)
        return window.showErrorMessage('No censored field found. This command should not be triggered manually.');

      const text = editor.document.getText(range);
      env.clipboard.writeText(text);
      window.showInformationMessage('Censored field copied to clipboard!');
    }),
    commands.registerTextEditorCommand('censitive.displayCensoredRange', (editor, _, range?: Range) => {
      if (!range)
        return window.showErrorMessage('No censored field found. This command should not be triggered manually.');

      findOrCreateInstance(editor.document).then((censoring) => {
        censoring.addVisibleRange(range);
        censoring.censor();
        setTimeout(() => {
          censoring.removeVisibleRange(range);
          censoring.censor();
        }, configurationProvider.getConfig().showTimeoutSeconds * 1000);
      });
    })
  );

  window.onDidChangeVisibleTextEditors(onOpenEditor, null, context.subscriptions);
  workspace.onDidChangeConfiguration(onConfigurationChange, null, context.subscriptions);
  extensions.onDidChange(onConfigurationChange, null, context.subscriptions);

  watchers.push(
    ...(workspace.workspaceFolders?.map((folder) => {
      const configWatcher = workspace.createFileSystemWatcher(new RelativePattern(folder, '.censitive'));
      configWatcher.onDidChange(onCensorConfigChanged.bind(onCensorConfigChanged, folder));

      return configWatcher;
    }) || [])
  );

  ConfigurationProvider.init().then(() => onOpenEditor(window.visibleTextEditors));
}

export function deactivate() {
  instanceMap.forEach((instance) => instance.dispose());
  watchers.forEach((watcher) => watcher.dispose());

  instanceMap = [];
  watchers = [];
}

function reactivate() {
  deactivate();

  instanceMap = [];
  onOpenEditor(window.visibleTextEditors);
}

function isValidDocument(config: Configuration, document: TextDocument): boolean {
  return config.enable && configurationProvider.isDocumentInCensorConfig(document);
}

async function findOrCreateInstance(document: TextDocument) {
  const found = instanceMap.find(({ document: refDoc }) => refDoc === document);

  if (!found) {
    const instance = new CensoringProvider(
      document,
      configurationProvider.getCensorOptions(),
      censoringCodeLensProvider
    );
    instanceMap.push(instance);
  }

  return found || instanceMap[instanceMap.length - 1];
}

async function doCensoring(documents: TextDocument[] = []) {
  if (documents.length) {
    await Promise.all(
      documents.map((document) => findOrCreateInstance(document).then((instance) => instance.censor(true)))
    );
  }
}

function onConfigurationChange() {
  ConfigurationProvider.updateConfig().then(reactivate);
}

function onCensorConfigChanged(folder: WorkspaceFolder, uri: Uri) {
  ConfigurationProvider.updateCensoringKeys(folder, uri);
  onOpenEditor(window.visibleTextEditors);
}

function onOpenEditor(editors: TextEditor[]) {
  const documents = editors.map(({ document }) => document);
  const forDisposal = instanceMap.filter(({ document }) => documents.indexOf(document) === -1);

  instanceMap = instanceMap.filter(({ document }) => documents.indexOf(document) > -1);
  forDisposal.forEach((instance) => instance.dispose());

  // enable highlight in active editors
  const validDocuments = documents.filter((doc) => isValidDocument(configurationProvider.getConfig(), doc));

  doCensoring(validDocuments);
}
