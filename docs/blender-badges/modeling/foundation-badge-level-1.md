---
title: "Editing Objects"
badgeTrack: "Modeling"
badgeStage: "Foundation"
badgeLevel: "1"
pageType: "Badge"
tags: [badge, modeling, foundation, level-1]
---

{% extends "badge-template.njk" %}

{% block skills %}
adding/deleting/manipulating primitive (Mesh) Objects

- Cube
- Plane
- Cone
- Cylinder
- Suzanne

Manipulations of objects and meshes
- Add
- Delete
- Move
- Rotate
- Scale
{% endblock %}
{% block interface %}

- Colour the snowman
  - Use load menu to find .blend file
  - left click select | Material properties | add new material | name material | change colour
  - repeat
  - left click select | Material properties | reuse material
- Add button, colour and duplicate
  - add tool | move tool | scale tool along one axis | rotate viewport
  - left click select | Material properties | add new material | name material | change colour
  - use keyboard shortcut to duplicate | move tool | rotate tool
  - use object properties to give things names | use the outliner to parent objects | move object around scene
- Build a cabin
  - Show the widget and the tab button
  - Use widgets | rotate viewport |
  - edge select widget | extrude widget | use command/control to limit extrusion
  - Use control and left click | add and name new materials | reuse materials
  - move and rotate tools
  - Fly mode
{% endblock %}
{% block ticklist %}
**Can**

- delete objects
- add cube / monkey / sphere / cylinder
- move objects along x, y and z
- rotate the viewport to look at different parts of the scene
- look through the camera lens
- scale objects
- save blender file

**Knows**
- a scene is made up of objects, lights and cameras
- everything is editable!
{% endblock %}
