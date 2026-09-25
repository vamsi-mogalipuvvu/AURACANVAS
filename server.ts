import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const archiver = require("archiver");

// Load .env BEFORE any routes so process.env.GEMINI_API_KEY is available
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// ─── Shared GitHub Models config (server-side only) ─────────────────────────
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODEL_NAME = "gemini-2.5-flash";

const getAuthHeaders = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };
};

// ── Groq fallback config ─────────────────────────────────────────────────
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL    = "llama-3.3-70b-versatile";

const getGroqHeaders = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set — cannot use Groq fallback.");
  return { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };
};

/**
 * Attempts the Gemini endpoint first.
 * On HTTP 429, retries with Groq using the SAME request body but swapping
 * the model name and auth headers. Returns { data, provider }.
 */
async function callWithFallback(
  requestBody: Record<string, unknown>
): Promise<{ data: unknown; provider: "gemini" | "groq" }> {
  // ─ Primary: Gemini ─────────────────────────────────────────────────────
  const geminiRes = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(requestBody),
  });

  if (geminiRes.ok) {
    console.log("[provider] gemini answered");
    return { data: await geminiRes.json(), provider: "gemini" };
  }

  // On rate-limit, fall through to Groq ──────────────────────────────────
  if (geminiRes.status === 429) {
    console.warn(`[provider] Gemini 429 rate-limit — falling back to Groq (${GROQ_MODEL})`);

    // Groq is OpenAI-compatible but requires its own model name
    const groqBody = { ...requestBody, model: GROQ_MODEL };
    const groqRes = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: getGroqHeaders(),
      body: JSON.stringify(groqBody),
    });

    if (groqRes.ok) {
      console.log("[provider] groq answered (fallback)");
      return { data: await groqRes.json(), provider: "groq" };
    }

    // Groq also failed — surface the Groq error
    const groqErr = await groqRes.text();
    console.error("[provider] Groq fallback also failed:", groqErr);
    throw new Error(`Both Gemini (429) and Groq (${groqRes.status}) failed: ${groqErr}`);
  }

  // Non-429 Gemini error — propagate immediately
  const errText = await geminiRes.text();
  console.error("[provider] Gemini non-429 error:", geminiRes.status, errText);
  throw Object.assign(new Error(errText), { httpStatus: geminiRes.status });
}

// ─── Mermaid code cleaner (same logic as client-side, now runs on server) ────
const cleanMermaidCode = (code: string): string => {
  let cleaned = code;
  cleaned = cleaned.replace(/```mermaid/g, "").replace(/```/g, "");
  cleaned = cleaned.replace(/^.*classDef.*$/gm, "");
  cleaned = cleaned.replace(/^.*style\s.*$/gm, "");
  cleaned = cleaned.replace(/:::[a-zA-Z0-9_-]+/g, "");
  cleaned = cleaned.replace(/^\s*direction\s+.*$/gm, "");
  cleaned = cleaned.replace(/\s-->\s/g, " --> ");
  if (cleaned.includes(";") && !cleaned.includes("\n")) {
    cleaned = cleaned.replace(/;/g, "\n");
  } else {
    cleaned = cleaned.replace(/;$/gm, "");
  }
  cleaned = cleaned
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .join("\n");
  return cleaned.trim();
};

// ─── System instruction (same as githubService, now server-side) ─────────────
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

5. **Critique** (HONEST ANALYSIS REQUIRED): After producing the diagrams, critically evaluate the RESULTING architecture for real weaknesses. Return 2–5 concise bullet strings covering any of:
   - Missing caching layer (no Redis/Memcached when it would help)
   - Single point of failure / no load balancer
   - No rate limiting on public-facing endpoints
   - Missing auth or authorization service
   - No monitoring, logging, or observability path
   - No database backup, replica, or HA strategy
   - Tight coupling with no async queue or message broker
   Only flag gaps that ACTUALLY exist in the diagram you just produced.
   If the architecture genuinely has no notable gaps, return an empty array — do NOT invent filler critique.

6. **Cost Estimate** (DIRECTIONAL ONLY — NOT A QUOTE): For each major INFRASTRUCTURE component in the diagram that has a meaningful standalone cloud cost, produce one line item with:
   - component: short display name (e.g. "Managed PostgreSQL", "Redis Cache", "Load Balancer", "Message Broker")
   - monthlyUsd: rough range in USD assuming small-to-medium production traffic on a mainstream cloud (e.g. "$15–40", "$50–120")
   - note: one concise sentence on what drives the cost (e.g. "small managed Postgres instance, 2 vCPU / 4 GB RAM")
   INCLUDE: managed databases, caches (Redis/Memcached), load balancers, message brokers (Kafka/RabbitMQ), CDNs (storage+egress), object storage, compute clusters.
   SKIP: pure application/business-logic services that run on shared compute and have no meaningful standalone cost (Auth Service, Profile Service, etc.) — their cost is subsumed in compute.
   Keep estimates conservative and rounded to the nearest $5 boundary. Return an empty array only if the diagram has NO billable infrastructure.

