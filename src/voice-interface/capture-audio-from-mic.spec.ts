import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { AudioRecorder, AudioRecorderConfig, CaptureCallbackData } from './capture-audio-from-mic';

// Set longer timeout for audio capture tests
vi.setConfig({ testTimeout: 15000 });

describe('Audio Capture Integration Test', () => {
  // Ensure the output directory exists
  const outputDir = path.join(__dirname);

  // Clean up any previous test files
  beforeAll(() => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Remove any previous test files
    fs.readdirSync(outputDir).forEach(file => {
      if (file.startsWith('test-audio-chunk-')) {
        fs.unlinkSync(path.join(outputDir, file));
      }
    });
  });

  it('should capture chunks of audio over 12 seconds', async () => {
    const capturedChunks: Buffer[] = [];

    // Create an audio recorder with 5-second chunks and 1-second overlap
    const config: AudioRecorderConfig = {
      onCapture: (data: CaptureCallbackData) => {
        // Save the buffer to our array
        capturedChunks.push(data.buffer);

        // Save the buffer to a file
        const filename = path.join(outputDir, `test-audio-chunk-${capturedChunks.length}.wav`);
        fs.writeFileSync(filename, data.buffer);
        console.log(`Saved audio chunk ${capturedChunks.length} to ${filename}`);
      },
      chunkLengthSeconds: 5, // Explicitly set chunk length
      overlapSeconds: 1      // Explicitly set overlap
    };

    const recorder = new AudioRecorder(config);

    // Start recording
    recorder.init();

    // Set a safety timeout to stop the test if we don't get enough chunks
    await new Promise(resolve => setTimeout(resolve, 12000));
    recorder.stop();

    expect(capturedChunks.length).toBeGreaterThan(0);
  }, { timeout: 30000 });
});
