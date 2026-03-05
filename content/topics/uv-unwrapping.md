---
track: Texturing
type: Topic
title: UV-Unwrapping
description: A Guide on UV Unwrapping
stage:
level:
---
# {{title}}
{{description}}

UV unwrapping is the process of creating a 2D representation (UV map) of your 3D model so that textures can be applied correctly. A well-done UV unwrap prevents stretching, distortion, and inefficient texture space usage.

The basic steps are as follows:
1.	Prepare the model (apply transforms, clean geometry).
2.	Mark seams logically.
3.	Unwrap the model using the best method.
4.	Check for stretching and adjust UVs.
5.	Pack UV islands for maximum efficiency.
6.	Export UV layout for texturing.

### Understanding UVs
- U (horizontal) and V (vertical) represent the 2D texture space.
- A UV map flattens your 3D model into 2D space.
- Proper UV unwrapping ensures textures wrap correctly around the model.

### Preparing the Model for UV Unwrapping

Before unwrapping:
1.	Apply all transformations (Ctrl + A → Apply Scale).
2.	Check for non-manifold geometry (Select All → M → Merge by Distance).
3.	Remove overlapping faces and unnecessary subdivisions.
4.	Ensure a good topology (Retopology should be complete before unwrapping).

### Marking Seams

Seams are cuts in the 3D model that define how it will be flattened. Think of them like cutting patterns for sewing.

Where to Place Seams?
- Hidden areas (e.g., under arms, inner thighs).
- Natural splits (e.g., clothing seams, armor plates).
- Sharp edges or hard surface areas (e.g., along a sword blade).
- Organic models: Use long seam paths that follow muscle flow.
- Hard-surface models: Cut along sharp edges or panel separations.

How to Mark Seams?
1.	Select edges where you want to split the UV.
2.	Press Ctrl + E → Mark Seam (edges turn red).
3.	Hide the seams when possible (e. g. along natural clothing seams) while still keeping good UV separation.

### Unwrapping the Model

Once seams are marked, unwrap the model.

Blender 4.0 offers several UV unwrapping methods to accommodate various modeling needs. Access these methods in Edit Mode by selecting the faces you wish to unwrap, pressing U, and choosing the appropriate option from the menu.

#### 1. Unwrap using Conformal, Angle Based, or Minimum Stretch method
- Description: Flattens the mesh surface by cutting along seams, providing a “best fit” scenario based on face connectivity.
- Best For: Organic shapes and complex models requiring precise control over UV mapping.
- Methods:
  - Conformal (LSCM- Least Squares Conformal Mapping): The oldest algorithm, has problems to with stretching on more complex objects.
  - Angle Based: Offers a better 2D representation of the mesh in many cases, particularly for complex and curved surfaces.
  - Minimum Stretch: The latest algorithm, suitable for complex objects in many situations.
- Usage:
	1. In Edit Mode, select all faces to be unwrapped.
	1. Press U and choose the appropriate method in the “Unwrap” submenu.
	1. In the Adjust Last Operation panel, you can change the desired method (Angle Based, Conformal, or Minimum Stretch) and adjust settings like Fill Holes, Correct Aspect, and Margin as needed.

#### 2. Smart UV Project
- Description: Automatically creates UV maps by projecting faces based on an angle threshold, cutting the mesh into islands.
- Best For: Hard surface models and architectural structures where quick unwrapping is beneficial.
- Usage:
	1.	In Edit Mode, select all faces.
	2.	Press U and choose “Smart UV Project” in the “Unwrap” submenu.
	3.	Set the Angle Limit to control island creation; a lower angle results in more islands.
	4.	Adjust the Island Margin to set spacing between islands.
	5.	Confirm to generate the UV map.

#### 3. Lightmap Pack
- Description: Separates each face into its own UV island, packing them efficiently within the UV space.
- Best For: Creating lightmaps for baking lighting information, especially in game development.
- Usage:
	1.	In Edit Mode, select all faces.
	2.	Press U and choose “Lightmap Pack”.
	3.	Configure settings such as Padding to control space between islands.
	4.	Confirm to generate the packed UV layout.

#### 4. Follow Active Quads
- Description: Aligns UVs based on the topology of selected quads, producing a grid-like UV layout.
- Best For: Meshes with a uniform quad topology, like grids or tiled surfaces.
- Usage:
	1.	In Edit Mode, select a well-unwrapped face to serve as the starting point.
	2.	Extend the selection to adjacent quads.
	3.	Press U and choose “Follow Active Quads”.
	4.	Adjust settings for alignment and spacing as needed.

#### 5. Cube, Cylinder, and Sphere Projection
- Description: Project UVs onto the model from different geometric shapes (cube, cylinder, sphere).
- Best For: Simple objects that closely match these shapes.
- Usage:
	1.	In Edit Mode, select the faces to unwrap.
	2.	Press U and choose the desired projection method (e.g., “Cube Projection”).
	3.	Adjust projection settings in the Adjust Last Operation panel to fit the model appropriately.

#### 6. Project from View
- Description: Creates UV coordinates based on the current 3D viewport view, effectively capturing the visible area.
- Best For: Planar surfaces or when a specific view alignment is needed.
- Usage:
	1.	Align the 3D view to the desired angle.
	2.	In Edit Mode, select the faces to unwrap.
	3.	Press U and choose “Project from View”.
	4.	The UV map will correspond to the current viewport perspective.

#### 7. UV Unwrap Node
- Description: A Geometry Nodes feature that generates UV map islands based on a selection of seam edges, allowing for procedural UV unwrapping.
- Best For: Advanced users requiring procedural workflows and automation.
- Usage:
	1.	In the Geometry Nodes Editor, add the “UV Unwrap” node.
	2.	Connect it to your mesh data, specifying seam edges and other parameters.
	3.	The node outputs UV coordinates that can be further manipulated or used directly.

### Optimizing the UV Layout

Once the UVs are unwrapped, optimize the layout for maximum texture efficiency.

Checking UV Stretching
1.	Open UV Editor.
2.	Switch to UV Editing workspace.
3.	Use the Checker Texture (New Image > Type: UV Grid).
4.	Identify areas where squares are stretched.
5.	Adjust seams or manually move UVs to fix distortion.

Packing UV Islands
1.	Minimize empty space in the UV map.
2.	Use Ctrl + P to pack UVs automatically.
3.	Scale and rotate UV islands manually for better efficiency.
4.	Keep similar-sized details proportional to avoid texture inconsistencies.

### Exporting UVs
1.	Open UV Editor.
2.	Click UV → Export UV Layout.
3.	Save as PNG for use in texturing software like Substance Painter, Photoshop, or Blender Texture Paint.

### Bonus Tips
- For characters: Use symmetrical UVs when possible.
- For game assets: Keep UV maps non-overlapping unless mirroring is intentional.
- For tiling textures: Use straightened UVs for clean alignment.
