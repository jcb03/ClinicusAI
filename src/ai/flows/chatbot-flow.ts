'use server';
/**
 * @fileOverview A supportive chatbot that interacts with the user based on detected mental health conditions or general conversation.
 *
 * - chatWithBot - A function that handles the chatbot conversation turn.
 * - ChatbotInput - The input type for the chatWithBot function.
 * - ChatbotOutput - The return type for the chatWithBot function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

// Define the structure for a single message in the conversation history
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model']).describe('The role of the message sender (user or model).'),
  text: z.string().describe('The content of the message.'),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

const ChatbotInputSchema = z.object({
  userMessage: z.string().optional().describe("The user's latest text message to the chatbot. Can be empty if the bot is initiating based on analysis or if audio is provided."),
   audioInputDataUri: z
    .string()
    .describe(
      "The voice input from the user for the chatbot, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ).optional(),
  conversationHistory: z.array(ChatMessageSchema).describe('The history of the conversation so far.'),
  detectedCondition: z.string().nullable().describe('The primary mental health condition detected in the latest analysis, or null if none detected.'),
});
export type ChatbotInput = z.infer<typeof ChatbotInputSchema>;

const ChatbotOutputSchema = z.object({
  botResponse: z.string().describe("The chatbot's response to the user."),
});
export type ChatbotOutput = z.infer<typeof ChatbotOutputSchema>;

// No separate transcription prompt needed, handled inline with ai.generate

export async function chatWithBot(input: ChatbotInput): Promise<ChatbotOutput> {
  // Validation: Ensure some form of input (text, audio, or initial condition)
  if (!input.userMessage && !input.audioInputDataUri && input.conversationHistory.length === 0 && !input.detectedCondition) {
     // If no user message, no audio, no history, and no condition, return a generic greeting
     return { botResponse: "Hello! How can I help you today?" };
  }
   // If userMessage is empty but there IS a condition or audio, let the flow handle it.
  return chatbotFlow(input);
}

const chatbotPrompt = ai.definePrompt({
  name: 'chatbotPrompt',
  input: {
    schema: z.object({ // Define the specific input schema for *this* prompt
        userMessage: z.string().optional(), // Use optional here as transcription might fail or be empty
        conversationHistory: z.array(ChatMessageSchema),
        detectedCondition: z.string().nullable(),
    }),
  },
  output: {
    schema: ChatbotOutputSchema,
  },
  // Updated prompt logic
  prompt: `You are TherapyAI, a supportive and empathetic chatbot designed to offer gentle conversation and encouragement. Your goal is to be a kind listener. Do NOT provide medical advice, diagnoses, or treatment plans. You can suggest general well-being tips but always encourage users to consult professionals for serious concerns.

The user might communicate in different languages (like English, Hindi, etc.). Respond empathetically in the language the user seems most comfortable with, or default to English if unsure.

{{#if detectedCondition}}
  {{#if userMessage}}
    The user just sent a message (could be text or transcribed audio). A recent analysis suggested they might be experiencing signs related to: {{detectedCondition}}. Weave this context into your response subtly if appropriate, offering support related to that theme. Prioritize responding to the user's current message empathetically.
  {{else}}
    An analysis just completed and suggested the user might be experiencing signs related to: {{detectedCondition}}. Acknowledge this analysis result gently and offer support or ask an open-ended question related to how they are feeling. Example: "Based on the recent analysis, it seems like things might be related to [Condition]. How are you feeling about that?" or "The analysis suggested [Condition] might be relevant right now. I'm here to listen if you'd like to talk about it." Do NOT treat it as a confirmed diagnosis. Start the conversation based on this.
  {{/if}}
{{else}}
  {{#if userMessage}}
    Continue the conversation based on the history and the user's latest message (could be text or transcribed audio).
  {{else if conversationHistory.length}}
     It seems the user sent input (likely audio) but transcription failed or was empty. Ask them to try again or type their message. Example: "I'm sorry, I didn't quite catch that. Could you please try speaking again, or type your message?"
  {{else}}
    Start the conversation with a gentle and supportive opening like "Hello! How can I help you today?"
  {{/if}}
{{/if}}

Conversation History:
{{#each conversationHistory}}
{{role}}: {{text}}
{{/each}}

{{#if userMessage}}
User's latest message: {{userMessage}}
{{/if}}

Respond empathetically and continue the supportive conversation in the appropriate language. Keep your responses concise and encouraging. If the user asks for medical advice, gently redirect them to seek professional help.
AI Response:
`,
});


const chatbotFlow = ai.defineFlow<
  typeof ChatbotInputSchema,
  typeof ChatbotOutputSchema
>({
  name: 'chatbotFlow',
  inputSchema: ChatbotInputSchema,
  outputSchema: ChatbotOutputSchema,
}, async (input) => {
  let userMessageText = input.userMessage; // Start with potential text input
  let transcriptionErrorOccurred = false;

  // --- Transcription Step ---
  if (input.audioInputDataUri) {
    try {
      console.log("Attempting multilingual transcription for chatbot input (URI length:", input.audioInputDataUri.length, ")");
      // Use ai.generate directly for transcription task
      // Ensure we use a model capable of handling audio input and multilingual transcription
      const transcriptionResponse = await ai.generate({
           model: 'googleai/gemini-1.5-flash', // Use model name string directly
           prompt: [
                // Prompt asking for accurate language detection and transcription
                { text: "Please detect the language of the following audio and provide an accurate transcription of the spoken words." },
                { media: { url: input.audioInputDataUri } } // Media part with data URI
           ],
           // No specific input schema needed here as prompt handles it
           config: { temperature: 0.1 } // Lower temp for more factual transcription
       });

       const transcribedText = transcriptionResponse.text;
       console.log("Raw transcription result:", transcribedText);

       // Use transcribed text if available, otherwise keep original (or null if none)
       if (transcribedText && transcribedText.trim()) {
         userMessageText = transcribedText.trim();
         console.log("Using transcribed text:", userMessageText);
       } else {
         console.warn("Transcription result was empty or whitespace only.");
         // Keep userMessageText as it was (could be undefined)
         // The prompt logic will handle cases where userMessage is empty/null
         // We set a flag to indicate potential issue for the user later
         transcriptionErrorOccurred = true;
         userMessageText = ""; // Explicitly set to empty string if transcription fails/is empty
       }
    } catch (error: any) {
      console.error("Error during transcription for chatbot:", error);
      transcriptionErrorOccurred = true;
      userMessageText = ""; // Explicitly set to empty string on error
      // Don't throw; let the prompt handle the lack of transcribed text,
      // but also return a specific error message immediately.
      return { botResponse: `I'm sorry, I encountered an error trying to understand the audio: ${error.message || 'Unknown transcription error'}. Could you please type your message or try recording again?` };
    }
  }

  // --- Call Chatbot Prompt ---
  // Now call the actual chatbot prompt with the determined user message (text or transcribed)
  try {
    console.log("Calling chatbotPrompt with:", { userMessageText, conversationHistoryLength: input.conversationHistory.length, detectedCondition: input.detectedCondition });
    const { output } = await chatbotPrompt({
      userMessage: userMessageText, // Use the (potentially transcribed or empty) text
      conversationHistory: input.conversationHistory,
      detectedCondition: input.detectedCondition,
    });

    // Ensure output is not null before returning
    if (!output) {
        console.error("Chatbot flow received null output from prompt.");
        return { botResponse: "I'm sorry, I couldn't generate a response right now. Please try again." };
    }

    // If transcription failed earlier but the prompt somehow still generated a generic response,
    // prepend a notice about the transcription issue.
    // if (transcriptionErrorOccurred && !userMessageText) {
    //     // This logic might be too complex if the prompt handles empty userMessage well.
    //     // Let's rely on the prompt's handling first. If issues persist, uncomment/refine.
    //     // return { botResponse: "I'm sorry, I didn't quite catch that from the audio. " + output.botResponse };
    // }

    console.log("Chatbot prompt output:", output.botResponse);
    return output;

  } catch (promptError: any) {
     console.error("Error during chatbotPrompt execution:", promptError);
     return { botResponse: `I'm sorry, I encountered an issue while formulating a response: ${promptError.message || 'Unknown prompt error'}. Please try again.` };
  }
});
