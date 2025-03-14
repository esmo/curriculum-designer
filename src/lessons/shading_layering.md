---
track: Shading
type: Lesson
title: Layering
description: How to create Layers in Shading
stage: 0
level: 1
---
#  {{title}}
{{description}}


Was bedeutet Layering im Shading?

Layering bezieht sich auf das Mischen mehrerer Shader-Typen oder Materialeigenschaften, um mehrdimensionale Oberflächen zu erzeugen. In der Realität bestehen Materialien selten aus nur einer gleichmäßigen Oberfläche – sie haben Unregelmäßigkeiten, Reflexionen, Transparenzen oder mehrere Schichten (wie Lack auf einem Auto oder Staub auf einem Metallstück).

⸻

Beispielhafte Anwendungsfälle von Layering mit Mix Shadern

1. Mischmaterialien (Mix Shader)
	•	Kombination eines Metall- und eines Dielektrik-Materials (z. B. verrostetes Metall mit darunterliegendem Lack).
	•	Nutzung eines Mix Shader Nodes, um basierend auf einer Faktor-Map (z. B. Grayscale-Texture oder Vertex Paint) zwischen zwei Materialien zu überblenden.
	•	Beispiel: Kratzspuren auf Metall, bei denen unter der Kratzstelle das Basismaterial sichtbar wird.

2. Maskierte Materialien (Layering mit Factor Maps)
	•	Nutzung einer Black & White Maske zum Mischen verschiedener Materialbereiche.
	•	Beispiel: Ein Autolack mit Kratzern, wo der Lack durch eine Schmutzmap abgeplatzt ist und darunter das Metall sichtbar wird.
	•	Faktor-Map = eine Textur, Vertex Paint oder eine prozedurale Maske.

3. Fresnel-basiertes Layering (Glanz abhängig vom Blickwinkel)
	•	Nutzung eines Fresnel-Nodes oder Layer Weight Nodes, um Reflexionen abhängig vom Betrachtungswinkel zu steuern.
	•	Beispiel: Autolack, Haut oder Plastik, die aus mehreren Schichten bestehen, wobei der äußere Glanzwinkel sich dynamisch anpasst.

4. Transparentes Layering (z. B. Lack, Schmutz, Wasser)
	•	Kombination eines Glas- oder Lackmaterials über eine Basisschicht.
	•	Beispiel: Ein Auto mit Klarlack – der Lack darunter hat eine eigene Rauheit, während der Klarlack für Reflexionen sorgt.
	•	Verwendung eines Transparent Shader oder Refraction Shader als Oberflächenschicht.

5. Procedurales Layering (z. B. Schmutz und Staub auf einer Oberfläche)
	•	Nutzung von Noise Textures, Grunge Maps oder Geometry Nodes, um Schmutz, Abnutzung oder Wetmaps dynamisch hinzuzufügen.
	•	Beispiel: Ein altes, staubiges Fenster, bei dem die Ecken verstaubt sind, aber der mittlere Bereich klar bleibt.

⸻

Zusammenfassung: Layering-Techniken im Shading
