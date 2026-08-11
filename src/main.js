import './style.css';
import * as THREE from 'three';
import { GUI } from 'lil-gui';

const PI = Math.PI;

// --- 1. GUI Setup (アニメーション・自動消滅制御用に先に定義) ---
const gui = new GUI({ title: '海面＆光パラメータ設定' });
const guiElement = gui.domElement;
guiElement.style.transition = 'opacity 0.5s ease';

// --- 2. Cross-Browser Fullscreen Button Setup (iPad Safari / Chrome / Edge 対応) ---
const fullscreenBtn = document.createElement('button');
fullscreenBtn.innerText = '⛶ 全画面切替';
fullscreenBtn.style.cssText = `
  position: absolute;
  top: 15px;
  left: 15px;
  z-index: 9999;
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 8px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  user-select: none;
  -webkit-user-select: none;
  transition: opacity 0.5s ease;
`;
document.body.appendChild(fullscreenBtn);

let isPseudoFullscreen = false;

// 全画面状態かどうかを調べるクロスブラウザ判定
function getFullscreenElement() {
  return document.fullscreenElement ||
         document.webkitFullscreenElement ||
         document.mozFullScreenElement ||
         document.msFullscreenElement || null;
}

// 全画面化トグル処理（Chrome, Edge, iPad/iOS Safari 対応）
function toggleFullscreen(e) {
  if (e) e.stopPropagation();

  const docEl = document.documentElement;

  // 1. すでに全画面表示中の場合 -> 解除
  if (getFullscreenElement() || isPseudoFullscreen) {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    
    if (isPseudoFullscreen) {
      togglePseudoFullscreen(false);
    }
    return;
  }

  // 2. 通常表示からの全画面化呼び出し
  if (docEl.requestFullscreen) { // Chrome, Edge, Firefox, Mac Safari
    docEl.requestFullscreen().catch(() => {
      togglePseudoFullscreen(true);
    });
  } else if (docEl.webkitRequestFullscreen) { // iPad / iOS Safari
    try {
      docEl.webkitRequestFullscreen();
    } catch (err) {
      togglePseudoFullscreen(true);
    }
  } else if (docEl.mozRequestFullScreen) {
    docEl.mozRequestFullScreen();
  } else if (docEl.msRequestFullscreen) {
    docEl.msRequestFullscreen();
  } else {
    // API非対応環境へのフォールバック
    togglePseudoFullscreen(true);
  }
}

function togglePseudoFullscreen(enable) {
  isPseudoFullscreen = enable;
  if (isPseudoFullscreen) {
    document.body.style.position = 'fixed';
    document.body.style.top = '0';
    document.body.style.left = '0';
    document.body.style.width = '100vw';
    document.body.style.height = '100vh';
    document.body.style.zIndex = '9998';
  } else {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.body.style.zIndex = '';
  }
  setTimeout(onWindowResize, 100);
}

// フルスクリーン変化監視イベント
['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
  document.addEventListener(evt, () => {
    onWindowResize();
  });
});

// タップ/クリックで確実に発火するように設定
fullscreenBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
fullscreenBtn.addEventListener('click', toggleFullscreen);

// --- 3. UI 5秒自動消滅 & タップ復元ロジック ---
let uiTimer = null;

function showUI() {
  fullscreenBtn.style.opacity = '1';
  fullscreenBtn.style.pointerEvents = 'auto';
  guiElement.style.opacity = '1';
  guiElement.style.pointerEvents = 'auto';

  resetUITimer();
}

function hideUI() {
  fullscreenBtn.style.opacity = '0';
  fullscreenBtn.style.pointerEvents = 'none';
  guiElement.style.opacity = '0';
  guiElement.style.pointerEvents = 'none';
}

function resetUITimer() {
  if (uiTimer) clearTimeout(uiTimer);
  uiTimer = setTimeout(() => {
    hideUI();
  }, 5000); // 5秒
}

['pointerdown', 'pointermove', 'touchstart', 'touchmove'].forEach(eventType => {
  window.addEventListener(eventType, () => {
    showUI();
  }, { passive: true });
});

resetUITimer();

// --- 4. Scene & Camera ---
const scene = new THREE.Scene();
scene.background = new THREE.Color('#010d1a');

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 31, 0); 
camera.lookAt(0, 0, 0);

