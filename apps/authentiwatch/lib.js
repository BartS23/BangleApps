// Hash functions
const crypto = require("crypto");
const algos = {
  "SHA512": { sha: crypto.SHA512, retsz: 64, blksz: 128 },
  "SHA256": { sha: crypto.SHA256, retsz: 32, blksz: 64 },
  "SHA1": { sha: crypto.SHA1, retsz: 20, blksz: 64 },
};
const NOT_SUPPORTED = /*LANG*/"Not supported";
const SETTINGS = "authentiwatch.json";
exports.TOKEN_DIGITS_HEIGHT = 30;

function b32decode(seedstr) {
  // RFC4648 Base16/32/64 Data Encodings
  let buf = 0, bitcount = 0, retstr = "";
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

function hmac(key, message, algo) {
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

function formatOtp(otp, digits) {
  // add 0 padding
  let ret = "" + otp % Math.pow(10, digits);
  while (ret.length < digits) {
    ret = "0" + ret;
  }
  // add a space after every 3rd or 4th digit
  let re = (digits % 3 == 0 || (digits % 3 >= digits % 4 && digits % 4 != 0)) ? "" : ".";
  return ret.replace(new RegExp("(..." + re + ")", "g"), "$1 ").trim();
}

exports.hotp = function (token) {
  let d = Date.now();
  let tick, next;
  if (token.period > 0) {
    // RFC6238 - timed
    tick = Math.floor(Math.floor(d / 1000) / token.period);
    next = (tick + 1) * token.period * 1000;
  } else {
    // RFC4226 - counter
    tick = -token.period;
    next = d + 30000;
  }
  let msg = new Uint8Array(8);
  let v = new DataView(msg.buffer);
  v.setUint32(0, tick >> 16 >> 16);
  v.setUint32(4, tick & 0xFFFFFFFF);
  let ret;
  try {
    ret = hmac(b32decode(token.secret), msg, token.algorithm);
    ret = formatOtp(ret, token.digits);
  } catch (err) {
    ret = NOT_SUPPORTED;
  }
  return { hotp: ret, next: next };
};

exports.loadSettings = function () {
  // sample settings:
  // {tokens:[{"algorithm":"SHA1","digits":6,"period":30,"issuer":"","account":"","secret":"Bbb","label":"Aaa"}],misc:{}}
  const settings = require("Storage").readJSON(SETTINGS, true) || { tokens: [], misc: {} };
  let tokens;
  if (settings.data) {
    tokens = settings.data; /* v0.02 settings */
  }
  if (settings.tokens) {
    tokens = settings.tokens; /* v0.03+ settings */
  }

  return { tokens: tokens, misc: settings.misc };
};

exports.saveSettings = function (settings) {
  require("Storage").writeJSON(SETTINGS, { tokens: settings.tokens, misc: settings.misc });
};

const fontszCache = {};
exports.sizeFont = function (id, txt, w, graphics) {
  if (!graphics) {
    graphics = g;
  }

  let sz = fontszCache[id];
  if (!sz) {
    sz = exports.TOKEN_DIGITS_HEIGHT;
    do {
      graphics.setFont("Vector", sz--);
    } while (graphics.stringWidth(txt) > w);
    fontszCache[id] = ++sz;
  }
  graphics.setFont("Vector", sz);
}