/**
 * Utility functions for detecting silence in audio buffers
 */

interface SilenceDetectionOptions {
  /**
   * Threshold below which audio is considered silence
   * Values typically between 0.01 and 0.05
   */
  threshold?: number;
}

interface SilenceDetectionResult {
  /**
   * Whether silence was detected in the buffer
   */
  isSilent: boolean;
  
  /**
   * The calculated RMS value of the buffer
   */
  rmsValue: number;
}

/**
 * Detects silence in a PCM 16-bit audio buffer by calculating the RMS value
 * 
 * @param buffer - Audio buffer containing PCM 16-bit data
 * @param options - Optional configuration for silence detection
 * @returns Object containing silence detection result and RMS value
 */
export function detectSilence(
  buffer: Buffer,
  options: SilenceDetectionOptions = {}
): SilenceDetectionResult {
  const threshold = options.threshold ?? 0.02;
  
  let sumOfSquares = 0;

  // Process each sample (2 bytes per sample for PCM 16-bit)
  for (let i = 0; i < buffer.length; i += 2) {
    // PCM 16-bit is represented by 2 bytes per sample
    const sample = buffer.readInt16LE(i);
    // Normalize the sample to a value between -1 and 1
    const normalizedSample = sample / 32768.0;
    sumOfSquares += normalizedSample * normalizedSample;
  }

  // Calculate RMS (Root Mean Square)
  const rms = Math.sqrt(sumOfSquares / (buffer.length / 2));
  
  return {
    isSilent: rms < threshold,
    rmsValue: rms
  };
}
