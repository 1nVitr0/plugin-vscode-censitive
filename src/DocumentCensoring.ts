import { timeStamp } from 'node:console';
import {
  DecorationOptions,
  Disposable,
  MarkdownString,
  Range,
  TextDocument,
  TextEditorDecorationType,
  window,
  workspace,
} from 'vscode';
import CensorBar, { CensorOptions } from './CensorBar';
import CensoringCodeLensProvider from './CensoringCodeLensProvider';
import getConfig, { getCensoredKeys } from './Configuration';

export default class DocumentCensoring {
  public readonly document: TextDocument;

  private static codeLanguages = [
    'coffeescript',
    'c',
    'cpp',
    'csharp',
    'fsharp',
    'go',
    'groovy',
    'handlebars',
    'html',
    'java',
    'javascript',
    'lua',
    'objective-c',
    'objective-cpp',
    'perl',
    'php',
    'jade',
    'pug',
    'python',
    'r',
    'razor',
    'ruby',
    'rust',
    'slim',
    'typescript',
    'vb',
    'vue',
    'vue-html',
  ];

  private _disposed: boolean = false;
  private visibleRanges: Range[] = [];
  private censorBar: CensorBar;
  private codeLensProvider: CensoringCodeLensProvider;
  private codeLensDisposable?: Disposable;
  private listener: Disposable;

  public constructor(
    document: TextDocument,
    censorOptions: CensorOptions,
    codeLensProvider: CensoringCodeLensProvider
  ) {
    this.document = document;
    this.censorBar = new CensorBar(censorOptions);
    this.codeLensProvider = codeLensProvider;
    this.listener = workspace.onDidChangeTextDocument(({ document }) => this.onUpdate(document));
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
    const keyExpression = `(['"]?(?:${keys.join('|')})['"]?[\\t ]*[:=][\\t ]*)`;
    const valueExpression =
      '([\'"`]([^\\s](?:[^\\v\\r\\n,;\'"]|\\\\\'|\\\\"|\\\\`)*)[\'"`]?|([^\\s][^a-z_\\s][^\\v\\r\\n,;]*))';
    return new RegExp(`${keyExpression}${valueExpression}(?:[\\v\\r\\n,;]|$)`, 'gi');
  }

  public static buildCensorKeyRegexGeneric(keys: string[]) {
    const keyExpression = `(['"]?(?:${keys.join('|')})['"]?[\\t ]*:?[:=][\\t ]*)`;
    const valueExpression = '([\'"]([^\\s](?:[^\\v\\r\\n,;\'"]|\\\\\'|\\\\")*)[\'"]?|([^\\s][^\\v\\r\\n,;]*))';
    return new RegExp(`${keyExpression}${valueExpression}(?:[\\v\\r\\n,;]|$)`, 'gi');
  }

  public dispose() {
    this._disposed = true;
    this.listener?.dispose();
    this.codeLensDisposable?.dispose();
    this.censorBar.decoration.dispose();
  }

  public async censor(fast = false) {
    const { uri, lineCount } = this.document;
    const visibleEditors = window.visibleTextEditors.filter(({ document }) => document.uri === uri);
    const visibleRanges = visibleEditors.reduce<Range[]>((ranges, editor) => [...ranges, ...editor.visibleRanges], []);

    if (fast && lineCount > getConfig().useFastModeMinLines) await this.onUpdate(this.document, visibleRanges);
    await this.onUpdate(this.document);
  }

  public async updateCensorBars(text: string, version: string, offsetLine = 0) {
    if (this.document.version.toString() !== version) throw new Error('Document version has already changed');

    const ranges = (await this.getCensoredRanges(text)).map(
      ({ start, end }) => new Range(start.with(start.line + offsetLine), end.with(end.line + offsetLine))
    );

    this.applyDecoration(
      this.censorBar.decoration,
      ranges.filter((range) => !this.visibleRanges.some((visible) => visible.isEqual(range)))
    );
    this.codeLensDisposable = this.codeLensProvider.setCensoredRanges(this.document, ranges, this.visibleRanges);
  }

  private async onUpdate(document = this.document, ranges?: Range[]) {
    if (this.disposed || this.document.uri.toString() !== document.uri.toString()) return;

    const version = this.document.version.toString();

    if (!ranges) return await this.updateCensorBars(this.document.getText(), version);

    for (const range of ranges) await this.updateCensorBars(this.document.getText(range), version, range.start.line);
  }

  private getCensorRegex(keys: string[], languageId?: string): RegExp {
    if (languageId && DocumentCensoring.codeLanguages.indexOf(languageId) > -1)
      return DocumentCensoring.buildCensorKeyRegexCode(keys);

    return DocumentCensoring.buildCensorKeyRegexGeneric(keys);
  }

  private applyDecoration(decoration: TextEditorDecorationType, ranges: Range[]) {
    window.visibleTextEditors
      .filter(({ document }) => document.uri === this.document.uri)
      .forEach((editor) => editor.setDecorations(decoration, ranges));
  }

  private async getCensoredRanges(text: string): Promise<Range[]> {
    const keys = getCensoredKeys(this.document);
    if (!keys.length) return [];

    const ranges: Range[] = [];
    const regex = this.getCensorRegex(keys, this.document.languageId);

    let currentMatch = regex.exec(text);
    while (currentMatch !== null) {
      const valueOffset = currentMatch[3] ? currentMatch[2]?.indexOf(currentMatch[3]) : 0;
      const start = currentMatch.index + currentMatch[1].length + valueOffset;
      const end = start + (currentMatch[3]?.length || currentMatch[4].length);

      ranges.push(new Range(this.document.positionAt(start), this.document.positionAt(end)));

      currentMatch = regex.exec(text);
    }

    return ranges;
  }
}
