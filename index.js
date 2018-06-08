const path = require('path');
const fs = require('fs-extra');
const klawSync = require('klaw-sync');
const crypto = require('crypto');
const md5File = require('md5-file/promise').sync;
const findUp = require('find-up');
const { generateSWString, copyWorkboxLibraries, getModuleUrl } = require('workbox-build');

const hash = ctx => crypto.createHash('md5').update(ctx, 'utf8').digest('hex');

const defaultConfig = {
  globDirectory: './',
  globPatterns: [],
  clientsClaim: true,
  skipWaiting: true,
  runtimeCaching: [{
    urlPattern: /^http[s|]?.*/,
    handler: 'staleWhileRevalidate',
  }],
  importScripts: [],
  distDir: '.next',
  importWorkboxFrom: 'local',
  precacheManifest: true,
  removeDir: true,
  buildId: null,
  // dedicated path and url, must be under static in next.js to export and refer to it
  swDestRoot: './static/workbox',
  swURLRoot: '/static/workbox',
  cdnRoot: '',
};

class NextWorkboxWebpackPlugin {
  constructor(config) {
    const {
      distDir,
      importWorkboxFrom,
      precacheManifest,
      removeDir,
      buildId,
      swDestRoot,
      swURLRoot,
      cdnRoot,
      debug,
      ...swConfig
    } = {
      ...defaultConfig,
      ...config,
      swDest: config.swDest ? path.basename(config.swDest) : 'sw.js',
    };

    this.swConfig = swConfig;
    this.options = {
      distDir,
      importWorkboxFrom,
      precacheManifest,
      removeDir,
      buildId,
      swDestRoot,
      swURLRoot,
      cdnRoot,
      debug,
    };

    // build id come from next.js is exist
    if (!this.options.buildId) {
      throw new Error('Build id from next.js must exist. This is only generated in production Next builds (NODE_ENV=production)');
    }

    // clean up previous builts
    if (this.options.removeDir) {
      this.removeWorkboxDir(this.options);
    }
  }

  async importWorkboxLibraries({ importWorkboxFrom, swURLRoot, swDestRoot }) {
    if (importWorkboxFrom === 'local') {
      try {
        const workboxPkg = findUp.sync('node_modules/workbox-sw/package.json', __dirname);
        // eslint-disable-next-line global-require, import/no-dynamic-require
        const workboxName = path.basename(require(workboxPkg).main);
        return `${swURLRoot}/${await copyWorkboxLibraries(swDestRoot)}/${workboxName}`;
      } catch (e) {
        throw e;
      }
    } else {
      await fs.ensureDir(swDestRoot);
      return getModuleUrl('workbox-sw');
    }
  }

  globPrecacheManifest({ distDir, buildId, cdnRoot }, concatEntries = []) {
    // This may need to change to use the {url,revision} format:
    // https://developers.google.com/web/tools/workbox/modules/workbox-precaching#explanation_of_the_precache_list
    const precacheQuery = [{
      src: `${distDir}/bundles/pages`,
      route: f => `${cdnRoot}/_next/${buildId}/page${f}`,
      filter: f => (/.js$/).test(f),
      recurse: true,
    }, {
      src: `${distDir}/static/commons`, // next 6.0 => commons chunks and build manifest.
      route: f => `${cdnRoot}/_next/static/commons/${f}`,
      filter: f => (/.js$/).test(f),
    }, {
      src: `${distDir}/chunks`,
      route: f => `${cdnRoot}/_next/webpack/chunks/${f}`,
      filter: f => (/.js$/).test(f),
    }, {
      src: `${distDir}`,
      route: () => `${cdnRoot}/_next/${md5File(`${distDir}/app.js`)}/app.js`,
      filter: f => f === 'app.js',
    }];

    return Promise.all(precacheQuery.map(query => new Promise((resolve) => {
      // For these entries, we deep-recurse the dir, get all the files,
      // strip off the origin path to get the local path and filename,
      // then generate their route
      if (query.recurse) {
        const entries = klawSync(query.src, { nodir: true })
          .map(e => e.path)
          .filter(query.filter)
          .map(e => query.route(e.replace(query.src, '')));
        resolve(entries);
      } else {
        fs.readdir(query.src, (err, files = []) => {
          resolve(files.filter(query.filter).map(f => query.route(f)));
        });
      }
		})))
		.then(files => files.reduce((c, p) => c.concat(p), []))
		.then((files) => files.concat(concatEntries));
  }

  // TODO: Generalize the import script builder to combine all settings and save in one go,
  // instead of repeating code.
  async importPrecacheManifest({ swDestRoot, swURLRoot, debug, precacheManifest }) {
		const debugEntry = debug ? 'workbox.setConfig({ debug: true });\n' : '';
		const concatEntries = (Array.isArray(precacheManifest)) ? precacheManifest : [];
		const manifest = await this.globPrecacheManifest(this.options, concatEntries);
    const content = `${debugEntry}self.__precacheManifest = ${JSON.stringify(manifest)}`;
    const output = `next-precache-manifest-${hash(content)}.js`;

    const manifestFile = 'manifest-id.json';
    const precacheManifestId = {
      precacheManifest: path.join(swDestRoot, output),
    };

    // dump out precached manifest for next pages, chunks
    fs.writeFileSync(path.join(swDestRoot, output), content);

    // store the path that was generated in manifest.json for runtime clients to know which file was generated
    fs.writeFileSync(path.join(swDestRoot, manifestFile), JSON.stringify(precacheManifestId));

    return `${swURLRoot}/${output}`;
  }

  // For now this only applies the debug setting - and only if precacheManifest is false
  // If it is true, debug is included in the manifest instead of generating another file.
  // If/when this module supports additional options that add more to the import scripts,
  // those settings should always be grouped into the fewest number of scripts as possible.
  async generateImportScripts({ swDestRoot, swURLRoot, ...options }) {
    const { debug } = options;
    if (debug) {
      const debugEntry = 'workbox.setConfig({ debug: true });\n';
      const content = `${debugEntry}`;
      const output = `next-import-scripts-${hash(content)}.js`;
      fs.writeFileSync(path.join(swDestRoot, output), content);

      return `${swURLRoot}/${output}`;
    }

    return null;
  }

  async generateSW(swDest, swConfig) {
    const { swString } = await generateSWString(swConfig);
    fs.writeFileSync(swDest, swString);
  }

  removeWorkboxDir({ swDestRoot }) {
    fs.removeSync(path.resolve(process.cwd(), swDestRoot));
  }

  apply(compiler) {
    compiler.plugin('done', async (stats) => {
      if (stats.toJson().errors.length > 0) {
        return;
      }

      try {
        const { swDest, ...swConfig } = this.swConfig;

        // unshift workbox libs to the top of scripts
        swConfig.importScripts.unshift(await this.importWorkboxLibraries(this.options));

        // push precached manifest to end of scripts
        if (this.options.precacheManifest) {
          swConfig.importScripts.push(await this.importPrecacheManifest(this.options));
        } else {
          // Generate any custom imports required
          const customImports = await this.generateImportScripts(this.options);
          if (customImports) {
            swConfig.importScripts.push(customImports);
          }
        }

        await this.generateSW(path.join(this.options.swDestRoot, swDest), swConfig);
      } catch (e) {
        console.error('Error generating service worker with workbox-build:', e); // eslint-disable-line no-console
        throw e;
      }
    });
  }
}

module.exports = NextWorkboxWebpackPlugin;
