---
track: "Rigging"
type: "Task"
title: "Rigging a Worm with Inverse Kinematics"
slug: "rigging-worm-ik"
author_instructor: "Curriculum Team"
version: "Updated 2026-03"
level: "Intermediate"
description: "Create a simple worm character, bind it to an armature with automatic weights, and control its movement through an IK setup. The task focuses on basic deformation rigging, control bones, and inverse kinematics in a compact exercise."
primary_resources: "- [Introduction to Rigging](/lessons/rigging/)"
secondary_resources: "- [FK IK Switch](/lessons/rigging_fk-ik-switch/)\n- Instructor demo on simple IK chain setup"
learning_goal_alignment: "- Applies core rigging concepts to a simple deforming character.\n- Practices creating and extending a bone chain.\n- Uses automatic weights to bind geometry to an armature.\n- Sets up and tests an IK control for intuitive posing."
task_goal: "After completing this task, learners should be able to build a simple armature for a worm-like character and bind the mesh with automatic weights. They should be able to create a control bone and add an IK constraint so that the worm can be posed through a clear end control. They should also be able to evaluate whether the deformation behaves plausibly and improve the setup if necessary. The result should demonstrate a functional beginner-to-intermediate rigging workflow in Blender."
assignment_brief: "Model or use a simple worm-shaped mesh and create an armature that follows its body structure. The bone chain should allow the worm to bend smoothly along its length. Parent the mesh to the armature using automatic weights. Then add a dedicated control bone and configure an IK constraint so that the worm can be posed by moving the control.\n\nTest the rig in pose mode and refine the setup until the worm deforms in a readable and believable way. Keep the scene organized and submit all required files with the correct naming convention."
planned_hours: 4
buffer_hours: 1
milestones: "- Hour 1: prepare the worm mesh and create the initial armature\n- Hour 2: complete the bone chain and parent with automatic weights\n- Hour 3: add IK control bone and configure the IK constraint\n- Hour 4: test deformation, refine weights if needed, and prepare submission"
deliverables: "- Deliverable: Blender project file\n  - Format: .blend\n  - Minimum content: worm mesh, armature, automatic weights, IK control bone, working IK constraint\n  - Naming convention: lastname_firstname_rigging-worm-ik.blend\n  - Submission location: LMS upload folder\n- Deliverable: Screenshot or short viewport recording\n  - Format: .png or .mp4\n  - Minimum content: rig shown in pose mode with visible deformation\n  - Naming convention: lastname_firstname_rigging-worm-ik-preview.png\n  - Submission location: LMS upload folder"
assessment_criteria: "- Criterion: Armature structure\n  - Weight: 35%\n  - Indicator: bone chain is complete, logically placed, and usable for the worm body\n- Criterion: IK setup\n  - Weight: 40%\n  - Indicator: dedicated control bone exists, IK constraint is configured correctly, rig responds predictably in pose mode\n- Criterion: Mesh deformation and file quality\n  - Weight: 25%\n  - Indicator: automatic weights produce a readable deformation, obvious rigging errors are corrected, file is organized and correctly named"
pass_requirement: "To pass, the submission must include a working worm rig with a valid armature, successful mesh binding, and a functional IK control. The Blender file must open correctly and the rig must be demonstrably poseable."
exclusion_criteria: "- Missing IK constraint\n- Mesh not parented to the armature\n- Control bone exists but does not drive the rig correctly\n- File is corrupted or cannot be opened\n- Submission lacks the required deliverables"
academic_prerequisites: "- Basic understanding of edit mode and pose mode\n- Familiarity with adding and extruding bones\n- Basic understanding of object parenting"
technical_prerequisites: "- Blender 4.2 or comparable course version\n- No add-ons required\n- Hardware sufficient for basic rigging and viewport interaction"
teaching_implementation: "- Input: 25%\n- Guided practice: 25%\n- Individual work: 40%\n- Team work: 0%\n- Feedback: 10%\n- Support format: live setup demo followed by supervised rigging practice\n- Feedback checkpoints: after bone chain creation, after mesh binding, after IK setup"
starter_files_assets: "- Starter files: optional worm base mesh\n- Provided assets: none required\n- Paths / links: course LMS or shared project folder"
---

## Additional Notes

Suggested interface focus:

- `E` to extrude bones in armature edit mode
- `Ctrl+P` to parent mesh to armature with automatic weights
- `Shift+I` in pose mode to add an IK constraint
- Pose mode for testing control behavior and deformation
