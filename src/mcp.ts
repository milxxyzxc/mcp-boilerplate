import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  LoggingLevel,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { logMessages } from "./types/log.types.js";
import { toolConfigs } from "./tools.js";

// Flag to track if we have active connections
let hasActiveConnections = false;

// Update the flag from outside
export const setConnectionStatus = (active: boolean) => {
  hasActiveConnections = active;
};

export const createServer = async () => {
  // Initialize the MCP server
  const server = new Server(
    {
      name: "mcp-boilerplate",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: { subscribe: true },
        tools: {},
        logging: {
          log: (message: string) => {
            console.log(`[LOG] ${message}`);
          },
          error: (message: string) => {
            console.error(`[ERROR] ${message}`);
          },
          warn: (message: string) => {
            console.warn(`[WARN] ${message}`);
          },
        },
      },
    }
  );

  // Setup logging
  let logLevel: LoggingLevel = "debug";
  let logsUpdateInterval: NodeJS.Timeout | undefined;

  const isMessageIgnored = (level: LoggingLevel): boolean => {
    const currentLevel = logMessages.findIndex((msg) => logLevel === msg.level);
    const messageLevel = logMessages.findIndex((msg) => level === msg.level);
    return messageLevel < currentLevel;
  };

  // Set up update interval for random log messages - reduced frequency to avoid overloading
  logsUpdateInterval = setInterval(() => {
    if (!hasActiveConnections) return; // Skip if no active connections

    const randomIndex = Math.floor(Math.random() * logMessages.length);
    const randomMessage = logMessages[randomIndex];

    if (!isMessageIgnored(randomMessage.level)) {
      try {
        server.notification({
          method: "notifications/message",
          params: {
            level: randomMessage.level,
            data: randomMessage.data,
          },
        });
      } catch (error) {
        console.error("Error sending notification:", error);
      }
    }
  }, 60000); // Reduced frequency to once per minute

  // Handle listing tools - use the tools array
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.log(
      `[LOG] Handling tools/list request, total tools: ${toolConfigs.length}`
    );

    console.log(`[LOG] Tool names: ${toolConfigs.map((tool) => tool.name)}`);

    hasActiveConnections = true; // Set to true when we receive a request

    // Map our custom tools to the MCP Tool format
    const mcpTools: Tool[] = toolConfigs.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    }));

    return {
      tools: mcpTools,
      status: 200,
    };
  });

  // Handle calling a tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    console.log(
      `[LOG] Handling tools/call request for tool: ${
        request?.params?.name
      }, parameters: ${JSON.stringify(request?.params?.arguments)}`
    );
    hasActiveConnections = true; // Set to true when we receive a request

    if (typeof request?.params?.name !== "string") {
      throw new Error("Tool name must be a string");
    }

    // Find the tool handler
    const handler = toolConfigs.find(
      (tool) => tool.name === request?.params?.name
    )?.handler;
    if (!handler) {
      throw new Error(`Tool '${request?.params?.name}' not found`);
    }

    try {
      // Call the handler with the parameters
      const result = await handler(request?.params?.arguments);
      console.log(`[LOG] Tool final result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      console.error(`Error calling tool ${request?.params?.name}:`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  });

  const cleanup = async () => {
    console.log("Cleaning up MCP server resources...");
    if (logsUpdateInterval) clearInterval(logsUpdateInterval);
  };

  return { server, cleanup };
};
