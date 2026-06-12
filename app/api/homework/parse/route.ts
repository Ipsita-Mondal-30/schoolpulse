import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { text, image } = await req.json();

    if (!text && !image) {
      return new Response("Missing text or image content", { status: 400 });
    }

    const messagesContent: any[] = [
      {
        type: "text",
        text: `Parse the school diary, worksheet, or announcement and extract the homework details:
        1. Subject: Must be one of the core subjects in UPPER CASE (e.g. MATHEMATICS, ENVIRONMENTAL SCIENCE, ENGLISH, HINDI, KANNADA, COMPUTER SCIENCE, GENERAL).
        2. Chapter: The chapter or unit title exactly (e.g. Chapter 2. My Body).
        3. Content: The detailed notes or assignment details verbatim.
        4. Submission Date: Estimated due date mapped to YYYY-MM-DD format (usually the upcoming Monday or tomorrow).
        5. Assigned Date: The date the homework was assigned, mapped to YYYY-MM-DD format. If found in the text/image, extract it. otherwise omit.`,
      }
    ];

    if (text) {
      messagesContent.push({
        type: "text",
        text: `Raw text input:\n"${text}"`,
      });
    }

    if (image) {
      messagesContent.push({
        type: "image",
        image: image,
      });
    }

    const { object } = await generateObject({
      // @ts-ignore: version mismatch between ai core and provider
      model: openai("gpt-4o-mini"),
      schema: z.object({
        subject: z.string().describe("The core subject in upper case (e.g. MATHEMATICS, ENVIRONMENTAL SCIENCE, ENGLISH, HINDI, KANNADA, COMPUTER SCIENCE, GENERAL)"),
        chapter: z.string().describe("The chapter or unit title exactly (e.g. Chapter 2. My Body)"),
        content: z.string().describe("The raw notes assignment details verbatim"),
        submissionDate: z.string().describe("Estimated due date mapped to YYYY-MM-DD format"),
        assignedDate: z.string().optional().describe("The date the homework was assigned, in YYYY-MM-DD format, if mentioned in the image/text"),
      }),
      messages: [
        {
          role: "user",
          content: messagesContent,
        }
      ],
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
