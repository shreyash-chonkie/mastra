import { config } from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

import { mastra } from './mastra/index.js';
import { AnalysisSchema } from './mastra/agents/analysis-agent.js';
import { CategorySchema } from './mastra/agents/category-agent.js';

// Load environment variables
config();

const categoryAgent = mastra.getAgent('categoryAgent');
const analysisAgent = mastra.getAgent('analysisAgent');

async function getCategories() {
  const result = await categoryAgent.stream('Define categories based on Mastra documentation', {
    experimental_output: CategorySchema,
  });
  let response: Record<string, any> = {};
  for await (const chunk of result.partialObjectStream) {
    response = { ...response, ...chunk };
  }
  return response;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const channels = {
  Mastra: process.env.MASTRA_CHANNEL!,
  Help: process.env.HELP_CHANNEL!,
};

function formatAnalysis(analysis: any): string {
  let output = '';

  output += '\nCategories:\n';
  for (const category of analysis.categories) {
    output += `\n📁 ${category.category}\n`;
    output += `   Messages: ${category.count}\n`;
    output += `   Sentiment: ${category.sentiment}\n`;
    output += '   Top Issues:\n';
    for (const issue of category.top_issues) {
      output += `   - ${issue.issue} (${issue.frequency} occurrences)\n`;
      output += `     Example: ${issue.example_message}\n`;
    }

    // Format representative message for this category
    if (category.representative_message) {
      const message = category.representative_message;
      output += '\n   💬 Representative Message:\n';
      output += `   From: ${message.author} at ${new Date(message.timestamp).toLocaleString()}\n`;
      output += `   ${message.content.replace(/\n/g, '\n   ')}\n`;
      output += '\n   Why this represents the sentiment:\n';
      output += `   ${message.sentiment_reason}\n`;
      output += '\n   Why this message is relevant to the category:\n';
      output += `   ${message.relevance_reason || 'No relevance explanation provided.'}\n`;
    } else {
      output += '\n   No representative message available for this category.\n';
    }
  }

  output += '\n📝 Summary:\n';
  output += `${analysis.summary}\n`;

  output += '\n📅 Analysis Period:\n';
  output += `From: ${analysis.date_range.start}\n`;
  output += `To: ${analysis.date_range.end}\n`;
  output += `Total Messages: ${analysis.total_messages}\n`;

  return output;
}

async function runAnalysis(channelName: string, channelId: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join('analysis_output', `${channelName}_analysis_${timestamp}.txt`);
  let output = '🤖 Discord Analysis Bot\n------------------------\n';

  output += `\n${channelName} Analysis\n`;
  output += '------------------------\n';

  if (!channelId) {
    throw new Error('Missing required channel ID');
  }

  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error('Error: DISCORD_BOT_TOKEN is not set in environment variables');
    console.log('Please set DISCORD_BOT_TOKEN in your .env file');
    return;
  }

  console.log('Analyzing Discord channel...');

  try {
    // Calculate date range for the last 7 days
    const days = 7;
    const endDate = new Date().toISOString().split('T')[0]; // Today
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    const dailyAnalyses: { date: string; analysis: any }[] = [];

    console.log(`Using date range: ${startDateStr} to ${endDate}`);
    console.log(`Analyzing Discord channel: ${channelName} (${channelId})`);

    // Analyze each day
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(endDate);
      currentDate.setDate(currentDate.getDate() - i);
      const dateStr = currentDate.toISOString().split('T')[0];

      console.log(`\nAnalyzing messages for ${dateStr}...`);
      const dailyAnalysis = await analyzeSingleDay(channelId, dateStr);
      dailyAnalyses.push({
        date: dateStr,
        analysis: dailyAnalysis,
      });
      if (i < days - 1) {
        console.log('Waiting before next analysis...');
        await sleep(5000);
      }
    }

    // Add daily analyses section
    output += '\n📊 Daily Analyses:\n';
    for (const daily of dailyAnalyses) {
      output += `\n=== ${daily.date} ===\n`;
      output += formatAnalysis(daily.analysis);
    }

    // Write the complete analysis to file
    await writeAnalysisToFile(output, outputFile);

    const combinedOutputFile = path.join('analysis_output', `${channelName}_analysis_${timestamp}.txt`);
    let combinedOutput = '🤖 Discord Analysis Bot\n------------------------\n';

    combinedOutput += `\n${channelName} Analysis\n`;
    combinedOutput += '------------------------\n';

    // Combine all daily analyses
    console.log('\nCombining daily analyses...');
    const dailyOutput = output;
    const analysisResponse = await combineAnalyses(dailyOutput);

    // Format the combined analysis
    combinedOutput += formatAnalysis(analysisResponse);

    // Write the complete analysis to file
    await writeAnalysisToFile(combinedOutput, combinedOutputFile);
  } catch (error) {
    const errorMsg = `Error running Discord analysis: ${error}`;
    console.error(errorMsg);
    output += `\n❌ ${errorMsg}\n`;
  }
}

async function writeAnalysisToFile(output: string, filePath: string) {
  try {
    await fs.writeFile(filePath, output, 'utf8');
    console.log(`Analysis written to: ${filePath}`);
  } catch (error) {
    console.error('Error writing analysis to file:', error);
  }
}

const { categories } = await getCategories();

// Run the analysis
runAnalysis('Mastra', channels.Mastra).then(() => {
  console.log('Analysis complete!');
});

runAnalysis('Help', channels.Help).then(() => {
  console.log('Analysis complete!');
});

// Function to analyze a single day
async function analyzeSingleDay(channelId: string, date: string) {
  const prompt = `Analyze the messages from our Discord channels for ${date}.
  Include messages from the ${channelId} channel
  
  Use these predefined categories:
  ${categories.map(c => `- ${c.name}: ${c.description}`).join('\n  ')}
  
  Analyze and categorize messages from both channels using these categories to identify patterns and issues for this day.`;

  const result = await analysisAgent.stream(prompt, {
    experimental_output: AnalysisSchema,
  });

  let response = {};
  for await (const chunk of result.partialObjectStream) {
    response = { ...response, ...chunk };
  }

  return response;
}

// Function to combine daily analyses
async function combineAnalyses(dailyAnalyses: any) {
  const summaryPrompt = `Review and combine these daily analyses to provide an overall summary.
  Focus on:
  - Trends across days
  - Most common categories
  - Recurring issues
  - Changes in patterns over time
  
  Here are the daily analyses:
  ${dailyAnalyses}`;

  const result = await analysisAgent.stream(summaryPrompt, {
    experimental_output: AnalysisSchema,
  });

  let response = {};
  for await (const chunk of result.partialObjectStream) {
    response = { ...response, ...chunk };
  }

  return response;
}
