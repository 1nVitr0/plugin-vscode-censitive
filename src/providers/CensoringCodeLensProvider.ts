import {
  CancellationToken,
  CodeLens,
  CodeLensProvider,
  Disposable,
  Event,
  EventEmitter,
  ProviderResult,
  Range,
  TextDocument,
} from 'vscode';

export default class CensoringCodeLensProvider implements CodeLensProvider {
  private onDidChange: EventEmitter<void>;
  private censorMap: { [fileName: string]: { censored: Range[]; visible: Range[] } } = {};

  public constructor() {
    this.onDidChange = new EventEmitter();
  }

  get onDidChangeCodeLenses(): Event<void> {
    return this.onDidChange.event;
  }

  public setCensoredRanges({ fileName }: TextDocument, censored: Range[], visible: Range[]): Disposable {
    this.censorMap[fileName] = { censored, visible };
    this.onDidChange.fire();

    return {
      dispose: () => delete this.censorMap[fileName],
    };
  }

  public provideCodeLenses({ fileName }: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]> {
    const { censored, visible } = this.censorMap[fileName] || { censored: [], visible: [] };

    const lenses: CodeLens[] = censored.map(
      (range) =>
        new CodeLens(range, {
          title: 'Copy to Clipboard',
          command: 'censitive.copyCensoredRange',
          arguments: [range],
        })
    );
    for (const range of censored.filter((range) => !visible.some((v) => v.isEqual(range)))) {
      lenses.push(
        new CodeLens(range, {
          title: 'Show Censored Text',
          command: 'censitive.displayCensoredRange',
          arguments: [range],
        })
      );
    }

    return lenses;
  }
}
