import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';

const cache = new Map();
export async function loadConversationModule(relative) {
  const url = new URL(`../../src/${relative}.ts`, import.meta.url);
  if (!existsSync(url)) return {};
  function compile(file) {
    if (cache.has(file.href)) return cache.get(file.href);
    let source = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    source = source.replace(/from ['"]([^'"]+)['"]/g, (_, specifier) => {
      const dependency = specifier.startsWith('@/')
        ? new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url)
        : new URL(`${specifier}.ts`, file);
      return `from '${compile(dependency)}'`;
    });
    const data = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
    cache.set(file.href, data);
    return data;
  }
  return import(compile(url));
}
