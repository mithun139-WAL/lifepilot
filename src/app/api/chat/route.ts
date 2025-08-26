// import { NextRequest } from "next/server";

// export async function POST(req: NextRequest) {
//   const { messages } = await req.json();

//   const ollamaRes = await fetch("http://localhost:11434/api/chat", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       model: "phi3",
//       messages,
//       stream: true,
//     }),
//   });

//   const encoder = new TextEncoder();
//   const decoder = new TextDecoder();

//   const stream = new ReadableStream({
//     async start(controller) {
//       const reader = ollamaRes.body!.getReader();

//       while (true) {
//         const { done, value } = await reader.read();
//         if (done) break;

//         const text = decoder.decode(value);
//         // Each chunk may contain multiple JSON objects (newline-delimited JSON)
//         const jsonLines = text
//           .split("\n")
//           .filter(Boolean)
//           .map((line) => {
//             try {
//               return JSON.parse(line);
//             } catch {
//               return null;
//             }
//           });

//         for (const chunk of jsonLines) {
//           if (chunk && chunk.message?.content) {
//             controller.enqueue(encoder.encode(chunk.message.content));
//           }
//         }
//       }

//       controller.close();
//     },
//   });

//   return new Response(stream, {
//     headers: { "Content-Type": "text/plain" },
//   });
// }

import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  console.log("Received messages:", messages);

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-120b",
            messages,
            temperature: 0.4,
            max_tokens: 4096,
            top_p: 0.95,
            stream: true,
          }),
        });

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        let partial = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          partial += decoder.decode(value, { stream: true });
          const lines = partial.split("\n");

          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            if (!line || !line.startsWith("data:")) continue;

            const json = line.replace("data:", "").trim();
            if (json === "[DONE]") {
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(json);
              const text = parsed?.choices?.[0]?.delta?.content;
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            } catch (err) {
              console.error("JSON parse error:", err);
            }
          }

          partial = lines[lines.length - 1]; // Keep last incomplete line for next round
        }

        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode("Something went wrong."));
        controller.close();
        console.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Transfer-Encoding": "chunked",
    },
  });
}