// --- 5. Renderer Setup ---
const renderer = new THREE.WebGLRenderer({ 
  antialias: true, 
  powerPreference: "high-performance" 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x000000, 1);
document.querySelector('#app').appendChild(renderer.domElement);

// --- 6. Seabed Mesh ---
const seabedGeometry = new THREE.PlaneGeometry(120, 120);
seabedGeometry.rotateX(-PI / 2);
const seabedMaterial = new THREE.MeshBasicMaterial({ color: 0x000810 });
const seabed = new THREE.Mesh(seabedGeometry, seabedMaterial);
seabed.position.y = -6.0;
scene.add(seabed);

// --- 7. Ocean Shaders ---
const oceanVertexShader = `
  uniform float uTime;
  uniform float uWaveHeight;
  uniform float uWaveSpeed;
  uniform float uOceanAngle;

  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec2 vWorldXZ;

  float gerstnerWave(vec2 position, float steepness, float wavelength, float speed, vec2 direction, float time) {
    float k = 2.0 * ${PI} / wavelength;
    float c = sqrt(9.8 / k);
    float a = steepness / k;
    float f = k * (dot(direction, position) - c * time * speed);
    return a * sin(f);
  }

  void main() {
    vUv = uv;
    vec3 p = position;
    vWorldXZ = p.xz;

    vec2 mainDir = vec2(sin(uOceanAngle), cos(uOceanAngle));
    vec2 crossDir1 = vec2(sin(uOceanAngle + 0.44), cos(uOceanAngle + 0.44));
    vec2 crossDir2 = vec2(sin(uOceanAngle - 0.61), cos(uOceanAngle - 0.61));

    float h = 0.0;
    h += gerstnerWave(p.xz, 0.35, 22.0, uWaveSpeed, mainDir, uTime);
    h += gerstnerWave(p.xz, 0.25, 11.0, uWaveSpeed * 1.15, crossDir1, uTime + 1.57);
    h += gerstnerWave(p.xz, 0.15, 5.5, uWaveSpeed * 1.3, crossDir2, uTime + 3.14);

    p.y += h * uWaveHeight;
    vPosition = p;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const oceanFragmentShader = `
  uniform vec3 uDepthColor;
  uniform vec3 uSurfaceColor;
  uniform float uWaterDepth;
  uniform float uTime;
  uniform float uWaveSpeed;
  uniform float uWaveScale;
  uniform vec3 uLightDir; 
  uniform vec2 uShipPos;
  uniform float uShipLength;
  uniform float uShipWidth;
  uniform float uShipAngle;
  uniform float uShipSpeed;
  uniform float uOceanAngle;
  uniform float uFresnelPower;
  uniform float uFresnelStrength;

  uniform float uOceanNoiseAmount;   
  uniform float uGlobalFoamAmount;   

  // 1. V字航跡
  uniform float uWakeAngle;          
  uniform float uWakeMaxSpread;      
  uniform float uWakeSaturateDist;  
  uniform float uWakeVNoise;         
  uniform float uWakeVOpacity;       
  uniform float uWakeBandWidth;      
  uniform float uWakeFadeDist;       

  // 2. スクリュー流
  uniform float uWashWidth;          
  uniform float uWashOpacity;        
  uniform float uWashNoise;          
  uniform float uWashFadeDist;       

  // 3. 船首しぶき
  uniform float uBowSplashWidth;     
  uniform float uBowSplashNoise;     
  uniform float uBowSplashOpacity;   

  // 4. 船体側面泡
  uniform float uBodyFoamWidth;      
  uniform float uBodyFoamNoise;      
  uniform float uBodyFoamOpacity;    

  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec2 vWorldXZ;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453123);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float f = 0.0;
    float amp = 0.5;
    for(int i = 0; i < 4; i++) {
      f += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return f;
  }

  float voronoi(vec2 x) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float md = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = hash2(n + g);
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < md) md = d;
      }
    }
    return sqrt(md);
  }

  float foamParticles(vec2 uv) {
    float v1 = voronoi(uv * 12.0);
    float v2 = voronoi(uv * 28.0 + vec2(5.2, 1.3));
    float cell1 = smoothstep(0.2, 0.6, v1);
    float cell2 = smoothstep(0.15, 0.55, v2);
    return mix(cell1, cell2, 0.4);
  }

  float getWaveDetail(vec2 p) {
    vec2 flowDir = vec2(sin(uOceanAngle), cos(uOceanAngle));
    vec2 dynamicUv = (p - flowDir * uTime * uWaveSpeed) * uWaveScale;
    vec2 animShift = vec2(sin(uTime * 0.8), cos(uTime * 0.6)) * 0.5;

    float detail = 0.0;
    detail += fbm(dynamicUv * 1.5 + animShift) * 0.55;
    detail += fbm(dynamicUv * 4.0 - animShift * 1.5 + vec2(15.3, 8.7)) * 0.25;
    detail += fbm(dynamicUv * 10.0 + vec2(2.4, 9.8)) * 0.12;
    detail += noise(dynamicUv * 25.0 + uTime * 0.5) * 0.08;

    return detail * uOceanNoiseAmount;
  }

  void main() {
    vec2 e = vec2(0.008, 0.0);
    float hL = getWaveDetail(vWorldXZ - e.xy);
    float hR = getWaveDetail(vWorldXZ + e.xy);
    float hD = getWaveDetail(vWorldXZ - e.yx);
    float hU = getWaveDetail(vWorldXZ + e.yx);

    vec3 normal = normalize(vec3(hL - hR, 0.06, hD - hU));

    float depthFactor = clamp((vPosition.y + uWaterDepth * 0.6) / (uWaterDepth + 0.3), 0.0, 1.0);
    vec3 waterColor = mix(uDepthColor, uSurfaceColor, depthFactor);

    vec3 lightDir = normalize(uLightDir);
    vec3 viewDir = normalize(vec3(0.0, 1.0, 0.0));

    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), uFresnelPower) * uFresnelStrength;
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 64.0) * 1.2; 
    
    vec2 pos = vWorldXZ - uShipPos;
    vec2 lPos;
    lPos.x = pos.x * cos(uShipAngle) - pos.y * sin(uShipAngle);
    lPos.y = pos.x * sin(uShipAngle) + pos.y * cos(uShipAngle);
    
    float localX = abs(lPos.x);
    float localZ = lPos.y; 
    float halfLen = uShipLength * 0.5;

    float bowZ = -halfLen; 
    float sternZ = halfLen; 
    float distFromBow = localZ - bowZ;

    // 1. V字航跡
    float activeDist = max(0.0, distFromBow);
    float satFactor = 1.0 - exp(-activeDist / max(0.1, uWakeSaturateDist));
    
    float vNoiseVal = (fbm(vec2(localX * 1.5, localZ * 0.4 - uTime * 0.6)) - 0.5) * uWakeVNoise;
    float vSpread = mix(activeDist * tan(uWakeAngle * 0.0174533), uWakeMaxSpread, satFactor) + vNoiseVal;
    
    float distAfterSat = max(0.0, activeDist - uWakeSaturateDist);
    float widthTaper = exp(-distAfterSat * 0.08); 
    float currentBandWidth = (uShipWidth * 0.3 * uWakeBandWidth + activeDist * 0.01) * widthTaper;
    currentBandWidth = max(0.02, currentBandWidth);

    float vArmsMask = smoothstep(vSpread + currentBandWidth, vSpread, localX) * 
                      smoothstep(vSpread - currentBandWidth * 0.6, vSpread, localX);
    
    vArmsMask *= smoothstep(0.0, 0.6, distFromBow);
    float vFadeOut = smoothstep(uWakeFadeDist, uWakeFadeDist * 0.2, activeDist);
    vArmsMask *= vFadeOut * uWakeVOpacity;

    // 2. スクリュー水流
    float distFromStern = localZ - sternZ;
    float sternWakeDist = max(0.0, distFromStern);
    
    vec2 washNoiseUv = vec2(lPos.x * 4.0, localZ * 0.8 - uTime * uWaveSpeed * 1.2);
    float washNoiseVal = fbm(washNoiseUv) * (1.0 + uWashNoise * voronoi(washNoiseUv * 2.5));
    
    float coreWidth = uShipWidth * 0.3 * uWashWidth + 0.05 * sternWakeDist;
    float coreWash = smoothstep(coreWidth, 0.0, localX);
    coreWash *= smoothstep(sternZ - 0.2, sternZ + 1.2, localZ);
    coreWash *= smoothstep(uWashFadeDist, uWashFadeDist * 0.1, sternWakeDist) * uWashOpacity;
    coreWash *= washNoiseVal;

    // 3. 船首しぶき泡
    float bowZoneMask = smoothstep(bowZ - 0.3, bowZ + 0.2, localZ) * smoothstep(bowZ + uShipLength * 0.35, bowZ + 0.4, localZ);
    float bowNoise = (fbm(vec2(localX * 4.0, localZ * 1.5 - uTime * 1.2)) - 0.5) * uBowSplashNoise * 0.4;
    float splashSpread = sqrt(max(0.0, distFromBow + 0.1)) * 0.55 * uBowSplashWidth + bowNoise;
    
    float bowSplashMask = smoothstep(splashSpread + 0.2, splashSpread * 0.2, localX);
    bowSplashMask *= bowZoneMask * uBowSplashOpacity;

    // 4. 船体側面の泡
    float bowBlockMask = smoothstep(0.2, 1.2, distFromBow);
    float bowTaper = smoothstep(0.2, 2.0, distFromBow);
    float sternTaper = 1.0 - smoothstep(uShipLength * 0.7, uShipLength * 1.2, distFromBow) * 0.5;
    
    float bodyNoise = (fbm(vec2(localX * 2.5, localZ * 0.8 - uTime * 0.8)) - 0.5) * uBodyFoamNoise * 0.3;
    float targetWidth = (uShipWidth * 0.5 * uBodyFoamWidth) * bowTaper * sternTaper + bodyNoise;
    targetWidth = max(0.01, targetWidth);

    float bodyFoamMask = smoothstep(targetWidth + 0.25, targetWidth * 0.1, localX);
    float sternTailFade = smoothstep(uShipLength * 1.6, sternZ, localZ);
    bodyFoamMask *= bowBlockMask * sternTailFade * uBodyFoamOpacity;

    // 5. 航跡用泡テクスチャ & ディゾルブ
    vec2 foamUv = vec2(lPos.x * 2.0, localZ * 0.3 - uTime * uWaveSpeed * 0.5);
    float cellularFoam = foamParticles(foamUv);

    vec2 dissolveUv = vWorldXZ * 1.2 - vec2(0.0, uTime * uWaveSpeed * 0.3);
    float dissolveNoise = fbm(dissolveUv);
    float dissolveFactor = smoothstep(0.1, 0.9, dissolveNoise + (activeDist / (uShipLength * 8.0)) * 0.5);
    
    float streakPattern = smoothstep(0.3, 0.85, fbm(foamUv * 1.8));
    float finalFoamTexture = mix(cellularFoam, streakPattern, 0.3) * (1.0 - dissolveFactor * 0.7);

    // 6. 海面全体の環境浮遊泡
    vec2 flowDir = vec2(sin(uOceanAngle), cos(uOceanAngle));
    vec2 globalFoamUv = (vWorldXZ - flowDir * uTime * (uWaveSpeed * 0.75)) * 0.8;
    
    float foamTimeNoise = fbm(vWorldXZ * 0.8 + vec2(uTime * 0.12, -uTime * 0.08));
    float dynamicVoronoi = voronoi(globalFoamUv * 5.0 + vec2(foamTimeNoise));
    
    float globalFoam = smoothstep(0.82 - uGlobalFoamAmount * 0.35, 0.95, dynamicVoronoi);
    globalFoam *= uGlobalFoamAmount * (0.6 + 0.4 * foamTimeNoise);

    float wakeMask = max(max(vArmsMask, coreWash), max(bowSplashMask, bodyFoamMask));
    wakeMask = clamp(wakeMask, 0.0, 1.0);

    float finalFoam = wakeMask * finalFoamTexture * 1.1;

    finalFoam = max(finalFoam, globalFoam);
    finalFoam = clamp(finalFoam, 0.0, 1.0);

    vec3 aeratedWaterColor = mix(waterColor, vec3(0.65, 0.90, 0.96), wakeMask * 0.55);
    vec3 foamColor = vec3(0.96, 0.98, 1.0);
    vec3 skyReflection = vec3(0.70, 0.86, 0.98);

    vec3 finalColor = mix(aeratedWaterColor, skyReflection, fresnel);
    finalColor += vec3(spec) * (1.0 - wakeMask * 0.5); 
    finalColor = mix(finalColor, foamColor, finalFoam);
    
    float alpha = clamp(uWaterDepth * 0.25 + 0.68, 0.75, 0.98);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// --- 8. Ocean Mesh Setup ---
