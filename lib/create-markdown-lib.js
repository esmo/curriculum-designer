"use strict";

const markdownIt = require("markdown-it");
const youtubePlugin = require("../markdown-plugins/youtube");

function createMarkdownLib() {
  return markdownIt({
    html: true,
    breaks: false,
    linkify: true,
  }).use(youtubePlugin);
}

module.exports = {
  createMarkdownLib,
};
