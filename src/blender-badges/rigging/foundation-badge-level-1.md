---
title: "Creating Armatures"
badgeTrack: "Rigging"
badgeStage: "Foundation"
badgeLevel: "1"
pageType: "Badge"
---

{% extends "badge-template.njk" %}

{% block skills %}
**Creating Armatures**
- Creating single bone
- Structure (tip, body. root)
- Rename bones

**Editing Armatures**
- Edit mode
- Extruding new bones

**Constraining Geometry**
- Child of
- Armature

**Animating Armatures**
- Pose mode
{% endblock %}

{% block interface %}
- shift+a: add menu (Armature)

- tab: edit mode
  - e: extrude new bone
  - g/r: move/rotate bone components


- ctrl+p constraint menu
{% endblock %}

{% block ticklist %}
**Can**
- create bones
- edit bones
- rename bones
- extrude bones
- constraint "child of" and "armature"
- pose the bones

**Know**
- what bones are
- how to edit basic shape
- constraint to a geometry
- pose bones
{% endblock %}
