import { Agent } from '@mastra/core/agent';
import { AgentNetwork } from '@mastra/core/network';
import { openai } from '@ai-sdk/openai';

/**
 * This example demonstrates how to create a network of 3 specialized agents
 * that collaborate on data analysis tasks.
 */
async function main() {
  // Create an OpenAI model instance
  const model = openai('gpt-4o');

  // 1. Data Collector Agent: Gathers and validates data
  const dataCollectorAgent = new Agent({
    name: 'Data Collector',
    instructions: `
      You are a specialized data collection agent responsible for gathering and validating data.
      Your responsibilities:
      - Identify relevant data sources for the given task
      - Describe what data would be collected and how
      - Explain data validation procedures to ensure quality
      - Outline potential limitations or biases in the data
      - Format data in a structured way for analysis
      - Respond with ONLY information about the data collection process and results
    `,
    model,
  });

  // 2. Data Analyst Agent: Processes and analyzes data
  const dataAnalystAgent = new Agent({
    name: 'Data Analyst',
    instructions: `
      You are a specialized data analysis agent responsible for processing and interpreting data.
      Your responsibilities:
      - Apply appropriate statistical methods to analyze the provided data
      - Identify patterns, trends, and correlations in the data
      - Generate insights based on the analysis
      - Explain the significance of findings
      - Highlight any limitations in the analysis
      - Respond with ONLY the analysis results and insights
    `,
    model,
  });

  // 3. Visualization Expert Agent: Creates data visualizations
  const visualizationAgent = new Agent({
    name: 'Visualization Expert',
    instructions: `
      You are a specialized data visualization agent responsible for creating effective visual representations.
      Your responsibilities:
      - Recommend appropriate visualization types for the data and insights
      - Describe how to create clear, informative visualizations
      - Explain design choices that enhance understanding
      - Ensure visualizations accurately represent the data
      - Suggest improvements to make data more accessible
      - Respond with ONLY visualization recommendations and explanations
    `,
    model,
  });

  // Create the network with routing instructions
  const dataNetwork = new AgentNetwork({
    name: 'Data Analysis Network',
    agents: [dataCollectorAgent, dataAnalystAgent, visualizationAgent],
    model,
    instructions: `
      You are coordinating a data analysis workflow with three specialized agents:
      
      1. DATA COLLECTOR: Gathers and validates data from relevant sources
      2. DATA ANALYST: Processes data and generates insights through analysis
      3. VISUALIZATION EXPERT: Creates effective visual representations of the data and insights
      
      Routing guidelines:
      - Start with the Data Collector to gather and structure the necessary data
      - Then route to the Data Analyst to process the data and generate insights
      - Finally, route to the Visualization Expert to create visual representations
      - For complex analyses, you may need to iterate between the Analyst and Visualization Expert
      
      Your job is to determine which agent should handle each step of the process
      based on the current state and needs of the data analysis task.
    `,
  });

  // Example task that requires collaboration between agents
  const task = 'Analyze the trends in renewable energy adoption across different countries over the past decade.';

  console.log('Task:', task);
  console.log('\nGenerating analysis...\n');

  // Generate analysis using the network
  const response = await dataNetwork.generate(task);

  // Display the final result
  console.log('Final Analysis:');
  console.log(response.text);

  // Display the interaction history to see how agents collaborated
  console.log('\nAgent Interaction Summary:');
  console.log(dataNetwork.getAgentInteractionSummary());
}

main().catch(error => {
  console.error('Error running example:', error);
});
