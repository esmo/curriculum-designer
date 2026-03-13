---
title: Resources for Learning Blender
---

{% set resources = collections.all | filterAttribute("type", "Resource") | sort(attribute="data.title") %}

## Structured Learning Resources

{% if resources.length %}
{% for trackName in resources | attributeValues("track") | sort() %}
### {{ trackName }}

{% for item in resources | filterAttribute("track", trackName) | sort(attribute="data.title") %}
- [{{ item.data.title }}]({{ item.url }}){% if item.data.format or item.data.level %} ({% if item.data.format %}{{ item.data.format }}{% endif %}{% if item.data.format and item.data.level %}, {% endif %}{% if item.data.level %}{{ item.data.level }}{% endif %}){% endif %}
  {{ item.data.description }}
  {% if item.data.source_url %}[Original Source]({{ item.data.source_url }}){% endif %}
{% endfor %}

{% endfor %}
{% else %}
There are currently no structured learning resources available.
{% endif %}

## Additional External Resources

- [A vast library of professional on demand training for filmmakers](https://moviola.com/) (seems defunct unfortunately)
- [Awesome Blender Addons and Resources curated by CGDive.](https://addons.cgdive.com/)
- [Pixar in a Box](https://www.khanacademy.org/computing/pixar)
- [Useful resources about topology](https://topologyguides.com/)
