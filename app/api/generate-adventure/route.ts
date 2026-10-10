import { z } from "zod";

const RequestSchema = z.object({
  activity: z.enum([
    "nature-walk",
    "walking",
    "running",
    "explore",
    "mindfulness",
  ]),
  duration: z.union([
    z.literal(20),
    z.literal(30),
    z.literal(45),
    z.literal(60),
  ]),
  mood: z.enum(["relax", "explore", "challenge"]),
});

const AdventureSchema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().min(10).max(240),
  difficulty: z.enum(["easy", "medium", "hard"]),
  missions: z
    .array(
      z.object({
        title: z.string().min(2).max(70),
        description: z.string().min(10).max(220),
      })
    )
    .min(3)
    .max(6),
});

const GroqResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
        }),
      })
    )
    .min(1),
});

type RequestInput = z.infer<typeof RequestSchema>;

const activityNames: Record<RequestInput["activity"], string> = {
  "nature-walk": "nature walk",
  walking: "walking",
  running: "running",
  explore: "outdoor exploration",
  mindfulness: "outdoor mindfulness",
};

const moodNames: Record<RequestInput["mood"], string> = {
  relax: "relaxing and peaceful",
  explore: "curious and discovery-focused",
  challenge: "challenging but safe",
};

const missionCountByDuration: Record<number, number> = {
  20: 3,
  30: 4,
  45: 5,
  60: 6,
};

// Strict Structured Outputs makes Groq generate JSON that conforms to this shape.
// We enforce character limits and the duration-specific mission count with Zod below.
const GroqAdventureJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    difficulty: {
      type: "string",
      enum: ["easy", "medium", "hard"],
    },
    missions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["title", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "description", "difficulty", "missions"],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return Response.json(
      { error: "Please submit valid JSON." },
      { status: 400 }
    );
  }

  const input = RequestSchema.safeParse(requestBody);

  if (!input.success) {
    return Response.json(
      { error: "Choose a valid activity, duration, and mood." },
      { status: 400 }
    );
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "Groq API key is not configured." },
      { status: 500 }
    );
  }

  const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";
  const { activity, duration, mood } = input.data;
  const expectedMissionCount = missionCountByDuration[duration];

  let aiResponse: Response;

  try {
    aiResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_completion_tokens: 3000,
          // GPT-OSS supports hidden reasoning output with structured JSON.
          reasoning_format: "hidden",
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "trailmate_adventure",
              strict: true,
              schema: GroqAdventureJsonSchema,
            },
          },
          messages: [
            {
              role: "user",
              content: `
Create one practical outdoor adventure for TrailMate AI.

User preferences:
- Activity: ${activityNames[activity]} (${activity})
- Total duration: ${duration} minutes
- Mood: ${moodNames[mood]} (${mood})
- Required mission count: exactly ${expectedMissionCount}

Content requirements:
- Return an adventure title, a helpful description, a difficulty, and missions.
- Difficulty must be easy, medium, or hard.
- Create exactly ${expectedMissionCount} missions, in a logical order.
- Each mission needs a concise title and actionable description.
- Mission titles must be 2–70 characters.
- Mission descriptions must be 10–220 characters.
- Adventure title must be 3–80 characters.
- Adventure description must be 10–240 characters.
- Keep the activity appropriate to the selected mood and total time.
- Prioritize common-sense outdoor safety. Do not suggest trespassing, entering dangerous areas, or interacting with wildlife.
- Return only the JSON object defined by the response schema. Do not add extra fields, markdown, or commentary.
              `.trim(),
            },
          ],
        }),
      }
    );
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    console.error("Groq connection failed:", error);

    return Response.json(
      {
        error: timedOut
          ? "AI request timed out. Please try again."
          : "Could not connect to the AI service.",
      },
      { status: timedOut ? 504 : 503 }
    );
  }

  if (!aiResponse.ok) {
    const errorBody = await aiResponse.text();
    console.error("Groq request failed:", {
      status: aiResponse.status,
      model,
      body: errorBody,
    });

    let details: unknown = errorBody;

    try {
      const parsed = JSON.parse(errorBody);
      details = {
        message: parsed.error?.message ?? "Groq request failed.",
        code: parsed.error?.code,
        failed_generation: parsed.error?.failed_generation,
      };
    } catch {
      // Keep the raw response if Groq didn't return JSON.
    }

    return Response.json(
      {
        error: "The AI service could not generate an adventure.",
        ...(process.env.NODE_ENV === "development" ? { details } : {}),
      },
      { status: 502 }
    );
  }

  let providerBody: unknown;

  try {
    providerBody = await aiResponse.json();
  } catch {
    return Response.json(
      { error: "The AI returned an unreadable response." },
      { status: 502 }
    );
  }

  const providerResult = GroqResponseSchema.safeParse(providerBody);

  if (!providerResult.success) {
    console.error(
      "Unexpected Groq response structure:",
      providerResult.error.issues
    );

    return Response.json(
      { error: "The AI response was missing its content." },
      { status: 502 }
    );
  }

  const content = providerResult.data.choices[0]?.message.content;

  if (!content) {
    return Response.json(
      { error: "The AI returned an empty response." },
      { status: 502 }
    );
  }

  let generatedJson: unknown;

  try {
    generatedJson = JSON.parse(content);
  } catch {
    console.error("Groq returned invalid JSON despite structured output:", content);

    return Response.json(
      { error: "The AI returned invalid JSON. Please try again." },
      { status: 502 }
    );
  }

  const generated = AdventureSchema.safeParse(generatedJson);

  if (!generated.success) {
    console.error(
      "Adventure schema validation failed:",
      generated.error.issues
    );

    return Response.json(
      {
        error: "The AI response did not match the adventure format.",
        ...(process.env.NODE_ENV === "development"
          ? { details: generated.error.issues }
          : {}),
      },
      { status: 502 }
    );
  }

  if (generated.data.missions.length !== expectedMissionCount) {
    console.error("Mission count mismatch:", {
      expected: expectedMissionCount,
      actual: generated.data.missions.length,
      content,
    });

    return Response.json(
      {
        error: "The AI generated an incorrect number of missions. Please try again.",
        ...(process.env.NODE_ENV === "development"
          ? {
              details: {
                expected: expectedMissionCount,
                actual: generated.data.missions.length,
              },
            }
          : {}),
      },
      { status: 502 }
    );
  }

  const baseMinutes = Math.floor(duration / expectedMissionCount);
  const extraMinutes = duration % expectedMissionCount;

  const adventure = {
    ...generated.data,
    duration,
    missions: generated.data.missions.map((mission, index) => ({
      ...mission,
      id: `mission-${index + 1}`,
      duration: baseMinutes + (index < extraMinutes ? 1 : 0),
    })),
  };

  return Response.json(adventure);
}
