import {
  DecorationRangeBehavior,
  DecorationRenderOptions,
  TextEditorDecorationType,
  ThemableDecorationAttachmentRenderOptions,
  ThemeColor,
  window,
} from "vscode";

export interface CensorOptions {
  border?: string;
  grow?: boolean;
  postfix?: string;
  prefix?: string;
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

  public regenerateDecoration() {
    const dispose = this._decoration && this._decoration.dispose;
    this._decoration = undefined;
    this.generateDecoration();
    return dispose;
  }

  private generateDecoration(): TextEditorDecorationType {
    return (this._decoration = window.createTextEditorDecorationType({
      before: CensorBar.buildRenderAttachment(this._options.prefix),
      after: CensorBar.buildRenderAttachment(this._options.postfix),
      rangeBehavior: this._options.grow ? DecorationRangeBehavior.OpenOpen : DecorationRangeBehavior.ClosedClosed,
      ...this.getDecorationParams(),
    }));
  }

  private getDecorationParams(): DecorationRenderOptions {
    const backgroundColor =
      this._options.color && /^theme./.test(this._options.color)
        ? new ThemeColor(this._options.color.replace(/^theme./, ""))
        : this._options.color;

    return { border: this._options.border, backgroundColor, opacity: "0" };
  }
}
