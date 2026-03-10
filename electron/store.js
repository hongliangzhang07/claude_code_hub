const fs = require('fs');
const path = require('path');
const os = require('os');

const STORE_DIR = path.join(os.homedir(), '.claude-code-hub');
const STORE_FILE = path.join(STORE_DIR, 'data.json');

function ensureDir() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

function load() {
  ensureDir();
  if (!fs.existsSync(STORE_FILE)) {
    return { projects: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
  } catch (e) {
    return { projects: [] };
  }
}

function save(data) {
  ensureDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = { load, save };
