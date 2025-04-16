// test/worker-script.ts
var worker_script_default = {
  async fetch(request) {
    return new Response("Hello, world!");
  }
};
export {
  worker_script_default as default
};
