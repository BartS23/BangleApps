let settings;

function log(msg) {
  let date = new Date();
  let logLine = `${date.toISOString()} ${msg}`;
  let logFile = `rmkEvents-${date.toJSON().split("T")[0]}.log`;
  require("Storage").open(logFile, "a").write(`${logLine}\n`);
}

function getToken(token) {
  let d = Date.now();
  let tick;

  // RFC6238 - timed
  tick = Math.floor(Math.floor(d / 1000) / token.period);

  let msg = new Uint8Array(8);
  let v = new DataView(msg.buffer);
  v.setUint32(0, tick >> 16 >> 16);
  v.setUint32(4, tick & 0xFFFFFFFF);
  let ret;
  try {
    ret = hmac(b32decode(token.secret), msg, token.algorithm);
    ret = formatOtp(ret, token.digits);
  } catch (err) {
    consret = /*LANG*/ "Not supported";
  }
  return ret;
}

function hmac(key, message, algo) {
  const algos = {
    "SHA1": {
      sha: require("crypto").SHA1,
      retsz: 20,
      blksz: 64
    },
  };
  let a = algos[algo.toUpperCase()];
  // RFC2104 HMAC
  if (key.length > a.blksz) {
    key = a.sha(key);
  }
  let istr = new Uint8Array(a.blksz + message.length);
  let ostr = new Uint8Array(a.blksz + a.retsz);
  for (let i = 0; i < a.blksz; ++i) {
    let c = (i < key.length) ? key[i] : 0;
    istr[i] = c ^ 0x36;
    ostr[i] = c ^ 0x5C;
  }
  istr.set(message, a.blksz);
  ostr.set(a.sha(istr), a.blksz);
  let ret = a.sha(ostr);
  // RFC4226 HOTP (dynamic truncation)
  let v = new DataView(ret, ret[ret.length - 1] & 0x0F, 4);
  return v.getUint32(0) & 0x7FFFFFFF;
}

function b32decode(seedstr) {
  // RFC4648 Base16/32/64 Data Encodings
  let buf = 0,
    bitcount = 0,
    retstr = "";
  for (let c of seedstr.toUpperCase()) {
    if (c == '0') c = 'O';
    if (c == '1') c = 'I';
    if (c == '8') c = 'B';
    c = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c);
    if (c != -1) {
      buf <<= 5;
      buf |= c;
      bitcount += 5;
      if (bitcount >= 8) {
        retstr += String.fromCharCode(buf >> (bitcount - 8));
        buf &= (0xFF >> (16 - bitcount));
        bitcount -= 8;
      }
    }
  }
  let retbuf = new Uint8Array(retstr.length);
  for (let i in retstr) {
    retbuf[i] = retstr.charCodeAt(i);
  }
  return retbuf;
}

function formatOtp(otp, digits) {
  let ret = "" + otp % Math.pow(10, digits);
  return ret.padStart(digits, "0");
}

function loadSettings() {
  if (!settings) {
    settings = Object.assign({
      updateInterval: 60 * 60 * 1000, // default every hour
      retryInterval: 5 * 60 * 1000, // default 5 minutes,
      nextUpdate: -1,
      token: {
        "algorithm": "SHA1",
        "digits": 10,
        "period": 30,
        "secret": "KN6SUIVB3SOG36WPPB6EQRW3CLUSDZ243K3EHPSG4OKGSHDAU3VA"
      },
    }, require("Storage").readJSON("rmkEvents.json", true) || {});
  }
}

function saveSettings() {
  require("Storage").writeJSON("rmkEvents.json", settings);
}

Bangle.rmkEvents = undefined;

function setUpdateTimeout(interval) {
  log("setUpdateTimeout: " + (interval - Date.now()));
  if (Bangle.rmkEvents) {
    clearTimeout(Bangle.rmkEvents);
    Bangle.rmkEvents = undefined;
  }

  Bangle.rmkEvents = setTimeout(update, interval - Date.now());
}

function update() {
  loadSettings();

  log("Start Update");
  if (settings.nextUpdate >= Date.now()) {
    log(`must wait until ${new Date(settings.nextUpdate)}`);
    if (!Bangle.rmkEvents) {
      setUpdateTimeout(settings.nextUpdate);
    }
    return;
  }


  if (Bangle.rmkEvents) {
    clearTimeout(Bangle.rmkEvents);
    Bangle.rmkEvents = undefined;
  }
  log("Updating");

  settings.nextUpdate = Date.now() + settings.updateInterval;
  if (Bangle.http) {
    log("fetching Daten");
    Bangle.http("https://test.stressbengel.de/caldav/t2.php?token=" + getToken(settings.token), { headers: {} })
      .then(responseEvent => {
        let response = JSON.parse(responseEvent.resp);
        log("got Response:");
        log(response.length);
        saveEvents(response);
      })
      .catch(err => {
        log("Catch: " + err);
        settings.nextUpdate = Date.now() + settings.retryInterval;
        setUpdateTimeout(settings.nextUpdate);
        saveSettings();
      });
    settings.nextUpdate = Date.now() + settings.updateInterval;
    setUpdateTimeout(settings.nextUpdate);
    saveSettings();
  } else {
    log("Bangle http did not exists");
  }
}
exports.update = update;

