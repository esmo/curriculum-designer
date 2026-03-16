---
layout: main.njk
title: Tasks
---

{% for trackName in collections.all | filterAttribute("type", "Task") | attributeValues("track") | sort() %}

# {{trackName}}

{% for item in collections.all | filterAttribute("type", "Task") | filterAttribute("track", trackName) | sort(attribute="data.level") | sort(attribute="data.title") %}
[{{item.data.title}}]({{item.url}}){% if item.data.level %} ({{item.data.level}}){% endif %}:
{{item.data.description}}  
{% endfor %}

{% endfor %}
