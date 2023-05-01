# dynamic-importmap

## Motivation

> *Import maps are an __application-level thing__... They are not meant to be composed, but instead produced by a human or tool with a __holistic view__ of your web application. For example, it would not make sense for a library to include an import map; libraries can simply reference modules by specifier, and let the application decide what URLs those specifiers map to...*
> 
> *If you load a module from a CDN that uses bare import specifiers, you'll need to know __ahead of time__ what bare import specifiers that module adds to your app, and include them in your application's import map... It's important that control of which URLs are used for each package stay with the __application author__, so they can holistically manage versioning and sharing of modules.*
> -- [WICG/import-maps](https://github.com/WICG/import-maps#scope) (emphasis mine)


While it is ideal, the luxury of having full control over the application is not always possible.
`dynamic-importmap` allows a module author to dynamically import code that contains bare import specifiers, rewriting those specifiers at runtime on the client side.

This allows, for example, to publish a React component library to NPM in which `react` and `react-dom` have been "externalized" and kept as bare import specifiers.
Using `dynamic-importmap`, this component library can be dynamically imported from a regular CDN (e.g., [unpkg](https://unpkg.com/)), without having full control over the importmaps on the page.
A concrete use case is for an ES module that will run in a Jupyter notebook with [anywidget](https://github.com/manzt/anywidget).

## Minimal example

```html
<script type="module">
  import { A } from 'https://unpkg.com/some-a';
  import { B_DependsOnA } from 'https://unpkg.com/some-b-with-bare-import-specifiers-for-a';

  // Uncaught TypeError:
  // Failed to resolve module specifier "some-a".
  // Relative references must start with either "/", "./", or "../".
</script>
```

TODO: put dynamic solution last with warning.

Note: dynamic-importmap is meant to be a last-resort solution (i.e., after considering the alternatives listed below).
As noted by the WICG (above), import maps should ideally be defined at the application level with `<script type="importmap"/>` to ensure common modules can be shared.

### `dynamic-importmap` solution

```html
<script type="module">
  import { importWithMap } from 'https://unpkg.com/dynamic-importmap@0.0.1';

  const importMap = {
    imports: {
      'some-a': 'https://unpkg.com/some-a',
      'some-b-with-bare-import-specifiers-for-a': 'https://unpkg.com/some-b-with-bare-import-specifiers-for-a',
    },
  };

  const { A } = await importWithMap('some-a', importMap);
  const { B_DependsOnA } = await importWithMap('some-b-with-bare-import-specifiers-for-a', importMap);

  // It works!
</script>
```

### ESM-aware CDN solution

An alternate solution is to use a CDN such as [esm.sh](https://esm.sh/) which can perform bare import specifier rewriting on the server side.
However, this depends on a specialized CDN and prevents potentially hosting the scripts on a basic static web server or using a regular CDN as a fallback.

### Pre-bundling solution

Another solution would be to create a bundle for B which _contains_ a copy of A.
However, this must be done ahead of time and published to NPM as a third package.

### Pre-rewriting solution

A different solution is to rewrite the bare module specifiers at build time (either in package B directly or in a new third package). However this locks you in to a particular CDN, which makes redundancy difficult and may have security implications.

### es-module-shims solution

es-module-shims can be used in shim-mode (rather than polyfill-mode) to achieve the same effect as dynamic-importmap. However, this usage of es-module-shims is not well documented, involves some undesired use of side effects (i.e., global variables), and involves importing unused code (i.e., for the polyfill-mode).

In contrast, this library makes use of many of the es-module-shims internals but does not include the extra polyfill features.

### Take control over the full application 💪

Not always possible (see [motivation](#motivation), but potentially worth considering.

### UMD solution

Just kidding :laughing:


## React example

```html
<div id="root"></div>
<script type="module">
  import { importWithMap } from 'https://unpkg.com/dynamic-importmap@0.0.1';

  const importMap = {
    imports: {
      "react": "https://esm.sh/react@18.2.0?dev",
      "react-dom": "https://esm.sh/react-dom@18.2.0?dev",
      "react-dom/client": "https://esm.sh/react-dom@18.2.0/client?dev",
      "prop-types": "https://esm.sh/prop-types@15.8.1?dev",
      "react-feather": "https://unpkg.com/react-feather@2.0.10/dist/index.js"
    },
  };

  const React = await importWithMap("react", importMap);
  const { createRoot } = await importWithMap("react-dom/client", importMap);

  // react-feather is a React icon library
  // which contains bare import specifiers for "react" and "prop-types"
  const { Smile } = await importWithMap('react-feather', importMap);

  function MyApp(props) {
    return React.createElement(React.Suspense,
      { fallback: React.createElement('div', {}, 'Loading...') },
      React.createElement(Smile),
    );
  }

  const domContainer = document.getElementById('root');
  const root = createRoot(domContainer);
  root.render(React.createElement(MyApp));
</script>
```




## References

- https://github.com/WICG/import-maps
- https://github.com/guybedford/es-module-shims
