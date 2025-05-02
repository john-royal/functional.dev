import { Queue } from "./async-queue";

import { expect, test } from "bun:test";

test("async queue with promises", async () => {
  const queue = new Queue<number>();

  queue.push(() => new Promise((resolve) => setTimeout(() => resolve(1), 100)));
  queue.push(() => Promise.resolve(2));
  queue.push(() => new Promise((resolve) => setTimeout(() => resolve(3), 100)));
  queue.close();

  expect(queue.collect()).resolves.toEqual([1, 2, 3]);
});
