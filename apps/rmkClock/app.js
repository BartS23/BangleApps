const appId = "RMKApp";
const screenHeight = g.getHeight();
const screenWidth = g.getWidth();

const locale = require("locale");
const Layout = require("Layout");

// Load fonts
require("Font7x11Numeric7Seg").add(Graphics);

function layoutRedraw(layout, element, newValue) {
  console.log("layoutRedraw");
  if (layout[element].label !== newValue) {
    layout.clear(layout[element]);
    layout[element].label = newValue;
    layout.render(layout[element]);
  }
}

function draw() {
  console.log("draw");
  g.reset();

  if (screens[currentScreen]) {
    g.setFont("Vector", screenWidth / 7);
    g.setFontAlign(0, 0);
    g.setColor(screens[currentScreen].bgColor);
    g.fillRect(0, 24, screenWidth - 1, screenHeight - 1);
    g.setColor(screens[currentScreen].color);
    g.drawString((screens[currentScreen].name), screenWidth / 2, (3 * (screenHeight - 24) / 4) + 24);
  }
}

const screens = [{
    name: "Clock",
    activated: false,
    draw: function() {
      console.log("clock draw");
      var d = new Date();

      var h = d.getHours().toString();
      var m = d.getMinutes().toString();
      var dow = locale.dow(d, 1);
      var day = d.getDate().toString();
      var month = (d.getMonth() + 1).toString();
      var year = d.getFullYear().toString().substr(-2);

      var time = h.padStart(2, "0") + ":" + m.padStart(2, "0");
      var dateStr = `${dow} ${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;

      layoutRedraw(this.layout, "time", time);
      layoutRedraw(this.layout, "date", dateStr);
      layoutRedraw(this.layout, "steps", locale.number(Bangle.getHealthStatus("day").steps, 0));

      this.clockTimeout = setTimeout(this.draw.bind(this), 60000 - (Date.now() % 60000));
    },
    onActivate: function() {
      console.log("clock onActivate");
      g.reset();
      g.clearRect(0, 24, screenWidth, screenHeight);

      this.draw();
    },
    onDeactivate: function() {
      console.log("clock onDeactivate");
      if (this.clockTimeout) {
        clearTimeout(this.clockTimeout);
      }
      if (this.stepsTimeout) {
        clearTimeout(this.stepsTimeout);
      }

      this.clockTimeout = this.stepsTimeout = undefined;
    },
    layout: new Layout({
      type: "v",
      c: [{
          type: "txt",
          font: "7x11Numeric7Seg:4",
          label: "     ",
          id: "time"
        },
        {
          height: 2
        },
        {
          type: "txt",
          font: "15%",
          label: "",
          id: "date",
          fillx: 1
        },
        {
          height: 5
        },
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
            {
              width: 5
            },
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
    })
  },
  {
    name: "GPS",
    activated: false,
    onActivate: () => {
      console.log("gps onactiv");
      /*            E.showPrompt("GPS " + locale.translate("on") + "?", {
                      title: "GPS " + locale.translate("on") + "?",
                      buttons: { yes: true, no: false }
                  });*/
    }
  },
  {
    name: "Test3",
    bgColor: "#0f0",
    color: "#fff"
  },
  {
    name: "Test4",
    bgColor: "#ff0",
    color: "#fff"
  },
  {
    name: "Test5",
    bgColor: "#00f",
    color: "#fff"
  },
  {
    name: "Test6",
    bgColor: "#f0f",
    color: "#fff"
  },
  {
    name: "Test7",
    bgColor: "#0ff",
    color: "#fff"
  },
  {
    name: "Test8",
    bgColor: "#fff",
    color: "#000"
  },
];

var currentScreen = 0;

function changeScreen(dir) {
  console.log("Swipe");
  if (currentScreen > -1) {
    if (screens[currentScreen].onDeactivate) {
      screens[currentScreen].onDeactivate();
      screens[currentScreen].activated = false;
    }

    currentScreen += dir;
    if (currentScreen < 0) {
      currentScreen = screens.length - 1;
    } else if (currentScreen === screens.length) {
      currentScreen = 0;
    }

    if (screens[currentScreen].onActivate) {
      console.log(`onActivate ${currentScreen}`);
      screens[currentScreen].onActivate();
      screens[currentScreen].activated = true;
    } else {
      draw();
    }

    if (screens[currentScreen].layout) {
      console.log(`Layout render ${currentScreen}`);
      screens[currentScreen].layout.render();
    }
  }
}

Bangle.on('swipe', changeScreen);

Bangle.on(' ', on => {
  console.log("lcdPower");
  if (on && !screens[currentScreen].activated) {
    if (screens[currentScreen].onActivate) {
      screens[currentScreen].onActivate();
    } else {
      draw();
    }
  } else if (!on && screens[currentScreen].activated) {
    if (screens[currentScreen].onDeactivate) {
      screens[currentScreen].onDeactivate();
    }
  }
});
g.clear();

// Show launcher when button pressed
Bangle.setUI("clock");

changeScreen(0);

Bangle.loadWidgets();
Bangle.drawWidgets();
