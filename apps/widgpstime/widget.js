(() => {
  var gpsTimeout;

  const SETTINGS_FILE = "widgpstime.json";
  const storage = require('Storage');
  let settings = Object.assign({
    syncInterval: 10,
    setDifference: 2,
    waitForTime: 10,
    logTimeSetting: false,
    setOnReset: false,
  }, storage.readJSON(SETTINGS_FILE, 1) || {});

  function calcTimeDifference(fix) {
    if (!fix.time) {
      return;
    }
    var currentDateTime = new Date();
    var delta = fix.time - currentDateTime;

    // if difference > {settings.setDifference} second/s -> set time
    if (Math.abs(delta) / 1000 >= settings.setDifference) {
      if (settings.logTimeSetting) {
        require("Storage").open("widgpstime.log", "a").write(`${currentDateTime.toISOString()} difference ${(delta / 1000).toFixed(3)} second/s setting time from ${currentDateTime.toISOString()} to`);
      }
      setTime((new Date() + delta) / 1000);
      if (settings.logTimeSetting) {
        require("Storage").open("widgpstime.log", "a").write(`${new Date().toISOString()}\n`);
      }
    }
    if (settings.setOnReset) {
      require("Storage").open("widgpstime.txt", "w").write(Date.now());
    }

    disableGPS(true);
  }

  function planNextRun() {
    var runTime = settings.syncInterval * 60 * 60 * 1000; // run every {settings.syncInterval} hours
    var nextRun = runTime - (Date.now() % runTime);
    setTimeTimeout = setTimeout(enableGPS, nextRun);
  }

  function enableGPS() {
    Bangle.on("GPS", calcTimeDifference);
    Bangle.setGPSPower(1, "widgpstime");
    WIDGETS.widgpstime.width = 22;
    Bangle.drawWidgets();

    // disable gps after {settings.waitForTime} seconds
    gpsTimeout = setTimeout(_ => {
      disableGPS(false);
    }, settings.waitForTime * 1000);
  }

  function disableGPS(timeFound) {
    if (gpsTimeout) {
      clearTimeout(gpsTimeout);
    }

    Bangle.setGPSPower(0, "widgpstime");
    Bangle.removeListener("GPS", calcTimeDifference);

    WIDGETS.widgpstime.timeFound = timeFound;
    WIDGETS.widgpstime.draw();

    setTimeout(() => {
      WIDGETS.widgpstime.width = 0;
      WIDGETS.widgpstime.timeFound = false;
      Bangle.drawWidgets();
    }, timeFound ? 5000 : 10);

    planNextRun();
  }

  // add your widget
  WIDGETS.widgpstime = {
    area: "tl", // tl (top left), tr (top right), bl (bottom left), br (bottom right)
    width: 0, // width of the widget
    timeFound: false,
    draw: function () {
      // return if we don't want to draw.
      if (!this.width) {
        return;
      }

      g.reset(); // reset the graphics context to defaults (color/font/etc)
      if (this.timeFound) {
        g.setColor('#00ff00');
      }

      // clock circle
      g.drawCircle(this.x + 11, this.y + 11, 10);

      // clock dot
      g.fillCircle(this.x + 11, this.y + 11, 1);

      // hour hand
      g.drawLine(this.x + 11, this.y + 11, this.x + 16, this.y + 11);

      // minute hand
      g.drawLine(this.x + 11, this.y + 11, this.x + 11, this.y + 3);
    },
  };

  planNextRun();
})();
