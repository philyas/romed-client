import { Component, Input, Output, EventEmitter, signal, computed, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatIconModule,
    MatButtonModule
  ],
  template: `
    <mat-form-field appearance="outline" class="searchable-select-field" [class.disabled]="disabled">
      <mat-label>
        <mat-icon *ngIf="icon">{{ icon }}</mat-icon>
        {{ label }}
      </mat-label>
      <input
        #inputElement
        matInput
        type="text"
        [value]="inputValue()"
        matAutocompletePosition="below"
        (focus)="handleFocus()"
        (input)="handleInput($event.target.value)"
        [matAutocomplete]="auto"
        [placeholder]="placeholder || ''"
        [disabled]="disabled"
        autocomplete="off"
        (blur)="handleBlur()"
      />
      <button
        *ngIf="clearable && searchTerm()"
        mat-icon-button
        matSuffix
        type="button"
        aria-label="Auswahl löschen"
        (click)="clearSearch($event)"
      >
        <mat-icon>close</mat-icon>
      </button>
      <button
        mat-icon-button
        matSuffix
        type="button"
        aria-label="Auswahlliste öffnen"
        [disabled]="disabled"
        (click)="togglePanel($event)"
      >
        <mat-icon>arrow_drop_down</mat-icon>
      </button>
      <mat-hint *ngIf="hint">{{ hint }}</mat-hint>
    </mat-form-field>
    <mat-autocomplete
      #auto="matAutocomplete"
      autoActiveFirstOption
      panelClass="searchable-select-panel"
      (optionSelected)="handleSelection($event)"
    >
      <mat-option
        *ngIf="includeAllOption && shouldShowAllOption()"
        [value]="allValue"
      >
        {{ allLabel }}
      </mat-option>
      <mat-option
        *ngFor="let option of filteredOptions()"
        [value]="option"
      >
        {{ formatOption(option) }}
      </mat-option>
      <mat-option
        *ngIf="filteredOptions().length === 0 && !(includeAllOption && shouldShowAllOption())"
        disabled
      >
        Keine Treffer
      </mat-option>
    </mat-autocomplete>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .searchable-select-field {
      width: 100%;
    }

    .searchable-select-field.disabled {
      pointer-events: none;
    }

    mat-label {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    mat-label mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    :host ::ng-deep .searchable-select-panel,
    :host ::ng-deep .mat-mdc-autocomplete-panel {
      background: #ffffff !important;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.18) !important;
      border-radius: 8px;
      z-index: 1300;
      --mat-option-selected-state-layer-color: transparent;
      --mat-option-hover-state-layer-color: transparent;
      --mat-option-focus-state-layer-color: transparent;
    }

    :host ::ng-deep .searchable-select-panel .mat-mdc-option {
      background: #ffffff !important;
      color: rgba(0, 0, 0, 0.87);
    }

    :host ::ng-deep .searchable-select-panel .mat-mdc-option.mdc-list-item--selected,
    :host ::ng-deep .searchable-select-panel .mat-mdc-option:hover {
      background: #e0f2ff !important;
      color: #0b5394 !important;
    }

    :host ::ng-deep .searchable-select-panel .mat-mdc-option.mdc-list-item--disabled {
      color: rgba(0, 0, 0, 0.38);
      background: #ffffff;
    }

    :host ::ng-deep .searchable-select-panel .mdc-list-item__background {
      background-color: #ffffff !important;
      opacity: 1 !important;
    }

    :host ::ng-deep .searchable-select-panel .mat-mdc-option.mdc-list-item--selected .mdc-list-item__background,
    :host ::ng-deep .searchable-select-panel .mat-mdc-option:hover .mdc-list-item__background {
      background-color: #e0f2ff !important;
      opacity: 1 !important;
    }

    :host ::ng-deep .searchable-select-panel .mat-mdc-option.mdc-list-item--selected .mdc-list-item__primary-text,
    :host ::ng-deep .searchable-select-panel .mat-mdc-option:hover .mdc-list-item__primary-text {
      color: #0b5394 !important;
      font-weight: 600;
    }
  `]
})
export class SearchableSelectComponent implements OnChanges {
  @Input({ required: true }) label!: string;
  @Input() icon: string | null = null;
  @Input() placeholder: string | null = null;
  @Input() hint: string | null = null;
  @Input() options: readonly string[] = [];
  @Input() value: string | null = null;
  @Input() includeAllOption = false;
  @Input() allValue = 'all';
  @Input() allLabel = 'Alle';
  @Input() displayWith: ((value: string) => string) | null = null;
  @Input() clearable = true;
  @Input() disabled = false;

