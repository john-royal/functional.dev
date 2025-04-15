export default {
  async fetch(request: Request) {
    return new Response("Hello from Functional!");
  },
} satisfies ExportedHandler<Env>;
