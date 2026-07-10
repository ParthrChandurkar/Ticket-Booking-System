const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(process.cwd(), ".env");

const parseEnvFile = () => {
  if (!fs.existsSync(envPath)) {
    return {};
  }

  return fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .reduce((values, line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match || line.trim().startsWith("#")) {
        return values;
      }

      let value = match[2] ?? "";
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      values[match[1]] = value;
      return values;
    }, {});
};

const fileEnv = parseEnvFile();
const databaseUrl = process.env.DATABASE_URL || fileEnv.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL || fileEnv.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  console.error("TEST_DATABASE_URL is required before running tests.");
  process.exit(1);
}

if (databaseUrl && databaseUrl === testDatabaseUrl) {
  console.error("Refusing to run tests: TEST_DATABASE_URL must be different from DATABASE_URL.");
  process.exit(1);
}

const commandEnv = {
  ...process.env,
  ...fileEnv,
  DATABASE_URL: testDatabaseUrl,
  NODE_ENV: "test"
};

const runNodeCli = (relativeCliPath, args) => {
  const result = spawnSync(process.execPath, [path.resolve(process.cwd(), relativeCliPath), ...args], {
    cwd: process.cwd(),
    env: commandEnv,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

runNodeCli("node_modules/prisma/build/index.js", ["generate"]);
runNodeCli("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
runNodeCli("node_modules/typescript/bin/tsc", []);
runNodeCli("node_modules/jest/bin/jest.js", ["--runInBand"]);
