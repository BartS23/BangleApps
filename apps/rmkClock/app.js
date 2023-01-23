{
  let clockInfoItems = require("clock_info").load();
  let clockInfoMenu;
  let lockHandler = lock => {
    if (lock && clockInfoMenu && !(clockInfoMenu.menuA == 0 && clockInfoMenu.menuB == 1)) {
      clockInfoMenu.setItem(0, 1);
    }
  };
  let clockInfoDraw = (itm, info, options) => {
    g
      .reset()
      .setBgColor(options.bg)
      .setColor(options.fg)
      .setFont("Vector", 20)
      .setFontAlign(-1, 0)
      .clearRect(options.x, options.y, options.x + options.w - 2, options.y + options.h - 1);

    if (options.focus) {
      g.drawRect(options.x, options.y, options.x + options.w - 2, options.y + options.h - 1);
    }
    let itemText;
    let imgWidth = 0;
    if (itm.name) {
      itemText = `${itm.name}: ${info.text}`;
    } else {
      itemText = info.text;
      imgWidth = info.img == null ? 0 : 25;
    }

    g.drawString(itemText, options.x + imgWidth + 1, options.y + options.h / 2 + 1);
    if (info.img && imgWidth) {
      g.drawImage(
        info.img,
        options.x,
        options.y + options.h / 2 - 12);
    }
  };
  let render = (layout) => {
    if (!clockInfoMenu) {
      clockInfoMenu = require("clock_info").addInteractive(clockInfoItems, {
        x: layout.x + 1,
        y: layout.y,
        w: layout.w - 1,
        h: layout.h,
        draw: clockInfoDraw,
        bg: g.theme.bg,
        fg: g.theme.fg
      });
      clockInfoMenu.setItem(0, 1);
      Bangle.on("lock", lockHandler);
    }
  };

  let ClockFace = require("ClockFace");
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
          type: "custom",
          render: render,
          id: "clockInfo",
          fillx: 1,
          height: 26
        }],
        lazy: true
      });
      this.layout.render(this.layout.clockInfo);
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
      }
    },
    remove: () => {
      clockInfoMenu.remove();
      Bangle.removeListener("lock", lockHandler);
    }
  });

  clock.start();
}