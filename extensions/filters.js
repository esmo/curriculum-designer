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

function normalizeRootRelativePath(candidate) {
  return String(candidate || "").trim().replace(/[),.;:!?]+$/, "");
}

function normalizeReferenceEntries(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  const text = String(value || "").replace(/\r\n?/g, "\n").trim();
  if (!text) {
    return [];
  }

  return text
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function linkifyRootRelativePaths(value) {
  const source = normalizeReferenceEntries(value).join("\n") || String(value || "");
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
    const normalizedPathValue = normalizeRootRelativePath(pathValue);
    if (!normalizedPathValue) {
      return match;
    }

    const suffix = pathValue.slice(normalizedPathValue.length);
    return `${prefix}[${normalizedPathValue}](${normalizedPathValue})${suffix}`;
  });

  return restoreSegments(linkified, protectedSegments);
}

function extractRootRelativePaths(value) {
  if (Array.isArray(value)) {
    const paths = [];
    const seen = new Set();

    value.forEach((item) => {
      extractRootRelativePaths(item).forEach((pathValue) => {
        if (seen.has(pathValue)) {
          return;
        }
        seen.add(pathValue);
        paths.push(pathValue);
      });
    });

    return paths;
  }

  const source = String(value || "");
  const paths = [];
  const seen = new Set();

  function addPath(candidate) {
    const pathValue = normalizeRootRelativePath(candidate);
    if (!pathValue || !pathValue.startsWith("/") || pathValue.startsWith("//")) {
      return;
    }

    if (seen.has(pathValue)) {
      return;
    }

    seen.add(pathValue);
    paths.push(pathValue);
  }

  source.replace(/\[[^\]]+]\((\/(?!\/)[^)]+)\)/g, (_, pathValue) => {
    addPath(pathValue);
    return _;
  });

  source.replace(/<a\b[^>]*href=["'](\/(?!\/)[^"']+)["'][^>]*>/gi, (_, pathValue) => {
    addPath(pathValue);
    return _;
  });

  const { output } = protectSegments(source, [
    /```[\s\S]*?```/g,
    /`[^`\n]+`/g,
    /!\[[^\]]*]\([^)]+\)/g,
    /\[[^\]]+]\([^)]+\)/g,
    /<a\b[^>]*>[\s\S]*?<\/a>/gi,
  ]);

  const barePathPattern =
    /(^|[\s(>])((?:\/(?!\/)[A-Za-z0-9._~%!$&'()*+,;=:@-]+)+(?:\/)?(?:[?#][^\s)<]*)?)(?=$|[\s),.;:!?<])/g;

  output.replace(barePathPattern, (_, __, pathValue) => {
    addPath(pathValue);
    return _;
  });

  return paths;
}

function addFilters(eleventyConfig, markdownLib) {

  eleventyConfig.addFilter(
    "filterAttribute",
    (collection, attributeName, attributeValue) => {
      return collection.filter((item) => {
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

  eleventyConfig.addFilter(
    "filterByReferencedPath",
    function (collection, fieldName, targetUrl) {
      const normalizedTargetUrl = String(targetUrl || "").trim();

      if (!Array.isArray(collection) || !fieldName || !normalizedTargetUrl) {
        return [];
      }

      return collection.filter((item) => {
        const fieldValue = item?.data?.[fieldName];
        return extractRootRelativePaths(fieldValue).includes(normalizedTargetUrl);
      });
    }
  );

  eleventyConfig.addFilter(
    "resolveResourceReferences",
    function (value, collection) {
      const references = normalizeReferenceEntries(value);

      return references.map((text) => {
        const pathValue = extractRootRelativePaths(text)[0] || "";
        const resource =
          Array.isArray(collection) && pathValue
            ? collection.find(
                (item) => String(item?.url || "").trim() === pathValue
              ) || null
            : null;

        return {
          text,
          path: pathValue,
          resource,
        };
      });
    }
  );

};

module.exports = {
  addFilters
}
