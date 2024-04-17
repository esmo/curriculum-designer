---
title: "Using the Graphic Tablet, Brushes, and Remeshing"
badgeTrack: "Sculpting"
badgeStage: "Foundation"
badgeLevel: "1"
pageType: "Badge"
tags: [badge, modeling, foundation, level-1]
---

{% extends "badge-template.njk" %}

{% block skills %}
**Setting up the graphic tablet**  
Navigating in sculpt mode with the pen

**Using the sculpt brushes**
- adjusting the brush size
- adjusting the brush strength
- draw
- grab
- smooth
- inverting brush effect (add / subtract)

**adjusting the mesh density (Remesh)**  
why does mesh density matter?  
setting voxel size  
applying voxel size to mesh
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

{% block ticklist %}
**Can:**
- use the graphic tablet
- adjust scupt brush size and strength
- set voxel size for mesh density
- apply voxel size to mesh
- use the draw brush
- use the grab brush
- use the smooth brush
- invert the effect of a brush

**Knows:**
- level of details depends on mesh density
{% endblock %}
