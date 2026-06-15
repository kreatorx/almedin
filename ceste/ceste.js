import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import Delaunator from 'delaunator';
import { DxfParser } from 'dxf-parser';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

/* -------------------------------------------
   GLOBALNE VARIJABLE I STANJA (STATE MACHINE)
------------------------------------------- */
let dragControls = null;
let krivineIzracunate = false;
let koridorIzgraden = false;

// Teren i scene objekti
let izvorniTerenMesh = null;
let terrainMesh = null;
let scene, camera, renderer, controls, gridHelper;
let cameraPerspective, cameraOrthographic;
let dxffilteredPoints = [], dxfLinesGroup = new THREE.Group();
let cadOffset = new THREE.Vector3(), trenutniSirinaTerena = 500, bezbjednaVisinaCrtanja = 100;

// Trasa i 3D elementi trase
let isDrawingMode = false;
let trasaPoints = [], projektovanaOsa = [], udaljenostiOse = [];
let trasaLinesGroup = new THREE.Group();
let projektovanaTrasaGroup = new THREE.Group();
let poprecniProfiliGroup = new THREE.Group();
let linijeKoridoraGroup = new THREE.Group();
let koridorMeshGroup = new THREE.Group();

// Podaci za zapremine i 2D
let generisaniProfili = [];
let profili2DData = [];

// Uzdužni profil i niveleta
let podaciTerena = [], niveletaPoints = [], isDrawingNiveleta = false;
let profilMaxStac = 0, profilMinVis = 0, profilMaxVis = 0;
let profilTrenutniMinV = 0, profilTrenutniMaxV = 0;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let aktivnoVertikalnoTjeme = -1;

/* -------------------------------------------
   INICIJALIZACIJA
------------------------------------------- */
function init() {
    const container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1e1e);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    cameraPerspective = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 50000);
    camera = cameraPerspective;
    camera.position.set(100, 100, 100);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.enableZoom = false;

    scene.add(trasaLinesGroup, projektovanaTrasaGroup, poprecniProfiliGroup, linijeKoridoraGroup, koridorMeshGroup);

    postaviOsvjetljenje();
    postaviEventove();
    animate();

    document.getElementById('btn-load-dxf').classList.add('glow-next');
}

function postaviOsvjetljenje() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 1, 1).normalize();
    scene.add(dirLight);

    gridHelper = new THREE.GridHelper(1000, 50, 0x4fc3f7, 0x333333);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);
}

/* -------------------------------------------
   RESET SISTEMA
------------------------------------------- */
function obrisiSve() {
    trasaPoints = [];
    dxffilteredPoints = [];
    podaciTerena = [];
    niveletaPoints = [];
    generisaniProfili = [];
    profili2DData = [];
    krivineIzracunate = false;
    koridorIzgraden = false;

    if (terrainMesh) {
        scene.remove(terrainMesh);
        terrainMesh.geometry.dispose();
        terrainMesh.material.dispose();
        terrainMesh = null;
    }

    function isprazniGrupu(grupa) {
        while (grupa.children.length > 0) {
            let obj = grupa.children[0];
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
            grupa.remove(obj);
        }
    }

    isprazniGrupu(dxfLinesGroup);
    isprazniGrupu(trasaLinesGroup);
    isprazniGrupu(projektovanaTrasaGroup);
    isprazniGrupu(poprecniProfiliGroup);
    isprazniGrupu(linijeKoridoraGroup);
    isprazniGrupu(koridorMeshGroup);

    if (dragControls) {
        dragControls.dispose();
        dragControls = null;
    }

    controls.target.set(0, 0, 0);
    postaviKameruPrikaz(false);
    controls.update();

    document.getElementById('status-text').innerText = "Sistem resetovan.";
    document.getElementById('trasa-length').innerText = "0.00 m";

    let buttonsToDisable = [
        'btn-make-surface', 'btn-draw-trasa', 'btn-calc-curves',
        'btn-make-profile', 'btn-show-profile', 'btn-make-sections',
        'btn-define-cross', 'btn-make-corridor', 'btn-show-volumes', 'btn-export-gltf'
    ];
    buttonsToDisable.forEach(id => document.getElementById(id).disabled = true);

    REDOSLIJED_DUGMI.forEach(id => document.getElementById(id).classList.remove('glow-next'));
    document.getElementById('btn-load-dxf').classList.add('glow-next');
}

/* -------------------------------------------
   UI GLOW (State Machine Navigation)
------------------------------------------- */
const REDOSLIJED_DUGMI = [
    'btn-load-dxf', 'btn-make-surface', 'btn-draw-trasa', 'btn-calc-curves',
    'btn-make-profile', 'btn-show-profile', 'btn-make-sections',
    'btn-define-cross', 'btn-make-corridor', 'btn-show-volumes', 'btn-export-gltf'
];

function obiljeziSljedeceDugme(trenutnoId) {
    REDOSLIJED_DUGMI.forEach(id => document.getElementById(id).classList.remove('glow-next'));

    let idx = REDOSLIJED_DUGMI.indexOf(trenutnoId);
    if (idx === -1) return;

    for (let i = idx + 1; i < REDOSLIJED_DUGMI.length; i++) {
        let btn = document.getElementById(REDOSLIJED_DUGMI[i]);
        if (!btn.disabled) { btn.classList.add('glow-next'); return; }
    }
    if (idx + 1 < REDOSLIJED_DUGMI.length) {
        document.getElementById(REDOSLIJED_DUGMI[idx + 1]).classList.add('glow-next');
    }
}

