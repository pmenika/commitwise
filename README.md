# Safe Commit

AI-powered Git commit message generator with code scanning using OpenAI GPT.

## Installation

```bash
cd safe-commit
npm install -g .
```

## Setup

Set your OpenAI API key:

```bash
echo 'export OPENAI_API_KEY="sk-your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

Or create `~/.safe-commitrc.json`:

```json
{
    "openaiApiKey": "sk-your-api-key-here"
}
```

## Usage

### Interactive commit

```bash
git add .
safe-commit auto
```

Scans staged changes, generates a commit message, and lets you accept/edit/regenerate.

### Suggest only

```bash
git add .
safe-commit suggest
```

Prints a commit message without committing.

## Configuration

Create `.safe-commitrc.json` in your home directory or project root:

```json
{
    "model": "gpt-4o-mini",
    "maxCommitMessageLength": 72,
    "scanEnabled": true
}
```

## How it Works

-   Analyzes staged changes (`git diff --cached`)
-   Scans for runtime errors, bugs, and security issues
-   Generates Conventional Commits formatted messages
-   Examples: `feat: add user login`, `fix: handle null pointer`

## Troubleshooting

**"OPENAI API key not found"** - Set the `OPENAI_API_KEY` environment variable

**"No staged changes detected"** - Run `git add` before using the tool

## License

ISC
