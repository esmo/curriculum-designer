const youtubeEmbed = (id, description) => {
  return `<div class="youtube-video">
            <iframe width="560" height="315" src="https://www.youtube.com/embed/${id}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            <p>${description}</p>
          </div>`;
};

const extractYouTubeID = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\/v\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

module.exports = function(md) {
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const hrefIndex = tokens[idx].attrIndex('href');
    if (hrefIndex >= 0) {
      const url = tokens[idx].attrs[hrefIndex][1];
      const videoId = extractYouTubeID(url);
      if (videoId) {
        const description = tokens[idx + 1].content;
        tokens[idx].tag = 'div';
        tokens[idx].attrs = [['class', 'youtube-video']];
        tokens[idx + 1].content = youtubeEmbed(videoId, description);
        tokens[idx + 1].type = 'html_block';
        tokens[idx + 2].hidden = true;
      }
    }
    return self.renderToken(tokens, idx, options);
  };
};
