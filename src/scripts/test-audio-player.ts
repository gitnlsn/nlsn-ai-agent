import * as fs from 'fs';
import * as path from 'path';
import { AudioPlayer } from '../voice-interface/play-readablestream-audio';

// Function to test the AudioPlayer
async function testAudioPlayer() {
  try {
    console.log('Starting audio player test...');

    // Import the MP3 file and convert it to a NodeJS.ReadableStream
    const audioFilePath = path.resolve(__dirname, '../voice-interface/response-output.mp3');
    console.log(`Reading file from: ${audioFilePath}`);

    // Create a readable stream from the MP3 file
    const audioStream = fs.createReadStream(audioFilePath);

    // Create an instance of the AudioPlayer with the stream
    const player = new AudioPlayer(audioStream);

    console.log('Playing audio...');

    // Play the audio and wait for it to complete
    await player.play();

    console.log('Audio playback complete!');
  } catch (error) {
    console.error('Error during audio playback:', error);
  }
}

// Run the test
testAudioPlayer().then(() => {
  console.log('Test completed');
}).catch(err => {
  console.error('Test failed:', err);
}); 