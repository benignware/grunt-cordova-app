'use strict';

var grunt = require('grunt');
var dom = require('xmldom').DOMParser;

/*
  ======== A Handy Little Nodeunit Reference ========
  https://github.com/caolan/nodeunit

  Test methods:
    test.expect(numAssertions)
    test.done()
  Test assertions:
    test.ok(value, [message])
    test.equal(actual, expected, [message])
    test.notEqual(actual, expected, [message])
    test.deepEqual(actual, expected, [message])
    test.notDeepEqual(actual, expected, [message])
    test.strictEqual(actual, expected, [message])
    test.notStrictEqual(actual, expected, [message])
    test.throws(block, [error], [message])
    test.doesNotThrow(block, [error], [message])
    test.ifError(value)
*/

exports.cordova_app = {
  setUp: function(done) {
    // setup here if necessary
    done();
  },
  build: function(test) {
    test.expect(1);

    var actual = grunt.file.read('tmp/config.xml');
    var expected = grunt.file.read('test/expected/config.xml');
    test.equal(actual, expected, 'config.xml should match expected result.');
    
    // TODO: Test compile

    test.done();
  },
};
