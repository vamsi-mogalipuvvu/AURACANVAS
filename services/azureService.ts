import { AzureOpenAI } from "openai";
import { ArchitectureResponse, CodeSnippetResponse } from "@/types";

// --- Azure Configuration ---
// Get these from the Azure Portal -> Resource -> Keys and Endpoint
const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
const apiKey = process.env.AZURE_OPENAI_API_KEY || "";
const apiVersion = "2024-05-01-preview"; // Or your specific version
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o"; // Your deployment name (e.g., 'gpt-4o' or 'phi-3')

// Initialize Azure OpenAI Client
const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

const systemInstruction = `
You are AURA, a World-Class Senior Software Architect. 
Your goal is to take natural language requests (often vague) and convert them into robust, professional System Architecture Diagrams.

RULES:
1. **Infer Complexity**: If a user says "login system", DO NOT just put a user and a database. You MUST include Load Balancers, API Gateways, Auth Services (OAuth/JWT), Redis Caches, User Databases, and Audit Logs. Always design for High Availability and Security.

2. **Mermaid.js Syntax Safety (STRICT COMPLIANCE REQUIRED)**:
   - **DIAGRAM TYPE**: Start with \`graph TD\`.
   - **NODE IDs**: **ALPHANUMERIC ONLY**. NO spaces, NO dashes, NO special characters.
     - Correct: \`ApiGateway\`, \`UserDB\`, \`AuthService\`
     - WRONG: \`API Gateway\`, \`User-DB\`, \`Auth_Service\`
   - **LABELS**: Text inside nodes MUST be in quotes and brackets.
     - Correct: \`ApiGateway["API Gateway"]\`
   - **NO STYLING**: Do NOT use \`classDef\`, \`style\`, or \`:::\`. Raw graph only.
   - **NO SUBGRAPH DIRECTIONS**: Do NOT use \`direction\` (TB/LR) inside subgraphs.
   - **SIMPLE ARROWS**: Use \`-->\` or \`-.->\` only.
   - **NO PARENTHESES IN LABELS**: Avoid \`()\` in text. Use \`[]\` or clean text.

3. **Dual Perspectives**: You MUST provide TWO diagrams for every request:
   - \`mermaidCode\`: A System Architecture Diagram using 'graph TD'.
   - \`sequenceCode\`: A Sequence Diagram using 'sequenceDiagram'.

4. **Explanation**: Provide a very brief, high-level executive summary (max 3 sentences).

OUTPUT FORMAT:
Return a JSON object with:
- 'mermaidCode': The raw mermaid string for the System Graph.
- 'sequenceCode': The raw mermaid string for the Sequence Diagram.
- 'explanation': The summary text.
- 'title': A short title for the diagram.
`;

// Helper to clean Mermaid syntax errors common with AI generation
const cleanMermaidCode = (code: string): string => {
  let cleaned = code;
  
  // Remove markdown code blocks if present
  cleaned = cleaned.replace(/```mermaid/g, '').replace(/```/g, '');

  // 1. Remove classDef and style definitions (strict removal)
  cleaned = cleaned.replace(/^.*classDef.*$/gm, '');
  cleaned = cleaned.replace(/^.*style\s.*$/gm, '');
  
  // 2. Remove inline styling (:::StyleName)
  cleaned = cleaned.replace(/:::[a-zA-Z0-9_-]+/g, '');

  // 3. Remove direction directives inside subgraphs (keeps top level usually, but safer to strip all inner ones)
  // We want to keep 'graph TD' at the top, but remove 'direction TB' etc elsewhere.
  // Simple heuristic: remove lines starting with 'direction'
  cleaned = cleaned.replace(/^\s*direction\s+.*$/gm, '');

  // 4. Sanitize Node IDs (Attempt to fix common AI mistakes like "Node A")
  // This is risky with regex on full code, so we rely heavily on prompt.
  // But we can ensure standard arrow syntax spacing
  cleaned = cleaned.replace(/\s-->\s/g, ' --> ');

  // 5. Trim empty lines
  cleaned = cleaned.split('\n').filter(line => line.trim().length > 0).join('\n');
  
  return cleaned.trim();
};

export const generateArchitecture = async (prompt: string): Promise<ArchitectureResponse> => {
  try {
    const result = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ],
      model: deployment, // Azure requires deployment name here too sometimes, or just uses the client config
      response_format: { type: "json_object" }, // Ensure JSON output
      temperature: 0.1,
    });

    const text = result.choices[0].message.content;
    if (!text) {
      throw new Error("No response from Azure OpenAI.");
    }

    const data = JSON.parse(text) as ArchitectureResponse;
    
    // Apply sanitization
    data.mermaidCode = cleanMermaidCode(data.mermaidCode);
    data.sequenceCode = cleanMermaidCode(data.sequenceCode);

    return data;
  } catch (error) {
    console.error("Error generating architecture (Azure):", error);
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
      model: deployment,
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const text = result.choices[0].message.content;
    if (!text) throw new Error("No code generated (Azure).");
    
    return JSON.parse(text) as CodeSnippetResponse;
  } catch (error) {
    console.error("Error generating code (Azure):", error);
    throw error;
  }
};
