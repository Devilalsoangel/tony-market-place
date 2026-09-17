// Functional smoke test for src/lib/media.ts — transpiles the SHIPPED source
// with the project's own TypeScript and asserts the validation contract.
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const ROOT = "C:/Users/TONI/projects/social-commerce/susej-admin-panel";
const ts = require(path.join(ROOT, "node_modules", "typescript"));
const src = fs.readFileSync(path.join(ROOT, "src/lib/media.ts"), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: "es2019" } }).outputText;
const mod = { exports: {} };
new Function("exports", "require", "module", js)(mod.exports, require, mod);
const { resolveMediaUrl, validateMediaRefs } = mod.exports;

// resolveMediaUrl
assert.strictEqual(resolveMediaUrl("/uploads/a.png"), "http://localhost:3000/uploads/a.png");
assert.strictEqual(resolveMediaUrl("https://x.com/a.png"), "https://x.com/a.png");
assert.strictEqual(resolveMediaUrl(""), "");

// validateMediaRefs — the exact carry-over bug classes must be rejected
assert.strictEqual(validateMediaRefs(["file:///storage/emulated/0/pic.jpg"], { min: 1, max: 1 }).ok, false, "file:// must be rejected");
assert.strictEqual(validateMediaRefs(["data:image/png;base64,AAA"], { min: 1, max: 1 }).ok, false, "data: must be rejected");
assert.strictEqual(validateMediaRefs(["content://media/image/1"], { min: 1, max: 1 }).ok, false, "content:// must be rejected");
// hosted + root-relative uploads pass
assert.strictEqual(validateMediaRefs(["/uploads/b.jpg"], { min: 1, max: 1 }).ok, true);
assert.strictEqual(validateMediaRefs(["https://cdn.example/x.jpg"], { min: 1, max: 10, field: "image" }).ok, true);
// bounds
assert.strictEqual(validateMediaRefs([], { min: 1, max: 1 }).ok, false);
assert.strictEqual(validateMediaRefs(["http://a/1", "http://a/2", "http://a/3"], { min: 1, max: 2, field: "image" }).ok, false);
console.log("MEDIA_HELPERS_ALL_PASS");
