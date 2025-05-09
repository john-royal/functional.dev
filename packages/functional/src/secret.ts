import type { Bindable } from "./binding";
import type { WorkersBindingInput } from "./cloudflare/worker/types";
import { SecretString } from "./lib/secret";

export class Secret implements Bindable {
  text: SecretString;

  constructor(text: string) {
    this.text = new SecretString(text);
  }

  getBinding(): WorkersBindingInput {
    return {
      type: "secret_text",
      // This is a hack to accomplish two things:
      // - We want Cloudflare to receive the actual value
      // - We want to encrypt the value in our local state
      // This works because SecretString is a subclass of String.
      text: this.text as unknown as string,
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
