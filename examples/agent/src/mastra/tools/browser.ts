import { openai } from '@ai-sdk/openai';
import { createTool, OutputType } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices, type Page } from 'playwright';
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
      console.log('launching browser');
      const browser = await chromium.launch({
        headless: false,
        slowMo: 1000,
      });
      const context = await browser.newContext(devices['Desktop Chrome']);

      browserState.browser = browser;
      browserState.context = context;
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
      const __dirname = dirname(fileURLToPath(import.meta.url));

      console.log('open page');
      const page = await browserState.context.newPage();
      console.log('adding init script', join(__dirname, 'dom.utils.js'));
      await page.addInitScript({
        content: readFileSync(join(__dirname, 'dom.utils.js'), 'utf-8'),
      });
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
      console.log('navigating to', context.url);
      await browserState.page.goto(context.url, {
        waitUntil: 'domcontentloaded',
      });
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

      console.log({ context });
      // Click the element based on selector type
      if (selectorType === 'css') {
        console.log('clicking css', selector);
        await browserState.page.waitForSelector(selector, { timeout });
        console.log('waiting for click');
        await browserState.page.click(selector);
      } else if (selectorType === 'xpath') {
        console.log('waiting for xpath', selector);
        await browserState.page.waitForSelector(selector, { timeout });
        console.log('waiting for click');
        const elements = await browserState.page.locator(selector).locator('visible=true');
        await elements.click();
        console.log('clicked');
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

export const findElementTool = createTool({
  id: 'find-elements',
  description: 'Gets all xpath selectors for the current page',
  inputSchema: z.object({
    // description: z.string().describe('Description of the element to find (e.g. "login button", "main heading")'),
    // timeout: z.number().optional().default(5000).describe('How long to wait for the element in milliseconds'),
  }),
  execute: async ({ context }) => {
    try {
      if (!browserState?.page) {
        return { message: 'No page is currently open' };
      }

      console.log('finding elements');
      const { outputString, selectorMap } = await browserState.page.evaluate(() => {
        return window.collect(document.body);
      });

      console.log({ outputString, selectorMap });

      return {
        outputString,
        selectorMap,
      };

      return {
        message: `Could not find any element matching "${context.description}"`,
        found: false,
        currentUrl: browserState.page.url(),
      };
    } catch (e) {
      if (e instanceof Error) {
        return { message: `Error: ${e.message}`, found: false };
      }
      return { message: 'An unknown error occurred', found: false };
    }
  },
});

export const extractPageTool = createTool({
  id: 'extract-page-tool',
  description: 'Extracts content from the current page',
  inputSchema: z.object({
    // format: z.enum(['text', 'html']).optional().default('text'),
    // fullPage: z.boolean().optional().default(false),
  }),
  execute: async context => {
    try {
      console.log('extracting page');
      if (!browserState?.page) {
        return { message: 'No page is currently open' };
      }

      console.log('extracting page 2');
      const preprocessed = await extractPage({
        page: browserState.page,
        format: 'html',
        fullPage: true,
      });

      console.log({ preprocessed });

      return {
        message: 'Page content extracted successfully',
        content: preprocessed,
      };
    } catch (e) {
      if (e instanceof Error) {
        return { message: `Error extracting page content: ${e.message}` };
      }
      return { message: 'An unknown error occurred while extracting page content' };
    }
  },
});

export const closePageTool = createTool({
  id: 'close-page',
  description: 'Closes the currently open browser page',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      if (!browserState?.page) {
        return { message: 'No page is currently open' };
      }

      await browserState.page.close();
      return { message: 'Page closed successfully' };
    } catch (e) {
      if (e instanceof Error) {
        return { message: `Error closing page: ${e.message}` };
      }
      return { message: 'An unknown error occurred while closing the page' };
    }
  },
});

export const closeBrowserTool = createTool({
  id: 'close-browser',
  description: 'Closes the browser instance completely',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      if (!browserState?.browser) {
        return { message: 'No browser is currently open' };
      }

      await browserState.browser.close();
      browserState.browser = null;
      browserState.page = null;
      return { message: 'Browser closed successfully' };
    } catch (e) {
      if (e instanceof Error) {
        return { message: `Error closing browser: ${e.message}` };
      }
      return { message: 'An unknown error occurred while closing the browser' };
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
