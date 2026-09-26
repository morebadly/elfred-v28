// 前端类型 ↔ 后端真实字段 的对齐检查。
//
// 为什么需要：前端 page2-api.ts 里声明了一堆 `Live*` 类型。如果字段名和后端实际返回不一致，
// 页面不会报错，只会静默显示 undefined —— 这种错最难发现。这个脚本把两边 diff 出来。
//
// 用法：node tools/page2-checks/page2-field-alignment.mjs       （后端要在跑）
// 退出码：发现"前端声明了、后端没有"的字段 → 非 0（那才是会出问题的一类）。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = process.env.PAGE2_API || "http://127.0.0.1:8000";
// ⚠️ 不能用 new URL(...).pathname：仓库路径里有中文，它给的是百分号编码（%E5%86%85…），
// 直接拿去 readFileSync 会 ENOENT。fileURLToPath 会正确解码（Windows 盘符也处理）。
const HERE = path.dirname(fileURLToPath(import.meta.url));
// ⚠️ 第二页的代码 2026-09-25 收进了一个模块（pages24），路径跟着搬过：
//    app/v28/features/knowledge/page2-api.ts → app/v28/features/pages24/api/page2-api.ts
//    老路径写死过一次，重构之后就 ENOENT 了 —— 改路径时记得连这里一起改。
const API_FILE = path.resolve(HERE, "../../app/v28/features/pages24/api/page2-api.ts");

// 前端声明的类型 → 对应要打的后端接口
const MAP = [
  ["LiveCapability", "/capabilities", "list"],
  ["LiveInsight", "/insight/abilities", "one"],
  ["LiveAlignment", "/alignment", "one"],
  ["LiveMemory", "/memory", "one"],
  ["LiveDocument", "/documents", "list"],
  ["LivePending", "/materials/pending", "list"],
  ["LiveSkill", "/page2/skills", "list"],
  ["LiveProfile", "/page2/profile", "one"],
  ["LiveBadge", "/page2/badges", "nested:badges"],
  ["LiveRelationship", "/page2/relationships", "nested:relationships"],
  ["LiveHygiene", "/page2/memory/hygiene", "one"],
];

/** 从 page2-api.ts 里把 `export type X = { ... }` 的字段名抠出来 */
function declaredFields(source, typeName) {
  const start = source.indexOf(`export type ${typeName} = {`);
  if (start < 0) return null;
  let depth = 0;
  let body = "";
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") {
      depth++;
      if (depth > 1) continue;      // 嵌套对象里的内容不算外层字段
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0) break;
      continue;
    }
    // 只收集最外层的正文：这样 `gap?: { have: number } | null` 只贡献 `gap`，不会把 have 也算上
    if (depth === 1) body += ch;
  }
  const fields = new Set();
  // ⚠️ 不能只按换行切：有的类型是单行声明的（`export type X = { a: string; b: number };`），
  // 那样按行招不到字段，会**假通过**（声明 0 个字段 → 自然"没有缺字段"）。所以换行和分号都当分隔。
  for (const chunk of body.split(/[\n;]/)) {
    const match = /^\s*([A-Za-z_][\w]*)\s*[?]?\s*:/.exec(chunk);
    if (match) fields.add(match[1]);
  }
  return fields;
}

function actualFields(sample) {
  if (Array.isArray(sample)) return new Set(sample.length ? Object.keys(sample[0]) : []);
  return new Set(sample && typeof sample === "object" ? Object.keys(sample) : []);
}

const source = fs.readFileSync(API_FILE, "utf8");
let problems = 0;
console.log(`接口：${API}\n类型文件：${API_FILE}\n`);

for (const [typeName, endpoint, shape] of MAP) {
  const declared = declaredFields(source, typeName);
  if (!declared) {
    console.log(`⚠️  ${typeName}：前端里没找到这个类型（脚本要跟着改？）`);
    continue;
  }
  if (declared.size === 0) {
    // 解析出 0 个字段 → 说明解析器没读懂这个类型，**不能当成"对齐"**
    console.log(`❌ ${typeName}：解析不出任何字段（检查脚本要改，别让它假通过）`);
    problems++;
    continue;
  }
  let payload = null;
  try {
    const response = await fetch(`${API}${endpoint}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    payload = await response.json();
  } catch (error) {
    console.log(`⚠️  ${endpoint}：拿不到（${String(error).slice(0, 60)}），跳过`);
    continue;
  }
  let sample = payload;
  if (shape.startsWith("nested:")) sample = payload?.[shape.slice(7)];
  if (shape === "list") sample = Array.isArray(payload) ? payload : payload?.items;
  const actual = actualFields(sample);
  if (actual.size === 0) {
    console.log(`–  ${typeName.padEnd(18)} ${endpoint}：这次没有数据，跳过比对`);
    continue;
  }
  const missing = [...declared].filter((field) => !actual.has(field));
  const extra = [...actual].filter((field) => !declared.has(field));
  const flag = missing.length ? "❌" : "✅";
  if (missing.length) problems++;
  console.log(`${flag} ${typeName.padEnd(18)} ${endpoint}`);
  if (missing.length) console.log(`     前端声明了、后端没有（会导致 undefined）：${missing.join(", ")}`);
  if (extra.length) console.log(`     后端返回了、前端没声明（可能没用上）：${extra.join(", ")}`);
}

console.log(`\nRESULT: ${problems === 0 ? "ALIGNED" : `${problems} 个类型有缺字段`}`);
process.exit(problems === 0 ? 0 : 1);
