const lib = require("authentiwatch.lib.js");
const COUNTER_TRIANGLE_SIZE = 10;
const TOKEN_EXTRA_HEIGHT = 16;
var TOKEN_HEIGHT = lib.TOKEN_DIGITS_HEIGHT + TOKEN_EXTRA_HEIGHT;
const PROGRESSBAR_HEIGHT = 3;
const IDLE_REPEATS = 1; // when idle, the number of extra timed periods to show before hiding
const CALCULATING = /*LANG*/"Calculating";
const NO_TOKENS = /*LANG*/"No tokens";

const settings = lib.loadSettings();
const tokens = settings.tokens;

// Tokens are displayed in three states:
// 1. Unselected (state.id<0)
// 2. Selected, inactive (no code) (state.id>=0,state.hotp.hotp=="")
// 3. Selected, active (code showing) (state.id>=0,state.hotp.hotp!="")
var state = {
  listy:0, // list scroll position
  id:-1, // current token ID
  hotp:{hotp:"",next:0}
};

tokenY = id => id * TOKEN_HEIGHT + AR.y - state.listy;
half = n => Math.floor(n / 2);

function timerCalc() {
  let timerfn = exitApp;
  let timerdly = 10000;
  if (state.id >= 0 && state.hotp.hotp != "") {
    if (tokens[state.id].period > 0) {
      // timed HOTP
      if (state.hotp.next < Date.now()) {
        if (state.cnt > 0) {
          state.cnt--;
          state.hotp = lib.hotp(tokens[state.id]);
        } else {
          state.hotp.hotp = "";
        }
        timerdly = 1;
        timerfn = updateCurrentToken;
      } else {
        timerdly = 1000;
        timerfn = updateProgressBar;
      }
    } else {
      // counter HOTP
      if (state.cnt > 0) {
        state.cnt--;
        timerdly = 30000;
      } else {
        state.hotp.hotp = "";
        timerdly = 1;
      }
      timerfn = updateCurrentToken;
    }
  }
  if (state.drawtimer) {
    clearTimeout(state.drawtimer);
  }
  state.drawtimer = setTimeout(timerfn, timerdly);
}

function updateCurrentToken() {
  drawToken(state.id);
  timerCalc();
}

function updateProgressBar() {
  drawProgressBar();
  timerCalc();
}

function drawProgressBar() {
  let id = state.id;
  if (id >= 0 && tokens[id].period > 0) {
    let rem = Math.min(tokens[id].period, Math.floor((state.hotp.next - Date.now()) / 1000));
    if (rem >= 0) {
      let y1 = tokenY(id);
      let y2 = y1 + TOKEN_HEIGHT - 1;
      if (y2 >= AR.y && y1 <= AR.y2) {
        // token visible
        y1 = y2 - PROGRESSBAR_HEIGHT;
        if (y1 <= AR.y2)
        {
          // progress bar visible
          y2 = Math.min(y2, AR.y2);
          let xr = Math.floor(AR.w * rem / tokens[id].period) + AR.x;
          g.setColor(g.theme.fgH)
           .setBgColor(g.theme.bgH)
           .fillRect(AR.x, y1, xr, y2)
           .clearRect(xr + 1, y1, AR.x2, y2);
        }
      } else {
        // token not visible
        state.id = -1;
      }
    }
  }
}

// id = token ID number (0...)
function drawToken(id) {
  let x1 = AR.x;
  let y1 = tokenY(id);
  let x2 = AR.x2;
  let y2 = y1 + TOKEN_HEIGHT - 1;
  let lbl = (id >= 0 && id < tokens.length) ? tokens[id].label.substr(0, 10) : "";
  let adj;
  g.setClipRect(x1, Math.max(y1, AR.y), x2, Math.min(y2, AR.y2));
  if (id === state.id) {
    g.setColor(g.theme.fgH)
     .setBgColor(g.theme.bgH);
  } else {
    g.setColor(g.theme.fg)
     .setBgColor(g.theme.bg);
  }
  if (id == state.id && state.hotp.hotp != "") {
    // small label centered just below top line
    g.setFont("Vector", TOKEN_EXTRA_HEIGHT)
     .setFontAlign(0, -1, 0);
    adj = y1;
  } else {
    // large label centered in box
    lib.sizeFont("l" + id, lbl, AR.w);
    g.setFontAlign(0, 0, 0);
    adj = half(y1 + y2);
  }
  g.clearRect(x1, y1, x2, y2)
   .drawString(lbl, half(x1 + x2), adj, false);
  if (id == state.id && state.hotp.hotp != "") {
    adj = 0;
    if (tokens[id].period <= 0) {
      // counter - draw triangle as swipe hint
      let yc = half(y1 + y2);
      adj = COUNTER_TRIANGLE_SIZE;
      g.fillPoly([AR.x, yc, AR.x + adj, yc - adj, AR.x + adj, yc + adj]);
      adj += 2;
    }
    // digits just below label
    x1 = half(x1 + adj + x2);
    y1 += TOKEN_EXTRA_HEIGHT;
    if (state.hotp.hotp == CALCULATING) {
      lib.sizeFont("c", CALCULATING, AR.w - adj);
      g.drawString(CALCULATING, x1, y1, false)
       .flip();
      state.hotp = lib.hotp(tokens[id]);
      g.clearRect(AR.x + adj, y1, AR.x2, y2);
    }
    lib.sizeFont("d" + id, state.hotp.hotp, AR.w - adj);
    g.drawString(state.hotp.hotp, x1, y1, false);
    if (tokens[id].period > 0) {
      drawProgressBar();
    }
  }
  g.setClipRect(0, 0, g.getWidth() - 1, g.getHeight() - 1);
}

