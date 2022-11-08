
// rmkEvents.boot.js
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
    Bangle.http = (url, options) => {
      options = options || {};
      if (Bangle.httpRequest === undefined) {
        Bangle.httpRequest = {};
      }
      if (options.id === undefined) {
        // try and create a unique ID
        do {
          options.id = Math.random().toString().slice(2);
        } while (Bangle.httpRequest[options.id] !== undefined);
      }

      //create the promise
      let promise = new Promise(function (resolve, reject) {
        //send the request
        let req = {
          t: "http",
          url: url,
          id: options.id
        };
        if (options.xpath) req.xpath = options.xpath;
        if (options.method) req.method = options.method;
        if (options.body) req.body = options.body;
        if (options.headers) req.headers = options.headers;
        if (Bluetooth.println) {
          if (NRF.getSecurityStatus().connected) {
            Bluetooth.println("");
            Bluetooth.println(JSON.stringify(req));
          } else {
            reject("not connected");
          }
        } else {
          console.log(req);
        }

        //save the resolve function in the dictionary and create a timeout (30 seconds default)
        Bangle.httpRequest[options.id] = {
          r: resolve,
          j: reject,
          t: setTimeout(() => {
            //if after "timeoutMillisec" it still hasn't answered -> reject
            delete Bangle.httpRequest[options.id];
            reject("Timeout");
          }, options.timeout || 30000)
        };
      });

      return promise;
    };
  }

  require("rmkEvents.lib.js").update();
})();