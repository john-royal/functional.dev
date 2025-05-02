export default {
  async fetch(request: Request, env: unknown) {
    return new Response("Hello from worker!");
    // const durableObjectId = env.DO_NAMESPACE.idFromName("test-do");
    // const durableObject = env.DO_NAMESPACE.get(durableObjectId);
    // return durableObject.fetch(request);
  },
};

export class MyDurableObject {
  fetch(request: Request) {
    return new Response("Hello from durable object");
  }
}
