import { ElevenLabsClient } from 'elevenlabs';

export interface ElevenLabsTtsError extends Error {
  code:
    | 'missing_api_key'
    | 'missing_text'
    | 'request_failed'
    | 'invalid_response'
    | 'http_error';
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

export const synthesizeSpeech = async (
  text: string,
  options: SynthesizeSpeechOptions = {}
): Promise<ArrayBuffer> => { // Explicitly return Promise<ArrayBuffer>
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

  const client = new ElevenLabsClient({ apiKey });
  const voiceId = options.voiceId || process.env.ELEVEN_LABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = options.modelId || DEFAULT_MODEL_ID;

  try {
    const audioStream = await client.textToSpeech.convert(voiceId, {
      text: trimmed,
      model_id: modelId,
      output_format: 'mp3_44100_128',
    });

    const chunks: Uint8Array[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const content = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      content.set(chunk, offset);
      offset += chunk.length;
    }

    if (content.byteLength === 0) {
      throw createElevenLabsError(
        'ElevenLabs returned an empty audio response.',
        'invalid_response'
      );
    }

    return content.buffer;

  } catch (error) {
    if ((error as any).statusCode) {
       throw createElevenLabsError(
        `ElevenLabs TTS failed: ${(error as any).body?.message || (error as any).message}`,
        'http_error',
        {
            status: (error as any).statusCode,
            details: (error as any).body ? JSON.stringify((error as any).body) : undefined
        }
       );
    }
    throw createElevenLabsError(
      `ElevenLabs request failed: ${error instanceof Error ? error.message : 'Unknown network error'}`,
      'request_failed'
    );
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
