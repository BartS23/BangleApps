(function () {
  const lib = require("authentiwatch.lib.js");
  const settings = lib.loadSettings();

  let drawProgressTimeout;
  let startTime;
  let overlay;
  let currentToken;
  let oldOnTouch;
  let btn1Watch;

  let drawProgress = (hotp) => {
    const radius = 16;

    if (!overlay) {
      return;
    }

    if (currentToken.period > 0) {
      let step = 2 * Math.PI / currentToken.period;
      let remaining = Math.min(currentToken.period, Math.floor((hotp.next - Date.now()) / 1000));
      overlay
        .setColor(1)
        .fillCircle(overlay.getWidth() / 2, 89, radius)
        .setColor(0)
        .drawCircle(overlay.getWidth() / 2, 89, radius);
      require("graphics_utils").fillArc(
        overlay,
        overlay.getWidth() / 2, // X
        89, // Y
        0, // minR
        radius, // maxR
        -0.5 * Math.PI + (currentToken.period - remaining) * step,
        1.5 * Math.PI,
        0.2026834 // stepAngle
      );

      if (remaining >= 0) {
        drawProgressTimeout = setTimeout(() => {
          drawProgress(hotp);
          drawOverlay();
        }, 1000);
      } else {
        setTimeout(run, 0);
      }
    } else {
      overlay
        .setColor(0)
        .setFont("Vector:16")
        .drawString("Tap for next", overlay.getWidth() / 2, 90);
    }
  };

  let hide = () => {
    if (drawProgressTimeout) {
      clearTimeout(drawProgressTimeout);
      drawProgressTimeout = undefined;
    }
    if (startTime) {
      clearTimeout(startTime);
      startTime = undefined;
    }
    overlay = undefined;
    currentToken = undefined;
    Bangle.setLCDOverlay();
    Bangle.removeListener("touch", onTouch);
    if (btn1Watch) {
      clearWatch(btn1Watch);
    }
    lib.saveSettings(settings);

    // restore old listeners
    Bangle["#ontouch"] = oldOnTouch;
  };

  let onTouch = (button, xy) => {
    // close overlay if not touched in the third box (timer/next)
    let x = (g.getWidth() - overlay.getWidth()) / 2;
    let y = (g.getHeight() - overlay.getHeight()) / 2;
    if (
      xy.x >= x && xy.x <= x + overlay.getWidth() - 1 &&
      xy.y >= y + 70 && xy.y <= y + overlay.getHeight()
    ) {
      // reset auto close timer -->
      if (startTime) {
        clearTimeout(startTime);
      }
      startTime = setTimeout(hide, 30000);
      // reset auto close timer <--

      if (currentToken.period <= 0) {
        // calc next token
        currentToken.period--;
        setTimeout(run, 0);
      }
    } else {
      hide();
    }
  };

  let drawOverlay = () => {
    if (!overlay) {
      return;
    }

    Bangle.setLCDOverlay({
      width: overlay.getWidth(),
      height: overlay.getHeight(),
      bpp: 2,
      palette: new Uint16Array([g.theme.fg, g.theme.bg]),
      buffer: overlay.buffer
    },
      (g.getWidth() - overlay.getWidth()) / 2,
      (g.getHeight() - overlay.getHeight()) / 2);
  };

  let run = (token) => {
    if (token && currentToken) {
      hide();
    }

    if (token) {
      currentToken = token;
    }
    const hotp = lib.hotp(currentToken);

    if (!startTime) {
      // save onTouch event handler
      oldOnTouch = Bangle["#ontouch"];
      Bangle.removeAllListeners("touch");
      btn1Watch = setWatch(hide, BTN1);

      startTime = setTimeout(hide, 30000);
      Bangle.on("touch", onTouch);
    }

    overlay = Graphics.createArrayBuffer(g.getWidth() - 20, 110, 2, {
      msb: true
    });

    // Borders -->
    overlay
      .setColor(0)
      // outer 
      .fillRect(0, 0, overlay.getWidth(), overlay.getHeight())
      .setColor(1)
      // inner
      .fillRect(2, 2, overlay.getWidth() - 3, overlay.getHeight() - 3)
      .setColor(0)
      // line after label
      .fillRect(0, 25, overlay.getWidth(), 26)
      // line after token
      .fillRect(0, 69, overlay.getWidth(), 70);
    // Borders <--

    // token label -->
    overlay
      .setFont("Vector:20")
      .setFontAlign(0, 0)
      .drawString(currentToken.label, overlay.getWidth() / 2, 15);
    // token label <--

    // token -->
    lib.sizeFont(1, hotp.hotp, overlay.getWidth() - 10, overlay);
    overlay.drawString(hotp.hotp, overlay.getWidth() / 2, 25 + 5 + 15 + 5);
    // token <--

    // progress arc / "next" text
    drawProgress(hotp);

    // draw overlay
    drawOverlay();
  };

  const info = {
    name: "AuthWatch",
    img: undefined,
    items: []
  };

  info.items = settings.tokens.map(token => {
    return {
      name: token.label,
      img: undefined,
      get: () => {
        return {
          text: token.label
        };
      },
      show: function () { this.emit("redraw") },
      hide: () => { },
      run: () => setTimeout(run.bind(null, token))
    };
  });

  return info;
});