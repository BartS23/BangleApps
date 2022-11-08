
(function () {
  E.showPrompt = require("rmkShowPrompt").showPrompt;

  let _GB = global.GB;

  global.GB = (event) => {
    if (_GB) {
      setTimeout(_GB, 0, Object.assign({}, event));
    }

    if (event.t == "http") {
      //get the promise and call the promise resolve
      if (Bangle.httpRequest === undefined) {
        return;
      }
      var request = Bangle.httpRequest[event.id];

      if (request === undefined) {
        return; //already timedout or wrong id
      }

      delete Bangle.httpRequest[event.id];
      clearTimeout(request.t); //t = timeout variable
      if (event.err !== undefined) { //if is error
        request.j(event.err); //j = reJect function
      } else {
        request.r(event); //r = resolve function
      }
    }
  };

  if (Bangle.http === undefined) {
    // HTTP request handling - see the readme
    // options = {id,timeout,xpath}
    Bangle.http = require("rmkEvents").http;
  }

  require("rmkEvents").update();
})();