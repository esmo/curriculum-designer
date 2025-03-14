---
track: Postproduction
type: topic
title: Color Correction
description: How to do Color Correction
stage: 1
level: 1
---
# {{title}}
### {{description}}

1. Adjust Luminance (Brightness)

The footage should have a luminance in an appropriate range.

*Adjust the exposure to avoid overexposure, and contrast to balance out the curve between 0 and 100 IRE. In Resolve, you might want to check Highlight Recovery*

IRE (Institute of Radio Engineers) is a unit used to measure luminance (brightness) levels in video signals, ranging from 0 IRE (pure black) to 100 IRE (pure white, full brightness). Note that this refers to SDR (Standard Dynamic Range). For HDR, values can go beyond 0 and 100 respectively.

 - 0 IRE = Black (Shadows)
 - 10-20 IRE = Deep Shadows
 - 40-60 IRE = Midtones (Skin tones often around 50-70 IRE)
 - 80-90 IRE = Highlights
 - 100 IRE = Brightest Whites (should not be clipped unless intentional)
 - Above 100 IRE = Overexposed (Clipped Highlights)

Depending on the software and the bit depth of th footage, you may find other scales. Here is a comparison:

| **IRE**  | **10-bit Scale (0-1023)** | **12-bit Scale (0-4095)** | **Percentage (%)** |
|---------|--------------------------|--------------------------|--------------------|
| **0 IRE (Black)** | **0** | **0** | **0%** |
| **50 IRE (Midtones/Gray)** | **512** | **2048** | **50%** |
| **100 IRE (Full White)** | **1023** | **4095** | **100%** |
| **Super Whites (Above 100 IRE)** | **Above 1023** | **Above 4095** | **Above 100%** |

2.
