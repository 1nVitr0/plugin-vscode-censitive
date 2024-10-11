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
import { dirname } from "path";

let configurationProvider = new ConfigurationProvider();
let censoringCodeLensProvider: CensoringCodeLensProvider;
let instanceMap = new Map<string, CensoringProvider>();

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
    commands.registerTextEditorCommand("censitive.displayCensoredRange", async (editor, _, range?: Range) => {
      if (!range) {
        return window.showErrorMessage("No censored field found. This command should not be triggered manually.");
      }

      const censoring = await findOrCreateInstance(editor.document);

      censoring.addVisibleRange(range);
      censoring.applyCensoredRanges();
      setTimeout(() => {
        censoring.removeVisibleRange(range);
        censoring.applyCensoredRanges();
      }, config.showTimeoutSeconds * 1000);
    }),
    createConfigWatcher()
  );

  if (userHome) {
    context.subscriptions.push(createConfigWatcher(Uri.file(userHome)));
  }

  window.onDidChangeVisibleTextEditors(onVisibleEditorsChanged, null, context.subscriptions);
  workspace.onDidCloseTextDocument(onCloseDocument, null, context.subscriptions);
  workspace.onDidChangeConfiguration(onConfigurationChange, null, context.subscriptions);
  extensions.onDidChange(onConfigurationChange, null, context.subscriptions);
}

export function deactivate() {
  instanceMap.forEach((instance) => instance.dispose());
  instanceMap.clear();
}

function createConfigWatcher(folder?: Uri) {
  const configWatcher = workspace.createFileSystemWatcher(
    folder ? new RelativePattern(folder, ".censitive") : "**/.censitive"
  );
  configWatcher.onDidCreate(onCensorConfigChanged);
  configWatcher.onDidChange(onCensorConfigChanged);
  configWatcher.onDidDelete(onCensorConfigChanged);

  return configWatcher;
}

async function isValidDocument(config: Configuration, document: TextDocument): Promise<boolean> {
  return config.enable && (await configurationProvider.isDocumentInCensorConfig(document));
}

async function findOrCreateInstance(document: TextDocument) {
  const found = instanceMap.get(document.uri.toString());

  if (!found) {
    const instance = new CensoringProvider(document, configurationProvider.censorOptions, censoringCodeLensProvider);
    instanceMap.set(document.uri.toString(), instance);
  }

  return found || instanceMap.get(document.uri.toString())!;
}

async function doCensoring(documents: TextDocument[] = [], configChanged = false) {
  if (documents.length) {
    await Promise.all(
      documents.map(async (document) => {
        const instance = await findOrCreateInstance(document);
        instance.censor(true, configChanged);
      })
    );
  }
}

async function onConfigurationChange() {
  await ConfigurationProvider.updateConfig();
  onVisibleEditorsChanged(window.visibleTextEditors);
}

async function onCensorConfigChanged(uri: Uri) {
  const workspaceFolder = workspace.getWorkspaceFolder(uri) ?? null;
  const parentFolder = Uri.file(dirname(uri.fsPath));

  await ConfigurationProvider.updateCensoringKeys(
    workspaceFolder,
    uri,
    parentFolder.toString() === workspaceFolder?.uri.toString() ? workspaceFolder : parentFolder
  );
  onVisibleEditorsChanged(window.visibleTextEditors, true);
}

function onCloseDocument(document: TextDocument) {
  // Dispose instance if document is closed
  instanceMap.delete(document.uri.toString());
}

async function onVisibleEditorsChanged(visibleEditors: readonly TextEditor[], configChanged = false) {
  const { config } = configurationProvider;
  const visibleDocuments = visibleEditors.map(({ document }) => document);

  // Only update visible TextEditors with valid configuration
  const validDocuments = (
    await Promise.all(
      visibleDocuments.map(async (document) => ((await isValidDocument(config, document)) ? document : false))
    )
  ).filter(Boolean) as TextDocument[];
  await doCensoring(validDocuments, configChanged);

  if (configChanged) {
    for (const [document, instance] of instanceMap) {
      if (!(await isValidDocument(config, instance.document))) {
        instance.dispose();
        instanceMap.delete(document);
      }
    }
  }
}
