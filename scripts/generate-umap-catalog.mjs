#!/usr/bin/env node
/**
 * Launcher wrapper for generate-umap-catalog.ts
 */
import { spawnSync } from 'child_process';
import path from 'path';

const root = process.cwd();
const scriptPath = path.join(root, 'scripts', 'generate-umap-catalog.ts');
const result = spawnSync('npx', ['tsx', scriptPath], { stdio: 'inherit' });
process.exit(result.status ?? 0);