const oceanGeometry = new THREE.PlaneGeometry(120, 120, 250, 250); 
oceanGeometry.rotateX(-PI / 2);

const oceanMaterial = new THREE.ShaderMaterial({
  vertexShader: oceanVertexShader,
  fragmentShader: oceanFragmentShader,
  uniforms: {
    uTime: { value: 0 },
    uWaveHeight: { value: 0.11 },
    uWaveSpeed: { value: 1.12 },    
    uWaveScale: { value: 1.39 },
    uWaterDepth: { value: 6.0 },
    uDepthColor: { value: new THREE.Color('#004466') }, 
    uSurfaceColor: { value: new THREE.Color('#00b4d8') }, 
    uLightDir: { value: new THREE.Vector3() }, 
    uShipPos: { value: new THREE.Vector2(0, 0) },
    uShipLength: { value: 14.9 },
    uShipWidth: { value: 1.8 },
    uShipAngle: { value: 1.568407 },
    uShipSpeed: { value: 1.0 },
    uOceanAngle: { value: 1.598407 },
    uFresnelPower: { value: 5.0 },
    uFresnelStrength: { value: 0.45 },
    uOceanNoiseAmount: { value: 0.85 },
    uGlobalFoamAmount: { value: 0.32 },
    uWakeAngle: { value: 3.0 },
    uWakeMaxSpread: { value: 4.5 },
    uWakeSaturateDist: { value: 15.5 },
    uWakeBandWidth: { value: 1.1 },
    uWakeFadeDist: { value: 29.0 },
    uWakeVNoise: { value: 1.25 },
    uWakeVOpacity: { value: 1.05 },
    uWashWidth: { value: 1.8 },
    uWashOpacity: { value: 1.45 },
    uWashNoise: { value: 1.6 },
    uWashFadeDist: { value: 40.0 },
    uBowSplashWidth: { value: 1.3 },
    uBowSplashNoise: { value: 0.85 },
    uBowSplashOpacity: { value: 1.6 },
    uBodyFoamWidth: { value: 1.3 },
    uBodyFoamNoise: { value: 1.0 },
    uBodyFoamOpacity: { value: 0.9 }
  },
  transparent: true,
  side: THREE.DoubleSide
});

