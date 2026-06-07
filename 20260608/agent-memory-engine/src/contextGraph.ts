/**
 * A lightweight context graph: the "smarter than a log" memory structure that
 * Neo4j, Foundation Capital and others highlighted as the 2026 way to give
 * agents associative recall.
 *
 * Entities mentioned together build up weighted, undirected edges. At recall
 * time we run one hop of *spreading activation* from the query's entities to
 * surface associatively-related memories that a pure vector search would miss
 * (e.g. recalling "deadline" when the agent only asked about a "project").
 */

export interface RelatedEntity {
  entity: string;
  weight: number;
}

export class ContextGraph {
  /** adjacency[a][b] = co-occurrence weight between entities a and b. */
  private readonly adjacency = new Map<string, Map<string, number>>();

  /** Record that a set of entities were observed together, strengthening edges. */
  observe(entities: string[]): void {
    const unique = [...new Set(entities.map((e) => e.toLowerCase().trim()))].filter(
      Boolean,
    );
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        this.bump(unique[i], unique[j]);
        this.bump(unique[j], unique[i]);
      }
      // Ensure even a lone entity is registered as a node.
      if (!this.adjacency.has(unique[i])) this.adjacency.set(unique[i], new Map());
    }
  }

  private bump(a: string, b: string): void {
    let row = this.adjacency.get(a);
    if (!row) {
      row = new Map();
      this.adjacency.set(a, row);
    }
    row.set(b, (row.get(b) ?? 0) + 1);
  }

  /** Direct neighbours of an entity, strongest first. */
  neighbors(entity: string, limit = 5): RelatedEntity[] {
    const row = this.adjacency.get(entity.toLowerCase().trim());
    if (!row) return [];
    return [...row.entries()]
      .map(([e, w]) => ({ entity: e, weight: w }))
      .sort((x, y) => y.weight - x.weight)
      .slice(0, limit);
  }

  /**
   * One hop of spreading activation: expand a set of seed entities with their
   * strongest neighbours, returning an activation score per reachable entity.
   */
  activate(seeds: string[], limit = 8): RelatedEntity[] {
    const activation = new Map<string, number>();
    for (const seed of seeds) {
      const key = seed.toLowerCase().trim();
      activation.set(key, (activation.get(key) ?? 0) + 1);
      for (const n of this.neighbors(key, limit)) {
        // Neighbours receive a fraction of the seed's activation.
        activation.set(n.entity, (activation.get(n.entity) ?? 0) + 0.5 * n.weight);
      }
    }
    return [...activation.entries()]
      .map(([entity, weight]) => ({ entity, weight }))
      .sort((x, y) => y.weight - x.weight)
      .slice(0, limit);
  }

  /** Number of distinct entities tracked. */
  get size(): number {
    return this.adjacency.size;
  }
}
