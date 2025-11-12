const fs = require("fs");
const path = require("path");

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const publicDir = path.join(rootDir, "public");

function ensureDist() {
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
}

function copyFile(srcRelative, destRelative) {
  const src = path.join(rootDir, srcRelative);
  if (!fs.existsSync(src)) {
    throw new Error(`缺少文件：${srcRelative}，请先运行 npm run build`);
  }
  const dest = path.join(distDir, destRelative);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyStatic() {
  copyFile("index.html", "index.html");
  copyFile("styles.css", "styles.css");
  copyFile(path.join("public", "main.js"), path.join("public", "main.js"));
  const sourceMap = path.join(publicDir, "main.js.map");
  if (fs.existsSync(sourceMap)) {
    const dest = path.join(distDir, "public", "main.js.map");
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(sourceMap, dest);
  }
}

ensureDist();
copyStatic();

console.log("发布目录已生成：dist/");

