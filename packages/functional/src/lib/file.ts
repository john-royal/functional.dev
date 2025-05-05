import sha256 from "./sha256";

export const computeFileHash = async (file: Blob) => sha256(await file.bytes());

export const haveFilesChanged = (inputs: Record<string, string>) => {
  const { promise, resolve } = Promise.withResolvers<boolean>();
  let done = false;
  Promise.all(
    Object.keys(inputs).map(async (fileName) => {
      const file = Bun.file(fileName);
      const hash = await computeFileHash(file).catch(() => undefined);
      if (hash !== inputs[fileName] && !done) {
        resolve(true);
        done = true;
      }
    }),
  ).then(() => {
    if (!done) {
      resolve(false);
    }
  });
  return promise;
};
