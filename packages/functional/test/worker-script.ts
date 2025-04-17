import { myStupidFunction } from "./test";

export default {
  async fetch(request: Request, env: Env) {
    return Response.json({
      env,
      myStupidFunction: myStupidFunction(),
    });
  },
};
