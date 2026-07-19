import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The safety check fails CLOSED: whenever we can't get a clear "safe" verdict
// from the model (no key, network error, timeout, malformed response) we block
// the market rather than let it through. A false "unsafe" just asks the user to
// retry; a false "safe" ships a harmful bet.
const BLOCKED = (reason: string) => ({ safe: false, reason, suggestion: "" });

// Cap how long we'll wait on Gemini so a hung request can't hang the Create
// button indefinitely — if it stalls, we fail closed like any other error.
const TIMEOUT_MS = 12_000;

export async function POST(req: NextRequest) {
  const { question, criteria } = await req.json().catch(() => ({} as any));
  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "missing question" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      BLOCKED("Safety check is unavailable. Please try again later.")
    );
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

For "reason": if unsafe, briefly explain why; if safe, use an empty string.
For "suggestion": if unsafe, offer one safer alternative phrasing that keeps the spirit of the bet; if safe, use an empty string.

Market question: "${question.replace(/"/g, '\\"')}"
${criteria ? `Resolution criteria: "${String(criteria).replace(/"/g, '\\"')}"` : ""}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Gemini Interactions API (POST /v1beta/interactions). The legacy
    // :generateContent path 404s / has zero free-tier quota for current models;
    // gemini-2.0-flash is deprecated -> gemini-3.5-flash is the drop-in target.
    // - response_format pins the output to our schema (guaranteed valid JSON,
    //   no brittle regex extraction).
    // - thinking_level "low" keeps this classifier fast and cheap.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/interactions?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Revision": "2026-05-20",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "gemini-3.5-flash",
          input: prompt,
          generation_config: { thinking_level: "low" },
          response_format: {
            type: "object",
            properties: {
              safe: { type: "boolean" },
              reason: { type: "string" },
              suggestion: { type: "string" },
            },
            required: ["safe", "reason", "suggestion"],
          },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[safety-check] Gemini ${res.status}: ${errBody.slice(0, 200)}`);
      return NextResponse.json(
        BLOCKED("Safety check is temporarily unavailable. Please try again in a moment.")
      );
    }

    const data = await res.json();
    // Interactions API returns a `steps` array; the answer is the text content
    // of the trailing model_output step(s), concatenated.
    const text: string = Array.isArray(data?.steps)
      ? data.steps
          .filter((s: any) => s?.type === "model_output")
          .flatMap((s: any) => (Array.isArray(s.content) ? s.content : []))
          .filter((c: any) => c?.type === "text" && typeof c.text === "string")
          .map((c: any) => c.text)
          .join("")
      : "";

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Structured output should always be valid JSON; if it isn't, fail closed.
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        return NextResponse.json(
          BLOCKED("Safety check could not verify this market. Please try again.")
        );
      }
      parsed = JSON.parse(match[0]);
    }

    // Only an explicit boolean `true` is treated as safe — anything else blocks.
    return NextResponse.json({
      safe: parsed?.safe === true,
      reason: typeof parsed?.reason === "string" ? parsed.reason : "",
      suggestion: typeof parsed?.suggestion === "string" ? parsed.suggestion : "",
    });
  } catch (err: any) {
    const label = err?.name === "AbortError" ? "timed out" : "encountered an error";
    console.error(`[safety-check] ${label}:`, err?.message ?? err);
    return NextResponse.json(
      BLOCKED(`Safety check ${label}. Please try again.`)
    );
  } finally {
    clearTimeout(timer);
  }
}
