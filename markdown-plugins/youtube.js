module.exports = function youtubePlugin(md) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w\-]+)/;

  function youtubeReplace(match, utils) {
    const videoId = match[1];
    return `<iframe width="560" height="315" style="display:block;" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  }

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const url = tokens[idx].attrs[tokens[idx].attrIndex("href")][1];
    const match = url.match(regex);
    if (match) {
      return youtubeReplace(match);
    }
    return self.renderToken(tokens, idx, options);
  };
}