/* -------------------------------------------
   RUKOVANJE DOGAĐAJIMA (EVENTS)
------------------------------------------- */
function postaviEventove() {
    document.getElementById('btn-clear-all').addEventListener('click', obrisiSve);
    document.getElementById('dxf-file-input').addEventListener('change', procesirajDXF);
    document.getElementById('btn-make-surface').addEventListener('click', kreirajPovrsinu);
    document.getElementById('btn-draw-trasa').addEventListener('click', toggleCrtanjeTrase);

    document.getElementById('btn-calc-curves').addEventListener('click', () => {
        krivineIzracunate = true;
        racunajElementeTrase();
        regenerisiSve();
        obiljeziSljedeceDugme('btn-calc-curves');
    });

    document.getElementById('btn-make-profile').addEventListener('click', generisiUzduzniProfil);

    document.getElementById('btn-show-profile').addEventListener('click', () => {
        document.getElementById('profile-panel').style.display = 'block';
        crtajCanvasProfil();
        obiljeziSljedeceDugme('btn-show-profile');
    });

    document.getElementById('btn-make-sections').addEventListener('click', generisiStacionaze);

    document.getElementById('btn-define-cross').addEventListener('click', () => { document.getElementById('cross-section-panel').style.display = 'block'; });
    document.getElementById('btn-close-cross').addEventListener('click', () => { document.getElementById('cross-section-panel').style.display = 'none'; });
    document.getElementById('btn-apply-cross').addEventListener('click', primijeniPoprecneProfile);

    document.getElementById('btn-make-corridor').addEventListener('click', izradi3DKoridor);
    document.getElementById('btn-show-volumes').addEventListener('click', otvoriZapremine);
    document.getElementById('btn-close-volumes').addEventListener('click', () => document.getElementById('volume-panel').style.display = 'none');

    document.getElementById('stac-slider').addEventListener('input', (e) => { crtaj2DProfilZaIndeks(e.target.value); });
    document.getElementById('btn-prev-stac').addEventListener('click', () => { let s = document.getElementById('stac-slider'); if (s.value > 0) { s.value--; crtaj2DProfilZaIndeks(s.value); } });
    document.getElementById('btn-next-stac').addEventListener('click', () => { let s = document.getElementById('stac-slider'); if (s.value < profili2DData.length - 1) { s.value++; crtaj2DProfilZaIndeks(s.value); } });

    const btnNiveleta = document.getElementById('btn-draw-niveleta');
    btnNiveleta.addEventListener('click', () => {
        isDrawingNiveleta = !isDrawingNiveleta;
        btnNiveleta.classList.toggle('active-mode');
        if (isDrawingNiveleta) {
            btnNiveleta.innerText = "Završi Niveletu";
            document.getElementById('status-text').innerText = "Klikći po grafikonu da dodaš lomove nivelete.";
        } else {
            btnNiveleta.innerText = "Crtaj Niveletu (VPI)";
            if (niveletaPoints.length >= 2) {
                nacrtajSamo3DNiveletu();
                document.getElementById('btn-make-sections').disabled = false;
                document.getElementById('btn-make-sections').classList.remove('glow-next');
                document.getElementById('btn-make-sections').classList.add('glow-next');
                document.getElementById('status-text').innerText = "Niveleta uspješno dodana u 3D!";
            } else {
                alert("Nacrtaj barem 2 tačke!");
            }
        }
    });

    document.getElementById('btn-apply-vc').addEventListener('click', () => {
        if (aktivnoVertikalnoTjeme !== -1) {
            let rv = parseFloat(document.getElementById('vc-radijus').value) || 0;
            niveletaPoints[aktivnoVertikalnoTjeme].Rv = rv;
            crtajCanvasProfil();

            if (poprecniProfiliGroup.getObjectByName("3d-niveleta")) nacrtajSamo3DNiveletu();
            if (document.getElementById('btn-define-cross').disabled === false) regenerisiSve();
        } else {
            alert("Nijedno tjeme nije označeno. Kliknite na žutu tačku na profilu!");
        }
    });

    document.getElementById('profile-canvas').addEventListener('click', (event) => {
        // Handle in klikNaProfilCanvas directly
    });

    document.getElementById('btn-delete-vc').addEventListener('click', () => {
        if (aktivnoVertikalnoTjeme !== -1) {
            niveletaPoints.splice(aktivnoVertikalnoTjeme, 1);
            crtajCanvasProfil();
            if (poprecniProfiliGroup.getObjectByName("3d-niveleta")) nacrtajSamo3DNiveletu();
            if (document.getElementById('btn-define-cross').disabled === false) regenerisiSve();
        }
        document.getElementById('vcurve-panel').style.display = 'none';
    });

    document.getElementById('btn-delete-all-niveleta').addEventListener('click', () => {
        if (confirm("Da li ste sigurni da želite obrisati cijelu niveletu?")) {
            niveletaPoints = [];
            crtajCanvasProfil();

            let stara = poprecniProfiliGroup.getObjectByName("3d-niveleta");
            if (stara) {
                poprecniProfiliGroup.remove(stara);
                stara.geometry.dispose();
                stara.material.dispose();
            }

            document.getElementById('status-text').innerText = "Niveleta obrisana.";
            if (document.getElementById('btn-define-cross').disabled === false) regenerisiSve();
        }
    });

    document.getElementById('profile-canvas').addEventListener('click', klikNaProfilCanvas);
    document.getElementById('close-profile').addEventListener('click', () => document.getElementById('profile-panel').style.display = 'none');

    document.getElementById('btn-wireframe').addEventListener('click', () => { if (terrainMesh) terrainMesh.material.wireframe = !terrainMesh.material.wireframe; });
    document.getElementById('btn-export-gltf').addEventListener('click', eksportujTerenGLTF);

    window.addEventListener('mouseup', onMouseUp3D);
    renderer.domElement.addEventListener('wheel', customZoomAlgoritam, { passive: false });
    window.addEventListener('resize', onWindowResize);

    renderer.domElement.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        if (!isDrawingMode || trasaPoints.length === 0) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const markeri = trasaLinesGroup.children.filter(obj => obj.isMesh);
        const presjeci = raycaster.intersectObjects(markeri);

        if (presjeci.length > 0) {
            let kliknutiMarker = presjeci[0].object;
            let idx = kliknutiMarker.userData.index;
            trasaPoints.splice(idx, 1);
            osvjeziMarkere();
            osvjeziDragKontrole();
            regenerisiSve();
        }
    });
}

/* -------------------------------------------
   DODAVANJE I POMJERANJE TAČAKA (3D)
------------------------------------------- */
function onMouseUp3D(event) {
    if (!event.target.closest) return;

    if (event.target.closest('#ui-panel') ||
        event.target.closest('#profile-panel') ||
        event.target.closest('#cross-section-panel') ||
        event.target.closest('#volume-panel')) return;

    if (event.button !== 0 || !isDrawingMode || !terrainMesh) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const markeri = trasaLinesGroup.children.filter(obj => obj.isMesh);
    const intersectMarkeri = raycaster.intersectObjects(markeri);
    if (intersectMarkeri.length > 0) return;

    const presjeci = raycaster.intersectObject(terrainMesh);
    if (presjeci.length > 0) {
        const pt = presjeci[0].point;
        pt.y = bezbjednaVisinaCrtanja;
        trasaPoints.push(pt.clone());

        osvjeziMarkere();
        osvjeziDragKontrole();
        regenerisiSve();
    }
}

function osvjeziDragKontrole() {
    const markeri = trasaLinesGroup.children.filter(obj => obj.isMesh);

    if (dragControls) { dragControls.dispose(); }

    dragControls = new DragControls(markeri, camera, renderer.domElement);

    dragControls.addEventListener('dragstart', (event) => {
        controls.enabled = false;
    });

    dragControls.addEventListener('drag', (event) => { });

    dragControls.addEventListener('dragend', (event) => {
        controls.enabled = true;
        let idx = event.object.userData.index;
        trasaPoints[idx].copy(event.object.position);

        regenerisiSve();
    });
}

/* -------------------------------------------
   OSVJEŽAVANJE VIZUELNIH ELEMENATA TRASE
------------------------------------------- */
function azurirajTangentu() {
    let staraTrasa = trasaLinesGroup.getObjectByName("tangente");
    if (staraTrasa) {
        trasaLinesGroup.remove(staraTrasa);
        staraTrasa.geometry.dispose();
    }
    if (trasaPoints.length > 1) {
        let lineMesh = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(trasaPoints),
            new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 })
        );
        lineMesh.name = "tangente";
        trasaLinesGroup.add(lineMesh);
        document.getElementById('btn-calc-curves').disabled = false;
        if (!krivineIzracunate)
            obiljeziSljedeceDugme('btn-draw-trasa');
    } else {
        document.getElementById('btn-calc-curves').disabled = true;
    }
}

function osvjeziMarkere() {
    for (let i = trasaLinesGroup.children.length - 1; i >= 0; i--) {
        let obj = trasaLinesGroup.children[i];
        if (obj.isMesh) {
            trasaLinesGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }
    }

    trasaPoints.forEach((pt, i) => {
        const marker = new THREE.Mesh(
            new THREE.SphereGeometry(Math.max(trenutniSirinaTerena * 0.008, 0.5)),
            new THREE.MeshBasicMaterial({ color: 0xff1744 })
        );
        marker.position.copy(pt);
        marker.userData.index = i;
        trasaLinesGroup.add(marker);
    });
}

/* -------------------------------------------
   GLAVNA STATE-MACHINE KASKADNA FUNKCIJA
------------------------------------------- */
function regenerisiSve() {
    azurirajTangentu();

    if (trasaPoints.length < 2) {
        for (let i = trasaLinesGroup.children.length - 1; i >= 0; i--) {
            let obj = trasaLinesGroup.children[i];
            if (obj.name && obj.name.startsWith("osa_")) {
                trasaLinesGroup.remove(obj);
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            }
        }
        return;
    }

    if (!krivineIzracunate) return;

    document.getElementById('status-text').innerText = "Regenerišem cijeli model...";

    if (koridorIzgraden) {
        while (koridorMeshGroup.children.length > 0) {
            let obj = koridorMeshGroup.children[0];
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
            koridorMeshGroup.remove(obj);
        }
        while (linijeKoridoraGroup.children.length > 0) {
            let obj = linijeKoridoraGroup.children[0];
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
            linijeKoridoraGroup.remove(obj);
        }
        if (terrainMesh) {
            scene.remove(terrainMesh);
            terrainMesh.geometry.dispose();
            terrainMesh.material.dispose();
        }
        terrainMesh = new THREE.Mesh(izvorniTerenMesh.clone(), new THREE.MeshStandardMaterial({ color: 0x3d8b40, side: THREE.DoubleSide }));
        scene.add(terrainMesh);
        koridorIzgraden = false;
    }

    for (let i = trasaLinesGroup.children.length - 1; i >= 0; i--) {
        let obj = trasaLinesGroup.children[i];
        if (obj.name && obj.name.startsWith("osa_")) {
            trasaLinesGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }
    }
    racunajElementeTrase();

    if (podaciTerena.length > 0) {
        generisiUzduzniProfil();
        if (document.getElementById('profile-panel').style.display === 'block') {
            crtajCanvasProfil();
        }
    }

    if (niveletaPoints.length >= 2) {
        nacrtajSamo3DNiveletu();

        if (poprecniProfiliGroup.children.length > 1) {
            generisiStacionaze();

            if (document.getElementById('btn-define-cross').disabled === false) {
                primijeniPoprecneProfile();
                izradi3DKoridor();

                if (document.getElementById('volume-panel').style.display === 'flex') {
                    popuniTabeluZapremina();
                    crtaj2DProfilZaIndeks(document.getElementById('stac-slider').value);
                }
            }
        }
    }
    document.getElementById('status-text').innerText = "Sve uspješno ažurirano.";
}

