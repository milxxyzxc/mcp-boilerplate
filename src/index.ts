import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";
import { createServer, setConnectionStatus } from "./mcp.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

console.log("Starting MCP SSE server...");

const app = express();

// Store transports by session ID
const transports: Record<string, SSEServerTransport> = {};

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", version: "1.0.0" });
});

// MCP server and cleanup function
let serverInstance: {
  server: any;
  cleanup: () => Promise<void>;
} | null = null;

// SSE endpoint
app.get("/sse", async (req, res) => {
  console.log("Received GET request to /sse (establishing SSE stream)");

  // Validate API key
  const apiKey = req.query.API_KEY;
  if (!apiKey) {
    console.error("Authentication failed: No API key provided");
    res.status(401).json({ error: "Unauthorized: API key is required" });
    return;
  }

  if (apiKey !== process.env.API_KEY) {
    console.error("Authentication failed: Invalid API key");
    res.status(401).json({ error: "Unauthorized: Invalid API key" });
    return;
  }

  // Check if server is initialized
  if (!serverInstance) {
    console.error("MCP server not initialized");
    res
      .status(500)
      .json({ error: "Server initialization in progress, please try again" });
    return;
  }

  try {
    // Create a new SSE transport for the client
    const transport = new SSEServerTransport("/messages", res);

    // Store the transport by session ID
    const sessionId = transport.sessionId;
    transports[sessionId] = transport;

    // Update connection status
    setConnectionStatus(true);
    console.log(`Creating new SSE transport with session ID: ${sessionId}`);

    // Set up onclose handler to clean up transport when closed
    transport.onclose = () => {
      console.log(`SSE transport closed for session ${sessionId}`);
      delete transports[sessionId];

      // If no more transports, update connection status
      if (Object.keys(transports).length === 0) {
        setConnectionStatus(false);
      }
    };

    // Handle client disconnect
    req.on("close", () => {
      console.log(`Client disconnected for session ${sessionId}`);
      delete transports[sessionId];

      // If no more transports, update connection status
      if (Object.keys(transports).length === 0) {
        setConnectionStatus(false);
      }
    });

    // Connect to MCP server
    await serverInstance.server.connect(transport);
    console.log(`Established SSE stream with session ID: ${sessionId}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Error establishing SSE stream: ${errorMessage}`, error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: `Error establishing SSE stream: ${errorMessage}` });
    }
  }
});

// Message handling endpoint
app.post("/messages", async (req, res) => {
  // Extract session ID from URL query parameter
  const sessionId = req.query.sessionId as string | undefined;

  if (!sessionId) {
    console.error("No session ID provided in request URL");
    res.status(400).send("Missing sessionId parameter");
    return;
  }

  const transport = transports[sessionId];
  if (!transport) {
    console.error(`No active transport found for session ID: ${sessionId}`);
    res.status(404).send("Session not found or expired");
    return;
  }

  try {
    // Handle the POST message with the transport
    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Error handling request: ${errorMessage}`, error);
    if (!res.headersSent) {
      res.status(500).send(`Error handling request: ${errorMessage}`);
    }
  }
});

// Initialize the MCP server
const initializeServer = async () => {
  try {
    // Create MCP server
    serverInstance = await createServer();
    console.log("MCP server initialized successfully");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to initialize MCP server: ${errorMessage}`);
    process.exit(1);
  }
};

// Handle SIGINT and SIGTERM gracefully
process.on("SIGINT", async () => {
  console.log("Shutting down server due to SIGINT...");
  if (serverInstance) {
    await serverInstance.cleanup();
    await serverInstance.server.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down server due to SIGTERM...");
  if (serverInstance) {
    await serverInstance.cleanup();
    await serverInstance.server.close();
  }
  process.exit(0);
});

// Initialize the server before starting
initializeServer().then(() => {
  // Start the server with different port to avoid conflict
  const PORT = parseInt(process.env.PORT || "4005");
  const HOST = process.env.HOST || "localhost";

  app.listen(PORT, HOST, () => {
    console.log(`MCP server is running at http://${HOST}:${PORT}`);
    console.log(`Health check: http://${HOST}:${PORT}/health`);
    console.log(
      `SSE endpoint: http://${HOST}:${PORT}/sse?API_KEY=${
        process.env.API_KEY || "dev_key"
      }`
    );
  });
});
