import { describe, expect, it } from "bun:test";
import { normalizeOptions } from "../src/resources/cloudflare/hyperdrive";

describe("normalizeOptions", () => {
  it("normalizes postgres origin", () => {
    const normalized = normalizeOptions("test-global-id", {
      origin: "postgres://postgres:postgres@localhost:5432/postgres",
    });
    expect(normalized).toEqual({
      name: "test-global-id",
      origin: {
        database: "postgres",
        host: "localhost",
        password: "postgres",
        port: 5432,
        scheme: "postgres",
        user: "postgres",
      },
    });
  });

  it("handles sslmode", () => {
    const normalized = normalizeOptions("test-global-id", {
      origin:
        "postgres://postgres:postgres@localhost:5432/postgres?sslmode=require",
    });
    expect(normalized).toEqual({
      name: "test-global-id",
      origin: {
        database: "postgres",
        host: "localhost",
        password: "postgres",
        port: 5432,
        scheme: "postgres",
        user: "postgres",
      },
      mtls: {
        sslmode: "require",
      },
    });
  });

  it("handles missing port", () => {
    const normalized = normalizeOptions("test-global-id", {
      origin: "postgres://postgres:postgres@localhost/postgres?sslmode=require",
    });
    expect(normalized).toEqual({
      name: "test-global-id",
      origin: {
        database: "postgres",
        host: "localhost",
        password: "postgres",
        port: 5432,
        scheme: "postgres",
        user: "postgres",
      },
      mtls: {
        sslmode: "require",
      },
    });
  });

  it("handles neon url", () => {
    const normalized = normalizeOptions("test-global-id", {
      origin:
        "postgresql://neondb_owner:npg_XYZ123abcDEF@ep-sample-instance-b34x91m2-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
    });
    expect(normalized).toEqual({
      name: "test-global-id",
      origin: {
        database: "neondb",
        host: "ep-sample-instance-b34x91m2-pooler.us-east-2.aws.neon.tech",
        password: "npg_XYZ123abcDEF",
        port: 5432,
        scheme: "postgresql",
        user: "neondb_owner",
      },
      mtls: {
        sslmode: "require",
      },
    });
  });
});