function changeId(id) {
  if (id != state.id) {
    state.hotp.hotp = CALCULATING;
    let pid = state.id;
    state.id = id;
    if (pid >= 0) {
      drawToken(pid);
    }
    if (id >= 0) {
      drawToken( id);
    }
  }
}

function onDrag(e) {
  state.cnt = IDLE_REPEATS;
  if (e.b != 0 && e.dy != 0) {
    let y = E.clip(state.listy - E.clip(e.dy, -AR.h, AR.h), 0, Math.max(0, tokens.length * TOKEN_HEIGHT - AR.h));
    if (state.listy != y) {
      let id, dy = state.listy - y;
      state.listy = y;
      g.setClipRect(AR.x, AR.y, AR.x2, AR.y2)
       .scroll(0, dy);
      if (dy > 0) {
        id = Math.floor((state.listy + dy) / TOKEN_HEIGHT);
        y = tokenY(id + 1);
        do {
          drawToken(id);
          id--;
          y -= TOKEN_HEIGHT;
        } while (y > AR.y);
      }
      if (dy < 0) {
        id = Math.floor((state.listy + dy + AR.h) / TOKEN_HEIGHT);
        y = tokenY(id);
        while (y < AR.y2) {
          drawToken(id);
          id++;
          y += TOKEN_HEIGHT;
        }
      }
    }
  }
  if (e.b == 0) {
    timerCalc();
  }
}

function onTouch(zone, e) {
  state.cnt = IDLE_REPEATS;
  if (e) {
    let id = Math.floor((state.listy + e.y - AR.y) / TOKEN_HEIGHT);
    if (id == state.id || tokens.length == 0 || id >= tokens.length) {
      id = -1;
    }
    if (state.id != id) {
      if (id >= 0) {
        // scroll token into view if necessary
        let dy = 0;
        let y = id * TOKEN_HEIGHT - state.listy;
        if (y < 0) {
          dy -= y;
          y = 0;
        }
        y += TOKEN_HEIGHT;
        if (y > AR.h) {
          dy -= (y - AR.h);
        }
        onDrag({b:1, dy:dy});
      }
      changeId(id);
    }
  }
  timerCalc();
}

function onSwipe(e) {
  state.cnt = IDLE_REPEATS;
  switch (e) {
  case  1:
    exitApp();
    break;
  case -1:
    if (state.id >= 0 && tokens[state.id].period <= 0) {
      tokens[state.id].period--;
      lib.saveSettings(settings);
      state.hotp.hotp = CALCULATING;
      drawToken(state.id);
    }
    break;
  }
  timerCalc();
}

function bangleBtn(e) {
  state.cnt = IDLE_REPEATS;
  if (tokens.length > 0) {
    let id = E.clip(state.id + e, 0, tokens.length - 1);
    onDrag({b:1, dy:state.listy - E.clip(id * TOKEN_HEIGHT - half(AR.h - TOKEN_HEIGHT), 0, Math.max(0, tokens.length * TOKEN_HEIGHT - AR.h))});
    changeId(id);
    drawProgressBar();
  }
  timerCalc();
}

function exitApp() {
  if (state.drawtimer) {
    clearTimeout(state.drawtimer);
  }
  Bangle.showLauncher();
}

Bangle.on('touch', onTouch);
Bangle.on('drag' , onDrag );
Bangle.on('swipe', onSwipe);
if (typeof BTN1 == 'number') {
  if (typeof BTN2 == 'number' && typeof BTN3 == 'number') {
    setWatch(()=>bangleBtn(-1), BTN1, {edge:"rising" , debounce:50, repeat:true});
    setWatch(()=>exitApp()    , BTN2, {edge:"falling", debounce:50});
    setWatch(()=>bangleBtn( 1), BTN3, {edge:"rising" , debounce:50, repeat:true});
  } else {
    setWatch(()=>exitApp()    , BTN1, {edge:"falling", debounce:50});
  }
}
Bangle.loadWidgets();
const AR = Bangle.appRect;
// draw the initial display
g.clear();
if (tokens.length > 0) {
  state.listy = AR.h;
  onDrag({b:1, dy:AR.h});
} else {
  g.setFont("Vector", lib.TOKEN_DIGITS_HEIGHT)
   .setFontAlign(0, 0, 0)
   .drawString(NO_TOKENS, AR.x + half(AR.w), AR.y + half(AR.h), false);
}
timerCalc();
Bangle.drawWidgets();
