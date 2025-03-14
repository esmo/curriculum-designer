---
track: Rigging
type: Topic
title: Rigging
description: A common Workflow for Rigging
stage:
level:
---
# {{title}}
### {{description}}

Rigging is the process of setting up an armature (skeleton) to control a 3D model for animation. A well-structured rig ensures smooth deformations and efficient animation. Below is a step-by-step guide to rigging in Blender, covering everything from bone creation to advanced controls.

1. Preparing the Model
- Ensure the model has clean topology with proper edge loops for deformation.
- Apply Scale, Rotation, and Location (Ctrl + A → Apply All) to prevent transformation issues.
- If applicable, create a low-poly version of the mesh for easier weight painting.
- Set the 3D Cursor to the model’s center (Shift + S → Cursor to World Origin) for proper armature placement.

2. Creating the Armature
- Add an Armature (Shift + A → Armature).
- In the Object Data Properties of the armature, enable X-Axis Mirror to automate symmetrical editing.
- In Edit Mode, extrude (E) bones along the spine, arms, and legs while ensuring proper joint placement.
- Automate Bone Naming:
- Name the left-side bones with .L (e.g., upper_arm.L, thigh.L).
- Use Armature → Symmetrize (W → Symmetrize) to automatically create the mirrored bones with .R naming.

3. Setting Up Bone Hierarchy
- Parent bones logically using Ctrl + P → Keep Offset to maintain proper hierarchy.
- Ensure spine bones follow a sequential chain.
- Establish IK (Inverse Kinematics) for legs and arms:
- Add a new bone for the IK target (e.g., foot_ik.L).
- Apply an IK constraint (Bone Constraints tab) on the shin bone, targeting the IK bone.
- Consider FK (Forward Kinematics) controllers for finer rotation control.

4. Adding Custom Controllers & Constraints

To make the rig more user-friendly:
- Custom Bone Shapes:
- In Pose Mode, create a separate armature for control objects.
- Assign custom shapes to bones (Bone Properties → Viewport Display → Custom Object).
- Use simple shapes like arrows, circles, or boxes for better visibility.
- Constraints for Automation:
- IK Constraint for natural limb movement.
- Copy Rotation/Location for automated transformations.
- Track To for eye tracking or look-at setups.
- Pole Targets to control IK limb bending.

5. Skinning (Weight Painting)
- Parent the mesh to the rig using Ctrl + P → With Automatic Weights.
- Enter Weight Paint Mode to refine deformations.
- Use the Blur Brush to smooth out weight transitions.
- Manually adjust weights using the Vertex Groups tab for better precision.
- Test posing the character in Pose Mode to ensure correct deformations.

6. Adding Facial & Secondary Rigs (Optional)
- Use Shape Keys for facial expressions and subtle deformations.
- Add a Rigify facial rig or create a custom one with additional controllers.
- Set up secondary controllers for clothing, tails, hair, and accessories.

7. Testing & Refining the Rig
- Move bones in Pose Mode to check deformations.
- Adjust weights and constraints as needed.
- Ensure IK/FK switching works correctly (if implemented).
- Test extreme poses to find and fix potential issues.

By following this structured workflow, you can create an efficient, animation-friendly rig with symmetrical bone naming, custom controllers, and clean deformations. Let me know if you’d like further refinements or more details on any step! 🚀
