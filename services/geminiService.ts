
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisFeedback, FrameData, WorkoutRoutine } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const extractJsonFromText = (input: string): string => {
  const trimmed = input.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    const fenced = fencedMatch[1].trim();
    if (fenced.startsWith('{') && fenced.endsWith('}')) return fenced;
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
};

const getResponseText = (response: any): string | undefined => {
  if (!response) return undefined;
  if (typeof response === 'string') return response;
  if (typeof response?.text === 'string' && response.text.trim()) return response.text;
  if (typeof response?.outputText === 'string' && response.outputText.trim()) return response.outputText;

  const candidateText =
    response?.candidates?.[0]?.content?.parts
      ?.map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join(' ')
      .trim();
  if (candidateText) return candidateText;

  if (Array.isArray(response) && response.length > 0) {
    for (const item of response) {
      const nested = getResponseText(item);
      if (nested) return nested;
    }
  }

  return undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => (typeof item === 'string' ? item : item == null ? '' : String(item)))
    .map(item => item.trim())
    .filter(Boolean);
};

const normalizeAnalysisFeedback = (parsed: any, selectedExercise: string): AnalysisFeedback => {
  const scoreCandidate = Number(parsed?.score ?? parsed?.formScore ?? 0);
  const boundedScore = Number.isFinite(scoreCandidate)
    ? Math.max(0, Math.min(100, Math.round(scoreCandidate)))
    : 0;

  return {
    exerciseName: String(parsed?.exerciseName ?? parsed?.exercise ?? selectedExercise),
    score: boundedScore,
    pros: toStringArray(parsed?.pros ?? parsed?.strengths),
    cons: toStringArray(parsed?.cons ?? parsed?.issues ?? parsed?.improvements),
    suggestions: toStringArray(parsed?.suggestions ?? parsed?.recommendations),
    safetyWarnings: toStringArray(parsed?.safetyWarnings ?? parsed?.safety),
    overallSummary: String(parsed?.overallSummary ?? parsed?.summary ?? 'No summary provided.'),
  };
};

export const analyzeForm = async (
  frames: FrameData[],
  selectedExercise: string
): Promise<AnalysisFeedback> => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: `You are an expert biomechanics specialist and world-class powerlifting coach. 
            Analyze this sequence of ${frames.length} frames showing a ${selectedExercise}. 
            Identify the user's form errors, range of motion, and safety concerns.
            Provide detailed, constructive feedback in a structured JSON format.
            The score should be from 0 to 100.`
          },
          ...frames.map(frame => ({
            inlineData: {
              mimeType: "image/jpeg",
              data: frame.dataUrl.split(",")[1]
            }
          }))
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          exerciseName: { type: Type.STRING },
          score: { type: Type.NUMBER },
          pros: { type: Type.ARRAY, items: { type: Type.STRING } },
          cons: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          safetyWarnings: { type: Type.ARRAY, items: { type: Type.STRING } },
          overallSummary: { type: Type.STRING }
        },
        required: ["exerciseName", "score", "pros", "cons", "suggestions", "safetyWarnings", "overallSummary"]
      }
    }
  });

  const response = await model;

  let text: string | undefined = getResponseText(response);
  if (!text && response && typeof response === 'object' && (response as any).parsed) {
    text = JSON.stringify((response as any).parsed);
  }

  if (!text) {
    console.error('AI response had no text field. Full response:', response);
    throw new Error('No textual response from AI (response shape unexpected).');
  }

  // Try parsing JSON with helpful errors
  let parsed: any;
  try {
    parsed = JSON.parse(extractJsonFromText(text));
  } catch (err) {
    console.error('Failed to parse AI response as JSON. Raw text:', text.slice(0, 1000));
    throw new Error('AI returned non-JSON or malformed JSON. See console for raw output.');
  }

  if (!parsed || typeof parsed !== 'object') {
    console.error('Parsed AI response is not an object:', parsed);
    throw new Error('AI analysis payload is invalid.');
  }

  return normalizeAnalysisFeedback(parsed, selectedExercise);
};

export const suggestWorkout = async (
  goal: string,
  history: WorkoutRoutine[]
): Promise<{ routine: WorkoutRoutine; reasoning: string }> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are a world-class elite personal trainer. 
    Review the user's workout history: ${JSON.stringify(history)}.
    The user's current goal is: "${goal}".
    
    Suggest a custom workout routine of 4-6 exercises. 
    If they have poor form scores in history, suggest variations that improve technique.
    If they are strong, suggest high-intensity movements.
    
    Output ONLY a JSON object with two fields:
    1. "routine": A WorkoutRoutine object (id should be empty, exercises with empty sets).
    2. "reasoning": A short paragraph explaining why this routine fits their goal and history.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          routine: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              exercises: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING }
                  }
                }
              }
            },
            required: ["name", "exercises"]
          },
          reasoning: { type: Type.STRING }
        },
        required: ["routine", "reasoning"]
      }
    }
  });

  let text: string | undefined = getResponseText(response);
  if (!text && response && typeof response === 'object' && (response as any).parsed) {
    text = JSON.stringify((response as any).parsed);
  }

  if (!text) {
    console.error('Unexpected suggestWorkout response shape:', response);
    throw new Error('No textual response from AI for suggestWorkout');
  }

  let result: any;
  try {
    result = JSON.parse(extractJsonFromText(text || '{}'));
  } catch (err) {
    console.error('Failed to parse suggestWorkout response JSON:', text.slice(0, 1000));
    throw new Error('AI returned malformed JSON for suggestWorkout');
  }

  if (!result || !result.routine || !Array.isArray(result.routine.exercises)) {
    console.error('suggestWorkout result missing routine/exercises:', result);
    throw new Error('Invalid routine format received from AI');
  }

  return {
    routine: {
      ...result.routine,
      id: crypto.randomUUID(),
      exercises: result.routine.exercises.map((e: any) => ({ ...e, id: crypto.randomUUID(), sets: [] }))
    },
    reasoning: result.reasoning
  };
};
