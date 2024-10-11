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
  Disposable,
} from "vscode";
import CensoringCodeLensProvider from "./providers/CensoringCodeLensProvider";
import CensoringProvider from "./providers/CensoringProvider";
import ConfigurationProvider, { Configuration } from "./providers/ConfigurationProvider";

let configurationProvider = new ConfigurationProvider();
let censoringCodeLensProvider: CensoringCodeLensProvider;
let instanceMap = new Map<TextDocument, CensoringProvider>();
let watchers = new Map<string, FileSystemWatcher>();

export async function activate(context: ExtensionContext) {
  await ConfigurationProvider.init();
  const { config, userHome } = configurationProvider;

  onVisibleEditorsChanged(window.visibleTextEditors);

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
  workspace.onDidChangeWorkspaceFolders(({ added, removed }) => {
    added.forEach(({ name, uri }) => watchWorkspace(name, uri));
    removed.forEach(({ name }) => {
      watchers.get(name)?.dispose();
      watchers.delete(name);
    });
  });

  workspace.workspaceFolders?.forEach(({ name, uri }) => watchWorkspace(name, uri));
  if (userHome) {
    watchWorkspace(ConfigurationProvider.globalWorkspaceName, Uri.file(userHome));
  }
}

export function deactivate() {
  instanceMap.forEach((instance) => instance.dispose());
  watchers.forEach((watcher) => watcher.dispose());

  instanceMap.clear();
  watchers.clear();
}

function watchWorkspace(name: string, folder: Uri) {
  const configWatcher = workspace.createFileSystemWatcher(new RelativePattern(folder, "**/.censitive"));
  configWatcher.onDidCreate(onCensorConfigChanged.bind(null, folder));
  configWatcher.onDidChange(onCensorConfigChanged.bind(null, folder));
  configWatcher.onDidDelete(() => onCensorConfigChanged(folder, null));

  watchers.set(name, configWatcher);
}

async function isValidDocument(config: Configuration, document: TextDocument): Promise<boolean> {
  return config.enable && (await configurationProvider.isDocumentInCensorConfig(document));
}

async function findOrCreateInstance(document: TextDocument) {
  const found = instanceMap.get(document);

  if (!found) {
    const instance = new CensoringProvider(document, configurationProvider.censorOptions, censoringCodeLensProvider);
    instanceMap.set(document, instance);
  }

  return found || instanceMap.get(document)!;
}

async function doCensoring(documents: TextDocument[] = [], configChanged = false) {
  if (documents.length) {
    await Promise.all(
      documents.map((document) =>
        findOrCreateInstance(document).then((instance) => instance.censor(true, configChanged))
      )
    );
  }
}

async function onConfigurationChange() {
  await ConfigurationProvider.updateConfig();
  onVisibleEditorsChanged(window.visibleTextEditors);
}

async function onCensorConfigChanged(folder: WorkspaceFolder | Uri, uri: Uri | null) {
  await ConfigurationProvider.updateCensoringKeys(folder, uri);
  onVisibleEditorsChanged(window.visibleTextEditors, true);
}

function onCloseDocument(document: TextDocument) {
  // Dispose instance if document is closed
  instanceMap.delete(document);
}

async function onVisibleEditorsChanged(visibleEditors: readonly TextEditor[], configChanged = false) {
  const { config } = configurationProvider;
  const visibleDocuments = visibleEditors.map(({ document }) => document);

  // Only update visible TextEditors with valid configuration
  const validDocuments = (
    await Promise.all(visibleDocuments.map(async (doc) => ((await isValidDocument(config, doc)) ? doc : null)))
  ).filter(Boolean) as TextDocument[];
  await doCensoring(validDocuments, configChanged);

  if (configChanged) {
    for (const [document, instance] of instanceMap) {
      if (!(await isValidDocument(config, document))) {
        instance.dispose();
        instanceMap.delete(document);
      }
    }
  }
}
