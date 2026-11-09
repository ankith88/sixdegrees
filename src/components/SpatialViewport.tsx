'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Compass,
  Eye,
  Navigation,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RefreshCw,
  Film,
  Tv,
  UserCheck,
  Award,
  Music,
  Hash,
} from 'lucide-react';
import {
  CameraMode,
  ForceSettings,
  GraphLink,
  GraphNode,
  MediaItem,
  ViewMode,
} from '@/lib/types';
import { getPosterFallbackDataUri } from '@/lib/seed-data';

interface SpatialViewportProps {
  nodes: GraphNode[];
  links: GraphLink[];
  focalItem: MediaItem | null;
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNode) => void;
  onMakeFocal: (mediaId: string) => void;
  onClearFocal?: () => void;
  viewMode: Exclude<ViewMode, 'MATRIX'>;
  forceSettings: ForceSettings;
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  autoRotate: boolean;
  onAutoRotateChange: (val: boolean) => void;
  resetPitchTrigger: number;
  orbitTargetNodeId: string | null;
  onFovChange?: (fov: number) => void;
}

interface HoveredTooltipState {
  node: GraphNode;
  x: number;
  y: number;
}

function getEntityRoleLabel(type: GraphNode['type']): string {
  switch (type) {
    case 'DIRECTOR':
      return 'Director / Writer';
    case 'ACTOR':
      return 'Cast';
    case 'TROPE':
      return 'Theme';
    case 'COMPOSER':
      return 'Score & Camera';
    case 'MOVIE':
      return 'Film';
    case 'TV':
      return 'Series';
  }
}

/**
 * Creates a high-DPI 3D Sprite label texture for a GraphNode in warm archival vellum
 */
function createLabelSprite(node: GraphNode): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isMedia = node.type === 'MOVIE' || node.type === 'TV';
    const titleText =
      node.label.length > 25 ? node.label.slice(0, 23) + '…' : node.label;
    const badgeText = node.isFocal
      ? 'Selected Title'
      : isMedia && node.matchScore !== undefined
        ? `${node.matchScore}% Match`
        : isMedia && node.mediaItem
          ? `${node.mediaItem.year} · ★ ${node.mediaItem.imdbRating.toFixed(1)}`
          : getEntityRoleLabel(node.type);

    // Warm archival vellum card plate
    ctx.fillStyle = node.isFocal
      ? 'rgba(251, 248, 242, 0.98)'
      : 'rgba(246, 241, 231, 0.94)';
    ctx.strokeStyle = node.isFocal
      ? '#B8292F'
      : isMedia
        ? node.color
        : '#B5A892';
    ctx.lineWidth = node.isFocal ? 3 : 2;

    const pillW = Math.min(480, Math.max(210, titleText.length * 16 + 70));
    const pillH = 82;
    const pillX = (canvas.width - pillW) / 2;
    const pillY = 28;

    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    ctx.fill();
    ctx.stroke();

    // Title in Spectral serif
    ctx.font = `${node.isFocal ? '700 25px' : '600 22px'} "Spectral", Georgia, serif`;
    ctx.fillStyle = '#171412';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(titleText, canvas.width / 2, pillY + 30);

    // Subtitle in Source Sans 3
    ctx.font = '600 15px "Source Sans 3", -apple-system, sans-serif';
    ctx.fillStyle = node.isFocal
      ? '#B8292F'
      : isMedia && (node.matchScore || 0) >= 75
        ? '#2A6B53'
        : node.color;
    ctx.fillText(badgeText, canvas.width / 2, pillY + 60);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const scale = node.isFocal
    ? 44
    : node.type === 'MOVIE' || node.type === 'TV'
      ? 34
      : 27;
  sprite.scale.set(scale, scale * (144 / 512), 1);
  sprite.position.set(0, node.radius + 7.5, 0);
  return sprite;
}