const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
scene.add(ocean);

// --- 9. Parameters & Ship Guide Setup ---
const params = {
  preset: '遠洋・深海',
  showGuide: false,
  scale: 31,
  waterDepth: 6.0,
  surfaceColor: '#00b4d8',
  depthColor: '#004466',
  seabedColor: '#000810',
  waveHeight: 0.11,
  waveScale: 1.39,
  waveSpeed: 1.12,
  oceanAngle: 1.598407,
  oceanNoiseAmount: 0.85,
  globalFoamAmount: 0.32,
  wakeAngle: 3.0,
  wakeMaxSpread: 4.5,
  wakeSaturateDist: 15.5,
  wakeBandWidth: 1.1,
  wakeFadeDist: 29.0,
  wakeVNoise: 1.25,
  wakeVOpacity: 1.05,
  washWidth: 1.8,
  washOpacity: 1.45,
  washNoise: 1.6,
  washFadeDist: 40.0,
  bowSplashWidth: 1.3,
  bowSplashNoise: 0.85,
  bowSplashOpacity: 1.6,
  bodyFoamWidth: 1.3,
  bodyFoamNoise: 1.0,
  bodyFoamOpacity: 0.9,
  lightAzimuth: 108, 
  lightElevation: 56, 
  shipLength: 14.9,
  shipWidth: 1.8,
  shipAngle: 1.568407,
  shipSpeed: 1.0,
  shipPosX: 0.0,
  shipPosY: 0.0
};

