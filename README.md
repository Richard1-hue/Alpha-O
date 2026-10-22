# Alpha-O

Alpha-O is an AI-powered GitHub helper that answers questions posted in repository issues.

It is designed to act like a friendly technical mentor: it reads the issue title and body, sends the question to Gemini, and then posts a helpful response back as a GitHub issue comment.

## What the project does

- Watches for new GitHub issues
- Reads the issue title and body
- Sends the question to the Gemini API
- Receives an AI-generated answer
- Posts the answer back to the issue as a comment
- Runs automated CI checks on the repository

## Current workflows

The repository includes GitHub Actions workflows in `.github/workflows/`:

- `hello.yml`  
  A simple smoke test workflow that confirms GitHub Actions is running and prints a basic greeting.

- `reply.yml`  
  The main AI workflow. It triggers when an issue is opened, sends the issue contents to Gemini, and comments with the response.

- `ci.yml`  
  Continuous integration workflow that validates the JavaScript blocks inside `index.html` and checks the HTML structure with `htmlhint`.

## How it works

1. A user opens a new issue in the repository.
2. GitHub Actions triggers the `reply.yml` workflow.
3. The workflow collects the issue title and body.
4. It sends the content to Gemini using the `GEMINI_API_KEY` secret.
5. The AI response is posted as a comment on the same issue.

## Tech stack

- GitHub Issues
- GitHub Actions
- GitHub CLI (`gh`)
- Gemini API
- HTML
- JavaScript
- Node.js

## Repository layout

- `index.html` — main project page
- `.github/workflows/` — GitHub Actions automation
- `README.md` — project documentation

## Setup

To use the AI reply workflow, add the following repository secret:

- `GEMINI_API_KEY`

GitHub Actions also uses the built-in `github.token` for posting comments.

## CI and validation

The project runs automated validation checks on pushes and pull requests to `main`:

- verifies inline JavaScript in `index.html`
- checks the HTML structure
- ensures the repository remains in a valid state before merging changes

## Status

This project is currently a GitHub-based AI helper with automation and validation in place.

- [x] Repository created
- [x] GitHub Actions workflows added
- [x] AI reply workflow connected
- [x] CI validation enabled
- [x] Issue-based question answering working
- [ ] Web UI / chat site (not currently implemented)

## Notes

This repository is not a standalone chat app yet. Instead, it is a lightweight automation project that demonstrates how GitHub Issues can be used as an interface for an AI assistant.

This project is a practical learning project focused on GitHub automation, CI checks, and AI integration.
