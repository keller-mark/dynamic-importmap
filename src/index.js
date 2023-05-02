/**
 * The code in this file was originally copied from
 * https://github.com/guybedford/es-module-shims
 * and adapted for the purposes described in the README.
 * es-module-shims is licensed under the MIT license, which appears below:
 * 
 * Copyright (C) 2018-2021 Guy Bedford
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 * and associated documentation files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 * BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import * as lexer from '../node_modules/es-module-lexer/dist/lexer.asm.js';

const hasWindow = typeof window !== 'undefined';
const hasDocument = typeof document !== 'undefined';

const noop = () => {};

const shimMode = true;
const resolveHook = undefined;
const importHook = undefined;
const fetchHook = fetch;
const metaHook = noop;

// TODO(mark): what is this used for?
let nonce = undefined;
if (!nonce && hasDocument) {
  const nonceElement = document.querySelector('script[nonce]');
  if (nonceElement)
    nonce = nonceElement.nonce || nonceElement.getAttribute('nonce');
}

const onpolyfill = () => {
  console.log('%c^^ Module TypeError above is polyfilled and can be ignored ^^', 'font-weight:900;color:#391');
};

const revokeBlobURLs = undefined;
const noLoadEventRetriggers = undefined;
const enforceIntegrity = undefined;
const enable = [];
const cssModulesEnabled = enable.includes('css-modules');
const jsonModulesEnabled = enable.includes('json-modules');
const edge = !navigator.userAgentData && !!navigator.userAgent.match(/Edge\/\d+\.\d+/);

const mapOverrides = true;

let importMap = { imports: {}, scopes: {} };
let baselinePassthrough = true;

const backslashRegEx = /\\/g;

function isURL (url) {
  if (url.indexOf(':') === -1) return false;
  try {
    new URL(url);
    return true;
  }
  catch (_) {
    return false;
  }
}

function resolveIfNotPlainOrUrl (relUrl, parentUrl) {
  const hIdx = parentUrl.indexOf('#'), qIdx = parentUrl.indexOf('?');
  if (hIdx + qIdx > -2)
    parentUrl = parentUrl.slice(0, hIdx === -1 ? qIdx : qIdx === -1 || qIdx > hIdx ? hIdx : qIdx);
  if (relUrl.indexOf('\\') !== -1)
    relUrl = relUrl.replace(backslashRegEx, '/');
  // protocol-relative
  if (relUrl[0] === '/' && relUrl[1] === '/') {
    return parentUrl.slice(0, parentUrl.indexOf(':') + 1) + relUrl;
  }
  // relative-url
  else if (relUrl[0] === '.' && (relUrl[1] === '/' || relUrl[1] === '.' && (relUrl[2] === '/' || relUrl.length === 2 && (relUrl += '/')) ||
      relUrl.length === 1  && (relUrl += '/')) ||
      relUrl[0] === '/') {
    const parentProtocol = parentUrl.slice(0, parentUrl.indexOf(':') + 1);
    // Disabled, but these cases will give inconsistent results for deep backtracking
    //if (parentUrl[parentProtocol.length] !== '/')
    //  throw new Error('Cannot resolve');
    // read pathname from parent URL
    // pathname taken to be part after leading "/"
    let pathname;
    if (parentUrl[parentProtocol.length + 1] === '/') {
      // resolving to a :// so we need to read out the auth and host
      if (parentProtocol !== 'file:') {
        pathname = parentUrl.slice(parentProtocol.length + 2);
        pathname = pathname.slice(pathname.indexOf('/') + 1);
      }
      else {
        pathname = parentUrl.slice(8);
      }
    }
    else {
      // resolving to :/ so pathname is the /... part
      pathname = parentUrl.slice(parentProtocol.length + (parentUrl[parentProtocol.length] === '/'));
    }

    if (relUrl[0] === '/')
      return parentUrl.slice(0, parentUrl.length - pathname.length - 1) + relUrl;

    // join together and split for removal of .. and . segments
    // looping the string instead of anything fancy for perf reasons
    // '../../../../../z' resolved to 'x/y' is just 'z'
    const segmented = pathname.slice(0, pathname.lastIndexOf('/') + 1) + relUrl;

    const output = [];
    let segmentIndex = -1;
    for (let i = 0; i < segmented.length; i++) {
      // busy reading a segment - only terminate on '/'
      if (segmentIndex !== -1) {
        if (segmented[i] === '/') {
          output.push(segmented.slice(segmentIndex, i + 1));
          segmentIndex = -1;
        }
        continue;
      }
      // new segment - check if it is relative
      else if (segmented[i] === '.') {
        // ../ segment
        if (segmented[i + 1] === '.' && (segmented[i + 2] === '/' || i + 2 === segmented.length)) {
          output.pop();
          i += 2;
          continue;
        }
        // ./ segment
        else if (segmented[i + 1] === '/' || i + 1 === segmented.length) {
          i += 1;
          continue;
        }
      }
      // it is the start of a new segment
      while (segmented[i] === '/') i++;
      segmentIndex = i; 
    }
    // finish reading out the last segment
    if (segmentIndex !== -1)
      output.push(segmented.slice(segmentIndex));
    return parentUrl.slice(0, parentUrl.length - pathname.length) + output.join('');
  }
}

function resolveUrl (relUrl, parentUrl) {
  return resolveIfNotPlainOrUrl(relUrl, parentUrl) || (isURL(relUrl) ? relUrl : resolveIfNotPlainOrUrl('./' + relUrl, parentUrl));
}

function getMatch (path, matchObj) {
  if (matchObj[path])
    return path;
  let sepIndex = path.length;
  do {
    const segment = path.slice(0, sepIndex + 1);
    if (segment in matchObj)
      return segment;
  } while ((sepIndex = path.lastIndexOf('/', sepIndex - 1)) !== -1)
}

function applyPackages (id, packages) {
  const pkgName = getMatch(id, packages);
  if (pkgName) {
    const pkg = packages[pkgName];
    if (pkg === null) return;
    return pkg + id.slice(pkgName.length);
  }
}

function resolveImportMap (importMap, resolvedOrPlain, parentUrl) {
  let scopeUrl = parentUrl && getMatch(parentUrl, importMap.scopes);
  while (scopeUrl) {
    const packageResolution = applyPackages(resolvedOrPlain, importMap.scopes[scopeUrl]);
    if (packageResolution)
      return packageResolution;
    scopeUrl = getMatch(scopeUrl.slice(0, scopeUrl.lastIndexOf('/')), importMap.scopes);
  }
  return applyPackages(resolvedOrPlain, importMap.imports) || resolvedOrPlain.indexOf(':') !== -1 && resolvedOrPlain;
}

function resolveAndComposePackages (packages, outPackages, baseUrl, parentMap) {
  for (let p in packages) {
    const resolvedLhs = resolveIfNotPlainOrUrl(p, baseUrl) || p;
    if ((!shimMode || !mapOverrides) && outPackages[resolvedLhs] && (outPackages[resolvedLhs] !== packages[resolvedLhs])) {
      throw Error(`Rejected map override "${resolvedLhs}" from ${outPackages[resolvedLhs]} to ${packages[resolvedLhs]}.`);
    }
    let target = packages[p];
    if (typeof target !== 'string')
      continue;
    const mapped = resolveImportMap(parentMap, resolveIfNotPlainOrUrl(target, baseUrl) || target, baseUrl);
    if (mapped) {
      outPackages[resolvedLhs] = mapped;
      continue;
    }
    console.warn(`Mapping "${p}" -> "${packages[p]}" does not resolve`);
  }
}

function resolveAndComposeImportMap (json, baseUrl, parentMap) {
  const outMap = { imports: Object.assign({}, parentMap.imports), scopes: Object.assign({}, parentMap.scopes) };

  if (json.imports)
    resolveAndComposePackages(json.imports, outMap.imports, baseUrl, parentMap, null);

  if (json.scopes)
    for (let s in json.scopes) {
      const resolvedScope = resolveUrl(s, baseUrl);
      resolveAndComposePackages(json.scopes[s], outMap.scopes[resolvedScope] || (outMap.scopes[resolvedScope] = {}), baseUrl, parentMap);
    }

  return outMap;
}

// TODO(mark): what is this used for?
const baseUrl = hasDocument
  ? document.baseURI
  : `${location.protocol}//${location.host}${location.pathname.includes('/') 
    ? location.pathname.slice(0, location.pathname.lastIndexOf('/') + 1) 
    : location.pathname}`;
const pageBaseUrl = baseUrl;

const createBlob = (source, type = 'text/javascript') => URL.createObjectURL(new Blob([source], { type }));

let dynamicImport = !hasDocument && (0, eval)('u=>import(u)');

let supportsDynamicImport;

const dynamicImportCheck = hasDocument && new Promise(resolve => {
  const s = Object.assign(document.createElement('script'), {
    src: createBlob('self._d=u=>import(u)'),
    ep: true
  });
  s.setAttribute('nonce', nonce);
  s.addEventListener('load', () => {
    if (!(supportsDynamicImport = !!(dynamicImport = self._d))) {
      let err;
      window.addEventListener('error', _err => err = _err);
      dynamicImport = (url, opts) => new Promise((resolve, reject) => {
        const s = Object.assign(document.createElement('script'), {
          type: 'module',
          src: createBlob(`import*as m from'${url}';self._esmsi=m`)
        });
        err = undefined;
        s.ep = true;
        if (nonce)
          s.setAttribute('nonce', nonce);
        // Safari is unique in supporting module script error events
        s.addEventListener('error', cb);
        s.addEventListener('load', cb);
        function cb (_err) {
          document.head.removeChild(s);
          if (self._esmsi) {
            resolve(self._esmsi, baseUrl);
            self._esmsi = undefined;
          }
          else {
            reject(!(_err instanceof Event) && _err || err && err.error || new Error(`Error loading ${opts && opts.errUrl || url} (${s.src}).`));
            err = undefined;
          }
        }
        document.head.appendChild(s);
      });
    }
    document.head.removeChild(s);
    delete self._d;
    resolve();
  });
  document.head.appendChild(s);
});


const skip = undefined;

// TODO: try to remove
const throwError = err => { (self.reportError || hasWindow && window.safari && console.error || eoop)(err), void onerror(err) };

function fromParent (parent) {
  return parent ? ` imported from ${parent}` : '';
}

// support browsers without dynamic import support (eg Firefox 6x)
let supportsJsonAssertions = false;
let supportsCssAssertions = false;

const supports = hasDocument && HTMLScriptElement.supports;

let supportsImportMaps = supports && supports.name === 'supports' && supports('importmap');
let supportsImportMeta = supportsDynamicImport;

const importMetaCheck = 'import.meta';
const cssModulesCheck = `import"x"assert{type:"css"}`;
const jsonModulesCheck = `import"x"assert{type:"json"}`;

let featureDetectionPromise = Promise.resolve(dynamicImportCheck).then(() => {
  if (!supportsDynamicImport)
    return;

  if (!hasDocument)
    return Promise.all([
      supportsImportMaps || dynamicImport(createBlob(importMetaCheck)).then(() => supportsImportMeta = true, noop),
      cssModulesEnabled && dynamicImport(createBlob(cssModulesCheck.replace('x', createBlob('', 'text/css')))).then(() => supportsCssAssertions = true, noop),
      jsonModulesEnabled && dynamicImport(createBlob(jsonModulescheck.replace('x', createBlob('{}', 'text/json')))).then(() => supportsJsonAssertions = true, noop),
    ]);

  return new Promise(resolve => {
    if (self.ESMS_DEBUG) console.info(`es-module-shims: performing feature detections for ${`${supportsImportMaps ? '' : 'import maps, '}${cssModulesEnabled ? 'css modules, ' : ''}${jsonModulesEnabled ? 'json modules, ' : ''}`.slice(0, -2)}`);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.setAttribute('nonce', nonce);
    function cb ({ data }) {
      const isFeatureDetectionMessage = Array.isArray(data) && data[0] === 'esms'
      if (!isFeatureDetectionMessage) {
        return;
      }
      supportsImportMaps = data[1];
      supportsImportMeta = data[2];
      supportsCssAssertions = data[3];
      supportsJsonAssertions = data[4];
      resolve();
      document.head.removeChild(iframe);
      window.removeEventListener('message', cb, false);
    }
    window.addEventListener('message', cb, false);

    const importMapTest = `<script nonce=${nonce || ''}>b=(s,type='text/javascript')=>URL.createObjectURL(new Blob([s],{type}));document.head.appendChild(Object.assign(document.createElement('script'),{type:'importmap',nonce:"${nonce}",innerText:\`{"imports":{"x":"\${b('')}"}}\`}));Promise.all([${
      supportsImportMaps ? 'true,true' : `'x',b('${importMetaCheck}')`}, ${cssModulesEnabled ? `b('${cssModulesCheck}'.replace('x',b('','text/css')))` : 'false'}, ${
      jsonModulesEnabled ? `b('${jsonModulesCheck}'.replace('x',b('{}','text/json')))` : 'false'}].map(x =>typeof x==='string'?import(x).then(x =>!!x,()=>false):x)).then(a=>parent.postMessage(['esms'].concat(a),'*'))<${''}/script>`;

    // Safari will call onload eagerly on head injection, but we don't want the Wechat
    // path to trigger before setting srcdoc, therefore we track the timing
    let readyForOnload = false, onloadCalledWhileNotReady = false;
    function doOnload () {
      if (!readyForOnload) {
        onloadCalledWhileNotReady = true;
        return;
      }
      // WeChat browser doesn't support setting srcdoc scripts
      // But iframe sandboxes don't support contentDocument so we do this as a fallback
      const doc = iframe.contentDocument;
      if (doc && doc.head.childNodes.length === 0) {
        const s = doc.createElement('script');
        if (nonce)
          s.setAttribute('nonce', nonce);
        s.innerHTML = importMapTest.slice(15 + (nonce ? nonce.length : 0), -9);
        doc.head.appendChild(s);
      }
    }

    iframe.onload = doOnload;
    // WeChat browser requires append before setting srcdoc
    document.head.appendChild(iframe);

    // setting srcdoc is not supported in React native webviews on iOS
    // setting src to a blob URL results in a navigation event in webviews
    // document.write gives usability warnings
    readyForOnload = true;
    if ('srcdoc' in iframe)
      iframe.srcdoc = importMapTest;
    else
      iframe.contentDocument.write(importMapTest);
    // retrigger onload for Safari only if necessary
    if (onloadCalledWhileNotReady) doOnload();
  });
});

/*
if (self.ESMS_DEBUG)
  featureDetectionPromise = featureDetectionPromise.then(() => {
    console.info(`es-module-shims: detected native support - ${supportsDynamicImport ? '' : 'no '}dynamic import, ${supportsImportMeta ? '' : 'no '}import meta, ${supportsImportMaps ? '' : 'no '}import maps`);
  });
*/

