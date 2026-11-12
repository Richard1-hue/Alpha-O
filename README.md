# Alpha-O

Alpha-O is a browser-based AI chat app and workflow-planning workspace. The repository also contains GitHub Actions workflows, including an AI-assisted reply to newly opened issues. The browser app is static HTML, CSS, and JavaScript; its chat and some Automate features use an external Cloudflare Worker.

## Project features

### Alpha-O chat app

The main app is `index.html`. It loads its interface and scripts from the HTML fragments in `components/` at runtime. Serve the repository over HTTP or HTTPS; opening `index.html` directly with a `file://` URL will not work because the component loader uses `fetch()`.

The app includes chat conversations and browser-local history, chat search and editing, assistant modes, streaming responses, Markdown and code display, file attachments, voice input and speech, and a 3D voice interface. It also provides theme and voice settings, keyboard shortcuts, responsive layouts, and reduced-motion support. Exact features depend on browser support and on the external service being available.

Chat and visit-analytics requests are sent to the Cloudflare Worker configured in the app. The Worker/backend is not included in this repository. The service worker caches parts of the app shell and selected static resources; it does not cache chat/API requests. `index.html` and `sw.js` reference `manifest.webmanifest`, but that file is not present in the repository, so the app's manifest/PWA setup is incomplete.

### Automate workspace

Open `automate/automate.html` to use the workflow workspace. It includes a dashboard, workflow builder, templates, search and filters, simulated test runs and reports, and preview screens for workspaces/clients, integrations, and roles/access.

Workflow drafts are stored in browser local storage by default. The dashboard can connect to an external Cloudflare database using an admin token; when connected, workflow listing, creation, editing, and deletion use the external Worker API. The Automate AI proposal feature uses local keyword rules when disconnected, and can request an AI proposal through that API when connected. The backend and its provider configuration are external to this repository.

**Automate does not execute real automations.** The test engine simulates triggers, evaluates supported conditions against supplied test data, and previews actions. It does not send emails or notifications, change external services, run schedules, or operate in the background. Workspace/client examples and integration and role/access screens are previews; they do not represent connected integrations or enforce permissions.

### GitHub issue replies

`.github/workflows/reply.yml` runs when an issue is opened. It sends the issue title and body to the Gemini API using the `GEMINI_API_KEY` Actions secret, then posts the generated response as an issue comment. If the API does not return an answer, the workflow posts a fallback message. The workflow requests `issues: write` permission and uses the built-in GitHub token to post comments.

## Repository layout

```text
.
├── index.html                         Main chat app and component loader
├── admin.html                         Additional HTML page
├── sw.js                              Service worker for app-shell/resource caching
├── favicon.png, logo.png              Image assets
├── apple-touch-icon.png               Apple touch icon
├── icon-192.png, icon-512.png         App icons
├── components/                        Runtime-loaded chat app fragments
│   ├── app-updates.html
│   ├── automate.html
│   ├── chat-extras.html
│   ├── chat.html
│   ├── dialogs.html
│   ├── read-aloud.html
│   ├── robot-3d.html
│   ├── settings.html
│   ├── sidebar.html
│   ├── startup.html
│   ├── voice-extras.html
│   ├── voice-mode.html
│   └── voice-plus.html
├── automate/
│   ├── automate.html                  Automate workspace UI
│   ├── automate.css                   Workspace styles
│   ├── automate.js                    Workspace and workflow logic
│   ├── engine.js                      Simulation-only test engine
│   └── alpha-o-logo.png               Automate logo
└── .github/
    ├── ISSUE_TEMPLATE/                Issue forms
    └── workflows/
        ├── ci.yml                     Repository validation
        ├── hello.yml                  Push smoke test
        └── reply.yml                  AI response to newly opened issues
```

## Running locally

This is a static HTML/CSS/JavaScript project; it has no package manifest or build step. From the repository root, start a local static server:

```bash
python -m http.server 8000
```

Then open:

- Chat app: <http://localhost:8000/>
- Automate workspace: <http://localhost:8000/automate/automate.html>

The service worker registers on HTTPS or `localhost`. Chat needs the external Cloudflare Worker. Automate can be used with browser-local workflow storage and simulated tests; online workflow storage and AI proposals require the external Worker and a valid admin token.

## GitHub Actions setup

To enable issue replies, add a repository Actions secret named `GEMINI_API_KEY`. The workflow runs only for newly opened issues and needs permission to write issue comments. Issue form templates are provided under `.github/ISSUE_TEMPLATE/`.

## CI and validation

`.github/workflows/ci.yml` runs on pushes and pull requests targeting `main`. It checks that `index.html` and the three main Automate files exist, uses Node.js 20 to syntax-check inline JavaScript in `index.html`, and runs `htmlhint` on `index.html` and `automate/automate.html`. `hello.yml` is a separate push smoke test.

## Technology

- HTML, CSS, and vanilla JavaScript
- GitHub Actions and GitHub Issues
- Gemini API for the issue-reply workflow
- External Cloudflare Worker for chat, visit analytics, and optional Automate cloud storage/AI proposals
- Browser APIs including local storage, session storage, service workers, speech recognition, and speech synthesis
- Three.js, loaded from a CDN, for the voice-mode robot

## Current limitations

- The chat/analytics backend and Automate's cloud API are hosted separately and are not included here.
- Automate's workflow test engine is simulation-only; it is not a production automation service.
- Real integrations, scheduled/background triggers, and permission enforcement are not implemented in the browser app.
- `manifest.webmanifest` is referenced but absent from the repository.