export function SpatialViewport({
  nodes,
  links,
  focalItem,
  selectedNodeId,
  onSelectNode,
  onMakeFocal,
  onClearFocal,
  viewMode,
  forceSettings,
  cameraMode,
  onCameraModeChange,
  autoRotate,
  onAutoRotateChange,
  resetPitchTrigger,
  orbitTargetNodeId,
  onFovChange,
}: SpatialViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvas2dRef = useRef<HTMLCanvasElement | null>(null);

  const [hoveredTooltip, setHoveredTooltip] =
    useState<HoveredTooltipState | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Refs for mutable access inside animation loop
  const nodesRef = useRef<GraphNode[]>(nodes);
  const linksRef = useRef<GraphLink[]>(links);
  const forceRef = useRef<ForceSettings>(forceSettings);
  const hoveredIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedNodeId);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const cameraModeRef = useRef<CameraMode>(cameraMode);

  useEffect(() => {
    forceRef.current = forceSettings;
  }, [forceSettings]);

  useEffect(() => {
    selectedIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  // Camera spherical coordinates for smooth interactive 3D control
  const camSphericalRef = useRef({
    radius: 265,
    theta: 0.45,
    phi: 1.18,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    goalX: 0,
    goalY: 0,
    goalZ: 0,
    goalRadius: 265,
    flyIndex: 0,
    flyTimer: 0,
  });

  // Handle Reset View trigger
  useEffect(() => {
    if (resetPitchTrigger > 0) {
      camSphericalRef.current.phi = Math.PI / 2.25;
      camSphericalRef.current.goalX = 0;
      camSphericalRef.current.goalY = 0;
      camSphericalRef.current.goalZ = 0;
      camSphericalRef.current.goalRadius = 260;
      onFovChange?.(55);
    }
  }, [resetPitchTrigger, onFovChange]);

  // Handle Focus in Map button from Right Inspector
  useEffect(() => {
    if (!orbitTargetNodeId) return;
    const targetNode = nodesRef.current.find((n) => n.id === orbitTargetNodeId);
    if (targetNode) {
      camSphericalRef.current.goalX = targetNode.x;
      camSphericalRef.current.goalY = targetNode.y;
      camSphericalRef.current.goalZ = targetNode.z;
      camSphericalRef.current.goalRadius = targetNode.isFocal ? 235 : 135;
    }
  }, [orbitTargetNodeId]);

  const handleZoomStep = useCallback(
    (delta: number) => {
      camSphericalRef.current.goalRadius = Math.max(
        75,
        Math.min(520, camSphericalRef.current.goalRadius + delta)
      );
      const nextFov = Math.max(
        35,
        Math.min(
          75,
          Math.round(35 + (camSphericalRef.current.goalRadius / 520) * 35)
        )
      );
      onFovChange?.(nextFov);
    },
    [onFovChange]
  );

  /**
   * Determines whether a link should be highlighted when `activeHoverId` is hovered.
   */
  const isLinkIlluminated = useCallback(
    (link: GraphLink, activeHoverId: string | null): boolean => {
      if (!activeHoverId) return true;
      if (link.source === activeHoverId || link.target === activeHoverId) {
        return true;
      }
      const hoveredNode = nodesRef.current.find((n) => n.id === activeHoverId);
      if (
        focalItem &&
        hoveredNode &&
        (hoveredNode.type === 'MOVIE' || hoveredNode.type === 'TV') &&
        !hoveredNode.isFocal
      ) {
        const sharedEntityIds = new Set(
          hoveredNode.similarity?.sharedConnections
            .map((c) => c.entityNodeId)
            .filter(Boolean)
        );
        if (
          (sharedEntityIds.has(link.source) &&
            (link.target === activeHoverId || link.target === focalItem.id)) ||
          (sharedEntityIds.has(link.target) &&
            (link.source === activeHoverId || link.source === focalItem.id))
        ) {
          return true;
        }
      }
      return false;
    },
    [focalItem]
  );

  // ==================== 3D WEBGL SCENE EFFECT ====================
  useEffect(() => {
    if (viewMode !== '3D') return;
    const container = containerRef.current;
    if (!container) return;

    const simNodes: GraphNode[] = nodes.map((n) => ({ ...n }));
    nodesRef.current = simNodes;
    linksRef.current = links;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf6f1e7, 0.0014);

    const camera = new THREE.PerspectiveCamera(55, width / height, 1, 2200);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Warm Daylight Gallery Lighting
    const ambientLight = new THREE.AmbientLight(0xfffdf9, 2.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff8eb, 1.5);
    dirLight.position.set(140, 200, 180);
    scene.add(dirLight);

    const pointLightWarm = new THREE.PointLight(0xd48324, 1.1, 700);
    pointLightWarm.position.set(120, 140, 160);
    scene.add(pointLightWarm);

    const pointLightPrussian = new THREE.PointLight(0x234b6e, 0.9, 700);
    pointLightPrussian.position.set(-150, -110, -130);
    scene.add(pointLightPrussian);

    // Subtle Archival Pigment Motes
    const starCount = 420;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const palette = [
      new THREE.Color('#B8292F'),
      new THREE.Color('#234B6E'),
      new THREE.Color('#B86B14'),
      new THREE.Color('#8F816B'),
    ];
    for (let i = 0; i < starCount; i++) {
      const r = 180 + Math.random() * 520;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
      const c = palette[i % palette.length];
      starColors[i * 3] = c.r;
      starColors[i * 3 + 1] = c.g;
      starColors[i * 3 + 2] = c.b;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(starPositions, 3)
    );
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.7,
      vertexColors: true,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // Engraved Meridian Rings around Selected Title (0,0,0)
    const orbitRadii = [72, 120, 168];
    const orbitRingsGroup = new THREE.Group();
    orbitRadii.forEach((rad, i) => {
      const ringGeo = new THREE.RingGeometry(rad - 0.4, rad + 0.4, 96);
      const ringMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xb8292f : i === 1 ? 0x234b6e : 0x8f816b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      orbitRingsGroup.add(ringMesh);
    });
    scene.add(orbitRingsGroup);

    // Create Node Meshes & Groups
    const nodeGroupsMap = new Map<string, THREE.Group>();
    const pickableMeshes: THREE.Object3D[] = [];
    let focalWireframeMesh: THREE.Mesh | null = null;
    let focalOrbitalRing1: THREE.Mesh | null = null;
    let focalOrbitalRing2: THREE.Mesh | null = null;

    simNodes.forEach((node) => {
      const group = new THREE.Group();
      group.position.set(node.x, node.y, node.z);

      let coreGeo: THREE.BufferGeometry;
      if (node.isFocal) {
        coreGeo = new THREE.SphereGeometry(node.radius, 36, 36);
      } else if (node.type === 'MOVIE') {
        coreGeo = new THREE.SphereGeometry(node.radius, 28, 28);
      } else if (node.type === 'TV') {
        coreGeo = new THREE.BoxGeometry(
          node.radius * 1.35,
          node.radius * 1.35,
          node.radius * 1.35
        );
      } else if (node.type === 'DIRECTOR') {
        coreGeo = new THREE.DodecahedronGeometry(node.radius * 1.15, 0);
      } else if (node.type === 'ACTOR') {
        coreGeo = new THREE.OctahedronGeometry(node.radius * 1.1, 0);
      } else if (node.type === 'TROPE') {
        coreGeo = new THREE.IcosahedronGeometry(node.radius * 1.1, 0);
      } else {
        coreGeo = new THREE.TorusGeometry(
          node.radius * 0.85,
          node.radius * 0.32,
          14,
          32
        );
      }

      const coreMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(node.color),
        emissive: new THREE.Color(node.color),
        emissiveIntensity: node.isFocal ? 0.28 : 0.14,
        roughness: 0.35,
        metalness: 0.12,
        clearcoat: 0.45,
        transparent: true,
        opacity: 0.96,
      });

      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.userData = { nodeId: node.id };
      group.add(coreMesh);
      pickableMeshes.push(coreMesh);

      // TV Series get an outer plum meridian ring
      if (node.type === 'TV' && !node.isFocal) {
        const tvRingGeo = new THREE.TorusGeometry(
          node.radius * 1.45,
          0.35,
          12,
          48
        );
        const tvRingMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(node.color),
          transparent: true,
          opacity: 0.5,
        });
        const tvRing = new THREE.Mesh(tvRingGeo, tvRingMat);
        tvRing.rotation.x = Math.PI / 3;
        group.add(tvRing);
      }

      // Selected Title gets an engraved armillary sphere & dual brass/crimson rings
      if (node.isFocal) {
        const wireGeo = new THREE.IcosahedronGeometry(node.radius * 1.65, 1);
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0xb8292f,
          wireframe: true,
          transparent: true,
          opacity: 0.32,
        });
        focalWireframeMesh = new THREE.Mesh(wireGeo, wireMat);
        group.add(focalWireframeMesh);

        const orb1Geo = new THREE.TorusGeometry(
          node.radius * 2.15,
          0.38,
          16,
          72
        );
        const orb1Mat = new THREE.MeshBasicMaterial({
          color: 0xb8292f,
          transparent: true,
          opacity: 0.55,
        });
        focalOrbitalRing1 = new THREE.Mesh(orb1Geo, orb1Mat);
        focalOrbitalRing1.rotation.x = Math.PI / 2.4;
        group.add(focalOrbitalRing1);

        const orb2Geo = new THREE.TorusGeometry(
          node.radius * 2.55,
          0.28,
          16,
          72
        );
        const orb2Mat = new THREE.MeshBasicMaterial({
          color: 0xb86b14,
          transparent: true,
          opacity: 0.42,
        });
        focalOrbitalRing2 = new THREE.Mesh(orb2Geo, orb2Mat);
        focalOrbitalRing2.rotation.y = Math.PI / 3;
        group.add(focalOrbitalRing2);
      }

      const labelSprite = createLabelSprite(node);
      group.add(labelSprite);

      scene.add(group);
      nodeGroupsMap.set(node.id, group);
    });

    // Create 3D Links
    interface LinkRenderEntry {
      link: GraphLink;
      line: THREE.Line;
      material: THREE.LineBasicMaterial;
      geometry: THREE.BufferGeometry;
    }

    const linkEntries: LinkRenderEntry[] = [];
    links.forEach((link) => {
      const positions = new Float32Array(6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const isDirect = link.kind === 'SIMILARITY_DIRECT';
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(link.color),
        transparent: true,
        opacity: isDirect ? 0.52 : 0.28,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      linkEntries.push({ link, line, material: mat, geometry: geo });
    });

    // Pointer / Raycasting state
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let isDragging = false;
    let dragMoved = false;
    let prevX = 0;
    let prevY = 0;

    const onPointerDown = (e: MouseEvent) => {
      isDragging = true;
      dragMoved = false;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onPointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      if (isDragging) {
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          dragMoved = true;
        }
        prevX = e.clientX;
        prevY = e.clientY;

        if (cameraModeRef.current === 'FREE_LOOK' || e.shiftKey) {
          camSphericalRef.current.goalX -= dx * 0.35;
          camSphericalRef.current.goalY += dy * 0.35;
        } else {
          camSphericalRef.current.theta -= dx * 0.0065;
          camSphericalRef.current.phi = Math.max(
            0.22,
            Math.min(Math.PI - 0.22, camSphericalRef.current.phi - dy * 0.0065)
          );
        }
        return;
      }

      pointer.x = (localX / rect.width) * 2 - 1;
      pointer.y = -(localY / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const intersects = raycaster.intersectObjects(pickableMeshes, false);
      if (intersects.length > 0) {
        const hitId = intersects[0].object.userData?.nodeId as string;
        const hitNode = simNodes.find((n) => n.id === hitId) || null;
        renderer.domElement.style.cursor = 'pointer';
        if (hitNode) {
          hoveredIdRef.current = hitNode.id;
          setHoveredNodeId(hitNode.id);
          setHoveredTooltip({
            node: hitNode,
            x: localX,
            y: localY,
          });
        }
      } else {
        renderer.domElement.style.cursor = 'grab';
        if (hoveredIdRef.current !== null) {
          hoveredIdRef.current = null;
          setHoveredNodeId(null);
          setHoveredTooltip(null);
        }
      }
    };

    const onPointerUp = (e: MouseEvent) => {
      if (!isDragging) return;
      isDragging = false;
      if (dragMoved) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const intersects = raycaster.intersectObjects(pickableMeshes, false);
      if (intersects.length > 0) {
        const hitId = intersects[0].object.userData?.nodeId as string;
        const hitNode = simNodes.find((n) => n.id === hitId);
        if (hitNode) {
          onSelectNode(hitNode);
          camSphericalRef.current.goalX = hitNode.x * 0.45;
          camSphericalRef.current.goalY = hitNode.y * 0.45;
          camSphericalRef.current.goalZ = hitNode.z * 0.45;
        }
      }
    };

    const onDoubleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const intersects = raycaster.intersectObjects(pickableMeshes, false);
      if (intersects.length > 0) {
        const hitId = intersects[0].object.userData?.nodeId as string;
        const hitNode = simNodes.find((n) => n.id === hitId);
        if (
          hitNode &&
          (hitNode.type === 'MOVIE' || hitNode.type === 'TV') &&
          hitNode.mediaItem
        ) {
          onMakeFocal(hitNode.mediaItem.id);
          camSphericalRef.current.goalX = 0;
          camSphericalRef.current.goalY = 0;
          camSphericalRef.current.goalZ = 0;
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      handleZoomStep(e.deltaY * 0.22);
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    domElem.addEventListener('dblclick', onDoubleClick);
    domElem.addEventListener('wheel', onWheel, { passive: false });

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // 3D Force-Directed Layout & Render Loop
    let frameId = 0;
    let clock = 0;
    const nodeIndexMap = new Map<string, GraphNode>();
    simNodes.forEach((n) => nodeIndexMap.set(n.id, n));

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      clock += 0.016;

      const fSettings = forceRef.current;

      for (let i = 0; i < simNodes.length; i++) {
        const nA = simNodes[i];
        if (nA.isFocal) {
          nA.x = 0;
          nA.y = 0;
          nA.z = 0;
          continue;
        }

        if ((nA.type === 'MOVIE' || nA.type === 'TV') && nA.similarity) {
          const targetR =
            nA.similarity.linkDistance * fSettings.linkDistanceMultiplier;
          const curR =
            Math.sqrt(nA.x * nA.x + nA.y * nA.y + nA.z * nA.z) || 1;
          const radialDelta =
            (targetR - curR) * 0.032 * fSettings.sphericalForce;
          nA.vx += (nA.x / curR) * radialDelta;
          nA.vy += (nA.y / curR) * radialDelta;
          nA.vz += (nA.z / curR) * radialDelta;
        }

        for (let j = i + 1; j < simNodes.length; j++) {
          const nB = simNodes[j];
          const dx = nA.x - nB.x;
          const dy = nA.y - nB.y;
          const dz = nA.z - nB.z;
          const distSq = dx * dx + dy * dy + dz * dz + 1;
          if (distSq < 3600) {
            const force = (28 * fSettings.sphericalForce) / distSq;
            nA.vx += dx * force;
            nA.vy += dy * force;
            nA.vz += dz * force * fSettings.zRepulsion;
            if (!nB.isFocal) {
              nB.vx -= dx * force;
              nB.vy -= dy * force;
              nB.vz -= dz * force * fSettings.zRepulsion;
            }
          }
        }
      }

      for (const node of simNodes) {
        if (
          node.type !== 'MOVIE' &&
          node.type !== 'TV' &&
          node.connectedMediaIds.length > 0
        ) {
          let cx = 0;
          let cy = 0;
          let cz = 0;
          let cnt = 0;
          for (const mId of node.connectedMediaIds) {
            const mNode = nodeIndexMap.get(mId);
            if (mNode) {
              cx += mNode.x;
              cy += mNode.y;
              cz += mNode.z;
              cnt++;
            }
          }
          if (cnt > 0) {
            cx /= cnt;
            cy /= cnt;
            cz /= cnt;
            const norm = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
            const targetX = cx + (cx / norm) * 24;
            const targetY = cy + (cy / norm) * 24;
            const targetZ = (cz + (cz / norm) * 24) * fSettings.zRepulsion;
            node.vx += (targetX - node.x) * 0.04;
            node.vy += (targetY - node.y) * 0.04;
            node.vz += (targetZ - node.z) * 0.04;
          }
        }
      }

      const activeHover = hoveredIdRef.current;
      const activeSelected = selectedIdRef.current;

      for (const node of simNodes) {
        if (!node.isFocal) {
          node.vx *= 0.82;
          node.vy *= 0.82;
          node.vz *= 0.82;
          node.x += node.vx;
          node.y += node.vy;
          node.z += node.vz;
        }

        const grp = nodeGroupsMap.get(node.id);
        if (grp) {
          grp.position.set(node.x, node.y, node.z);

          const isHighlighted =
            node.id === activeHover ||
            node.id === activeSelected ||
            node.isFocal;
          const targetScale =
            node.id === activeHover
              ? 1.25
              : node.id === activeSelected
                ? 1.14
                : 1.0;
          grp.scale.lerp(
            new THREE.Vector3(targetScale, targetScale, targetScale),
            0.15
          );

          const mesh = grp.children[0] as THREE.Mesh;
          if (mesh && mesh.material instanceof THREE.MeshPhysicalMaterial) {
            if (!activeHover) {
              mesh.material.opacity = 0.96;
              mesh.material.emissiveIntensity = node.isFocal ? 0.28 : 0.14;
            } else {
              const connectedToHover =
                isHighlighted ||
                node.connectedMediaIds.includes(activeHover) ||
                linksRef.current.some(
                  (l) =>
                    isLinkIlluminated(l, activeHover) &&
                    (l.source === node.id || l.target === node.id)
                );
              mesh.material.opacity = connectedToHover ? 1.0 : 0.24;
              mesh.material.emissiveIntensity = connectedToHover ? 0.35 : 0.05;
            }
          }
        }
      }

      for (const entry of linkEntries) {
        const src = nodeIndexMap.get(entry.link.source);
        const tgt = nodeIndexMap.get(entry.link.target);
        if (!src || !tgt) continue;

        const posAttr = entry.geometry.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        posAttr.setXYZ(0, src.x, src.y, src.z);
        posAttr.setXYZ(1, tgt.x, tgt.y, tgt.z);
        posAttr.needsUpdate = true;

        if (!activeHover) {
          entry.material.opacity =
            entry.link.kind === 'SIMILARITY_DIRECT' ? 0.5 : 0.26;
        } else {
          const lit = isLinkIlluminated(entry.link, activeHover);
          entry.material.opacity = lit ? 0.92 : 0.06;
        }
      }

      if (focalWireframeMesh) {
        const pulse = 1 + Math.sin(clock * 2.2) * 0.05;
        focalWireframeMesh.scale.set(pulse, pulse, pulse);
        focalWireframeMesh.rotation.y += 0.006;
        focalWireframeMesh.rotation.x += 0.003;
      }
      if (focalOrbitalRing1) {
        focalOrbitalRing1.rotation.z += 0.009;
      }
      if (focalOrbitalRing2) {
        focalOrbitalRing2.rotation.x -= 0.007;
        focalOrbitalRing2.rotation.y += 0.005;
      }

      starField.rotation.y += 0.00025;

      const camState = camSphericalRef.current;
      if (cameraModeRef.current === 'FLY_THROUGH' && !isDragging) {
        camState.flyTimer += 0.016;
        const mediaNodes = simNodes.filter(
          (n) => n.type === 'MOVIE' || n.type === 'TV'
        );
        if (mediaNodes.length > 0) {
          if (camState.flyTimer > 4.2) {
            camState.flyTimer = 0;
            camState.flyIndex = (camState.flyIndex + 1) % mediaNodes.length;
          }
          const flyTarget = mediaNodes[camState.flyIndex];
          if (flyTarget) {
            camState.goalX = flyTarget.x;
            camState.goalY = flyTarget.y;
            camState.goalZ = flyTarget.z;
            camState.goalRadius = 125;
            camState.theta += 0.0045;
          }
        }
      } else if (autoRotateRef.current && !isDragging && !activeHover) {
        camState.theta += 0.002;
      }

      camState.radius += (camState.goalRadius - camState.radius) * 0.08;
      camState.targetX += (camState.goalX - camState.targetX) * 0.08;
      camState.targetY += (camState.goalY - camState.targetY) * 0.08;
      camState.targetZ += (camState.goalZ - camState.targetZ) * 0.08;

      const camX =
        camState.targetX +
        camState.radius * Math.sin(camState.phi) * Math.sin(camState.theta);
      const camY =
        camState.targetY + camState.radius * Math.cos(camState.phi);
      const camZ =
        camState.targetZ +
        camState.radius * Math.sin(camState.phi) * Math.cos(camState.theta);

      camera.position.set(camX, camY, camZ);
      camera.lookAt(camState.targetX, camState.targetY, camState.targetZ);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      domElem.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      domElem.removeEventListener('dblclick', onDoubleClick);
      domElem.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, [
    viewMode,
    nodes,
    links,
    onSelectNode,
    onMakeFocal,
    handleZoomStep,
    isLinkIlluminated,
  ]);

  // ==================== 2D CANVAS GRAPH EFFECT ====================
  useEffect(() => {
    if (viewMode !== '2D') return;
    const canvas = canvas2dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const simNodes: GraphNode[] = nodes.map((n) => ({
      ...n,
      x: n.x * 1.35,
      y: n.y * 1.35,
    }));
    nodesRef.current = simNodes;
    linksRef.current = links;

    let panX = 0;
    let panY = 0;
    let zoom = 1.05;
    let isDragging = false;
    let dragMoved = false;
    let lastX = 0;
    let lastY = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const screenToWorld = (sx: number, sy: number) => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      return {
        wx: (sx - cw / 2 - panX) / zoom,
        wy: (sy - ch / 2 - panY) / zoom,
      };
    };

    const findNodeAt = (sx: number, sy: number): GraphNode | null => {
      const { wx, wy } = screenToWorld(sx, sy);
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        const dx = wx - n.x;
        const dy = wy - n.y;
        const hitR = n.radius * 1.6 + 6;
        if (dx * dx + dy * dy <= hitR * hitR) return n;
      }
      return null;
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragMoved = false;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (isDragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved = true;
        panX += dx;
        panY += dy;
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }

      const hit = findNodeAt(sx, sy);
      if (hit) {
        canvas.style.cursor = 'pointer';
        hoveredIdRef.current = hit.id;
        setHoveredNodeId(hit.id);
        setHoveredTooltip({ node: hit, x: sx, y: sy });
      } else {
        canvas.style.cursor = 'grab';
        if (hoveredIdRef.current) {
          hoveredIdRef.current = null;
          setHoveredNodeId(null);
          setHoveredTooltip(null);
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!isDragging) return;
      isDragging = false;
      if (dragMoved) return;
      const rect = canvas.getBoundingClientRect();
      const hit = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (hit) onSelectNode(hit);
    };

    const onDblClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const hit = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (hit && hit.mediaItem) {
        onMakeFocal(hit.mediaItem.id);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom = Math.max(0.45, Math.min(2.6, zoom - e.deltaY * 0.0012));
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const nodeMap = new Map<string, GraphNode>();
    simNodes.forEach((n) => nodeMap.set(n.id, n));

    let animId = 0;
    let tick = 0;

    const render2D = () => {
      animId = requestAnimationFrame(render2D);
      tick += 0.02;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      ctx.clearRect(0, 0, cw, ch);

      ctx.save();
      ctx.translate(cw / 2 + panX, ch / 2 + panY);
      ctx.scale(zoom, zoom);

      // Engraved Concentric Kinship Rings
      const rings = [
        {
          r: 95,
          label: 'Close Kinship (90%+)',
          color: 'rgba(184, 41, 47, 0.22)',
        },
        {
          r: 165,
          label: 'Strong Connection (75%+)',
          color: 'rgba(35, 75, 110, 0.20)',
        },
        {
          r: 240,
          label: 'Shared Threads (50%+)',
          color: 'rgba(90, 82, 75, 0.22)',
        },
      ];
      for (const ring of rings) {
        ctx.beginPath();
        ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '600 10px "Source Sans 3", sans-serif';
        ctx.fillStyle = '#6B5E50';
        ctx.fillText(ring.label, 8, -ring.r + 13);
      }

      const activeHover = hoveredIdRef.current;

      // Draw Links
      for (const link of links) {
        const s = nodeMap.get(link.source);
        const t = nodeMap.get(link.target);
        if (!s || !t) continue;
        const lit = isLinkIlluminated(link, activeHover);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = link.color;
        ctx.globalAlpha = !activeHover
          ? link.kind === 'SIMILARITY_DIRECT'
            ? 0.45
            : 0.26
          : lit
            ? 0.92
            : 0.08;
        ctx.lineWidth = lit && activeHover ? 2.2 : 1.15;
        ctx.stroke();
      }

      // Draw Nodes
      for (const node of simNodes) {
        const isSelected = node.id === selectedIdRef.current;
        const isHovered = node.id === activeHover;
        ctx.globalAlpha = 1;

        if (node.isFocal) {
          ctx.beginPath();
          ctx.arc(
            node.x,
            node.y,
            node.radius * 1.85 + Math.sin(tick * 1.8) * 2.5,
            0,
            Math.PI * 2
          );
          ctx.strokeStyle = '#B8292F';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(
          node.x,
          node.y,
          node.radius * (isHovered ? 1.22 : isSelected ? 1.12 : 1),
          0,
          Math.PI * 2
        );
        ctx.fillStyle = node.color;
        ctx.shadowColor = 'rgba(23, 20, 18, 0.18)';
        ctx.shadowBlur = isHovered || node.isFocal ? 10 : 4;
        ctx.shadowOffsetY = 2;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Label
        ctx.font = `${node.isFocal ? '700 13px' : '600 11.5px'} "Spectral", Georgia, serif`;
        ctx.fillStyle = '#171412';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + node.radius + 14);

        if (
          (node.type === 'MOVIE' || node.type === 'TV') &&
          node.matchScore !== undefined &&
          !node.isFocal
        ) {
          ctx.font = '600 10px "Source Sans 3", sans-serif';
          ctx.fillStyle = node.matchScore >= 75 ? '#2A6B53' : '#234B6E';
          ctx.fillText(
            `${node.matchScore}% Match`,
            node.x,
            node.y + node.radius + 25
          );
        }
      }

      ctx.restore();
    };

    render2D();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [viewMode, nodes, links, onSelectNode, onMakeFocal, isLinkIlluminated]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* 3D WebGL Mount Container */}
      {viewMode === '3D' && (
        <div
          ref={containerRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          aria-label="Interactive 3D Film & Series Constellation Map"
        />
      )}

      {/* 2D Graph Canvas */}
      {viewMode === '2D' && (
        <canvas
          ref={canvas2dRef}
          className="w-full h-full block cursor-grab active:cursor-grabbing"
          aria-label="Interactive 2D Film & Series Map"
        />
      )}

      {/* Top-Left Curatorial Context Pill (Humanized — no fake coordinates or math formulas) */}
      <div className="pointer-events-none absolute top-4 left-4 flex flex-col gap-1.5 z-10">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#FBF8F2]/95 border border-[#C8BEAA] shadow-archival-sm text-xs text-[#171412]">
            <span
              className={`w-2 h-2 rounded-full ${
                focalItem ? 'bg-[#B8292F]' : 'bg-[#2A6B53]'
              }`}
            />
            <span className="text-[#52483E]">
              {focalItem ? 'Centered on:' : 'Archive Index:'}
            </span>
            <strong className="font-heading font-bold text-[#171412]">
              {focalItem
                ? `${focalItem.title} (${focalItem.year})`
                : `All ${nodes.filter((n) => n.type === 'MOVIE' || n.type === 'TV').length} Movies & TV Shows`}
            </strong>
          </div>
          {focalItem && onClearFocal && (
            <button
              type="button"
              onClick={onClearFocal}
              className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#EFE8DA] hover:bg-[#B8292F] text-[#171412] hover:text-[#FBF8F2] border border-[#B5A892] hover:border-[#8C1D22] shadow-archival-sm text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>Show All Graph Titles</span>
            </button>
          )}
        </div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#EFE8DA]/90 border border-[#D5CCB9] text-[11px] text-[#52483E]">
          <span>
            Click any title or collaborator to read notes · Double-click a title
            to center the map around it
          </span>
        </div>
      </div>

      {/* Active Hover Connection Banner */}
      {hoveredNodeId && hoveredTooltip && (
        <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-[#FBF8F2] border border-[#B5A892] shadow-archival flex items-center gap-2 text-xs">
          <span className="text-[#52483E]">Shared threads:</span>
          {focalItem && (
            <>
              <strong className="text-[#171412] font-semibold">
                {focalItem.title}
              </strong>
              <span className="text-[#8F816B]">&amp;</span>
            </>
          )}
          <strong className="text-[#B8292F] font-semibold">
            {hoveredTooltip.node.label}
          </strong>
          {hoveredTooltip.node.matchScore !== undefined &&
            !hoveredTooltip.node.isFocal && (
              <span className="px-1.5 py-0.5 rounded bg-[#E3EFEA] text-[#2A6B53] border border-[#B4D4C7] font-tabular font-bold">
                {hoveredTooltip.node.matchScore}% Match
              </span>
            )}
        </div>
      )}

      {/* Floating Archival Vellum Cursor Hover Tooltip */}
      {hoveredTooltip && (
        <div
          className="pointer-events-none absolute z-30 w-80 rounded-lg bg-[#FBF8F2] border border-[#B5A892] shadow-archival p-3.5 transition-opacity duration-150"
          style={{
            left: Math.min(
              (containerRef.current?.clientWidth || 900) - 340,
              Math.max(16, hoveredTooltip.x + 18)
            ),
            top: Math.min(
              (containerRef.current?.clientHeight || 700) - 220,
              Math.max(16, hoveredTooltip.y - 24)
            ),
          }}
        >
          {hoveredTooltip.node.mediaItem ? (
            <div className="flex gap-3">
              {/* Poster Thumbnail */}
              <div className="w-16 h-24 rounded-sm overflow-hidden shrink-0 border border-[#C8BEAA] bg-[#EFE8DA] relative">
                <img
                  src={hoveredTooltip.node.mediaItem.posterUrl}
                  alt={hoveredTooltip.node.mediaItem.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (hoveredTooltip.node.mediaItem) {
                      target.src = getPosterFallbackDataUri(
                        hoveredTooltip.node.mediaItem
                      );
                    }
                  }}
                />
              </div>

              <div className="flex-1 min-w-0">
                {/* Title Heading First (no kicker above h4) */}
                <div className="flex items-start justify-between gap-1.5">
                  <h4 className="font-heading text-base font-bold text-[#171412] truncate">
                    {hoveredTooltip.node.mediaItem.title}
                  </h4>

                  {hoveredTooltip.node.isFocal ? (
                    <span className="px-1.5 py-0.5 rounded bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6] text-[10px] font-semibold shrink-0">
                      Selected
                    </span>
                  ) : hoveredTooltip.node.matchScore !== undefined ? (
                    <span className="px-1.5 py-0.5 rounded bg-[#E3EFEA] text-[#2A6B53] border border-[#B4D4C7] text-[10px] font-tabular font-bold shrink-0">
                      {hoveredTooltip.node.matchScore}%
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-[#EFE8DA] text-[#52483E] border border-[#C8BEAA] text-[10px] font-semibold shrink-0">
                      {hoveredTooltip.node.mediaItem.primaryGenre}
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#52483E] mt-0.5 truncate">
                  {hoveredTooltip.node.mediaItem.mediaType === 'MOVIE' ? (
                    <Film className="w-3 h-3 inline mr-1 text-[#234B6E]" />
                  ) : (
                    <Tv className="w-3 h-3 inline mr-1 text-[#6B3A6E]" />
                  )}
                  {hoveredTooltip.node.mediaItem.year} ·{' '}
                  {hoveredTooltip.node.mediaItem.directors[0]}
                </p>

                {/* IMDb & Rotten Tomatoes Scores (no emoji) */}
                <div className="flex items-center gap-2.5 mt-2 text-xs font-tabular text-[#52483E]">
                  <span>
                    IMDb{' '}
                    <strong className="text-[#171412] font-bold">
                      {hoveredTooltip.node.mediaItem.imdbRating.toFixed(1)}
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    Critics{' '}
                    <strong className="text-[#8C1D22] font-bold">
                      {hoveredTooltip.node.mediaItem.rottenTomatoes}%
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Collaborator / Theme Node Tooltip (Heading first — no kicker above h4) */
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded flex items-center justify-center shrink-0 border border-[#C8BEAA] bg-[#EFE8DA]"
              >
                {hoveredTooltip.node.type === 'DIRECTOR' && (
                  <Award
                    className="w-5 h-5"
                    style={{ color: hoveredTooltip.node.color }}
                  />
                )}
                {hoveredTooltip.node.type === 'ACTOR' && (
                  <UserCheck
                    className="w-5 h-5"
                    style={{ color: hoveredTooltip.node.color }}
                  />
                )}
                {hoveredTooltip.node.type === 'TROPE' && (
                  <Hash
                    className="w-5 h-5"
                    style={{ color: hoveredTooltip.node.color }}
                  />
                )}
                {hoveredTooltip.node.type === 'COMPOSER' && (
                  <Music
                    className="w-5 h-5"
                    style={{ color: hoveredTooltip.node.color }}
                  />
                )}
              </div>
              <div>
                <h4 className="font-heading text-base font-bold text-[#171412]">
                  {hoveredTooltip.node.label}
                </h4>
                <p className="text-xs text-[#52483E] mt-0.5">
                  {hoveredTooltip.node.subLabel}
                </p>
              </div>
            </div>
          )}

          {/* Shared Connection Badges */}
          {hoveredTooltip.node.similarity &&
            hoveredTooltip.node.similarity.sharedConnections.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-[#D5CCB9]">
                <div className="text-[11px] font-medium text-[#52483E] mb-1">
                  {focalItem
                    ? `Shared with ${focalItem.title}:`
                    : 'Shared craft credits:'}
                </div>
                <div className="flex flex-wrap gap-1">
                  {hoveredTooltip.node.similarity.sharedConnections
                    .slice(0, 4)
                    .map((conn) => (
                      <span
                        key={conn.id}
                        className="px-1.5 py-0.5 rounded text-[11px] bg-[#EFE8DA] border border-[#D5CCB9] text-[#171412]"
                      >
                        <strong style={{ color: conn.color }}>
                          {conn.prefix}:
                        </strong>{' '}
                        {conn.value} (+{conn.points})
                      </span>
                    ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* Bottom Center Camera Dock */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#FBF8F2] border border-[#B5A892] shadow-archival">
        <button
          type="button"
          onClick={() => onCameraModeChange('ORBIT')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            cameraMode === 'ORBIT'
              ? 'bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6]'
              : 'text-[#52483E] hover:text-[#171412] hover:bg-[#EFE8DA]'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Orbit</span>
        </button>

        <button
          type="button"
          onClick={() => onCameraModeChange('FREE_LOOK')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            cameraMode === 'FREE_LOOK'
              ? 'bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6]'
              : 'text-[#52483E] hover:text-[#171412] hover:bg-[#EFE8DA]'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Pan</span>
        </button>

        <button
          type="button"
          onClick={() => onCameraModeChange('FLY_THROUGH')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            cameraMode === 'FLY_THROUGH'
              ? 'bg-[#F5E4E4] text-[#8C1D22] border border-[#D8B4B6]'
              : 'text-[#52483E] hover:text-[#171412] hover:bg-[#EFE8DA]'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Guided Tour</span>
        </button>

        <div className="h-4 w-px bg-[#D5CCB9] mx-1" />

        <button
          type="button"
          onClick={() => handleZoomStep(-35)}
          title="Zoom In (+)"
          className="p-1.5 rounded-full text-[#52483E] hover:text-[#171412] hover:bg-[#EFE8DA] transition-colors"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => handleZoomStep(35)}
          title="Zoom Out (-)"
          className="p-1.5 rounded-full text-[#52483E] hover:text-[#171412] hover:bg-[#EFE8DA] transition-colors"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-[#D5CCB9] mx-1" />

        <button
          type="button"
          onClick={() => {
            camSphericalRef.current.phi = Math.PI / 2.25;
            camSphericalRef.current.theta = 0.45;
            camSphericalRef.current.goalX = 0;
            camSphericalRef.current.goalY = 0;
            camSphericalRef.current.goalZ = 0;
            camSphericalRef.current.goalRadius = 265;
            onCameraModeChange('ORBIT');
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold text-[#52483E] hover:text-[#171412] hover:bg-[#EFE8DA] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#8C1D22]" />
          <span>Center View</span>
        </button>

        <button
          type="button"
          onClick={() => onAutoRotateChange(!autoRotate)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            autoRotate
              ? 'bg-[#E3EFEA] text-[#2A6B53] border border-[#B4D4C7]'
              : 'text-[#52483E] hover:text-[#171412] hover:bg-[#EFE8DA]'
          }`}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`}
            style={{ animationDuration: '8s' }}
          />
          <span>Gentle Spin</span>
        </button>
      </div>
    </div>
  );
}
