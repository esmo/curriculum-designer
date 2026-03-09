module.exports = {
  layout: (data) => {
    const inputPath = String(data?.page?.inputPath || "").replace(/\\/g, "/");
    if (inputPath.includes("/admin/")) {
      return false;
    }

    return "main.njk";
  },
};