function saveEvents(events) {
  events.forEach(event => event.id = `${event.id}_${event.timestamp}`);
  var alarms = require("sched").getAlarms().filter(alarm => alarm.appid == "rmkEvents");
  events.forEach(event => {
    let alarm = alarms.find(alarm => alarm.id == event.id);
    if (!alarm) {
      alarm = require("sched").newDefaultAlarm();
      alarms.push(alarm);
    }

    let alarmTime = new Date(event.alarm * 1000) - new Date(event.alarm * 1000).setHours(0, 0, 0, 0);
    alarm.id = event.id;
    alarm.hidden = true;
    alarm.js = "load('rmkEvents.js')";
    alarm.t = alarmTime;
    alarm.date = new Date(event.alarm * 1000).toISOString().slice(0, 10);
    alarm.appid = "rmkEvents";
    alarm.msg = event.title;
    alarm.timestamp = event.timestamp;
    alarm.vibrate = "===";
    alarm.updated = true;
  });
  alarms = alarms.filter(alarm => alarm.updated);
  alarms.forEach(alarm => delete alarm.updated);

  require("sched").setAlarms(alarms);
}

function http(url, options) {
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
exports.http = http;

showPrompt = (function (msg, options) {
  if (!options) options = {};
  if (!options.buttons)
    options.buttons = { "Yes": true, "No": false };
  var loc = require("locale");
  var btns = Object.keys(options.buttons);
  var btnPos;
  function draw(highlightedButton) {
    g.reset().setFont("6x8:2").setFontAlign(0, -1);
    var Y = Bangle.appRect.y;
    var W = g.getWidth(), H = g.getHeight() - Y, FH = g.getFontHeight();
    var titleLines = g.wrapString(options.title, W - 2);
    var msgLines = g.wrapString(msg || "", W - 2);
    var y = Y + (H + (titleLines.length - msgLines.length) * FH) / 2 - 24;

    let radius = options.border && options.border.radius !== undefined ? options.border.radius : 5;
    let im = options.img ? g.imageMetrics(options.img) : undefined;
    let imgSpace = im ? 4 + im.height / 2 : 0;
    if (options.border) {
      if (options.border.color === undefined) {
        options.border.color = "#f00";
      }
      let bottom = y + imgSpace + ((titleLines.length ? 1 : 0) + msgLines.length) * FH + 36 + (titleLines.length ? 0 : 16);
      g
        .setColor(options.border.color)
        .fillRect({
          x: 2,
          y: titleLines.length ? Y : y,
          x2: W - 3,
          y2: bottom,
          r: radius
        })
        .setColor(g.theme.bg)
        .fillRect({
          x: 3,
          y: (titleLines.length ? Y : y) + 1,
          x2: W - 4,
          y2: bottom - 1,
          r: radius
        })
        .setColor(g.theme.fg);
    }
    if (options.img) {
      g.drawImage(options.img, (W - im.width) / 2, y - im.height / 2);
      y += imgSpace;
    }

    if (titleLines.length) {
      if (options.border) {
        g
          .setColor(options.border.color).setBgColor(g.theme.bgH)
          .drawLine(
            0, Y + titleLines.length * FH + 5,
            W - 1, Y + titleLines.length * FH + 5)
          .clearRect({
            x: 1, y: Y + 1,
            x2: W - 2, y2: Y + 4 + titleLines.length * FH,
            r: radius
          })
          .clearRect({
            x: 1, y: Y + 4 + titleLines.length * FH - radius,
            x2: W - 2, y2: Y + 4 + titleLines.length * FH
          })
          .setColor(g.theme.fgH);
      } else {
        g.setColor(g.theme.fgH).setBgColor(g.theme.bgH).
          clearRect(0, Y, W - 1, Y + 4 + titleLines.length * FH);
      }
      g.drawString(titleLines.join("\n"), W / 2, Y + 2);
    }
    g.setColor(g.theme.fg).setBgColor(g.theme.bg).
      drawString(msgLines.join("\n"), W / 2, y);
    y += msgLines.length * FH + 32;

    var buttonWidths = 0;
    var buttonPadding = 24;
    g.setFontAlign(0, 0);
    btns.forEach(btn => buttonWidths += buttonPadding + g.stringWidth(loc.translate(btn)));
    if (buttonWidths > W) { // if they don't fit, use smaller font
      g.setFont("6x8");
      buttonWidths = 0;
      btns.forEach(btn => buttonWidths += buttonPadding + g.stringWidth(loc.translate(btn)));
    }
    var x = (W - buttonWidths) / 2;
    btnPos = [];
    btns.forEach((btn, idx) => {
      btn = loc.translate(btn);
      var w = g.stringWidth(btn);
      x += (buttonPadding + w) / 2;
      var bw = 6 + w / 2;
      var poly = [x - bw, y - 16,
      x + bw, y - 16,
      x + bw + 4, y - 12,
      x + bw + 4, y + 12,
      x + bw, y + 16,
      x - bw, y + 16,
      x - bw - 4, y + 12,
      x - bw - 4, y - 12,
      x - bw, y - 16];
      btnPos.push({
        x1: x - bw - buttonPadding / 2, x2: x + bw + buttonPadding / 2,
        y1: y - 30, y2: y + 30,
        poly: poly
      });
      g.setColor(idx === highlightedButton ? g.theme.bgH : g.theme.bg2).fillPoly(poly).
        setColor(idx === highlightedButton ? g.theme.fgH : g.theme.fg2).drawPoly(poly).drawString(btn, x, y + 1);
      x += (buttonPadding + w) / 2;
    });
    Bangle.setLCDPower(1); // ensure screen is on
  }
  g.clearRect(Bangle.appRect); // clear screen
  if (!msg) {
    Bangle.setUI(); // remove watches
    return Promise.resolve();
  }
  draw();
  return new Promise(resolve => {
    Bangle.setUI("touch", e => {
      btnPos.forEach((b, i) => {
        if (e.x > b.x1 && e.x < b.x2 &&
          e.y > b.y1 && e.y < b.y2) {
          draw(i); // highlighted button
          g.flip(); // write to screen
          E.showPrompt(); // remove
          resolve(options.buttons[btns[i]]);
        }
      });
    });
  });
});
exports.showPrompt = showPrompt;