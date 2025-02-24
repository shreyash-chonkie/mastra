import { readFileSync } from 'fs';
import { join } from 'path';

const basePath = process.cwd();
const packagesWithLintButNoFix = [];

// List of package.json paths from the find command
const packagePaths = [
  'client-sdks/client-js/package.json',
  'deployers/cloudflare/package.json',
  'deployers/netlify/package.json',
  'deployers/vercel/package.json',
  'docs/package.json',
  'examples/agent/package.json',
  'examples/ai-sdk-useChat/package.json',
  'examples/assistant-ui/package.json',
  'examples/basics/agents/agentic-workflows/package.json',
  'examples/basics/agents/bird-checker/package.json',
  'examples/basics/agents/hierarchical-multi-agent/package.json',
  'examples/basics/agents/multi-agent-workflow/package.json',
  'examples/basics/agents/system-prompt/package.json',
  'examples/basics/agents/using-a-tool/package.json',
  'examples/basics/evals/answer-relevancy/package.json',
  'examples/basics/evals/bias/package.json',
  'examples/basics/evals/completeness/package.json',
  'examples/basics/evals/content-similarity/package.json',
  'examples/basics/evals/context-position/package.json',
  'examples/basics/evals/context-precision/package.json',
  'examples/basics/evals/context-relevancy/package.json',
  'examples/basics/evals/contextual-recall/package.json',
  'examples/basics/evals/custom-eval/package.json',
  'examples/basics/evals/faithfulness/package.json',
  'examples/basics/evals/hallucination/package.json',
  'examples/basics/evals/keyword-coverage/package.json',
  'examples/basics/evals/prompt-alignment/package.json',
  'examples/basics/evals/summarization/package.json',
  'examples/basics/evals/textual-difference/package.json',
  'examples/basics/evals/tone-consistency/package.json',
  'examples/basics/evals/toxicity/package.json',
  'examples/basics/rag/adjust-chunk-delimiters/package.json',
  'examples/basics/rag/adjust-chunk-size/package.json',
  'examples/basics/rag/basic-rag/package.json',
  'examples/basics/rag/chunk-html/package.json',
  'examples/basics/rag/chunk-json/package.json',
  'examples/basics/rag/chunk-markdown/package.json',
  'examples/basics/rag/chunk-text/package.json',
  'examples/basics/rag/cleanup-rag/package.json',
  'examples/basics/rag/cot-rag/package.json',
  'examples/basics/rag/cot-workflow-rag/package.json',
  'examples/basics/rag/embed-chunk-array/package.json',
  'examples/basics/rag/embed-text-chunk/package.json',
  'examples/basics/rag/embed-text-with-cohere/package.json',
  'examples/basics/rag/filter-rag/package.json',
  'examples/basics/rag/graph-rag/package.json',
  'examples/basics/rag/hybrid-vector-search/package.json',
  'examples/basics/rag/insert-embedding-in-libsql/package.json',
  'examples/basics/rag/insert-embedding-in-pgvector/package.json',
  'examples/basics/rag/insert-embedding-in-pinecone/package.json',
  'integrations/composio/package.json',
  'integrations/firecrawl/package.json',
  'integrations/github/package.json',
  'integrations/stabilityai/package.json',
  'package.json',
  'packages/_config/package.json',
  'packages/cli/package.json',
  'packages/core/package.json',
  'packages/create-mastra/package.json',
  'packages/deployer/package.json',
  'packages/evals/package.json',
  'packages/loggers/package.json',
  'packages/mcp/package.json',
  'packages/memory/package.json',
  'packages/rag/package.json',
  'speech/playai/package.json',
  'speech/replicate/package.json',
  'speech/speechify/package.json',
  'stores/astra/package.json',
  'stores/chroma/package.json',
  'stores/pg/package.json',
  'stores/pinecone/package.json',
  'stores/qdrant/package.json',
  'stores/upstash/package.json',
  'voice/deepgram/package.json',
  'voice/elevenlabs/package.json',
  'voice/google/package.json',
  'voice/murf/package.json',
  'voice/openai/package.json',
  'voice/speechify/package.json'
];

for (const packagePath of packagePaths) {
  try {
    const fullPath = join(basePath, packagePath);
    const packageJson = JSON.parse(readFileSync(fullPath, 'utf8'));
    
    if (packageJson.scripts && packageJson.scripts.lint && !packageJson.scripts['lint:fix']) {
      packagesWithLintButNoFix.push(packagePath);
    }
  } catch (error) {
    console.error(`Error reading ${packagePath}:`, error.message);
  }
}

console.log('Packages with "lint" but no "lint:fix":', packagesWithLintButNoFix);
