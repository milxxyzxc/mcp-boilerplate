import dotenv from "dotenv";

dotenv.config();

/**
 * MCP Server Configuration
 * Centralized configuration for the Model Context Protocol server
 */

export const config = {
  // Server settings
  server: {
    name: "mcp-boilerplate",
    version: "1.0.0",
    port: parseInt(process.env.PORT || "4005"),
    host: process.env.HOST || "localhost",
    apiKey: process.env.API_KEY || "dev_key",
  },

  // SSE connection settings
  sse: {
    // How often to send keepalive messages (in milliseconds)
    keepaliveInterval: 30000,
    // Whether to send ping events in addition to comments
    usePingEvents: true,
    // Initial connection message
    sendConnectedEvent: true,
  },

  // Tool execution settings
  tools: {
    // Number of retries for failed tool executions
    maxRetries: 3,
    // Delay between retries (in milliseconds)
    retryDelay: 1000,
    // Whether to send notifications about tool execution status
    sendNotifications: true,
  },

  // Logging settings
  logging: {
    // Default log level
    defaultLevel: "debug" as const,
    // Log tool parameters in console
    logToolParams: true,
    // Log tool results in console
    logToolResults: true,
    // How often to send log messages (in milliseconds)
    logMessageInterval: 10000,
  },
};
