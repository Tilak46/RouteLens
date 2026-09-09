const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '..', 'node_modules', 'web-tree-sitter', 'tree-sitter.js');

if (!fs.existsSync(targetFile)) {
  console.log('[patch-web-tree-sitter] web-tree-sitter/tree-sitter.js not found, skipping.');
  process.exit(0);
}

let code = fs.readFileSync(targetFile, 'utf8');

const target = 'var asmLibraryArg={';
const replacement = 'var asmLibraryArg={iswspace:(c)=>((c===32||(c>=9&&c<=13)||c===0x85||c===0xa0||c===0x1680||(c>=0x2000&&c<=0x200a)||c===0x2028||c===0x2029||c===0x202f||c===0x205f||c===0x3000)?1:0),iswdigit:(c)=>((c>=48&&c<=57)?1:0),iswalpha:(c)=>(((c>=65&&c<=90)||(c>=97&&c<=122))?1:0),iswalnum:(c)=>(((c>=48&&c<=57)||(c>=65&&c<=90)||(c>=97&&c<=122))?1:0),iswupper:(c)=>((c>=65&&c<=90)?1:0),iswlower:(c)=>((c>=97&&c<=122)?1:0),';

if (!code.includes('iswspace:')) {
  code = code.replace(target, replacement);
  fs.writeFileSync(targetFile, code, 'utf8');
  console.log('[patch-web-tree-sitter] Successfully patched web-tree-sitter with ctype functions.');
} else {
  console.log('[patch-web-tree-sitter] Already patched.');
}
