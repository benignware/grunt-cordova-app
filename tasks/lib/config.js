'use strict';
var
  xpath = require('xpath'),
  xmldom = require('xmldom'), 
  js2xmlparser = require("js2xmlparser"), 
  xml2js = require("xml2js"),
  fs = require('fs-extra'),
  merge = require("deepmerge"),
  path = require("path"),
  _ = require('lodash'),
  logger = require('./logger');

var namespaces = {
  "default": "http://www.w3.org/ns/widgets", 
  "cdv": "http://cordova.apache.org/ns/1.0",
  "gap": "http://phonegap.com/ns/1.0"
};

// builds a js2xmlparser-compatible object from cordova config options
var js2domjs = function(options) {
  var data = {"@": {}}, i, attr;
  // widget
  var attrs = ['id', 'version', 'android-versionCode', 'ios-CFBundleVersion'];
  attrs.forEach(function(attr) {
    if (typeof options[attr] !== "undefined") {
      data["@"][attr] = options[attr];
    }
  });
  //  name
  if (typeof options.name === "string") {
    data.name = options.name;
  }
  //  name
  if (typeof options.description === "string") {
    data.description = options.description;
  }
  // author
  if (typeof options.author === "object") {
    data.author = {"@": {}};
    Object.keys(options.author).forEach(function(prop) {
      if (prop === "name") {
        data.author["#"] = options.author[prop];
      } else {
        data.author["@"][prop] = options.author[prop];
      }
    });
  }
  // access
  if (typeof options.access === "object") {
    data.access = {
      "@": options.access
    };
  }
  // content
  if (typeof options.content === "object") {
    data.content = {
      "@": options.content
    };
  }
  // preferences
  if (typeof options.preferences == "object") {
    var preferences = [], key;
    for (key in options.preferences) {
      preferences.push({
        "@": {
          name: key, 
          value: options.preferences[key]
        } 
      });
    }
    data.preference = preferences;
  }
  // icons
  if (options.icons instanceof Array) {
    data.icon = options.icons.map(function(icon) {
      return {
        "@": icon
      };
    });
  }
  // splash
  if (options.splash instanceof Array) {
    data.splash = options.splash.map(function(screen) {
      return {
        "@": splash
      };
    });
  }
  // platforms
  if (typeof options.platforms == "object") {
    var platform, platforms = [];
    for (platform in options.platforms) {
      platforms.push(merge({
        "@": {
          name: platform
        }
      }, js2domjs(options.platforms[platform])));
    }
    data.platform = platforms;
  }
  // plugins
  if (typeof options.plugins == "object") {
    var plugin, plugins = [], params;
    for (plugin in options.plugins) {
      var pluginData = options.plugins[plugin];
      if (typeof pluginData == "string") {
        pluginData = {
          version: pluginData
        };
      }
      pluginData.name = plugin;
      params = [];
      if (pluginData.params) {
        for (var param in pluginData.params) {
          params.push({
            "@": {
              name: param, 
              value: pluginData.params[param]
            }
          });
        }
        delete pluginData.params;
      }
      var pluginXmlJs = {
        "@": pluginData
      };
      if (params.length) {
        pluginXmlJs.param = params;
      }
      plugins.push(pluginXmlJs);
    }
    data["gap:plugin"] = plugins;
  }
  return data;
};

