export interface PackageInfo {
  name: string;
  displayName: string;
  path: string;
}

// Deployers
export const DEPLOYERS: PackageInfo[] = [
  { name: '@mastra/deployer-cloudflare', displayName: 'Cloudflare Deployer', path: 'deployers/cloudflare' },
  { name: '@mastra/deployer-netlify', displayName: 'Netlify Deployer', path: 'deployers/netlify' },
  { name: '@mastra/deployer-vercel', displayName: 'Vercel Deployer', path: 'deployers/vercel' },
];

// Integrations
export const INTEGRATIONS: PackageInfo[] = [
  { name: '@mastra/composio', displayName: 'Compos.io Integration', path: 'integrations/composio' },
  { name: '@mastra/firecrawl', displayName: 'Firecrawl Integration', path: 'integrations/firecrawl' },
  { name: '@mastra/github', displayName: 'GitHub Integration', path: 'integrations/github' },
  { name: '@mastra/ragie', displayName: 'Ragie Integration', path: 'integrations/ragie' },
  { name: '@mastra/stabilityai', displayName: 'Stability AI Integration', path: 'integrations/stabilityai' },
];

// Client SDKs
export const CLIENT_SDKS: PackageInfo[] = [{ name: 'js', displayName: 'Client JS', path: 'client-sdks/client-js' }];

// Packages
export const CORE_PACKAGES: PackageInfo[] = [
  { name: 'cli', displayName: 'CLI', path: 'packages/cli' },
  { name: '@mastra/core', displayName: 'Core', path: 'packages/core' },
  { name: 'create-mastra', displayName: 'Create Mastra', path: 'packages/create-mastra' },
  { name: '@mastra/deployer', displayName: 'Deployer', path: 'packages/deployer' },
  { name: '@mastra/evals', displayName: 'Evals', path: 'packages/evals' },
  { name: '@mastra/loggers', displayName: 'Loggers', path: 'packages/loggers' },
  { name: '@mastra/mcp', displayName: 'MCP', path: 'packages/mcp' },
  { name: '@mastra/memory', displayName: 'Memory', path: 'packages/memory' },
  { name: '@mastra/playground-ui', displayName: 'Playground UI', path: 'packages/playground-ui' },
  { name: '@mastra/rag', displayName: 'RAG', path: 'packages/rag' },
];

// Speech
export const SPEECH_PACKAGES: PackageInfo[] = [
  { name: '@mastra/speech-azure', displayName: 'Azure Speech', path: 'speech/azure' },
  { name: '@mastra/speech-deepgram', displayName: 'Deepgram Speech', path: 'speech/deepgram' },
  { name: '@mastra/speech-elevenlabs', displayName: 'ElevenLabs Speech', path: 'speech/elevenlabs' },
  { name: '@mastra/speech-google', displayName: 'Google Speech', path: 'speech/google' },
  { name: '@mastra/speech-ibm', displayName: 'IBM Speech', path: 'speech/ibm' },
  { name: '@mastra/speech-murf', displayName: 'Murf Speech', path: 'speech/murf' },
  { name: '@mastra/speech-openai', displayName: 'OpenAI Speech', path: 'speech/openai' },
  { name: '@mastra/speech-playai', displayName: 'Play.ai Speech', path: 'speech/playai' },
  { name: '@mastra/speech-replicate', displayName: 'Replicate Speech', path: 'speech/replicate' },
  { name: '@mastra/speech-speechify', displayName: 'Speechify Speech', path: 'speech/speechify' },
];

// Stores
export const STORE_PACKAGES: PackageInfo[] = [
  { name: '@mastra/astra', displayName: 'Astra Store', path: 'stores/astra' },
  { name: '@mastra/chroma', displayName: 'Chroma Store', path: 'stores/chroma' },
  { name: '@mastra/pg', displayName: 'PostgreSQL Store', path: 'stores/pg' },
  { name: '@mastra/pinecone', displayName: 'Pinecone Store', path: 'stores/pinecone' },
  { name: '@mastra/qdrant', displayName: 'Qdrant Store', path: 'stores/qdrant' },
  { name: '@mastra/upstash', displayName: 'Upstash Store', path: 'stores/upstash' },
  { name: '@mastra/vectorize', displayName: 'Vectorize Store', path: 'stores/vectorize' },
];

// Voice
export const VOICE_PACKAGES: PackageInfo[] = [
  { name: '@mastra/voice-deepgram', displayName: 'Deepgram Voice', path: 'voice/deepgram' },
  { name: '@mastra/voice-elevenlabs', displayName: 'ElevenLabs Voice', path: 'voice/elevenlabs' },
  { name: '@mastra/voice-google', displayName: 'Google Voice', path: 'voice/google' },
  { name: '@mastra/voice-murf', displayName: 'Murf Voice', path: 'voice/murf' },
  { name: '@mastra/voice-openai', displayName: 'OpenAI Voice', path: 'voice/openai' },
  { name: '@mastra/voice-playai', displayName: 'Play.ai Voice', path: 'voice/playai' },
  { name: '@mastra/voice-speechify', displayName: 'Speechify Voice', path: 'voice/speechify' },
];

export const ALL_PACKAGES = [
  ...DEPLOYERS,
  ...INTEGRATIONS,
  ...CLIENT_SDKS,
  ...CORE_PACKAGES,
  ...SPEECH_PACKAGES,
  ...STORE_PACKAGES,
  ...VOICE_PACKAGES,
];
