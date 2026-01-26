# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This project is a monorepo that contains the EventCatalog generators. These are plugins that generate documentation for EventCatalog using the EventCatalog SDK.

## Build, Lint, and Test Commands

- **Build**: `pnpm run verify-build:catalog`
- **Test**: `pnpm run test`
- **Format and lint code**: `pnpm run format`

## Code Style Guidelines

### TypeScript

- Strict typing with TypeScript
- ES modules with explicit imports/exports
- Error handling with proper type guards

## Project Structure

- `/packages` - The location of the EventCatalog generators
- `/examples` - Examples of EventCatalog using the generators

Follow existing patterns when adding new code.

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.