const importMapSrcOrLazy = false;

async function _resolve (id, parentUrl) {
  const urlResolved = resolveIfNotPlainOrUrl(id, parentUrl);
  return {
    r: resolveImportMap(importMap, urlResolved || id, parentUrl) || throwUnresolved(id, parentUrl),
    // b = bare specifier
    b: !urlResolved && !isURL(id)
  };
}

const resolve = resolveHook ? async (id, parentUrl) => {
  let result = resolveHook(id, parentUrl, defaultResolve);
  // will be deprecated in next major
  if (result && result.then)
    result = await result;
  return result ? { r: result, b: !resolveIfNotPlainOrUrl(id, parentUrl) && !isURL(id) } : _resolve(id, parentUrl);
} : _resolve;

// importShim('mod');
// importShim('mod', { opts });
// importShim('mod', { opts }, parentUrl);
// importShim('mod', parentUrl);
async function importShim (id, ...args) {
  // parentUrl if present will be the last argument
  let parentUrl = args[args.length - 1];
  if (typeof parentUrl !== 'string')
    parentUrl = pageBaseUrl;
  // needed for shim check
  await initPromise;
  if (importHook) await importHook(id, typeof args[1] !== 'string' ? args[1] : {}, parentUrl);
  return topLevelLoad((await resolve(id, parentUrl)).r, { credentials: 'same-origin' });
}

