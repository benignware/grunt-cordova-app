'use strict';
var
  xpath = require('xpath'),
  dom = require('xmldom').DOMParser, 
  js2xmlparser = require("js2xmlparser"), 
  merge = require("deepmerge");

// builds a js2xmlparser-compatible object from cordova config options
var js2xmljs = function(options) {
  var data = {"@": {}}, i, attr;
  // widget
  var attrs = ['id', 'version', 'android-versionCode', 'ios-CFBundleVersion'];
  attrs.forEach(function(attr) {
    if (typeof options[attr] !== "undefined") {
      data["@"][attr] = options[attr];
    }
  });
  if (typeof options.xmlns === "object") {
    Object.keys(options.xmlns).forEach(function(ns) {
      data["@"][ns !== "default" ? "xmlns:" + ns : "xmlns"] = options.xmlns[ns]; 
    });
  }
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
  // platforms
  if (typeof options.preferences == "object") {
    var platform, platforms = [];
    for (platform in options.platforms) {
      platforms.push(merge({
        "@": {
          name: platform
        }
      }, js2xmljs(options.platforms[platform])));
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

var xmljs2js = function(node) {
  var select = xpath.useNamespaces({
    "wgt": "http://www.w3.org/ns/widgets", 
    "cdv": "http://cordova.apache.org/ns/1.0",
    "gap": "http://phonegap.com/ns/1.0"
  });
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
    var nameNodes = select("./wgt:name", node);
    if (nameNodes.length && nameNodes[0].firstChild) {
      result.name = nameNodes[0].firstChild.nodeValue;
    }
    // description
    var descriptionNodes = select("./wgt:description", node);
    if (descriptionNodes.length && descriptionNodes[0].firstChild) {
      result.description = descriptionNodes[0].firstChild.nodeValue;
    }
    // author
    var authorNodes = select("./wgt:author", node);
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
    var preferenceNodes = select("./wgt:preference", node);
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
    var platformNodes = select("./wgt:platform", node);
    if (platformNodes.length) {
      result.platforms = {};
      platformNodes.forEach(function(platformNode) {
        var name = platformNode.getAttribute('name');
        if (name) {
          result.platforms[name] = xmljs2js(platformNode);
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
          var pluginParamNodes = select("./wgt:param", pluginNode);
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
    var iconNodes = select("./wgt:icon", node);
    if (iconNodes.length) {
      result.icons = iconNodes.map(function(iconNode) {
        return {
          src: iconNode.getAttribute('src'),
          width: iconNode.getAttribute('width'),
          height: iconNode.getAttribute('height') 
        };
      });
    }
    return result;
  }
};

module.exports = {
  stringify: function(js) {
    var xmljs = js2xmljs(js);
    var xml = js2xmlparser( "widget", xmljs );
    return xml;
  }, 
  parse: function(xml) {
    var doc = new dom().parseFromString(xml);
    var js = xmljs2js(doc.documentElement);
    return js;
  }
};