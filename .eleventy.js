const markdownIt = require("markdown-it");
const youtubePlugin = require("./markdown-plugins/youtube.js");
const { addFilters } = require("./extensions/filters.js");
const { addShortcodes } = require("./extensions/shortcodes.js");

module.exports = function (eleventyConfig) {
  // Your other Eleventy configuration...
  let cfg = {
    markdownTemplateEngine: "njk",
    dir: {
      input: "src", // Adjusted to your input directory
      includes: "_includes", // Default includes directory
      output: "build/", // Adjusted to your output directory
    },
  };

  const markdownLib = markdownIt({
    html: true,
    breaks: false,
    linkify: true,
  }).use(youtubePlugin);

  eleventyConfig.setLibrary("md", markdownLib);

  eleventyConfig.addPassthroughCopy(cfg.dir.input + "/assets");
  // css
  eleventyConfig.addPassthroughCopy(cfg.dir.input + "/**/*.css");
  // media
  eleventyConfig.addPassthroughCopy(
    cfg.dir.input+"/**/*.+(png|jpg|jpeg|gif|svg|mp4|webm)"
  );

  addFilters(eleventyConfig);
  addShortcodes(eleventyConfig);

  return cfg;
};
