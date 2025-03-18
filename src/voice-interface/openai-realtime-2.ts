import { OpenAIConfig, OpenAIVoice } from '@mastra/voice-openai';
import { Agent } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { Readable } from 'stream';

/**
 * Class to manage real-time voice conversations using OpenAI
 */
export class RealtimeConversation {
    private voice: OpenAIVoice;
    private agent: Agent;
    private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    private accumulatedAudioBuffer: Buffer[] = []; // Store accumulated audio chunks
    private listenOptions: { filetype: "mp3" | "mp4" | "mpeg" | "mpga" | "m4a" | "wav" | "webm" };
    private speakOptions: { speaker: string; speed: number };

    /**
     * Initialize a new real-time conversation
     * @param voiceConfig Configuration for OpenAIVoice
     * @param agentConfig Configuration for Agent
     * @param listenOptions Options for speech-to-text processing
     * @param speakOptions Options for text-to-speech processing
     */
    constructor(
        voiceConfig?: {
            speechModel?: OpenAIConfig;
            listeningModel?: OpenAIConfig;
            speaker?: string;
        },
        agentConfig?: {
            name: string;
            instructions: string;
            model: any;
        },
        listenOptions?: { filetype: "mp3" | "mp4" | "mpeg" | "mpga" | "m4a" | "wav" | "webm" },
        speakOptions?: { speaker: string; speed: number }
    ) {
        // Initialize voice interface
        this.voice = voiceConfig ? new OpenAIVoice(voiceConfig) : new OpenAIVoice();

        // Initialize agent
        this.agent = agentConfig
            ? new Agent(agentConfig)
            : new Agent({
                name: "Conversation Assistant",
                instructions: "You are a helpful assistant.",
                model: openai("gpt-4o-mini"),
            });

        // Initialize speech options
        this.listenOptions = listenOptions || { filetype: 'mp3' };
        this.speakOptions = speakOptions || { speaker: 'nova', speed: 1.0 };
    }

    /**
     * Convert an audio buffer to a readable stream
     * @param buffer Audio buffer
     * @returns Node.js ReadableStream
     */
    private bufferToStream(buffer: Buffer): Readable {
        const readable = new Readable();
        readable.push(buffer);
        readable.push(null);
        return readable;
    }

    /**
     * Accumulate audio input without processing it
     * @param audioBuffer Audio buffer containing speech to accumulate
     */
    public processAudioInput(audioBuffer: Buffer): void {
        // Accumulate the audio buffer for later processing
        this.accumulatedAudioBuffer.push(audioBuffer);
    }

    /**
     * Process the accumulated audio input and get a response
     * @param overrideOptions Optional settings to override the default options for this specific commit
     * @returns Promise with the audio stream of the response
     */
    public async commitAudioBuffer(
        overrideOptions?: {
            speakOptions?: { speaker: string; speed: number };
        }
    ) {
        try {
            if (this.accumulatedAudioBuffer.length === 0) {
                throw new Error('No audio buffer accumulated to commit');
            }

            // Concatenate all accumulated buffers
            const combinedBuffer = Buffer.concat(this.accumulatedAudioBuffer);

            // Convert buffer to stream
            const audioStream = this.bufferToStream(combinedBuffer);

            // Convert speech to text using instance options or override options
            const text = await this.voice.listen(audioStream,
                this.listenOptions
            );

            // Update conversation history
            this.conversationHistory.push({ role: "user", content: text });

            // Get response from agent
            console.log("Gerando resposta...", this.agent.generate);
            const response = await this.agent.generate(this.conversationHistory);

            // Update conversation history
            this.conversationHistory.push({ role: "assistant", content: response.text });

            // Clear the accumulated buffer after processing
            this.accumulatedAudioBuffer = [];

            // Convert response to speech using instance options or override options
            const responseAudio = await this.voice.speak(
                response.text,
                overrideOptions?.speakOptions || this.speakOptions
            );

            return { text: response.text, audio: responseAudio };
        } catch (error) {
            console.error('Error in conversation processing:', error);
            throw error;
        }
    }

    /**
     * Close the conversation and release resources
     */
    public close(): void {
        // Clean up resources
        this.conversationHistory = [];
        this.accumulatedAudioBuffer = []; // Clear accumulated audio buffer
        // Additional cleanup for voice and agent if needed
    }

    /**
     * Get the current conversation history
     */
    public getConversationHistory(): Array<{ role: string; content: string }> {
        return this.conversationHistory;
    }
}

// Example usage:
/*
const conversation = new RealtimeConversation(
    { speaker: "alloy" },
    undefined,
    { filetype: "wav" },
    { speaker: "nova", speed: 1.2 }
);
// Accumulate audio chunks
conversation.processAudioInput(audioChunk1);
conversation.processAudioInput(audioChunk2);
// Process all accumulated audio when ready
const responseAudio = await conversation.commitAudioBuffer();
// Or override options for a specific commit
const responseAudio2 = await conversation.commitAudioBuffer({
    speakOptions: { speaker: "echo", speed: 0.9 }
});
// Play the response audio
conversation.close();
*/