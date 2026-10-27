// Guards the split between the two parts of the app (see src/README.md):
//   shared/   used by both; imports neither part
//   trading/  Hyperliquid trading; imports shared/ only
//   game/     game and general UI; imports shared/ and trading's public API (trading/index.ts) only
//   admin/    the admin dashboard page (admin.html); imports shared/ only
//   @server/  the API (../server/src): web code may import only @server/contract (shapes and rules), and only
//             shared/api.ts may import @server/local (the in-browser server); the server never imports web code
// Stylesheets are scoped the same way: trading rules under .trading, game rules under .game.

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const SRC = import.meta.dir;

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? files(p, ext) : ext.test(e.name) ? [p] : [];
  });
}

/** Local imports of a file, resolved to paths relative to src/ (without extension). */
function localImports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const specs = [...text.matchAll(/(?:import|export)\s[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]|import\s+['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)]
    .map((m) => m[1] ?? m[2] ?? m[3]);
  return specs.map((s) => relative(SRC, resolve(dirname(file), s)).replace(/\.(tsx?|css)$/, ''));
}

/** `@server/...` imports of a file. */
const serverImports = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(/(?:from\s+|import\(\s*)['"](@server\/[^'"]+)['"]/g)].map((m) => m[1]);

const part = (path: string) => path.split('/')[0];
const code = files(SRC, /\.tsx?$/).filter((f) => !f.endsWith('.test.ts'));

describe('code boundaries', () => {
  for (const file of code) {
    const rel = relative(SRC, file);
    const from = part(rel);
    test(rel, () => {
      // Each broken import is reported with its path, so a failure says exactly what to fix.
      const broken = localImports(file).filter((to) => {
        const target = part(to);
        if (from === 'shared') return target === 'trading' || target === 'game';
        if (from === 'trading') return target === 'game' || to === 'App';
        if (from === 'admin') return target === 'game' || target === 'trading' || to === 'App';
        return target === 'trading' && to !== 'trading' && to !== 'trading/index';
      });
      expect(broken).toEqual([]);
      const server = serverImports(file).filter((s) => s !== '@server/contract' && !(s === '@server/local' && rel === 'shared/api.ts'));
      expect(server).toEqual([]);
    });
  }
});

describe('server boundary', () => {
  const SERVER = resolve(SRC, '../../server/src');
  for (const file of files(SERVER, /\.tsx?$/)) {
    test(`server/${relative(SERVER, file)} never imports web code`, () => {
      const text = readFileSync(file, 'utf8');
      const specs = [...text.matchAll(/(?:from\s+|import\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]);
      const out = specs.filter((s) => s.startsWith('.') && !resolve(dirname(file), s).startsWith(SERVER));
      expect(out.concat(specs.filter((s) => s.startsWith('@server') || /(^|\/)web\//.test(s)))).toEqual([]);
    });
  }
});

/** Top-level selectors of a stylesheet, including those inside @media; @keyframes steps are skipped. */
function selectors(css: string): string[] {
  const out: string[] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const walk = (s: string) => {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf('{', i);
      if (open < 0) break;
      const head = s.slice(i, open).trim();
      // Find the brace that closes this block.
      let depth = 1;
      let j = open + 1;
      for (; j < s.length && depth > 0; j++) {
        if (s[j] === '{') depth++;
        else if (s[j] === '}') depth--;
      }
      const body = s.slice(open + 1, j - 1);
      if (head.startsWith('@media')) walk(body);
      else if (!head.startsWith('@')) out.push(...head.split(',').map((x) => x.trim()));
      i = j;
    }
  };
  walk(text);
  return out;
}

describe('style scoping', () => {
  const scoped = { trading: '.trading', game: '.game', admin: '.admin' } as const;
  for (const [dir, root] of Object.entries(scoped)) {
    for (const sheet of files(join(SRC, dir), /\.css$/)) {
      test(`${relative(SRC, sheet)}: every rule under ${root}`, () => {
        const loose = selectors(readFileSync(sheet, 'utf8')).filter((sel) => sel !== root && !sel.startsWith(`${root} `));
        expect(loose).toEqual([]);
      });
    }
  }
  test('shared styles never target either part', () => {
    const css = files(join(SRC, 'shared'), /\.css$/).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(selectors(css).filter((sel) => /\.(trading|game|admin)\b/.test(sel))).toEqual([]);
  });
});