function defaultResolve (id, parentUrl) {
  return resolveImportMap(importMap, resolveIfNotPlainOrUrl(id, parentUrl) || id, parentUrl) || throwUnresolved(id, parentUrl);
}

function throwUnresolved (id, parentUrl) {
  throw Error(`Unable to resolve specifier '${id}'${fromParent(parentUrl)}`);
}

const resolveSync = (id, parentUrl = pageBaseUrl) => {
  parentUrl = `${parentUrl}`;
  const result = resolveHook && resolveHook(id, parentUrl, defaultResolve);
  return result && !result.then ? result : defaultResolve(id, parentUrl);
};

function metaResolve (id, parentUrl = this.url) {
  return resolveSync(id, parentUrl);
}

const registry = importShim._r = {};

async function loadAll (load, seen) {
  if (load.b || seen[load.u])
    return;
  seen[load.u] = 1;
  await load.L;
  await Promise.all(load.d.map(dep => loadAll(dep, seen)));
  if (!load.n)
    load.n = load.d.some(dep => dep.n);
}

const initPromise = featureDetectionPromise.then(() => {
  baselinePassthrough = supportsDynamicImport && supportsImportMeta && supportsImportMaps && (!jsonModulesEnabled || supportsJsonAssertions) && (!cssModulesEnabled || supportsCssAssertions) && !importMapSrcOrLazy;
  if (self.ESMS_DEBUG) console.info(`es-module-shims: init ${shimMode ? 'shim mode' : 'polyfill mode'}, ${baselinePassthrough ? 'baseline passthrough' : 'polyfill engaged'}`);
  if (hasDocument) {
    if (!supportsImportMaps) {
      const supports = HTMLScriptElement.supports || (type => type === 'classic' || type === 'module');
      HTMLScriptElement.supports = type => type === 'importmap' || supports(type);
    }
  }
  return lexer.init;
});
let firstPolyfillLoad = true;

