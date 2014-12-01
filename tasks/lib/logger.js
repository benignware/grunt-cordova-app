// imports
var 
  chalk = require('chalk');
  
// singleton instance
var
  logger = null; 

// implementation
function Logger() {
  
}

Logger.DEFAULT = '\x1b[0m';

Logger.LOG = "black";
Logger.INFO = "cyan";
Logger.OK = "green";
Logger.WARN = "orange";
Logger.ERROR = "red";

Logger.getInstance = function() {
  return logger ? logger : logger = new Logger();
};

Logger.prototype.log = function(message) {
  console.log(chalk[Logger.LOG](message) + Logger.DEFAULT);
};

Logger.prototype.info = function(message) {
  console.log(chalk[Logger.INFO](message) + Logger.DEFAULT);
};

Logger.prototype.ok = function(message) {
  console.log(chalk[Logger.OK](message) + Logger.DEFAULT);
};

Logger.prototype.warn = function(message) {
  console.log(chalk[Logger.WARN](message) + Logger.DEFAULT);
};

Logger.prototype.error = function(message) {
  console.log(chalk[Logger.ERROR](message) + Logger.DEFAULT);
};

module.exports = Logger;