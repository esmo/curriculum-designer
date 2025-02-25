---
track: Sculpting
type: Topic
title: Retopology
description: A common Workflow for Retopology
stage:
level:
---
# {{title}}
### {{description}}

Retopology is the process of converting a high-poly sculpt into a clean, low-poly model optimized for animation and rendering.

#### Create a Low-Poly Base Mesh
 - Manual Retopology (Best for Control)
 - Use Shrinkwrap Modifier on a new mesh to conform it to the high-poly sculpt.
 - Place edge loops strategically around deformable areas (joints, facial features).
 - Use the Poly Build tool or retopology add-ons like PolyQuilt or BSurfaces (both Blender Extensions) for clean results.
 - Use QuadriFlow Remesher or the Remesh Modifier.
 - Adjust density settings based on animation or game engine needs.
 - Manually clean up any problematic topology.

#### Optimize Edge Flow
 - Maintain quads instead of triangles or n-gons for better deformation.
 - Follow natural curves and muscle flow for characters.
 - Add extra loops only where necessary to preserve important details.

#### Final Clean-Up
  - Check for non-manifold geometry and overlapping faces.
  - Ensure good topology density balance (e. g. more detail in face/hands, fewer in flat areas).
  - Apply Mirror Modifier (if used) and check for symmetry issues.
