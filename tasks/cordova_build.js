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
  shell = require('shelljs'), 
  merge = require('deepmerge'), 
  http = require('http'), 
  tarball = require('tarball-extract'), 
  md5 = require('MD5'), 
  glob = require("glob"),
  cheerio = require("cheerio"),
  html = require("html"),
  // local modules
  logger = require('./lib/logger.js').getInstance(),
  Config = require('./lib/config.js'),
  PluginLoader = require('./lib/loader.js');

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks
  
  // pkg info
  var pkg = grunt.file.readJSON('package.json');
  
  // config object
  var cfg;
  
  var defaults = {
    path: 'cordova', 
    clean: false,
    build: true,
    hooks: {}, 
    config: {
      // defaults
      id: "grunt.cordova.build",
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
    }
  };
  
  // executes user-defined pre- or post-tasks
  var execHook = function( shell, commands, options) {
    if (!commands) {
      return;
    }
    if (typeof commands === 'string' || typeof commands === 'function') {
      commands = [commands];
    }
    if (commands instanceof Array) {
      commands.forEach(function(command) {
        if (typeof command === 'string') {
          shell.exec(command);
        }
        if (typeof command === 'function') {
          command(shell, options.path);
        }
      });
    }
  };
  
  // sub-tasks
  var tasks = {
    /*
     * Init config
     */
    init: function(options, callback) {
      logger.log("Init grunt-cordova-build");
      cfg = new Config();
      // get config files
      if (typeof options.config === 'string') {
        // parse config file
        if ( grunt.file.isFile( options.config ) ) {
          cfg.load( options.config );
        } else {
          logger.error("config file not found: " + options.config);
          callback(false);
          return;
        }
      } else {
        cfg.load(options.config);
      }
      options.config = cfg.toJSON();
      // validate required options
      if ( !options.config.name ) {
        logger.error("App name must be specified.");
        callback(false);
        return;
      }
      if ( !options.config.id ) {
        logger.error("App id must be specified.");
        callback(false);
        return;
      }
      
      if ( !options.config.version ) {
        logger.error("App version must be specified.");
        callback(false);
        return;
      }
      callback(true);
    },
    // Clean build path
    clean: function(options, callback) {
      if (grunt.file.isDir(options.path) && options.clean) {
        logger.log("Clean path '" + options.path + "'");
        execHook(shell, options.hooks.beforeClean, options);
        grunt.file.delete(options.path);
        execHook(shell, options.hooks.afterClean, options);
      }
      callback(true);
    },
    /* 
     * Create app
     */
    create: function(options, callback) {
      // Create app
      if (!grunt.file.isDir( options.path )) {
        logger.log("Create cordova app " + options.config.id);
        fs.mkdirSync(options.path, "777", true);
        execHook(shell, options.hooks.beforeCreate, options);
        var rtn = shell.exec("cordova create \"" + options.path + "\" \"" + options.config.id + "\" \"" + options.config.name + "\"");
        if (rtn.code !== 0) {
          logger.error(chalk.red(rtn.output + " failed with error code " + rtn.code));
          callback(false);
          return;
        }
        execHook(shell, options.hooks.afterCreate, options);
      }
      callback(true);
    },
    /*
     * Build config
     */
    config: function(options, callback) {
      var dest = path.join(options.path, "config.xml");
      // build config
      if (typeof options.config == 'object' && cfg) {
        if (!grunt.file.isDir( options.path )) {
          logger.error('Build path does not exist');
          callback(false);
          return;
        }
        execHook(shell, options.hooks.beforeConfig, options);
        // write out xml
        cfg.save(dest);
        execHook(shell, options.hooks.afterConfig, options);
      }
      // read config
      cfg = new Config();
      cfg.load(dest);
      options.config = cfg.toJSON();
      callback(true);
    },
    /*
     * Sanitizes index.html and adds cordova.js
     */
    sanitize: function(options, callback) {
      var file = options.config.content && options.config.content.src || path.join(options.path, "www", "index.html"); 
      var $ = cheerio.load(grunt.file.read(file));
      if ( !$("script[src='cordova.js']").length ) {
        $('head').append('<script src="cordova.js"></script>');
      }
      grunt.file.write(file, html.prettyPrint($.root().html(), {
        indent_size: 2
      }));
      callback(true);
    },
    /*
     * Remove Plugins
     */
    removePlugins: function(options, callback) {
      var oldPlugins = grunt.file.expand({filter: 'isDirectory', cwd: path.join(options.path, "plugins")}, "*");
      var success = true;
      if (oldPlugins.length) {
        oldPlugins.forEach(function(pluginName) {
          if (success && grunt.file.isDir( path.join( options.path, "plugins", pluginName ))) {
            logger.log("Remove plugin: " + pluginName);
            execHook(shell, options.hooks.beforePluginRemove, options);
            var rtn = shell.exec("cd " + options.path + " && cordova plugin rm " + pluginName + "");
            if (rtn.code !== 0) {
              logger.error(chalk.red(rtn.output + " failed with error code " + rtn.code));
              success = false;
              return;
            }
            execHook(shell, options.hooks.afterPluginRemove, options);
          }
        });
      }
      callback(success);
    },
    /*
     * Add Plugins
     */
    addPlugins: function(options, callback) {
      var success = true;
      if (typeof options.config.plugins != "object") {
        callback(true);
        return;
      }
      var pluginNames = Object.keys(options.config.plugins);
      if (pluginNames.length === 0) {
        callback(true);
        return;
      }
      var pluginLoader = new PluginLoader({
        path: options.path, 
        success: function() {
          callback(true);
        },
        error: function() {
          callback(false);
        }
      });
      pluginNames.forEach(function(pluginName) {
        if (success) {
          var plugin = options.config.plugins[pluginName];
          logger.info("Add plugin " + pluginName + "@" + plugin.version + "...");
          pluginLoader.load(pluginName, plugin.version, function(id, version, src) {
            if (id) {
              execHook(shell, options.hooks.beforePluginAdd, options);
              var pluginCommand = "cd " + options.path + " && cordova plugin -d add " + src, pluginParamName;
              for (pluginParamName in plugin.params) {
                pluginCommand+= " --variable " + pluginParamName + "=\"" + plugin.params[pluginParamName] + "\"";
              }
              var rtn = shell.exec(pluginCommand);
              if (rtn.code !== 0) {
                logger.error(chalk.red(rtn.output + " failed with error code " + rtn.code));
                return;
              }
              execHook(shell, options.hooks.afterPluginAdd, options);
            } else {
              // error
            }
          });
        }
      });
    },
    /*
     * Remove platforms
     */
    removePlatforms: function(options, callback) {
      var oldPlatforms = grunt.file.expand({filter: 'isDirectory', cwd: path.join(options.path, "platforms")}, "*");
      oldPlatforms.forEach(function(platform) {
        execHook(shell, options.hooks.beforePlatformRemove, options);
        logger.info("Remove platform " + platform + "");
        var rtn = shell.exec("cd " + options.path + " && cordova platform remove " + platform + "");
        if (rtn.code !== 0) {
          logger.error(chalk.red(rtn.output + " failed with error code " + rtn.code));
          callback(false);
          return;
        }
        execHook(shell, options.hooks.afterPlatformRemove, options);
      });
      callback(true);
    },
    /*
     * Add platforms
     */
    addPlatforms: function(options, callback) {
      var success = true;
      if (typeof options.config.platforms == "object") {
        // add platforms
        Object.keys(options.config.platforms).forEach(function(platform) {
          if (success) {
            // call user-defined hook
            execHook(shell, options.hooks.beforePlatformAdd, options);
            logger.info("Add platform " + platform + "");
            var rtn = shell.exec("cd \"" + options.path + "\" && cordova platform add " + platform + "");
            if (rtn.code !== 0) {
              logger.error(chalk.red(rtn.output + " failed with error code " + rtn.code));
              success = false;
              return;
            }
            // call user-defined hook
            execHook(shell, options.hooks.afterPlatformAdd, options);
          }
        });
      }
      callback(success);
    },
    /*
     * Prepare
     */
    prepare: function(options, callback) {
      var success = true;
      if (typeof options.config.platforms == "object") {
        // call user-defined hook
        execHook(shell, options.hooks.beforePrepare, options);
        // iterate through platforms and exec prepare
        Object.keys(options.config.platforms).forEach(function(platform) {
          if (success) {
            logger.info("Prepare platform " + platform + "");
            var rtn = shell.exec("cd \"" + options.path + "\" && cordova prepare " + platform + "");
            if (rtn.code !== 0) {
              logger.error(chalk.red(rtn.output + " failed with error code " + rtn.code));
              success = false;
              return;
            }
          }
        });
        // call user-defined hook
        execHook(shell, options.hooks.afterPrepare, options);
      }
      callback(success);
    },
    /*
     * Compile
     */
    compile: function(options, callback) {
      var success = true;
      if (typeof options.config.platforms == "object") {
        // call user-defined hook
        execHook(shell, options.hooks.beforeCompile, options);
        // iterate through platforms and exec prepare
        Object.keys(options.config.platforms).forEach(function(platform) {
          logger.info("Compile platform " + platform + "");
          var rtn = shell.exec("cd \"" + options.path + "\" && cordova compile " + platform + "");
          if (rtn.code !== 0) {
            logger.error(chalk.red(rtn.output + " failed with error code " + rtn.code));
            success = false;
            return;
          }
        });
        // call user-defined hook
        execHook(shell, options.hooks.afterCompile, options);
      }
      callback(success);
    },
    beforeBuild: function(options, callback) {
      execHook(shell, options.hooks.beforeBuild, options);
      callback(true);
    },
    afterBuild: function(options, callback) {
      execHook(shell, options.hooks.afterBuild, options);
      callback(true);
    }
  };
  
  function run(taskQueue, options) {
    var task = taskQueue.shift();
    if (task) {
      tasks[task](options, function(success) {
        if (success) {
          run(taskQueue, options);
        } else {
          done(false);
        }
      });
    } else {
      // done without errors
    }
  }
  
  // TODO: single tasks
  grunt.registerMultiTask('cordova_build', 'Automate build of cordova apps', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var done = this.async();
    
    var options = merge(defaults, this.options());
    
    // start the queue
    run([
      'init',
      'clean',
      'create',
      'config',
      'sanitize',
      'beforeBuild',
      'removePlatforms',
      'removePlugins',
      'addPlatforms',
      'addPlugins',
      'prepare',
      'compile',
      'afterBuild'
    ], options);
    
    
  });
};
