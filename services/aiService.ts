import { ArchitectureResponse, CodeSnippetResponse, CritiqueFinding, ExportFormat, InfraExportResponse } from "../types";

// Typed error so callers can branch on HTTP status codes.
export class ApiError extends Error {
  constructor(message: string, public readonly status: number | null) {
    super(message);
    this.name = "ApiError";
  }
}

// All AI calls go through the local Express server (/api/*).
// No token or Authorization header exists in this client-side file.

export const generateArchitecture = async (
  prompt: string,
  currentMermaidCode?: string,
  currentSequenceCode?: string
): Promise<ArchitectureResponse> => {
  let response: Response;
  try {
    response = await fetch("/api/architecture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, currentMermaidCode, currentSequenceCode }),
    });
  } catch {
    // fetch() itself threw — server is unreachable / network down
    throw new ApiError("Network error: could not reach the server.", null);
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(
      `Server error: ${response.status} — ${errData.error ?? response.statusText}`,
      response.status
    );
  }

  return (await response.json()) as ArchitectureResponse;
};

export const generateCodeSnippet = async (
  targetComponent: string,
  context: string
): Promise<CodeSnippetResponse> => {
  let response: Response;
  try {
    response = await fetch("/api/code-snippet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetComponent, context }),
    });
  } catch {
    throw new ApiError("Network error: could not reach the server.", null);
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(
      `Server error: ${response.status} — ${errData.error ?? response.statusText}`,
      response.status
    );
  }

  return (await response.json()) as CodeSnippetResponse;
};

/**
 * Runs a design-critique against the current diagram.
 * Intentionally silent-fail: returns null on any error so callers
 * can fire-and-forget without a try/catch.
 */
export const generateCritique = async (
  mermaidCode: string,
  sequenceCode: string
): Promise<CritiqueFinding[] | null> => {
  try {
    const response = await fetch("/api/critique", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mermaidCode, sequenceCode }),
    });
    if (!response.ok) {
      console.warn("[critique] server returned", response.status);
      return null;
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      console.warn("[critique] unexpected response shape", data);
      return null;
    }
    return data as CritiqueFinding[];
  } catch (err) {
    console.warn("[critique] failed silently:", err);
    return null;
  }
};

/**
 * Generates a runnable infrastructure artifact (Docker Compose / Terraform / OpenAPI)
 * from the current diagram. Throws ApiError on failure so callers can surface the error.
 */
export const generateExport = async (
  mermaidCode: string,
  sequenceCode: string,
  format: ExportFormat
): Promise<InfraExportResponse> => {
  let response: Response;
  try {
    response = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mermaidCode, sequenceCode, format }),
    });
  } catch {
    throw new ApiError("Network error: could not reach the server.", null);
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(
      `Export generation failed: ${response.status} — ${errData.error ?? response.statusText}`,
      response.status
    );
  }

  return (await response.json()) as InfraExportResponse;
};
