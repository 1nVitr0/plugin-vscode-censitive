import { Disposable, Range, TextDocument, window, workspace } from 'vscode';
import CensorBar, { CensorOptions } from './CensorBar';
import { censorKeys, getCensoredKeys } from './Configuration';

export default class DocumentCensoring {
  public readonly document: TextDocument;
  private _disposed: boolean = false;
  private listener: Disposable;
  private censorBar: CensorBar;

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

  public static buildCensorKeyRegexGeneric(keys: string[]) {
    const keyExpression = `(['"]?(?:${keys.join('|')})['"]?[\\t ]*:?[:=][\\t ]*)`;
    const valueExpression = '([\'"]([^\\s](?:[^\\v\\r\\n,;\'"]|\\\\\'|\\\\")*)[\'"]?|([^\\s][^\\v\\r\\n,;]*))';
    return new RegExp(`${keyExpression}${valueExpression}(?:[\\v\\r\\n,;]|$)`, 'gi');
  }

  public static buildCensorKeyRegexCode(keys: string[]) {
    const keyExpression = `(['"]?(?:${keys.join('|')})['"]?[\\t ]*[:=][\\t ]*)`;
    const valueExpression =
      '([\'"`]([^\\s](?:[^\\v\\r\\n,;\'"]|\\\\\'|\\\\"|\\\\`)*)[\'"`]?|([^\\s][^a-z_\\s][^\\v\\r\\n,;]*))';
    return new RegExp(`${keyExpression}${valueExpression}(?:[\\v\\r\\n,;]|$)`, 'gi');
  }

  public constructor(document: TextDocument, censorOptions: CensorOptions) {
    this.document = document;
    this.censorBar = new CensorBar(censorOptions);
    this.listener = workspace.onDidChangeTextDocument(({ document }) => this.onUpdate(document));
  }

  public get disposed() {
    return this._disposed;
  }

  private getCensorRegex(keys: string[], languageId?: string): RegExp {
    if (languageId && DocumentCensoring.codeLanguages.indexOf(languageId) > -1)
      return DocumentCensoring.buildCensorKeyRegexCode(keys);

    return DocumentCensoring.buildCensorKeyRegexGeneric(keys);
  }

  private async getCensoredRanges(text: string): Promise<Range[]> {
    const keys = getCensoredKeys(this.document);
    if (!keys.length) return [];

    const regex = this.getCensorRegex(keys, this.document.languageId);

    let currentMatch = regex.exec(text);
    const ranges: Range[] = [];

    while (currentMatch !== null) {
      const valueOffset = currentMatch[3] ? currentMatch[2]?.indexOf(currentMatch[3]) : 0;
      const start = currentMatch.index + currentMatch[1].length + valueOffset;
      const end = start + (currentMatch[3]?.length || currentMatch[4].length);

      ranges.push(new Range(this.document.positionAt(start), this.document.positionAt(end)));

      currentMatch = regex.exec(text);
    }

    return ranges;
  }

  public onUpdate(document = this.document) {
    if (this.disposed || this.document.uri.toString() !== document.uri.toString()) return;

    const text = this.document.getText();
    const version = this.document.version.toString();

    return this.updateCensorBars(text, version);
  }

  public async updateCensorBars(text: string, version: string) {
    if (this.document.version.toString() !== version) throw new Error('Document version already has changed');

    const decoration = this.censorBar.decoration;
    const ranges = await this.getCensoredRanges(text);

    window.visibleTextEditors
      .filter(({ document }) => document.uri === this.document.uri)
      .forEach((editor) => editor.setDecorations(decoration, ranges));
  }

  public dispose() {
    this._disposed = true;
    this.listener?.dispose();
    this.censorBar.decoration.dispose();
  }
}
