var 
  // global modules
  path = require("path"),
  xpath = require('xpath'),
  dom = require('xmldom').DOMParser, 
  js2xmlparser = require("js2xmlparser"),
  path = require('path'), 
  fs = require('node-fs'),
  ncp = require('ncp').ncp,
  chalk = require('chalk'),
  shell = require('shelljs'), 
  merge = require('deepmerge'), 
  http = require('http'),
  httpsync = require('httpsync'),  
  tarball = require('tarball-extract'), 
  md5 = require('MD5'), 
  glob = require("glob");


  /* 
   * cordova plugin cache
   */
  function PluginLoader(options) {
    this.options = options || {};
    this.options.path = options.path || "./";
    this.options.cache = path.join(this.options.path, options.cache || path.join("cache", "plugins"));
    this.options.tmp = path.join(this.options.path, options.tmp || path.join(this.options.cache, "tmp"));
    this.queue = [];
    this.complete = true;
    cleanDir(this.options.tmp);
  };
  
  PluginLoader.prototype.load = function(id, version, callback) {
    this.queue.push({id: id, version: version, callback: callback});
    if (this.complete) {
      this.complete = false;
      next.call(this);
    }
  };
  
  PluginLoader.prototype.unload = function(id) {
    if (typeof id == "undefined") {
      // remove all
    }
  };
  
  function cleanDir(path) {
    if ( fs.existsSync(path) ) {
      fs.readdirSync(path).forEach(function(file,index){
        var curPath = path + "/" + file;
        if ( fs.lstatSync(curPath).isDirectory() ) { // recurse
          cleanDir(curPath);
        } else { 
          // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  };
  
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
      // error: no plugin file found
      console.error("no plugin file found.");
    }
  }
  
  function load(id, version, callback) {
    var pluginLoader = this;
    var idHash = md5(id);
    var cacheDir;
    if (version) {
      var cDir = path.join(pluginLoader.options.cache, idHash);
      var pattern = path.join(pluginLoader.options.cache, idHash, "*", version);
      var files = glob.sync(pattern, {});
      if (files.length) {
        cacheDir = files[0];
        var pluginId = getPluginId(path.join(cacheDir, "plugin.xml"));
        if (pluginId) {
          // plugin is cached
          console.log("get plugin from cache...");
          var normalizedPath = path.relative(pluginLoader.options.path, cacheDir);
          callback.call(pluginLoader, pluginId, version, normalizedPath);
          return;
        }
      }
    } 
    // create tmp-dir if not exists
    var tmpDir = path.join(this.options.tmp, path.basename(id).substring(0, path.basename(id).length - path.extname(id).length));
    if(!fs.existsSync(tmpDir)){
      fs.mkdirSync(tmpDir, "777", true);  
    }
    // handle types
    if (path.extname(id) === ".git") {
      // clone git repository
      var cmd = "git clone ";
      if (version) {
        cmd+= "-b " + version + " ";
      }
      cmd+= id + " ";
      cmd+= tmpDir;
      // execute command
      shell.exec(cmd);
      // try to read plugin.xml
      var pluginId = getPluginId(path.join(tmpDir, "plugin.xml"));
      if (pluginId) {
        // create cache-dir with plugin-id
        cacheDir = path.join(pluginLoader.options.cache, idHash, pluginId, version ? version : "master");
        if (!fs.existsSync(cacheDir)){
          fs.mkdirSync(cacheDir, "777", true); 
        }
        fs.renameSync(tmpDir, cacheDir);
        var normalizedPath = path.relative(pluginLoader.options.path, cacheDir);
        callback.call(pluginLoader, pluginId, version, normalizedPath);
        return;
      } else {
        console.error("no valid plugin");
      }
    } else {
      // check registry for plugin
      var pluginRegistryUrl = "http://registry.cordova.io/" + id;
      fetchURL(pluginRegistryUrl, function(json) {
        if (json) {
          if (!json.error) {
            var checkVersion = version ? version : json['dist-tags'].latest;
            var versionData = json.versions[checkVersion];
            if (versionData) {
              if (versionData.dist && versionData.dist.tarball) {
                var downloadPath = path.join(tmpDir, path.basename(versionData.dist.tarball));
                var extractPath = tmpDir;
                tarball.extractTarballDownload(versionData.dist.tarball, downloadPath, extractPath, {}, function(err, result) {
                  if (err === null) {
                    var packagePath = path.join(result.destination, "package");
                    if (fs.existsSync(packagePath, "777", true)) {
                      var pluginId = getPluginId(path.join(packagePath, "plugin.xml"));
                      if (pluginId) {
                        // setup cache-dir with plugin-id
                        cacheDir = path.join(pluginLoader.options.cache, idHash, pluginId, checkVersion);
                        if (!fs.existsSync(cacheDir)){
                          fs.mkdirSync(cacheDir, "777", true); 
                          fs.renameSync(packagePath, cacheDir);
                        }
                      } else {
                        console.error("no valid plugin");
                      }
                    } else {
                      console.error("package not found");
                    }
                  }
                });
              }
            } else {
              console.error("plugin version not found");
            }
          } else {
            // error not found
            console.error("error: document not found");
          }
        } else {
          // error: no connection
          console.error("error: no connection");
        }
      });
    }
  }
  
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
        });
      }, 10);
    } else {
      complete.call(pluginLoader);
    }
  }
  
  function complete() {
    console.log("COMPLETE");
    this.complete = true;
    cleanDir(this.options.tmp);
    if (typeof this.options.complete) {
      this.options.complete();
    }
  }
  module.exports = PluginLoader;
