import type { Bindable } from "./binding";
import type { WorkersBindingInput } from "./cloudflare/worker/types";

export class Secret implements Bindable {
  constructor(public value: string) {}

  getBinding(): WorkersBindingInput {
    return {
      type: "secret_text",
      text: this.proxy(),
    };
  }

  toString() {
    return this.value;
  }

  toJSON() {
    return this.value;
  }

  private proxy<T>(): T {
    // biome-ignore lint/suspicious/noExplicitAny: this is a hack... figure out a better way
    return this as any;
  }

  static fromEnv(name: string) {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Environment variable ${name} not found`);
    }
    return new Secret(value);
  }
}