OUTPUT FORMAT:
Return a JSON object with:
- 'mermaidCode': The raw mermaid string for the System Graph.
- 'sequenceCode': The raw mermaid string for the Sequence Diagram.
- 'explanation': The summary text.
- 'title': A short title for the diagram.
- 'critique': An array of short strings (2–5 items, or empty) listing genuine architectural gaps.
- 'costEstimate': An array of { component, monthlyUsd, note } objects, one per billable infra component.
`;

// ─── POST /api/architecture ──────────────────────────────────────────────────
app.post("/api/architecture", async (req, res) => {
  try {
    const { prompt, currentMermaidCode, currentSequenceCode } = req.body as {
      prompt: string;
      currentMermaidCode?: string;
      currentSequenceCode?: string;
    };
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const isEdit = !!currentMermaidCode;

    // Build the system message — switch to edit mode when a current diagram exists
    const effectiveSystem = isEdit
      ? `${systemInstruction}

---
EDIT MODE — INCREMENTAL UPDATE:
You are EDITING an existing diagram, NOT creating a new one from scratch.

Current System Architecture Diagram (mermaidCode):
\`\`\`
${currentMermaidCode}
\`\`\`

Current Sequence Diagram (sequenceCode):
\`\`\`
${currentSequenceCode ?? ""}
\`\`\`

STRICT EDITING RULES:
- PRESERVE every existing node, edge, and relationship that the user's instruction does NOT ask to remove or change.
- Only ADD, REMOVE, or RENAME the specific elements mentioned in the instruction.
- Do NOT redesign, reorder, or rename unrelated components.
- Keep all existing node IDs identical unless the user explicitly asks to rename them.
- Return the FULL updated diagrams (not just a diff) in the same JSON schema.
- In 'changedNodeIds', return the exact alphanumeric Mermaid node IDs (as used in mermaidCode, e.g. 'RedisCache', 'ApiGateway') that you ADDED or MODIFIED in this edit. Do NOT include unchanged nodes. This is used to visually highlight what changed.`
      : systemInstruction;

    const requestBody = {
      model: MODEL_NAME,
      messages: [
        { role: "system", content: effectiveSystem },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "architecture_response",
          schema: {
            type: "object",
            properties: {
              mermaidCode: {
                type: "string",
                description:
                  "The System Architecture Diagram (graph TD). Strict syntax: No spaces in IDs, quoted labels, no styling.",
              },
              sequenceCode: {
                type: "string",
                description: "The Sequence Diagram (sequenceDiagram). Strict syntax.",
              },
              explanation: {
                type: "string",
                description: "A brief senior-level explanation of the architecture choices.",
              },
              title: {
                type: "string",
                description: "A short, professional title for the architecture.",
              },
              critique: {
                type: "array",
                items: { type: "string" },
                description: "2-5 short strings identifying real architectural gaps in this diagram, or an empty array if none.",
              },
              costEstimate: {
                type: "array",
                description: "One entry per billable infrastructure component (databases, caches, load balancers, message brokers, CDN, compute). Skip pure app services.",
                items: {
                  type: "object",
                  properties: {
                    component: { type: "string", description: "Short display name, e.g. 'Managed PostgreSQL'" },
                    monthlyUsd: { type: "string", description: "Rough USD range e.g. '$15-40'" },
                    note: { type: "string", description: "One sentence on what drives the cost" },
                  },
                  required: ["component", "monthlyUsd", "note"],
                  additionalProperties: false,
                },
              },
              changedNodeIds: {
                type: "array",
                items: { type: "string" },
                description: "Exact alphanumeric Mermaid node IDs added or modified in this edit (e.g. 'RedisCache', 'ApiGateway'). Empty array for fresh (non-edit) generations.",
              },
            },
            required: ["mermaidCode", "sequenceCode", "explanation", "title", "critique", "costEstimate", "changedNodeIds"],
            additionalProperties: false,
          },
          strict: true,
        },
      },
      temperature: 0.1,
    };

    const { data, provider } = await callWithFallback(requestBody);
    const rawData = data as { choices: { message: { content: string } }[] };
    const text = rawData.choices[0].message.content;
    if (!text) {
      return res.status(500).json({ error: "No response from AI provider." });
    }

    const parsed = JSON.parse(text);
    parsed.mermaidCode = cleanMermaidCode(parsed.mermaidCode);
    parsed.sequenceCode = cleanMermaidCode(parsed.sequenceCode);
    parsed.isEdit = isEdit;
    parsed.provider = provider;

    return res.json(parsed);
  } catch (err: any) {
    console.error("Error in /api/architecture:", err);
    const status = err.httpStatus ?? 500;
    return res.status(status).json({ error: err.message ?? "Internal server error" });
  }
});


