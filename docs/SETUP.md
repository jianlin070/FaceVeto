# Developer setup

This guide takes a new teammate from a fresh Mac to running FaceVeto locally and deploying it. Follow it by hand, or give it to Claude Code (see the next section).

Time needed: about 30 to 45 minutes, most of it downloads.

## Using Claude Code to do it for you

Open a terminal in the folder where you want the project, start `claude`, and paste:

```
Set up the FaceVeto project for me by following docs/SETUP.md from
https://github.com/jianlin070/FaceVeto (clone it first if it is not here yet).
Work through the steps in order and run the checks after each one.
Login steps open a browser: tell me the exact command and I will run it
myself with the ! prefix. Do not deploy, seed or run anything against the
live site unless I ask. Follow the "Rules for working on this repo" section.
```

Claude Code cannot sign in for you. When it reaches a login step, type the command it gives you with a `!` in front (for example `! gcloud auth login`), finish the sign-in in the browser, then tell Claude Code to continue.

## 0. Before you start: ask for access

The repo and the cloud project are private. Send your Google account email and GitHub username to the project owner and ask for:

1. **GitHub:** collaborator access to `jianlin070/FaceVeto` (repo Settings > Collaborators > Add people). Accept the email invite.
2. **Google Cloud:** a role on project `faceveto-2026` (Console > IAM & Admin > IAM > Grant access).
   - To run locally and deploy: **Owner** is simplest for a hackathon team.
   - Least privilege alternative: **Editor** plus **Cloud Run Admin** plus **Service Account User**. Editor alone cannot deploy, because the deploy sets the service's public access policy.
   - Firebase uses the same Google Cloud permissions, so no separate Firebase invite is needed.

Use the same Google account for every login below.

## 1. Install the tools (macOS)

```bash
# Apple's compilers (needed to build the face model library). Click Install in the popup.
xcode-select --install

# Homebrew, if you do not have it: https://brew.sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install git gh python@3.11 node@22
brew install --cask google-cloud-sdk
npm install -g firebase-tools
```

If `node --version` does not show v22 after installing, run `brew link --overwrite node@22`, or follow the PATH line that Homebrew prints.

On Windows, install WSL2 with Ubuntu and follow the same steps inside it, using `apt` and the official installers for the gcloud CLI and Node 22.

**Check:**

```bash
git --version
python3.11 --version     # Python 3.11.x
node --version           # v22.x
gcloud --version
firebase --version
gh --version
```

## 2. Sign in (each opens a browser)

```bash
gh auth login                                  # GitHub.com > HTTPS > log in with a web browser
gcloud auth login                              # lets the gcloud CLI deploy
gcloud config set project faceveto-2026
gcloud auth application-default login          # lets the local API reach Firestore, Storage and Gemini
gcloud auth application-default set-quota-project faceveto-2026
firebase login                                 # lets the Firebase CLI deploy hosting
```

**Check:**

```bash
gh auth status                                         # Logged in to github.com
gcloud config get account                              # your Google email
gcloud config get project                              # faceveto-2026
gcloud auth application-default print-access-token >/dev/null && echo ADC ok
firebase projects:list | grep faceveto-2026
gcloud run services list --region asia-southeast1      # shows faceveto-api (proves your IAM role works)
```

If the last command says permission denied, the IAM role from step 0 has not been granted yet.

## 3. Clone the repo

```bash
gh repo clone jianlin070/FaceVeto
cd FaceVeto
```

## 4. Install the dependencies

Backend (Python 3.11 virtual environment in `api/.venv`):

```bash
python3.11 -m venv api/.venv
api/.venv/bin/pip install --upgrade pip
api/.venv/bin/pip install -r api/requirements-dev.txt
```

Frontend:

```bash
cd web && npm ci && cd ..
```

The Firebase web config is already in `web/.env` (it is public and safe to commit). There are no secret keys to set up: the backend uses the Google login from step 2.

**Check:**

```bash
make test                     # backend unit tests, all should pass (no cloud access needed)
cd web && npm run build && cd ..   # type check and production build
```

## 5. Run it locally

```bash
make dev
```

This starts the API on http://localhost:8080 and the web app on http://localhost:5173 (it forwards `/api` to the local API). Open http://localhost:5173.

- The first API start downloads the face model (about 300 MB) to `~/.insightface`. Wait for the log line saying the app is ready.
- The local API talks to the **real** Firestore, Storage and Gemini in `faceveto-2026`. Anything you post locally appears on the live site. Use your own test account and clean up after yourself.
- The demo login buttons (Alice, Bob, Admin) are off locally. To turn them on:

  ```bash
  cd api && DEMO_MODE=true SIGNER_SERVICE_ACCOUNT=faceveto-api@faceveto-2026.iam.gserviceaccount.com \
    .venv/bin/uvicorn app.main:app --reload --port 8080
  ```

  This needs the **Service Account Token Creator** role on that service account (Owner includes it).

Stop with Ctrl+C.

## 6. Deploy (only when the team agrees)

Deploying replaces the live site at https://faceveto-2026.web.app for everyone.

```bash
make deploy-api     # Cloud Run, takes 5 to 10 minutes (builds the container)
make deploy-web     # builds web/ and uploads it to Firebase Hosting, about 1 minute
```

`make deploy` runs both. Then open the live site and check that it works.

The end-to-end check creates and cleans up test posts on the live site:

```bash
api/.venv/bin/python scripts/e2e_demo.py
```

Do not run `scripts/setup_gcp.sh` or `scripts/seed.py`. The cloud project and demo data are already set up.

## Rules for working on this repo

- Work on `main`. Pull before you start (`git pull`), commit small steps with clear messages, and never force-push.
- Do not add AI tools as authors or co-authors: no `Co-Authored-By` or "Generated with" lines in commits or PRs.
- Never commit secrets, service account keys or `.env` files with secrets. `web/.env` is the only exception (public config).
- Never delete cloud resources (projects, Cloud Run services, Firestore databases, buckets) or the repo.
- Do not delete other people's posts or cases on the live site. They are real team testing.
- Privacy rules: no endpoint that takes a face and returns who it is, never show match information to the poster, and never log face embeddings, tokens or image bytes.
- Only use faces of teammates who agreed to it for demo data. Public dataset faces (LFW) are only for automated tests. No real sexual content.
- Do not use em dashes in docs, UI text or commit messages. Use commas, colons or periods.

## Troubleshooting

| Problem | Fix |
|---|---|
| `pip install` fails building `insightface` | Run `xcode-select --install`, then reinstall. Make sure the venv uses Python 3.11 (`api/.venv/bin/python --version`). |
| API error `DefaultCredentialsError` | Run `gcloud auth application-default login` again. |
| API error `403 PERMISSION_DENIED` from Firestore or Vertex AI | Your IAM role is missing. Check step 0. |
| `firebase deploy` says no access to the project | Run `firebase login` with the same Google account that has the IAM role. |
| `gcloud run deploy` fails at "Setting IAM Policy" | You need Cloud Run Admin (or Owner). |
| Web page loads but every action fails | The API is not running on port 8080. Start it with `make api` in a second terminal. |
| Port 8080 or 5173 already in use | `lsof -i :8080` to find the process, then quit it. |
