
// rmkEvents.js

// Chances are boot0.js got run already and scheduled *another*
// 'load(sched.js)' - so let's remove it first!
if (Bangle.SCHED) {
  clearInterval(Bangle.SCHED);
  delete Bangle.SCHED;
}

function showEvent(event) {
  const settings = require("sched").getSettings();

  Bangle.on('lock', on => on && updateEvent(true));

  Bangle.loadWidgets();
  Bangle.drawWidgets();

  let buzzCount = settings.buzzCount;
  let alarmTS = new Date(event.date) + event.t;
  let duration = require("time_utils").formatDuration(event.timestamp * 1000 - alarmTS);
  let time = new Date(event.timestamp * 1000) - new Date().setHours(0, 0, 0, 0);
  time = require("time_utils").decodeTime(time);
  delete time.d;
  let startTime = require("time_utils").formatTime(time);

  E.showPrompt(startTime + "\n" + duration, {
    title: event.msg,
    buttons: {
      "Ok": true
    },
  }).then(function (sleep) {
    buzzCount = 0;
    updateEvent(false);
  });

  function updateEvent(sleep) {
    if (sleep && event.t < event.timestamp) {
      if (event.ot === undefined) {
        event.ot = event.t;
      }
      event.t += settings.defaultSnoozeMillis;
      if (event.t > event.timestamp) {
        event.t = event.timestamp;
      }
    } else {
      event.last = (new Date()).getDate();
      if (event.ot !== undefined) {
        event.t = event.ot;
        delete event.ot;
      }
      event.on = false;
    }

    // event is still a member of 'events', so writing to array writes changes back directly
    require("sched").setAlarms(events);
    load();
  }

  function buzz() {
    if (settings.unlockAtBuzz) {
      Bangle.setLocked(false);
    }

    const pattern = event.vibrate || settings.defaultAlarmPattern;
    require("buzz").pattern(pattern).then(() => {
      if (buzzCount--) {
        setTimeout(buzz, settings.buzzIntervalMillis);
      }
    });
  }

  if ((require("Storage").readJSON("setting.json", 1) || {}).quiet > 1) {
    return;
  }

  buzz();
}

// Check for events
let events = require("sched").getAlarms().filter(alarm => alarm.appid == "rmkEvents");
let activeEvents = require("sched").getActiveAlarms(events);
if (activeEvents.length) {
  // if there's an event, show it
  showEvent(activeEvents[0]);
} else {
  // otherwise just go back to default app
  setTimeout(load, 0);
}