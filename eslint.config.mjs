import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import { defineConfig } from "eslint/config"

export default defineConfig([
  {
    ignores: [".next/**", "node_modules/**", "dist/**", "app/.well-known/**"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
])
