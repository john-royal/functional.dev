import { myStupidFunction } from "./test";

export default {
  async fetch(request: Request) {
    return new Response(myStupidFunction());
  },
};