/* -------------------------------------------
   MATEMATIKA I GEOMETRIJA TRASE
------------------------------------------- */
function racunajElementeTrase() {
    if (trasaPoints.length < 2) return;

    const R = parseFloat(document.getElementById('krivina-r').value) || 100;
    const Ls = parseFloat(document.getElementById('krivina-l').value) || 40;

    projektovanaOsa = [];
    udaljenostiOse = [];
    let trenutnaUkupnaDuzina = 0;

    projektovanaOsa.push(trasaPoints[0].clone());
    udaljenostiOse.push(trenutnaUkupnaDuzina);

    for (let i = 1; i < trasaPoints.length - 1; i++) {
        let P0 = trasaPoints[i - 1], P1 = trasaPoints[i], P2 = trasaPoints[i + 1];
        let distIn = P0.distanceTo(P1), distOut = P1.distanceTo(P2);
        if (distIn < 0.1 || distOut < 0.1) continue;

        let vIn = new THREE.Vector3().subVectors(P1, P0).normalize();
        let vOut = new THREE.Vector3().subVectors(P2, P1).normalize();
        let dotProduct = Math.max(-1, Math.min(1, vIn.dot(vOut)));
        let skretanjeRad = Math.acos(dotProduct);
        if (skretanjeRad < 0.05) continue;

        let deltaR = (Ls * Ls) / (24 * R);
        let Xm = (Ls / 2) - (Math.pow(Ls, 3) / (240 * Math.pow(R, 2)));
        let Ts = (R + deltaR) * Math.tan(skretanjeRad / 2) + Xm;

        if (Ts > distIn || Ts > distOut || isNaN(Ts)) Ts = Math.min(distIn, distOut) * 0.9;

        let TS = new THREE.Vector3().copy(P1).addScaledVector(vIn, -Ts);
        let ST = new THREE.Vector3().copy(P1).addScaledVector(vOut, Ts);

        let ptsPravac = [];
        let zadnjaTacka = projektovanaOsa[projektovanaOsa.length - 1];
        let distPravac = zadnjaTacka.distanceTo(TS);

        if (distPravac > 0.1) {
            let numSteps = Math.ceil(distPravac);
            ptsPravac.push(zadnjaTacka);
            for (let j = 1; j <= numSteps; j++) {
                let pt = new THREE.Vector3().copy(zadnjaTacka).lerp(TS, j / numSteps);
                projektovanaOsa.push(pt);
                ptsPravac.push(pt);
                trenutnaUkupnaDuzina += (distPravac / numSteps);
                udaljenostiOse.push(trenutnaUkupnaDuzina);
            }
            let linPravac = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(ptsPravac),
                new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
            );
            linPravac.name = "osa_pravac_" + i;
            trasaLinesGroup.add(linPravac);
        }

        let kriva = new THREE.QuadraticBezierCurve3(TS, P1, ST);
        let tackeKrivine = kriva.getPoints(Math.max(20, Math.floor(skretanjeRad * R)));

        let ptsPrelaz1 = [tackeKrivine[0]], ptsKrug = [], ptsPrelaz2 = [];
        let curveLenSoFar = 0, totalCurveLen = 0;

        for (let j = 1; j < tackeKrivine.length; j++) {
            totalCurveLen += tackeKrivine[j - 1].distanceTo(tackeKrivine[j]);
        }
        let stvarniLs = Math.min(Ls, totalCurveLen / 2.1);

        for (let j = 1; j < tackeKrivine.length; j++) {
            let segmentLen = tackeKrivine[j - 1].distanceTo(tackeKrivine[j]);
            curveLenSoFar += segmentLen;
            projektovanaOsa.push(tackeKrivine[j]);
            trenutnaUkupnaDuzina += segmentLen;
            udaljenostiOse.push(trenutnaUkupnaDuzina);

            if (curveLenSoFar <= stvarniLs) {
                ptsPrelaz1.push(tackeKrivine[j]);
            } else if (curveLenSoFar > stvarniLs && curveLenSoFar <= totalCurveLen - stvarniLs) {
                if (ptsKrug.length === 0) ptsKrug.push(tackeKrivine[j - 1]);
                ptsKrug.push(tackeKrivine[j]);
            } else {
                if (ptsPrelaz2.length === 0) ptsPrelaz2.push(tackeKrivine[j - 1]);
                ptsPrelaz2.push(tackeKrivine[j]);
            }
        }

        if (ptsPrelaz1.length > 1) {
            let line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsPrelaz1), new THREE.LineBasicMaterial({ color: 0xffea00, linewidth: 3 }));
            line.name = "osa_prelaz1_" + i; trasaLinesGroup.add(line);
        }
        if (ptsKrug.length > 1) {
            let line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsKrug), new THREE.LineBasicMaterial({ color: 0x00e676, linewidth: 3 }));
            line.name = "osa_krug_" + i; trasaLinesGroup.add(line);
        }
        if (ptsPrelaz2.length > 1) {
            let line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsPrelaz2), new THREE.LineBasicMaterial({ color: 0xffea00, linewidth: 3 }));
            line.name = "osa_prelaz2_" + i; trasaLinesGroup.add(line);
        }
    }

    let ptsZadnji = [];
    let zadnja = trasaPoints[trasaPoints.length - 1];
    let pretposljednja = projektovanaOsa[projektovanaOsa.length - 1];
    let dZadnji = pretposljednja.distanceTo(zadnja);

    if (dZadnji > 0.1) {
        let numStepsZadnji = Math.ceil(dZadnji);
        ptsZadnji.push(pretposljednja);
        for (let j = 1; j <= numStepsZadnji; j++) {
            let pt = new THREE.Vector3().copy(pretposljednja).lerp(zadnja, j / numStepsZadnji);
            projektovanaOsa.push(pt);
            ptsZadnji.push(pt);
            trenutnaUkupnaDuzina += (dZadnji / numStepsZadnji);
            udaljenostiOse.push(trenutnaUkupnaDuzina);
        }
        let linZadnji = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(ptsZadnji),
            new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
        );
        linZadnji.name = "osa_pravac_zadnji";
        trasaLinesGroup.add(linZadnji);
    }

    document.getElementById('trasa-length').innerText = trenutnaUkupnaDuzina.toFixed(2) + " m";
    document.getElementById('btn-make-profile').disabled = false;
}

function dobijTackuSaStacionaze(stac) {
    if (udaljenostiOse.length < 2) return null;
    if (stac <= 0) return {
        pt: projektovanaOsa[0],
        dir: new THREE.Vector3().subVectors(projektovanaOsa[1], projektovanaOsa[0]).normalize()
    };

    let maxIdx = udaljenostiOse.length - 1;
    if (stac >= udaljenostiOse[maxIdx]) return {
        pt: projektovanaOsa[maxIdx],
        dir: new THREE.Vector3().subVectors(projektovanaOsa[maxIdx], projektovanaOsa[maxIdx - 1]).normalize()
    };

    for (let i = 0; i < maxIdx; i++) {
        if (stac >= udaljenostiOse[i] && stac <= udaljenostiOse[i + 1]) {
            let p1 = projektovanaOsa[i], p2 = projektovanaOsa[i + 1];
            let dir = new THREE.Vector3().subVectors(p2, p1).normalize();
            let pt = new THREE.Vector3().copy(p1).lerp(p2, (stac - udaljenostiOse[i]) / (udaljenostiOse[i + 1] - udaljenostiOse[i]));
            return { pt: pt, dir: dir };
        }
    }
    return null;
}

