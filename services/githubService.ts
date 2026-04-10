import { ArchitectureResponse, CodeSnippetResponse } from "../types";

const apiKey = process.env.GITHUB_TOKEN || 'your_github_token_here';
const endpoint = "https://models.inference.ai.azure.com/chat/completions";
const modelName = "gpt-4o";

const systemInstruction = `
You are AURA, a World-Class Senior Software Architect. 
Your goal is to take natural language requests (often vague) and convert them into robust, professional System Architecture Diagrams.

RULES:
1. **Infer Complexity**: If a user says "login system", DO NOT just put a user and a database. You MUST include Load Balancers, API Gateways, Auth Services (OAuth/JWT), Redis Caches, User Databases, and Audit Logs. Always design for High Availability and Security.

2. **Mermaid.js Syntax Safety (STRICT COMPLIANCE REQUIRED)**:
   - **DIAGRAM TYPE**:
     - For System Architecture: Start with \`graph TD\`.
     - For Sequence Diagrams: Start with \`sequenceDiagram\`.
   - **NODE IDs & PARTICIPANTS**: **ALPHANUMERIC ONLY**. NO spaces, NO dashes, NO special characters.
     - Correct: \`participant ApiGateway\`, \`ApiGateway->>UserDB: Query\`
     - WRONG: \`participant API Gateway\`, \`API-Gateway->>User-DB: Query\`
   - **LABELS**: Text inside nodes MUST be in quotes and brackets for graphs.
     - Correct: \`ApiGateway["API Gateway"]\`
   - **NO STYLING**: Do NOT use \`classDef\`, \`style\`, or \`:::\`. Raw graph only.
   - **NO SUBGRAPH DIRECTIONS**: Do NOT use \`direction\` (TB/LR) inside subgraphs.
   - **SIMPLE ARROWS**: Use \`-->\` or \`-.->\` for graphs, \`->>\`, \`-->\`, \`->\`, \`-->\` for sequences.
   - **NO PARENTHESES IN LABELS**: Avoid \`()\` in text. Use \`[]\` or clean text.
   - **SEQUENCE DIAGRAM SPECIFIC**:
     - Always start with \`sequenceDiagram\`.
     - Use \`participant\` to define actors.
     - Use \`->>\`, \`-->\` for messages.
     - Keep messages short and without special characters.
   - **FORMATTING (CRITICAL)**:
     - You MUST use NEWLINES (\n) to separate statements.
     - Do NOT put everything on one line.
     - Do NOT use semicolons (;) to separate statements.

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

  // 3. Remove direction directives inside subgraphs
  cleaned = cleaned.replace(/^\s*direction\s+.*$/gm, '');

  // 4. Sanitize Node IDs (Attempt to fix common AI mistakes like "Node A")
  cleaned = cleaned.replace(/\s-->\s/g, ' --> ');

  // 4.5. Fix single-line semicolon separated code
  if (cleaned.includes(';') && !cleaned.includes('\n')) {
    cleaned = cleaned.replace(/;/g, '\n');
  } else {
    // Just remove trailing semicolons
    cleaned = cleaned.replace(/;$/gm, '');
  }

  // 5. Trim empty lines
  cleaned = cleaned.split('\n').filter(line => line.trim().length > 0).join('\n');
  
  return cleaned.trim();
};

export const generateArchitecture = async (prompt: string): Promise<ArchitectureResponse> => {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "architecture_response",
            schema: {
              type: "object",
              properties: {
                mermaidCode: { type: "string", description: "The System Architecture Diagram (graph TD). Strict syntax: No spaces in IDs, quoted labels, no styling." },
                sequenceCode: { type: "string", description: "The Sequence Diagram (sequenceDiagram). Strict syntax." },
                explanation: { type: "string", description: "A brief senior-level explanation of the architecture choices." },
                title: { type: "string", description: "A short, professional title for the architecture." }
              },
              required: ["mermaidCode", "sequenceCode", "explanation", "title"],
              additionalProperties: false
            },
            strict: true
          }
        },
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const text = data.choices[0].message.content;
    
    if (!text) {
      throw new Error("No response from GitHub Models.");
    }

    const parsedData = JSON.parse(text) as ArchitectureResponse;
    
    // Apply sanitization
    parsedData.mermaidCode = cleanMermaidCode(parsedData.mermaidCode);
    parsedData.sequenceCode = cleanMermaidCode(parsedData.sequenceCode);

    return parsedData;
  } catch (error) {
    console.error("Error generating architecture:", error);
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
  `;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "user", content: codePrompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "code_snippet_response",
            schema: {
              type: "object",
              properties: {
                code: { type: "string", description: "The generated code snippet. Clean, commented, production-ready code. Do NOT use markdown backticks." },
                language: { type: "string", description: "The programming language of the snippet (e.g., 'typescript', 'python', 'sql')." },
                description: { type: "string", description: "A very brief one-line description of what this code does." }
              },
              required: ["code", "language", "description"],
              additionalProperties: false
            },
            strict: true
          }
        },
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const text = data.choices[0].message.content;
    
    if (!text) throw new Error("No code generated.");
    
    return JSON.parse(text) as CodeSnippetResponse;
  } catch (error) {
    console.error("Error generating code:", error);
    throw error;
  }
};
