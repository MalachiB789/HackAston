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

const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const parseWsPayload = async (data: string | Blob | ArrayBuffer | ArrayBufferView): Promise<any> => {
  if (typeof data === 'string') return JSON.parse(data);
  if (data instanceof Blob) return JSON.parse(await data.text());
  if (data instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(data));
  return JSON.parse(new TextDecoder().decode(data.buffer));
};

export const synthesizeSpeech = async function* (
  text: string,
  options: SynthesizeSpeechOptions = {}
): AsyncGenerator<Uint8Array> {
  const apiKey = process.env.ELEVEN_LABS_API_KEY;
  if (!apiKey) {
    throw createElevenLabsError(
      'ElevenLabs API key is missing. Set VITE_ELEVEN_LABS_API_KEY.',
      'missing_api_key'
    );
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw createElevenLabsError('Cannot synthesize empty text.', 'missing_text');
  }

  const voiceId = options.voiceId || process.env.ELEVEN_LABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = options.modelId || DEFAULT_MODEL_ID;
  const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${encodeURIComponent(
    modelId
  )}&output_format=mp3_44100_128`;

  const ws = new WebSocket(wsUrl);

  const queue: Uint8Array[] = [];
  let error: ElevenLabsTtsError | null = null;
  let isDone = false;
  let wakeup: (() => void) | null = null;

  const notify = () => {
    if (wakeup) {
      wakeup();
      wakeup = null;
    }
  };

  const opened = new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(createElevenLabsError('WebSocket connection failed.', 'network_error'));
  });

  ws.onmessage = (event: MessageEvent) => {
    (async () => {
      try {
        const message = await parseWsPayload(event.data as any);

        if (message.audio) {
          queue.push(base64ToBytes(message.audio));
          notify();
        }

        if (message.error) {
          error = createElevenLabsError(
            `ElevenLabs WebSocket error: ${message.error?.message || message.error}`,
            'api_error',
            {
              requestId: message.request_id,
              details: typeof message.error === 'string' ? message.error : JSON.stringify(message.error),
            }
          );
          notify();
        }

        if (message.isFinal) {
          isDone = true;
          ws.close();
          notify();
        }
      } catch {
        error = createElevenLabsError('Failed to parse incoming WebSocket payload.', 'invalid_response');
        notify();
      }
    })();
  };

  ws.onclose = () => {
    isDone = true;
    notify();
  };

  try {
    await opened;
  } catch (err) {
    throw (err instanceof Error
      ? err
      : createElevenLabsError('WebSocket connection failed.', 'network_error'));
  }

  ws.send(
    JSON.stringify({
      text: ' ',
      xi_api_key: apiKey,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
      },
    })
  );

  ws.send(JSON.stringify({ text: trimmed, try_trigger_generation: true }));
  ws.send(JSON.stringify({ text: '' }));

  while (true) {
    if (queue.length > 0) {
      yield queue.shift()!;
      continue;
    }
    if (error) throw error;
    if (isDone) break;
    await new Promise<void>(resolve => {
      wakeup = resolve;
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
