import {
  Disposable,
  Position,
  Range,
  TextDocument,
  TextDocumentContentChangeEvent,
  TextEditorDecorationType,
  TextLine,
  window,
  workspace,
} from "vscode";
import CensorBar, { CensorOptions } from "../decorations/CensorBar";
import CensoringCodeLensProvider from "./CensoringCodeLensProvider";
import ConfigurationProvider, { FencingPattern } from "./ConfigurationProvider";

type RegexKeyValueParts = { key: string; assignment: string; value: string };
type MultilineCensor = {
  start(line: TextLine, regexParts: RegexKeyValueParts): number | null;
  end(line: TextLine, keyIndent: number, regexParts: RegexKeyValueParts): number | null;
};

const pythonLikeMultiline: MultilineCensor = {
  start: (line: TextLine, regex) =>
    line.text.match(new RegExp(`${regex.key}${regex.assignment}"""`, "i"))?.[0].length ?? null,
  end: (line: TextLine) => (line.text.indexOf('"""') >= 0 ? line.text.indexOf('"""') : null),
};

export default class CensoringProvider {
  public readonly document: TextDocument;

  private static multilineValues: Record<string, MultilineCensor> = {
    python: pythonLikeMultiline,
    toml: pythonLikeMultiline,
    yaml: {
      start: (line: TextLine, regex) =>
        line.text.match(new RegExp(`${regex.key}\\s*:\\s*[>|]-?\\s*`, "i"))?.[0].length ? Infinity : null,
      end: (line: TextLine, indent) => (line.firstNonWhitespaceCharacterIndex <= indent ? -1 : null),
    },
  };

  private documentVersion: number = -1;
  private _disposed: boolean = false;
  private censoredRanges: Range[] = [];
  private visibleRanges: Range[] = [];
  private censorBar: CensorBar;
  private codeLensProvider: CensoringCodeLensProvider;
  private codeLensDisposable?: Disposable;
  private configurationProvider = new ConfigurationProvider();
  private listeners: Disposable[] = [];

  public static buildCensorKeyRegex(
    keys: string[],
    assignment: string,
    ...additionalValueExpressions: string[]
  ): RegexKeyValueParts {
    const escapedKeys = keys.map((key) => key.replace(/(?<!\\)\.\*/g, "[^\\s=]*"));
    const escapedValues = [
      ...['"', "'", "`"].map(CensoringProvider.buildQuotedValueExpression),
      ...additionalValueExpressions,
    ];

    const key = `(?:${escapedKeys.join("|")})`;
    const value = `(${escapedValues.join("|")})`;
    return { key, assignment, value };
  }

  private static buildQuotedValueExpression(quotation: string): string {
    const q = quotation;
    return `(?<!\\\\)${q}((\\\\${q}|[^${q}])*)(?<!\\\\)${q}`;
  }

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

  public getCensorRegex(keys: string[], languageId?: string): RegExp {
    const { config } = this.configurationProvider;
    const isCodeLanguage = languageId && config.codeLanguages.indexOf(languageId) > -1;
    const assignmentRegex = config.assignmentRegex[languageId ?? "default"] || config.assignmentRegex.default;
    const additionalValues = isCodeLanguage ? [] : ["([^\\s\\v\\r\\n,;]*)"];

    const { key, assignment, value } = CensoringProvider.buildCensorKeyRegex(
      keys,
      assignmentRegex,
      ...additionalValues
    );

    return new RegExp(`(['"]?${key}['"]?${assignment})${value}(?:[\\s\\r\\n,;]|$)`, "gi");
  }

  public addVisibleRange(range: Range): void {
    this.visibleRanges.push(range);
  }

  public removeVisibleRange(range: Range): void {
    const i = this.visibleRanges.findIndex((compare) => range.isEqual(compare));
    if (i >= 0) {
      this.visibleRanges.splice(i, 1);
    }
  }

  public clearVisibleRanges(): void {
    this.visibleRanges = [];
  }

  public dispose() {
    this._disposed = true;
    this.listeners.forEach((listener) => listener.dispose());
    this.codeLensDisposable?.dispose();
    this.censorBar.decoration.dispose();
  }

