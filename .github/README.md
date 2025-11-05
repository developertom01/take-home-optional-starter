# GitHub Actions CI

This project includes automated continuous integration (CI) checks using GitHub Actions.

## What Gets Checked

Every push and pull request automatically runs:

1. **TypeScript Type Checking** - `tsc --noEmit`
   - Ensures all TypeScript code is properly typed
   - No type errors allowed

2. **ESLint** - `npm run lint`
   - Checks code style and quality
   - Enforces consistent formatting

3. **Jest Tests** - `npm test`
   - Runs all unit tests
   - Ensures all 19 tests pass
   - Validates business logic

## CI Matrix

Tests run on multiple Node.js versions:
- Node.js 18.x
- Node.js 20.x

This ensures compatibility across different Node versions.

## Running Checks Locally

Before pushing code, you can run all checks locally:

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Tests
npm test

# Or run all at once
npm run type-check && npm run lint && npm test
```

## CI Workflow File

Location: `.github/workflows/ci.yml`

### Triggers

The CI runs on:
- **Push** to `main` or `master` branch
- **Pull requests** to `main` or `master` branch

### Steps

1. Checkout code
2. Setup Node.js (matrix: 18.x, 20.x)
3. Install dependencies (`npm ci`)
4. Run type checking
5. Run ESLint
6. Run tests
7. Upload coverage (Node 20 only)

## Status Badge

Add this to your README.md (replace with your repo details):

```markdown
[![CI](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/actions/workflows/ci.yml)
```

## Troubleshooting

### Type Errors
```bash
npm run type-check
```
Fix any TypeScript errors shown.

### Lint Errors
```bash
npm run lint
```
Fix code style issues. Most can be auto-fixed:
```bash
npx eslint . --fix
```

### Test Failures
```bash
npm test
```
Review failing tests and fix the underlying issues.

## CI Failure Checklist

If CI fails, check:

- [ ] Do types pass locally? (`npm run type-check`)
- [ ] Does lint pass locally? (`npm run lint`)
- [ ] Do tests pass locally? (`npm test`)
- [ ] Are all dependencies installed? (`npm ci`)
- [ ] Is the code committed and pushed?

## Best Practices

1. **Run checks before committing**
   ```bash
   npm run type-check && npm run lint && npm test
   ```

2. **Keep CI fast** - Currently completes in ~30 seconds

3. **Fix broken builds immediately** - Don't let CI stay red

4. **Review CI logs** when failures occur - they show exactly what failed

## Adding More Checks

To add additional CI checks, edit `.github/workflows/ci.yml`:

```yaml
- name: Your new check
  run: npm run your-command
```

Then add the corresponding script to `package.json`:

```json
"scripts": {
  "your-command": "..."
}
```
