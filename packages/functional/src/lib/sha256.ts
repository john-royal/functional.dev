import crypto from "node:crypto";

const sha256 = (data: crypto.BinaryLike) => {
  return crypto.createHash("sha256").update(data).digest("hex");
};

export default sha256;