// ─── POST /api/code-snippet ──────────────────────────────────────────────────
app.post("/api/code-snippet", async (req, res) => {
  try {
    const { targetComponent, context } = req.body as {
      targetComponent: string;
      context: string;
    };
    if (!targetComponent || !context) {
      return res.status(400).json({ error: "targetComponent and context are required" });
    }

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

    const codeRequestBody = {
      model: MODEL_NAME,
      messages: [{ role: "user", content: codePrompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "code_snippet_response",
          schema: {
            type: "object",
            properties: {
              code: {
                type: "string",
                description:
                  "The generated code snippet. Clean, commented, production-ready code. Do NOT use markdown backticks.",
              },
              language: {
                type: "string",
                description:
                  "The programming language of the snippet (e.g., 'typescript', 'python', 'sql').",
              },
              description: {
                type: "string",
                description: "A very brief one-line description of what this code does.",
              },
            },
            required: ["code", "language", "description"],
            additionalProperties: false,
          },
          strict: true,
        },
      },
      temperature: 0.2,
    };

    const { data: codeData, provider: codeProvider } = await callWithFallback(codeRequestBody);
    console.log(`[provider] code-snippet answered by: ${codeProvider}`);
    const rawCodeData = codeData as { choices: { message: { content: string } }[] };
    const text = rawCodeData.choices[0].message.content;
    if (!text) {
      return res.status(500).json({ error: "No code generated." });
    }

    return res.json(JSON.parse(text));
  } catch (err: any) {
    console.error("Error in /api/code-snippet:", err);
    const status = err.httpStatus ?? 500;
    return res.status(status).json({ error: err.message ?? "Internal server error" });
  }
});

// ─── POST /api/export-project ────────────────────────────────────────────────
interface ExportComponent {
  componentName: string;
  code: string;
  language: string;
  description: string;
}

// Map language names to file extensions
const langToExt: Record<string, string> = {
  typescript: "ts", javascript: "js", python: "py", go: "go",
  java: "java", rust: "rs", sql: "sql", yaml: "yml", json: "json",
  dockerfile: "Dockerfile", shell: "sh", bash: "sh", css: "css",
  html: "html", cpp: "cpp", c: "c", csharp: "cs", kotlin: "kt",
};

function getExt(language: string): string {
  return langToExt[language.toLowerCase()] ?? "txt";
}

// Infer docker-compose services from component names and languages
function buildDockerCompose(title: string, components: ExportComponent[]): string {
  const names = components.map(c => c.componentName.toLowerCase()).join(" ");
  const langs = components.map(c => c.language.toLowerCase()).join(" ");
  const all = names + " " + langs;

  const services: string[] = [];

  // App service based on predominant language
  const isNode = langs.includes("typescript") || langs.includes("javascript");
  const isPython = langs.includes("python");
  const isGo = langs.includes("go");
  const appImage = isNode ? "node:20-alpine" : isPython ? "python:3.12-slim" : isGo ? "golang:1.22-alpine" : "ubuntu:22.04";
  const appPort = "3000";

  services.push(`  app:
    image: ${appImage}
    working_dir: /app
    volumes:
      - .:/app
    ports:
      - "${appPort}:${appPort}"
    environment:
      - NODE_ENV=production`);

  if (all.includes("postgres") || all.includes("postgresql") || all.includes("sql")) {
    services.push(`  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: appdb
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data`);
  }

  if (all.includes("redis") || all.includes("cache") || all.includes("session")) {
    services.push(`  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"`);
  }

  if (all.includes("mongo") || all.includes("mongodb")) {
    services.push(`  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db`);
  }

  if (all.includes("kafka") || all.includes("message") || all.includes("queue")) {
    services.push(`  zookeeper:
    image: confluentinc/cp-zookeeper:7.6.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
  kafka:
    image: confluentinc/cp-kafka:7.6.0
    depends_on: [zookeeper]
    ports:
      - "9092:9092"
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092`);
  }

  const volumes: string[] = [];
  if (all.includes("postgres") || all.includes("sql")) volumes.push("  postgres_data:");
  if (all.includes("mongo")) volumes.push("  mongo_data:");

  const volBlock = volumes.length ? `\nvolumes:\n${volumes.join("\n")}` : "";
  return `version: "3.9"\n\nservices:\n${services.join("\n")}${volBlock}\n`;
}

