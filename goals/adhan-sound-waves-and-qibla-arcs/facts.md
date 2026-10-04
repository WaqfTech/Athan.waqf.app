# Facts & Ground Truth: adhan-sound-waves-and-qibla-arcs

- **Ripple Rings**: Reusable ring geometry (`THREE.RingGeometry`) positioned at active settlements, animated in fragment/vertex shader with expanding radius and alpha decay.
- **Qibla Coordinate**: The Kaaba is located at `21.4225° N, 39.8262° E`.
- **Arc Curve**: Quadratic/Cubic Bezier curve elevated above the sphere along the great circle path, with maximum altitude proportional to arc distance.
- **Dashed Animation**: Dynamic uniform `uDashOffset` or attribute shift creates forward motion of light pulses along the arc toward Mecca.
