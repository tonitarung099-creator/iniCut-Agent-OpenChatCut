import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const ROOT = 'src/agent/tools';
const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...filesUnder(path));
    else if (name.endsWith('.ts') && !name.includes('.verify') && !name.includes('.test')) out.push(path);
  }
  return out;
}

const leaks: Array<{ file: string; line: number; text: string }> = [];

for (const file of filesUnder(ROOT)) {
  const sourceText = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const inspect = (node: ts.Node): void => {
    const literal =
      ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
        ? node.text
        : ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)
          ? node.text
          : null;

    if (literal && CJK.test(literal)) {
      const pos = source.getLineAndCharacterOfPosition(node.getStart(source));
      leaks.push({
        file: relative('.', file).replaceAll('\\', '/'),
        line: pos.line + 1,
        text: literal.replace(/\s+/g, ' ').slice(0, 220),
      });
    }
    ts.forEachChild(node, inspect);
  };

  inspect(source);
}

assert.deepEqual(
  leaks,
  [],
  'Static Chinese text remains in Agent tool runtime:\n'
    + leaks.map((leak) => `${leak.file}:${leak.line} ${leak.text}`).join('\n'),
);

console.log('MiniCut Agent tool runtime contains no static CJK strings');
