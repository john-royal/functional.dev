import sha256 from "./sha256";

export const computeFileHash = async (file: Blob) => sha256(await file.bytes());

export const verifyFileHashes = (inputs: Record<string, string>) => {
  const { promise, resolve } = Promise.withResolvers<{ changed: boolean }>();
  let done = false;
  Promise.all(
    Object.keys(inputs).map(async (fileName) => {
      const file = Bun.file(fileName);
      const hash = await computeFileHash(file).catch(() => undefined);
      if (hash !== inputs[fileName] && !done) {
        resolve({ changed: true });
        done = true;
      }
    }),
  ).then(() => {
    if (!done) {
      resolve({ changed: false });
    }
  });
  return promise;
};
