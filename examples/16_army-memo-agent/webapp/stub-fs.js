export default {
  readFile() { throw new Error("no filesystem in the browser - pass the seal as bytes"); },
};
