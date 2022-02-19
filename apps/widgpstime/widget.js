(() => {
  var gpsTimeout;

  function calcTimeDifference(fix) {
    if (!fix.time) {
      return;
    }

    var delta = new Date() - fix.time;
    if (Math.abs(delta) >= 2000) {
      setTimeout(_ => setTime(fix.time / 1000), 1000 - fix.time.getMilliseconds());
    }

    disableGPS(true);
  }

  function planNextRun() {
    var runTime = 4 * 60 * 60 * 1000; // run every 4 hours
    var nextRun = runTime - (Date.now() % runTime);
    setTimeTimeout = setTimeout(enableGPS, nextRun);
  }

  function enableGPS() {
    Bangle.on("GPS", calcTimeDifference);
    Bangle.setGPSPower(1, "widgpstime");
    WIDGETS["widgpstime"].width = 22;
    Bangle.drawWidgets();

    // disable gps after 10 seconds
    gpsTimeout = setTimeout(_ => {
      disableGPS(false);
    }, 10 * 1000);
  }

  function disableGPS(timeFound) {
    if (gpsTimeout) {
      clearTimeout(gpsTimeout);
    }

    Bangle.setGPSPower(0, "widgpstime");
    Bangle.removeListener("GPS", calcTimeDifference);

    WIDGETS["widgpstime"].timeFound = timeFound;
    WIDGETS["widgpstime"].draw();

    setTimeout(() => {
      WIDGETS["widgpstime"].width = 0;
      WIDGETS["widgpstime"].timeFound = false;
      Bangle.drawWidgets();
    }, timeFound ? 5000 : 10);

    planNextRun();
  }

  // add your widget
  WIDGETS["widgpstime"] = {
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
