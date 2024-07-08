---
track: Lighting
type: Lesson
title: Three Point Lighting
description: Basics about Lighting
stage: 1
level: 1
---
#  {{title}}
{{description}}

Three-point lighting is a fundamental technique in lighting, consisting of three main components:

1. **Key Light**: The primary light source that defines the shape and details of the subject.
2. **Fill Light**: A secondary light that reduces shadows cast by the key light, ensuring balanced illumination.
3. **Back Light (Rim Light)**: Positioned behind the subject, the back light creates a rim of light around the edges, separating the subject from the background and adding depth to the image.

This setup provides a balanced and versatile lighting framework that enhances the subject's appearance and creates a sense of depth and dimension in the scene.

## Key Light

The key light is the primary source of illumination, creating the bulk of the form and definition in a scene. The size of the light relative to the subject affects its quality:

- **Hard Light**: Produced by smaller lights, it creates sharper shadows and adds more depth to the image.
- **Soft Light**: Produced by larger lights, it creates a smoother transition between light and shadow, resulting in a flatter image.

### Direction and Position

Side lighting enhances depth by creating shadows that add dimension. Upstage lighting, or reverse keylighting, involves placing the key light behind the subject, which enhances depth and dimension by creating a more dramatic interplay of light and shadow.

### Light Falloff and Color Temperature

Light falloff, the rate at which light intensity decreases over distance, is higher when the light source is closer to the subject. For more dramatic effects, keep your light source close. To control the color temperature of the light, use the blackbody node.

### Beam Shape and Secondary Key Light

The beam shape of the light, specifically the spread, also influences the light's harshness; a lower spread results in harsher light. Introducing a secondary key light, which is smaller and harsher with a lower spread, helps to capture additional detail.

## Fill Light

Fill lights are used to illuminate darker areas of the scene, reducing the contrast created by the key light. They are usually placed at an angle complementary to the key light to soften shadows and ensure that the overall illumination is balanced.

### Contrast Ratio

Fill lights control the contrast ratio, which is the difference between the brightest and darkest parts of the image:

- **Low Key Lighting**: Characterized by a high contrast ratio (e.g., 10:1), it creates dramatic, moody scenes.
- **High Key Lighting**: With a low contrast ratio (e.g., 2:1), it produces a brighter, more evenly lit scene.

### Background Illumination

Background illumination, using either a background shader or an HDRI (High Dynamic Range Image), can also serve as a fill light. Additionally, a volume scatter shader around the scene can enhance global illumination, providing a more natural and diffused lighting effect.

## Back Light (Rim Light)

The back light, also known as the rim light, is positioned behind the subject. Its primary function is to create a rim of light around the subject's edges, which helps to separate the subject from the background. This separation adds depth and dimension to the image, making the subject stand out more prominently. The back light can also add a subtle glow or halo effect, enhancing the overall visual appeal and ensuring that the subject does not blend into the background.

## Accent Light

Accent lights are used to create hints of the environment and atmosphere, adding layers of complexity to the lighting setup. A gobo, or "go-between," is a mask or stencil placed in front of the light source to create patterned shadows or light patterns on surfaces. This technique can simulate various environmental elements, such as tree branches, window panes, or abstract designs, thereby enriching the visual storytelling and adding depth to the scene.

## HDRI and Dynamic Range

HDRI (High Dynamic Range Imaging) involves capturing multiple bracketed exposures to cover a wide range of luminosity, which are then merged using HDR software. This process captures details in both shadows and highlights, resulting in an image with a wider dynamic range than a single exposure. Tone mapping adjusts the combined image to ensure it can be displayed on standard screens with limited dynamic ranges.
