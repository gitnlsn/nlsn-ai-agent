import fs from 'fs';
import path from 'path';
import { detectSilence } from './detect-silence';
import { describe, it, expect, beforeAll } from 'vitest';

describe('detectSilence integration tests', () => {
  const testFilesDir = path.join(__dirname, '.');
  
  it('should detect "hello-there.wav" as NOT silent', async () => {
    // Arrange
    const filePath = path.join(testFilesDir, 'hello-there.wav');
    const buffer = fs.readFileSync(filePath);
    
    // Act
    const result = detectSilence(buffer);
    
    // Assert
    expect(result.isSilent).toBe(false);
    // Log the RMS value for debugging purposes
    console.log(`"hello-there.wav" RMS value: ${result.rmsValue}`);
  });

  it('should detect "hello-there-low.wav" as silent', async () => {
    // Arrange
    const filePath = path.join(testFilesDir, 'hello-there-low.wav');
    const buffer = fs.readFileSync(filePath);
    
    // Act
    const result = detectSilence(buffer);
    
    // Assert
    expect(result.isSilent).toBe(true);
    // Log the RMS value for debugging purposes
    console.log(`"hello-there-low.wav" RMS value: ${result.rmsValue}`);
  });
});
