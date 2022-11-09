(function () {
  function gbSend(message) {
    Bluetooth.println("");
    Bluetooth.println(JSON.stringify(message));
  }

  var _GB = global.GB;
  global.GB = (event) => {
    // feed a copy to other handlers if there were any
    if (_GB) setTimeout(_GB, 0, Object.assign({}, event));

    /* TODO: Call handling, fitness */
    var HANDLERS = {
      // {t:"find", n:bool} // find my phone
      "find": function () {
        if (Bangle.findDeviceInterval) {
          clearInterval(Bangle.findDeviceInterval);
          delete Bangle.findDeviceInterval;
        }
        if (event.n) // Ignore quiet mode: we always want to find our watch
          Bangle.findDeviceInterval = setInterval(_ => Bangle.buzz(), 1000);
      },
      // {"t":"call","cmd":"incoming/end","name":"Bob","number":"12421312"})
      "call": function () {
        Object.assign(event, {
          t: event.cmd == "incoming" ? "add" : "remove",
          id: "call", src: "Phone",
          positive: true, negative: true,
          title: event.name || "Call", body: "Incoming call\n" + event.number
        });
        require("messages").pushMessage(event);
      },
      "http": function () {
        //get the promise and call the promise resolve
        if (Bangle.httpRequest === undefined) return;
        var request = Bangle.httpRequest[event.id];
        if (request === undefined) return; //already timedout or wrong id
        delete Bangle.httpRequest[event.id];
        clearTimeout(request.t); //t = timeout variable
        if (event.err !== undefined) //if is error
          request.j(event.err); //r = reJect function
        else
          request.r(event); //r = resolve function
      }
    };
    var h = HANDLERS[event.t];
    if (h) h(); else console.log("GB Unknown", event);
  };
  // HTTP request handling - see the readme
  // options = {id,timeout,xpath}
  Bangle.http = (url, options) => {
    options = options || {};
    if (!NRF.getSecurityStatus().connected)
      return Promise.reject("Not connected to Bluetooth");
    if (Bangle.httpRequest === undefined)
      Bangle.httpRequest = {};
    if (options.id === undefined) {
      // try and create a unique ID
      do {
        options.id = Math.random().toString().substr(2);
      } while (Bangle.httpRequest[options.id] !== undefined);
    }
    //send the request
    var req = { t: "http", url: url, id: options.id };
    if (options.xpath) req.xpath = options.xpath;
    if (options.method) req.method = options.method;
    if (options.body) req.body = options.body;
    if (options.headers) req.headers = options.headers;
    gbSend(req);
    //create the promise
    var promise = new Promise(function (resolve, reject) {
      //save the resolve function in the dictionary and create a timeout (30 seconds default)
      Bangle.httpRequest[options.id] = {
        r: resolve, j: reject, t: setTimeout(() => {
          //if after "timeoutMillisec" it still hasn't answered -> reject
          delete Bangle.httpRequest[options.id];
          reject("Timeout");
        }, options.timeout || 30000)
      };
    });
    return promise;
  };

  // Battery monitor
  function sendBattery() { gbSend({ t: "status", bat: E.getBattery(), chg: Bangle.isCharging() ? 1 : 0 }); }
  NRF.on("connect", () => setTimeout(sendBattery, 2000));
  Bangle.on("charging", sendBattery);
  setInterval(sendBattery, 10 * 60 * 1000);
  // Health tracking
  Bangle.on('health', health => {
    gbSend({ t: "act", stp: health.steps, hrm: health.bpm });
  });
})();
