/**
 * Database timestamps are read with core/date's timestampMs, never with the
 * engine's own parser.
 *
 * Postgres sends six fractional digits ('…10:00:00.123456+00:00'); the format
 * the engine must read has three. The tests run on V8, which reads six; the
 * phone runs Hermes, and a NaN there fails silently - a duration that never
 * shows, a "done today" that is never true, "Deletes in NaN days" in the
 * Trash. Neither Date.parse nor new Date(string) can be stood in for per call,
 * so this pins the rule itself: no `Date.parse(` and no
 * `new Date(<something>_at / <something>At)` outside core/date.ts.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../..');
const ALLOWED_FILES = new Set(['core/date.ts']);
/** Lines whose value is already a number of milliseconds, not a string. */
const NUMBERS = new Set(['modules/fitness/components/RestBar.tsx: date: new Date(endsAt),']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return name === '__tests__' || name === '__fixtures__' ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

const PATTERNS = [/\bDate\.parse\(/, /new Date\(\s*[\w.?]*(?:_at|At)\s*\)/];

it('reads every database timestamp with timestampMs', () => {
  const offenders = sourceFiles(SRC).flatMap((file) => {
    const relative = path.relative(SRC, file).split(path.sep).join('/');
    if (ALLOWED_FILES.has(relative)) return [];
    return readFileSync(file, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => !line.startsWith('//') && !line.startsWith('*'))
      .filter((line) => PATTERNS.some((pattern) => pattern.test(line)))
      .map((line) => `${relative}: ${line}`)
      .filter((entry) => !NUMBERS.has(entry));
  });
  expect(offenders).toEqual([]);
});
