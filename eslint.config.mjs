import js from "@eslint/js";
import reactPlugin from "eslint-plugin-react";
import globals from "globals";

export default [
  // Section 1: Global Ignores (Replaces .eslintignore)
  {
    ignores: [
      "**/node_modules/", //
      "frontend/node_modules/", //
      "backend/node_modules/", //
      "**/dist/", //
      "**/build/" //
    ],
  },

  // Section 2: Linting Rules and Environment (Replaces .eslintrc.json)
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    plugins: {
      react: reactPlugin, // 
    },
    languageOptions: {
      ecmaVersion: 2021, // 
      sourceType: "module", // 
      parserOptions: {
        ecmaFeatures: {
          jsx: true, // 
        },
      },
      globals: {
        ...globals.browser, // 
        ...globals.node, // 
        ...globals.es2021, // 
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...js.configs.recommended.rules, // 
      ...reactPlugin.configs.recommended.rules, // 
      "react/prop-types": "off",
      "no-console": "off", // 
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }], // 
    },
  },
];
