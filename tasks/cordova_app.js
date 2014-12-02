/*
 * grunt-cordova-app
 * https://github.com/benignware/grunt-cordova-app
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
  logger = require('./lib/logger.js'),
  config = require('./lib/config.js'),
  PluginLoader = require('./lib/loader.js');

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks
  
  // pkg info
  var pkg = grunt.file.readJSON('package.json');
  
  var defaults = {
    path: 'cordova', 
    clean: false,
    build: true,
    hooks: {},
    config: {
      // config defaults
      id: "grunt.cordova.build",
      version: pkg.version || "version 0.0.1",
      name: pkg.name || "grunt-cordova-app",
      description: "cordova-app description", 
      author: {
        name: pkg.author && pkg.author.name || "Author Name", 
        email: pkg.author && pkg.author.email || "author@example.com", 
        url: pkg.author && pkg.author.url || "homepage@example.com"
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
  
  // helpers
  var exec = function( shell, command, callback ) {
    var rtn = shell.exec(command);
    if (rtn.code !== 0) {
      logger.error("Command finished with error code " + rtn.code + ":" + command);
      if (callback) {
        callback(false);
      }
    }
    if (callback) {
      callback(true);
    }
    return rtn;
  };
  
  // executes user-defined pre- or post-tasks
  var execHook = function( shell, commands, options ) {
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
  // TODO: reduce to build phases
  var subTasks = {
    /*
     * Init config
     */
    initConfig: function(options, callback) {
      // get config files
      if (typeof options.config === 'string') {
        // parse config file
        if ( grunt.file.isFile( options.config ) ) {
          config.load( options.config );
        } else {
          logger.error("config file not found: " + options.config);
          callback(false);
          return;
        }
      } else {
        config.load(options.config);
      }
      options.config = merge(defaults, config.toJSON());
      callback(true);
    },
    // Clean build path
    clean: function(options, callback) {
      if (options.clean) {
        if (grunt.file.isDir(options.path)) {
          logger.info("Clean path '" + options.path + "'");
          // exec beforeClean-hook
          execHook(shell, options.hooks.beforeClean, options);
          grunt.file.delete(options.path);
          // exec afterClean-hook
          execHook(shell, options.hooks.afterClean, options);
        } else {
          logger.warn("Path '" + options.path + "' is not a directory");
        }
      }
      callback(true);
    },
    /* 
     * Create app
     */
    create: function(options, callback) {
      // Create app
      if (!grunt.file.isDir( options.path )) {
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
        logger.info("Create cordova app " + options.config.id);
        fs.mkdirSync(options.path, "777", true);
        // exec beforeCreate-hook
        var rtn = exec(shell, "cordova create \"" + options.path + "\" \"" + options.config.id + "\" \"" + options.config.name + "\"");
        if (rtn.code !== 0) {
          callback(false);
          return;
        }
        // exec afterCreate-hook
      } else {
        //logger.warn("Path '" + options.path + "' is not an empty directory");
      }
      callback(true);
    },
    /*
     * Build config
     */
    writeConfig: function(options, callback) {
      var dest = path.join(options.path, "config.xml");
      // build config
      if (typeof options.config === 'object') {
        if (!grunt.file.isDir( options.path )) {
          logger.error('Build path does not exist');
          callback(false);
          return;
        }
        // write out xml
        config.save(dest);
      }
      callback(true);
    },
    /*
     * Read config
     */
    readConfig: function(options, callback) {
      // read config
      var dest = path.join(options.path, "config.xml");
      config.load(dest);
      options.config = config.toJSON();
      callback(true);
    },
    /*
     * Sanitizes index.html and adds cordova.js
     */
    sanitize: function(options, callback) {
      var file = options.config.content && options.config.content.src || path.join(options.path, "www", "index.html"); 
      if ( grunt.file.isFile( file ) ) {
        var $ = cheerio.load(grunt.file.read(file));
        if ( !$("script[src='cordova.js']").length ) {
          $('head').append('<script src="cordova.js"></script>');
        }
        grunt.file.write(file, html.prettyPrint($.root().html(), {
          indent_size: 2
        }));
        callback(true);
      } else {
        callback(false);
      }
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
            logger.info("Remove plugin: " + pluginName);
            var rtn = exec(shell, "cd " + options.path + " && cordova plugin rm " + pluginName + "");
            if (rtn.code !== 0) {
              success = false;
              return;
            }
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
      if (typeof options.config.plugins !== "object") {
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
              var pluginCommand = "cd " + options.path + " && cordova plugin -d add " + src, pluginParamName;
              for (pluginParamName in plugin.params) {
                pluginCommand+= " --variable " + pluginParamName + "=\"" + plugin.params[pluginParamName] + "\"";
              }
              var rtn = exec(shell, pluginCommand);
              if (rtn.code !== 0) {
                success = false;
                callback(false);
                return;
              }
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
        logger.info("Remove platform " + platform + "");
        var rtn = exec(shell, "cd " + options.path + " && cordova platform remove " + platform + "");
        if (rtn.code !== 0) {
          callback(false);
          return;
        }
      });
      callback(true);
    },
    /*
     * Add platforms
     */
    addPlatforms: function(options, callback) {
      var success = true;
      if (typeof options.config.platforms === "object") {
        // add platforms
        Object.keys(options.config.platforms).forEach(function(platform) {
          if (success) {
            logger.info("Add platform " + platform + "");
            var rtn = exec(shell, "cd " + options.path + " && cordova platform add " + platform + "");
            if (rtn.code !== 0) {
              success = false;
              return;
            }
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
      if (typeof options.config.platforms === "object") {
        // filter platform option
        var platforms = grunt.option('platform') ? [grunt.option('platform')] : Object.keys(options.config.platforms);
        // iterate through platforms and exec prepare
        platforms.forEach(function(platform) {
          if (success) {
            logger.info("Prepare platform " + platform + "");
            var rtn = exec(shell, "cd " + options.path + " && cordova prepare " + platform + "");
            if (rtn.code !== 0) {
              success = false;
              return;
            }
          }
        });
      }
      callback(success);
    },
    /*
     * Compile
     */
    compile: function(options, callback) {
      var success = true;
      if (typeof options.config.platforms === "object") {
        // filter platform option
        var platforms = grunt.option('platform') ? [grunt.option('platform')] : Object.keys(options.config.platforms);
        // iterate through platforms and exec prepare
        platforms.forEach(function(platform) {
          logger.info("Compile platform " + platform + "");
          var rtn = exec(shell, "cd " + options.path + " && cordova compile " + platform + "");
          if (rtn.code !== 0) {
            success = false;
            return;
          }
        });
      }
      callback(success);
    },
    /*
     * Before Build Hook 
     */
    beforeBuild: function(options, callback) {
      execHook(shell, options.hooks.beforeBuild, options);
      callback(true);
    },
    /*
     * After Build Hook 
     */
    afterBuild: function(options, callback) {
      execHook(shell, options.hooks.afterBuild, options);
      callback(true);
    },
    /*
     * Run
     */
    run: function(options, callback) {
      var success = true;
      if (typeof options.config.platforms === "object") {
        // filter platform option
        var platforms = grunt.option('platform') ? [grunt.option('platform')] : Object.keys(options.config.platforms);
        // iterate through platforms and exec prepare
        platforms.forEach(function(platform) {
          logger.info("Run platform " + platform + "");
          var rtn = exec(shell, "cd " + options.path + " && cordova run " + platform + "");
          if (rtn.code !== 0) {
            success = false;
            return;
          }
        });
      }
      callback(success);
    },
  };
  
  // run sub-tasks
  function runTasks(object, taskQueue, options, promise) {
    var task = taskQueue.shift();
    if (task) {
      if (object[task]) {
        object[task](options, function(success) {
          if (success) {
            runTasks(object, taskQueue, options, promise);
          } else {
            promise(false);
          }
        });
      } else {
        // Error: Task not found
        logger.error("Subtask '" + task + "' not found");
      }
    } else {
      // done without errors
      promise(true);
    }
  }
  
  // TODO: single tasks
  grunt.registerTask('cordova_app', 'Automate build of cordova apps', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    
    var done = this.async();
    var options = merge(defaults, this.options());
    
    var taskList = [];
    var flags = this.flags;
    
    if (flags.clean) {
      options.clean = true;
    }
    
    if (Object.keys(flags).length === 0) {
      // default tasks
      taskList = [
        'initConfig', 
        'clean',
        'create',
        'writeConfig',
        'readConfig',
        'removePlatforms',
        'removePlugins',
        'addPlatforms',
        'addPlugins',
        'beforeBuild',
        'sanitize',
        'prepare',
        'compile',
        'afterBuild'
      ];
    }
    
    if (this.flags.clean) {
      taskList = [
        "initConfig", 
        "clean"
      ];
    }
    
    if (this.flags.create) {
      taskList = [
        "initConfig", 
        "create"
      ];
    }
    
    if (this.flags.config) {
      taskList = [
        'initConfig', 
        'writeConfig',
        'readConfig',
        'removePlatforms',
        'removePlugins',
        'addPlatforms',
        'addPlugins'
      ];
    }
    
    if (this.flags.build) {
      taskList = [
        'readConfig',
        'beforeBuild',
        'sanitize',
        'prepare',
        'compile',
        'afterBuild'
      ];
    }
    
    if (this.flags.run) {
      taskList = [
        'readConfig',
        'run'
      ];
    }
    // start the queue
    runTasks(subTasks, taskList, options, done);
  });
  
};
