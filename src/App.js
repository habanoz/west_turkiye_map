import * as THREE from 'three';
import { GUI } from 'lil-gui';
import { MapControls } from './controls/StagedZoomOrbitControl';
import Stats from 'stats-js';
import MapCanvas from './MapCanvas';
import appConfiguration from './utils/AppConfiguration';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';

let camera, scene, renderer, controls, stats, mapCanvas, gui;
const postprocessing = {};

const options = {
	dof: true,
	go2d: function () {
		camera.position.x = controls.target.x;
		camera.position.y = controls.target.y;
	},
};

class App {

	init() {
		gui = new GUI();

		camera = new THREE.PerspectiveCamera(getFov(), getAspect(), appConfiguration.cameraMinDist, appConfiguration.cameraMaxDist);
		camera.up = new THREE.Vector3(0, 0, 1);
		camera.position.set(0, 0, appConfiguration.initialElevation);

		scene = new THREE.Scene();

		this.addSky();

		stats = new Stats();
		document.body.appendChild(stats.dom);

		//this.addLight();

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(window.innerWidth, window.innerHeight);
		//renderer.shadowMap.enabled = true;
		renderer.outputEncoding = THREE.sRGBEncoding;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 0.7;

		document.body.appendChild(renderer.domElement);

		window.addEventListener('resize', onWindowResize, false);

		controls = new MapControls(camera, renderer.domElement, appConfiguration.maxZoom);
		controls.target.copy(new THREE.Vector3(camera.position.x, camera.position.y, 0));
		controls.zoomSpeed = 13.5;

		controls.minDistance = appConfiguration.cameraMinDist;
		controls.maxDistance = appConfiguration.cameraMaxDist;

		controls.addEventListener('change', () => mapCanvas.triggerRender());

		mapCanvas = new MapCanvas(scene, camera, controls);
		mapCanvas.build();
		mapCanvas.triggerRender();

		buildGui(mapCanvas);
		this.addEffect();
		gui.add(renderer, 'toneMappingExposure').onChange(mapCanvas.triggerRender);

		const buildersFolder = gui.addFolder('Builders');
		const builderKeyControl = buildersFolder.add(mapCanvas, 'mapBuilderKey').options(mapCanvas.getMapBuilderKeys());
		builderKeyControl.onChange(() => mapCanvas.switchMapBuilder());

		animate();
	}


	addSky() {
		const sky = new Sky();
		sky.scale.setScalar(4000000);
		sky.material.uniforms.up.value.set(0, 0, 1);
		scene.add(sky);

		const effectController = {
			turbidity: 10,
			rayleigh: 3,
			mieCoefficient: 0.05,
			mieDirectionalG: 0.9,
			elevation: 3000,
			azimuth: 180
		};

		const sun = new THREE.Vector3();
		const uniforms = sky.material.uniforms;
		uniforms['turbidity'].value = effectController.turbidity;
		uniforms['rayleigh'].value = effectController.rayleigh;
		uniforms['mieCoefficient'].value = effectController.mieCoefficient;
		uniforms['mieDirectionalG'].value = effectController.mieDirectionalG;

		const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
		const theta = THREE.MathUtils.degToRad(effectController.azimuth);

		sun.setFromSphericalCoords(1, phi, theta);

		uniforms['sunPosition'].value.copy(sun);
	}

	addEffect() {
		this.initPostprocessing();
		renderer.autoClear = false;

		const effectController = {

			focus: 240.0,
			aperture: 0.5,
			maxblur: 0.003

		};

		const matChanger = function () {

			postprocessing.bokeh.uniforms['focus'].value = effectController.focus;
			postprocessing.bokeh.uniforms['aperture'].value = effectController.aperture * 0.00001;
			postprocessing.bokeh.uniforms['maxblur'].value = effectController.maxblur;
			
			mapCanvas.triggerRender();
		};

		gui.add(effectController, 'focus', 10.0, 3000.0, 10).onChange(matChanger);
		gui.add(effectController, 'aperture', 0, 10, 0.1).onChange(matChanger);
		gui.add(effectController, 'maxblur', 0.0, 0.01, 0.001).onChange(matChanger);

		matChanger();
	}

	initPostprocessing() {

		const renderPass = new RenderPass(scene, camera);

		const bokehPass = new BokehPass(scene, camera, {
			focus: 1.0,
			aperture: 0.025,
			maxblur: 0.01,

			width: window.innerWidth,
			height: window.innerHeight
		});

		const composer = new EffectComposer(renderer);

		composer.addPass(renderPass);
		composer.addPass(bokehPass);

		postprocessing.composer = composer;
		postprocessing.bokeh = bokehPass;

	}

	addLight() {
		var light = new THREE.DirectionalLight(0xffffff, 1);
		light.position.set(0, 1, 1).normalize();
		light.castShadow = true;

		light.shadow.mapSize.width = 500000; // default
		light.shadow.mapSize.height = 500000; // default
		light.shadow.camera.near = 300; // default
		light.shadow.camera.far = 500000; // default

		scene.add(light);

		scene.add(new THREE.AmbientLight(0x404040));
	}
}

function getFov() {
	return 2 * Math.atan(window.innerHeight / (2 * 500)) * (180 / Math.PI);
}

function getAspect() {
	return window.innerWidth / window.innerHeight;
}

function onWindowResize() {

	camera.aspect = getAspect();
	camera.fov = getFov();
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);
	postprocessing.composer.setSize(window.innerWidth, window.innerHeight);

	mapCanvas.triggerRender();
}

function animate() {

	requestAnimationFrame(animate);

	controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true
	render();

	stats.update();
}

function render() {
	const shouldRender = mapCanvas.render();
	if (shouldRender)
		if (options.dof)
			postprocessing.composer.render(0.1);
		else
			renderer.render(scene, camera);
}

function buildGui(mapCanvas) {
	gui.add(controls, 'screenSpacePanning');
	gui.add(controls.pSphere, 'radius').onChange(render).listen();
	gui.add(controls.pSphere, 'phi').onChange(render).listen();
	gui.add(camera, 'fov').onChange(onWindowResize);
	gui.add(camera.position, 'z').onChange(render).listen();
	gui.add(controls, 'zoomLevel').listen();
	gui.add(options, 'dof');
	gui.add(options, 'go2d');
	gui.add(appConfiguration, 'showTileBorders').onChange(mapCanvas.triggerRender());
}

export default App;