let shipGuide = null;

function createShipGuide(length, width) {
  if (shipGuide) {
    scene.remove(shipGuide);
    shipGuide.geometry.dispose();
    shipGuide.material.dispose();
  }

  const shape = new THREE.Shape();
  const hL = length * 0.5;
  const hW = width * 0.5;
  shape.moveTo(0, -hL); 
  shape.bezierCurveTo(hW * 1.2, -hL * 0.5, hW, hL * 0.5, 0, hL); 
  shape.bezierCurveTo(-hW, hL * 0.5, -hW * 1.2, -hL * 0.5, 0, -hL); 

  const points = shape.getPoints(50);
  const points3D = points.map(p => new THREE.Vector3(p.x, 0.1, p.y));

  const geo = new THREE.BufferGeometry().setFromPoints(points3D);
  const mat = new THREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 2 });
  
  shipGuide = new THREE.LineLoop(geo, mat);
  shipGuide.rotation.y = params.shipAngle;
  shipGuide.position.set(params.shipPosX, 0, params.shipPosY);
  shipGuide.visible = params.showGuide;
  scene.add(shipGuide);
}

createShipGuide(params.shipLength, params.shipWidth);

function updateLightDir() {
  const az = params.lightAzimuth * PI / 180;
  const el = params.lightElevation * PI / 180;
  const x = Math.cos(el) * Math.sin(az);
  const y = Math.sin(el);
  const z = Math.cos(el) * Math.cos(az);
  oceanMaterial.uniforms.uLightDir.value.set(x, y, z).normalize();
}
updateLightDir();

