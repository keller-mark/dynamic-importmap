# dynamic-importmap

## Motivation

> *Import maps are an __application-level thing__... They are not meant to be composed, but instead produced by a human or tool with a __holistic view__ of your web application. For example, it would not make sense for a library to include an import map; libraries can simply reference modules by specifier, and let the application decide what URLs those specifiers map to...*
> 
> *If you load a module from a CDN that uses bare import specifiers, you'll need to know __ahead of time__ what bare import specifiers that module adds to your app, and include them in your application's import map... It's important that control of which URLs are used for each package stay with the __application author__, so they can holistically manage versioning and sharing of modules.*
> -- [WICG/import-maps](https://github.com/WICG/import-maps#scope) (emphasis mine)



## References

- https://github.com/WICG/import-maps
- https://github.com/guybedford/es-module-shims