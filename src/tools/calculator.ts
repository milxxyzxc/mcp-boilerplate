import {
  ToolResult,
  createErrorResult,
  createSuccessResult,
} from "../types/tool.types.js";

// Calculator tool parameter interface
export interface CalculatorParams {
  operation: "add" | "subtract" | "multiply" | "divide";
  a: number;
  b: number;
}

// Calculator tool implementation
export const calculator = async (
  params: CalculatorParams
): Promise<ToolResult> => {
  try {
    const { operation, a, b } = params;
    console.log(`[LOG] Calculator params: ${JSON.stringify(params)}`);

    // Perform calculation
    let result: number;
    switch (operation) {
      case "add":
        result = a + b;
        break;
      case "subtract":
        result = a - b;
        break;
      case "multiply":
        result = a * b;
        break;
      case "divide":
        if (b === 0) {
          return createErrorResult("Cannot divide by zero");
        }
        result = a / b;
        break;
      default:
        return createErrorResult(`Unknown operation: ${operation}`);
    }

    return createSuccessResult(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return createErrorResult(errorMessage);
  }
};
