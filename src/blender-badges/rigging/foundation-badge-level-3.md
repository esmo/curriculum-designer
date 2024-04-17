---
title: "Inverse Kinematics & Master Control Setup"
badgeTrack: "Rigging"
badgeStage: "Foundation"
badgeLevel: "3"
pageType: "Badge"
---
{% extends "badge-template.njk" %}

{% block skills %}
**IK Control Bones**
- Create bones as controllers (IK & Pole)
- IK constraint
- IK Chain length
- IK Pole Target/Angle
- Copy Rotation constraint


**Dual constraints setup**
- IK + Rotation-only

**Master Control Setup**
- Create bone as main controller or the whole rig

**Lock Controllers' transformations**
- Location / Rotation / Scale
{% endblock %}

{% block interface %}
- ctrl+tab: pose mode

- F3: Scale B-Bone
- RMB: subdivide

- shift+d: duplicate bone
- alt+P: clear parent
- ctrl+p: parent keep offset

- shift+I: add IK to target bone

- alt+g: clear translations
- alt+r: clear rotations
{% endblock %}

{% block ticklist %}
**Can**
- Create IK controlled 3-bones rigs
- Assign pole to IK constraints
- Control IK chain length
- Create dual constraints rigs

**Know**
- Inverse Kinematic functioning
- Pole vector purpose
- assign two constraints to the same controller/bone
{% endblock %}
