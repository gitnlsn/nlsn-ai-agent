const recorder = require('node-record-lpcm16');

/**
 * Data structure for onCapture callback 
 */
export interface CaptureCallbackData {
  buffer: Buffer;
  recorder: AudioRecorder;
}

/**
 * Configuration interface for AudioRecorder
 */
export interface AudioRecorderConfig {
  onCapture: (data: CaptureCallbackData) => void;
  chunkLengthSeconds?: number;
  overlapSeconds?: number;
  sampleRate?: number;
  channels?: number;
}

/**
 * Options for a single recording session 
 */
interface RecordingOptions {
  sampleRate: number;
  channels: number;
}

/**
 * Configuration for RecordingSession
 */
interface RecordingSessionConfig {
  durationMs: number;
  onComplete: (buffer: Buffer) => void;
  options: RecordingOptions;
}

/**
 * Handles a single recording session with duration control
 */
class RecordingSession {
  private recorder: any;
  private chunks: Buffer[] = [];
  private isActive: boolean = false;
  private durationTimeout: NodeJS.Timeout | null = null;
  private durationMs: number;
  private onComplete: (buffer: Buffer) => void;
  private options: RecordingOptions;
  
  /**
   * Create a new recording session
   * @param config Configuration object containing duration, callback and options
   */
  constructor(config: RecordingSessionConfig) {
    this.durationMs = config.durationMs;
    this.onComplete = config.onComplete;
    this.options = config.options;
  }
  
  /**
   * Start the recording session
   */
  start(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    this.chunks = [];
    
    // Create recorder instance
    this.recorder = recorder.record({
      sampleRate: this.options.sampleRate,
      channels: this.options.channels,
      audioType: 'wav',
      recorder: 'sox',
    });
    
    // Collect data chunks
    this.recorder.stream().on('data', (chunk: Buffer) => {
      if (this.isActive) {
        this.chunks.push(chunk);
      }
    });
    
    // Set timeout to stop recording after specified duration
    this.durationTimeout = setTimeout(() => {
      this.stop();
    }, this.durationMs);
  }
  
  /**
   * Stop the recording session and return buffer via callback
   */
  stop(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Clear duration timeout if it exists
    if (this.durationTimeout) {
      clearTimeout(this.durationTimeout);
      this.durationTimeout = null;
    }
    
    // Stop the recorder
    this.recorder.stop();
    
    // Combine chunks and deliver buffer via callback
    const buffer = Buffer.concat(this.chunks);
    this.onComplete(buffer);
  }
}

/**
 * AudioRecorder class that captures audio in chunks with overlap
 * Uses separate RecordingSession instances to manage recordings
 */
export class AudioRecorder {
  private activeSessions: Set<RecordingSession> = new Set();
  private isRecording: boolean = false;
  private captureInterval: NodeJS.Timeout | null = null;
  private onCaptureCallback: (data: CaptureCallbackData) => void;
  private chunkLengthSeconds: number;
  private overlapSeconds: number;
  private captureIntervalMs: number;
  private sampleRate: number;
  private channels: number;

  /**
   * Create a new AudioRecorder
   * @param config Configuration options including callback and timing settings
   */
  constructor(config: AudioRecorderConfig) {
    this.onCaptureCallback = config.onCapture;
    this.chunkLengthSeconds = config.chunkLengthSeconds || 5; // Default: 5 seconds
    this.overlapSeconds = config.overlapSeconds || 1; // Default: 1 second overlap
    this.sampleRate = config.sampleRate || 16000; // Default: 16kHz
    this.channels = config.channels || 2; // Default: 2 channels
    
    // Calculate capture interval (chunk length minus overlap)
    this.captureIntervalMs = (this.chunkLengthSeconds - this.overlapSeconds) * 1000;
  }

  /**
   * Initialize and start recording
   * Will capture audio in chunks with configured overlap
   */
  init(): void {
    if (this.isRecording) return;

    this.isRecording = true;
    
    // Start the first recording session
    this.startNewRecordingSession();
    
    // Set up interval for starting new recording sessions
    this.captureInterval = setInterval(() => {
      if (this.isRecording) {
        this.startNewRecordingSession();
      }
    }, this.captureIntervalMs);

    console.log(`Audio recording started with ${this.chunkLengthSeconds}-second chunks and ${this.overlapSeconds}-second overlap`);
  }

  /**
   * Stop recording and clean up resources
   */
  stop(): void {
    if (!this.isRecording) return;
    
    this.isRecording = false;
    
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    
    // Stop all active recording sessions
    for (const session of this.activeSessions) {
      session.stop();
    }
    
    this.activeSessions.clear();
    
    console.log('Audio recording stopped');
  }

  /**
   * Start a new recording session
   */
  private startNewRecordingSession(): void {
    const options: RecordingOptions = {
      sampleRate: this.sampleRate,
      channels: this.channels
    };
    
    // Create recording session with configuration object
    const session = new RecordingSession({
      durationMs: this.chunkLengthSeconds * 1000, // Convert to milliseconds
      onComplete: (buffer: Buffer) => {
        // Remove this session from active sessions
        this.activeSessions.delete(session);
        
        // Forward buffer to the main callback with this AudioRecorder instance
        this.onCaptureCallback({
          buffer: buffer,
          recorder: this
        });
        
        console.log(`Captured audio chunk of ${buffer.length} bytes (${this.chunkLengthSeconds} seconds)`);
      },
      options: options
    });
    
    // Track this session
    this.activeSessions.add(session);
    
    // Start the session
    session.start();
  }
} 