async function topLevelLoad(url, fetchOpts, source, nativelyLoaded, lastStaticLoadPromise) {
  await initPromise;
  if (importHook) await importHook(url, typeof fetchOpts !== 'string' ? fetchOpts : {}, '');
  // early analysis opt-out - no need to even fetch if we have feature support
  if (!shimMode && baselinePassthrough) {
    if (self.ESMS_DEBUG) console.info(`es-module-shims: load skipping polyfill due to baseline passthrough applying: ${url}`);
    // for polyfill case, only dynamic import needs a return value here, and dynamic import will never pass nativelyLoaded
    if (nativelyLoaded)
      return null;
    await lastStaticLoadPromise;
    return dynamicImport(source ? createBlob(source) : url, { errUrl: url || source });
  }
  const load = getOrCreateLoad(url, fetchOpts, null, source);
  const seen = {};
  await loadAll(load, seen);
  lastLoad = undefined;
  resolveDeps(load, seen);
  await lastStaticLoadPromise;
  if (source && !shimMode && !load.n) {
    if (nativelyLoaded) return;
    if (revokeBlobURLs) revokeObjectURLs(Object.keys(seen));
    return await dynamicImport(createBlob(source), { errUrl: source });
  }
  if (firstPolyfillLoad && !shimMode && load.n && nativelyLoaded) {
    onpolyfill();
    firstPolyfillLoad = false;
  }
  const module = await dynamicImport(!shimMode && !load.n && nativelyLoaded ? load.u : load.b, { errUrl: load.u });
  // if the top-level load is a shell, run its update function
  if (load.s)
    (await dynamicImport(load.s)).u$_(module);
  if (revokeBlobURLs) revokeObjectURLs(Object.keys(seen));
  // when tla is supported, this should return the tla promise as an actual handle
  // so readystate can still correspond to the sync subgraph exec completions
  return module;
}

