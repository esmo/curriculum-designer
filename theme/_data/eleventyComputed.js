module.exports = {
  layout: (data) => {
    if (data.layout) {
      return data.layout;
    }

    return data.type === "Resource" ? "resource.njk" : "main.njk";
  },
};
