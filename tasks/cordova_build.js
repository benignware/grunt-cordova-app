/*
 * grunt-cordova-build
 * https://github.com/rafaelnowrotek/grunt-cordova-build
 *
 * Copyright (c) 2014 Rafael Nowrotek
 * Licensed under the MIT license.
 */
'use strict';

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
  tarball = require('tarball-extract'), 
  md5 = require('MD5'), 
  glob = require("glob"),
  // local modules
  Config = require('./lib/config.js'),
  PluginLoader = require('./lib/loader.js');

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks
  
  // pkg info
  var pkg = grunt.file.readJSON('package.json');
  
  var defaults = {
    path: 'cordova', 
    clean: false, 
    config: {
      // defaults
      id: "grunt.cordova.build", 
      xmlns: {
        "default": "http://www.w3.org/ns/widgets",
        "cdv": "http://cordova.apache.org/ns/1.0",
        "gap": "http://phonegap.com/ns/1.0"
      },
      version: pkg.version,
      name: pkg.name,
      description: "cordova-app description", 
      author: {
        email: "author@example.com", 
        url: "homepage@example.com"
      },
      content: {
        src: "index.html"
      }, 
      access: {
        origin: "*"
      }, 
      // global preferences
      icons: [], 
      preferences: {},
      platforms: {}, 
      plugins: {}
      // TODO: features, screens, ...
    },
    // tests
    punctuation: '.',
    separator: ', '
  };
  
  var log = function(message) {
    console.log(chalk.cyan(message), chalk.green(" "));
  };
  
  var init = function(options) {
    log("Init grunt-cordova-build");
    // normalize config source
    if (typeof options.config === 'string') {
      options.config = merge(defaults.config, {
        src: options.config
      });
    }
    if (typeof options.config.src !== 'undefined') {
      options.config.src = typeof options.config.src === "string" ? [options.config.src] : options.config.src;
    }
    // normalize config platforms
    if (options.config.platforms instanceof Array) {
      var platforms = {};
      for (var platform in options.config.platforms) {
        platforms[platform] = {};
      }
      options.config.platforms = platforms;
    }
    // get config files
    if (options.config.src instanceof Array) {
      var source = options.config.src;
      delete options.config.src;
      // parse config files
      source.forEach( function( src ) {
        if ( grunt.file.isFile( src ) ) {
          var contents = grunt.file.readJSON( src );
          options.config = merge( options.config, contents );
        } else {
          console.error("config file not found: " + src);
        }
      });
    }
  };
  
  // cleans build path
  var clean = function(options) {
    // Clean
    if (grunt.file.isDir(options.path) && options.clean) {
      log("Clean path '" + options.path + "'");
      grunt.file.delete(options.path);
    }
  };
  
  // creates a cordova project under the build path
  var create = function(options) {
    // Create app
    if (!grunt.file.isDir( options.path )) {
      log("Create cordova app " + options.config.id);
      fs.mkdirSync(options.path, "777", true);  
      var rtn = shell.exec("cordova create \"" + options.path + "\" \"" + options.config.id + "\" \"" + options.config.name + "\"");
      if (rtn.code !== 0) {
        console.error(chalk.red(rtn.output + " failed with error code " + rtn.code));
      }
    }
  };
  
  // builds config.xml
  var config = function(options) {
    if (!grunt.file.isDir( options.path )) {
      console.error('build path does not exist');
      return;
    }
    var dest = path.join(options.path, "config.xml");
    //console.log(chalk.green("build config"));
    // write out xml
    var xml = Config.stringify( options.config );
    grunt.file.write( dest, xml );
    // read config.xml
    xml = grunt.file.read(dest);
    options.config = Config.parse(xml);
  };
  
  var removePlugins = function(options) {
    var oldPlugins = grunt.file.expand({filter: 'isDirectory', cwd: path.join(options.path, "plugins")}, "*");
    if (oldPlugins.length) {
      oldPlugins.forEach(function(pluginName) {
        if (grunt.file.isDir( path.join( options.path, "plugins", pluginName ))) {
          log("Remove plugin: " + pluginName);
          shell.exec("cd " + options.path + " && cordova plugin rm " + pluginName + "");
        }
      });
    }
  };
  
  var addPlugins = function(options, callback) {
    if (typeof options.config.plugins != "object") {
      callback();
      return;
    }
    var pluginNames = Object.keys(options.config.plugins);
    if (pluginNames.length === 0) {
      callback();
      return;
    }
    var pluginLoader = new PluginLoader({
      path: options.path, 
      complete: function() {
        callback();
      }
    });
    pluginNames.forEach(function(pluginName) {
      var plugin = options.config.plugins[pluginName];
      log("Add plugin " + pluginName + "@" + plugin.version + "...");
      pluginLoader.load(pluginName, plugin.version, function(id, version, src) {
        var pluginCommand = "cd " + options.path + " && cordova plugin -d add " + src, pluginParamName;
        for (pluginParamName in plugin.params) {
          pluginCommand+= " --variable " + pluginParamName + "=\"" + plugin.params[pluginParamName] + "\"";
        }
        shell.exec(pluginCommand);
      });
    });
  };
  
  
  // remove platforms
  var removePlatforms = function(options) {
    var oldPlatforms = grunt.file.expand({filter: 'isDirectory', cwd: path.join(options.path, "platforms")}, "*");
    oldPlatforms.forEach(function(platform) {
      log("Remove platform " + platform + "");
      shell.exec("cd " + options.path + " && cordova platform remove " + platform + "");
    });
  };
  
  // add platforms
  var addPlatforms = function(options) {
    // prepare platforms
    if (typeof options.config.platforms == "object") {
      Object.keys(options.config.platforms).forEach(function(platform) {
        log("Add platform " + platform + "");
        shell.exec("cd \"" + options.path + "\" && cordova platform add " + platform + "");
      });
    }
  };
  
  // preparing includes setup of platforms and plugins
  var prepare = function(options) {
    // prepare platforms
    if (typeof options.config.platforms == "object") {
      Object.keys(options.config.platforms).forEach(function(platform) {
        log("Prepare platform " + platform + "");
        shell.exec("cd \"" + options.path + "\" && cordova prepare " + platform + "");
      });
    }
  };
  
  var compile = function(options) {
    // compile platforms
    if (typeof options.config.platforms == "object") {
      Object.keys(options.config.platforms).forEach(function(platform) {
        log("Compile platform " + platform + "");
        shell.exec("cd \"" + options.path + "\" && cordova compile " + platform + "");
      });
    }
  };

  grunt.registerMultiTask('cordova_build', 'Automate build of cordova apps', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    
    var done = this.async();
    
    var options = merge(defaults, this.options());
    
    init(options);
    clean(options);
    
    create(options);
    config(options);
    
    removePlatforms(options);
    removePlugins(options);
    
    addPlatforms(options);
    addPlugins(options, function() {
      
      // build
      prepare(options);
      compile(options);
      
      log("Done.");
      
      done();
      
    });

    
  });

};
