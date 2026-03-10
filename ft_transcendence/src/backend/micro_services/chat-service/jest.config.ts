import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  // Runs before any test file — loads .env so DATABASE_URL is available
  // to integration tests that connect to PostgreSQL.
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  // Run test files one at a time (not in parallel).
  // Integration tests share a real DB — parallel execution causes race conditions
  // where one file's TRUNCATE wipes data that another file's test just inserted.
  maxWorkers: 1,
};

export default config;
