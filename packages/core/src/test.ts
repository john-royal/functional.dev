import { validate } from "./validate";
import { ComponentBuilder } from "./component";
import { okAsync } from "neverthrow";
import { z } from "zod";

const test = new ComponentBuilder()
  .standardValidate(z.object({ name: z.string() }))
  .create((ctx, input) => {
    return okAsync(input);
  });
