import type { Bindable } from "./binding";
import type { WorkersBindingInput } from "./cloudflare/worker/types";

export class Secret implements Bindable {
  constructor(public value: string) {}

  getBinding(): WorkersBindingInput {
    return {
      type: "secret_text",
      text: this.value,
    };
  }

  static fromEnv(name: string) {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Environment variable ${name} not found`);
    }
    return new Secret(value);
  }
}
