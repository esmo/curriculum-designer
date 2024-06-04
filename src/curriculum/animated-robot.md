---
track: Modeling
title: An animated robot
description: Basic exercise involving mesh object transforms, basic shading and keyframing
stage: 0
level: 0
---

# {{title}}
### {{description}}

## skills
- add mesh objects
- transform mesh objects
- parent objects
- set keyframes manually and automatically
- set interpolation mode
- BSDF shader basics (base color, metallic, roughness)
- link material to objects

## ticklist
**can**
- modeling basics
  - add mesh primitives
  - transform meshes (location, rotation, scale)
  - parenting
- animation basics
  - set keyframes for default keyset (location, rotation, scale)
  - use auto-keying
  - set interpolation mode
- shading basics
  - adjust metallic map
  - adjust roughness
  - change color
  - link material to different objects

**know**
- what is a transform
- what is interpolation
- transforming a parent object affects its children
- the difference between active and selected objects

## Interface
- transform (g: grab, r: rotate, s: scale)
- shift a: add mesh objects
- x: delete objects
- a: select all objects
- shift lmb: select active / deselect
- t (in timeline): set interpolation mode
- i: add keyframe in current keyset (default: locrotscale)
- ctrl+l->"Link Materials": Link materials from active to selected objects
