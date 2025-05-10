# MCP boilerplate: Model Context Protocol Server

This server implements the Model Context Protocol (MCP) for global use as a boilerplate. It provides a standardized way to connect AI models to different data sources and tools using the Model Context Protocol.

## Features

- Implements the MCP Server-Sent Events (SSE) transport
- Provides a robust structure for building custom MCP servers
- Includes example tools with proper type definitions
- Secure authentication with API key
- Logging capabilities with different severity levels
- Session management for multiple client connections
- Graceful shutdown handling for SIGINT and SIGTERM signals

## Tools

The server currently includes the following example tool:

- `calculator`: Performs basic arithmetic operations (add, subtract, multiply, divide)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file with the following variables:

```
PORT=4005
API_KEY=your_api_key
```

3. Build the project:

```bash
npm run build
```

4. Start the server:

```bash
npm run start:sse
```

## Development

```bash
# Start in development mode with hot reloading
npm run start

# Start with PM2 for production
npm run start:pm2

# Development mode with nodemon
npm run dev
```

## API Endpoints

- `/health`: Health check endpoint that returns server status and version
- `/sse`: SSE endpoint for establishing MCP connections (requires API key)
- `/messages`: Message handling endpoint for client-server communication

## MCP Configuration

To connect an MCP to this server, add the following configuration:

```json
{
  "mcpServers": {
    "mcp-server": {
      "url": "http://localhost:4005/sse?API_KEY={{your_api_key_here}}"
    }
  }
}
```

## Extending the boilerplate

### Adding Custom Tools

Follow these steps to add a new tool to the MCP server:

1. **Create your tool handler**:

   - Add your new tool handler in `src/tools.ts` file or create a new file in the `src/tools` directory
   - The tool should follow the `ToolHandler` interface

2. **Configure your tool**:

   - Add your tool configuration to the `toolConfigs` array in `src/tools.ts`
   - Define the name, description, input schema, and handler for your tool

3. **Export and register your tool**:
   - If you created a separate file, export your handler and import it in `src/tools.ts`
   - Make sure your tool is properly registered in the `toolConfigs` array

Example:

```typescript
// In src/tools.ts (adding directly to the toolConfigs array)
{
  name: "myTool",
  description: "My tool description",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
  handler: async () => {
    return createSuccessResult({ result: "Tool result" });
  },
}
```

## Error Handling

The server implements comprehensive error handling:

- All operations are wrapped in try/catch blocks
- Proper validation for parameters and inputs
- Appropriate error messages for better debugging
- Helper functions for creating standardized error and success responses

## Security Considerations

- API key authentication for all connections
- Type validation for all parameters
- No hard-coded sensitive information
- Proper error handling to prevent information leakage
- Session-based transport management

## MCP Protocol Features

This boilerplate supports the core MCP features:

- Tools: List and call tools with proper parameter validation
- Logging: Various severity levels (debug, info, notice, warning, error, critical, alert, emergency)
- Server configuration: Name, version, and capabilities

## Session Management

The server manages client sessions through:

- Unique session IDs for each client connection
- Tracking of active transports by session ID
- Automatic cleanup of disconnected sessions
- Connection status tracking

## Additional Resources

- [MCP Documentation](https://modelcontextprotocol.io/introduction)
- [MCP TypeScript SDK](https://modelcontextprotocol.io/typescript/index.html)