app.post("/api/export-project", async (req, res) => {
  try {
    const { title, explanation, mermaidCode, components } = req.body as {
      title: string;
      explanation: string;
      mermaidCode: string;
      components: ExportComponent[];
    };

    if (!title || !mermaidCode || !components?.length) {
      return res.status(400).json({ error: "title, mermaidCode and components are required" });
    }

    // Build README.md
    const componentList = components
      .map(c => `- **${c.componentName}** (\`${c.language}\`) — ${c.description}`)
      .join("\n");
    const readme = [
      `# ${title}`,
      "",
      "## Architecture Overview",
      explanation,
      "",
      "## System Diagram",
      "```mermaid",
      mermaidCode,
      "```",
      "",
      "## Generated Components",
      componentList,
      "",
      "## Getting Started",
      "```bash",
      "# Start all services",
      "docker compose up -d",
      "```",
      "",
      `> Generated by [AURA Canvas Architect](https://github.com) — Powered by Gemini 2.5 Flash`,
    ].join("\n");

    // Build docker-compose.yml
    const dockerCompose = buildDockerCompose(title, components);

    // Stream zip response
    const safeTitle = title.replace(/[^a-z0-9]/gi, "-").toLowerCase();

    // Buffer the zip in memory, then send it all at once
    const chunks: Buffer[] = [];
    const archive = new archiver.ZipArchive({ zlib: { level: 9 } });
    archive.on("error", (err: Error) => { throw err; });
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));

    // Add README
    archive.append(readme, { name: "README.md" });

    // Add docker-compose
    archive.append(dockerCompose, { name: "docker-compose.yml" });

    // Add each component file
    for (const comp of components) {
      const ext = getExt(comp.language);
      const fileName = ext === "Dockerfile"
        ? `services/${comp.componentName.replace(/\s+/g, "-")}/Dockerfile`
        : `src/${comp.componentName.replace(/\s+/g, "-").toLowerCase()}.${ext}`;
      archive.append(comp.code, { name: fileName });
    }

    await archive.finalize();

    const zipBuffer = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.zip"`);
    res.setHeader("Content-Length", zipBuffer.length);
    res.end(zipBuffer);
  } catch (err: any) {
    console.error("Error in /api/export-project:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message ?? "Export failed" });
    }
  }
});

// ─── POST /api/critique ──────────────────────────────────────────────────────
const critiqueInstruction = `
You are a senior distributed-systems architect performing a peer design review.
You are given a Mermaid system-architecture diagram and a sequence diagram.
Your job is to identify the 3-5 most important architectural gaps in the design.

Focus only on concrete, actionable issues from this list:
- Single point of failure (no load balancer, no replica, no failover)
- Missing cache layer causing unnecessary DB load
- No rate limiting or auth on public-facing endpoints
- No async queue for operations that can be decoupled (e.g. notifications, emails)
- Single DB instance with no read replica or failover strategy
- No observability path (logging, metrics, distributed tracing)
- Tight coupling between services that should be event-driven
- Missing CDN or edge caching for static/media assets

RULES:
- Cap findings at 3-5. Do NOT nitpick minor or obvious demo simplifications.
- If the diagram already addresses one of these concerns, do NOT flag it.
- Each finding must be specific to what is visible (or absent) in the given diagram.
- "issue" must be 1 concise sentence naming the problem.
- "suggestion" must be 1 concise sentence naming the fix (mention specific tech if appropriate).
- severity: "high" = production outage risk, "medium" = reliability/performance risk, "low" = best-practice gap.

Return a JSON array (not wrapped in an object) of findings:
[
  { "severity": "high" | "medium" | "low", "issue": "...", "suggestion": "..." }
]
`;

