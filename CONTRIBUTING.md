# Contributing to pmtiles-kit

First off, thank you for considering contributing to pmtiles-kit! It's people like you that make pmtiles-kit such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title** for the issue to identify the problem.
* **Describe the exact steps which reproduce the problem** in as many details as possible.
* **Provide specific examples to demonstrate the steps**. Include links to files or GitHub projects, or copy/pasteable snippets.
* **Describe the behavior you observed** and point out what exactly is the problem.
* **Explain which behavior you expected to see instead and why.**
* **Include screenshots and animated GIFs** which show you following the described steps.

### Suggesting Enhancements

* **Use a clear and descriptive title** for the issue.
* **Provide a step-by-step description** of the suggested enhancement.
* **Provide specific examples** to demonstrate the steps.
* **Describe the current behavior** and explain which behavior you expected to see instead and why.
* **Explain why this enhancement would be useful** to most pmtiles-kit users.

### Pull Requests

* Fill in the required template
* Do not include issue numbers in the PR title
* Follow the TypeScript style guide
* Include thoughtfully-worded, well-structured tests
* Document new code with JSDoc
* End all files with a newline

## Development Process

### Setting Up Your Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone git@github.com:tabibhasann/pmtiles-kit.git
   cd pmtiles-kit
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Running Tests

```bash
# Run all tests
npm test

# Run a specific test file
npx vitest run test/writer.test.ts

# Run with coverage
npx vitest run --coverage
```

### Code Style

We use the following tools:

* **Prettier** for code formatting (`npm run format`)
* **ESLint** for linting (`npm run lint`)
* **TypeScript** for type checking (`npm run typecheck`)

Run all checks before opening a PR:

```bash
npm run format
npm run lint
npm run typecheck
npm test
```

## Testing

### Test Structure

* `test/bytes.test.ts` - Tile byte utilities
* `test/yflip.test.ts` - Y-flip correctness
* `test/archive.test.ts` - Archive open + header
* `test/pmtiles.test.ts` - PMTiles reader
* `test/conversion.test.ts` - Format conversion
* `test/validation.test.ts` - Archive validation
* `test/report.test.ts` - Report rendering
* `test/writer.test.ts` - PMTiles v3 writer
* `test/roundtrip.test.ts` - End-to-end round-trip

### Writing Tests

* Write tests for all new features
* Maintain or improve code coverage
* Use descriptive test names that explain what is being tested
* Include both positive and negative test cases
* When adding a check or fix, also add a fixture for it

Example:
```typescript
import { describe, it, expect } from "vitest";

describe("my new feature", () => {
  it("does the thing", () => {
    expect(myFunction()).toBe(42);
  });
});
```
