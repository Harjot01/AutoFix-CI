# 🚀 AutoFix CI -- AI-Powered Self-Healing CI/CD Pipeline

> **Hackathon Proof of Concept**\
> This repository is a demonstration project built to showcase an
> AI-powered CI/CD workflow. The Express application included in this
> repository is intentionally simple---the primary focus is the
> **AutoFix CI automation**, not the sample application's business
> logic.

------------------------------------------------------------------------

# Demo Project Notice

This repository contains a small Express.js application that is used
**only to simulate a real-world software project**.

The demo application provides:

-   A few REST API endpoints
-   Utility functions
-   Jest unit tests
-   Supertest API tests

These files exist solely to create realistic CI scenarios where builds
can pass or fail.

The **actual project** is the automation pipeline that:

1.  Detects a failed build.
2.  Analyzes the failure.
3.  Identifies the changed file and owner.
4.  Uses IBM Consulting Advantage (ICA) to generate a proposed fix.
5.  Creates a new Git branch.
6.  Opens a Pull Request.
7.  Notifies the team through Slack.

------------------------------------------------------------------------

# Features

-   GitHub Actions based CI pipeline
-   Jest + Supertest automated testing
-   Failure log collection
-   Git diff based triage
-   CODEOWNERS parsing
-   GitHub API integration
-   IBM Consulting Advantage integration
-   AI-generated code fixes
-   Automatic Pull Request creation
-   Slack notifications
-   Confidence reporting after validation

------------------------------------------------------------------------

# Repository Structure

``` text
.
├── .github/
│   ├── workflows/
│   │   └── build.yml          # GitHub Actions workflow
│   └── CODEOWNERS             # File ownership rules
│
├── scripts/
│   ├── triage-and-fix.js      # Main AutoFix engine
│   ├── codeowners.js          # CODEOWNERS parser
│   └── slack-map.json         # GitHub → Slack mapping
│
├── src/                       # Demo Express application
│   ├── app.js
│   └── utils.js
│
├── tests/                     # Demo tests
│   ├── app.test.js
│   └── utils.test.js
│
├── package.json
└── README.md
```

------------------------------------------------------------------------

# First-Time Setup

## 1. Clone the repository

``` bash
git clone https://github.com/<username>/<repository>.git
cd <repository>
```

## 2. Install dependencies

``` bash
npm install
```

## 3. Verify the project

``` bash
npm test
```

All tests should pass.

------------------------------------------------------------------------

# Generate Required Credentials

## GitHub Personal Access Token

GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens
(Classic)

Generate a new token with:

-   repo
-   workflow
-   read:user

Copy the generated token.

------------------------------------------------------------------------

## IBM Consulting Advantage API Key

IBM Consulting Advantage

Settings → API Keys → ICA APIs → Generate API Key

Copy the generated API key.

Default model:

    claude-sonnet-4-6

------------------------------------------------------------------------

## Slack Incoming Webhook (Optional)

Create a Slack App.

Enable:

-   Incoming Webhooks

Generate a webhook URL.

Copy the webhook URL.

------------------------------------------------------------------------

# Configure GitHub Repository Secrets

Open your repository.

    Repository
    ↓
    Settings
    ↓
    Secrets and variables
    ↓
    Actions

Click **New repository secret** and create the following.

## Secret 1

**Name**

    GH_PAT

**Value**

Your GitHub Personal Access Token.

------------------------------------------------------------------------

## Secret 2

**Name**

    ICA_API_KEY

**Value**

Your IBM Consulting Advantage API Key.

------------------------------------------------------------------------

## Secret 3

**Name**

    SLACK_WEBHOOK_URL

**Value**

Your Slack Incoming Webhook URL.

------------------------------------------------------------------------

After saving, your repository should contain:

    GH_PAT
    ICA_API_KEY
    SLACK_WEBHOOK_URL

These are automatically injected into the GitHub Action:

``` yaml
env:
  ICA_API_KEY: ${{ secrets.ICA_API_KEY }}
  GH_TOKEN: ${{ secrets.GH_PAT }}
  SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

------------------------------------------------------------------------

# Running the Demo

Checkout the develop branch.

``` bash
git checkout develop
```

Introduce an intentional bug in the demo application (for example inside
`src/utils.js`).

Commit and push.

``` bash
git add .
git commit -m "Introduce failing test"
git push origin develop
```

GitHub Actions will automatically:

1.  Execute Jest & Supertest.
2.  Detect the failure.
3.  Download the failing logs.
4.  Determine the modified file.
5.  Resolve the CODEOWNER.
6.  Call IBM Consulting Advantage.
7.  Generate a proposed fix.
8.  Create an `autofix/*` branch.
9.  Re-run the tests.
10. Open a Pull Request.
11. Send a Slack notification.

------------------------------------------------------------------------

# AutoFix Workflow

``` text
Developer Push
      │
      ▼
GitHub Actions
      │
      ▼
Run Tests
      │
      ▼
Build Failed
      │
      ▼
Failure Triage
      │
      ├── Git Diff
      ├── CODEOWNERS
      ├── GitHub API
      ├── IBM Consulting Advantage
      └── Generate Patch
      │
      ▼
Create AutoFix Branch
      ▼
Open Pull Request
      ▼
Slack Notification
```

------------------------------------------------------------------------

# Troubleshooting

## 403 Permission Denied

-   Ensure `GH_PAT` has the `repo` scope.
-   Verify the secret exists in GitHub Actions.
-   Check repository rules and permissions.

## ICA Errors

-   Verify `ICA_API_KEY`.
-   Verify ICA endpoint.
-   Verify model ID.

## Slack Errors

-   Verify the webhook URL.
-   Ensure Incoming Webhooks are enabled.

------------------------------------------------------------------------

# Security

-   Never commit API keys or tokens.
-   Never hardcode secrets.
-   Every contributor must generate their own:
    -   GitHub PAT
    -   ICA API Key
    -   Slack Webhook (optional)

Repository secrets are encrypted and are **not** cloned with the
repository.

------------------------------------------------------------------------

# License

This project was created for educational and hackathon demonstration
purposes.
