import fs from 'fs';
import path from 'path';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

const version = JSON.parse(fs.readFileSync('package.json')).version;

export default [
  config(true, false),
  config(false, false),
  config(false, true),
];

function config (isWasm, isDebug) {
  return {
    input: `src/index.js`,
    output: {
      file: `dist/index${isWasm ? '.wasm' : ''}${isDebug ? '.debug' : ''}.js`,
      format: "esm",
      sourcemap: false,
      banner: `/* ES Module Shims ${isWasm ? 'Wasm ' : ''}${isDebug ? 'DEBUG BUILD ' : ''}${version} */`
    },
    plugins: [
      {
        resolveId (id) {
          if (isWasm && id === '../node_modules/es-module-lexer/dist/lexer.asm.js')
            return path.resolve('node_modules/es-module-lexer/dist/lexer.js');
        }
      },
      replace({
        'self.ESMS_DEBUG': isDebug.toString(),
        preventAssignment: true
      }),
      ...(!isWasm && !isDebug ? [
        terser()
      ] : []),
    ]
  };
}
