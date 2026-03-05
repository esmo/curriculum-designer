# Modeling

## 1. Transforming Objects
{% for item in collections.all | filterAttribute("track", "Modeling") | filterAttribute("stage", "1") | filterAttribute("level", "1") %}
[{{item.data.title}}]({{item.url}}) (Level {{item.data.stage}}.{{item.data.level}}):
{{item.data.description}}  
{% endfor %}
## 2. The Basics of Object Manipulation
## 3. Tools for Editing and Basic Modifiers



# Shading



{% for trackName in collections.all | attributeValues("track") | sort() %}

# {{trackName}}

{% for item in collections.all | filterAttribute("type", "Lesson") | filterAttribute("track", trackName) | sort(attribute="data.level") | sort(attribute="data.stage") %}
[{{item.data.title}}]({{item.url}}) (Level {{item.data.stage}}.{{item.data.level}}):
{{item.data.description}}  
{%if item.data.tags%} [{{item.data.tags}}] {% endif %}
{% endfor %}

{% endfor %}
