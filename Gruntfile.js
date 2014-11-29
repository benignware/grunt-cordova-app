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
          config: 'test/fixtures/cordova.json'
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
  grunt.loadNpmTasks('grunt-contrib-nodeunit');

  // Whenever the "test" task is run, do not clean the "tmp" dir in order to use caching, then run this
  // plugin's task(s), then test the result.
  grunt.registerTask('test', ['cordova_build', 'nodeunit']);

  // By default, lint and run all tests.
  grunt.registerTask('default', ['jshint', 'test']);

};