function updateShipPosition(x, z) {
  params.shipPosX = x;
  params.shipPosY = z;
  oceanMaterial.uniforms.uShipPos.value.set(x, z);
  if (shipGuide) {
    shipGuide.position.set(x, 0, z);
  }
}

// --- 10. タップ / スワイプ（ドラッグ）船移動制御 (iPad対応) ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let isDragging = false;

function getIntersectPosition(clientX, clientY) {
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersectPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(dragPlane, intersectPoint);
  return intersectPoint;
}

function handlePointerDown(e) {
  if (e.target.closest('.lil-gui') || e.target === fullscreenBtn) return;
  isDragging = true;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const pos = getIntersectPosition(clientX, clientY);
  if (pos) updateShipPosition(pos.x, pos.z);
}

function handlePointerMove(e) {
  if (!isDragging) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const pos = getIntersectPosition(clientX, clientY);
  if (pos) updateShipPosition(pos.x, pos.z);
}

function handlePointerUp() {
  isDragging = false;
}

window.addEventListener('mousedown', handlePointerDown);
window.addEventListener('mousemove', handlePointerMove);
window.addEventListener('mouseup', handlePointerUp);

window.addEventListener('touchstart', handlePointerDown, { passive: false });
window.addEventListener('touchmove', handlePointerMove, { passive: false });
window.addEventListener('touchend', handlePointerUp);

// --- 11. GUI Folders Setup ---
gui.add(params, 'preset', ['南国・浅瀬', '遠洋・深海']).name('プリセット').onChange(v => {
  if (v === '南国・浅瀬') {
    params.surfaceColor = '#00f0d4';
    params.depthColor = '#0083b0';
    params.seabedColor = '#fdf0d5';
    params.waterDepth = 1.8;
    params.waveHeight = 0.08;
    params.waveScale = 1.8;
    params.waveSpeed = 0.45;
    params.lightAzimuth = 134;
    params.lightElevation = 70;
    scene.background.set('#005f73');
  } else {
    params.surfaceColor = '#00b4d8';
    params.depthColor = '#004466';
    params.seabedColor = '#000810';
    params.waterDepth = 6.0;
    params.waveHeight = 0.11;
    params.waveScale = 1.39;
    params.waveSpeed = 1.12;
    params.oceanAngle = 1.598407;
    params.oceanNoiseAmount = 0.85;
    params.globalFoamAmount = 0.32;
    params.wakeAngle = 3.0;
    params.wakeMaxSpread = 4.5;
    params.wakeSaturateDist = 15.5;
    params.wakeBandWidth = 1.1;
    params.wakeFadeDist = 29.0;
    params.wakeVNoise = 1.25;
    params.wakeVOpacity = 1.05;
    params.washWidth = 1.8;
    params.washOpacity = 1.45;
    params.washNoise = 1.6;
    params.washFadeDist = 40.0;
    params.bowSplashWidth = 1.3;
    params.bowSplashNoise = 0.85;
    params.bowSplashOpacity = 1.6;
    params.bodyFoamWidth = 1.3;
    params.bodyFoamNoise = 1.0;
    params.bodyFoamOpacity = 0.9;
    params.lightAzimuth = 108;
    params.lightElevation = 56;
    scene.background.set('#010d1a');
  }

  oceanMaterial.uniforms.uSurfaceColor.value.set(params.surfaceColor);
  oceanMaterial.uniforms.uDepthColor.value.set(params.depthColor);
  seabedMaterial.color.set(params.seabedColor);
  oceanMaterial.uniforms.uWaterDepth.value = params.waterDepth;
  oceanMaterial.uniforms.uWaveHeight.value = params.waveHeight;
  oceanMaterial.uniforms.uWaveScale.value = params.waveScale;
  oceanMaterial.uniforms.uWaveSpeed.value = params.waveSpeed;
  oceanMaterial.uniforms.uOceanAngle.value = params.oceanAngle;
  oceanMaterial.uniforms.uOceanNoiseAmount.value = params.oceanNoiseAmount;
  oceanMaterial.uniforms.uGlobalFoamAmount.value = params.globalFoamAmount;
  oceanMaterial.uniforms.uWakeAngle.value = params.wakeAngle;
  oceanMaterial.uniforms.uWakeMaxSpread.value = params.wakeMaxSpread;
  oceanMaterial.uniforms.uWakeSaturateDist.value = params.wakeSaturateDist;
  oceanMaterial.uniforms.uWakeBandWidth.value = params.wakeBandWidth;
  oceanMaterial.uniforms.uWakeFadeDist.value = params.wakeFadeDist;
  oceanMaterial.uniforms.uWakeVNoise.value = params.wakeVNoise;
  oceanMaterial.uniforms.uWakeVOpacity.value = params.wakeVOpacity;
  oceanMaterial.uniforms.uWashWidth.value = params.washWidth;
  oceanMaterial.uniforms.uWashOpacity.value = params.washOpacity;
  oceanMaterial.uniforms.uWashNoise.value = params.washNoise;
  oceanMaterial.uniforms.uWashFadeDist.value = params.washFadeDist;
  oceanMaterial.uniforms.uBowSplashWidth.value = params.bowSplashWidth;
  oceanMaterial.uniforms.uBowSplashNoise.value = params.bowSplashNoise;
  oceanMaterial.uniforms.uBowSplashOpacity.value = params.bowSplashOpacity;
  oceanMaterial.uniforms.uBodyFoamWidth.value = params.bodyFoamWidth;
  oceanMaterial.uniforms.uBodyFoamNoise.value = params.bodyFoamNoise;
  oceanMaterial.uniforms.uBodyFoamOpacity.value = params.bodyFoamOpacity;
  
  seabed.position.y = -params.waterDepth;
  updateLightDir();
  gui.controllers.forEach(c => c.updateDisplay());
});

