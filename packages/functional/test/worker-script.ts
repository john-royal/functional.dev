import { myStupidFunction } from "./test";

export default {
  async fetch(request: Request, env: Env) {
    const now = Date.now();
    let value = await env.TEST_KV.get("test");
    if (!value) {
      await env.TEST_KV.put("test", now.toString());
      value = await env.TEST_KV.get("test");
    }
    return Response.json({
      env,
      myStupidFunction: myStupidFunction(),
      value,
    });
  },
};