/* -------------------------------------------
   UZDUŽNI PROFIL I NIVELETA
------------------------------------------- */
function generisiUzduzniProfil() {
    if (projektovanaOsa.length < 2 || !izvorniTerenMesh) return;

    const raycaster = new THREE.Raycaster();
    let privremeniMesh = new THREE.Mesh(izvorniTerenMesh, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));

    podaciTerena = [];
    profilMaxStac = udaljenostiOse[udaljenostiOse.length - 1];

    for (let stac = 0; stac <= profilMaxStac; stac += 1) {
        let podatakOse = dobijTackuSaStacionaze(stac);
        if (!podatakOse) continue;

        let tackaGore = new THREE.Vector3(podatakOse.pt.x, 1000, podatakOse.pt.z);
        raycaster.set(tackaGore, new THREE.Vector3(0, -1, 0));

        let presjeci = raycaster.intersectObject(privremeniMesh);
        if (presjeci.length > 0) {
            podaciTerena.push({ stacionaza: stac, visina: presjeci[0].point.y });
        }
    }

    if (podaciTerena.length === 0) return alert("Greška: Nemoguće očitati teren. Provjerite da li trasa prelazi preko terena.");

    profilMinVis = Math.min(...podaciTerena.map(p => p.visina));
    profilMaxVis = Math.max(...podaciTerena.map(p => p.visina));

    // DODATO: Iscrtavanje projektovane linije terena u 3D po trasi
    let staraTerenLinija = poprecniProfiliGroup.getObjectByName("3d-teren-profil");
    if (staraTerenLinija) poprecniProfiliGroup.remove(staraTerenLinija);

    let tpPts = [];
    for (let i = 0; i < podaciTerena.length; i++) {
        let pOse = dobijTackuSaStacionaze(podaciTerena[i].stacionaza);
        if (pOse) tpPts.push(new THREE.Vector3(pOse.pt.x, podaciTerena[i].visina + 0.1, pOse.pt.z));
    }
    if (tpPts.length > 1) {
        let tLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(tpPts),
            new THREE.LineBasicMaterial({ color: 0x4caf50, linewidth: 2 }) // Zelena linija terena u 3D
        );
        tLine.name = "3d-teren-profil";
        poprecniProfiliGroup.add(tLine);
    }

    document.getElementById('btn-show-profile').disabled = false;
    obiljeziSljedeceDugme('btn-make-profile');
    document.getElementById('status-text').innerText = "Linija terena uspješno izvučena!";
}

function dobijVisinuNivelete(stac) {
    if (niveletaPoints.length === 0) return null;
    if (niveletaPoints.length === 1) return niveletaPoints[0].visina;

    for (let i = 1; i < niveletaPoints.length - 1; i++) {
        let P = niveletaPoints[i];
        if (P.Rv && P.Rv > 0) {
            let P_prev = niveletaPoints[i - 1], P_next = niveletaPoints[i + 1];
            let i_in = (P.visina - P_prev.visina) / (P.stacionaza - P_prev.stacionaza);
            let i_out = (P_next.visina - P.visina) / (P_next.stacionaza - P.stacionaza);
            let deltaI = i_out - i_in;

            let T = Math.abs(P.Rv * deltaI) / 2;
            let maxT = Math.min((P.stacionaza - P_prev.stacionaza) * 0.9, (P_next.stacionaza - P.stacionaza) * 0.9);
            if (T > maxT) T = maxT;

            let stac_pocetak = P.stacionaza - T;
            let stac_kraj = P.stacionaza + T;

            if (stac >= stac_pocetak && stac <= stac_kraj) {
                let visina_pocetak = P.visina - T * i_in;
                let x = stac - stac_pocetak;
                return visina_pocetak + i_in * x + (deltaI / (4 * T)) * (x * x);
            }
        }
    }

    for (let i = 0; i < niveletaPoints.length - 1; i++) {
        let P1 = niveletaPoints[i], P2 = niveletaPoints[i + 1];
        if (stac >= P1.stacionaza && stac <= P2.stacionaza) {
            let pad = (P2.visina - P1.visina) / (P2.stacionaza - P1.stacionaza);
            return P1.visina + pad * (stac - P1.stacionaza);
        }
    }

    if (stac < niveletaPoints[0].stacionaza) return niveletaPoints[0].visina;
    if (stac > niveletaPoints[niveletaPoints.length - 1].stacionaza) return niveletaPoints[niveletaPoints.length - 1].visina;
    return null;
}

function crtajCanvasProfil() {
    const canvas = document.getElementById('profile-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = canvas.parentElement.clientWidth - 20;
    canvas.height = 250;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (podaciTerena.length === 0) return;

    let minV = Math.min(...podaciTerena.map(p => p.visina));
    let maxV = Math.max(...podaciTerena.map(p => p.visina));
    if (niveletaPoints.length > 0) {
        minV = Math.min(minV, ...niveletaPoints.map(p => p.visina));
        maxV = Math.max(maxV, ...niveletaPoints.map(p => p.visina));
    }

    profilTrenutniMinV = minV;
    profilTrenutniMaxV = maxV;

    // Poboljšane margine zbog grid oznaka
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 25;

    const w = canvas.width - paddingLeft - paddingRight;
    const h = canvas.height - paddingTop - paddingBottom;
    const raspon = maxV - minV || 1;

    function uX(stac) { return paddingLeft + (stac / profilMaxStac) * w; }
    function uY(vis) { return canvas.height - paddingBottom - ((vis - minV) / raspon) * h; }

    // DODATO: Iscrtavanje GRID-a (Izohipse i Stacionaže)
    ctx.font = '11px Arial';
    ctx.fillStyle = '#aaaaaa';
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;

    // Horizontalni Grid (Visine)
    let yTick = Math.max(1, Math.ceil(raspon / 5));
    let startY = Math.floor(minV / yTick) * yTick;
    for (let v = startY; v <= maxV; v += yTick) {
        let y = uY(v);
        if (y >= paddingTop - 10 && y <= canvas.height - paddingBottom + 10) {
            ctx.beginPath(); ctx.moveTo(paddingLeft, y); ctx.lineTo(canvas.width - paddingRight, y); ctx.stroke();
            // Prikaz apsolutnih kota dodavanjem cadOffset.y
            ctx.fillText((v + cadOffset.y).toFixed(1), 5, y + 4);
        }
    }

    // Vertikalni Grid (Stacionaže po zadanom koraku)
    let korakEl = document.getElementById('stac-korak');
    let sTick = korakEl ? parseFloat(korakEl.value) : 20;
    if (!sTick || sTick <= 0) sTick = 20;
    if (profilMaxStac / sTick > 40) sTick = Math.ceil(profilMaxStac / 40);

    for (let s = 0; s <= profilMaxStac; s += sTick) {
        let x = uX(s);
        ctx.beginPath(); ctx.moveTo(x, paddingTop); ctx.lineTo(x, canvas.height - paddingBottom); ctx.stroke();

        let text = s.toFixed(0);
        let tw = ctx.measureText(text).width;
        ctx.fillText(text, x - tw / 2, canvas.height - 5);
    }

    // Crtaj Teren (Zeleno)
    ctx.beginPath();
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 2;
    ctx.moveTo(uX(podaciTerena[0].stacionaza), uY(podaciTerena[0].visina));
    for (let i = 1; i < podaciTerena.length; i++) ctx.lineTo(uX(podaciTerena[i].stacionaza), uY(podaciTerena[i].visina));
    ctx.stroke();

    // Crtaj Niveletu (Crveno - glatko sa parabolama)
    if (niveletaPoints.length >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = '#ff3d00';
        ctx.lineWidth = 3;

        let s = niveletaPoints[0].stacionaza;
        let s_kraj = niveletaPoints[niveletaPoints.length - 1].stacionaza;

        ctx.moveTo(uX(s), uY(dobijVisinuNivelete(s)));
        for (let stac = s + 1; stac <= s_kraj; stac += 1) {
            ctx.lineTo(uX(stac), uY(dobijVisinuNivelete(stac)));
        }
        ctx.lineTo(uX(s_kraj), uY(dobijVisinuNivelete(s_kraj)));
        ctx.stroke();
    }

    // Crtaj VPI Tjemena
    niveletaPoints.forEach((pt, index) => {
        ctx.beginPath();
        ctx.fillStyle = (index === aktivnoVertikalnoTjeme) ? '#ffea00' : '#ffffff';
        ctx.arc(uX(pt.stacionaza), uY(pt.visina), (index === aktivnoVertikalnoTjeme) ? 6 : 4, 0, 2 * Math.PI);
        ctx.fill(); ctx.stroke();

        if (pt.Rv > 0) {
            ctx.fillStyle = '#ffea00'; ctx.font = '11px Arial';
            ctx.fillText(`Rv=${pt.Rv}`, uX(pt.stacionaza) - 15, uY(pt.visina) - 12);
        }
    });
}

function klikNaProfilCanvas(event) {
    if (podaciTerena.length === 0) return;
    const r = document.getElementById('profile-canvas').getBoundingClientRect();

    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 25;

    const w = r.width - paddingLeft - paddingRight;
    const h = r.height - paddingTop - paddingBottom;

    const pikselX = event.clientX - r.left;
    const pikselY = event.clientY - r.top;

    const stac = ((pikselX - paddingLeft) / w) * profilMaxStac;

    const raspon = profilTrenutniMaxV - profilTrenutniMinV || 1;
    const visina = profilTrenutniMinV + ((r.height - paddingBottom - pikselY) / h) * raspon;

    const uPikselX = (s) => paddingLeft + (s / profilMaxStac) * w;
    const uPikselY = (v) => r.height - paddingBottom - ((v - profilTrenutniMinV) / raspon) * h;

    let kliknutoTjeme = -1;
    for (let i = 0; i < niveletaPoints.length; i++) {
        let px = uPikselX(niveletaPoints[i].stacionaza);
        let py = uPikselY(niveletaPoints[i].visina);
        let distanca = Math.hypot(pikselX - px, pikselY - py);
        if (distanca < 20) { kliknutoTjeme = i; break; }
    }

    if (kliknutoTjeme !== -1) {
        aktivnoVertikalnoTjeme = kliknutoTjeme;
        let panel = document.getElementById('vcurve-panel');
        if (panel) panel.style.display = 'block';
        let rc = document.getElementById('vc-radijus');
        if (rc) rc.value = niveletaPoints[kliknutoTjeme].Rv || 0;
    }
    else if (isDrawingNiveleta) {
        if (stac >= 0 && stac <= profilMaxStac) {
            niveletaPoints.push({ stacionaza: stac, visina: visina, Rv: 0 });
            niveletaPoints.sort((a, b) => a.stacionaza - b.stacionaza);
            crtajCanvasProfil();
        }
    }
}

function interpolirajNiveletu(stac) {
    if (niveletaPoints.length === 0) return 0;

    // Provjera da li se stacionaža nalazi unutar zone vertikalne krivine
    for (let i = 1; i < niveletaPoints.length - 1; i++) {
        let P = niveletaPoints[i];
        if (P.Rv > 0) {
            let P_prev = niveletaPoints[i - 1], P_next = niveletaPoints[i + 1];

            let i1 = (P.visina - P_prev.visina) / (P.stacionaza - P_prev.stacionaza);
            let i2 = (P_next.visina - P.visina) / (P.stacionaza - P_prev.stacionaza); // Ovdje je greška bila u redoslijedu
            let deltaI = i2 - i1;

            let L = Math.abs(P.Rv * deltaI);
            let stacPoc = P.stacionaza - L / 2;
            let stacKraj = P.stacionaza + L / 2;

            if (stac >= stacPoc && stac <= stacKraj) {
                let x = stac - stacPoc;
                // Osnovna formula parabole: y = y_poc + i1*x + (deltaI / (2*L)) * x^2
                let yPoc = P.visina - (L / 2) * i1;
                return yPoc + i1 * x + (deltaI / (2 * L)) * (x * x);
            }
        }
    }

    // Linearna interpolacija ako nije u krivini
    for (let i = 0; i < niveletaPoints.length - 1; i++) {
        let P1 = niveletaPoints[i], P2 = niveletaPoints[i + 1];
        if (stac >= P1.stacionaza && stac <= P2.stacionaza) {
            return P1.visina + ((stac - P1.stacionaza) / (P2.stacionaza - P1.stacionaza)) * (P2.visina - P1.visina);
        }
    }
    return niveletaPoints[niveletaPoints.length - 1].visina;
}

function nacrtajSamo3DNiveletu() {
    let stara = poprecniProfiliGroup.getObjectByName("3d-niveleta");
    if (stara) poprecniProfiliGroup.remove(stara);

    const nivPoints = [];
    const maxStac = udaljenostiOse[udaljenostiOse.length - 1];

    for (let stac = 0; stac <= maxStac; stac += 1.0) {
        let podaci = dobijTackuSaStacionaze(stac);
        if (!podaci) continue;

        // POPRAVKA: Uklonjeno duplo oduzimanje cadOffset.y kako bi niveleta imala tačnu visinu
        nivPoints.push(new THREE.Vector3(podaci.pt.x, interpolirajNiveletu(stac), podaci.pt.z));
    }
    if (nivPoints.length > 1) {
        let linija = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(nivPoints),
            new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 4 }) // POPRAVKA: Niveleta je sada izrazito crvena u 3D
        );
        linija.name = "3d-niveleta";
        poprecniProfiliGroup.add(linija);
    }
}