function revokeObjectURLs(registryKeys) {
  let batch = 0;
  const keysLength = registryKeys.length;
  const schedule = self.requestIdleCallback ? self.requestIdleCallback : self.requestAnimationFrame;
  schedule(cleanup);
  function cleanup() {
    const batchStartIndex = batch * 100;
    if (batchStartIndex > keysLength) return
    for (const key of registryKeys.slice(batchStartIndex, batchStartIndex + 100)) {
      const load = registry[key];
      if (load) URL.revokeObjectURL(load.b);
    }
    batch++;
    schedule(cleanup);
  }
}

function urlJsString (url) {
  return `'${url.replace(/'/g, "\\'")}'`;
}

let lastLoad;
function resolveDeps (load, seen) {
  if (load.b || !seen[load.u])
    return;
  seen[load.u] = 0;

  for (const dep of load.d)
    resolveDeps(dep, seen);

  const [imports, exports] = load.a;

  // "execution"
  const source = load.S;

  // edge doesnt execute sibling in order, so we fix this up by ensuring all previous executions are explicit dependencies
  let resolvedSource = edge && lastLoad ? `import '${lastLoad}';` : '';

  if (!imports.length) {
    resolvedSource += source;
  }
  else {
    // once all deps have loaded we can inline the dependency resolution blobs
    // and define this blob
    let lastIndex = 0, depIndex = 0, dynamicImportEndStack = [];
    function pushStringTo (originalIndex) {
      while (dynamicImportEndStack[dynamicImportEndStack.length - 1] < originalIndex) {
        const dynamicImportEnd = dynamicImportEndStack.pop();
        resolvedSource += `${source.slice(lastIndex, dynamicImportEnd)}, ${urlJsString(load.r)}`;
        lastIndex = dynamicImportEnd;
      }
      resolvedSource += source.slice(lastIndex, originalIndex);
      lastIndex = originalIndex;
    }
    for (const { s: start, ss: statementStart, se: statementEnd, d: dynamicImportIndex } of imports) {
      // dependency source replacements
      if (dynamicImportIndex === -1) {
        let depLoad = load.d[depIndex++], blobUrl = depLoad.b, cycleShell = !blobUrl;
        if (cycleShell) {
          // circular shell creation
          if (!(blobUrl = depLoad.s)) {
            blobUrl = depLoad.s = createBlob(`export function u$_(m){${
              depLoad.a[1].map(({ s, e }, i) => {
                const q = depLoad.S[s] === '"' || depLoad.S[s] === "'";
                return `e$_${i}=m${q ? `[` : '.'}${depLoad.S.slice(s, e)}${q ? `]` : ''}`;
              }).join(',')
            }}${
              depLoad.a[1].length ? `let ${depLoad.a[1].map((_, i) => `e$_${i}`).join(',')};` : ''
            }export {${
              depLoad.a[1].map(({ s, e }, i) => `e$_${i} as ${depLoad.S.slice(s, e)}`).join(',')
            }}\n//# sourceURL=${depLoad.r}?cycle`);
          }
        }

        pushStringTo(start - 1);
        resolvedSource += `/*${source.slice(start - 1, statementEnd)}*/${urlJsString(blobUrl)}`;

        // circular shell execution
        if (!cycleShell && depLoad.s) {
          resolvedSource += `;import*as m$_${depIndex} from'${depLoad.b}';import{u$_ as u$_${depIndex}}from'${depLoad.s}';u$_${depIndex}(m$_${depIndex})`;
          depLoad.s = undefined;
        }
        lastIndex = statementEnd;
      }
      // import.meta
      else if (dynamicImportIndex === -2) {
        load.m = { url: load.r, resolve: metaResolve };
        metaHook(load.m, load.u);
        pushStringTo(start);
        resolvedSource += `importShim._r[${urlJsString(load.u)}].m`;
        lastIndex = statementEnd;
      }
      // dynamic import
      else {
        pushStringTo(statementStart + 6);
        resolvedSource += `Shim(`;
        dynamicImportEndStack.push(statementEnd - 1);
        lastIndex = start;
      }
    }

    // support progressive cycle binding updates (try statement avoids tdz errors)
    if (load.s)
      resolvedSource += `\n;import{u$_}from'${load.s}';try{u$_({${exports.filter(e => e.ln).map(({ s, e, ln }) => `${source.slice(s, e)}:${ln}`).join(',')}})}catch(_){};\n`;

    pushStringTo(source.length);
  }

  let hasSourceURL = false;
  resolvedSource = resolvedSource.replace(sourceMapURLRegEx, (match, isMapping, url) => (hasSourceURL = !isMapping, match.replace(url, () => new URL(url, load.r))));
  if (!hasSourceURL)
    resolvedSource += '\n//# sourceURL=' + load.r;

  load.b = lastLoad = createBlob(resolvedSource);
  load.S = undefined;
}

