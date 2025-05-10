import { LoggingLevel } from "@modelcontextprotocol/sdk/types.js";

// Interface for log message
export interface LogMessage {
  level: LoggingLevel;
  data: string;
}

export const logMessages: LogMessage[] = [
  { level: "debug", data: "Debug-level message" },
  { level: "info", data: "Info-level message" },
  { level: "notice", data: "Notice-level message" },
  { level: "warning", data: "Warning-level message" },
  { level: "error", data: "Error-level message" },
  { level: "critical", data: "Critical-level message" },
  { level: "alert", data: "Alert level-message" },
  { level: "emergency", data: "Emergency-level message" },
];
