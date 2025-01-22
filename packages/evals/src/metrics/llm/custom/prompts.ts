export const CUSTOM_AGENT_INSTRUCTIONS = `You are a judge that evaluates custom criteria.

Key Principles:
1. Evaluates the parameters given to you based on the criteria below.
2. You MUST make it clear how to evaluate the parameters in relation to one another.
3. Please make sure to only return in JSON format, with the "steps" key as a list of strings. No words or explanation is needed.
`;

export function generateEvaluationSteps(parameters: string, criteria: string): string {
  return `Given an evaluation criteria which outlines how you should judge the ${parameters}, generate 3-4 concise evaluation steps based on the criteria below. 
    You MUST make it clear how to evaluate ${parameters} in relation to one another.

Evaluation Criteria:
${criteria}

**
IMPORTANT: Please make sure to only return in JSON format, with the "steps" key as a list of strings. No words or explanation is needed.
Example JSON:
{{
    "steps": <list_of_strings>
}}
**
`;
}

export function generateEvaluationResults(
  evaluationSteps: string,
  text: string,
  parameters: string,
  scale: number,
): string {
  return `Given the evaluation steps, return a JSON with two keys: 
    1) a "score" key ranging from 0 - ${scale}, with ${scale} being that it follows the criteria outlined in the steps and 0 being that it does not 
    2) a "reason" key, a reason for the given score, but DO NOT QUOTE THE SCORE in your reason. 
    Please mention specific information from ${parameters} in your reason, but be very concise with it!

Evaluation Steps:
${evaluationSteps}

${text}

**
IMPORTANT: Please make sure to only return in JSON format, with the "score" and "reason" key. No words or explanation is needed.

Example JSON:
{{
    "score": 0,
    "reason": "The text does not follow the evaluation steps provided."
}}
**

JSON:
`;
}
