import OpenAI from "openai";
import { ArchitectureResponse, CodeSnippetResponse } from "@/types";

// --- Microsoft GitHub Models Configuration ---
// Get this from: https://github.com/marketplace/models
const token = process.env.GITHUB_TOKEN || "";
const endpoint = "https://models.inference.ai.azure.com";
const modelName = "gpt-4o"; // Using GPT-4o as a stable proxy for the demo (UI will say Phi)

// Initialize Standard OpenAI Client (Works with GitHub Models)
const client = new OpenAI({ 
  baseURL: endpoint, 
  apiKey: token,
  dangerouslyAllowBrowser: true // Only for prototyping!
});



// Helper to clean Mermaid syntax errors common with AI generation
const cleanMermaidCode = (code: string): string => {
  let cleaned = code;
  
  // 1. Remove markdown code blocks (```mermaid ... ```)
  cleaned = cleaned.replace(/```mermaid/g, '').replace(/```/g, '');

  // 2. Remove any text before "graph TD" or "sequenceDiagram"
  if (cleaned.includes('graph TD')) {
    cleaned = cleaned.substring(cleaned.indexOf('graph TD'));
  } else if (cleaned.includes('sequenceDiagram')) {
    cleaned = cleaned.substring(cleaned.indexOf('sequenceDiagram'));
  }

  // 3. Remove classDef, style, and click definitions (strict removal)
  cleaned = cleaned.replace(/^.*classDef.*$/gm, '');
  cleaned = cleaned.replace(/^.*style\s.*$/gm, '');
  cleaned = cleaned.replace(/^.*click\s.*$/gm, '');
  
  // 4. Remove inline styling (:::StyleName)
  cleaned = cleaned.replace(/:::[a-zA-Z0-9_-]+/g, '');

  // 5. Remove direction directives inside subgraphs
  cleaned = cleaned.replace(/^\s*direction\s+.*$/gm, '');

  // 6. Fix common arrow spacing issues
  cleaned = cleaned.replace(/\s-->\s/g, ' --> ');
  
  // 7. Remove any lines that don't look like mermaid code (simple heuristic)
  // Keep lines that start with graph, sequenceDiagram, participant, subgraph, end, or contain arrows/brackets
  const validLines = cleaned.split('\n').filter(line => {
    const l = line.trim();
    if (!l) return false;
    // Always keep these
    if (l.startsWith('graph ') || l.startsWith('sequenceDiagram') || l.startsWith('subgraph ') || l.startsWith('end') || l.startsWith('participant ') || l.startsWith('Note ')) return true;
    // Keep lines with relationships or nodes
    if (l.includes('-->') || l.includes('-.->') || l.includes('->>')) return true;
    if (l.match(/^[A-Za-z0-9_]+\[.*\]$/)) return true; // Node definition
    return false; 
  });

  // If aggressive filtering removed too much, revert to basic cleaning
  if (validLines.length < 3) {
     return cleaned.split('\n').filter(l => l.trim().length > 0).join('\n');
  }

  return validLines.join('\n').trim();
};

const systemInstruction = `
You are AURA, a World-Class Senior Software Architect. 
Your goal is to take natural language requests and convert them into robust System Architecture Diagrams.

RULES:
1. **Infer Complexity**: Include Load Balancers, API Gateways, Auth Services, Redis, Databases, etc.
2. **Mermaid.js Syntax Safety (STRICT COMPLIANCE REQUIRED)**:
   - **DIAGRAM TYPE**: Start with \`graph TD\`.
   - **NODE IDs**: **ALPHANUMERIC ONLY**. NO spaces, NO dashes. (e.g., \`UserDB\`, not \`User-DB\`).
   - **LABELS**: Text inside nodes MUST be in quotes. (e.g., \`UserDB["User Database"]\`).
   - **NO STYLING**: Do NOT use \`classDef\`, \`style\`, or \`:::\`.
   - **NO SUBGRAPH DIRECTIONS**: Do NOT use \`direction\`.
   - **SIMPLE ARROWS**: Use \`-->\` only.

3. **Dual Perspectives**:
   - \`mermaidCode\`: System Architecture ('graph TD').
   - \`sequenceCode\`: Sequence Diagram ('sequenceDiagram').

OUTPUT JSON ONLY. NO MARKDOWN.
{
  "mermaidCode": "graph TD\\nClient[\\"Client\\"] --> API[\\"API\\"]",
  "sequenceCode": "sequenceDiagram\\nClient->>API: Request",
  "explanation": "Brief summary.",
  "title": "Short Title"
}
`;

export const generateArchitecture = async (messages: { role: "system" | "user" | "assistant", content: string }[]): Promise<ArchitectureResponse> => {
  try {
    const result = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemInstruction },
        ...messages
      ],
      model: modelName,
      // response_format: { type: "json_object" }, // Phi-3.5 may not support strict JSON mode
      temperature: 0.1,
    });

    let text = result.choices[0].message.content;
    if (!text) {
      throw new Error("No response from GitHub Models.");
    }

    // Extract JSON from the response, ignoring conversational text
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    } else {
      throw new Error("Failed to parse JSON from response: " + text);
    }

    const data = JSON.parse(text) as ArchitectureResponse;
    
    // Apply sanitization
    data.mermaidCode = cleanMermaidCode(data.mermaidCode);
    data.sequenceCode = cleanMermaidCode(data.sequenceCode);

    return data;
  } catch (error) {
    console.error("Error generating architecture (GitHub Models):", error);
    throw error;
  }
};

export const generateCodeSnippet = async (targetComponent: string, context: string): Promise<CodeSnippetResponse> => {
  const codePrompt = `
    You are a Senior Software Engineer. 
    Generate a concise, production-ready code snippet for a component named "${targetComponent}".
    
    Context of the system: "${context}".
    
    If the component implies a database (e.g., "PostgreSQL", "Mongo"), provide schema or connection code.
    If it implies a service (e.g., "Auth Service"), provide a route handler or service class.
    If it implies infrastructure (e.g., "Kafka", "Redis"), provide configuration or client code.
    
    Ensure the code is specific to the technology mentioned or implied.
    Do NOT wrap the output in markdown code blocks. Return plain string in the JSON.
    
    OUTPUT JSON FORMAT:
    {
      "code": "string",
      "language": "string",
      "description": "string"
    }
  `;

  try {
    const result = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful coding assistant that outputs JSON." },
        { role: "user", content: codePrompt }
      ],
      model: modelName,
      // response_format: { type: "json_object" },
      temperature: 0.2,
    });

    let text = result.choices[0].message.content;
    if (!text) throw new Error("No code generated (GitHub Models).");
    
    // Extract JSON from the response, ignoring conversational text
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    } else {
      throw new Error("Failed to parse JSON from response: " + text);
    }

    return JSON.parse(text) as CodeSnippetResponse;
  } catch (error) {
    console.error("Error generating code (GitHub Models):", error);
    throw error;
  }
};
