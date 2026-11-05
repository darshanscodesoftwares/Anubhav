import * as THREE from 'three';

/**
 * 12 views of the owner's rose petal (public/drape/petal-atlas.webp: 4×3 atlas, ordered face-on → edge-on, base at the
 * bottom, transparent background). Built from `Pink Rose Petal Animation Grid.png`. Each petal in the scene is a
 * camera-facing sprite that picks the view matching how the camera sees it, so it looks right from any direction.
 */
export const petalAtlas = new THREE.TextureLoader().load('/drape/petal-atlas.webp');
petalAtlas.colorSpace = THREE.SRGBColorSpace;
petalAtlas.anisotropy = 4;