// ; and // trailer support added for Ruby on Rails 7 source maps compatibility
// https://github.com/guybedford/es-module-shims/issues/228
const sourceMapURLRegEx = /\n\/\/# source(Mapping)?URL=([^\n]+)\s*((;|\/\/[^#][^\n]*)\s*)*$/;

const jsContentType = /^(text|application)\/(x-)?javascript(;|$)/;
const jsonContentType = /^(text|application)\/json(;|$)/;
const cssContentType = /^(text|application)\/css(;|$)/;

const cssUrlRegEx = /url\(\s*(?:(["'])((?:\\.|[^\n\\"'])+)\1|((?:\\.|[^\s,"'()\\])+))\s*\)/g;

// restrict in-flight fetches to a pool of 100
let p = [];
let c = 0;
function pushFetchPool () {
  if (++c > 100)
    return new Promise(r => p.push(r));
}
function popFetchPool () {
  c--;
  if (p.length)
    p.shift()();
}

async function doFetch (url, fetchOpts, parent) {
  if (enforceIntegrity && !fetchOpts.integrity)
    throw Error(`No integrity for ${url}${fromParent(parent)}.`);
  const poolQueue = pushFetchPool();
  if (poolQueue) await poolQueue;
  try {
    var res = await fetchHook(url, fetchOpts);
  }
  catch (e) {
    e.message = `Unable to fetch ${url}${fromParent(parent)} - see network log for details.\n` + e.message;
    throw e;
  }
  finally {
    popFetchPool();
  }
  if (!res.ok)
    throw Error(`${res.status} ${res.statusText} ${res.url}${fromParent(parent)}`);
  return res;
}

