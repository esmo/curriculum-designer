// youtubePreview.js
module.exports = function youtube(md) {
  // Regular expression to match YouTube URLs
  const youtubeRegex = /https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/g;

  // Replace the YouTube links with an embed
  function replaceLink(match, videoId) {
    return `<a href="${match}" target="_blank">
              <img src="https://img.youtube.com/vi/${videoId}/0.jpg" alt="YouTube Video Preview">
            </a>`;
  }

  // Tokenize function to find text tokens and replace YouTube URLs
  function tokenize(state) {
    const tokens = state.tokens;
    for (let j = 0; j < tokens.length; j++) {
      const token = tokens[j];
      if (token.type === 'inline') {
        const children = token.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.type === 'text' && youtubeRegex.test(child.content)) {
            const newContent = child.content.replace(youtubeRegex, replaceLink);
            children[i].type = 'html_inline';
            children[i].content = newContent;
          }
        }
      }
    }
  }

  // Apply tokenize function to both inline and block-level rules
  md.core.ruler.push('youtube_preview', tokenize);
};