function racunajElementeNivelete() {
    if (niveletaPoints.length < 2) return;

    for (let i = 0; i < niveletaPoints.length; i++) {
        let P = niveletaPoints[i];

        P.Rv = parseFloat(P.Rv) || 0;
        P.T1 = null; P.T2 = null;

        if (i > 0 && i < niveletaPoints.length - 1 && P.Rv && P.Rv > 0) {
            let P_prev = niveletaPoints[i - 1], P_next = niveletaPoints[i + 1];

            let i_in = (P.visina - P_prev.visina) / (P.stacionaza - P_prev.stacionaza);
            let i_out = (P_next.visina - P.visina) / (P_next.stacionaza - P.stacionaza);

            let deltaI = i_out - i_in;
            let L_v = Math.abs(P.Rv * deltaI);
            let T = L_v / 2;

            let maxT = Math.min((P.stacionaza - P_prev.stacionaza) * 0.9, (P_next.stacionaza - P.stacionaza) * 0.9);
            if (T > maxT) { T = maxT; L_v = 2 * T; }

            if (T > 0.1) {
                P.i_in = i_in; P.i_out = i_out; P.L_v = L_v; P.deltaI = deltaI;
                P.T1 = { s: P.stacionaza - T, h: P.visina - T * i_in };
                P.T2 = { s: P.stacionaza + T, h: P.visina + T * i_out };
            }
        }
    }
}

/* -------------------------------------------
   POPREČNI PROFILI I KOSINE (DAYLIGHT)
------------------------------------------- */
function generisiStacionaze() {
    if (projektovanaOsa.length < 2 || niveletaPoints.length < 2) return alert("Nema ose ili nivelete!");
    nacrtajSamo3DNiveletu();

    for (let i = poprecniProfiliGroup.children.length - 1; i >= 0; i--) {
        if (poprecniProfiliGroup.children[i].name !== "3d-niveleta" && poprecniProfiliGroup.children[i].name !== "3d-teren-profil") {
            poprecniProfiliGroup.remove(poprecniProfiliGroup.children[i]);
        }
    }

    const korak = parseFloat(document.getElementById('stac-korak').value) || 20;
    const pS = (parseFloat(document.getElementById('stac-sirina').value) || 10) / 2;
    const maxStac = udaljenostiOse[udaljenostiOse.length - 1];

    for (let stac = 0; stac <= maxStac; stac += korak) {
        let podaci = dobijTackuSaStacionaze(stac);
        if (!podaci) continue;

        let normala = new THREE.Vector3(-podaci.dir.z, 0, podaci.dir.x).normalize();

        // POPRAVKA: Uklonjeno duplo oduzimanje cadOffset.y
        let visinaLokalno = interpolirajNiveletu(stac);
        let centar3D = new THREE.Vector3(podaci.pt.x, visinaLokalno, podaci.pt.z);

        let l3D = new THREE.Vector3().copy(centar3D).addScaledVector(normala, -pS);
        let d3D = new THREE.Vector3().copy(centar3D).addScaledVector(normala, pS);

        poprecniProfiliGroup.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([l3D, d3D]),
            new THREE.LineBasicMaterial({ color: 0x00b0ff })
        ));
    }

    document.getElementById('btn-define-cross').disabled = false;
    document.getElementById('status-text').innerText = "Stacionaže povučene. Definiši Poprečni Profil.";
    obiljeziSljedeceDugme('btn-make-sections');
}

function izracunajPovrsinuPoligona(pts) {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
        let j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y;
        area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area / 2);
}