async function fetchModule (url, fetchOpts, parent) {
  const res = await doFetch(url, fetchOpts, parent);
  const contentType = res.headers.get('content-type');
  if (jsContentType.test(contentType))
    return { r: res.url, s: await res.text(), t: 'js' };
  else if (jsonContentType.test(contentType))
    return { r: res.url, s: `export default ${await res.text()}`, t: 'json' };
  else if (cssContentType.test(contentType)) {
    return { r: res.url, s: `var s=new CSSStyleSheet();s.replaceSync(${
        JSON.stringify((await res.text()).replace(cssUrlRegEx, (_match, quotes = '', relUrl1, relUrl2) => `url(${quotes}${resolveUrl(relUrl1 || relUrl2, url)}${quotes})`))
      });export default s;`, t: 'css' };
  }
  else
    throw Error(`Unsupported Content-Type "${contentType}" loading ${url}${fromParent(parent)}. Modules must be served with a valid MIME type like application/javascript.`);
}

function getOrCreateLoad (url, fetchOpts, parent, source) {
  let load = registry[url];
  if (load && !source)
    return load;

  load = {
    // url
    u: url,
    // response url
    r: source ? url : undefined,
    // fetchPromise
    f: undefined,
    // source
    S: undefined,
    // linkPromise
    L: undefined,
    // analysis
    a: undefined,
    // deps
    d: undefined,
    // blobUrl
    b: undefined,
    // shellUrl
    s: undefined,
    // needsShim
    n: false,
    // type
    t: null,
    // meta
    m: null
  };
  if (registry[url]) {
    let i = 0;
    while (registry[load.u + ++i]);
    load.u += i;
  }
  registry[load.u] = load;

  load.f = (async () => {
    if (!source) {
      // preload fetch options override fetch options (race)
      let t;
      ({ r: load.r, s: source, t } = await (fetchCache[url] || fetchModule(url, fetchOpts, parent)));
      if (t && !shimMode) {
        if (t === 'css' && !cssModulesEnabled || t === 'json' && !jsonModulesEnabled)
          throw Error(`${t}-modules require <script type="esms-options">{ "polyfillEnable": ["${t}-modules"] }<${''}/script>`);
        if (t === 'css' && !supportsCssAssertions || t === 'json' && !supportsJsonAssertions)
          load.n = true;
      }
    }
    try {
      load.a = lexer.parse(source, load.u);
    }
    catch (e) {
      throwError(e);
      load.a = [[], [], false];
    }
    load.S = source;
    return load;
  })();

  load.L = load.f.then(async () => {
    let childFetchOpts = fetchOpts;
    load.d = (await Promise.all(load.a[0].map(async ({ n, d }) => {
      if (d >= 0 && !supportsDynamicImport || d === -2 && !supportsImportMeta)
        load.n = true;
      if (d !== -1 || !n) return;
      const { r, b } = await resolve(n, load.r || load.u);
      if (b && (!supportsImportMaps || importMapSrcOrLazy))
        load.n = true;
      if (d !== -1) return;
      if (skip && skip(r)) return { b: r };
      if (childFetchOpts.integrity)
        childFetchOpts = Object.assign({}, childFetchOpts, { integrity: undefined });
      return getOrCreateLoad(r, childFetchOpts, load.r).f;
    }))).filter(l => l);
  });

  return load;
}

let domContentLoadedCnt = 1;
function domContentLoadedCheck () {
  if (--domContentLoadedCnt === 0 && !noLoadEventRetriggers && (shimMode || !baselinePassthrough)) {
    if (self.ESMS_DEBUG) console.info(`es-module-shims: DOMContentLoaded refire`);
    document.dispatchEvent(new Event('DOMContentLoaded'));
  }
}
// this should always trigger because we assume es-module-shims is itself a domcontentloaded requirement
if (hasDocument) {
  document.addEventListener('DOMContentLoaded', async () => {
    await initPromise;
    domContentLoadedCheck();
  });
}

const hasNext = script => script.nextSibling || script.parentNode && hasNext(script.parentNode);

const fetchCache = {};

export function getImportMap() {
  return JSON.parse(JSON.stringify(importMap));
}
export function addImportMap(importMapIn) {
  importMap = resolveAndComposeImportMap(importMapIn, pageBaseUrl, importMap);
}

export async function importWithMap(id, importMapIn) {
  addImportMap(importMapIn);
  return importShim(id);
}
