# 🧠 CommitWise

> AI-powered Git commit message generator with intelligent code scanning

[![npm version](https://img.shields.io/npm/v/commitwise.svg)](https://www.npmjs.com/package/commitwise)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

CommitWise leverages OpenAI's GPT models to automatically generate meaningful, [Conventional Commits](https://www.conventionalcommits.org/) formatted commit messages while optionally scanning your code for potential issues, bugs, and security vulnerabilities.

---

## 📑 Table of Contents

-   [✨ Features](#-features)
-   [🚀 Installation](#-installation)
-   [⚙️ Setup](#️-setup)
-   [📖 Usage](#-usage)
-   [🔧 Configuration](#-configuration)
-   [🔍 How It Works](#-how-it-works)
-   [🛠️ Troubleshooting](#️-troubleshooting)
-   [📄 License](#-license)

---

## ✨ Features

-   🤖 **AI-Powered Commit Messages** - Automatically generates meaningful commit messages using OpenAI GPT
-   🔍 **Intelligent Code Scanning** - Detects runtime errors, bugs, and security issues in your changes
-   ✅ **Conventional Commits Format** - Follows industry-standard commit message conventions
-   🎯 **Interactive Workflow** - Review, edit, or regenerate suggested messages
-   ⚡ **Multiple Commands** - Choose between auto-commit, scan-only, or suggest-only modes
-   🎨 **Frontend-Aware** - Special checks for frontend code quality
-   🔒 **Secure** - Keeps your API key safe with environment variables or local config

---

## 🚀 Installation

Install CommitWise globally via npm:

```bash
npm install -g commitwise
```

---

## ⚙️ Setup

### Option 1: Environment Variable (Recommended)

Set your OpenAI API key as an environment variable:

**For Zsh (macOS default):**

```bash
echo 'export OPENAI_API_KEY="sk-your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

**For Bash:**

```bash
echo 'export OPENAI_API_KEY="sk-your-api-key-here"' >> ~/.bashrc
source ~/.bashrc
```

### Option 2: Configuration File

Create a `~/.commitwiserc.json` file in your home directory:

```json
{
    "openaiApiKey": "sk-your-api-key-here"
}
```

> 💡 **Tip:** You can also place `.commitwiserc.json` in your project root to override global settings.

---

## 📖 Usage

### `commitwise auto` - Interactive Commit Workflow

The complete workflow: scan your changes (if enabled), generate a commit message, and commit interactively.

```bash
# Stage your changes
git add .

# Run the interactive commit flow
commitwise auto
```

**This command will:**

1. ✅ Run code quality checks on staged changes (if `scanEnabled: true`)
2. 🤖 Generate an AI-powered commit message
3. 💬 Let you **accept**, **edit**, or **regenerate** the message
4. 📦 Commit your changes with the final message

---

### `commitwise scan` - Code Analysis Only

Scan your staged changes for potential issues without generating a commit message.

```bash
# Stage your changes
git add .

# Scan for issues
commitwise scan
```

**Perfect for:**

-   Pre-commit quality checks
-   CI/CD pipeline integration
-   Quick code reviews

---

### `commitwise suggest` - Message Generation Only

Generate a commit message without scanning or committing.

```bash
# Stage your changes
git add .

# Get a suggested commit message
commitwise suggest
```

**Outputs a commit message like:**

```
feat: add user authentication with JWT tokens
```

---

## 🔧 Configuration

CommitWise can be configured via `.commitwiserc.json` in your home directory (`~`) or project root.

### Configuration Options

| Option                   | Type      | Default       | Description                                       |
| ------------------------ | --------- | ------------- | ------------------------------------------------- |
| `openaiApiKey`           | `string`  | `undefined`   | Your OpenAI API key (can also use env variable)   |
| `model`                  | `string`  | `gpt-4o-mini` | OpenAI model to use for generation                |
| `maxCommitMessageLength` | `number`  | `72`          | Maximum length of the commit message subject line |
| `scanEnabled`            | `boolean` | `true`        | Enable/disable code scanning before committing    |

### Example Configuration

```json
{
    "openaiApiKey": "sk-your-api-key-here",
    "model": "gpt-4o-mini",
    "maxCommitMessageLength": 72,
    "scanEnabled": true
}
```

### Available Models

You can use any OpenAI chat model:

-   `gpt-4o-mini` (default, cost-effective)
-   `gpt-4o`
-   `gpt-4-turbo`
-   `gpt-4`

---

## 🔍 How It Works

1. **📊 Analyze Changes** - Examines your staged changes using `git diff --cached`
2. **🔬 Code Scanning** - Optionally scans for:
    - Runtime errors and exceptions
    - Potential bugs and logic issues
    - Security vulnerabilities
    - Frontend-specific issues (console logs, debugging code, etc.)
3. **🤖 AI Generation** - Sends context to OpenAI GPT to generate a meaningful commit message
4. **📝 Conventional Format** - Formats messages following [Conventional Commits](https://www.conventionalcommits.org/):
    - `feat:` - New features
    - `fix:` - Bug fixes
    - `docs:` - Documentation changes
    - `style:` - Code style changes
    - `refactor:` - Code refactoring
    - `test:` - Test additions/changes
    - `chore:` - Maintenance tasks

### Example Output

**For adding a new feature:**

```
feat: add user login with OAuth2 integration
```

**For fixing a bug:**

```
fix: handle null pointer in user profile update
```

**For refactoring:**

```
refactor: extract validation logic into separate module
```

---

## 🛠️ Troubleshooting

### ❌ "OPENAI API key not found"

**Solution:** Set the `OPENAI_API_KEY` environment variable or add it to your `.commitwiserc.json` file.

```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```

---

### ❌ "No staged changes detected"

**Solution:** Stage your changes before running CommitWise:

```bash
git add .
# or stage specific files
git add path/to/file.ts
```

---

### ❌ API Rate Limits or Errors

**Solution:** Check your OpenAI account status and API key permissions at [platform.openai.com](https://platform.openai.com/).

---

### 💡 Getting Help

-   🐛 [Report an issue](https://github.com/pmenika/commitwise/issues)
-   📖 [Read the docs](https://github.com/pmenika/commitwise#readme)

---

## 📄 License

ISC © Purnima Van der Laan

---

<div align="center">
  
**Made with ❤️ and 🤖 AI**

[⭐ Star on GitHub](https://github.com/pmenika/commitwise) • [📦 View on npm](https://www.npmjs.com/package/commitwise)

</div>