function izracunajElementeProfila(stacionaza, podaciOse, visinaOse, normala) {
    let elementi = [];
    let data2D = { stacionaza: stacionaza, tacke2D: [], povrsinaUsjek: 0, povrsinaNasip: 0 };

    const wTraka = parseFloat(document.getElementById('cp-traka-w').value) || 3.5;
    const pTraka = (parseFloat(document.getElementById('cp-traka-pad').value) || -2.5) / 100;
    const deb = parseFloat(document.getElementById('cp-traka-deb').value) || 0.4;
    const wBank = parseFloat(document.getElementById('cp-bank-w').value) || 1.5;
    const pBank = (parseFloat(document.getElementById('cp-bank-pad').value) || -4.0) / 100;

    const nagNasip = -1 / (parseFloat(document.getElementById('cp-nasip').value) || 1.5);
    const nagUsjek = 1 / (parseFloat(document.getElementById('cp-usjek').value) || 1.0);
    const maxDaylight = 30.0;
    const centar = new THREE.Vector3(podaciOse.pt.x, visinaOse, podaciOse.pt.z);

    let podatakTeren = podaciTerena.find(p => Math.abs(p.stacionaza - stacionaza) < 0.5);

    // POPRAVKA: Uklonjeno duplo oduzimanje cadOffset.y
    let visinaTerenaCentar = podatakTeren ? podatakTeren.visina : visinaOse;

    data2D.tacke2D.push({ tip: 'teren_centar', x: 0, y: visinaTerenaCentar });
    data2D.tacke2D.push({ tip: 'cesta_centar', x: 0, y: visinaOse });

    function konstruisiStranu(mnozilac, vektor) {
        let ivicaAsf = new THREE.Vector3().copy(centar).addScaledVector(vektor, wTraka);
        ivicaAsf.y += wTraka * pTraka;

        let cDole = new THREE.Vector3(centar.x, centar.y - deb, centar.z);
        let iDole = new THREE.Vector3(ivicaAsf.x, ivicaAsf.y - deb, ivicaAsf.z);

        let ivicaBank = new THREE.Vector3().copy(ivicaAsf).addScaledVector(vektor, wBank);
        ivicaBank.y += wBank * pBank;

        elementi.push({ ime: "asfalt", boja: 0x444444, p1: centar.clone(), p2: ivicaAsf.clone() });
        elementi.push({ ime: "tampon_dno", boja: 0x795548, p1: cDole, p2: iDole });
        elementi.push({ ime: "tampon_bok", boja: 0x795548, p1: ivicaAsf.clone(), p2: iDole });
        elementi.push({ ime: "bankina", boja: 0x66bb6a, p1: ivicaAsf.clone(), p2: ivicaBank.clone() });

        let yAsf2D = visinaOse + (wTraka * pTraka);
        let yBank2D = yAsf2D + (wBank * pBank);
        data2D.tacke2D.push({ tip: 'asfalt', x: wTraka * mnozilac, y: yAsf2D });
        data2D.tacke2D.push({ tip: 'tampon_dno', x: wTraka * mnozilac, y: yAsf2D - deb });
        data2D.tacke2D.push({ tip: 'bankina', x: (wTraka + wBank) * mnozilac, y: yBank2D });

        let rayVertikalno = new THREE.Raycaster(new THREE.Vector3(ivicaBank.x, bezbjednaVisinaCrtanja + 50, ivicaBank.z), new THREE.Vector3(0, -1, 0));
        let presjeci = rayVertikalno.intersectObject(terrainMesh);
        let ptKraj; let jeNasip = true; let yKraj2D; let xKraj2D;

        if (presjeci.length > 0) {
            let visTerena = presjeci[0].point.y;
            jeNasip = ivicaBank.y > visTerena;

            let vektorKosine = new THREE.Vector3().copy(vektor);
            vektorKosine.y = jeNasip ? nagNasip : nagUsjek;
            vektorKosine.normalize();

            let presjeciK = new THREE.Raycaster(ivicaBank, vektorKosine).intersectObject(terrainMesh);

            if (presjeciK.length > 0 && presjeciK[0].distance <= maxDaylight) {
                ptKraj = presjeciK[0].point;
                let horizDist = new THREE.Vector2(ptKraj.x - ivicaBank.x, ptKraj.z - ivicaBank.z).length();
                xKraj2D = (wTraka + wBank + horizDist) * mnozilac;
                yKraj2D = ptKraj.y;
            } else {
                ptKraj = new THREE.Vector3().copy(ivicaBank).addScaledVector(vektorKosine, maxDaylight);
                xKraj2D = (wTraka + wBank + maxDaylight) * mnozilac;
                yKraj2D = ptKraj.y;
            }
        } else {
            ptKraj = new THREE.Vector3().copy(ivicaBank).addScaledVector(vektor, maxDaylight);
            xKraj2D = (wTraka + wBank + maxDaylight) * mnozilac;
            yKraj2D = ptKraj.y;
        }

        elementi.push({ ime: jeNasip ? "nasip" : "usjek", boja: jeNasip ? 0xfbc02d : 0xe53935, p1: ivicaBank.clone(), p2: ptKraj.clone() });
        data2D.tacke2D.push({ tip: 'daylight', x: xKraj2D, y: yKraj2D, isNasip: jeNasip });

        let polyPoints = [
            { x: 0, y: visinaOse - deb },
            { x: wTraka * mnozilac, y: yAsf2D - deb },
            { x: wTraka * mnozilac, y: yAsf2D },
            { x: (wTraka + wBank) * mnozilac, y: yBank2D },
            { x: xKraj2D, y: yKraj2D },
            { x: 0, y: visinaTerenaCentar }
        ];
        let povrsina = izracunajPovrsinuPoligona(polyPoints);
        if (jeNasip) data2D.povrsinaNasip += povrsina; else data2D.povrsinaUsjek += povrsina;
    }

    elementi.push({ ime: "tampon_sredina", boja: 0x795548, p1: centar.clone(), p2: new THREE.Vector3(centar.x, centar.y - deb, centar.z) });

    konstruisiStranu(1, normala);
    konstruisiStranu(-1, new THREE.Vector3().copy(normala).negate());

    return { elementi: elementi, data2D: data2D };
}

function primijeniPoprecneProfile() {
    if (!terrainMesh) return alert("Morate imati generisan teren za proračun kosina!");

    while (linijeKoridoraGroup.children.length > 0) {
        linijeKoridoraGroup.remove(linijeKoridoraGroup.children[0]);
    }
    generisaniProfili = [];
    profili2DData = [];

    const korak = parseFloat(document.getElementById('stac-korak').value) || 20;
    const maxStac = udaljenostiOse[udaljenostiOse.length - 1];

    for (let stac = 0; stac <= maxStac; stac += korak) {
        let podaci = dobijTackuSaStacionaze(stac);
        if (!podaci) continue;

        let normala = new THREE.Vector3(-podaci.dir.z, 0, podaci.dir.x).normalize();
        let visinaLokalno = interpolirajNiveletu(stac); // Uklonjen cadOffset.y

        let rezultat = izracunajElementeProfila(stac, podaci, visinaLokalno, normala);

        generisaniProfili.push(rezultat.elementi);
        profili2DData.push(rezultat.data2D);

        rezultat.elementi.forEach(el => {
            linijeKoridoraGroup.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([el.p1, el.p2]),
                new THREE.LineBasicMaterial({ color: el.boja, linewidth: 2 })
            ));
        });
    }

    document.getElementById('cross-section-panel').style.display = 'none';
    document.getElementById('btn-make-corridor').disabled = false;
    document.getElementById('btn-show-volumes').disabled = false;
    document.getElementById('status-text').innerText = "Profili primijenjeni i količine sračunate.";

    obiljeziSljedeceDugme('btn-define-cross');
}

