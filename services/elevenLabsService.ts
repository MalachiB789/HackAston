import { ElevenLabsClient } from 'elevenlabs';

export interface ElevenLabsTtsError extends Error {
  code:
    | 'missing_api_key'
    | 'missing_text'
    | 'request_failed'
    | 'invalid_response'
    | 'http_error'
    | 'network_error'
    | 'api_error';
  status?: number;
  statusText?: string;
  requestId?: string;
  providerMessage?: string;
  details?: string;
}

interface SynthesizeSpeechOptions {
  voiceId?: string;
  modelId?: string;
}

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
const DEFAULT_MODEL_ID = 'eleven_turbo_v2_5';

const createElevenLabsError = (
  message: string,
  code: ElevenLabsTtsError['code'],
  extras: Partial<Pick<ElevenLabsTtsError, 'status' | 'statusText' | 'requestId' | 'providerMessage' | 'details'>> = {}
): ElevenLabsTtsError => {
  const err = new Error(message) as ElevenLabsTtsError;
  err.name = 'ElevenLabsTtsError';
  err.code = code;
  err.status = extras.status;
  err.statusText = extras.statusText;
  err.requestId = extras.requestId;
  err.providerMessage = extras.providerMessage;
  err.details = extras.details;
  return err;
};

import WebSocket from 'ws';

export const synthesizeSpeech = async function* (
  textStream: AsyncIterable<string>,
  options: SynthesizeSpeechOptions = {}
): AsyncGenerator<Buffer> {
  const apiKey = process.env.ELEVEN_LABS_API_KEY;
  if (!apiKey) {
    throw createElevenLabsError(
      'ElevenLabs API key is missing. Set VITE_ELEVEN_LABS_API_KEY.',
      'missing_api_key'
    );
  }

  const voiceId = options.voiceId || process.env.ELEVEN_LABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = options.modelId || DEFAULT_MODEL_ID;
  const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${modelId}`;

  const ws = new WebSocket(wsUrl);

  // Promise to wait for the connection to open
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve());
    ws.on('error', (err) => reject(createElevenLabsError(`WebSocket connection failed: ${err.message}`, 'network_error')));
  });

  // Send BOS message with API key and voice settings
  const bosMessage = {
    text: " ",
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.8
    },
    xi_api_key: apiKey,
  };
  ws.send(JSON.stringify(bosMessage));

  // Queue to store incoming audio chunks
  const audioQueue: Buffer[] = [];
  let error: Error | null = null;
  let isClosed = false;
  let resolveReadable: (() => void) | null = null;

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.audio) {
        const chunk = Buffer.from(message.audio, 'base64');
        audioQueue.push(chunk);
        if (resolveReadable) {
          resolveReadable();
          resolveReadable = null;
        }
      }
      if (message.isFinal) {
        // Handle final message if needed, but usually we just wait for the stream to close or EOS
      }
      if (message.error) {
        error = createElevenLabsError(`ElevenLabs WebSocket error: ${message.error}`, 'api_error');
        if (resolveReadable) resolveReadable();
      }
    } catch (err) {
      error = createElevenLabsError('Failed to parse incoming WebSocket message', 'invalid_response');
      if (resolveReadable) resolveReadable();
    }
  });

  ws.on('close', () => {
    isClosed = true;
    if (resolveReadable) resolveReadable();
  });

  ws.on('error', (err) => {
    error = createElevenLabsError(`WebSocket error: ${err.message}`, 'network_error');
    if (resolveReadable) resolveReadable();
  });

  // Start sending text chunks in the background
  (async () => {
    try {
      for await (const chunk of textStream) {
        if (isClosed || error) break;
        ws.send(JSON.stringify({ text: chunk, try_trigger_generation: true }));
      }
      if (!isClosed && !error) {
        ws.send(JSON.stringify({ text: "" })); // EOS message
      }
    } catch (err) {
      // If the input stream fails, we should close the socket
      ws.close();
      error = createElevenLabsError(`Input text stream error: ${err instanceof Error ? err.message : String(err)}`, 'request_failed');
    }
  })();

  // Yield audio chunks as they arrive
  while (true) {
    if (audioQueue.length > 0) {
      yield audioQueue.shift()!;
      continue;
    }

    if (error) {
      throw error;
    }

    if (isClosed) {
      break;
    }

    // Wait for the next chunk or event
    await new Promise<void>((resolve) => {
      resolveReadable = resolve;
    });
  }
};

export const formatElevenLabsErrorForUi = (error: unknown): string => {
  if (!error || typeof error !== 'object' || (error as any).name !== 'ElevenLabsTtsError') {
    const fallback = error instanceof Error ? error.message : 'Unknown ElevenLabs error.';
    return `ElevenLabs TTS failed. Detail: ${fallback}. Using Gemini voice fallback.`;
  }

  const typedError = error as ElevenLabsTtsError;
  const statusPart = typedError.status
    ? ` (${typedError.status}${typedError.statusText ? ` ${typedError.statusText}` : ''})`
    : '';
  const requestIdPart = typedError.requestId ? ` Request ID: ${typedError.requestId}.` : '';
  const detail = typedError.providerMessage || typedError.details || typedError.message;

  return `ElevenLabs TTS failed${statusPart}.${requestIdPart} Detail: ${detail}. Using Gemini voice fallback.`;
};
