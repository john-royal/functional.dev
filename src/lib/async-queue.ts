export class Queue<T> {
  stream = new TransformStream<T, T>();
  writer = this.stream.writable.getWriter();
  size = 0;

  push(task: T) {
    this.writer.write(task);
    this.size++;
  }

  close() {
    this.writer.close();
  }

  async collect() {
    return Array.fromAsync(this.stream.readable);
  }

  async *iterate() {
    for await (const value of this.stream.readable) {
      yield value;
    }
  }
}
