module.exports = {
  layout: (data) => {
    if (data.layout) {
      return data.layout;
    }

    if (data.type === "Resource") {
      return "resource.njk";
    }

    if (data.type === "Task") {
      return "task.njk";
    }

    return "main.njk";
  },
};
