import './style.css';
import * as THREE from 'three';
import { GUI } from 'lil-gui';

const PI = Math.PI;
const STORAGE_KEY = 'ocean_app_preset_params';

// --- 1. GUI Setup ---
const gui = new GUI({ title: '海面＆光パラメータ設定' });
const guiElement = gui.domElement;
guiElement.style.transition = 'opacity 0.5s ease';

// --- 2. Cross-Browser Fullscreen Button Setup ---
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

function getFullscreenElement() {
  return document.fullscreenElement ||
         document.webkitFullscreenElement ||
         document.mozFullScreenElement ||
         document.msFullscreenElement || null;
}

function toggleFullscreen(e) {
  if (e) e.stopPropagation();

  const docEl = document.documentElement;

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

  if (docEl.requestFullscreen) {
    docEl.requestFullscreen().catch(() => {
      togglePseudoFullscreen(true);
    });
  } else if (docEl.webkitRequestFullscreen) {
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

['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
  document.addEventListener(evt, () => {
    onWindowResize();
  });
});

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
  }, 5000);
}

['pointerdown', 'pointermove', 'touchstart', 'touchmove'].forEach(eventType => {
  window.addEventListener(eventType, () => {
    showUI();
  }, { passive: true });
});

resetUITimer();

// --- 4. Parameters Setup ---
const defaultParams = {
  preset: '遠洋・深海',
  showGuide: false,
  scale: 25,
  waterDepth: 6.0,
  surfaceColor: '#00b4d8',
  depthColor: '#004466',
  seabedColor: '#000810',
  waveHeight: 0.11,
  waveScale: 1.13,
  waveSpeed: 1.12,
  oceanAngle: 1.598407,
  oceanNoiseAmount: 0.6,
  globalFoamAmount: 0.34,
  wakeAngle: 3.0,
  wakeMaxSpread: 4.5,
  wakeSaturateDist: 15.5,
  wakeBandWidth: 1.1,
  wakeFadeDist: 29.0,
  wakeVNoise: 1.25,
  wakeVOpacity: 1.0,
  washWidth: 1.8,
  washOpacity: 0.8,
  washNoise: 2.4,
  washFadeDist: 65.0,
  bowSplashWidth: 1.6,
  bowSplashNoise: 0.85,
  bowSplashOpacity: 1.6,
  bodyFoamWidth: 1.1,
  bodyFoamNoise: 0.8,
  bodyFoamOpacity: 0.9,
  lightAzimuth: 76,
  lightElevation: 41,
  shipLength: 14.9,
  shipWidth: 1.8,
  shipAngle: 1.568407,
  shipSpeed: 1.0,
  shipPosX: 0.0,
  shipPosY: 0.0
};

// localStorage から保存済みパラメータを読み込み
let savedParams = null;
try {
  const localData = localStorage.getItem(STORAGE_KEY);
  if (localData) {
    savedParams = JSON.parse(localData);
  }
} catch (e) {
  console.warn('localStorage read error:', e);
}

const params = Object.assign({}, defaultParams, savedParams);

// --- 5. Scene & Camera ---
const scene = new THREE.Scene();
scene.background = new THREE.Color('#010d1a');

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, params.scale, 0);
camera.lookAt(0, 0, 0);

