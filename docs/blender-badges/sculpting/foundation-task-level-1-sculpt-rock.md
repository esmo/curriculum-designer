---
title: Sculpt a stone
description: Sculpt a rock out of the default cube.
badgeTrack: "Sculpting"
badgeStage: "Foundation"
badgeLevel: "1"
pageType: "Task"
tags: [task, modeling, foundation, level-2]
---

{% extends "docs/_includes/task-template.njk" %}

{% block task %}

create a stone
- start with the default cube
- remesh (r, ctrl+r) cube to add geometry
- use the draw (x, ctrl+x), grab (g), and smooth (shift+s) tools to form a stone, adjust the brush size (f) and - . - strength (shift+f) for fine grained sculping
- refine the surface by remeshing and smoothing
- repeat c. and d. until you are satisfied with the outcome
{% endblock %}

{% block interface %}

- f: adjust brush size
- shift + f: adjust brush strength
- x: draw (v since 4.0)
- g: grab
- shift + s: smooth (s since 4.0)
- hold ctrl while drawing: invert brush effect
- r: set voxel size (shift + r in earlier versions)
- ctrl +r : apply voxel size to mesh

{% endblock %}
