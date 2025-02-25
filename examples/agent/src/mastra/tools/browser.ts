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

async function extractData({ url, content, schema }: { url: string; content: string; schema: any }) {
  const result = await extractorAgent.generate(content, {
    output: schema,
  });

  return {
    data: result.object,
    url: url,
  };
}

const browserState: any = {};

export const launchBrowser = createTool({
  id: 'launch-browser',
  description: 'Launches a browser',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const browser = await chromium.launch({ headless: false });
      browserState.browser = browser;
      return { message: 'Browser is open' };
    } catch (e) {
      if (e instanceof Error) {
        return { message: `Error: ${e.message}` };
      }
      return { message: 'Error' };
    }
  },
});

export const newPageTool = createTool({
  id: 'new-page',
  description: 'Opens a new page in the browser',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      if (!browserState.browser) {
        return { message: 'Error: Browser is not open' };
      }
      const page = await browserState.browser.newPage();
      browserState.page = page;
      return { message: 'New page is open' };
    } catch (e) {
      if (e instanceof Error) {
        return { message: `Error: ${e.message}` };
      }
      return { message: 'Error' };
    }
  },
});

export const navigateTool = createTool({
  id: 'navigate-website-tool',
  description: 'Navigates to a website',
  inputSchema: z.object({
    url: z.string().url(),
  }),
  execute: async ({ context }) => {
    try {
      await browserState.page.goto(context.url);
      return { message: `Navigated to page ${context.url}` };
    } catch (e) {
      if (e instanceof Error) {
        return { message: `Error: ${e.message}` };
      }
      return { message: 'Error' };
    }
  },
});

export const clickElementTool = createTool({
  id: 'click-element-tool',
  description: 'Clicks an element on the current page using a selector',
  inputSchema: z.object({
    selector: z.string().describe('CSS selector of the element to click'),
    selectorType: z.enum(['css', 'xpath', 'text']).default('css').describe('Type of selector to use'),
    waitForNavigation: z.boolean().default(true).describe('Whether to wait for navigation after clicking'),
    timeout: z.number().default(30000).describe('Timeout in milliseconds'),
  }),
  execute: async ({ context }) => {
    try {
      if (!browserState.page) {
        return { message: 'Error: No active page. Use new-page tool first.' };
      }

      const { selector, selectorType, waitForNavigation, timeout } = context;

      // Create a promise for navigation if needed
      const navigationPromise = waitForNavigation
        ? browserState.page.waitForNavigation({ timeout })
        : Promise.resolve();

      // Click the element based on selector type
      if (selectorType === 'css') {
        await browserState.page.waitForSelector(selector, { timeout });
        await browserState.page.click(selector);
      } else if (selectorType === 'xpath') {
        await browserState.page.waitForXPath(selector, { timeout });
        const elements = await browserState.page.$x(selector);
        if (elements.length > 0) {
          await elements[0].click();
        } else {
          return { message: `Error: No elements found with XPath: ${selector}` };
        }
      } else if (selectorType === 'text') {
        // Find element containing text
        await browserState.page.waitForFunction(
          text => {
            return Array.from(document.querySelectorAll('*')).find(el => el.textContent?.includes(text));
          },
          { timeout },
          selector,
        );

        await browserState.page.evaluate(text => {
          const element = Array.from(document.querySelectorAll('*')).find(el => el.textContent?.includes(text));
          if (element) {
            (element as HTMLElement).click();
          }
        }, selector);
      }

      // Wait for navigation if requested
      if (waitForNavigation) {
        await navigationPromise;
      }

      return {
        message: `Clicked element with ${selectorType} selector: ${selector}`,
        currentUrl: browserState.page.url(),
      };
    } catch (e) {
      if (e instanceof Error) {
        return { message: `Error: ${e.message}` };
      }
      return { message: 'An unknown error occurred' };
    }
  },
});

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
