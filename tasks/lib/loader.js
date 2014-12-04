var 
  // global modules
  path = require("path"),
  xpath = require('xpath'),
  dom = require('xmldom').DOMParser, 
  js2xmlparser = require("js2xmlparser"),
  path = require('path'), 
  fs = require('fs-extra'),
  ncp = require('ncp').ncp,
  chalk = require('chalk'),
  shell = require('shelljs'), 
  merge = require('deepmerge'), 
  http = require('http'),
  tarball = require('tarball-extract'), 
  md5 = require('MD5'), 
  glob = require("glob");

// local imports
var
  logger = require("./logger");
  

  /**
   * Cordova Plugin Cache
   */
  function PluginLoader(options) {
    this.options = options || {};
    this.options.cache = path.join(this.options.path, "cache/plugins");
    this.options.tmp = path.join(this.options.path, "cache/plugins/tmp");
    this.queue = [];
    this.complete = true;
    this.error = true;
    cleanDir(this.options.tmp);
  };
  
  /**
   * Loads a plugin into cache
   */
  PluginLoader.prototype.load = function(id, version, callback) {
    this.queue.push({id: id, version: version, callback: callback});
    if (this.complete) {
      this.complete = false;
      next.call(this);
    }
  };
  
  /**
   * Unloads a plugin from cache 
   */
  // TODO: implement
  PluginLoader.prototype.unload = function(id) {
    if (typeof id == "undefined") {
      // remove all
    }
  };
  
  /**
   * Cleans a directory recursively
   */
  // TODO: replace with fs-extensions
  function cleanDir(path) {
    if ( fs.existsSync(path) ) {
      fs.readdirSync(path).forEach(function(file,index){
        var curPath = path + "/" + file;
        if ( fs.lstatSync(curPath).isDirectory() ) { // recurse
          cleanDir(curPath);
        } else { 
          // Delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  };
  
  /**
   * Simple GET-Request
   */
  function fetchURL(url, callback) {
    var data = [];
    http.get(url, function(res) {
      res.on('data', function(chunk){
        data.push(chunk);
      });
      res.on('end', function(){
        var string = data.join('').toString();
        var json = JSON.parse(string);
        callback(json);
      });
    }).on('error', function(e) {
      callback(null);
    });
  }
  
  // Reads plugin-id from plugin.xml 
  function getPluginId(pluginFile) {
    if (fs.existsSync(pluginFile)) {
      var xml = fs.readFileSync(pluginFile, 'utf8');
      if (xml) {
        var doc = new dom().parseFromString(xml);
        if (doc && doc.documentElement.nodeName == "plugin" && doc.documentElement.getAttribute('id')) {
          var pluginId = doc.documentElement.getAttribute('id');
          return pluginId;
        } else {
          console.error('not a valid plugin');
        }
      }
    } else {
      // Error: No plugin file found
      console.error("no plugin file found.");
    }
  }
  
  function load(id, version, callback, error) {
    var pluginLoader = this;
    var idHash = md5(id);
    var cacheDir;
    var rtn;
    if (version) {
      // Try to load plugin from cache
      var cDir = path.join(pluginLoader.options.cache, idHash);
      var pattern = path.join(pluginLoader.options.cache, idHash, "*", version);
      var files = glob.sync(pattern, {});
      if (files.length) {
        // Hash exists in cache
        cacheDir = files[0];
        var pluginId = getPluginId(path.join(cacheDir, "plugin.xml"));
        if (pluginId) {
          // plugin is cached
          var normalizedPath = path.relative(pluginLoader.options.path, cacheDir);
          callback.call(pluginLoader, pluginId, version, normalizedPath);
          return;
        }
      }
    } 
    // Create tmp-dir if not exists
    var tmpDir = path.join(this.options.tmp, path.basename(id).substring(0, path.basename(id).length - path.extname(id).length));
    if(!fs.existsSync(tmpDir)){
      fs.mkdirsSync(tmpDir);  
    }
    // Handle source types
    if (path.extname(id) === ".git") {
      // Clone git repository
      var cmd = "git clone ";
      if (version) {
        cmd+= "-b " + version + " ";
      }
      cmd+= id + " ";
      cmd+= tmpDir;
      // Execute command
      shell.exec(cmd);
      // Try to read plugin.xml
      var pluginId = getPluginId(path.join(tmpDir, "plugin.xml"));
      if (pluginId) {
        // Create cache-dir with plugin-id
        cacheDir = path.join(pluginLoader.options.cache, idHash, pluginId, version ? version : "master");
        if (!fs.existsSync(cacheDir)){
          fs.mkdirsSync(cacheDir); 
        }
        // Remove .git-project from tmp dir
        var rtn = shell.exec("rm -rv " + path.join(tmpDir, ".git"));
        if (rtn.code === 0) {
          // Copy files from tmp to cache dir
          fs.copySync(tmpDir, cacheDir);
          var normalizedPath = path.relative(pluginLoader.options.path, cacheDir);
          callback.call(pluginLoader, pluginId, version, normalizedPath);
          // Plugin has been loaded successfully from git repository
          return;
        } else {
          logger.error("Command finished with error code: " + rtn.code);
          error();
          return;
        }
        
        return;
      } else {
        // Invalid plugin
        console.error("no valid plugin");
        error();
        return;
      }
    } else {
      // Check registry for plugin
      var pluginRegistryUrl = "http://registry.cordova.io/" + id;
      fetchURL(pluginRegistryUrl, function(json) {
        if (json) {
          if (!json.error) {
            // Check versions
            var checkVersion = version ? version : json['dist-tags'].latest;
            var versionData = json.versions[checkVersion];
            if (versionData) {
              // Check download
              if (versionData.dist && versionData.dist.tarball) {
                // Download and extract tarball
                var downloadPath = path.join(tmpDir, path.basename(versionData.dist.tarball));
                var extractPath = tmpDir;
                tarball.extractTarballDownload(versionData.dist.tarball, downloadPath, extractPath, {}, function(err, result) {
                  if (err === null) {
                    // Tarball has been successfully downloaded and extracted
                    var packagePath = path.join(result.destination, "package");
                    if (fs.existsSync(packagePath, 0777, true)) {
                      // Package found
                      var pluginId = getPluginId(path.join(packagePath, "plugin.xml"));
                      // Check for valid plugin
                      if (pluginId) {
                        // Setup cache-dir with plugin-id
                        cacheDir = path.join(pluginLoader.options.cache, idHash, pluginId, checkVersion);
                        // Create cache-dir if not exists
                        if (!fs.existsSync(cacheDir)){
                          fs.mkdirsSync(cacheDir); 
                        }
                        // Copy files to cache-dir
                        fs.copySync(packagePath, cacheDir);
                        var normalizedPath = path.relative(pluginLoader.options.path, cacheDir);
                        // Finished downloading plugin
                        callback.call(pluginLoader, pluginId, version, normalizedPath);
                        return;
                      } else {
                        // Invalid plugin
                        logger.error("no valid plugin");
                        error();
                        return;
                      }
                    } else {
                      // Package not found
                      logger.error("package not found");
                      error();
                      return;
                    }
                  } else {
                    // Download error
                    logger.error("Error while downloading and extracting package: " + downloadPath);
                    error();
                    return;
                  }
                });
              }
            } else {
              // Version required
              logger.error("plugin version not found");
              error();
              return;
            }
          } else {
            // Document not found in registry
            logger.error("error: document not found");
            error();
            return;
          }
        } else {
          // No connection
          logger.error("Error: No connection");
          error();
          return;
        }
      });
    }
  }
  
  /**
   * Loads the next item in the queue
   */
  function next() {
    var pluginLoader = this;
    var item = this.queue.shift();
    if (item) {
      var id = item.id;
      var version = item.version;
      var callback = item.callback;
      setTimeout(function() {
        load.call(pluginLoader, id, version, function() {
          callback.apply(this, arguments);
          next.call(pluginLoader);
        }, function() {
          // Error
          fail.call(pluginLoader);
        });
      }, 10);
    } else {
      done.call(pluginLoader);
    }
  }
  
  /**
   * Called when loading of plugin has failed
   */
  function fail() {
    if (typeof this.options.error) {
      this.options.error();
    }
  }
  
  /**
   * Called when loading of plugin is done
   */
  function done() {
    this.complete = true;
    cleanDir(this.options.tmp);
    if (typeof this.options.success) {
      this.options.success();
    }
  }
  
  // Export PluginLoader class
  module.exports = PluginLoader;
