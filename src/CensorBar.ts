import {
  DecorationRangeBehavior,
  DecorationRenderOptions,
  TextEditorDecorationType,
  ThemableDecorationAttachmentRenderOptions,
  window,
} from 'vscode';

export enum CensorType {
  opacity,
  colorBar,
}

export interface CensorOptionsBase {
  prefix?: string;
  postfix?: string;
  grow?: boolean;
  border?: string;
}

export interface CensorOptionsOpacity extends CensorOptionsBase {
  type: CensorType.opacity;
  opacity?: string;
}

export interface CensorOptionsColorBar extends CensorOptionsBase {
  type: CensorType.colorBar;
  color?: string;
}

export type CensorOptions = CensorOptionsOpacity | CensorOptionsColorBar;
export interface CensorOptionsConfig extends Omit<CensorOptions, 'type'> {
  type: keyof typeof CensorType;
}

export default class CensorBar {
  private _options: CensorOptions;
  private _decoration?: TextEditorDecorationType;

  public constructor(options: CensorOptions) {
    this._options = options;
  }

  public get type() {
    return this._options.type;
  }

  public setCensorType(options: CensorOptions) {
    this._options = options;
  }

  public get decoration(): TextEditorDecorationType {
    if (!this._decoration) return this.generateDecoration();
    else return this._decoration;
  }

  private generateDecoration(): TextEditorDecorationType {
    return (this._decoration = window.createTextEditorDecorationType({
      before: CensorBar.buildRenderAttachment(this._options.prefix),
      after: CensorBar.buildRenderAttachment(this._options.postfix),
      rangeBehavior: this._options.grow ? DecorationRangeBehavior.OpenOpen : DecorationRangeBehavior.ClosedClosed,
      border: this._options.border,
      ...this.getDecoratrionParams(),
    }));
  }

  private static buildRenderAttachment(contentText?: string): ThemableDecorationAttachmentRenderOptions | undefined {
    if (!contentText) return undefined;

    return { contentText };
  }

  private getDecoratrionParams(): DecorationRenderOptions {
    switch (this._options.type) {
      case CensorType.opacity:
        return { opacity: this._options.opacity || '0' };
      case CensorType.colorBar:
        return { backgroundColor: this._options.color || 'black', opacity: '0' };
    }
  }
}