  public async censor(fast = false, configChanged = false) {
    const { config } = this.configurationProvider;

    // We need to reapply the decorations when the visibility changes
    if (
      this.document.version === this.documentVersion &&
      this.configurationProvider.isDocumentInWorkspace(this.document) &&
      !configChanged
    ) {
      return this.applyCensoredRanges();
    }

    const keys = await this.configurationProvider.getCensoredKeys(this.document);
    if (keys.includes("*")) {
      this.censoredRanges = [this.document.validateRange(new Range(0, 0, this.document.lineCount, Infinity))];
      this.documentVersion = this.document.version;
      return this.applyCensoredRanges();
    }

    const { uri, lineCount } = this.document;
    const visibleEditors = window.visibleTextEditors.filter(
      ({ document }) => document.uri.toString() === uri.toString()
    );
    const visibleRanges = visibleEditors.reduce<Range[]>((ranges, editor) => [...ranges, ...editor.visibleRanges], []);

    if (fast && lineCount > config.useFastModeMinLines) {
      await this.onUpdate(this.document, visibleRanges, configChanged);
    }
    await this.onUpdate(this.document, null, configChanged);

    this.documentVersion = this.document.version;
  }

  public applyCensoredRanges() {
    const { document, censorBar, visibleRanges, censoredRanges } = this;

    const removePrevious = censorBar.regenerateDecoration();
    this.applyDecoration(
      censorBar.decoration,
      censoredRanges.filter((range) => !visibleRanges.some((visible) => visible.isEqual(range)))
    );
    this.codeLensDisposable = this.codeLensProvider.setCensoredRanges(document, censoredRanges, visibleRanges);
    if (removePrevious) {
      removePrevious();
    }
  }

  private async updateCensoredRanges(text: string, version: number, offset?: Position): Promise<number> {
    if (this.document.version !== version) {
      throw new Error("Document version has already changed");
    }

    const changes = await this.getCensoredRanges(text, offset);
    this.censoredRanges.push(...changes);

    return changes.length;
  }

  private async updateMultilineCensoredRanges(version: number): Promise<number> {
    if (this.document.version !== version) {
      throw new Error("Document version has already changed");
    }

    for (let i = this.censoredRanges.length - 1; i > 0; i--) {
      const range = this.censoredRanges[i];
      if (!range.isSingleLine) {
        this.censoredRanges.splice(i, 1);
      }
    }

    const newRanges = await this.getMultilineRanges();
    this.censoredRanges.push(...newRanges);

    return newRanges.length;
  }

  private async onUpdate(
    document = this.document,
    ranges?: Range[] | null,
    contentChanges?: readonly TextDocumentContentChangeEvent[] | boolean
  ) {
    const { version, uri } = document;
    if (
      this.disposed ||
      uri.toString() !== this.document.uri.toString() ||
      (version === this.documentVersion && contentChanges !== true)
    ) {
      return;
    }

    const keys = await this.configurationProvider.getCensoredKeys(document);
    if (keys.includes("*")) {
      this.documentVersion = version;
      return this.censor(false, contentChanges === true);
    }

    const promises: Promise<number>[] = [];
    let deletions = 0;

    if (contentChanges === true) {
      this.censoredRanges = [];
      promises.push(this.updateCensoredRanges(document.getText(), version));
    } else if (ranges) {
      for (const range of ranges) {
        promises.push(this.updateCensoredRanges(document.getText(range), version, range.start));
      }
    } else if (contentChanges) {
      let lineOffset = 0;
      for (const change of contentChanges) {
        // Expand range to re-evaluate incomplete censor key-value pairs
        const { range, text } = change.range.isSingleLine ? document.lineAt(change.range.start.line) : change;
        for (let i = this.censoredRanges.length - 1; i >= 0; i--) {
          if (range.intersection(this.censoredRanges[i])) {
            this.censoredRanges.splice(i, 1);
            deletions++;
          }
        }
        promises.push(this.updateCensoredRanges(text, version, range.start.translate(lineOffset)));
        lineOffset += change.text.split("\n").length - (range.end.line - range.start.line + 1);
        for (let i = 0; i < this.censoredRanges.length; i++) {
          const range = this.censoredRanges[i];
          if (range.start.line > change.range.end.line) {
            this.censoredRanges[i] = new Range(range.start.translate(lineOffset), range.end.translate(lineOffset));
          }
        }
      }
    } else {
      this.censoredRanges = [];
      promises.push(this.updateCensoredRanges(document.getText(), version));
    }

    const changes = await Promise.all(promises);
    if (contentChanges === true || deletions || changes.reduce((sum, n) => sum + n, 0) > 0) {
      this.applyCensoredRanges();
    }

    const multilineChanges = await this.updateMultilineCensoredRanges(version);
    if (multilineChanges) {
      this.applyCensoredRanges();
    }

    this.documentVersion = version;
  }

