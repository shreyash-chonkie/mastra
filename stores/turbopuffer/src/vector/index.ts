import type { Filter } from '@mastra/core/filter';
import type { IndexStats, QueryResult } from '@mastra/core/vector';
import { MastraVector } from '@mastra/core/vector';
import { Turbopuffer, type DistanceMetric, type QueryResults, type Vector } from '@turbopuffer/turbopuffer';
import { TurbopufferFilterTranslator } from './filter';

export interface TurbopufferVectorOptions {
  /** The API key to authenticate with. */
  apiKey: string;
  /** The base URL. Default is https://api.turbopuffer.com. */
  baseUrl?: string;
  /** The timeout to establish a connection, in ms. Default is 10_000. Only applicable in Node and Deno.*/
  connectTimeout?: number;
  /** The socket idle timeout, in ms. Default is 60_000. Only applicable in Node and Deno.*/
  connectionIdleTimeout?: number;
  /** The number of connections to open initially when creating a new client. Default is 0. */
  warmConnections?: number;
  /** Whether to compress requests and accept compressed responses. Default is true. */
  compression?: boolean;
}

export class TurbopufferVector extends MastraVector {
  private client: Turbopuffer;
  private filterTranslator: TurbopufferFilterTranslator;
  // MastraVector takes in distance metric in createIndex, but we need it in upsert(),
  // so remember it in this cache
  private distanceMetricCache: Map<string, DistanceMetric> = new Map();

  constructor(opts: TurbopufferVectorOptions) {
    super();
    this.filterTranslator = new TurbopufferFilterTranslator();

    const baseClient = new Turbopuffer(opts);
    const telemetry = this.__getTelemetry();
    this.client =
      telemetry?.traceClass(baseClient, {
        spanNamePrefix: 'turbopuffer-vector',
        attributes: {
          'vector.type': 'turbopuffer',
        },
      }) ?? baseClient;
  }

  async createIndex(
    indexName: string,
    dimension: number,
    metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine',
  ): Promise<void> {
    // Validate input parameters
    if (dimension <= 0) {
      throw new Error('Dimension must be a positive integer');
    }
    let distanceMetric: DistanceMetric = 'cosine_distance';
    switch (metric) {
      case 'cosine':
        distanceMetric = 'cosine_distance';
        break;
      case 'euclidean':
        distanceMetric = 'euclidean_squared';
        break;
      case 'dotproduct':
        throw new Error('dotproduct is not supported in Turbopuffer');
    }
    this.distanceMetricCache.set(indexName, distanceMetric);
    try {
      const namespaceExists = (await this.client.namespaces({ prefix: indexName })).namespaces.find(
        n => n.id === indexName,
      );
      if (namespaceExists) {
        return;
      }
      // Create initial vector with id and proper format
      await this.client.namespace(indexName).upsert({
        vectors: [
          {
            id: `${indexName}-init-${Date.now()}`, // Add timestamp to make it unique
            vector: Array(dimension).fill(0.0),
            attributes: { _init: true },
          },
        ],
        distance_metric: distanceMetric,
      });
    } catch (error: any) {
      throw new Error(`Failed to create Turbopuffer namespace ${indexName}: ${error.message}`);
    }
  }

  private getDistanceMetric(indexName: string): DistanceMetric {
    if (this.distanceMetricCache.has(indexName)) {
      return this.distanceMetricCache.get(indexName)!;
    }
    console.warn(
      `Could not determine distance metric for ${indexName}, defaulting to cosine_distance. Call createIndex() to register a distance metric for this index.`,
    );
    return 'cosine_distance';
  }

  async upsert(
    indexName: string,
    vectors: number[][],
    metadata?: Record<string, any>[],
    ids?: string[],
  ): Promise<string[]> {
    try {
      const index = this.client.namespace(indexName);
      const distanceMetric = await this.getDistanceMetric(indexName);
      const vectorIds = ids || vectors.map(() => crypto.randomUUID());
      const records: Vector[] = vectors.map((vector, i) => ({
        id: vectorIds[i]!,
        vector: vector,
        attributes: metadata?.[i] || {},
      }));

      // limit is 256 MB per upsert request, so set a reasonable batch size here that will stay under that for most cases
      // https://turbopuffer.com/docs/limits
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await index.upsert({
          vectors: batch,
          distance_metric: distanceMetric,
          // todo: some way to set the schema? Maybe there should be a way to register a function that takes index name and returns a Turbopuffer schema such that this can get customized
          // schema:
        });
      }

      return vectorIds;
    } catch (error) {
      throw new Error(`Failed to upsert vectors into Turbopuffer namespace ${indexName}: ${error}`);
    }
  }

  async query(
    indexName: string,
    queryVector: number[],
    topK: number = 10,
    filter?: Filter,
    includeVector: boolean = false,
  ): Promise<QueryResult[]> {
    try {
      const index = this.client.namespace(indexName);
      const translatedFilter = this.filterTranslator.translate(filter);
      const results: QueryResults = await index.query({
        distance_metric: await this.getDistanceMetric(indexName),
        vector: queryVector,
        top_k: topK,
        filters: translatedFilter,
        include_vectors: includeVector,
        include_attributes: true,
        consistency: { level: 'strong' }, // todo: make this configurable somehow?
      });
      return results.map(item => ({
        id: String(item.id),
        score: typeof item.dist === 'number' ? item.dist : 0,
        metadata: item.attributes || {},
        ...(includeVector && item.vector ? { vector: item.vector } : {}),
      }));
    } catch (error) {
      throw new Error(`Failed to query Turbopuffer namespace ${indexName}: ${error}`);
    }
  }

  async listIndexes(): Promise<string[]> {
    try {
      const namespacesResult = await this.client.namespaces({});
      return namespacesResult.namespaces.map(namespace => namespace.id);
    } catch (error) {
      throw new Error(`Failed to list Turbopuffer namespaces: ${error}`);
    }
  }

  async describeIndex(indexName: string): Promise<IndexStats> {
    try {
      const namespace = this.client.namespace(indexName);
      const metadata = await namespace.metadata();
      const distanceMetric = await this.getDistanceMetric(indexName);
      let metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine';
      if (distanceMetric === 'euclidean_squared') {
        metric = 'euclidean';
      } else {
        metric = 'cosine';
      }
      const dimension = metadata.dimensions;
      const count = metadata.approx_count;

      return {
        dimension,
        count,
        metric,
      };
    } catch (error) {
      throw new Error(`Failed to describe Turbopuffer namespace ${indexName}: ${error}`);
    }
  }

  async deleteIndex(indexName: string): Promise<void> {
    try {
      const namespace = this.client.namespace(indexName);
      await namespace.deleteAll();
      this.distanceMetricCache.delete(indexName);
    } catch (error: any) {
      throw new Error(`Failed to delete Turbopuffer namespace ${indexName}: ${error.message}`);
    }
  }
}
