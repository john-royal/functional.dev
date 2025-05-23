export class CyclicDependencyError extends Error {
  constructor(readonly dependencies: string[]) {
    super(`Cyclic dependency detected: ${dependencies.join(", ")}`);
  }
}

export function groupByDependencies(
  items: Map<string, { dependencies?: string[] }>,
): string[][] {
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const [id, { dependencies }] of items) {
    inDegree.set(id, dependencies?.length ?? 0);
    for (const dep of dependencies ?? []) {
      if (graph.has(dep)) {
        graph.get(dep)?.push(id);
      } else {
        graph.set(dep, [id]);
      }
    }
  }

  const layers: string[][] = [];

  let zeroes = filterInDegree(inDegree, 0);

  while (zeroes.length > 0) {
    layers.push(zeroes);
    const nextZeroes = [];
    for (const item of zeroes) {
      for (const dep of graph.get(item) ?? []) {
        inDegree.set(dep, (inDegree.get(dep) ?? 1) - 1);
        if (inDegree.get(dep) === 0) {
          nextZeroes.push(dep);
        }
      }
    }
    zeroes = nextZeroes;
  }

  const check = filterInDegree(inDegree, (degree) => degree !== 0);
  if (check.length > 0) {
    console.log(layers);
    console.error(check);
    throw new CyclicDependencyError(check);
  }

  return layers;
}

function filterInDegree(
  inDegree: Map<string, number>,
  predicate: number | ((value: number) => boolean),
) {
  const result: string[] = [];
  for (const [key, value] of inDegree.entries()) {
    if (
      (typeof predicate === "function" && predicate(value)) ||
      (typeof predicate === "number" && value === predicate)
    ) {
      result.push(key);
    }
  }
  return result;
}
