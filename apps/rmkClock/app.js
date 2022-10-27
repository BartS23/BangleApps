const ClockFace = require("ClockFace");
let clock = new ClockFace({
  init: function () {
    require("Font7x11Numeric7Seg").add(Graphics);
    this.layoutRedraw = (layout, element, newValue) => {
      if (layout[element].label !== newValue) {
        layout.clear(layout[element]);
        layout[element].label = newValue;
        layout.render(layout[element]);
      }
    };
    this.locale = require("locale");

    const Layout = require("Layout");
    this.layout = new Layout({
      type: "v",
      c: [{
        type: "txt",
        font: "7x11Numeric7Seg:4",
        label: "     ",
        id: "time"
      }, 
      { height: 2 }, 
      {
        type: "txt",
        font: "15%",
        label: "",
        id: "date",
        fillx: 1
      }, 
      { height: 5 }, 
      {
        type: "h",
        halign: -1,
        c: [{
          type: "txt",
          font: "10%",
          col: "#0f0",
          label: "Steps: ",
          id: "stepsText"
        }, 
        { width: 5 }, 
        {
          type: "txt",
          font: "10%",
          halign: -1,
          col: "#0f0",
          id: "steps",
          label: "0",
          fillx: 1
        }]
      }],
      lazy: true
    });
  },
  update: function (time, changed) {
    if (changed.d) {
      var dow = this.locale.dow(time, 1);
      var day = time.getDate().toString();
      var month = (time.getMonth() + 1).toString();
      var year = time.getFullYear().toString().slice(-2);
      var dateStr = `${dow} ${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
      this.layoutRedraw(this.layout, "date", dateStr);
    }
    if (changed.h || changed.m) {
      var h = time.getHours().toString();
      var m = time.getMinutes().toString();
      var timeText = h.padStart(2, "0") + ":" + m.padStart(2, "0");
      this.layoutRedraw(this.layout, "time", timeText);
      this.layout.render(this.layout.stepsText);
      this.layoutRedraw(this.layout, "steps", this.locale.number(Bangle.getHealthStatus("day").steps, 0));
    }
  },
});

clock.start();