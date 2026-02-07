
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisFeedback, FrameData, WorkoutRoutine } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as AnalysisFeedback;
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

  const result = JSON.parse(response.text || '{}');
  return {
    routine: {
      ...result.routine,
      id: crypto.randomUUID(),
      exercises: result.routine.exercises.map((e: any) => ({ ...e, id: crypto.randomUUID(), sets: [] }))
    },
    reasoning: result.reasoning
  };
};
