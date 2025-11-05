# Development Guide

## Available NPM Scripts

### Running the Application

```bash
# Run the example scheduler (shows both therapy and assessment slots)
npm start
# or
npm run dev

# Run with auto-restart on file changes (requires ts-node-dev)
npm run dev:watch
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-reruns on file changes)
npm test:watch

# Run tests with coverage report
npm test:coverage
```

### Building

```bash
# Compile TypeScript to JavaScript
npm run build
# or
npm run compile

# Type-check without emitting files
npm run type-check
```

### Code Quality

```bash
# Lint code
npm run lint

# Lint and auto-fix issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check code formatting
npm run format:check
```

## Quick Development Workflow

1. **Make changes** to `src/scheduler.ts` or test files
2. **Run tests** with `npm test:watch` (in one terminal)
3. **Type-check** with `npm run type-check`
4. **Test manually** with `npm run dev`
5. **Format code** with `npm run format`
6. **Lint** with `npm run lint:fix`

## Example Output

The `npm run dev` command demonstrates:
- 🩺 **Therapy intake slots** - Finding 60-minute slots with therapists
- 🧠 **Assessment slots** - Finding 90-minute slot pairs with psychologists
- ✅ **Validation** - Testing against the 6 specific slots from the README

Both types of appointments respect capacity constraints and eligibility criteria.
