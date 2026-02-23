import { Component, ElementRef, EventEmitter, forwardRef, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Lightweight WYSIWYG editor (no external deps).
 * Produces HTML.
 *
 * Security: render with Angular's [innerHTML] (built-in sanitization).
 *
 * Notes:
 * - Uses document.execCommand for broad compatibility.
 * - On paste: inserts plain text (avoids messy Word/HTML).
 */
@Component({
  standalone: true,
  selector: 'app-rich-text-editor',
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true,
    },
  ],
  template: `
    <div class="rte" [class.disabled]="disabled">
      <div class="toolbar" role="toolbar" aria-label="Éditeur">
        <button type="button" class="tb" title="Gras" (click)="cmd('bold')" [disabled]="disabled"><b>B</b></button>
        <button type="button" class="tb" title="Italique" (click)="cmd('italic')" [disabled]="disabled"><i>I</i></button>
        <button type="button" class="tb" title="Souligné" (click)="cmd('underline')" [disabled]="disabled"><u>U</u></button>
        <span class="sep"></span>
        <button type="button" class="tb" title="Liste" (click)="cmd('insertUnorderedList')" [disabled]="disabled">• List</button>
        <button type="button" class="tb" title="Liste numérotée" (click)="cmd('insertOrderedList')" [disabled]="disabled">1. List</button>
        <span class="sep"></span>
        <button type="button" class="tb" title="Lien" (click)="addLink()" [disabled]="disabled"><i class="bi bi-link-45deg"></i></button>
        <button type="button" class="tb" title="Enlever le lien" (click)="cmd('unlink')" [disabled]="disabled"><i class="bi bi-link-45deg" style="opacity:.5"></i></button>
        <span class="sep"></span>
        <button type="button" class="tb" title="Annuler" (click)="cmd('undo')" [disabled]="disabled"><i class="bi bi-arrow-counterclockwise"></i></button>
        <button type="button" class="tb" title="Rétablir" (click)="cmd('redo')" [disabled]="disabled"><i class="bi bi-arrow-clockwise"></i></button>
        <span class="sep"></span>
        <button type="button" class="tb" title="Nettoyer" (click)="clear()" [disabled]="disabled"><i class="bi bi-eraser"></i></button>
      </div>

      <div
        #editable
        class="editor form-control"
        [style.minHeight.px]="minHeight"
        contenteditable="true"
        [attr.aria-label]="ariaLabel"
        [attr.data-placeholder]="placeholder"
        (input)="onInput()"
        (blur)="markTouched()"
        (paste)="onPaste($event)"
      ></div>
    </div>
  `,
  styles: [
    `
    .rte{border:1px solid #dee2e6;border-radius:.375rem;background:#fff}
    .rte.disabled{opacity:.7;pointer-events:none}
    .toolbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px;border-bottom:1px solid #dee2e6;background:rgba(0,0,0,.02);border-top-left-radius:.375rem;border-top-right-radius:.375rem}
    .tb{border:1px solid rgba(0,0,0,.12);background:#fff;border-radius:10px;padding:6px 10px;font-size:12px;line-height:1}
    .tb:hover{background:rgba(0,0,0,.03)}
    .sep{width:1px;height:22px;background:rgba(0,0,0,.12);margin:0 2px}
    .editor{border:0 !important;border-radius:0 !important;box-shadow:none !important;outline:none !important;padding:10px 12px}
    .editor:empty:before{content:attr(data-placeholder);color:rgba(0,0,0,.45)}
    .editor ul,.editor ol{padding-left:18px;margin:6px 0}
    .editor p{margin:0 0 6px}
    `,
  ],
})
export class RichTextEditorComponent implements ControlValueAccessor {
  @Input() placeholder = '';
  @Input() ariaLabel = 'Éditeur de texte';
  @Input() minHeight = 120;

  @Output() htmlChange = new EventEmitter<string>();

  @ViewChild('editable', { static: true }) editable!: ElementRef<HTMLDivElement>;

  disabled = false;

  private onChangeFn: (value: string) => void = () => {};
  private onTouchedFn: () => void = () => {};

  writeValue(value: any): void {
    const html = (value ?? '') as string;
    if (this.editable?.nativeElement) {
      this.editable.nativeElement.innerHTML = html;
    }
  }

  registerOnChange(fn: any): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchedFn = fn;
  }

  /**
   * Angular templates cannot call a private class member.
   * Keep the ControlValueAccessor callbacks private and expose a public wrapper.
   */
  markTouched() {
    this.onTouchedFn();
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (this.editable?.nativeElement) {
      this.editable.nativeElement.setAttribute('contenteditable', (!isDisabled).toString());
    }
  }

  cmd(command: string, value?: string) {
    try {
      this.editable.nativeElement.focus();
      document.execCommand(command, false, value);
      this.onInput();
    } catch {
      // ignore
    }
  }

  addLink() {
    const url = window.prompt('URL du lien (https://...)');
    if (!url) return;
    this.cmd('createLink', url);
  }

  clear() {
    const txt = this.editable.nativeElement.innerText || '';
    this.editable.nativeElement.innerHTML = '';
    this.editable.nativeElement.innerText = txt;
    this.onInput();
  }

  onPaste(e: ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    this.cmd('insertText', text);
  }

  onInput() {
    const html = this.editable.nativeElement.innerHTML || '';
    // Treat "empty" html as empty string so Validators.required works.
    const text = (this.editable.nativeElement.innerText || '').replace(/\u00A0/g, ' ').trim();
    const normalized = text.length === 0 ? '' : (html === '<br>' ? '' : html);
    this.onChangeFn(normalized);
    this.htmlChange.emit(normalized);
  }
}
