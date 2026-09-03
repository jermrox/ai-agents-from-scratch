export default {
  dirname: (p) => String(p).replace(/\/[^/]*$/, ""),
  join: (...parts) => parts.join("/"),
};
