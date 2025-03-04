import { createOpenAI } from '@ai-sdk/openai';
import { config } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Agent } from '../agent';
import { createTool } from '../tools';

import { AgentNetwork } from './network';
import { NetworkState } from './state';

config();

// Create OpenAI client
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

describe('AgentNetwork', () => {
  it('should create a network with agents', () => {
    // Create search agent
    const searchAgent = new Agent({
      name: 'Search',
      instructions: 'You search for information on the web',
      model: openai('gpt-4o-mini'),
    });

    // Create summary agent
    const summaryAgent = new Agent({
      name: 'Summary',
      instructions: 'You summarize information into concise points',
      model: openai('gpt-4o-mini'),
    });

    // Create a network
    const network = new AgentNetwork({
      name: 'Research Assistant',
      agents: [searchAgent, summaryAgent],
      routingModel: openai('gpt-4o'),
    });

    expect(network).toBeDefined();
    expect(network.name).toBe('Research Assistant');
    expect(network.agents).toHaveLength(2);
    expect(network.agents[0].name).toBe('Search');
    expect(network.agents[1].name).toBe('Summary');
  });

  it.only('should create a travel itinerary using specialized agents', async () => {
    // Create destination research agent
    const destinationResearchAgent = new Agent({
      name: 'DestinationResearcher',
      instructions: `You are a travel destination expert.
      Your job is to analyze travel destinations based on user preferences and constraints.
      Provide detailed information about locations including:
      - Best times to visit
      - Cultural highlights
      - Local cuisine
      - Safety considerations
      - Weather patterns
      - Visa requirements
      
      Focus only on researching and analyzing destinations. Do not create itineraries or schedules.
      If you need more information about user preferences, note this in your response.`,
      model: openai('gpt-4o-mini'),
    });

    // Create accommodation specialist agent
    const accommodationAgent = new Agent({
      name: 'AccommodationSpecialist',
      instructions: `You are an accommodation expert.
      Your job is to recommend suitable lodging options based on:
      - Location proximity to attractions
      - Budget constraints
      - Accommodation style preferences (hotel, hostel, rental)
      - Necessary amenities
      - Length of stay
      
      Provide specific recommendations with reasoning. Consider the destination information 
      provided by the DestinationResearcher when making your suggestions.
      Focus only on accommodations, not on activities or transportation.`,
      model: openai('gpt-4o-mini'),
    });

    // Create activities planner agent
    const activitiesAgent = new Agent({
      name: 'ActivitiesPlanner',
      instructions: `You are an activities and excursion specialist.
      Your job is to recommend engaging activities and experiences based on:
      - Destination characteristics
      - Traveler interests and preferences
      - Seasonal availability
      - Budget considerations
      - Physical ability levels
      
      Create a balanced mix of cultural, adventure, relaxation, and culinary experiences.
      Consider information from both the DestinationResearcher and AccommodationSpecialist.
      Focus only on activities and experiences, not on logistics or scheduling.`,
      model: openai('gpt-4o-mini'),
    });

    // Create itinerary coordinator agent
    const itineraryCoordinatorAgent = new Agent({
      name: 'ItineraryCoordinator',
      instructions: `You are a travel itinerary coordinator.
      Your job is to take information from all the specialist agents and create a cohesive, 
      day-by-day travel plan that includes:
      - Logical ordering of activities
      - Realistic timing and pacing
      - Transportation between locations
      - Meal recommendations and timing
      - Free time for relaxation or spontaneity
      
      Create a complete itinerary document that's ready to use, including:
      - A daily schedule
      - Estimated costs
      - Packing recommendations
      - Important contact information
      - Local emergency information
      
      Your itinerary should be comprehensive, realistic, and personalized to the traveler's needs.`,
      model: openai('gpt-4o-mini'),
    });

    // Create initial state with traveler preferences
    const initialState = new NetworkState();
    initialState.set('travelerPreferences', {
      destination: 'Japan',
      duration: '10 days',
      budget: 'mid-range ($150-$250/day)',
      interests: ['cultural experiences', 'food', 'nature', 'photography'],
      travelStyle: 'balanced pace, authentic experiences',
      accommodation: 'mix of traditional ryokans and modern hotels',
      dietaryRestrictions: 'vegetarian options needed',
      travelDates: 'April 2025 (cherry blossom season)',
    });

    // Create a network
    const network = new AgentNetwork({
      name: 'Travel Planning System',
      agents: [destinationResearchAgent, accommodationAgent, activitiesAgent, itineraryCoordinatorAgent],
      routingModel: openai('gpt-4o'),
      initialState,
      maxSteps: 5, // Allow up to 5 steps
    });

    // Run the network
    const result = await network.generate(
      'Create a detailed 10-day Japan itinerary for cherry blossom season. I want a mix of cultural experiences, nature, and food. I prefer a mix of traditional ryokans and modern hotels with a mid-range budget.',
    );

    // Check the result
    expect(result).toBeDefined();
    expect(result.steps).toBeGreaterThanOrEqual(2); // Should use multiple agents
    expect(result.history.length).toBeGreaterThanOrEqual(2);
    expect(result.output).toBeDefined();

    // Log the result for manual inspection
    console.log('Travel Itinerary Network Result:');
    console.log(`Steps: ${result.steps}`);
    console.log('Agent History:');
    result.history.forEach((step, i) => {
      console.log(`Step ${i + 1}: ${step.agent}`);
    });
    console.log(
      'Final Output Excerpt (first 500 chars):',
      typeof result.output === 'string'
        ? result.output.substring(0, 500) + '...'
        : JSON.stringify(result.output).substring(0, 500) + '...',
    );
  }, 30000); // Increase timeout to 30 seconds

  it('should create a research report using multiple specialized agents', async () => {
    // Create research agent
    const researchAgent = new Agent({
      name: 'Researcher',
      instructions: `You are a research specialist.
      Your job is to gather and analyze information on a given topic.
      Focus on finding key facts, statistics, and insights.
      Organize your findings in a structured way, highlighting the most important information.
      If the topic requires further analysis, say so in your response.`,
      model: openai('gpt-4o-mini'),
    });

    // Create analysis agent
    const analysisAgent = new Agent({
      name: 'Analyst',
      instructions: `You are an analytical expert.
      Your job is to take research findings and perform deeper analysis.
      Identify patterns, trends, and implications.
      Connect different pieces of information to draw meaningful conclusions.
      If you need more specific information, say so in your response.`,
      model: openai('gpt-4o-mini'),
    });

    // Create report writing agent
    const reportAgent = new Agent({
      name: 'ReportWriter',
      instructions: `You are a professional report writer.
      Your job is to take research and analysis and create a polished, well-structured report.
      Use clear headings, concise language, and professional formatting.
      Include an executive summary at the beginning and recommendations at the end.
      The report should be comprehensive yet easy to read.`,
      model: openai('gpt-4o-mini'),
    });

    // Create a network
    const network = new AgentNetwork({
      name: 'Research Report Generator',
      agents: [researchAgent, analysisAgent, reportAgent],
      routingModel: openai('gpt-4o'),
      maxSteps: 4, // Limit to 4 steps
    });

    // Run the network
    const result = await network.generate(
      'Create a report on the impact of artificial intelligence on the job market over the next decade.',
    );

    // Check the result
    expect(result).toBeDefined();
    expect(result.steps).toBeGreaterThanOrEqual(1);
    expect(result.history.length).toBeGreaterThanOrEqual(1);
    expect(result.output).toBeDefined();

    // Log the result for manual inspection
    console.log('Research Report Network Result:');
    console.log(`Steps: ${result.steps}`);
    console.log('Agent History:');
    result.history.forEach((step, i) => {
      console.log(`Step ${i + 1}: ${step.agent}`);
    });
  }, 15000); // Increase timeout to 15 seconds

  it('should create a marketing campaign using collaborative agents', async () => {
    // Create market research agent
    const marketResearchAgent = new Agent({
      name: 'MarketResearcher',
      instructions: `You are a market research specialist.
      Your job is to analyze target audiences, market trends, and competitor strategies.
      Provide insights on customer demographics, preferences, and behaviors.
      Identify market opportunities and potential challenges.
      Your analysis should be data-driven and actionable.`,
      model: openai('gpt-4o-mini'),
    });

    // Create creative concept agent
    const creativeConceptAgent = new Agent({
      name: 'CreativeConcept',
      instructions: `You are a creative director.
      Your job is to develop innovative marketing concepts and campaign ideas.
      Create compelling messaging, visual themes, and storytelling approaches.
      Your concepts should be original, memorable, and aligned with brand values.
      Consider how to emotionally connect with the target audience.`,
      model: openai('gpt-4o-mini'),
    });

    // Create campaign strategy agent
    const campaignStrategyAgent = new Agent({
      name: 'CampaignStrategist',
      instructions: `You are a campaign strategy expert.
      Your job is to develop comprehensive marketing campaign plans.
      Create channel strategies, timing plans, and budget allocations.
      Recommend specific tactics for different platforms and audiences.
      Your strategies should be practical, measurable, and results-oriented.`,
      model: openai('gpt-4o-mini'),
    });

    // Create initial state with brand information
    const initialState = new NetworkState();
    initialState.set('brandInfo', {
      name: 'EcoTech Solutions',
      industry: 'Sustainable Technology',
      values: ['Innovation', 'Sustainability', 'Accessibility'],
      targetAudience: 'Environmentally conscious consumers aged 25-45',
    });

    // Create a network
    const network = new AgentNetwork({
      name: 'Marketing Campaign Generator',
      agents: [marketResearchAgent, creativeConceptAgent, campaignStrategyAgent],
      routingModel: openai('gpt-4o'),
      initialState,
      maxSteps: 4, // Limit to 4 steps
    });

    // Run the network
    const result = await network.generate(
      'Create a marketing campaign for our new solar-powered smart home system that reduces energy consumption by 40%.',
    );

    // Check the result
    expect(result).toBeDefined();
    expect(result.steps).toBeGreaterThanOrEqual(1);
    expect(result.history.length).toBeGreaterThanOrEqual(1);
    expect(result.output).toBeDefined();

    // Verify state was maintained
    expect(result.state.get('brandInfo')).toBeDefined();

    // Log the result for manual inspection
    console.log('Marketing Campaign Network Result:');
    console.log(`Steps: ${result.steps}`);
    console.log('Agent History:');
    result.history.forEach((step, i) => {
      console.log(`Step ${i + 1}: ${step.agent}`);
    });
  }, 15000); // Increase timeout to 15 seconds

  it('should troubleshoot a technical problem using specialized agents', async () => {
    // Create diagnostic agent
    const diagnosticAgent = new Agent({
      name: 'Diagnostician',
      instructions: `You are a technical diagnostician.
      Your job is to analyze error messages, symptoms, and system information to identify potential issues.
      Ask clarifying questions if needed and consider multiple possible causes.
      Provide a clear assessment of what might be causing the problem.`,
      model: openai('gpt-4o-mini'),
    });

    // Create solution agent
    const solutionAgent = new Agent({
      name: 'SolutionProvider',
      instructions: `You are a technical solution expert.
      Your job is to provide step-by-step solutions to technical problems.
      Based on the diagnosis, offer clear, actionable instructions to resolve the issue.
      Include alternative approaches if applicable and explain the reasoning behind your solutions.
      Your instructions should be detailed enough for someone with basic technical knowledge to follow.`,
      model: openai('gpt-4o-mini'),
    });

    // Create prevention agent
    const preventionAgent = new Agent({
      name: 'PreventionAdvisor',
      instructions: `You are a technical prevention specialist.
      Your job is to provide advice on how to prevent similar problems in the future.
      Recommend best practices, maintenance routines, and system improvements.
      Your advice should be practical and tailored to the specific situation.
      Consider both short-term fixes and long-term strategies.`,
      model: openai('gpt-4o-mini'),
    });

    // Create a network
    const network = new AgentNetwork({
      name: 'Technical Support System',
      agents: [diagnosticAgent, solutionAgent, preventionAgent],
      routingModel: openai('gpt-4o'),
      maxSteps: 4, // Limit to 4 steps
    });

    // Run the network with a technical problem
    const result = await network.generate(
      'My application keeps crashing with an "out of memory" error when processing large files. The error occurs after about 2 minutes of processing. I\'m using Node.js v18 on a server with 8GB RAM.',
    );

    // Check the result
    expect(result).toBeDefined();
    expect(result.steps).toBeGreaterThanOrEqual(1);
    expect(result.history.length).toBeGreaterThanOrEqual(1);
    expect(result.output).toBeDefined();

    // Log the result for manual inspection
    console.log('Technical Support Network Result:');
    console.log(`Steps: ${result.steps}`);
    console.log('Agent History:');
    result.history.forEach((step, i) => {
      console.log(`Step ${i + 1}: ${step.agent}`);
    });
  }, 15000); // Increase timeout to 15 seconds

  it('should handle maximum steps and stop execution', async () => {
    // Create an agent that will always suggest continuing
    const loopAgent = new Agent({
      name: 'Loop',
      instructions: 'You always respond with "Let\'s continue the process"',
      model: openai('gpt-4o-mini'),
    });

    // Create a network with a limited number of steps
    const network = new AgentNetwork({
      name: 'Loop Test',
      agents: [loopAgent],
      routingModel: openai('gpt-4o'),
      maxSteps: 3, // Set a low max steps count
    });

    // Run the network
    const result = await network.generate('This will loop');

    // Check that it stopped at the max steps
    expect(result.steps).toBeLessThanOrEqual(3);
    expect(result.history.length).toBeLessThanOrEqual(3);
  }, 10000); // Increase timeout to 10 seconds

  it('should support running with custom runId and threadId', async () => {
    // Create an agent
    const testAgent = new Agent({
      name: 'TestAgent',
      instructions: 'You are a test agent that responds with the runId and threadId you receive',
      model: openai('gpt-4o-mini'),
    });

    // Create a network
    const network = new AgentNetwork({
      name: 'Custom IDs Test',
      agents: [testAgent],
      routingModel: openai('gpt-4o'),
    });

    // Custom IDs
    const customRunId = 'custom-run-id-123';
    const customThreadId = 'custom-thread-id-456';
    const customResourceId = 'custom-resource-id-789';

    // Run the network with custom IDs
    const result = await network.generate('Include the runId and threadId in your response', {
      runId: customRunId,
      threadId: customThreadId,
      resourceId: customResourceId,
    });

    // Verify the result contains information about the run
    expect(result.steps).toBe(1);
    expect(result.history).toHaveLength(1);
    expect(result.history[0].agent).toBe('TestAgent');
  }, 10000); // Increase timeout to 10 seconds
});
