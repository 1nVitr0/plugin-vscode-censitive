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
} from "vscode";
import CensoringCodeLensProvider from "./providers/CensoringCodeLensProvider";
import CensoringProvider from "./providers/CensoringProvider";
import ConfigurationProvider, { Configuration } from "./providers/ConfigurationProvider";

let configurationProvider = new ConfigurationProvider();
let censoringCodeLensProvider: CensoringCodeLensProvider;
let instanceMap: CensoringProvider[] = [];
let watchers: FileSystemWatcher[] = [];

export async function activate(context: ExtensionContext) {
  await ConfigurationProvider.init();
  const { config, userHome } = configurationProvider;

  context.subscriptions.push(
    languages.registerCodeLensProvider(
      { pattern: "**/*" },
      (censoringCodeLensProvider = new CensoringCodeLensProvider())
    ),
    commands.registerCommand("censitive.toggleCensoring", () => {
      const enabled = configurationProvider.toggleEnable();
      window.showInformationMessage(`Censoring ${enabled ? "enabled" : "disabled"}.`);
    }),
    commands.registerTextEditorCommand("censitive.copyCensoredRange", (editor, _, range?: Range) => {
      if (!range) {
        return window.showErrorMessage("No censored field found. This command should not be triggered manually.");
      }

      const text = editor.document.getText(range);
      env.clipboard.writeText(text);
      window.showInformationMessage("Censored field copied to clipboard!");
    }),
    commands.registerTextEditorCommand("censitive.displayCensoredRange", (editor, _, range?: Range) => {
      if (!range) {
        return window.showErrorMessage("No censored field found. This command should not be triggered manually.");
      }

      findOrCreateInstance(editor.document).then((censoring) => {
        censoring.addVisibleRange(range);
        censoring.applyCensoredRanges();
        setTimeout(() => {
          censoring.removeVisibleRange(range);
          censoring.applyCensoredRanges();
        }, config.showTimeoutSeconds * 1000);
      });
    })
  );

  window.onDidChangeVisibleTextEditors(onVisibleEditorsChanged, null, context.subscriptions);
  workspace.onDidCloseTextDocument(onCloseDocument, null, context.subscriptions);
  workspace.onDidChangeConfiguration(onConfigurationChange, null, context.subscriptions);
  extensions.onDidChange(onConfigurationChange, null, context.subscriptions);

  watchers.push(
    ...(workspace.workspaceFolders?.map((folder) => {
      const configWatcher = workspace.createFileSystemWatcher(new RelativePattern(folder, ".censitive"));
      configWatcher.onDidChange(onCensorConfigChanged.bind(onCensorConfigChanged, folder));

      return configWatcher;
    }) || [])
  );
  if (userHome) {
    const userHomeUri = Uri.file(userHome);
    const globalConfigWatcher = workspace.createFileSystemWatcher(new RelativePattern(userHome, ".censitive"));
    watchers.push(globalConfigWatcher);
    globalConfigWatcher.onDidChange(
      onCensorConfigChanged.bind(onCensorConfigChanged, userHomeUri, Uri.joinPath(userHomeUri, ".censitive"))
    );
  }
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
  onVisibleEditorsChanged(window.visibleTextEditors);
}

function isValidDocument(config: Configuration, document: TextDocument): boolean {
  return config.enable && configurationProvider.isDocumentInCensorConfig(document);
}

async function findOrCreateInstance(document: TextDocument) {
  const found = instanceMap.find(({ document: refDoc }) => refDoc === document);

  if (!found) {
    const instance = new CensoringProvider(document, configurationProvider.censorOptions, censoringCodeLensProvider);
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

function onCensorConfigChanged(folder: WorkspaceFolder | Uri, uri: Uri) {
  ConfigurationProvider.updateCensoringKeys(folder, uri);
  onVisibleEditorsChanged(window.visibleTextEditors);
}

function onCloseDocument(document: TextDocument) {
  // Dispose instance if document is closed
  for (let i = 0; i < instanceMap.length; i++) {
    if (instanceMap[i].document === document) {
      instanceMap[i].dispose();
      instanceMap.splice(i, 1);
      break;
    }
  }
}

function onVisibleEditorsChanged(visibleEditors: readonly TextEditor[]) {
  const { config } = configurationProvider;
  const visibleDocuments = visibleEditors.map(({ document }) => document);

  // Only update visible TextEditors with valid configuration
  const validDocuments = visibleDocuments.filter((doc) => isValidDocument(config, doc));
  doCensoring(validDocuments);
}
