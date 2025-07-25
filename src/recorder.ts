

/**
 * Interface representing an Audio Recorder.
 *
 * @interface Recorder
 */
export interface Recorder {

    /**
     * Start recording audio.
     */
    start(): Promise<void>;

    /**
     * Stop recording audio.
     */
    stop(): Promise<void>;

    /**
     * Callback when new audio data is available.
     * @param data Audio samples format: 16-bit PCM, 16000 Hz.
     */
    onData?: (data: Int16Array) => void;
    
    /**
     * Callback when an error occurs. The `onStopped` will be also called later.
     * @param err Error object.
     */
    onError?: (err: Error) => void;

    /**
     * Callback when the recorder is stopped. It is always called either after `stop` or when an error occurs.
     */
    onStopped?: () => void;
};

