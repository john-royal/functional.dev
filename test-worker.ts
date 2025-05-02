export default {
  async fetch(request: Request, env: unknown) {
    return new Response("Hello World");
  },
};
