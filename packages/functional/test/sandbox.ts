import { Blob } from "node:buffer";

const blob = new Blob(["console.log('Hello, world!')"], {
  type: "application/javascript+module",
});
console.log(blob);
