export type BindingValue = string | number | boolean | null;

export interface PlainTextBinding {
  name: string;
  type: "variable";
  value: BindingValue;
}

export type Binding = PlainTextBinding;
