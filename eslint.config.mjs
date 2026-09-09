// Flat config, mirroring proofowl-backend / proofowl-contracts' sdk:
// @eslint/js recommended + typescript-eslint recommended, unused-vars
// with a `^_` ignore, generated / build output excluded. Adds the
// Next.js core-web-vitals rules and react-hooks, since this repo is a
// React app and those are not relevant in the other two.

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [".next/**", "out/**", "dist/**", "coverage/**", "node_modules/**", "next-env.d.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node scripts + config files: Node globals, plain JS.
    files: ["scripts/**/*.{mjs,js}", "*.config.{ts,mjs,js}", "vitest.config.ts"],
    // Node script; smoke.mjs also has page.evaluate() callbacks that run
    // in the browser, so allow both global sets here.
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      // This is a read-only app. It must never call a wallet signing
      // method. Ban the identifiers project-wide so a signing flow
      // cannot be added without also removing this rule on purpose.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[property.name=/^(signTransaction|signAuthEntry|signMessage|signAndSubmitTransaction)$/]",
          message:
            "This repo is read-only: wallet signing methods must never be called. See src/lib/wallet/connect.ts.",
        },
      ],
    },
  },
);
