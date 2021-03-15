import {
  DecorationRangeBehavior,
  DecorationRenderOptions,
  TextEditorDecorationType,
  ThemableDecorationAttachmentRenderOptions,
  ThemeColor,
  window,
} from 'vscode';

export interface CensorOptions {
  border?: string;
  grow?: boolean;
  postfix?: string;
  prefix?: string;
  opacity?: string;
  color?: string;
}

export default class CensorBar {
  private _decoration?: TextEditorDecorationType;
  private _options: CensorOptions;

  public constructor(options: CensorOptions) {
    this._options = options;
  }

  public get decoration(): TextEditorDecorationType {
    if (!this._decoration) return this.generateDecoration();
    else return this._decoration;
  }

  private static buildRenderAttachment(contentText?: string): ThemableDecorationAttachmentRenderOptions | undefined {
    if (!contentText) return undefined;

    return { contentText };
  }

  public setCensorType(options: CensorOptions) {
    this._options = options;
  }

  private generateDecoration(): TextEditorDecorationType {
    return (this._decoration = window.createTextEditorDecorationType({
      before: CensorBar.buildRenderAttachment(this._options.prefix),
      after: CensorBar.buildRenderAttachment(this._options.postfix),
      rangeBehavior: this._options.grow ? DecorationRangeBehavior.OpenOpen : DecorationRangeBehavior.ClosedClosed,
      ...this.getDecoratrionParams(),
    }));
  }

  private getDecoratrionParams(): DecorationRenderOptions {
    return { border: this._options.border, backgroundColor: this._options.color, opacity: '0' };
  }
}
