import { describe, it, expect, vi } from 'vitest';
import { OpenAIRealtime } from './openai-realtime';
import { env } from '../config/env';
import fs from 'fs';
import path from 'path';

describe('OpenAIRealtime - Integration Tests', () => {
    // Set a timeout for the test to allow time for API connections
    vi.setConfig({ testTimeout: 15000 });

    it('should successfully connect to OpenAI realtime API and disconnect properly', async () => {
        // Create a new instance of OpenAIRealtime inside the test
        const realtimeClient = new OpenAIRealtime({
            apiKey: env.OPENAI_API_KEY
        });

        try {
            // Set up a promise that will be resolved when connected
            const connectionPromise = realtimeClient.connect({
                onMessage: (message) => {
                    console.log('Message received:', message);
                },
                onError: (error) => {
                    // If this is called, the test will fail because we'll throw the error
                    throw error;
                }
            });

            // Connect should resolve without errors
            await expect(connectionPromise).resolves.not.toThrow();

            // Test that the connection was established by checking internal state
            // @ts-expect-error - Accessing private property for testing
            expect(realtimeClient.isConnected).toBe(true);

            console.log('Successfully connected to OpenAI realtime API');

            // Disconnect and verify that isConnected changes to false
            realtimeClient.disconnect();

            // @ts-expect-error - Accessing private property for testing
            expect(realtimeClient.isConnected).toBe(false);

            console.log('Successfully disconnected from OpenAI realtime API');
        } catch (error) {
            // Ensure we disconnect even if test fails
            realtimeClient.disconnect();
            throw error;
        }
    });

    it.only('should successfully send an audio file to the API', async () => {
        // Create a new instance of OpenAIRealtime
        const realtimeClient = new OpenAIRealtime({
            apiKey: env.OPENAI_API_KEY
        });

        try {
            // Set up message collector to store responses
            const receivedMessages: any[] = [];

            // Connect to the API
            await realtimeClient.connect({
                onMessage: (message) => {
                    console.log('Message received:', JSON.stringify(message, null, 2));
                    receivedMessages.push(message);
                },
                onError: (error) => {
                    console.error('Error from API:', error);
                    throw error;
                }
            });

            // Read the audio file
            const audioFilePath = path.join(__dirname, 'hello-there.wav');
            const audioBuffer = fs.readFileSync(audioFilePath);

            // Configure the session to use the proper audio format
            console.log('Updating session configuration...');
            realtimeClient.updateSession({
                input_audio_format: "pcm16",
            });

            // Send the audio file
            console.log(`Sending audio file (${audioBuffer.length} bytes)...`);
            realtimeClient.sendAudio(audioBuffer);

            // Wait a moment for processing (adjust time as needed)
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Verify we received some response
            console.log(`Received ${receivedMessages.length} messages`);
            expect(receivedMessages.length).toBeGreaterThan(0);

            // Disconnect when done
            realtimeClient.disconnect();

            // Verify disconnection
            // @ts-expect-error - Accessing private property for testing
            expect(realtimeClient.isConnected).toBe(false);
            console.log('Successfully disconnected from OpenAI realtime API');
        } catch (error) {
            // Ensure we disconnect even if test fails
            realtimeClient.disconnect();
            throw error;
        }
    });
});
