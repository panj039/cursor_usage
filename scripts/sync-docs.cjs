const fs = require("fs");
const path = require("path");

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const docsDir = path.join(rootDir, "docs");

function ensureDistExists() {
  if (!fs.existsSync(distDir)) {
    throw new Error("未找到 dist/ 目录，请先运行 npm run release。");
  }
}

function resetDocsDir() {
  if (fs.existsSync(docsDir)) {
    fs.rmSync(docsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(docsDir, { recursive: true });
}

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

ensureDistExists();
resetDocsDir();
copyRecursive(distDir, docsDir);

console.log("已将 dist/ 同步至 docs/，可以提交发布。");

