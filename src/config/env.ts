const fs = require("fs");
const path = require("path");

let loaded = false;

const parseEnvLine = (line: string) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (!match) {
    return;
  }

  const key = match[1];
  let value = match[2] ?? "";

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  if (!process.env[key]) {
    process.env[key] = value;
  }
};

export const loadEnv = () => {
  if (loaded) {
    return;
  }

  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    content
      .split(/\r?\n/)
      .filter((line: string) => line.trim() && !line.trim().startsWith("#"))
      .forEach(parseEnvLine);
  }

  loaded = true;
};

export const getEnv = (key: string) => {
  loadEnv();
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};
