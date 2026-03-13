module.exports = {
  layout: (data) => (data.type === "Resource" ? "resource.njk" : "main.njk"),
};
