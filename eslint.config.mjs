import nextConfig from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [".claude/**"],
  },
  ...nextConfig,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/incompatible-library": "off",
    },
  },
];

export default eslintConfig;
