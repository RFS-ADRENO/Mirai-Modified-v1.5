var cp = require('child_process');
  
App = () => {
var child = cp.fork(__dirname + '/index.js');

child.on("close", () => {
    setTimeout(() => App(), 250)
});
};

App();