// --- 6. Renderer Setup ---
const renderer = new THREE.WebGLRenderer({ 
  antialias: true, 
  powerPreference: "high-performance" 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x000000, 1);
document.querySelector('#app').appendChild(renderer.domElement);

// --- 7. Seabed Mesh ---
const seabedGeometry = new THREE.PlaneGeometry(120, 120);
seabedGeometry.rotateX(-PI / 2);
const seabedMaterial = new THREE.MeshBasicMaterial({ color: params.seabedColor });
const seabed = new THREE.Mesh(seabedGeometry, seabedMaterial);
seabed.position.y = -params.waterDepth;
scene.add(seabed);

// --- 8. Ocean Shaders ---
const oceanVertexShader = `
  uniform float uTime;
  uniform float uWaveHeight;
  uniform float uWaveSpeed;
  uniform float uOceanAngle;

  uniform vec2 uShipPos;
  uniform float uShipLength;
  uniform float uShipWidth;
  uniform float uShipAngle;
  uniform float uWakeAngle;
  uniform float uWakeMaxSpread;
  uniform float uWakeSaturateDist;

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

    vec2 pos = p.xz - uShipPos;
    vec2 lPos;
    lPos.x = pos.x * cos(uShipAngle) - pos.y * sin(uShipAngle);
    lPos.y = pos.x * sin(uShipAngle) + pos.y * cos(uShipAngle);

    float activeDist = max(0.0, lPos.y - (-uShipLength * 0.5));
    float satFactor = 1.0 - exp(-activeDist / max(0.1, uWakeSaturateDist));
    float vSpread = mix(activeDist * tan(uWakeAngle * 0.0174533), uWakeMaxSpread, satFactor);
    float wakeWaveElevation = exp(-abs(abs(lPos.x) - vSpread) * 2.0) * smoothstep(0.0, 2.0, activeDist) * exp(-activeDist * 0.04);

    p.y += (h * uWaveHeight) + (wakeWaveElevation * 0.25);
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

  float highResFoam(vec2 uv) {
    float v1 = voronoi(uv * 20.0);
    float v2 = voronoi(uv * 48.0 + vec2(3.1, 7.4));
    float foamCore = smoothstep(0.45, 0.08, v1);
    float foamDetail = smoothstep(0.38, 0.05, v2);
    return mix(foamCore, foamDetail, 0.4);
  }

  float getFoamSample(vec2 lPos, vec2 vWorldXZ, float activeDist) {
    vec2 foamUv = vec2(lPos.x * 2.2, lPos.y * 0.35 - uTime * uWaveSpeed * 0.5);
    vec2 warp = vec2(fbm(foamUv * 2.0 + vec2(0.0, uTime * 0.2)), fbm(foamUv * 2.0 + vec2(3.2, -uTime * 0.2))) * 0.3;
    vec2 warpedUv = foamUv + warp;

    float cellFoam = highResFoam(warpedUv);
    float streakPattern = smoothstep(0.2, 0.85, fbm(warpedUv * 2.2));
    float foamTex = mix(cellFoam, streakPattern, 0.25);

    float dissolveNoise = fbm(vWorldXZ * 1.4 - vec2(0.0, uTime * uWaveSpeed * 0.3));
    float dissolveFactor = smoothstep(0.05, 0.95, dissolveNoise + (activeDist / (uShipLength * 6.5)) * 0.6);
    return foamTex * (1.0 - dissolveFactor * 0.8);
  }

  void main() {
    // 1. 海面法線
    vec2 e = vec2(0.008, 0.0);
    float hL = getWaveDetail(vWorldXZ - e.xy);
    float hR = getWaveDetail(vWorldXZ + e.xy);
    float hD = getWaveDetail(vWorldXZ - e.yx);
    float hU = getWaveDetail(vWorldXZ + e.yx);
    vec3 baseNormal = normalize(vec3(hL - hR, 0.06, hD - hU));

    // 2. 船体ローカル座標計算
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
    float activeDist = max(0.0, distFromBow);

    // 3. マスク計算
    float satFactor = 1.0 - exp(-activeDist / max(0.1, uWakeSaturateDist));
    float vNoiseVal = (fbm(vec2(localX * 1.8, localZ * 0.5 - uTime * 0.6)) - 0.5) * uWakeVNoise;
    float vSpread = mix(activeDist * tan(uWakeAngle * 0.0174533), uWakeMaxSpread, satFactor) + vNoiseVal;
    
    float distAfterSat = max(0.0, activeDist - uWakeSaturateDist);
    float widthTaper = exp(-distAfterSat * 0.08); 
    float currentBandWidth = max(0.02, (uShipWidth * 0.3 * uWakeBandWidth + activeDist * 0.01) * widthTaper);

    float vArmsMask = smoothstep(vSpread + currentBandWidth, vSpread, localX) * smoothstep(vSpread - currentBandWidth * 0.6, vSpread, localX);
    vArmsMask *= smoothstep(0.0, 0.6, distFromBow) * smoothstep(uWakeFadeDist, uWakeFadeDist * 0.2, activeDist) * uWakeVOpacity;

    float sternWakeDist = max(0.0, localZ - sternZ);
    float washSpread = uShipWidth * 0.35 * uWashWidth + sternWakeDist * 0.06;
    vec2 washNoiseUv = vec2(lPos.x * 3.5, localZ * 0.7 - uTime * uWaveSpeed * 1.3);
    float washNoiseVal = fbm(washNoiseUv) * (1.0 + uWashNoise * voronoi(washNoiseUv * 2.0));
    
    float coreWash = smoothstep(washSpread, 0.0, localX);
    coreWash *= smoothstep(sternZ - 0.2, sternZ + 0.8, localZ);
    coreWash *= smoothstep(uWashFadeDist, uWashFadeDist * 0.1, sternWakeDist) * uWashOpacity * washNoiseVal;

    float bowZoneMask = smoothstep(bowZ - 0.3, bowZ + 0.2, localZ) * smoothstep(bowZ + uShipLength * 0.35, bowZ + 0.4, localZ);
    float bowNoise = (fbm(vec2(localX * 4.0, localZ * 1.5 - uTime * 1.2)) - 0.5) * uBowSplashNoise * 0.4;
    float bowSplashMask = smoothstep(sqrt(max(0.0, distFromBow + 0.1)) * 0.55 * uBowSplashWidth + bowNoise + 0.2, (sqrt(max(0.0, distFromBow + 0.1)) * 0.55 * uBowSplashWidth + bowNoise) * 0.2, localX) * bowZoneMask * uBowSplashOpacity;

    float bodyNoise = (fbm(vec2(localX * 2.5, localZ * 0.8 - uTime * 0.8)) - 0.5) * uBodyFoamNoise * 0.3;
    float bodyFoamMask = smoothstep(max(0.01, (uShipWidth * 0.5 * uBodyFoamWidth) * smoothstep(0.2, 2.0, distFromBow) * (1.0 - smoothstep(uShipLength * 0.7, uShipLength * 1.2, distFromBow) * 0.5) + bodyNoise) + 0.25, max(0.01, (uShipWidth * 0.5 * uBodyFoamWidth) * smoothstep(0.2, 2.0, distFromBow) * (1.0 - smoothstep(uShipLength * 0.7, uShipLength * 1.2, distFromBow) * 0.5) + bodyNoise) * 0.1, localX) * smoothstep(0.2, 1.2, distFromBow) * smoothstep(uShipLength * 1.6, sternZ, localZ) * uBodyFoamOpacity;

    float wakeMask = clamp(max(max(vArmsMask, coreWash), max(bowSplashMask, bodyFoamMask)), 0.0, 1.0);

    // 4. 泡の疑似法線 (Normal Bump)
    float fCenter = getFoamSample(lPos, vWorldXZ, activeDist);
    float fRight  = getFoamSample(lPos + vec2(0.04, 0.0), vWorldXZ + vec2(0.04, 0.0), activeDist);
    float fUp     = getFoamSample(lPos + vec2(0.0, 0.04), vWorldXZ + vec2(0.0, 0.04), activeDist);
    
    vec3 foamNormalLocal = normalize(vec3((fCenter - fRight) * 3.0, 0.1, (fCenter - fUp) * 3.0));
    vec3 finalNormal = normalize(mix(baseNormal, foamNormalLocal, wakeMask * 0.85));

    // 5. ライティング
    vec3 lightDir = normalize(uLightDir);
    vec3 viewDir = normalize(vec3(0.0, 1.0, 0.0));

    float foamDiff = max(dot(finalNormal, lightDir), 0.0);

    float depthFactor = clamp((vPosition.y + uWaterDepth * 0.6) / (uWaterDepth + 0.3), 0.0, 1.0);
    vec3 waterColor = mix(uDepthColor, uSurfaceColor, depthFactor);

    float fresnel = pow(1.0 - max(dot(viewDir, finalNormal), 0.0), uFresnelPower) * uFresnelStrength;
    vec3 reflectDir = reflect(-lightDir, finalNormal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 64.0) * 1.2; 

    // 6. カラー合成
    float finalFoamIntensity = wakeMask * fCenter * 1.35;
    
    vec3 foamBaseColor = vec3(0.98, 0.99, 1.0);
    vec3 foamShadowColor = mix(uSurfaceColor, vec3(0.40, 0.55, 0.68), 0.7);
    vec3 litFoamColor = mix(foamShadowColor, foamBaseColor, 0.2 + 0.8 * foamDiff);

    vec3 aeratedWaterColor = mix(waterColor, vec3(0.60, 0.88, 0.96), wakeMask * 0.6);
    vec3 finalColor = mix(aeratedWaterColor, vec3(0.70, 0.86, 0.98), fresnel);
    finalColor += vec3(spec) * (1.0 - wakeMask * 0.5); 
    
    finalColor = mix(finalColor, litFoamColor, clamp(finalFoamIntensity, 0.0, 1.0));

    float alpha = clamp(uWaterDepth * 0.25 + 0.68, 0.75, 0.98);
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// --- 9. Ocean Mesh Setup ---
const oceanGeometry = new THREE.PlaneGeometry(120, 120, 250, 250); 
oceanGeometry.rotateX(-PI / 2);

const oceanMaterial = new THREE.ShaderMaterial({
  vertexShader: oceanVertexShader,
  fragmentShader: oceanFragmentShader,
  uniforms: {
    uTime: { value: 0 },
    uWaveHeight: { value: params.waveHeight },
    uWaveSpeed: { value: params.waveSpeed },    
    uWaveScale: { value: params.waveScale },
    uWaterDepth: { value: params.waterDepth },
    uDepthColor: { value: new THREE.Color(params.depthColor) }, 
    uSurfaceColor: { value: new THREE.Color(params.surfaceColor) }, 
    uLightDir: { value: new THREE.Vector3() }, 
    uShipPos: { value: new THREE.Vector2(params.shipPosX, params.shipPosY) },
    uShipLength: { value: params.shipLength },
    uShipWidth: { value: params.shipWidth },
    uShipAngle: { value: params.shipAngle },
    uShipSpeed: { value: params.shipSpeed },
    uOceanAngle: { value: params.oceanAngle },
    uFresnelPower: { value: 5.0 },
    uFresnelStrength: { value: 0.45 },
    uOceanNoiseAmount: { value: params.oceanNoiseAmount },
    uGlobalFoamAmount: { value: params.globalFoamAmount },
    uWakeAngle: { value: params.wakeAngle },
    uWakeMaxSpread: { value: params.wakeMaxSpread },
    uWakeSaturateDist: { value: params.wakeSaturateDist },
    uWakeBandWidth: { value: params.wakeBandWidth },
    uWakeFadeDist: { value: params.wakeFadeDist },
    uWakeVNoise: { value: params.wakeVNoise },
    uWakeVOpacity: { value: params.wakeVOpacity },
    uWashWidth: { value: params.washWidth },
    uWashOpacity: { value: params.washOpacity },
    uWashNoise: { value: params.washNoise },
    uWashFadeDist: { value: params.washFadeDist },
    uBowSplashWidth: { value: params.bowSplashWidth },
    uBowSplashNoise: { value: params.bowSplashNoise },
    uBowSplashOpacity: { value: params.bowSplashOpacity },
    uBodyFoamWidth: { value: params.bodyFoamWidth },
    uBodyFoamNoise: { value: params.bodyFoamNoise },
    uBodyFoamOpacity: { value: params.bodyFoamOpacity }
  },
  transparent: true,
  side: THREE.DoubleSide
});

const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
scene.add(ocean);

// --- 10. Ship Guide Setup ---
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

function updateAllUniforms() {
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
  oceanMaterial.uniforms.uShipLength.value = params.shipLength;
  oceanMaterial.uniforms.uShipWidth.value = params.shipWidth;
  oceanMaterial.uniforms.uShipAngle.value = params.shipAngle;
  oceanMaterial.uniforms.uShipSpeed.value = params.shipSpeed;
  
  seabed.position.y = -params.waterDepth;
  camera.position.y = params.scale;
  updateLightDir();
  updateShipPosition(params.shipPosX, params.shipPosY);
  createShipGuide(params.shipLength, params.shipWidth);
}

// 自動保存関数 (localStorage)
function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch (e) {
    console.warn('localStorage save error:', e);
  }
}

// --- 11. タップ / スワイプ 船移動制御 ---
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
  if (pos) {
    updateShipPosition(pos.x, pos.z);
    saveToLocalStorage();
  }
}

function handlePointerMove(e) {
  if (!isDragging) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const pos = getIntersectPosition(clientX, clientY);
  if (pos) updateShipPosition(pos.x, pos.z);
}

function handlePointerUp() {
  if (isDragging) {
    saveToLocalStorage();
  }
  isDragging = false;
}

window.addEventListener('mousedown', handlePointerDown);
window.addEventListener('mousemove', handlePointerMove);
window.addEventListener('mouseup', handlePointerUp);

window.addEventListener('touchstart', handlePointerDown, { passive: false });
window.addEventListener('touchmove', handlePointerMove, { passive: false });
window.addEventListener('touchend', handlePointerUp);

// --- 12. GUI Setup & Folders ---

// 設定保存・管理フォルダ
const storageFolder = gui.addFolder('💾 設定の保存と復元');
const storageActions = {
  save: () => {
    saveToLocalStorage();
    alert('現在の設定値をブラウザに保存しました。');
  },
  reset: () => {
    if (confirm('初期設定（デフォルト値）に戻しますか？')) {
      localStorage.removeItem(STORAGE_KEY);
      Object.assign(params, defaultParams);
      updateAllUniforms();
      gui.controllers.forEach(c => c.updateDisplay());
      gui.folders.forEach(f => f.controllers.forEach(c => c.updateDisplay()));
    }
  },
  exportJson: () => {
    const jsonStr = JSON.stringify(params, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      alert('パラメータJSONをクリップボードにコピーしました。');
    }).catch(() => {
      prompt('以下のJSONをコピーしてください:', jsonStr);
    });
  }
};

storageFolder.add(storageActions, 'save').name('現在の設定を保存');
storageFolder.add(storageActions, 'reset').name('デフォルトに戻す');
storageFolder.add(storageActions, 'exportJson').name('JSON出力(コピー)');

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
    params.waveScale = 1.13;
    params.waveSpeed = 1.12;
    params.oceanAngle = 1.598407;
    params.oceanNoiseAmount = 0.6;
    params.globalFoamAmount = 0.34;
    params.wakeAngle = 3.0;
    params.wakeMaxSpread = 4.5;
    params.wakeSaturateDist = 15.5;
    params.wakeBandWidth = 1.1;
    params.wakeFadeDist = 29.0;
    params.wakeVNoise = 1.25;
    params.wakeVOpacity = 1.0;
    params.washWidth = 1.8;
    params.washOpacity = 0.8;
    params.washNoise = 2.4;
    params.washFadeDist = 65.0;
    params.bowSplashWidth = 1.6;
    params.bowSplashNoise = 0.85;
    params.bowSplashOpacity = 1.6;
    params.bodyFoamWidth = 1.1;
    params.bodyFoamNoise = 0.8;
    params.bodyFoamOpacity = 0.9;
    params.lightAzimuth = 76;
    params.lightElevation = 41;
    scene.background.set('#010d1a');
  }

  updateAllUniforms();
  saveToLocalStorage();
  gui.controllers.forEach(c => c.updateDisplay());
  gui.folders.forEach(f => f.controllers.forEach(c => c.updateDisplay()));
});

gui.add(params, 'showGuide').name('船体ガイド表示(緑線)').onChange(v => {
  if (shipGuide) shipGuide.visible = v;
  saveToLocalStorage();
});

gui.add(params, 'scale', 10, 100, 0.5).name('スケール(カメラ距離)').onChange(v => {
  camera.position.y = v;
  saveToLocalStorage();
});

gui.add(params, 'waterDepth', 0.1, 15.0, 0.1).name('水深').onChange(v => {
  oceanMaterial.uniforms.uWaterDepth.value = v;
  seabed.position.y = -v;
  saveToLocalStorage();
});

gui.addColor(params, 'surfaceColor').name('水の色(浅瀬)').onChange(v => {
  oceanMaterial.uniforms.uSurfaceColor.value.set(v);
  saveToLocalStorage();
});
gui.addColor(params, 'depthColor').name('水の色(深海)').onChange(v => {
  oceanMaterial.uniforms.uDepthColor.value.set(v);
  saveToLocalStorage();
});
gui.addColor(params, 'seabedColor').name('海底の色').onChange(v => {
  seabedMaterial.color.set(v);
  saveToLocalStorage();
});

const waveFolder = gui.addFolder('海面波・全体ノイズ設定');
waveFolder.add(params, 'waveHeight', 0.0, 2.0, 0.01).name('大波の高さ').onChange(v => { oceanMaterial.uniforms.uWaveHeight.value = v; saveToLocalStorage(); });
waveFolder.add(params, 'waveScale', 0.1, 5.0, 0.01).name('波の細かさ').onChange(v => { oceanMaterial.uniforms.uWaveScale.value = v; saveToLocalStorage(); });
waveFolder.add(params, 'waveSpeed', 0.0, 5.0, 0.01).name('流速').onChange(v => { oceanMaterial.uniforms.uWaveSpeed.value = v; saveToLocalStorage(); });
waveFolder.add(params, 'oceanAngle', -PI, PI, 0.01).name('海流方向').onChange(v => { oceanMaterial.uniforms.uOceanAngle.value = v; saveToLocalStorage(); });
waveFolder.add(params, 'oceanNoiseAmount', 0.0, 3.0, 0.05).name('小波のノイズ量(起伏)').onChange(v => { oceanMaterial.uniforms.uOceanNoiseAmount.value = v; saveToLocalStorage(); });
waveFolder.add(params, 'globalFoamAmount', 0.0, 1.0, 0.02).name('海面全体の浮遊泡').onChange(v => { oceanMaterial.uniforms.uGlobalFoamAmount.value = v; saveToLocalStorage(); });

const vWakeFolder = gui.addFolder('1. V字航跡(ハの字波)設定');
vWakeFolder.add(params, 'wakeAngle', 2.0, 45.0, 0.5).name('展開角度(度)').onChange(v => { oceanMaterial.uniforms.uWakeAngle.value = v; saveToLocalStorage(); });
vWakeFolder.add(params, 'wakeMaxSpread', 1.0, 25.0, 0.1).name('最大幅(飽和)').onChange(v => { oceanMaterial.uniforms.uWakeMaxSpread.value = v; saveToLocalStorage(); });
vWakeFolder.add(params, 'wakeSaturateDist', 2.0, 40.0, 0.5).name('飽和距離').onChange(v => { oceanMaterial.uniforms.uWakeSaturateDist.value = v; saveToLocalStorage(); });
vWakeFolder.add(params, 'wakeBandWidth', 0.1, 5.0, 0.1).name('V字波の太さ(幅)').onChange(v => { oceanMaterial.uniforms.uWakeBandWidth.value = v; saveToLocalStorage(); });
vWakeFolder.add(params, 'wakeFadeDist', 5.0, 100.0, 1.0).name('V字波の減衰距離').onChange(v => { oceanMaterial.uniforms.uWakeFadeDist.value = v; saveToLocalStorage(); });
vWakeFolder.add(params, 'wakeVNoise', 0.0, 2.0, 0.05).name('V字波ノイズ(荒さ)').onChange(v => { oceanMaterial.uniforms.uWakeVNoise.value = v; saveToLocalStorage(); });
vWakeFolder.add(params, 'wakeVOpacity', 0.0, 3.0, 0.05).name('V字波の濃さ').onChange(v => { oceanMaterial.uniforms.uWakeVOpacity.value = v; saveToLocalStorage(); });

const washFolder = gui.addFolder('2. 中央スクリュー流設定');
washFolder.add(params, 'washWidth', 0.1, 5.0, 0.1).name('流速幅').onChange(v => { oceanMaterial.uniforms.uWashWidth.value = v; saveToLocalStorage(); });
washFolder.add(params, 'washOpacity', 0.0, 3.0, 0.05).name('水流の濃さ').onChange(v => { oceanMaterial.uniforms.uWashOpacity.value = v; saveToLocalStorage(); });
washFolder.add(params, 'washNoise', 0.0, 3.0, 0.1).name('水流ノイズ(乱れ)').onChange(v => { oceanMaterial.uniforms.uWashNoise.value = v; saveToLocalStorage(); });
washFolder.add(params, 'washFadeDist', 5.0, 150.0, 1.0).name('水流の減衰距離').onChange(v => { oceanMaterial.uniforms.uWashFadeDist.value = v; saveToLocalStorage(); });

const bowFolder = gui.addFolder('3. 船首のしぶき設定');
bowFolder.add(params, 'bowSplashWidth', 0.1, 3.0, 0.1).name('しぶきの幅').onChange(v => { oceanMaterial.uniforms.uBowSplashWidth.value = v; saveToLocalStorage(); });
bowFolder.add(params, 'bowSplashNoise', 0.0, 2.0, 0.05).name('しぶきノイズ').onChange(v => { oceanMaterial.uniforms.uBowSplashNoise.value = v; saveToLocalStorage(); });
bowFolder.add(params, 'bowSplashOpacity', 0.0, 3.0, 0.05).name('しぶきの濃さ').onChange(v => { oceanMaterial.uniforms.uBowSplashOpacity.value = v; saveToLocalStorage(); });

const bodyFolder = gui.addFolder('4. 船体側面の泡設定');
bodyFolder.add(params, 'bodyFoamWidth', 0.1, 3.0, 0.1).name('側面の泡幅').onChange(v => { oceanMaterial.uniforms.uBodyFoamWidth.value = v; saveToLocalStorage(); });
bodyFolder.add(params, 'bodyFoamNoise', 0.0, 2.0, 0.05).name('泡ノイズ').onChange(v => { oceanMaterial.uniforms.uBodyFoamNoise.value = v; saveToLocalStorage(); });
bodyFolder.add(params, 'bodyFoamOpacity', 0.0, 3.0, 0.05).name('側面の泡の濃さ').onChange(v => { oceanMaterial.uniforms.uBodyFoamOpacity.value = v; saveToLocalStorage(); });

const lightFolder = gui.addFolder('光の設定');
lightFolder.add(params, 'lightAzimuth', 0, 360, 1).name('方位角').onChange(() => { updateLightDir(); saveToLocalStorage(); });
lightFolder.add(params, 'lightElevation', 0, 90, 1).name('仰角').onChange(() => { updateLightDir(); saveToLocalStorage(); });

const shipFolder = gui.addFolder('船・プラモデル設定');
shipFolder.add(params, 'shipLength', 2.0, 20.0, 0.1).name('船の長さ').onChange(v => {
  oceanMaterial.uniforms.uShipLength.value = v;
  createShipGuide(v, params.shipWidth);
  saveToLocalStorage();
});
shipFolder.add(params, 'shipWidth', 0.5, 5.0, 0.1).name('船の幅').onChange(v => {
  oceanMaterial.uniforms.uShipWidth.value = v;
  createShipGuide(params.shipLength, v);
  saveToLocalStorage();
});
shipFolder.add(params, 'shipAngle', -PI, PI, 0.01).name('船の向き(角度)').onChange(v => {
  oceanMaterial.uniforms.uShipAngle.value = v;
  if (shipGuide) shipGuide.rotation.y = v; 
  saveToLocalStorage();
});
shipFolder.add(params, 'shipSpeed', 0.0, 5.0, 0.1).name('船速').onChange(v => {
  oceanMaterial.uniforms.uShipSpeed.value = v;
  saveToLocalStorage();
});

// --- 13. Animation Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  oceanMaterial.uniforms.uTime.value = clock.getElapsedTime();
  renderer.render(scene, camera);
}
animate();

// --- 14. Window Resize Handler ---
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);