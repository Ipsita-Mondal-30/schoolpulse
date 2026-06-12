import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return new Response("Missing text content", { status: 400 });
    }

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: z.object({
        subject: z.string().describe("The core subject in upper case (e.g. MATHEMATICS, ENVIRONMENTAL SCIENCE, ENGLISH, KANNADA)"),
        chapter: z.string().describe("The chapter or unit title exactly (e.g. Chapter 2. My Body)"),
        content: z.string().describe("The raw notes assignment details verbatim"),
        submissionDate: z.string().describe("Estimated due date mapped to YYYY-MM-DD format (usually the upcoming Monday or tomorrow)"),
      }),
      prompt: `Parse the following raw school diary notification and extract the homework details:
      
      "${text}"`,
    });

    return new Response(JSON.stringify(object), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("API PARSER ERROR:", error);
    // Fallback parsing object
    return new Response(
      JSON.stringify({
        subject: "GENERAL",
        chapter: "Scanned Homework",
        content: "Complete homework exercises.",
        submissionDate: "2026-06-15",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
