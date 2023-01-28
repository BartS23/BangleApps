
setTimeout(() => require("rmkEvents").update());
Bangle.on('midnight', () => {
  const storage = require("Storage");
  const logFiles = storage.list(/^rmkEvents-.*\.log$/, { sf: true });
  let date = new Date();
  date.setDate(date.getDate() - 2);
  date = (date.toJSON().split("T"))[0];
  logFiles
    .filter(file => /^rmkEvents-([\d-]+)/.exec(file)[1] <= date)
    .forEach(file => storage.open(file, 'r').erase());
});