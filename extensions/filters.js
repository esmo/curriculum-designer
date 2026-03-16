function protectSegments(input, patterns) {
  const protectedSegments = [];
  let output = input;

  patterns.forEach((pattern) => {
    output = output.replace(pattern, (match) => {
      const token = `__PATHLINK_PLACEHOLDER_${protectedSegments.length}__`;
      protectedSegments.push(match);
      return token;
    });
  });

  return {
    output,
    protectedSegments,
  };
}

function restoreSegments(input, protectedSegments) {
  return input.replace(/__PATHLINK_PLACEHOLDER_(\d+)__/g, (_, index) => {
    return protectedSegments[Number(index)] || "";
  });
}

function linkifyRootRelativePaths(value) {
  const source = String(value || "");
  const { output, protectedSegments } = protectSegments(source, [
    /```[\s\S]*?```/g,
    /`[^`\n]+`/g,
    /!\[[^\]]*]\([^)]+\)/g,
    /\[[^\]]+]\([^)]+\)/g,
    /<a\b[^>]*>[\s\S]*?<\/a>/gi,
  ]);

  const pathPattern =
    /(^|[\s(>])((?:\/(?!\/)[A-Za-z0-9._~%!$&'()*+,;=:@-]+)+(?:\/)?(?:[?#][^\s)<]*)?)(?=$|[\s),.;:!?<])/g;

  const linkified = output.replace(pathPattern, (match, prefix, pathValue) => {
    return `${prefix}[${pathValue}](${pathValue})`;
  });

  return restoreSegments(linkified, protectedSegments);
}

function addFilters(eleventyConfig, markdownLib) {

  eleventyConfig.addFilter(
    "filterAttribute",
    (collection, attributeName, attributeValue) => {
      return collection.filter((item) => {
        // Access the attribute by name and compare it to the desired value
        console.log(attributeValue);
        return item.data[attributeName] == attributeValue;
      });
    }
  );

  eleventyConfig.addFilter("attributeValues", function (collection, attribute) {
    let values = new Set();

    // Iterate over all items in the collection
    collection.forEach((item) => {
      if (item.data[attribute]) {
        values.add(item.data[attribute]);
      }
    });

    // Convert the set to an array and return it
    return [...values];
  });

  eleventyConfig.addFilter("markdown", function (value) {
    if (!markdownLib) {
      return String(value || "");
    }

    return markdownLib.render(String(value || ""));
  });

  eleventyConfig.addFilter("markdownPathLinks", function (value) {
    if (!markdownLib) {
      return String(value || "");
    }

    return markdownLib.render(linkifyRootRelativePaths(value));
  });

};

module.exports = {
  addFilters
}
