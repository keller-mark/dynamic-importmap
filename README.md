# dynamic-importmap

## Motivation

> *Import maps are an __application-level thing__... They are not meant to be composed, but instead produced by a human or tool with a __holistic view__ of your web application. For example, it would not make sense for a library to include an import map; libraries can simply reference modules by specifier, and let the application decide what URLs those specifiers map to...*
> 
> *If you load a module from a CDN that uses bare import specifiers, you'll need to know __ahead of time__ what bare import specifiers that module adds to your app, and include them in your application's import map... It's important that control of which URLs are used for each package stay with the __application author__, so they can holistically manage versioning and sharing of modules.*
> -- [WICG/import-maps](https://github.com/WICG/import-maps#scope) (emphasis mine)


While it is ideal, the luxury of having full control over the application is not always possible.
`dynamic-importmap` allows a module author to dynamically import code that contains bare import specifiers, rewriting those specifiers at runtime on the client side.

This allows, for example, to publish a React component library to NPM in which `react` and `react-dom` have been "externalized" and kept as bare import specifiers.
Using `dynamic-importmap`, this component library can be dynamically imported from a regular CDN (e.g., Unpkg; in contrast to esm.sh which performs rewriting on the server side), without having full control over the importmaps on the page.

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

Solution:

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