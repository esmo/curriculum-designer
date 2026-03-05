---
track: Rigging
type: Lesson
title: Create an IK/FK switch
description: How To create a rig that lets you switch between IK and FK controls.
stage: 3
level: 1
---
#  {{title}}
{{description}}


The easiest way to implement an IK/FK switch is to add a copy location constraint to the IK control bone (set the Head/Tail slider to 1 to keep the bones in place).
To use it in IK mode, set the influence to 0.
To use it in FK mode, set the influence of the copy location constraint to 1, and that of the IK constraint to 0.
Note that you need to keyframe these settings, and also to apply the current visual transform to the pose when switching between IK anf FK.

Here is a step by step guide for animating:

Starting in IK mode and switching to FK:

Make sure the IK influence is set to 1 and the copy location influence is set to 0 for IK, or vice versa for FK.

- set keyframes for all affected bones.
- set the playhead in the timeline to the new position and pose the rig using the IK control.
- apply the the visual transform of all affected bones (ctrl/cmd a > "Apply Visual Transform to Pose").
- set keyframes for all affected bones.
- set keyframe for the influence of the bone constraints "copy location" and "inverse kinematics"
- advance the playhead 1 frame.
- apply the the visual transform of all affected bones (ctrl/cmd a > "Apply Visual Transform to Pose").
- set keyframes for all affected bones.
- switch the values for the influence for the bone constraints (1 for copy location and 0 for inverse kinematics for IK to FK, or vice versa for FK).
- set keyframe for the influence of the bone constraints "copy location" and "inverse kinematics"

[Quick and Easy FK/IK Switch; Snapping enabled BLENDER 3d ](https://www.youtube.com/watch?v=iWYFwGy7uu0)

[How to Quickly Rig IK FK in Blender ](https://www.youtube.com/watch?v=xEnu_EsnzjI)
