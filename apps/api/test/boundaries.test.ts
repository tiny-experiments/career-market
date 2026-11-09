import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('../src/', import.meta.url));
async function files(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(join(path, entry.name))
          : [join(path, entry.name)],
      ),
    )
  )
    .flat()
    .filter((f) => f.endsWith('.ts'));
}

/** Dependency edges are parsed by the TypeScript compiler, including reexports and dynamic imports. */
function imports(source: ts.SourceFile): string[] {
  const result: string[] = [];
  function visit(node: ts.Node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      result.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const target = node.arguments[0];
      if (target && ts.isStringLiteral(target)) result.push(target.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}

it('modules use other modules through domain contracts only', async () => {
  const violations: string[] = [];
  for (const file of await files(join(root, 'modules'))) {
    const own = relative(join(root, 'modules'), file).split('/')[0];
    const source = ts.createSourceFile(
      file,
      await readFile(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const imported of imports(source)) {
      if (
        imported === '@cm/core/db' ||
        imported === 'pg' ||
        (imported === 'kysely' && !file.endsWith('/repository.ts'))
      )
        violations.push(
          `${relative(root, file)} imports database implementation ${imported}`,
        );
      if (!imported.startsWith('.')) continue;
      const target = relative(
        join(root, 'modules'),
        resolve(dirname(file), imported),
      );
      const module = target.split('/')[0];
      if (module !== '..' && module !== own && target !== `${module}/domain.ts`)
        violations.push(`${relative(root, file)} imports ${target}`);
    }
  }
  expect(violations).toEqual([]);
});
