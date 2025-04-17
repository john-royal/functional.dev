export const withExponentialBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 10,
  initialDelay = 500
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      console.log("retrying", initialDelay * 2 ** i);
      await new Promise((resolve) =>
        setTimeout(resolve, initialDelay * 2 ** i)
      );
    }
  }
};