gui.add(params, 'showGuide').name('船体ガイド表示(緑線)').onChange(v => {
  if (shipGuide) shipGuide.visible = v;
});

gui.add(params, 'scale', 10, 100, 0.5).name('スケール(カメラ距離)').onChange(v => camera.position.y = v);
gui.add(params, 'waterDepth', 0.1, 15.0, 0.1).name('水深').onChange(v => {
  oceanMaterial.uniforms.uWaterDepth.value = v;
  seabed.position.y = -v;
});

gui.addColor(params, 'surfaceColor').name('水の色(浅瀬)').onChange(v => oceanMaterial.uniforms.uSurfaceColor.value.set(v));
gui.addColor(params, 'depthColor').name('水の色(深海)').onChange(v => oceanMaterial.uniforms.uDepthColor.value.set(v));
gui.addColor(params, 'seabedColor').name('海底の色').onChange(v => seabedMaterial.color.set(v));

const waveFolder = gui.addFolder('海面波・全体ノイズ設定');
waveFolder.add(params, 'waveHeight', 0.0, 2.0, 0.01).name('大波の高さ').onChange(v => oceanMaterial.uniforms.uWaveHeight.value = v);
waveFolder.add(params, 'waveScale', 0.1, 5.0, 0.01).name('波の細かさ').onChange(v => oceanMaterial.uniforms.uWaveScale.value = v);
waveFolder.add(params, 'waveSpeed', 0.0, 5.0, 0.01).name('流速').onChange(v => oceanMaterial.uniforms.uWaveSpeed.value = v);
waveFolder.add(params, 'oceanAngle', -PI, PI, 0.01).name('海流方向').onChange(v => oceanMaterial.uniforms.uOceanAngle.value = v);
waveFolder.add(params, 'oceanNoiseAmount', 0.0, 3.0, 0.05).name('小波のノイズ量(起伏)').onChange(v => oceanMaterial.uniforms.uOceanNoiseAmount.value = v);
waveFolder.add(params, 'globalFoamAmount', 0.0, 1.0, 0.02).name('海面全体の浮遊泡').onChange(v => oceanMaterial.uniforms.uGlobalFoamAmount.value = v);

