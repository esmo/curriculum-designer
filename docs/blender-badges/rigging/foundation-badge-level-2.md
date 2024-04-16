---
title: "Forward Kinematics Control Bones"
badgeTrack: "Rigging"
badgeStage: "Foundation"
badgeLevel: "2"
pageType: "Badge"
---
{% extends "badge-template.njk" %}

{% block skills %}
**Creating Armatures**
- Changing bones shape (viewport display)
- Change bones color

**Editing Armatures**
- Scale BBone
- Subdivide bone

**Editing WeightPaint**
- Draw
- Weight
- Blur

**FK Control Bones**
- Create bones as controllers
- Parent/unparent between bones
- Custom shape of control bones
- Bones collections

{% endblock %}

{% block interface %}
- ctrl+tab: pose mode

- F3: Scale B-Bone
- RMB: subdivide

- shift+d: duplicate bone
- alt+P: clear parent
- ctrl+p: parent keep offset
{% endblock %}

{% block ticklist %}
**Can**
- change bone shape & color
- subdivide bones
- edit paintweight
- constraint bones

**Know**
- customize shapes & color of bones
- adjust the weightpaint to improve the geometry deformation
- create basic armature  controllers
{% endblock %}
