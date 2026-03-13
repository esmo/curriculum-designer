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

};

module.exports = {
  addFilters
}
