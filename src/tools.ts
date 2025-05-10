import { createSuccessResult, CustomTool } from "./types/tool.types.js";
import { calculator } from "./tools/calculator.js";

// Tool configurations
export const toolConfigs: CustomTool[] = [
  {
    name: "calculator",
    description: "Perform basic arithmetic calculations",
    inputSchema: {
      type: "object" as const,
      properties: {
        operation: {
          type: "string",
          enum: ["add", "subtract", "multiply", "divide"],
          description: "The arithmetic operation to perform",
        },
        a: { type: "number", description: "First number" },
        b: { type: "number", description: "Second number" },
      },
      required: ["operation", "a", "b"],
    },
    annotations: {
      title: "Calculator",
      readOnlyHint: true,
      openWorldHint: false,
    },

    handler: calculator,
  },
  //   add your new tool example here
  //   {
  //     name: "myTool",
  //     description: "My tool description",
  //     inputSchema: {
  //       type: "object" as const,
  //       properties: {},
  //       required: [],
  //     },
  //     handler: async () => {
  //       return createSuccessResult({ result: "Tool result" });
  //     },
  //   },
  // Add more tools here as they are created
];
