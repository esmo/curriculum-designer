---
title: Snowman
description: Colour a snowman made from mesh primitives
pageType: "Task"
tags: [task, modeling, foundation, level-2]
---

{% extends "docs/_includes/task-template.njk" %}

{% block task %}

- Colour the snowman (10-15 mins)
  - Load pre-made snowman or their own snowman
  - Colour in hat
  - Colour in arm
  - Reuse colour on second arm
  - [EXTENSION] Colour in trees
- Add button, colour and duplicate (15-20 mins)
  - add/flatten/move/rotate single button
  - add colour to button
  - duplicate buttons and move them to correct locations
  - parent named parts of snowman together
  - [EXTENSION] Create trees and parent parts together, duplicate trees to make a forest
- Build a cabin (15-30 minues)
  - using edit mode
  - select a face and extrude
  - use edge select to move and scale parts of the cabin (give a model for them to aim at making)
  - Select faces to give roof and walls diferent colours
  - return to object mode to position cabin
  - Fly through scene
  - [EXTENSION] make a range of different houses and a car. Colour in house, parent parts of a house together.
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
