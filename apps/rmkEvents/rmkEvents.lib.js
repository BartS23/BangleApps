

// rmkEvents.lib.js
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
    Bangle.http("https://test.stressbengel.de/caldav/t2.php?token=" + getToken(settings.token), {headers:{}})
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