var dom2js = function(node) {
  var select = xpath.useNamespaces(namespaces);
  var result = {};
  var rootNode = select(".", node)[0];
  if (rootNode) {
    // top-level attributes
    var attrs = ['id', 'version', 'android-versionCode', 'ios-CFBundleVersion'];
    attrs.forEach(function(attr) {
      var value = rootNode.getAttribute(attr);
      if (value) {
        result[attr] = value;
      }
    });
    // name
    var nameNodes = select("./default:name", node);
    if (nameNodes.length && nameNodes[0].firstChild) {
      result.name = nameNodes[0].firstChild.nodeValue;
    }
    // description
    var descriptionNodes = select("./default:description", node);
    if (descriptionNodes.length && descriptionNodes[0].firstChild) {
      result.description = descriptionNodes[0].firstChild.nodeValue;
    }
    // author
    var authorNodes = select("./default:author", node);
    if (authorNodes.length) {
      var author = {
        email: authorNodes[0].getAttribute('email'), 
        href: authorNodes[0].getAttribute('href')
      };
      if (authorNodes[0].firstChild) {
        author.name = authorNodes[0].firstChild.nodeValue;
      }
      result.author = author;
    }
    // preferences
    var preferenceNodes = select("./default:preference", node);
    if (preferenceNodes.length) {
      result.preferences = {};
      preferenceNodes.forEach(function(preferenceNode) {
        var name = preferenceNode.getAttribute('name');
        if (name) {
          var value = preferenceNode.getAttribute('value');
          result.preferences[name] = value;
        }
      });
    }
    // platforms
    var platformNodes = select("./default:platform", node);
    if (platformNodes.length) {
      result.platforms = {};
      platformNodes.forEach(function(platformNode) {
        var name = platformNode.getAttribute('name');
        if (name) {
          result.platforms[name] = dom2js(platformNode);
        }
      });
    }
    // plugins
    var pluginNodes = select("./gap:plugin", node);
    if (pluginNodes.length) {
      result.plugins = {};
      pluginNodes.forEach(function(pluginNode) {
        var name = pluginNode.getAttribute('name');
        if (name) {
          var version = pluginNode.getAttribute('version');
          var plugin = {
            version: version ? version : "", 
            params: {}
          };
          var pluginParamNodes = select("./default:param", pluginNode);
          if (pluginParamNodes.length) {
            pluginParamNodes.forEach(function(pluginParamNode) {
              var name = pluginParamNode.getAttribute('name');
              if (name) {
                plugin.params[name] = pluginParamNode.getAttribute('value');
              }
            });
          }
          result.plugins[name] = plugin;
        }
      });
    }
    // icons
    var iconNodes = select("./default:icon", node);
    if (iconNodes.length) {
      result.icons = iconNodes.map(function(iconNode) {
        return {
          src: iconNode.getAttribute('src'),
          width: iconNode.getAttribute('width'),
          height: iconNode.getAttribute('height') 
        };
      });
    }
    // splash
    var splashNodes = select("./default:splash", node);
    if (splashNodes.length) {
      result.splashs = splashNodes.map(function(splashNode) {
        return {
          src: splashNode.getAttribute('src'),
          width: splashNode.getAttribute('width'),
          height: splashNode.getAttribute('height') 
        };
      });
    }
    return result;
  }
};

function normalize(json) {
  // normalize config platforms
  if (json.platforms instanceof Array) {
    var platforms = {};
    for (var platform in options.config.platforms) {
      platforms[platform] = {};
    }
    json.platforms = platforms;
  }
  return json;
}

function Config() {
  // keep domjs-representation
  this.json = null;
  this.domjs = null;
}

Config.prototype.toJSON = function() {
  return this.json;
};

Config.prototype.toXML = function() {
  var xml;
  if (this.domjs) {
    var domjs = this.domjs;
    Object.keys(namespaces).forEach(function(ns) {
      domjs["@"][ns !== "default" ? "xmlns:" + ns : "xmlns"] = namespaces[ns]; 
    });
    xml = js2xmlparser( "widget", domjs );
  }
  return xml;
};

Config.prototype.load = function(file, data) {
  data = typeof data === "object" ? data : {};
  // Load config data
  var json, doc;
  if (typeof file == "object") {
    // read object
    if (file.documentElement || file.ownerDocument) {
      // read xml-document
      doc = file;
    } else {
      // read json and merge with options
      json = merge(file, options);
    }
  }
  if (!json && !doc) {
    // Try to read file
    var contents = fs.readFileSync(file, 'utf8');
    if (contents) {
      if (typeof data === 'object') {
        // Process template
        contents = _.template(contents, data);
      }
      if (path.extname(file) === '.json') {
        // Parse json
        try {
          json = JSON.parse(contents);
        } catch(e) {
          // No valid json input
          logger.error("No valid json input: " + file);
        }
      } else if (path.extname(file) === '.xml') {
        // Parse xml
        try {
          doc = new xmldom.DOMParser().parseFromString(contents);
        } catch(e) {
          // No valid xml input
          logger.error("No valid xml input: " + file);
        }
      } else {
        // No valid input at all
        logger.error("No valid input: " + file);
        return;
      }
    }
  }
  
  if (json) {
    // Set json result
    this.json = normalize(json);
    this.domjs = js2domjs(json);
    
  } else if (doc && contents) {
    // Parse xml
    // Get json
    json = dom2js(doc.documentElement);
    this.json = normalize(json);
    
    // Get domjs
    var domjs;
    var parser = new xml2js.Parser({attrkey: "@", charkey: "#"});
    parser.parseString(contents, function (err, result) {
      if (!err) {
        domjs = result["widget"];
      }
    });
    if (domjs) {
      this.domjs = domjs;
    }
  }
  
  return this.json;
  
};

Config.prototype.save = function(dest) {
  fs.writeFileSync(dest, this.toXML());
};

module.exports = new Config();