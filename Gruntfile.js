/*
 * grunt-cordova-build
 * https://github.com/rafaelnowrotek/grunt-cordova-build
 *
 * Copyright (c) 2014 Rafael Nowrotek
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    jshint: {
      all: [
        'Gruntfile.js',
        'tasks/*.js',
        '<%= nodeunit.tests %>'
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },
    
    // Copy sample app files to build path
    copy: {
      build: {
        files: [{expand: true, cwd: 'test/fixtures/app', src: ['**'], dest: 'tmp/custom_options/cordova/www'}]
      }
    },

    // Before generating any new files, remove any previously-created files.
    clean: {
      tests: ['tmp']
    },

    // Configuration to be run (and then tested).
    cordova_build: {
      default_options: {
        options: {
          path: 'tmp/default_options/cordova',
          clean: false,
          config: {
            name: "Hello My App"
          }
        }
      },
      custom_options: {
        options: {
          path: 'tmp/custom_options/cordova',
          clean: false,
          config: 'test/fixtures/cordova.json',
          hooks: {
            beforeBuild: function() {
              console.log("Before build hook is called");
              grunt.file.expand({cwd: "test/fixtures/app"}, "**/*").forEach(function(file) {
                console.log("Copy file: ", file);
                grunt.file.copy("test/fixtures/app/" + file, 'tmp/custom_options/cordova/www/' + file);
              });
            }
          }
        }
      }
    },

    // Unit tests.
    nodeunit: {
      tests: ['test/*_test.js']
    }

  });

  // Actually load this plugin's task(s).
  grunt.loadTasks('tasks');

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');

  // Whenever the "test" task is run, do not clean the "tmp" dir in order to use caching, then run this
  // plugin's task(s), then test the result.
  grunt.registerTask('test', ['cordova_build', 'nodeunit']);

  // By default, lint and run all tests.
  grunt.registerTask('default', ['jshint', 'test']);

};
