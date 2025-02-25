---
track: Sculpting
type: Topic
title: Sculpting
description: A common Workflow for Sculpting
stage:
level:
---
# {{title}}
### {{description}}

The sculpting workflow in Blender (or any digital sculpting software) generally follows a structured process to create highly detailed 3D models while ensuring they remain usable for animation, texturing, and rendering. Below is a step-by-step overview of the workflow, including retopology:

#### Blockout (Base Mesh)
 - Start with a low-poly base mesh that represents the general shape of your model.
 - This can be created from basic primitives (e.g., cubes, spheres) using the remesh modifier to fuse forms together.
 - The goal is to define primary shapes and proportions before moving into details.

#### Primary Forms (Sculpting Phase 1)
 - Use sculpting tools like Clay Strips, Draw, Grab, and Inflate to define the major forms.
 - Focus on overall silhouette and ensure the shapes work well from different angles.
 - Avoid fine details at this stage—get the broad strokes of anatomy or structure right.

#### Secondary Forms (Sculpting Phase 2)
 - Increase the geometry resolution using Dyntopo (Dynamic Topology) or multiresolution subdivision.
 - Define muscle structure, facial features, or key mechanical forms.
 - Work on volume and surface transitions, making sure the shapes flow properly.

#### High-Resolution Detailing
 - Subdivide the model further or use Multiresolution Modifier to preserve the lower topology while sculpting finer details.
 - Add wrinkles, pores, textures, and micro details using brushes, alphas, and surface noise.
 - At this stage, your mesh may become very dense (millions of polygons).
