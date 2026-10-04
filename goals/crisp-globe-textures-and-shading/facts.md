# Facts & Ground Truth: crisp-globe-textures-and-shading

- **Textures**: High-resolution 4K NASA Blue Marble for daylight, Black Marble for night lights, ocean water mask for specular reflections, and topography bump map.
- **Shader**: Custom GLSL fragment shader combining day diffuse, night illumination, specular ocean glint (`pow(max(dot(reflectDir, viewDir), 0.0), 32.0)`), and warm terminator rim.
- **Atmosphere**: Tuned Fresnel atmosphere rim shader with day-side blue scattering and night-side falloff.
- **Coordinate Alignment**: Textures and sphere geometry must maintain Prime Meridian at +Z to match `latLonToVector3` and subsolar solar ephemeris.
