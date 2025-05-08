'use server';
/**
 * @fileOverview Analyzes user input (text, voice, or video) to predict potential mental health conditions, detect emotion, and suggest improvements.
 *
 * - analyzeMentalHealth - A function that handles the mental health analysis process.
 * - AnalyzeMentalHealthInput - The input type for the analyzeMentalHealth function.
 * - AnalyzeMentalHealthOutput - The return type for the analyzeMentalHealth function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const MentalHealthConditionSchema = z.object({
  conditionName: z.string().describe('The name of the potential mental health condition.'),
  confidencePercentage: z.number().describe('The confidence percentage (0-100) of the condition.'),
  suggestedImprovements: z.array(z.string()).describe('Suggestions to improve the users mental health with respect to the condition')
});

// Wrapper schema for analysis results per input type
const AnalysisResultSchema = z.object({
    conditions: z.array(MentalHealthConditionSchema).describe(
        'Potential mental health conditions with confidence percentages and suggestions. Only the top two most probable.'
    ),
    emotion: z.string().describe('The primary emotion detected in the input (e.g., happy, sad, angry, stressed, neutral).').nullable(), // Allow null if no emotion detected
});


const AnalyzeMentalHealthInputSchema = z.object({
  textInput: z.string().describe('The text input from the user.').optional(),
  voiceInputDataUri: z
    .string()
    .describe(
      "The voice input from the user, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ).optional(),
  videoInputDataUri: z
    .string()
    .describe(
      "The video input from the user, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ).optional(),
});
export type AnalyzeMentalHealthInput = z.infer<typeof AnalyzeMentalHealthInputSchema>;

const AnalyzeMentalHealthOutputSchema = z.object({
  textAnalysis: AnalysisResultSchema.nullable().describe('Analysis results based on text input.'),
  voiceAnalysis: AnalysisResultSchema.nullable().describe('Analysis results based on voice input.'),
  videoAnalysis: AnalysisResultSchema.nullable().describe('Analysis results based on video input.'),
});

export type AnalyzeMentalHealthOutput = z.infer<typeof AnalyzeMentalHealthOutputSchema>;

export async function analyzeMentalHealth(input: AnalyzeMentalHealthInput): Promise<AnalyzeMentalHealthOutput> {
    // Basic validation: Ensure at least one input is provided
  if (!input.textInput && !input.voiceInputDataUri && !input.videoInputDataUri) {
    throw new Error("No valid input provided. Please provide text, voice, or video input.");
  }
  return analyzeMentalHealthFlow(input);
}

const analyzeMentalHealthPrompt = ai.definePrompt({
  name: 'analyzeMentalHealthPrompt',
  input: {
    schema: z.object({
      textInput: z.string().describe('The text input from the user.'),
    }),
  },
  output: {
    schema: AnalysisResultSchema,
  },
  prompt: `Analyze the user's text input to identify potential mental health conditions and detect the primary emotion (e.g., happy, sad, angry, stressed, neutral). Provide a confidence percentage for each condition. For each condition, generate a list of suggestions that the user can follow to improve their mental health.

  Only return the two most probable conditions. If no conditions are strongly indicated, return an empty array for conditions. If no clear emotion is detected, set emotion to null.

  Text Input: {{{textInput}}}

  Format your response as a JSON object with 'conditions' (an array of objects with 'conditionName', 'confidencePercentage', and 'suggestedImprovements') and 'emotion' (a string or null).
  `,
});

const analyzeVoicePrompt = ai.definePrompt({
  name: 'analyzeVoicePrompt',
  input: {
    schema: z.object({
      voiceInputDataUri: z
        .string()
        .describe(
          "The voice input from the user, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
    }),
  },
  output: {
    schema: AnalysisResultSchema,
  },
  prompt: `Analyze the user's voice input (tone, pace, words) to identify potential mental health conditions and detect the primary emotion (e.g., happy, sad, angry, stressed, neutral). Provide a confidence percentage for each condition. For each condition, generate a list of suggestions that the user can follow to improve their mental health.

  Only return the two most probable conditions. If no conditions are strongly indicated, return an empty array for conditions. If no clear emotion is detected, set emotion to null.

  Voice Input: {{media url=voiceInputDataUri}}

  Format your response as a JSON object with 'conditions' (an array of objects with 'conditionName', 'confidencePercentage', and 'suggestedImprovements') and 'emotion' (a string or null).
  `,
});

const analyzeVideoPrompt = ai.definePrompt({
  name: 'analyzeVideoPrompt',
  input: {
    schema: z.object({
      videoInputDataUri: z
        .string()
        .describe(
          "The video input from the user, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
    }),
  },
  output: {
    schema: AnalysisResultSchema,
  },
  prompt: `Analyze the user's facial expressions and spoken words in the video to identify potential mental health conditions and detect the primary emotion (e.g., happy, sad, angry, stressed, neutral). Provide a confidence percentage for each condition. For each condition, generate a list of suggestions that the user can follow to improve their mental health.

  Only return the two most probable conditions. If no conditions are strongly indicated, return an empty array for conditions. If no clear emotion is detected, set emotion to null.

  Video Input: {{media url=videoInputDataUri}}

  Format your response as a JSON object with 'conditions' (an array of objects with 'conditionName', 'confidencePercentage', and 'suggestedImprovements') and 'emotion' (a string or null).
  `,
});

const analyzeMentalHealthFlow = ai.defineFlow<
  typeof AnalyzeMentalHealthInputSchema,
  typeof AnalyzeMentalHealthOutputSchema
>({
  name: 'analyzeMentalHealthFlow',
  inputSchema: AnalyzeMentalHealthInputSchema,
  outputSchema: AnalyzeMentalHealthOutputSchema,
}, async input => {
  // Use conditional calls based on input presence
  const textAnalysisPromise = input.textInput
    ? analyzeMentalHealthPrompt({ textInput: input.textInput })
    : Promise.resolve(null);

  const voiceAnalysisPromise = input.voiceInputDataUri
    ? analyzeVoicePrompt({ voiceInputDataUri: input.voiceInputDataUri })
    : Promise.resolve(null);

  const videoAnalysisPromise = input.videoInputDataUri
    ? analyzeVideoPrompt({ videoInputDataUri: input.videoInputDataUri })
    : Promise.resolve(null);

  const [textResult, voiceResult, videoResult] = await Promise.all([
    textAnalysisPromise,
    voiceAnalysisPromise,
    videoAnalysisPromise
  ]);

  // Helper function to extract output or return null
  const getOutputOrNull = (result: { output?: AnalysisResultSchema | null } | null): AnalysisResultSchema | null => {
    return result?.output ?? null;
  };

  return {
    textAnalysis: getOutputOrNull(textResult),
    voiceAnalysis: getOutputOrNull(voiceResult),
    videoAnalysis: getOutputOrNull(videoResult),
  };
});
