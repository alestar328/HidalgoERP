import { useId, type ReactNode } from 'react';
import { Input, Label, Option, Select } from '@ui5/webcomponents-react';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'Text' | 'Email' | 'Number' | 'Tel';
  required?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  disabled?: boolean;
  maxlength?: number;
}

/** Etiqueta + campo, siempre con nombre accesible. */
export function TextField({
  label,
  value,
  onChange,
  type = 'Text',
  required,
  placeholder,
  hint,
  error,
  disabled,
  maxlength,
}: TextFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <Label for={id} required={required}>
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        type={type}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        maxlength={maxlength}
        accessibleName={label}
        valueState={error ? 'Negative' : 'None'}
        onInput={(e) => onChange(e.target.value)}
      />
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <Label for={id}>{label}</Label>
      <Select
        id={id}
        accessibleName={label}
        onChange={(e) => onChange(e.detail.selectedOption.value ?? '')}
      >
        {options.map((o) => (
          <Option key={o.value} value={o.value} selected={o.value === value}>
            {o.label}
          </Option>
        ))}
      </Select>
    </div>
  );
}

export function EmptyState({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {text && <p className="muted">{text}</p>}
      {children}
    </div>
  );
}