  private applyDecoration(decoration: TextEditorDecorationType, ranges: Range[]) {
    window.visibleTextEditors
      .filter(({ document }) => document.uri.toString() === this.document.uri.toString())
      .forEach((editor) => editor.setDecorations(decoration, ranges));
  }

  private async getCensoredRanges(text: string, offset?: Position): Promise<Range[]> {
    const { languageId } = this.document;
    const keys = (await this.configurationProvider.getCensoredKeys(this.document)).filter(
      (key) => typeof key === "string"
    ) as string[];
    if (!keys.length) {
      return [];
    }

    const documentOffset = offset ? this.document.offsetAt(offset) : 0;
    const ranges: Range[] = [];
    const regex = this.getCensorRegex(keys, languageId);

    let currentMatch = regex.exec(text);
    while (currentMatch !== null) {
      const [_, key, value, ...innerAll] = currentMatch;
      const inner = innerAll.reduce((max, s) => (s && s.length > max.length ? s : max), "");

      const valueOffset = inner ? value?.indexOf(inner) : 0;
      const start = currentMatch.index + key.length + valueOffset;
      const end = start + (inner?.length ?? 0);

      ranges.push(
        new Range(this.document.positionAt(start + documentOffset), this.document.positionAt(end + documentOffset))
      );

      currentMatch = regex.exec(text);
    }

    return ranges;
  }

  public async getMultilineRanges() {
    const { languageId } = this.document;
    const censoring = await this.configurationProvider.getCensoredKeys(this.document);
    const keys = censoring.filter((key) => typeof key === "string") as string[];
    const fencePatterns = censoring.filter((key) => typeof key !== "string") as FencingPattern[];

    const ranges = [];
    let multiline = CensoringProvider.multilineValues[languageId];
    const regexParts = CensoringProvider.buildCensorKeyRegex(keys, languageId);

    if (fencePatterns.length > 0) {
      const regexpStart = new RegExp(fencePatterns.map((f) => `(${f.start})`).join("|"));
      const regexpEnd = new RegExp(fencePatterns.map((f) => `(${f.end})`).join("|"));

      const { start = undefined, end = undefined } = multiline ?? {};

      multiline = {
        start(line: TextLine, regex) {
          const match = regexpStart.exec(line.text);
          return match ? match.index + match[0].length : start?.(line, regex) ?? null;
        },
        end(line: TextLine, indent, regex) {
          const match = regexpEnd.exec(line.text);
          return match ? match.index : end?.(line, indent, regex) ?? null;
        },
      };
    }

    if (multiline) {
      let start: Position | null = null;
      let startIndent = -1;
      let line = this.document.lineAt(0);
      while (line.lineNumber < this.document.lineCount) {
        const startOffset = multiline.start(line, regexParts);
        if (start === null && startOffset !== null) {
          start = this.getLineOffset(line, startOffset);
          startIndent = line.firstNonWhitespaceCharacterIndex;
        } else if (start !== null) {
          const endOffset = multiline.end(line, startIndent, regexParts);
          if (endOffset !== null) {
            ranges.push(this.document.validateRange(new Range(start, this.getLineOffset(line, endOffset))));
            start = null;
          }
        }

        if (line.lineNumber === this.document.lineCount - 1) {
          break;
        }
        line = this.document.lineAt(line.lineNumber + 1);
      }

      if (start !== null) {
        ranges.push(this.document.validateRange(new Range(start, line.range.end)));
      }
    }

    return ranges;
  }

  public getLineOffset(line: TextLine, offset: number): Position {
    if (offset === -1) {
      return new Position(line.lineNumber - 1, Infinity);
    } else if (offset === Infinity) {
      return new Position(line.lineNumber + 1, 0);
    } else {
      return new Position(line.lineNumber, offset);
    }
  }
}