  @Output() valueChange = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();

  @ViewChild('inputElement') inputElement?: ElementRef<HTMLInputElement>;
  @ViewChild(MatAutocompleteTrigger) autocompleteTrigger?: MatAutocompleteTrigger;

  private readonly optionsSignal = signal<string[]>([]);
  readonly searchTerm = signal<string>('');
  readonly selectedDisplay = signal<string>('');

  readonly filteredOptions = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const options = this.optionsSignal();
    if (!term) {
      return options;
    }
    return options.filter(option => this.formatOption(option).toLowerCase().includes(term));
  });

  private readonly isEditing = signal(false);

  readonly inputValue = computed(() => {
    const term = this.searchTerm();
    if (term || this.isEditing()) {
      return term;
    }
    const display = this.selectedDisplay();
    if (display) {
      return display;
    }
    if (this.value === null || this.value === undefined || this.value === '') {
      return '';
    }
    if (this.includeAllOption && this.value === this.allValue) {
      return this.allLabel;
    }
    return this.formatOption(this.value);
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['options']) {
      this.optionsSignal.set([...(this.options ?? [])]);
    }

    if (changes['value']) {
      if (this.value === null || this.value === undefined || this.value === '') {
        this.selectedDisplay.set('');
      } else if (this.includeAllOption && this.value === this.allValue) {
        this.selectedDisplay.set(this.allLabel);
      } else {
        this.selectedDisplay.set(this.formatOption(this.value));
      }
    }

    if (changes['value'] && !changes['value'].firstChange) {
      // Clear search term when value is updated externally to avoid stale filter
      this.searchTerm.set('');
      this.isEditing.set(false);
      queueMicrotask(() => {
        this.autocompleteTrigger?.closePanel();
        this.inputElement?.nativeElement.blur();
      });
    }
  }

  handleInput(value: string) {
    if (!this.isEditing()) {
      this.isEditing.set(true);
    }
    this.searchTerm.set(value);
    this.selectedDisplay.set('');
    this.searchChange.emit(value);
    if (!this.autocompleteTrigger?.panelOpen) {
      this.autocompleteTrigger?.openPanel();
    }
  }

  handleFocus() {
    if (this.disabled) {
      return;
    }
    this.autocompleteTrigger?.openPanel();
    if (!this.searchTerm()) {
      queueMicrotask(() => this.inputElement?.nativeElement.select());
    }
  }

  clearSearch(event: MouseEvent) {
    event.stopPropagation();
    if (this.disabled) {
      return;
    }
    this.searchTerm.set('');
    this.selectedDisplay.set('');
    this.isEditing.set(true);
    this.searchChange.emit('');
    this.autocompleteTrigger?.openPanel();
    queueMicrotask(() => this.inputElement?.nativeElement.focus());
  }

  togglePanel(event: MouseEvent) {
    event.stopPropagation();
    if (this.disabled) {
      return;
    }
    if (this.autocompleteTrigger?.panelOpen) {
      this.autocompleteTrigger.closePanel();
    } else {
      this.autocompleteTrigger?.openPanel();
      queueMicrotask(() => this.inputElement?.nativeElement.focus());
    }
  }

  handleSelection(event: MatAutocompleteSelectedEvent) {
    const selected = event.option.value as string;
    if (selected === undefined || selected === null) {
      return;
    }
    const displayValue =
      selected === this.allValue && this.includeAllOption
        ? this.allLabel
        : this.formatOption(selected);
    this.selectedDisplay.set(displayValue);
    this.searchTerm.set('');
    this.isEditing.set(false);
    this.valueChange.emit(selected);
    this.autocompleteTrigger?.closePanel();
    queueMicrotask(() => this.inputElement?.nativeElement.blur());
  }

  handleBlur() {
    if (this.isEditing()) {
      this.isEditing.set(false);
    }
  }

  shouldShowAllOption(): boolean {
    if (!this.includeAllOption) {
      return false;
    }
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return true;
    }
    return this.allLabel.toLowerCase().includes(term);
  }

  formatOption(option: string): string {
    if (this.displayWith) {
      return this.displayWith(option);
    }
    return option;
  }
}