const vWakeFolder = gui.addFolder('1. V字航跡(ハの字波)設定');
vWakeFolder.add(params, 'wakeAngle', 2.0, 45.0, 0.5).name('展開角度(度)').onChange(v => oceanMaterial.uniforms.uWakeAngle.value = v);
vWakeFolder.add(params, 'wakeMaxSpread', 1.0, 25.0, 0.1).name('最大幅(飽和)').onChange(v => oceanMaterial.uniforms.uWakeMaxSpread.value = v);
vWakeFolder.add(params, 'wakeSaturateDist', 2.0, 40.0, 0.5).name('飽和距離').onChange(v => oceanMaterial.uniforms.uWakeSaturateDist.value = v);
vWakeFolder.add(params, 'wakeBandWidth', 0.1, 5.0, 0.1).name('V字波の太さ(幅)').onChange(v => oceanMaterial.uniforms.uWakeBandWidth.value = v);
vWakeFolder.add(params, 'wakeFadeDist', 5.0, 100.0, 1.0).name('V字波の減衰距離').onChange(v => oceanMaterial.uniforms.uWakeFadeDist.value = v);
vWakeFolder.add(params, 'wakeVNoise', 0.0, 2.0, 0.05).name('V字波ノイズ(荒さ)').onChange(v => oceanMaterial.uniforms.uWakeVNoise.value = v);
vWakeFolder.add(params, 'wakeVOpacity', 0.0, 3.0, 0.05).name('V字波の濃さ').onChange(v => oceanMaterial.uniforms.uWakeVOpacity.value = v);

const washFolder = gui.addFolder('2. 中央スクリュー流設定');
washFolder.add(params, 'washWidth', 0.1, 5.0, 0.1).name('流速幅').onChange(v => oceanMaterial.uniforms.uWashWidth.value = v);
washFolder.add(params, 'washOpacity', 0.0, 3.0, 0.05).name('水流の濃さ').onChange(v => oceanMaterial.uniforms.uWashOpacity.value = v);
washFolder.add(params, 'washNoise', 0.0, 3.0, 0.1).name('水流ノイズ(乱れ)').onChange(v => oceanMaterial.uniforms.uWashNoise.value = v);
washFolder.add(params, 'washFadeDist', 5.0, 150.0, 1.0).name('水流の減衰距離').onChange(v => oceanMaterial.uniforms.uWashFadeDist.value = v);

const bowFolder = gui.addFolder('3. 船首のしぶき設定');
bowFolder.add(params, 'bowSplashWidth', 0.1, 3.0, 0.1).name('しぶきの幅').onChange(v => oceanMaterial.uniforms.uBowSplashWidth.value = v);
bowFolder.add(params, 'bowSplashNoise', 0.0, 2.0, 0.05).name('しぶきノイズ').onChange(v => oceanMaterial.uniforms.uBowSplashNoise.value = v);
bowFolder.add(params, 'bowSplashOpacity', 0.0, 3.0, 0.05).name('しぶきの濃さ').onChange(v => oceanMaterial.uniforms.uBowSplashOpacity.value = v);

const bodyFolder = gui.addFolder('4. 船体側面の泡設定');
bodyFolder.add(params, 'bodyFoamWidth', 0.1, 3.0, 0.1).name('側面の泡幅').onChange(v => oceanMaterial.uniforms.uBodyFoamWidth.value = v);
bodyFolder.add(params, 'bodyFoamNoise', 0.0, 2.0, 0.05).name('泡ノイズ').onChange(v => oceanMaterial.uniforms.uBodyFoamNoise.value = v);
bodyFolder.add(params, 'bodyFoamOpacity', 0.0, 3.0, 0.05).name('側面の泡の濃さ').onChange(v => oceanMaterial.uniforms.uBodyFoamOpacity.value = v);

const lightFolder = gui.addFolder('光の設定');
lightFolder.add(params, 'lightAzimuth', 0, 360, 1).name('方位角').onChange(updateLightDir);
lightFolder.add(params, 'lightElevation', 0, 90, 1).name('仰角').onChange(updateLightDir);

const shipFolder = gui.addFolder('船・プラモデル設定');
shipFolder.add(params, 'shipLength', 2.0, 20.0, 0.1).name('船の長さ').onChange(v => {
  oceanMaterial.uniforms.uShipLength.value = v;
  createShipGuide(v, params.shipWidth);
});
shipFolder.add(params, 'shipWidth', 0.5, 5.0, 0.1).name('船の幅').onChange(v => {
  oceanMaterial.uniforms.uShipWidth.value = v;
  createShipGuide(params.shipLength, v);
});
shipFolder.add(params, 'shipAngle', -PI, PI, 0.01).name('船の向き(角度)').onChange(v => {
  oceanMaterial.uniforms.uShipAngle.value = v;
  if (shipGuide) shipGuide.rotation.y = v; 
});
shipFolder.add(params, 'shipSpeed', 0.0, 5.0, 0.1).name('船速').onChange(v => {
  oceanMaterial.uniforms.uShipSpeed.value = v;
});

// --- 12. Animation Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  oceanMaterial.uniforms.uTime.value = clock.getElapsedTime();
  renderer.render(scene, camera);
}
animate();

// --- 13. Window Resize Handler ---
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);