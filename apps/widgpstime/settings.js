(function (back) {
  const locale = require("locale");
  const SETTINGS_FILE = "widgpstime.json";
  const storage = require('Storage');
  let settings = Object.assign({
    syncInterval: 10,
    setDifference: 2,
    waitForTime: 10,
    logTimeSetting: false,
    setOnReset: false,
  }, storage.readJSON(SETTINGS_FILE, 1) || {});

  function saveAndBack() {
    storage.write(SETTINGS_FILE, settings);

    // if settings didnt require it, erase logfile 
    if (!settings.logTimeSetting) {
      require("Storage").open("widgpstime.log", "r").erase()
    }
    back();
  }

  const menu = {
    '': { 'title': 'GPS Time Widget' },
    '< Back': saveAndBack,
      /*LANG*/'Set diff.': {
      value: settings.setDifference,
      min: 0,
      max: 10,
      step: 0.1,
      format: value => locale.number(value, 1) + "s",
      onchange: value => settings.setDifference = value
    },
      /*LANG*/'Sync interval': {
      value: settings.syncInterval,
      min: 1,
      max: 24,
      step: 1,
      format: x => x + "h",
      onchange: value => settings.syncInterval = value
    },
      /*LANG*/'Wait for time': {
      value: settings.waitForTime,
      min: 10,
      step: 1,
      format: x => x + "s",
      onchange: value => settings.waitForTime = value
    },
      /*LANG*/'Log on set': {
      value: settings.logTimeSetting,
      format: v => v ? locale.translate("Yes") : locale.translate("No"),
      onchange: value => settings.logTimeSetting = value
    },
      /*LANG*/'Set on reset': {
      value: settings.setOnReset,
      format: v => v ? locale.translate("Yes") : locale.translate("No"),
      onchange: value => settings.setOnReset = value
    },
  };

  E.showMenu(menu);
})