import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "dist-desktop/**", "node_modules/**"] },

  js.configs.recommended,
  // Type-aware rules: worth the slower run here because the interesting bugs in
  // this codebase (unawaited IPC promises, unsafe casts around Three.js objects)
  // are only visible with type information.
  tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },

  // Browser app globals plus the build-time defines from vite.config.
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        __APP_VERSION__: "readonly",
        __APP_DESCRIPTION__: "readonly",
        __GITHUB_URL__: "readonly"
      }
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Errors, not warnings. These were temporarily downgraded while #20
      // introduced the linter, because the seven violations they found all
      // needed behaviour changes. #29 fixed every one, so they gate now.
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/refs": "error",
      "react-hooks/exhaustive-deps": "error"
    }
  },

  // The layering CONTEXT.md describes, enforced rather than remembered. Each
  // layer names what it must never import; everything else is open.
  {
    files: ["src/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "react/*", "three", "three/*"],
              message: "src/domain is pure logic: no React, no Three.js (CONTEXT.md)."
            },
            {
              group: ["@/renderer/*", "@/components/*", "@/platform/*", "@/App"],
              message: "src/domain must not depend on the layers built on top of it."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["three", "three/*"],
              message: "Three.js lives in src/renderer; components stay plain React."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["src/renderer/**", "src/platform/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/*", "@/App"],
              message: "The renderer and platform layers must not reach into the React UI."
            }
          ]
        }
      ]
    }
  },

  // Build config runs in Node, and so does the Windows app's main process.
  {
    files: ["*.config.ts", "*.config.js", "desktop/**"],
    languageOptions: { globals: globals.node }
  },

  // The CAD bake (ADR-0033) is a hand-run Node script, outside the app's
  // TypeScript program and outside its dependencies, so the type-aware rules
  // have nothing to work from.
  {
    files: ["tools/**/*.mjs"],
    languageOptions: { globals: globals.node },
    extends: [tseslint.configs.disableTypeChecked]
  },

  {
    rules: {
      // Prefix deliberately unused bindings with an underscore.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }
      ]
    }
  },

  // Config files are not part of the app's type-checked program.
  {
    files: ["*.config.js"],
    extends: [tseslint.configs.disableTypeChecked]
  }
);
