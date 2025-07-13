# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cbT.js is a Node.js server-side template engine that supports multi-level template inheritance. The engine provides rich template syntax, including template inheritance, variable output, conditional control, loop iteration, and other features.

## Development Commands

### Code Linting
```bash
npm run eslint
```

### Testing
```bash
# Run all tests
npm test

# Run individual test files
npm test -- test/index.test.js
npm test -- test/helper.test.js
npm test -- test/layout.test.js
npm test -- test/lockfile.test.js
npm test -- test/utils.test.js

# Run tests in watch mode
npm run test:watch

# Run tests and generate coverage report
npm run test:coverage
```

## Core Architecture

### Main File Structure
- `index.js` - Template engine core entry point, containing compilation and rendering logic
- `lib/layout.js` - Template inheritance system, handling extends, block and other directives
- `lib/helper.js` - Helper function collection, containing HTML escaping, array processing and other utilities
- `lib/lockfile.js` - File locking mechanism for cache file concurrency safety
- `lib/utils.js` - Common utility functions, including file operations, hash generation, etc.

### Template Syntax Features
- **Template Inheritance System**: Supports extends, block, parent, child, slot, call, use directives
- **Variable Output**: Supports HTML escaping, URL escaping, unescaped output and other output methods
- **Control Structures**: if/else, foreach loops
- **Security Features**: Default HTML escaping to prevent XSS attacks
- **Caching Mechanism**: Supports template compilation caching for improved performance

### Key Configuration
- Default delimiters: `<%` and `%>`
- Default extension: `.html`
- Supports custom basePath and cachePath
- HTML escaping enabled by default

### Template Compilation Process
1. Parse template syntax and convert to JavaScript code
2. Handle template inheritance relationships (if extends exists)
3. Merge block content
4. Generate final template function
5. Cache compilation result (optional)

### Caching Strategy
- Cache validity detection based on file modification time
- Use file locks to ensure concurrency safety
- Cache files contain version information and dependency file timestamps

## Testing Instructions

Test files are located in the `test/` directory, using Jest as the testing framework. Test coverage includes:
- `index.test.js` - Core functionality tests
- `helper.test.js` - Helper function tests
- `layout.test.js` - Template inheritance system tests
- `lockfile.test.js` - File locking mechanism tests
- `utils.test.js` - Utility function tests

## Code Style

The project uses ESLint for code linting with the following main rules:
- 2-space indentation
- Console checks disabled
- Enforce const usage (prefer-const)
- Stroustrup brace style
- Strict syntax checks (no unused variables, no undefined variables, etc.)