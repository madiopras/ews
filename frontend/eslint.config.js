const js = require("@eslint/js");
const globals = require("globals");
const importPlugin = require("eslint-plugin-import");
const jsxA11y = require("eslint-plugin-jsx-a11y");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");

module.exports = [
  {
    ignores: ["build/**", "node_modules/**", "src/**/*.backup*", "src/pages/Planner-Phase1.js"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.jest, ...globals.node },
    },
    plugins: {
      import: importPlugin,
      "jsx-a11y": jsxA11y,
      react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": { node: { extensions: [".js", ".jsx"] } },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off",
      "jsx-a11y/no-autofocus": "off",
      "no-unused-vars": ["error", { argsIgnorePattern: "^(node|_)", varsIgnorePattern: "^_" }],
      "import/no-unresolved": "error",
    },
  },
  {
    files: ["src/**/*.{test,spec}.{js,jsx}"],
    rules: { "react/display-name": "off" },
  },
  {
    files: ["src/lib/markdown.jsx"],
    rules: {
      "jsx-a11y/anchor-has-content": "off",
      "jsx-a11y/heading-has-content": "off",
    },
  },
  {
    files: ["src/components/VideoLightbox.jsx"],
    rules: { "jsx-a11y/media-has-caption": "off" },
  },
  {
    // These localized controls wrap their inputs; computed label text causes a false positive.
    files: ["src/pages/mitra/MitraBusiness.jsx"],
    rules: { "jsx-a11y/label-has-associated-control": "off" },
  },
];