app.post("/api/critique", async (req, res) => {
  try {
    const { mermaidCode, sequenceCode } = req.body as {
      mermaidCode: string;
      sequenceCode?: string;
    };
    if (!mermaidCode) {
      return res.status(400).json({ error: "mermaidCode is required" });
    }

    const userContent = `System Architecture Diagram:\n\`\`\`\n${mermaidCode}\n\`\`\`\n\nSequence Diagram:\n\`\`\`\n${sequenceCode ?? "(not provided)"}\n\`\`\``;

    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: critiqueInstruction },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "critique_response",
            schema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  severity: { type: "string", enum: ["high", "medium", "low"] },
                  issue: { type: "string" },
                  suggestion: { type: "string" },
                },
                required: ["severity", "issue", "suggestion"],
                additionalProperties: false,
              },
            },
            strict: true,
          },
        },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini error (critique):", errText);
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    const text = data.choices[0].message.content;
    if (!text) {
      return res.status(500).json({ error: "No critique response from model." });
    }

    const findings = JSON.parse(text);
    return res.json(findings);
  } catch (err: any) {
    console.error("Error in /api/critique:", err);
    return res.status(500).json({ error: err.message ?? "Internal server error" });
  }
});

// ─── POST /api/export ────────────────────────────────────────────────────────
const exportInstructions: Record<string, string> = {
  "docker-compose": `
You are a senior DevOps engineer. You are given a Mermaid system-architecture diagram and its sequence diagram.
Your task is to generate a runnable Docker Compose v3.9 configuration that accurately represents it.

RULES:
- Map every meaningful node in the architecture diagram to a Docker service.
- Map every edge (connection) to the correct Docker Compose relationship:
  - Data-flow dependencies → depends_on
  - Shared communication → place services on the same named network
- Use real, publicly available Docker images (e.g. postgres:16-alpine, redis:7-alpine, nginx:alpine).
- Add realistic environment variables, ports, healthchecks, and volume mounts.
- Also produce a .env.example file listing all environment variable names with placeholder values.
- Do NOT include TODO comments or placeholder services. Every service must be real and minimal but runnable.
- Output exactly 2 files: docker-compose.yml and .env.example.
`,
  terraform: `
You are a senior cloud infrastructure engineer. You are given a Mermaid system-architecture diagram.
Your task is to generate Terraform HCL (HashiCorp Configuration Language) that accurately represents it.

RULES:
- Map every meaningful node to a Terraform resource block (use AWS provider by default).
- Map every edge to the correct Terraform resource reference (resource attribute references, depends_on, security group rules).
- Use realistic resource types: aws_ecs_service, aws_rds_instance, aws_elasticache_cluster, aws_lb, aws_api_gateway_rest_api, etc.
- Add a variables.tf file declaring all configurable values (region, instance sizes, etc).
- Do NOT include TODO comments. Every resource block must be complete and syntactically valid HCL.
- Output exactly 2 files: main.tf and variables.tf.
`,
  openapi: `
You are a senior API architect. You are given a Mermaid system-architecture diagram and its sequence diagram.
Your task is to generate an OpenAPI 3.1.0 specification that accurately represents the API surface implied by the architecture.

RULES:
- Derive API paths from the edges in the architecture diagram (each public-facing edge = at least one path).
- Derive schemas from the sequence diagram message labels and node names.
- Include realistic request bodies, response schemas, and status codes for each operation.
- Add security schemes (BearerAuth JWT) on all non-public paths.
- Do NOT output placeholder paths like /todo or empty schemas. Every path must be meaningful.
- Output exactly 1 file: openapi.yaml.
`,
};

app.post("/api/export", async (req, res) => {
  try {
    const { mermaidCode, sequenceCode, format } = req.body as {
      mermaidCode: string;
      sequenceCode?: string;
      format: "docker-compose" | "terraform" | "openapi";
    };

    if (!mermaidCode || !format) {
      return res.status(400).json({ error: "mermaidCode and format are required" });
    }
    if (!exportInstructions[format]) {
      return res.status(400).json({ error: `Unknown format: ${format}` });
    }

    const userContent = `System Architecture Diagram:\n\`\`\`\n${mermaidCode}\n\`\`\`\n\nSequence Diagram:\n\`\`\`\n${sequenceCode ?? "(not provided)"}\n\`\`\`\n\nGenerate the ${format} artifact now.`;

    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: exportInstructions[format] },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "infra_export_response",
            schema: {
              type: "object",
              properties: {
                format: { type: "string" },
                files: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      filename: { type: "string" },
                      content: { type: "string" },
                    },
                    required: ["filename", "content"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["format", "files"],
              additionalProperties: false,
            },
            strict: true,
          },
        },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini error (export):", errText);
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    const text = data.choices[0].message.content;
    if (!text) {
      return res.status(500).json({ error: "No export response from model." });
    }

    const result = JSON.parse(text);
    return res.json(result);
  } catch (err: any) {
    console.error("Error in /api/export:", err);
    return res.status(500).json({ error: err.message ?? "Internal server error" });
  }
});

// ─── Dev server (Vite middleware) ─────────────────────────────────────────────


async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false, // Disable HMR to avoid WebSocket issues
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
