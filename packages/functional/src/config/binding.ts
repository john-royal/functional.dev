export type BindingValue = string | number | boolean | null;

export interface PlainTextBinding<
  TName extends string,
  TValue extends BindingValue
> {
  name: TName;
  type: "variable";
  value: TValue;
}

export interface SecretBinding<
  TName extends string,
  TValue extends BindingValue
> {
  name: TName;
  type: "secret";
  value?: TValue | typeof functionalSecretSymbol;
}

export type Binding<
  TName extends string = string,
  TValue extends BindingValue = BindingValue
> = PlainTextBinding<TName, TValue> | SecretBinding<TName, TValue>;

export const functionalSecretSymbol = Symbol("functional-secret");

export const secret = <TName extends string = string>(
  name?: TName
): SecretBinding<TName, string> => {
  return {
    [functionalSecretSymbol]: name,
  } as unknown as SecretBinding<TName, string>;
};
