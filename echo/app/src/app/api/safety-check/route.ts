import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { question, criteria } = await req.json().catch(() => ({} as any));
  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "missing question" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ safe: true, reason: "" });
  }

  const prompt = `You are a safety reviewer for a prediction market platform called Better. Users create markets (bets) about real-world outcomes involving people in their community.

Your job: decide whether the following market question (and optional resolution criteria) is SAFE to publish.

A market is UNSAFE if it:
- Encourages or profits from physical harm, violence, or self-harm
- Targets a specific person in a harassing, humiliating, or degrading way
- Involves illegal activity (e.g. betting on crimes being committed)
- Is discriminatory based on race, gender, sexuality, religion, or disability
- Involves betting on someone's death, serious injury, or medical condition without their consent
- Could incentivize dangerous or reckless behavior
- Involves minors in inappropriate contexts
- Is sexually explicit

A market is SAFE if it:
- Is a fun, lighthearted bet among friends (e.g. "Will Amir land the backflip?")
- Involves sports, politics, crypto prices, community events, personal challenges
- Is competitive but respectful

Respond with ONLY valid JSON, no markdown:
{"safe": true/false, "reason": "brief explanation if unsafe, empty string if safe", "suggestion": "a safer alternative phrasing if unsafe, empty string if safe"}

Market question: "${question.replace(/"/g, '\\"')}"
${criteria ? `Resolution criteria: "${String(criteria).replace(/"/g, '\\"')}"` : ""}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[safety-check] Gemini ${res.status}: ${errBody.slice(0, 200)}`);
      return NextResponse.json({ safe: true, reason: "" });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ safe: true, reason: "" });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      safe: !!parsed.safe,
      reason: parsed.reason || "",
      suggestion: parsed.suggestion || "",
    });
  } catch {
    return NextResponse.json({ safe: true, reason: "" });
  }
}
