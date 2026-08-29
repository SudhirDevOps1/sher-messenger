const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 100],
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "chore", "docs", "refactor", "perf", "test", "build", "ci", "revert", "security"],
    ],
  },
};

export default config;
