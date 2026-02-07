
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
): Promise<{ routines: WorkoutRoutine[]; reasoning: string; splitName: string }> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are a world-class elite personal trainer. 
    Review the user's workout history: ${JSON.stringify(history)}.
    The user's current goal is: "${goal}".
    
    Build a full gym split with 3-6 days (example: Push / Pull / Legs, or Upper/Lower, or goal-specific split).
    Each day should contain 4-7 exercises.
    If they have poor form scores in history, suggest variations that improve technique.
    If they are strong, suggest higher-intensity compound movements.
    
    Output ONLY a JSON object with 3 fields:
    1. "splitName": Name of split (e.g., "Push Pull Legs", "Upper Lower").
    2. "days": Array of day objects with:
       - "name": day title (e.g., "Push Day")
       - "exercises": array of objects with { "type": string }
    3. "reasoning": short paragraph explaining why this split fits the goal/history.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          splitName: { type: Type.STRING },
          days: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                exercises: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING }
                    },
                    required: ["type"]
                  }
                }
              },
              required: ["name", "exercises"]
            }
          },
          reasoning: { type: Type.STRING }
        },
        required: ["splitName", "days", "reasoning"]
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

  if (!result || !Array.isArray(result.days) || result.days.length === 0) {
    console.error('suggestWorkout result missing days:', result);
    throw new Error('Invalid split format received from AI');
  }

  const splitGroupId = crypto.randomUUID();
  const splitName = typeof result.splitName === 'string' && result.splitName.trim()
    ? result.splitName.trim()
    : 'AI Split';

  const routines: WorkoutRoutine[] = result.days
    .filter((day: any) => day && Array.isArray(day.exercises) && day.exercises.length > 0)
    .map((day: any, index: number) => ({
      id: crypto.randomUUID(),
      name: String(day.name || `Day ${index + 1}`),
      splitGroupId,
      splitName,
      dayIndex: index,
      generatedByAI: true,
      exercises: day.exercises.map((e: any) => ({
        id: crypto.randomUUID(),
        type: String(e?.type || 'Exercise'),
        sets: []
      }))
    }));

  if (routines.length === 0) {
    throw new Error('AI split contained no valid training days.');
  }

  return {
    routines,
    splitName,
    reasoning: String(result.reasoning || 'Structured for your goal and training history.')
  };
};
