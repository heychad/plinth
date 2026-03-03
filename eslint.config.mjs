import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-unused-vars": "off",
    },
  },
  {
    // Convex "use node" actions run in Node.js and have access to node globals,
    // fetch (Node 18+), and Web API globals like AbortSignal.
    files: ["convex/**/*.ts"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        fetch: "readonly",
        Blob: "readonly",
        AbortSignal: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        URL: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        TextEncoder: "readonly",
        crypto: "readonly",
      },
    },
  },
  {
    // Next.js src/ files run in browser and Node.js (middleware) environments
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      globals: {
        // Browser globals
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        // Web API globals
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        // Node.js globals (for middleware and env vars)
        process: "readonly",
        console: "readonly",
        // React JSX
        React: "readonly",
        JSX: "readonly",
      },
    },
  },
  {
    ignores: ["node_modules/", ".next/", "convex/_generated/"],
  },
];
