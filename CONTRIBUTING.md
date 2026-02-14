# Contributing to Browserlet

Thank you for your interest in contributing to Browserlet!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/browserlet.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development

```bash
# Start development server with HMR (Chrome)
npm run dev

# Start development server for Firefox
npm run dev:firefox

# Run tests
npm run test

# Type check
npm run typecheck

# Build for production (Chrome)
npm run build

# Build for production (Firefox)
npm run build:firefox
```

### Browser-Specific Development

Browserlet supports both Chrome and Firefox. The build output is located in:
- Chrome: `.output/chrome-mv3`
- Firefox: `.output/firefox-mv2`

When working on browser-specific code, use the `isFirefox` and `isChrome` utilities from `utils/browser-detect.ts`.

### Loading the Extension

**Chrome:**
1. Run `npm run build` (production) or `npm run dev` (with HMR)
2. Open `chrome://extensions`, enable Developer Mode
3. Click "Load unpacked", select `.output/chrome-mv3`

**Firefox:**
1. Run `npm run build:firefox` (production) or `npm run dev:firefox` (with HMR)
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on", select any file in `.output/firefox-mv2`
4. Note: Temporary add-ons are removed when Firefox closes

For detailed browser compatibility information, see [docs/BROWSER_COMPATIBILITY.md](docs/BROWSER_COMPATIBILITY.md).

## Pull Request Process

1. Ensure your code passes all tests and type checks
2. Update documentation if needed
3. Follow the commit message format (see below)
4. Submit a PR with a clear description of changes

## Commit Messages

Use conventional commits:

```
feat(scope): add new feature
fix(scope): fix bug description
docs(scope): update documentation
test(scope): add tests
refactor(scope): refactor code
```

Examples:
- `feat(recording): add support for drag-and-drop events`
- `fix(playback): handle timeout on slow networks`
- `docs(readme): add installation instructions`

## Code Style

- TypeScript with strict mode
- No `any` types without justification
- Prefer functional patterns
- Keep functions small and focused

## Reporting Issues

When reporting issues, please include:

1. Browser version
2. Extension version
3. Steps to reproduce
4. Expected vs actual behavior
5. Console logs if relevant

## License

By contributing, you agree that your contributions will be licensed under AGPL-3.0.
