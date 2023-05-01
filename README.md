# dynamic-importmap

## Motivation

> Import maps are an __application-level thing__, somewhat like service workers. (More formally, they would be per-module map, and thus per-realm.) They are not meant to be composed, but instead produced by a human or tool with a __holistic view__ of your web application. For example, it would not make sense for a library to include an import map; libraries can simply reference modules by specifier, and let the application decide what URLs those specifiers map to.
> 
> This, in addition to general simplicity, is in part what motivates the above restrictions on <script type="importmap">.
> 
> Since an application's import map changes the resolution algorithm for every module in the module map, they are not impacted by whether a module's source text was originally from a cross-origin URL. If you load a module from a CDN that uses bare import specifiers, __you'll need to know ahead of time what bare import specifiers that module adds to your app, and include them in your application's import map__. (That is, you need to know what all of your application's transitive dependencies are.) It's important that control of which URLs are used for each package stay with the __application author, so they can holistically manage versioning and sharing of modules__.
> - [WICG/import-maps](https://github.com/WICG/import-maps#scope) (emphasis mine)



## References

- https://github.com/WICG/import-maps
- https://github.com/guybedford/es-module-shims