/* -------------------------------------------
   IZRADA MESH KORIDORA I SJEČENJE TERENA
------------------------------------------- */
function izradi3DKoridor() {
    if (generisaniProfili.length < 2) return alert("Nedovoljno profila!");

    while (koridorMeshGroup.children.length > 0) {
        koridorMeshGroup.remove(koridorMeshGroup.children[0]);
    }

    for (let i = 0; i < generisaniProfili.length - 1; i++) {
        let profA = generisaniProfili[i], profB = generisaniProfili[i + 1];
        if (profA.length !== profB.length) continue;

        for (let j = 0; j < profA.length; j++) {
            let elA = profA[j], elB = profB[j];
            let vertices = new Float32Array([
                elA.p1.x, elA.p1.y, elA.p1.z,
                elA.p2.x, elA.p2.y, elA.p2.z,
                elB.p2.x, elB.p2.y, elB.p2.z,
                elB.p1.x, elB.p1.y, elB.p1.z
            ]);
            let geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            geom.setIndex([0, 1, 2, 0, 2, 3]);
            geom.computeVertexNormals();

            koridorMeshGroup.add(new THREE.Mesh(
                geom,
                new THREE.MeshStandardMaterial({ color: elA.boja, side: THREE.DoubleSide })
            ));
        }
    }

    let sveTacke = [...dxffilteredPoints];
    generisaniProfili.forEach(prof => prof.forEach(el => {
        if (el.ime === "nasip" || el.ime === "usjek") sveTacke.push(el.p2.x, el.p2.y, el.p2.z);
    }));

    if (terrainMesh) {
        scene.remove(terrainMesh);
        terrainMesh.geometry.dispose();
        terrainMesh.material.dispose();
    }
    let radniTerenMesh = izvorniTerenMesh.clone();

    const coords2D = new Float64Array((sveTacke.length / 3) * 2);
    for (let i = 0, j = 0; i < sveTacke.length; i += 3, j += 2) {
        coords2D[j] = sveTacke[i];
        coords2D[j + 1] = sveTacke[i + 2];
    }

    const del = new Delaunator(coords2D);
    let filtriraniIndeksi = [];
    let rezac = new THREE.Raycaster();

    for (let i = 0; i < del.triangles.length; i += 3) {
        let p1 = new THREE.Vector3(sveTacke[del.triangles[i] * 3], sveTacke[del.triangles[i] * 3 + 1], sveTacke[del.triangles[i] * 3 + 2]);
        let p2 = new THREE.Vector3(sveTacke[del.triangles[i + 1] * 3], sveTacke[del.triangles[i + 1] * 3 + 1], sveTacke[del.triangles[i + 1] * 3 + 2]);
        let p3 = new THREE.Vector3(sveTacke[del.triangles[i + 2] * 3], sveTacke[del.triangles[i + 2] * 3 + 1], sveTacke[del.triangles[i + 2] * 3 + 2]);
        let centar = new THREE.Vector3().add(p1).add(p2).add(p3).multiplyScalar(1 / 3);

        rezac.set(new THREE.Vector3(centar.x, centar.y + 1000, centar.z), new THREE.Vector3(0, -1, 0));
        let pogodakDole = rezac.intersectObject(koridorMeshGroup, true).length > 0;

        rezac.set(new THREE.Vector3(centar.x, centar.y - 1000, centar.z), new THREE.Vector3(0, 1, 0));
        let pogodakGore = rezac.intersectObject(koridorMeshGroup, true).length > 0;

        if (!pogodakDole && !pogodakGore) {
            filtriraniIndeksi.push(del.triangles[i], del.triangles[i + 1], del.triangles[i + 2]);
        }
    }

    const geomT = new THREE.BufferGeometry();
    geomT.setAttribute('position', new THREE.Float32BufferAttribute(sveTacke, 3));
    geomT.setIndex(filtriraniIndeksi);
    geomT.computeVertexNormals();

    terrainMesh = new THREE.Mesh(geomT, new THREE.MeshStandardMaterial({ color: 0x3d8b40, side: THREE.DoubleSide }));
    scene.add(terrainMesh);

    koridorIzgraden = true;
    document.getElementById('status-text').innerText = "Teren isječen!";
    REDOSLIJED_DUGMI.forEach(id => document.getElementById(id).classList.remove('glow-next'));
}

/* -------------------------------------------
   TABELA ZAPREMINA I CRTANJE 2D PREJSEKA
------------------------------------------- */
function otvoriZapremine() {
    document.getElementById('volume-panel').style.display = 'flex';
    let slider = document.getElementById('stac-slider');
    slider.max = profili2DData.length - 1;
    slider.value = 0;

    popuniTabeluZapremina();
    crtaj2DProfilZaIndeks(0);
}

function popuniTabeluZapremina() {
    let tbody = document.getElementById('vol-table-body');
    tbody.innerHTML = '';
    let ukupnoUsjek = 0, ukupnoNasip = 0;

    for (let i = 0; i < profili2DData.length; i++) {
        let data = profili2DData[i];
        let volUsjek = 0, volNasip = 0;

        if (i < profili2DData.length - 1) {
            let nextData = profili2DData[i + 1];
            let distanca = nextData.stacionaza - data.stacionaza;
            volUsjek = ((data.povrsinaUsjek + nextData.povrsinaUsjek) / 2) * distanca;
            volNasip = ((data.povrsinaNasip + nextData.povrsinaNasip) / 2) * distanca;
            ukupnoUsjek += volUsjek;
            ukupnoNasip += volNasip;
        }

        let row = `<tr>
                    <td>${data.stacionaza.toFixed(2)}</td>
                    <td>${data.povrsinaUsjek.toFixed(2)}</td>
                    <td>${data.povrsinaNasip.toFixed(2)}</td>
                    <td style="color:#e53935;">${volUsjek.toFixed(2)}</td>
                    <td style="color:#00e676;">${volNasip.toFixed(2)}</td>
                </tr>`;
        tbody.innerHTML += row;
    }

    tbody.innerHTML += `<tr class="row-total">
                <td colspan="3">UKUPNO KUBIKA (m³):</td>
                <td style="color:#ff8a80;">${ukupnoUsjek.toFixed(2)}</td>
                <td style="color:#b9f6ca;">${ukupnoNasip.toFixed(2)}</td>
            </tr>`;

    document.getElementById('tot-iskop').innerText = ukupnoUsjek.toFixed(2);
    document.getElementById('tot-nasip').innerText = ukupnoNasip.toFixed(2);
}

function crtaj2DProfilZaIndeks(indeks) {
    let data = profili2DData[indeks];
    if (!data) return;
    document.getElementById('stac-label-display').innerText = `Stacionaža: ${data.stacionaza.toFixed(2)} m`;

    const canvas = document.getElementById('sec-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth - 20;
    canvas.height = 200;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    data.tacke2D.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    minX -= 2; maxX += 2; minY -= 2; maxY += 2;
    const w = canvas.width, h = canvas.height;
    const uX = (val) => ((val - minX) / (maxX - minX)) * w;
    const uY = (val) => h - (((val - minY) / (maxY - minY)) * h);

    ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(uX(0), 0); ctx.lineTo(uX(0), h);
    ctx.stroke();

    let tCentar = data.tacke2D.find(p => p.tip === 'teren_centar');
    let cCentar = data.tacke2D.find(p => p.tip === 'cesta_centar');
    let asfD = data.tacke2D.find(p => p.tip === 'asfalt' && p.x > 0);
    let asfL = data.tacke2D.find(p => p.tip === 'asfalt' && p.x < 0);
    let dnoD = data.tacke2D.find(p => p.tip === 'tampon_dno' && p.x > 0);
    let dnoL = data.tacke2D.find(p => p.tip === 'tampon_dno' && p.x < 0);
    let bankD = data.tacke2D.find(p => p.tip === 'bankina' && p.x > 0);
    let bankL = data.tacke2D.find(p => p.tip === 'bankina' && p.x < 0);
    let dayD = data.tacke2D.find(p => p.tip === 'daylight' && p.x > 0);
    let dayL = data.tacke2D.find(p => p.tip === 'daylight' && p.x < 0);

    ctx.fillStyle = 'rgba(121, 85, 72, 0.7)';
    ctx.beginPath();
    ctx.moveTo(uX(0), uY(cCentar.y));
    ctx.lineTo(uX(asfD.x), uY(asfD.y));
    ctx.lineTo(uX(dnoD.x), uY(dnoD.y));
    ctx.lineTo(uX(0), uY(cCentar.y - (asfD.y - dnoD.y)));
    ctx.lineTo(uX(dnoL.x), uY(dnoL.y));
    ctx.lineTo(uX(asfL.x), uY(asfL.y));
    ctx.closePath();
    ctx.fill();

    function srafirajZemlju(bankina, daylight, centarTeren, dnoTampona, isNasip) {
        if (!bankina || !daylight) return;
        ctx.fillStyle = isNasip ? 'rgba(251, 192, 45, 0.4)' : 'rgba(229, 57, 53, 0.4)';
        ctx.beginPath();
        ctx.moveTo(uX(0), uY(dnoTampona.y));
        ctx.lineTo(uX(dnoTampona.x), uY(dnoTampona.y));
        ctx.lineTo(uX(dnoTampona.x), uY(bankina.y));
        ctx.lineTo(uX(bankina.x), uY(bankina.y));
        ctx.lineTo(uX(daylight.x), uY(daylight.y));
        ctx.lineTo(uX(0), uY(centarTeren.y));
        ctx.closePath();
        ctx.fill();
    }
    srafirajZemlju(bankD, dayD, tCentar, dnoD, dayD.isNasip);
    srafirajZemlju(bankL, dayL, tCentar, dnoL, dayL.isNasip);

    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(uX(asfL.x), uY(asfL.y)); ctx.lineTo(uX(cCentar.x), uY(cCentar.y)); ctx.lineTo(uX(asfD.x), uY(asfD.y)); ctx.stroke();

    ctx.strokeStyle = '#4caf50';
    ctx.beginPath(); ctx.moveTo(uX(asfL.x), uY(asfL.y)); ctx.lineTo(uX(bankL.x), uY(bankL.y)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(uX(asfD.x), uY(asfD.y)); ctx.lineTo(uX(bankD.x), uY(bankD.y)); ctx.stroke();

    ctx.strokeStyle = '#00e676'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(uX(dayL.x), uY(dayL.y)); ctx.lineTo(uX(0), uY(tCentar.y)); ctx.lineTo(uX(dayD.x), uY(dayD.y)); ctx.stroke();
    ctx.setLineDash([]);

    ctx.lineWidth = 2;
    ctx.strokeStyle = dayD.isNasip ? '#fbc02d' : '#e53935';
    ctx.beginPath(); ctx.moveTo(uX(bankD.x), uY(bankD.y)); ctx.lineTo(uX(dayD.x), uY(dayD.y)); ctx.stroke();

    ctx.strokeStyle = dayL.isNasip ? '#fbc02d' : '#e53935';
    ctx.beginPath(); ctx.moveTo(uX(bankL.x), uY(bankL.y)); ctx.lineTo(uX(dayL.x), uY(dayL.y)); ctx.stroke();
}

/* -------------------------------------------
   DXF PARSER I GENERISANJE POVRŠINE
------------------------------------------- */
function procesirajDXF(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = function (event) {
        try {
            const dxf = new DxfParser().parseSync(event.target.result);
            if (terrainMesh) { scene.remove(terrainMesh); terrainMesh = null; }

            scene.remove(dxfLinesGroup);
            dxfLinesGroup = new THREE.Group();
            scene.add(dxfLinesGroup);

            dxffilteredPoints = []; trasaPoints = []; podaciTerena = []; niveletaPoints = [];
            let siroveTacke = [];
            let maxLokalniY = -Infinity;

            dxf.entities.forEach(ent => {
                if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
                    ent.vertices.forEach(v => siroveTacke.push(new THREE.Vector3(v.x, v.z || ent.elevation || 0, -v.y)));
                }
            });

            if (siroveTacke.length === 0) return alert("U DXF-u nisu pronađene polilinije!");

            new THREE.Box3().setFromPoints(siroveTacke).getCenter(cadOffset);
            trenutniSirinaTerena = Math.max(
                new THREE.Box3().setFromPoints(siroveTacke).max.x - new THREE.Box3().setFromPoints(siroveTacke).min.x,
                new THREE.Box3().setFromPoints(siroveTacke).max.z - new THREE.Box3().setFromPoints(siroveTacke).min.z
            );

            dxf.entities.forEach(ent => {
                if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
                    const linijaTacaka = [];
                    ent.vertices.forEach(v => {
                        let p = new THREE.Vector3(v.x, v.z || ent.elevation || 0, -v.y).sub(cadOffset);
                        if (p.y > maxLokalniY) maxLokalniY = p.y;
                        dxffilteredPoints.push(p.x, p.y, p.z);
                        linijaTacaka.push(p);
                    });
                    if (ent.shape && linijaTacaka.length > 0) linijaTacaka.push(linijaTacaka[0]);
                    if (linijaTacaka.length > 1) {
                        dxfLinesGroup.add(new THREE.Line(
                            new THREE.BufferGeometry().setFromPoints(linijaTacaka),
                            new THREE.LineBasicMaterial({ color: 0x00b0ff })
                        ));
                    }
                }
            });

            bezbjednaVisinaCrtanja = maxLokalniY + (trenutniSirinaTerena * 0.1);
            document.getElementById('btn-make-surface').disabled = false;
            postaviKameruPrikaz(false);
            obiljeziSljedeceDugme('btn-load-dxf');
        } catch (err) {
            console.error(err);
        }
    };
    reader.readAsText(file);
}

