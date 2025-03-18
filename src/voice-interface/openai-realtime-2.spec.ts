import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { describe, it, expect, vi } from 'vitest';
import { RealtimeConversation } from './openai-realtime-2';
import { env } from '../config/env';
import { OpenAIConfig } from '@mastra/voice-openai';
import { openai } from '@ai-sdk/openai';

describe('RealtimeConversation Integration Test', () => {
    // Set a longer timeout for this test (30 seconds)
    vi.setConfig({ testTimeout: 30000 });

    // Configure test timeout - voice processing can take some time
    it('should process audio input and return a response', async () => {

        // Configure OpenAI with API key from environment variables
        const voiceConfig: {
            speechModel: OpenAIConfig;
            listeningModel: OpenAIConfig;
            speaker: string;
        } = {
            speechModel: {
                apiKey: env.OPENAI_API_KEY,
            },
            listeningModel: {
                apiKey: env.OPENAI_API_KEY,
            },
            speaker: 'nova'
        };

        // Configure agent
        const agentConfig = {
            name: "Test Assistant",
            instructions: "You are a helpful test assistant. Keep your responses brief and friendly.",
            model: openai('gpt-4o-mini')
        };

        // Create a new real-time conversation instance
        const conversation = new RealtimeConversation(
            voiceConfig,
            agentConfig,
            { filetype: 'wav' },
            { speaker: 'nova', speed: 1.0 }
        );

        try {
            // Read the audio file
            const audioFilePath = path.resolve(__dirname, 'hello-there.wav');
            console.log(`Reading audio file from: ${audioFilePath}`);
            const audioBuffer = fs.readFileSync(audioFilePath);

            // Process the audio input
            console.log('Processing audio input...');
            conversation.processAudioInput(audioBuffer);

            // Commit the audio buffer and get response
            console.log('Committing audio buffer...');
            const { audio, text } = await conversation.commitAudioBuffer();

            // Check that we got a response
            expect(audio).toBeDefined();
            expect(text).toBeDefined();

            // Save the respo&nse audio for manual inspection
            const outputPath = path.resolve(__dirname, 'response-output.mp3');

            // Handle saving the response if it's a ReadableStream
            if (audio instanceof Readable) {
                // Create a writable stream to save the file
                const writeStream = fs.createWriteStream(outputPath);
                // Pipe the readable stream to the file
                audio.pipe(writeStream);
                // Wait for the file to finish writing
                await new Promise<void>((resolve, reject) => {
                    writeStream.on('finish', () => resolve());
                    writeStream.on('error', reject);
                });
            } else if (audio instanceof Buffer) {
                // If it's a buffer, write it directly
                fs.writeFileSync(outputPath, audio);
            } else {
                console.warn('Response audio is not a readable stream or buffer, could not save to file');
            }

            console.log(`Response audio saved to: ${outputPath}`);

            // Clean up
            conversation.close();
        } catch (error) {
            console.error('Test failed with error:', error);
            throw error;
        }
    });
});
