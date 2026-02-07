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
const ELEVEN_LABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

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

const parseProviderMessage = async (response: Response): Promise<string> => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null);
    const detail = payload?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d: any) => d?.msg || d?.message || JSON.stringify(d))
        .filter(Boolean)
        .join('; ');
    }
    if (detail?.message) return String(detail.message);
    if (payload?.message) return String(payload.message);
    if (payload?.error) return String(payload.error);
    return JSON.stringify(payload).slice(0, 400);
  }

  const text = await response.text().catch(() => '');
  return text.slice(0, 400);
};

export const synthesizeSpeech = async (
  text: string,
  options: SynthesizeSpeechOptions = {}
): Promise<ArrayBuffer> => {
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
  const url = `${ELEVEN_LABS_URL}/${voiceId}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: trimmed,
        model_id: modelId,
      }),
    });
  } catch (error) {
    throw createElevenLabsError(
      `ElevenLabs request failed: ${error instanceof Error ? error.message : 'Unknown network error'}`,
      'request_failed'
    );
  }

  if (!response.ok) {
    const requestId = response.headers.get('x-request-id') || response.headers.get('request-id') || undefined;
    const providerMessage = await parseProviderMessage(response);
    throw createElevenLabsError(
      `ElevenLabs TTS failed (${response.status} ${response.statusText}).`,
      'http_error',
      {
        status: response.status,
        statusText: response.statusText,
        requestId,
        providerMessage,
        details: providerMessage,
      }
    );
  }

  const audioBuffer = await response.arrayBuffer();
  if (!audioBuffer || audioBuffer.byteLength === 0) {
    throw createElevenLabsError(
      'ElevenLabs returned an empty audio response.',
      'invalid_response'
    );
  }

  return audioBuffer;
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
