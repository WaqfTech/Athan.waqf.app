'use strict';
// External read-only diagnostic, not a proposed shipped project utility.
// Usage: node compile.cjs CHECKOUT [EXISTING_TYPESCRIPT_MODULE_DIRECTORY]
// Does not install dependencies, edit source, typecheck, or run native tests.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
if (!process.argv[2]) throw new Error('Pass the pinned Athan checkout root.');
const sourceRoot = path.resolve(process.argv[2]);
if (!fs.existsSync(path.join(sourceRoot, 'src/astronomy/solar.ts'))) throw new Error('Not an Athan source root.');
const requestedTs = process.argv[3] || process.env.TYPESCRIPT_MODULE;
let ts;
try {
  ts = requestedTs ? require(path.resolve(requestedTs)) : createRequire(path.join(sourceRoot, 'package.json'))('typescript');
} catch (cause) {
  throw new Error('TypeScript is unavailable. Use approved installed dependencies or pass an existing TypeScript module directory. Nothing was installed.', { cause });
}
const modules = ['astronomy/julian.ts','astronomy/coordinates.ts','astronomy/solar.ts',
  'prayer/conventions.ts','prayer/calculator.ts','prayer/contours.ts',
  'simulation/eventEngine.ts','simulation/continuity.ts','simulation/clock.ts','population/loader.ts'];
const out = path.join(__dirname, 'compiled');
for (const file of modules) {
  const code = fs.readFileSync(path.join(sourceRoot, 'src', file), 'utf8');
  const result = ts.transpileModule(code, {compilerOptions: {module: ts.ModuleKind.CommonJS,target: ts.ScriptTarget.ES2022},fileName:file,reportDiagnostics:true});
  const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new Error(errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
  const dest = path.join(out,file.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,result.outputText);
}
console.log(JSON.stringify({node:process.version,typescript:ts.version,transpiledModules:modules,fullTypecheck:false,vitestRun:false},null,2));