function kreirajPovrsinu() {
    if (dxffilteredPoints.length === 0) return;

    const coords2D = new Float64Array((dxffilteredPoints.length / 3) * 2);
    for (let i = 0, j = 0; i < dxffilteredPoints.length; i += 3, j += 2) {
        coords2D[j] = dxffilteredPoints[i];
        coords2D[j + 1] = dxffilteredPoints[i + 2];
    }

    const del = new Delaunator(coords2D);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(dxffilteredPoints, 3));
    geom.setIndex(new THREE.BufferAttribute(new Uint32Array(del.triangles), 1));
    geom.computeVertexNormals();

    izvorniTerenMesh = geom.clone();

    terrainMesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: 0x3d8b40, side: THREE.DoubleSide }));
    scene.add(terrainMesh);

    document.getElementById('btn-draw-trasa').disabled = false;
    document.getElementById('btn-export-gltf').disabled = false;
    obiljeziSljedeceDugme('btn-make-surface');
}

/* -------------------------------------------
   KONTROLE KAMERE I RENDER
------------------------------------------- */
function toggleCrtanjeTrase() {
    isDrawingMode = !isDrawingMode;
    const btn = document.getElementById('btn-draw-trasa');
    if (isDrawingMode) {
        btn.classList.add('active-mode');
        postaviKameruPrikaz(true);
    } else {
        btn.classList.remove('active-mode');
        postaviKameruPrikaz(false);
    }
}

function postaviKameruPrikaz(topView = false) {
    const poluprecnik = Math.max(trenutniSirinaTerena / 2, 5);
    const aspect = window.innerWidth / window.innerHeight;
    controls.target.set(0, 0, 0);

    if (topView) {
        if (!cameraOrthographic) {
            cameraOrthographic = new THREE.OrthographicCamera(-poluprecnik * aspect, poluprecnik * aspect, poluprecnik, -poluprecnik, 0.1, 100000);
        } else {
            cameraOrthographic.left = -poluprecnik * aspect;
            cameraOrthographic.right = poluprecnik * aspect;
            cameraOrthographic.top = poluprecnik;
            cameraOrthographic.bottom = -poluprecnik;
        }
        camera = cameraOrthographic;
        camera.position.set(0, poluprecnik * 2, 0);
        camera.zoom = 0.85;
        controls.object = camera;
        controls.enableRotate = false;
    } else {
        if (!cameraPerspective) cameraPerspective = new THREE.PerspectiveCamera(45, aspect, 0.1, 50000);
        camera = cameraPerspective;
        camera.aspect = aspect;
        camera.position.set(poluprecnik * 1.5, poluprecnik * 1.2, poluprecnik * 1.5);
        controls.object = camera;
        controls.enableRotate = true;
    }
    camera.updateProjectionMatrix();
    controls.update();
}

function customZoomAlgoritam(event) {
    event.preventDefault();
    if (!terrainMesh && dxfLinesGroup.children.length === 0) return;

    if (camera.isOrthographicCamera) {
        camera.zoom *= (event.deltaY < 0 ? 1.1 : 0.9);
        camera.zoom = Math.max(0.1, Math.min(camera.zoom, 50));
        camera.updateProjectionMatrix();
        controls.update();
        return;
    }

    const pravac = new THREE.Vector3();
    camera.getWorldDirection(pravac);
    const udaljenost = camera.position.distanceTo(controls.target);

    let korak = udaljenost * 0.1;
    korak = Math.min(korak, trenutniSirinaTerena * 0.05);
    korak = Math.max(korak, 0.5);

    if (event.deltaY < 0 && udaljenost - korak > 2) {
        camera.position.addScaledVector(pravac, korak);
    } else if (event.deltaY > 0 && udaljenost + korak < trenutniSirinaTerena * 3) {
        camera.position.addScaledVector(pravac, -korak);
    }
    controls.update();
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    renderer.setSize(window.innerWidth, window.innerHeight);

    if (camera.isPerspectiveCamera) {
        camera.aspect = aspect;
    } else if (camera.isOrthographicCamera) {
        const poluprecnik = Math.max(trenutniSirinaTerena / 2, 5);
        camera.left = -poluprecnik * aspect;
        camera.right = poluprecnik * aspect;
        camera.top = poluprecnik;
        camera.bottom = -poluprecnik;
    }
    camera.updateProjectionMatrix();

    if (document.getElementById('profile-panel').style.display === 'block') crtajCanvasProfil();
    if (document.getElementById('volume-panel').style.display === 'flex') crtaj2DProfilZaIndeks(document.getElementById('stac-slider').value);
}

function eksportujTerenGLTF() {
    const exporter = new GLTFExporter();
    let exportGroup = new THREE.Group();

    if (terrainMesh) exportGroup.add(terrainMesh.clone());
    koridorMeshGroup.children.forEach(c => exportGroup.add(c.clone()));

    exporter.parse(exportGroup, (gltf) => {
        const blob = new Blob([JSON.stringify(gltf)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'Projektni_Koridor.gltf';
        link.click();
    }, { binary: false });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

document.addEventListener('DOMContentLoaded', () => {
    init();
});