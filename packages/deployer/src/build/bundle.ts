import { Workflow, Step } from '@mastra/core';
import * as esbuild from 'esbuild';
import { type BuildOptions } from 'esbuild';
import { join } from 'path';
import { z } from 'zod';

import { FileService } from './fs.js';
import { upsertMastraDir } from './utils.js';

const buildWorkflow = new Workflow({
  name: 'Build',
  triggerSchema: z.object({
    buildName: z.string(),
    directory: z.string(),
    entryFile: z.string().optional(),
    outfile: z.string().optional(),
    useBanner: z.boolean().optional(),
  }),
});

const ensureDir = new Step({
  id: 'Ensure Directory',
  execute: async () => {
    // Ensure .mastra directory exists
    upsertMastraDir();
  },
});

const bundleStep = new Step({
  id: 'Bundle',
  execute: async ({ context }) => {
    const buildName = context.machineContext?.triggerData.buildName;
    const useBanner = context.machineContext?.triggerData.useBanner;
    const directory = context.machineContext?.triggerData.directory;
    const entry = context.machineContext?.triggerData.entryFile;
    const outfile = context.machineContext?.triggerData.outfile;
    const entryPath = join(directory, `${entry || 'index'}.ts`);

    const fileService = new FileService();
    const entryPoint = fileService.getFirstExistingFile([entryPath]);
    const outfilePath = outfile || join(process.cwd(), '.mastra', 'mastra.mjs');

    const esbuildConfig: BuildOptions = {
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      target: 'node20',
      sourcemap: true,
      minify: true,
      metafile: true,
      logLevel: 'error',
      mainFields: ['module', 'main'],
      conditions: ['import', 'node'],
      logOverride: {
        'commonjs-variable-in-esm': 'silent',
      },
      external: [
        // Mark node built-ins as external
        'assert',
        'buffer',
        'child_process',
        'cluster',
        'constants',
        'crypto',
        'dgram',
        'dns',
        'events',
        'fs',
        'http',
        'http2',
        'https',
        'module',
        'net',
        'os',
        'path',
        'process',
        'punycode',
        'querystring',
        'readline',
        'repl',
        'stream',
        'string_decoder',
        'sys',
        'timers',
        'tls',
        'tty',
        'url',
        'util',
        'v8',
        'vm',
        'wasi',
        'worker_threads',
        'zlib',
        'chromium-bidi/lib/cjs/bidiMapper/BidiMapper',
        'chromium-bidi/lib/cjs/cdp/CdpConnection',

        // Your packages
        '@mastra/core',
        '@mastra/memory',
        '@mastra/engine',
        '@mastra/rag',
        '@mastra/evals',
        '@mastra/mcp',
        '@mastra/tts',
        '@mastra/firecrawl',
        '@mastra/github',
        '@mastra/stabilityai',
      ],
    };

    if (useBanner) {
      esbuildConfig.banner = {
        js: `
                import { createRequire } from "module";
                import { fileURLToPath, pathToFileURL } from 'url';
                import path from 'path';
      
                const __filename = fileURLToPath(import.meta.url);
                const __dirname = path.dirname(__filename);
                const require = createRequire(import.meta.url);
              `,
      };
    }

    const result = await esbuild.build(esbuildConfig);

    // Log build results
    console.log(`${buildName} Build completed successfully`);

    return result;
  },
});

const analyzeStep = new Step({
  id: 'Analyze',
  execute: async ({ context }) => {
    if (context.machineContext?.stepResults.Bundle.status !== 'success') {
      throw new Error('Bundle step failed');
    }
    return await esbuild.analyzeMetafile(context.machineContext?.stepResults.Bundle.payload.metafile);
  },
});

buildWorkflow.step(ensureDir).then(bundleStep).then(analyzeStep).commit();

export async function bundle(
  dirPath: string,
  {
    useBanner = true,
    buildName = 'Build',
    entryFile,
    outfile,
  }: { outfile?: string; entryFile?: string; buildName?: string; useBanner?: boolean } = {},
) {
  const { start } = buildWorkflow.createRun();

  try {
    const result = await start({
      triggerData: {
        buildName,
        directory: dirPath,
        useBanner,
        entryFile,
        outfile,
      },
    });

    console.log(JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error('Failed to build:', error);
    process.exit(1);
  }
}
