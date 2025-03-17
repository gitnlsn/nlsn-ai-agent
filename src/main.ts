import { OpenAIVoice } from '@mastra/voice-openai';
 
// Initialize with default configuration using environment variables
const voice = new OpenAIVoice();
 
// Or initialize with specific configuration
const voiceWithConfig = new OpenAIVoice({
  speechModel: {
    name: 'tts-1-hd',
    apiKey: 'your-openai-api-key'
  },
  listeningModel: {
    name: 'whisper-1',
    apiKey: 'your-openai-api-key'
  },
  speaker: 'alloy'  // Default voice
});
 

// Convert text to speech
const audioStream = await voice.speak('Hello, how can I help you?', {
  speaker: 'nova',  // Override default voice
  speed: 1.2  // Adjust speech speed
});
 
// Convert speech to text
const text = await voice.listen(audioStream, {
  filetype: 'mp3'
});