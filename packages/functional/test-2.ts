// import { homedir } from "node:os";
import { join } from "node:path";
// import { provider } from "./src/components/assets";
import {
  provider,
  type BuildProps,
  type BuildState,
} from "./src/components/build";
import { $store, createApp } from "./src/app";
// const big = join(homedir(), "Developer/Archive/headstarter-app");
// const small = join(process.cwd(), "src");

// const test = {
//   "packages/web/src/app/dsa/[slug]/interview/feedback/[attemptId]/_components/user-solution-code.tsx":
//     {
//       size: 1213,
//       hash: "f26e0f36a648940072fc2a0ed4b4ac0a3b39a9beeb5144a0688cacd722b08bf3",
//     },
// };

// console.time("create");
// provider.create({ path: small }).map((res) => {
//   console.log(res.state);
//   console.timeEnd("create");
// });

createApp(
  {
    name: "test",
    stage: "dev",
  },
  () => {
    console.time("run");
    const id = "test:dev:build";
    const props: BuildProps = {
      path: join(process.cwd(), "src/components/r2-bucket.ts"),
      format: "esm",
      outdir: join(process.cwd(), "dist"),
      target: "bun",
      minify: true,
      sourcemap: "external",
    };

    const state = $store.get<{
      id: string;
      props: BuildProps;
      state: BuildState;
    }>(id);

    if (!state) {
      console.log("create");
      console.time("create");
      return provider
        .create(props)
        .map((res) => {
          console.timeEnd("create");
          $store.set(id, {
            id,
            props,
            state: res.state,
          });
        })
        .mapErr((e) => {
          console.log("error");
        });
    }

    console.time("diff");
    return provider.diff(props, state).map((res) => {
      console.timeEnd("diff");
      console.log(res.action);
      switch (res.action) {
        case "noop":
          break;
        case "replace":
          console.time("delete");
          return provider.delete(state).map(() => {
            console.timeEnd("delete");
            console.time("build");
            return provider.create(props).map((res) => {
              console.timeEnd("build");
              $store.set(id, {
                id,
                props,
                state: res.state,
              });
            });
          });
        case "update":
          console.time("update");
          return provider.update(state.state, props).map((res) => {
            console.timeEnd("update");
            $store.set(id, {
              id,
              props,
              state: res.state,
            });
          });
      }
    });
  }
);
