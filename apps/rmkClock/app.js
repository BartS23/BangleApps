const locale = require("locale");
const Layout = require("Layout");

// Load fonts
require("Font7x11Numeric7Seg").add(Graphics);

function layoutRedraw(layout, element, newValue) {
  if (layout[element].label !== newValue) {
    layout.clear(layout[element]);
    layout[element].label = newValue;
    layout.render(layout[element]);
  }
}

const queueMillis = 60000;
const layout = new Layout({
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
    }
    ]
  }
  ],
  lazy: true
});

var drawTimeout;
function queueDraw() {
  if (drawTimeout) clearTimeout(drawTimeout);
  drawTimeout = setTimeout(function () {
    drawTimeout = undefined;
    draw();
  }, queueMillis - (Date.now() % queueMillis));
}

function draw() {
  var d = new Date();

  var h = d.getHours().toString();
  var m = d.getMinutes().toString();
  var dow = locale.dow(d, 1);
  var day = d.getDate().toString();
  var month = (d.getMonth() + 1).toString();
  var year = d.getFullYear().toString().slice(-2);

  var time = h.padStart(2, "0") + ":" + m.padStart(2, "0");
  var dateStr = `${dow} ${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;

  layoutRedraw(layout, "time", time);
  layoutRedraw(layout, "date", dateStr);
  layoutRedraw(layout, "steps", locale.number(Bangle.getHealthStatus("day").steps, 0));

  layout.render();

  queueDraw();
}

// Clear the screen once, at startup
g.clear();

draw();

// Show launcher when button pressed
Bangle.setUI("clock");

Bangle.loadWidgets();
Bangle.drawWidgets();
