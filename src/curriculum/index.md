{% for trackName in collections.all | attributeValues("track") %}

# {{trackName}}

{% for item in collections.all | filterAttribute("track", trackName) | sort(attribute="data.stage") | sort(attribute="data.level") %}
[{{item.data.title}}]({{item.url}}) (Level {{item.data.stage}}.{{item.data.level}}):
{{item.data.description}}
{% endfor %}

{% endfor %}
