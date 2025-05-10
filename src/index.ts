import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";
import { createServer, setConnectionStatus } from "./mcp.js";
import { config } from "./config.js";

console.log("Starting MCP SSE server...");

const app = express();

// Add CORS configuration
app.use(cors());
// Use JSON middleware
app.use(express.json());

// Store transports by session ID
const transports: Record<string, SSEServerTransport> = {};
// Store keepalive intervals by session ID
const keepaliveIntervals: Record<string, NodeJS.Timeout> = {};

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", version: config.server.version });
});

// MCP server and cleanup function
let serverInstance: {
  server: any;
  cleanup: () => Promise<void>;
} | null = null;

// SSE endpoint
app.get("/sse", async (req, res) => {
  console.log("Received GET request to /sse (establishing SSE stream)");

  // Set appropriate headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable buffering for Nginx

  // Increase timeout for the connection
  req.socket.setTimeout(0); // Disable timeout
  res.setTimeout(0); // Disable timeout

  // Validate API key
  const apiKey = req.query.API_KEY;
  if (!apiKey) {
    console.error("Authentication failed: No API key provided");
    res.status(401).json({ error: "Unauthorized: API key is required" });
    return;
  }

  if (apiKey !== config.server.apiKey) {
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

    // Set up keepalive interval to prevent timeout
    const keepaliveInterval = setInterval(() => {
      try {
        if (res.writableEnded) {
          clearInterval(keepaliveInterval);
          return;
        }

        // Send a comment as a keepalive to prevent timeout
        res.write(": keepalive\n\n");

        // Also send a ping event that all SSE clients should recognize
        if (config.sse.usePingEvents) {
          res.write(`event: ping\ndata: ${Date.now()}\n\n`);
        }
      } catch (error) {
        console.error(
          `Error sending keepalive for session ${sessionId}:`,
          error
        );
        clearInterval(keepaliveInterval);
        deleteSession(sessionId);
      }
    }, config.sse.keepaliveInterval);

    keepaliveIntervals[sessionId] = keepaliveInterval;

    // Update connection status
    setConnectionStatus(true);
    console.log(`Creating new SSE transport with session ID: ${sessionId}`);

    // Set up onclose handler to clean up transport when closed
    transport.onclose = () => {
      console.log(`SSE transport closed for session ${sessionId}`);
      deleteSession(sessionId);
    };

    // Handle client disconnect
    req.on("close", () => {
      console.log(`Client disconnected for session ${sessionId}`);
      deleteSession(sessionId);
    });

    // Handle errors on the response
    res.on("error", (error) => {
      console.error(`Error on SSE response for session ${sessionId}:`, error);
      deleteSession(sessionId);
    });

    // Connect to MCP server
    await serverInstance.server.connect(transport);
    console.log(`Established SSE stream with session ID: ${sessionId}`);

    // Send initial message to confirm connection
    if (config.sse.sendConnectedEvent) {
      res.write('event: connected\ndata: {"status":"connected"}\n\n');
    }
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

// Helper function to clean up session resources
function deleteSession(sessionId: string) {
  // Clear the keepalive interval
  if (keepaliveIntervals[sessionId]) {
    clearInterval(keepaliveIntervals[sessionId]);
    delete keepaliveIntervals[sessionId];
  }

  // Delete the transport
  delete transports[sessionId];

  // If no more transports, update connection status
  if (Object.keys(transports).length === 0) {
    setConnectionStatus(false);
  }
}

// Message handling endpoint with ping support
app.post("/messages", (req, res) => {
  // Handle ping requests directly for faster response
  if (req.body && req.body.jsonrpc === "2.0" && req.body.method === "ping") {
    console.log(`Received ping request with ID: ${req.body.id}`);
    res.json({
      jsonrpc: "2.0",
      id: req.body.id,
      result: {},
    });
    return;
  }

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

  // Handle the POST message with the transport
  transport.handlePostMessage(req, res, req.body).catch((error) => {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Error handling request: ${errorMessage}`, error);
    if (!res.headersSent) {
      res.status(500).send(`Error handling request: ${errorMessage}`);
    }
  });
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

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  // Keep the process running
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Keep the process running
});

// Initialize the server before starting
initializeServer().then(() => {
  // Start the server with port/host from config
  const PORT = config.server.port;
  const HOST = config.server.host;

  app.listen(PORT, HOST, () => {
    console.log(`MCP server is running at http://${HOST}:${PORT}`);
    console.log(`Health check: http://${HOST}:${PORT}/health`);
    console.log(
      `SSE endpoint: http://${HOST}:${PORT}/sse?API_KEY=${config.server.apiKey}`
    );
  });
});
