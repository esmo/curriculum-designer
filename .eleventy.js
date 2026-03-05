const markdownIt = require("markdown-it");
const fs = require("node:fs");
const path = require("node:path");
const youtubePlugin = require("./markdown-plugins/youtube.js");
const { addFilters } = require("./extensions/filters.js");
// const { addShortcodes } = require("./extensions/shortcodes.js");

module.exports = function (eleventyConfig) {
  const inputDir = process.env.ELEVENTY_INPUT_DIR || "theme";
  const outputDir = process.env.ELEVENTY_OUTPUT_DIR || "build/";

  // Your other Eleventy configuration...
  let cfg = {
    markdownTemplateEngine: "njk",
    dir: {
      input: inputDir, // Adjusted to your input directory
      includes: "_includes", // Default includes directory
      output: outputDir, // Adjusted to your output directory
    },
  };

  const markdownLib = markdownIt({
    html: true,
    breaks: false,
    linkify: true,
  }).use(youtubePlugin);

  eleventyConfig.setLibrary("md", markdownLib);

  const assetsSource = path.resolve(cfg.dir.input, "assets");
  if (fs.existsSync(assetsSource)) {
    eleventyConfig.addPassthroughCopy({ [assetsSource]: "assets" });
  }

  addFilters(eleventyConfig);
  // addShortcodes(eleventyConfig);

  return cfg;
};
