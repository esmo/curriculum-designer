---
track: Modeling
type: Lesson
title: Reset the rotation to world coordinates
description: Reset the rotation of an object to world coordinates after it has been applied.
stage: 1
level: 1
---
#  {{title}}
{{description}}


Sometimes you need to align the rotation of an object to the world coordinates. As long as the rotation has not been applied, this is easily achieved by pressing Alt+r, which resets the rotation.
To achieve the same after the orientation has been applied, you need some more steps:


- Go into edit mode and choose a face that shows in which direction the object should be re-oriented.
- click on the plus sign in the "Transform Orientations" menu. It will be set to "Face", specifically the face you selected.
- Go into object mode and make sure only the origin is affected by transforms (either type CTRL+. or choose Options > Transforms Affect only Origins)
- From the menu choose Object > Transform > Align to Transform Orientation.

Now you can use Alt+r to reset the orientation to the world coordinates. Don't forget to uncheck the "Transforms Affect only Origins" option, and to revert "Transform Orientation" to "Global" before that.


[Blender orientation trick you NEED to know](https://www.youtube.com/watch?v=9ngYkyhNCnY)

Note the comment by @Lanaur_
