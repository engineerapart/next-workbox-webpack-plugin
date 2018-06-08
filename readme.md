# next-workbox-webpack-plugin

> Webpack plugin with workbox, it helps you build a Progressive Web App powered by Next.js. Generating service worker scripts and precache manifest of Next.js's pages and chunks.

<img width="1024" src="https://user-images.githubusercontent.com/124117/36341030-4b040398-142b-11e8-9de7-41d3dbe55427.png">

## Install

```
$ npm install @engineerapart/next-workbox-webpack-plugin
```

## Usage

```js
const nextWorkboxWebpackPlugin = require('@engineerapart/next-workbox-webpack-plugin');

nextWorkboxWebpackPlugin({
  // must, you can get it at time time of Next.js compiling
  buildId: '6c071eb6-ab01-47bc-8074-71057afc1f64',
  // optional, next.js dist path as compiling. most of cases you don't need to fix it.
  distDir: '.next',
  // optional, which version of workbox will be used in between 'local' or 'cdn'. 'local'
  // option will help you use copy of workbox libs in localhost.
  importWorkboxFrom: 'local',
  // optional ,whether make a precache manifest of pages and chunks of Next.js app or not.
  precacheManifest: true,
  // optional, whether delete workbox path generated by the plugin.
	removeDir: true,
	// Where the service worker will be copied to, as well as the workbox bundle, if using importWorkboxFrom = 'local'
	swDestRoot: './static/workbox',
	// The root of the SW url you want generated for the service worker and its scripts. It is recommended to leave this
	// as the default value if you are using importWorkboxFrom = 'local'. If you use 'cdn', this value only determines
	// the folder where `sw.js` is copied to.
	swURLRoot: '/static/workbox',
  // optional, you can use workbox-build options. except swDest because of output location is fixed in 'static/workbox'
  ...WorkboxBuildOptions,
});
```

## Usage in next.config.js

```
const NextWorkboxWebpackPlugin = require('@engineerapart/next-workbox-webpack-plugin');

module.exports = {
  webpack: (config, {isServer, dev, buildId, config: {distDir}}) => {
    if (!isServer && !dev) {
      config.plugins.push(new NextWorkboxWebpackPlugin({
        distDir,
        buildId,
				swDestRoot: './static', // copy sw.js to your static folder
				swURLRoot: '/static'
      }))
    }

    return config
  }
}
```

## How it works

For Next.js, It contains some of restrictions:

- Only works in `not dev mode` and on `the custom server` which means you can't test with `next` and `next start`
- You need customized server for serving service worker scripts and workbox libraries. For your convenience, [test server is in this package](https://github.com/engineerapart/next-workbox-webpack-plugin/blob/master/bin/next-workbox-start.js).
- All of files will be generated in `static/workbox` because of exporting. You might need to add the path to gitignore.
```
static/workbox
├── next-precache-manifest-d42167a04499e1887dad3156b93e064d.js
├── sw.js
└── workbox-v3.0.0-beta.0
    ├── workbox-background-sync.dev.js
    ├── ...
    ├── workbox-sw.js
```
- You have to [add register service worker script](https://github.com/engineerapart/next-workbox-webpack-plugin/blob/master/examples/hello-pwa/pages/index.js) into part of your application
- For more information, please refer to test and [Get Started With Workbox For Webpack](https://goo.gl/BFQxuo)

### Examples

- [Hello PWA](https://github.com/engineerapart/next-workbox-webpack-plugin/tree/master/examples/hello-pwa): You can learn how to use the webpack plugin basically
- [HNPWA](https://github.com/engineerapart/next-workbox-webpack-plugin/tree/master/examples/hnpwa): Simple HNPWA apps with Next.js

## License

MIT © [Jimmy Moon](https://ragingwind.me)
MIT © [EngineerApart, LLC](https://engineerapart.com)
