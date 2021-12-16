import {
  Disposable,
  Position,
  Range,
  TextDocument,
  TextDocumentContentChangeEvent,
  TextEditorDecorationType,
  window,
  workspace,
} from "vscode";
import CensorBar, { CensorOptions } from "../decorations/CensorBar";
import CensoringCodeLensProvider from "./CensoringCodeLensProvider";
import ConfigurationProvider from "./ConfigurationProvider";

export default class CensoringProvider {
  public readonly document: TextDocument;

  private static codeLanguages = [
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
  ];

  private _disposed: boolean = false;
  private censoredRanges: Range[] = [];
  private visibleRanges: Range[] = [];
  private censorBar: CensorBar;
  private codeLensProvider: CensoringCodeLensProvider;
  private codeLensDisposable?: Disposable;
  private configurationProvider = new ConfigurationProvider();
  private listeners: Disposable[] = [];

  public constructor(
    document: TextDocument,
    censorOptions: CensorOptions,
    codeLensProvider: CensoringCodeLensProvider
  ) {
    this.document = document;
    this.censorBar = new CensorBar(censorOptions);
    this.codeLensProvider = codeLensProvider;
    this.listeners.push(
      workspace.onDidChangeTextDocument(({ document, contentChanges }) => this.onUpdate(document, null, contentChanges))
    );
  }

  public get disposed() {
    return this._disposed;
  }

  public addVisibleRange(range: Range): void {
    this.visibleRanges.push(range);
  }

  public removeVisibleRange(range: Range): void {
    const i = this.visibleRanges.findIndex((compare) => range.isEqual(compare));
    if (i >= 0) this.visibleRanges.splice(i, 1);
  }

  public clearVisibleRanges(): void {
    this.visibleRanges = [];
  }

  public static buildCensorKeyRegexCode(keys: string[]) {
    const keyExpression = `(['"]?(?:${keys.join("|")})['"]?[\\t ]*[:=][\\t ]*)`;
    const valueExpression =
      "(['\"`]([^\\s](?:[^\\v\\r\\n,;'\"]|\\\\'|\\\\\"|\\\\`)*)['\"`]?|([^\\s][^a-z_\\s][^\\v\\r\\n,;]*))";
    return new RegExp(`${keyExpression}${valueExpression}(?:[\\v\\r\\n,;]|$)`, "gi");
  }

  public static buildCensorKeyRegexGeneric(keys: string[]) {
    const keyExpression = `(['"]?(?:${keys.join("|")})['"]?[\\t ]*:?[:=][\\t ]*)`;
    const valueExpression = "(['\"]([^\\s](?:[^\\v\\r\\n,;'\"]|\\\\'|\\\\\")*)['\"]?|([^\\s][^\\v\\r\\n,;]*))";
    return new RegExp(`${keyExpression}${valueExpression}(?:[\\v\\r\\n,;]|$)`, "gi");
  }

  public dispose() {
    this._disposed = true;
    this.listeners.forEach((listener) => listener.dispose());
    this.codeLensDisposable?.dispose();
    this.censorBar.decoration.dispose();
  }

  public async censor(fast = false) {
    const { uri, lineCount } = this.document;
    const visibleEditors = window.visibleTextEditors.filter(({ document }) => document.uri === uri);
    const visibleRanges = visibleEditors.reduce<Range[]>((ranges, editor) => [...ranges, ...editor.visibleRanges], []);

    if (fast && lineCount > this.configurationProvider.getConfig().useFastModeMinLines)
      await this.onUpdate(this.document, visibleRanges);
    await this.onUpdate(this.document);
  }

  public async updateCensoredRanges(text: string, version: string, offset?: Position): Promise<number> {
    if (this.document.version.toString() !== version) throw new Error("Document version has already changed");

    const changes = await this.getCensoredRanges(text, offset);
    this.censoredRanges.push(...changes);

    return changes.length;
  }

  public applyCensoredRanges() {
    const { document, censorBar, visibleRanges, censoredRanges } = this;

    const removePrevious = censorBar.regenerateDecoration();
    this.applyDecoration(
      censorBar.decoration,
      censoredRanges.filter((range) => !visibleRanges.some((visible) => visible.isEqual(range)))
    );
    this.codeLensDisposable = this.codeLensProvider.setCensoredRanges(document, censoredRanges, visibleRanges);
    if (removePrevious) removePrevious();
  }

  private async onUpdate(
    document = this.document,
    ranges?: Range[] | null,
    contentChanges?: readonly TextDocumentContentChangeEvent[]
  ) {
    if (this.disposed || this.document.uri.toString() !== document.uri.toString()) return;

    const version = this.document.version.toString();
    const promises: Promise<number>[] = [];

    if (ranges) {
      for (const range of ranges) {
        promises.push(this.updateCensoredRanges(this.document.getText(range), version, range.start));
      }
    } else if (contentChanges) {
      let lineOffset = 0;
      for (const { range, text } of contentChanges) {
        for (let i = this.censoredRanges.length - 1; i >= 0; i--) {
          if (range.contains(this.censoredRanges[i])) this.censoredRanges.splice(i, 1);
        }
        promises.push(this.updateCensoredRanges(text, version, range.start.translate(lineOffset)));
        lineOffset += text.split("\n").length - (range.end.line - range.start.line + 1);
      }
    } else {
      promises.push(this.updateCensoredRanges(this.document.getText(), version));
    }

    const changes = await Promise.all(promises);
    if (changes.reduce((sum, n) => sum + n, 0) > 0) this.applyCensoredRanges();
  }

  private getCensorRegex(keys: string[], languageId?: string): RegExp {
    if (languageId && CensoringProvider.codeLanguages.indexOf(languageId) > -1)
      return CensoringProvider.buildCensorKeyRegexCode(keys);
    else return CensoringProvider.buildCensorKeyRegexGeneric(keys);
  }

  private applyDecoration(decoration: TextEditorDecorationType, ranges: Range[]) {
    window.visibleTextEditors
      .filter(({ document }) => document.uri === this.document.uri)
      .forEach((editor) => editor.setDecorations(decoration, ranges));
  }

  private async getCensoredRanges(text: string, offset?: Position): Promise<Range[]> {
    const keys = this.configurationProvider.getCensoredKeys(this.document);
    if (!keys.length) return [];

    const documentOffset = offset ? this.document.offsetAt(offset) : 0;
    const ranges: Range[] = [];
    const regex = this.getCensorRegex(keys, this.document.languageId);

    let currentMatch = regex.exec(text);
    while (currentMatch !== null) {
      const valueOffset = currentMatch[3] ? currentMatch[2]?.indexOf(currentMatch[3]) : 0;
      const start = currentMatch.index + currentMatch[1].length + valueOffset;
      const end = start + (currentMatch[3]?.length || currentMatch[4].length);

      ranges.push(
        new Range(this.document.positionAt(start + documentOffset), this.document.positionAt(end + documentOffset))
      );

      currentMatch = regex.exec(text);
    }

    return ranges;
  }
}
