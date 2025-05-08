export default {
  fetch: async (req, env) => {
    if (req.url.endsWith("/counter")) {
      const id = env.DURABLE_OBJECT.idFromName("counter");
      const durableObject = env.DURABLE_OBJECT.get(id);
      console.log("Counter", durableObject);
      return durableObject.fetch(req);
    }
    return await env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;

export class Counter implements DurableObject {
  count = 0;

  constructor(readonly state: DurableObjectState) {
    state.blockConcurrencyWhile(async () => {
      this.count = (await state.storage.get("count")) ?? 0;
      console.log("Counter initialized", this.count);
    });
  }

  async fetch(req: Request) {
    switch (req.method) {
      case "GET":
        return new Response(this.count.toString());
      case "POST":
        this.count++;
        this.state.waitUntil(this.state.storage.put("count", this.count));
        return new Response(this.count.toString());
      default:
        return new Response("Method not allowed", { status: 405 });
    }
  }
}
