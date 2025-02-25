import { openai } from '@ai-sdk/openai';
import { createTool, OutputType } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { chromium, type Page } from 'playwright';
import Turndown from 'turndown';
import { z } from 'zod';

interface ScrapeOptions {
  page: Page;
  format: 'html' | 'markdown' | 'text' | 'cleanup' | 'image' | 'custom';
  fullPage: boolean;
  formatFunction?: (content: string) => string;
}

function cleanup() {
  const elementsToRemove = [
    'script',
    'style',
    'noscript',
    'iframe',
    'svg',
    'img',
    'audio',
    'video',
    'canvas',
    'map',
    'source',
    'dialog',
    'menu',
    'menuitem',
    'track',
    'object',
    'embed',
    'form',
    'input',
    'button',
    'select',
    'textarea',
    'label',
    'option',
    'optgroup',
    'aside',
    'footer',
    'header',
    'nav',
    'head',
  ];

  const attributesToRemove = ['style', 'src', 'alt', 'title', 'role', 'aria-', 'tabindex', 'on', 'data-'];

  const elementTree = document.querySelectorAll('*');

  elementTree.forEach(element => {
    if (elementsToRemove.includes(element.tagName.toLowerCase())) {
      element.remove();
    }

    Array.from(element.attributes).forEach(attr => {
      if (attributesToRemove.some(a => attr.name.startsWith(a))) {
        element.removeAttribute(attr.name);
      }
    });
  });
}

async function extractPage({ page, format, fullPage, formatFunction }: ScrapeOptions) {
  const url = page.url();
  let content;

  if (format === 'html') {
    content = await page.content();
  }

  if (format === 'markdown') {
    const body = await page.innerHTML('body');
    content = new Turndown().turndown(body);
  }

  if (format === 'text') {
    const readable = await page.evaluate(async () => {
      const readability = await import(
        // @ts-ignore
        'https://cdn.skypack.dev/@mozilla/readability'
      );

      return new readability.Readability(document).parse();
    });

    content = `Page Title: ${readable.title}\n${readable.textContent}`;
  }

  if (format === 'cleanup') {
    await page.evaluate(cleanup);
    content = await page.content();
  }

  if (format === 'image') {
    const image = await page.screenshot({ fullPage });
    content = image.toString('base64');
  }

  // if (format === 'custom') {
  //     if (
  //         !formatFunction ||
  //         typeof formatFunction !== 'function'
  //     ) {
  //         throw new Error('customPreprocessor must be provided in custom mode')
  //     }

  //     content = await formatFunction(page)
  // }

  return {
    url,
    content,
    format,
  };
}

function prepareMessages(opts: ScrapeOptions) {
  if (opts.format === 'image') {
    return [
      {
        type: 'image',
        image: opts.page.content,
      },
    ];
  }

  return [{ type: 'text', text: opts.page.content }];
}

const extractorAgent = new Agent({
  name: 'Data Extractor',
  instructions:
    'You are an expert data extractor. Process the provided text and return a structured object according to the provided schema.',
  model: openai('gpt-4o'),
});

async function extractData({ url, content, schema }: { url: string; content: string; schema: OutputType }) {
  const result = await extractorAgent.generate(content, {
    output: schema,
  });

  return {
    data: result.object,
    url: url,
  };
}

export const scrapeWebsiteTool = createTool({
  id: 'scrape-website',
  description: 'Scrapes a website and returns structured data',
  inputSchema: z.object({
    url: z.string().url(),
    format: z.enum(['html', 'markdown', 'text', 'cleanup', 'image', 'custom']),
    fullPage: z.boolean(),
  }),
  execute: async ({ context }) => {
    try {
      const browser = await chromium.launch();

      const page = await browser.newPage();

      await page.goto(context.url);

      const preprocessed = await extractPage({
        page,
        format: context.format,
        fullPage: context.fullPage,
      });

      const data = await extractData({
        ...preprocessed,
        schema: z.object({
          top: z
            .array(
              z.object({
                title: z.string(),
                points: z.number(),
                by: z.string(),
                commentsURL: z.string(),
              }),
            )
            .describe('Top 5 stories on Hacker News'),
        }),
      });

      await page.close();
      await browser.close();

      return data;
    } catch (e) {
      if (e instanceof Error) {
        return { message: `Error: ${e.message}` };
      }
      return { message: 'Error' };
    }
  },
});
