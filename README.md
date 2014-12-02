# grunt-cordova-app

> Automate build of cordova apps

## Getting Started
This plugin requires Grunt `~0.4.5`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-cordova-app --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-cordova-app');
```

## The "cordova_app" task

### Overview
In your project's Gruntfile, add a section named `cordova_build` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  cordova_app: {
    options: {
      path: 'tmp/cordova',
      clean: false,
      config: 'test/fixtures/cordova.json'
    }
  }
});
```

### Options

#### options.clean
Type: `Boolean`
Default value: `false`

Specifies whether to clean before build.

#### options.config
Type: `String`
Default value: `[generated from pkg]`

An object or source-file containing config options. source can be json or xml.

#### options.hooks
Type: `Object`
Default value: `{}`

An object containing functions to be called at certain hooks in the build process. Currently supported are `beforeBuild` and `afterBuild`.


#### options.path
Type: `String`
Default value: `'cordova'`

An object or source-file containing config options. source can be json or xml.

### Target flags

If you run task without any target-flags, the application will be built from scratch completely.

#### cordova_app:clean
Cleans up the build path.

#### cordova_app:create
Creates a new cordova-app on the build path.

#### cordova_app:config
Writes out config file and sets up platforms and plugins.

#### cordova_app:build
Builds the application. Arguments: --platform [platform]

#### cordova_app:run
Runs the application. Arguments: --platform [platform]

### Basic example

In this example, a cordova application is built from a json file. 

```js
grunt.initConfig({
  cordova_app: {
    options: {
      path: 'cordova',
      config: 'cordova.json',
      hooks: {
        beforeBuild: function() {
          // do something before the build
        }
      }
    }
  }
});
```
cordova.js
```json
{
  "id": "grunt.cordova.app.example-app", 
  "version": "0.0.1",
  "name": "Example App",
  "platforms": {
    "android": {}, "ios": {}
  }, 
  "plugins": {
    "org.apache.cordova.console": "0.2.10",
    "cc.fovea.cordova.purchase": "3.9.0-beta.4",
    "https://github.com/Wizcorp/phonegap-facebook-plugin.git": {
      "version": "0.10.1",
      "params": {  
        "APP_ID": "XXXXXXXXXXXXXXX", 
        "APP_NAME": "Fictional Facebook-App"
      }
    }
  }
}
```


## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
_(Nothing yet)_
