import { Tool as MCPTool } from "@modelcontextprotocol/sdk/types.js";

// Tool handler type definition for dynamic handling
export type ToolHandler = (params: any) => Promise<any>;

// Tool annotations structure with index signature to match MCP Tool annotations
export interface ToolAnnotations {
  title?: string; // Human-readable title for the tool
  readOnlyHint?: boolean; // If true, the tool does not modify its environment
  destructiveHint?: boolean; // If true, the tool may perform destructive updates
  idempotentHint?: boolean; // If true, repeated calls with same args have no additional effect
  openWorldHint?: boolean; // If true, tool interacts with external entities
  [key: string]: unknown; // Allow additional properties for compatibility
}

// Extended tool interface for our implementation
export interface CustomTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
  handler: ToolHandler;
  annotations?: ToolAnnotations;
}

// Tool result interface
export interface ToolResult {
  content?: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
  [key: string]: any; // Allow other properties
}

// Error result helper function
export const createErrorResult = (errorMessage: string): ToolResult => {
  return {
    isError: true,
    status: 500,
    content: [
      {
        type: "text",
        text: `Error: ${errorMessage}`,
      },
    ],
  };
};

// Success result helper function
export const createSuccessResult = (data: any): ToolResult => {
  console.log(`[LOG] Creating success result: ${JSON.stringify(data)}`);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data),
      },
    ],
    isError: false,
    status: 200,
  };
};
