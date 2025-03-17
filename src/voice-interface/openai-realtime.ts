import WebSocket from 'ws';

/**
 * OpenAI Realtime Interface
 * Based on official API reference: https://platform.openai.com/docs/api-reference/realtime
 */
export class OpenAIRealtime {
    private ws: WebSocket | null = null;
    private apiKey: string;
    private isConnected = false;

    constructor(options: {
        apiKey: string;
    }) {
        this.apiKey = options.apiKey;
    }

    /**
     * Connect to the OpenAI realtime API
     * @param options Configuration options for the session
     * @returns Promise that resolves when the connection is established
     */
    public async connect(options: {
        onMessage?: (message: any) => void;
        onError?: (error: Error) => void;
        parameters?: {
            model: string;
            [key: string]: any;
        };
    }): Promise<void> {
        if (this.isConnected) {
            throw new Error('Already connected to OpenAI realtime API');
        }

        try {
            // Default parameters
            const params = options.parameters || {
                model: 'gpt-4o-mini'
            };

            // Build URL with query parameters
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                queryParams.append(key, value.toString());
            });

            const url = `wss://api.openai.com/v1/realtime?${queryParams.toString()}`;

            return new Promise((resolve, reject) => {
                this.ws = new WebSocket(url, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'OpenAI-Beta': 'realtime=v1',
                        'Content-Type': 'application/json'
                    }
                });

                this.ws.on('open', () => {
                    this.isConnected = true;
                    console.log('Connected to OpenAI realtime API');
                    resolve();
                });

                this.ws.on('message', (data: WebSocket.Data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        options.onMessage?.(message);
                    } catch (err) {
                        console.error('Error parsing message:', err);
                        options.onError?.(new Error('Error parsing message from server'));
                    }
                });

                this.ws.on('error', (error) => {
                    console.error('WebSocket error:', error);
                    options.onError?.(error);
                    reject(error);
                });

                this.ws.on('close', (code, reason) => {
                    this.isConnected = false;
                    console.log(`Connection closed: ${code} - ${reason}`);
                    options.onError?.(new Error(`Connection closed: ${reason}`));
                });
            });
        } catch (error) {
            console.error('Error connecting to OpenAI realtime API:', error);
            throw error;
        }
    }

    /**
     * Send an audio chunk to the API
     * @param audioData Binary audio data
     */
    public sendAudio(audioData: Uint8Array): { eventId: string } {
        if (!this.isConnected || !this.ws) {
            throw new Error('Not connected to OpenAI realtime API');
        }

        // Convert binary audio data to Base64
        const base64Audio = Buffer.from(audioData).toString('base64');

        const eventId = crypto.randomUUID();

        const message = {
            event_id: eventId,
            type: "input_audio_buffer.append",
            audio: base64Audio
        };

        this.ws.send(JSON.stringify(message));

        return { eventId };
    }

    /**
     * Commit the audio buffer to the API
     * @returns The event ID for the commit request
     */
    public commitAudio(): { eventId: string } {
        if (!this.isConnected || !this.ws) {
            throw new Error('Not connected to OpenAI realtime API');
        }
        
        const eventId = crypto.randomUUID();

        this.ws.send(JSON.stringify({
            event_id: eventId,
            type: "input_audio_buffer.commit"
        }));

        return { eventId };
    }

    /**
     * Disconnect from the OpenAI realtime API
     */
    public disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
        }
    }

    /**
     * Update session parameters
     * @param session Session configuration to update
     * @returns The event ID for the update request
     */
    public updateSession(session: {
        modalities?: string[];
        instructions?: string;
        voice?: string;
        input_audio_format?: "pcm16" | "g711_ulaw" | "g711_alaw";
        output_audio_format?: "pcm16" | "g711_ulaw" | "g711_alaw";
        input_audio_transcription?: {
            model: 'whisper-1';
        };
        turn_detection?: {
            type: string;
            threshold?: number;
            prefix_padding_ms?: number;
            silence_duration_ms?: number;
            create_response?: boolean;
        };
        tools?: Array<{
            type: string;
            name: string;
            description: string;
            parameters: object;
        }>;
        tool_choice?: string;
        temperature?: number;
        max_response_output_tokens?: string | number;
        [key: string]: any;
    }): { eventId: string } {
        if (!this.isConnected || !this.ws) {
            throw new Error('Not connected to OpenAI realtime API');
        }

        const eventId = crypto.randomUUID();

        const message = {
            event_id: eventId,
            type: "session.update",
            session
        };

        this.ws.send(JSON.stringify(message));
        
        return { eventId };
    }
}

/**
 * Example usage:
 * 
 * // Create a client
 * const client = new OpenAIRealtime({
 *   apiKey: process.env.OPENAI_API_KEY
 * });
 * 
 * // Connect to the API
 * await client.connect({
 *   parameters: {
 *     model: 'gpt-4o-mini',
 *   },
 *   onMessage: (message) => {
 *     console.log('Message received:', message);
 *   },
 *   onError: (error) => {
 *     console.error('Error:', error);
 *   }
 * });
 * 
 * // Send audio data
 * client.sendAudio(audioChunk);
 * 
 * // Disconnect when done
 * client.disconnect();
 */
