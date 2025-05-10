import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  LoggingLevel,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { logMessages } from "./types/log.types.js";
import { toolConfigs } from "./tools.js";
import { config } from "./config.js";

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
      name: config.server.name,
      version: config.server.version,
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
  let logLevel: LoggingLevel = config.logging.defaultLevel;
  let logsUpdateInterval: NodeJS.Timeout | undefined;
  let heartbeatInterval: NodeJS.Timeout | undefined;

  const isMessageIgnored = (level: LoggingLevel): boolean => {
    const currentLevel = logMessages.findIndex((msg) => logLevel === msg.level);
    const messageLevel = logMessages.findIndex((msg) => level === msg.level);
    return messageLevel < currentLevel;
  };

  // Send heartbeat notification to check connection health
  const sendHeartbeat = () => {
    if (!hasActiveConnections) return; // Skip if no active connections

    try {
      server.notification({
        method: "notifications/message",
        params: {
          level: "debug",
          data: "Server heartbeat",
        },
      });
    } catch (error) {
      console.error("Error sending heartbeat notification:", error);
    }
  };

  // Set up heartbeat interval
  heartbeatInterval = setInterval(sendHeartbeat, config.sse.keepaliveInterval);

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
  }, config.logging.logMessageInterval);

  // Retry function for tool execution
  const retryToolExecution = async (
    handler: Function,
    params: any,
    toolName: string,
    maxRetries = config.tools.maxRetries,
    delay = config.tools.retryDelay
  ) => {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await handler(params);
      } catch (error) {
        lastError = error;
        console.error(
          `Error executing tool '${toolName}' (attempt ${attempt}/${maxRetries}):`,
          error
        );

        // Send error notification to client
        if (config.tools.sendNotifications) {
          try {
            server.notification({
              method: "notifications/message",
              params: {
                level: "error",
                data: `Tool '${toolName}' failed on attempt ${attempt}/${maxRetries}: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            });
          } catch (notificationError) {
            console.error(
              "Failed to send error notification:",
              notificationError
            );
          }
        }

        // Don't wait on the last attempt
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // If we get here, all retries failed
    throw lastError;
  };

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
    if (config.logging.logToolParams) {
      console.log(
        `[LOG] Handling tools/call request for tool: ${
          request?.params?.name
        }, parameters: ${JSON.stringify(request?.params?.arguments)}`
      );
    } else {
      console.log(
        `[LOG] Handling tools/call request for tool: ${request?.params?.name}`
      );
    }

    hasActiveConnections = true; // Set to true when we receive a request

    if (typeof request?.params?.name !== "string") {
      throw new Error("Tool name must be a string");
    }

    // Find the tool handler
    const toolConfig = toolConfigs.find(
      (tool) => tool.name === request?.params?.name
    );

    if (!toolConfig || !toolConfig.handler) {
      throw new Error(`Tool '${request?.params?.name}' not found`);
    }

    try {
      // Send notification that we're calling the tool
      if (config.tools.sendNotifications) {
        server.notification({
          method: "notifications/message",
          params: {
            level: "info",
            data: `Executing tool: ${request?.params?.name}`,
          },
        });
      }

      // Call the handler with the parameters and retry if it fails
      const result = await retryToolExecution(
        toolConfig.handler,
        request?.params?.arguments,
        request?.params?.name
      );

      if (config.logging.logToolResults) {
        console.log(`[LOG] Tool final result: ${JSON.stringify(result)}`);
      } else {
        console.log(`[LOG] Tool execution complete: ${request?.params?.name}`);
      }

      // Send notification when tool execution is complete
      if (config.tools.sendNotifications) {
        server.notification({
          method: "notifications/message",
          params: {
            level: "info",
            data: `Tool execution completed: ${request?.params?.name}`,
          },
        });
      }

      return result;
    } catch (error) {
      console.error(`Error calling tool ${request?.params?.name}:`, error);

      // Send a more detailed error notification
      if (config.tools.sendNotifications) {
        try {
          server.notification({
            method: "notifications/message",
            params: {
              level: "error",
              data: `Tool execution failed: ${request?.params?.name} - ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          });
        } catch (notificationError) {
          console.error(
            "Failed to send error notification:",
            notificationError
          );
        }
      }

      throw error instanceof Error ? error : new Error(String(error));
    }
  });

  const cleanup = async () => {
    console.log("Cleaning up MCP server resources...");
    if (logsUpdateInterval) clearInterval(logsUpdateInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  };

  return { server, cleanup };
};
