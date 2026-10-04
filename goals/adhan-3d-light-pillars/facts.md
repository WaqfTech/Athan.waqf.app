# Facts & Ground Truth: adhan-3d-light-pillars

- **Geometry**: Three.js `InstancedMesh` of vertical cylinders oriented along surface normals (`THREE.Object3D.lookAt` or quaternion rotation).
- **Colors**: Exact match with prayer legend (`fajr`: 0x38bdf8, `dhuhr`: 0xfacc15, `asr`: 0xfb923c, `maghrib`: 0xf43f5e, `isha`: 0xa855f7).
- **Height Scaling**: Non-active settlements maintain minimal height (0.02) or subtle dots, while settlements with active Adhan rise up to 0.4 - 0.8 units above the surface.
- **Performance**: Single draw call via `InstancedMesh` ensures 60 fps even with 15,000 settlements.
