const markdownIt = require("markdown-it");
const path = require("path");
const youtubePlugin = require("./markdown-plugins/youtube.js");
const { addFilters } = require("./extensions/filters.js");
// const { addShortcodes } = require("./extensions/shortcodes.js");

module.exports = function (eleventyConfig) {
  const inputDir = process.env.ELEVENTY_INPUT_DIR || "src";
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

  eleventyConfig.addPassthroughCopy(path.join(cfg.dir.input, "assets"));
  // css
  eleventyConfig.addPassthroughCopy(path.join(cfg.dir.input, "**/*.css"));
  // media
  eleventyConfig.addPassthroughCopy(
    path.join(cfg.dir.input, "**/*.+(png|jpg|jpeg|gif|svg|mp4|webm)")
  );

  addFilters(eleventyConfig);
  // addShortcodes(eleventyConfig);

  return cfg;
};
