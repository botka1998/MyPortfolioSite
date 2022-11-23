Ammo().then(function (Ammo) {
  // Detects webgl

  // - Global variables -
  var DISABLE_DEACTIVATION = 4;
  var TRANSFORM_AUX = new Ammo.btTransform();
  var ZERO_QUATERNION = new THREE.Quaternion(0, 0, 0, 1);

  // Graphics variables
  var container, stats, speedometer;
  var camera, controls, scene, renderer, mixer, composer;
  var terrainMesh, texture;
  var clock = new THREE.Clock();
  var materialDynamic, materialStatic, materialWheel, materialChassis;

  // Physics variables
  var collisionConfiguration;
  var dispatcher;
  var broadphase;
  var solver;
  var physicsWorld;
  var importedTexture = undefined;
  var chassisTexture = undefined;
  var chassisEmissiveTexture = undefined;
  var chassisMeshGLTF = undefined;
  var cyber_mesh = undefined;
  var importedFont = undefined;

  var syncList = [];
  var time = 0;
  var objectTimePeriod = 3;
  var timeNextSpawn = time + objectTimePeriod;
  var maxNumObjects = 30;
  let afterimagePass;
  // Keybord actions
  var actions = {};
  var keysActions = {
    KeyW: "acceleration",
    KeyS: "braking",
    KeyA: "left",
    KeyD: "right",
    KeyG: "start",
  };

  // - Functions -
  function initGraphics() {
    container = document.getElementById("container");
    speedometer = document.getElementById("speedometer");

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.2,
      2000
    );
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor(0xbfd1e5);
    renderer.setPixelRatio(window.devicePixelRatio);
    const pixelRatio = 2;
    renderer.setSize(
      Math.round(window.innerWidth * pixelRatio),
      Math.round(window.innerHeight * pixelRatio)
    );

    const canvas = renderer.domElement;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    //controls = new THREE.OrbitControls(camera, renderer.domElement);
    var ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    //UNUSED LIGHTS
    //var dirLight = new THREE.DirectionalLight(0xffffff, 1);
    //dirLight.position.set(0, 10, -500);
    //dirLight.rotateX(Math.PI / 2);
    //scene.add(dirLight);
    //var dirLight2 = new THREE.DirectionalLight(0xfffddd, 0.8);
    //dirLight2.position.set(0, 1000, 0);
    //dirLight2.rotateY(-Math.PI / 2);
    //scene.add(dirLight2);
    var pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(1000, 20, 500);
    scene.add(pointLight);
    var pointLight2 = new THREE.PointLight(0xffffff, 0.8);
    pointLight2.position.set(-1000, 20, -500);
    scene.add(pointLight2);
    materialDynamic = new THREE.MeshPhongMaterial({ color: 0xfca400 });
    materialStatic = new THREE.MeshBasicMaterial({ color: 0x000000 });
    materialChassis = new THREE.MeshPhongMaterial({
      color: 0x444544,
    });
    materialWheel = new THREE.MeshBasicMaterial({
      color: 0x000000,
    });
    //////////////////////////////////
    ///    GLOWING BLOOM EFFECT  ////
    ////////////////////////////////
    const renderScene = new THREE.RenderPass(scene, camera);
    renderer.toneMappingExposure = Math.pow(2, 4.0);
    const bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5,
      0.4,
      0.85
    );
    bloomPass.threshold = 0.1;
    bloomPass.strength = 1.5;
    bloomPass.radius = 0.1;

    composer = new THREE.EffectComposer(renderer);
    afterimagePass = new THREE.AfterimagePass();
    afterimagePass.uniforms["damp"].value = 0.9;

    composer.addPass(renderScene);

    composer.addPass(bloomPass);
    composer.addPass(afterimagePass);

    ////////////////////////
    container.innerHTML = "";

    container.appendChild(renderer.domElement);

    stats = new Stats();
    stats.domElement.style.position = "absolute";
    stats.domElement.style.top = "0px";
    container.appendChild(stats.domElement);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    //ADDED THINGS
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  }

  function initPhysics() {
    // Physics configuration
    collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
    broadphase = new Ammo.btDbvtBroadphase();
    solver = new Ammo.btSequentialImpulseConstraintSolver();
    physicsWorld = new Ammo.btDiscreteDynamicsWorld(
      dispatcher,
      broadphase,
      solver,
      collisionConfiguration
    );
    physicsWorld.setGravity(new Ammo.btVector3(0, -9.82, 0));
  }

  function tick() {
    requestAnimationFrame(tick);
    composer.render();
    var dt = clock.getDelta();
    for (var i = 0; i < syncList.length; i++) syncList[i](dt);
    physicsWorld.stepSimulation(dt, 10);
    //controls.update(dt);
    //renderer.render(scene, camera);
    time += dt;
    stats.update();
  }

  function keyup(e) {
    if (keysActions[e.code]) {
      actions[keysActions[e.code]] = false;
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }
  function keydown(e) {
    if (keysActions[e.code]) {
      actions[keysActions[e.code]] = true;

      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }

  function createBox(pos, quat, w, l, h, mass, friction, inMaterial) {
    var material = mass > 0 ? materialDynamic : materialStatic;
    material = w < 0.2 ? materialDynamic : materialStatic;
    var shape = new THREE.BoxGeometry(w, l, h, 1, 1, 1);
    var geometry = new Ammo.btBoxShape(
      new Ammo.btVector3(w * 0.5, l * 0.5, h * 0.5)
    );
    if (inMaterial) material = inMaterial;
    if (!mass) mass = 0;
    if (!friction) friction = 1;

    var mesh = new THREE.Mesh(shape, material);
    mesh.position.copy(pos);
    mesh.quaternion.copy(quat);
    scene.add(mesh);

    var transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    transform.setRotation(
      new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w)
    );
    var motionState = new Ammo.btDefaultMotionState(transform);

    var localInertia = new Ammo.btVector3(0, 0, 0);
    geometry.calculateLocalInertia(mass, localInertia);

    var rbInfo = new Ammo.btRigidBodyConstructionInfo(
      mass,
      motionState,
      geometry,
      localInertia
    );
    var body = new Ammo.btRigidBody(rbInfo);

    body.setFriction(friction);
    body.setRestitution(0.9);
    body.setDamping(0.2, 0.2);

    physicsWorld.addRigidBody(body);

    if (mass > 0) {
      body.setActivationState(DISABLE_DEACTIVATION);
      // Sync physics and graphics

      function sync(dt) {
        var ms = body.getMotionState();
        if (ms) {
          ms.getWorldTransform(TRANSFORM_AUX);
          var p = TRANSFORM_AUX.getOrigin();
          var q = TRANSFORM_AUX.getRotation();
          mesh.position.set(p.x(), p.y(), p.z());
          mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
        }
      }

      syncList.push(sync);
    }
  }
  let cyber_wheel_L;
  let cyber_wheel_R;
  function createWheelMesh(radius, width, index) {
    //var t = new THREE.CylinderGeometry(radius, radius, width, 24, 1);
    var Left = cyber_wheel_L;
    var Right = cyber_wheel_R;
    if (index === 0 || index === 3) {
      let fix = 0.01;
      Left.translate(-fix, -fix, fix);
      Left.rotateZ(-Math.PI / 2);
      Left.rotateY(Math.PI / 2);
    } else {
      let fix = 0.03;
      Right.translate(fix, -fix, fix);
      Right.rotateZ(Math.PI / 2);
      Right.rotateY(-Math.PI / 2);
    }

    var mesh = new THREE.Mesh(
      index === 0 || index === 3 ? Left : Right,
      materialWheel
    );
    scene.add(mesh);
    return mesh;
  }
  let cyber_chassis;

  function createChassisMesh(w, l, h) {
    var shape = new THREE.BoxGeometry(w, l, h, 1, 1, 1);
    cyber_chassis.center();
    cyber_chassis.rotateZ(1.6);
    cyber_chassis.rotateX(-1.6);
    cyber_chassis.translate(0, 0.1, -0.05);
    tempMaterial = new THREE.MeshPhongMaterial({
      map: chassisTexture,
    });
    var mesh = cyber_mesh; //new THREE.Mesh(cyber_chassis, tempMaterial);
    mesh.scale.set(0.001, 0.001, 0.001);
    mesh.geometry.rotateZ(Math.PI / 2);
    mesh.geometry.rotateX(-Math.PI / 2);
    scene.add(mesh);
    return mesh;
  }

  function createVehicle(pos, quat) {
    // Vehicle contants

    var chassisWidth = 2.2;
    var chassisHeight = 1.3;
    var chassisLength = 4.6;
    var massVehicle = 580;

    var wheelAxisPositionBack = -(chassisLength / 2 - 0.57);
    var wheelRadiusBack = 0.5;
    var wheelWidthBack = 0.3;
    var wheelHalfTrackBack = chassisWidth / 2 - 0.1;
    var wheelAxisHeightBack = -0.65;

    var wheelAxisFrontPosition = chassisLength / 2 - 0.2;
    var wheelRadiusFront = wheelRadiusBack;
    var wheelWidthFront = wheelWidthBack;
    var wheelHalfTrackFront = chassisWidth / 2 - 0.1;
    var wheelAxisHeightFront = wheelAxisHeightBack + 0.1;

    var friction = 3.2;
    var suspensionStiffness = 50.0;
    var suspensionDamping = 10.3;
    var suspensionCompression = 4.4;
    var suspensionRestLength = 0.05;
    var rollInfluence = 0.2;

    var steeringIncrement = 0.01;
    var steeringClamp = 0.26;
    var maxEngineForce = 1850;
    var maxBreakingForce = 70;

    // Chassis

    var geometry = new Ammo.btBoxShape(
      new Ammo.btVector3(
        chassisWidth * 0.5,
        chassisHeight * 0.5,
        chassisLength * 0.5
      )
    );
    var inertialGeometry = new Ammo.btBoxShape(
      new Ammo.btVector3(
        chassisWidth * 0.5,
        chassisHeight * 0.5,
        chassisLength * 0.5
      )
    );
    //geometry.position.translate(0, 0, 2);
    var transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    transform.setRotation(
      new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w)
    );
    var motionState = new Ammo.btDefaultMotionState(transform);
    var localInertia = new Ammo.btVector3(0, 0, 0);

    //geometry.calculateLocalInertia(massVehicle, localInertia);
    inertialGeometry.calculateLocalInertia(massVehicle, localInertia);
    var body = new Ammo.btRigidBody(
      new Ammo.btRigidBodyConstructionInfo(
        massVehicle,
        motionState,
        geometry,
        localInertia
      )
    );
    body.setActivationState(DISABLE_DEACTIVATION);
    physicsWorld.addRigidBody(body);
    var chassisMesh = createChassisMesh(
      chassisWidth,
      chassisHeight,
      chassisLength
    );

    //var chassisMesh = chassisMeshGLTF;
    // Raycast Vehicle
    var engineForce = 0;
    var vehicleSteering = 0;
    var breakingForce = 0;
    var tuning = new Ammo.btVehicleTuning();
    var rayCaster = new Ammo.btDefaultVehicleRaycaster(physicsWorld);
    var vehicle = new Ammo.btRaycastVehicle(tuning, body, rayCaster);
    vehicle.setCoordinateSystem(0, 1, 2);
    physicsWorld.addAction(vehicle);

    // Wheels
    var FRONT_LEFT = 0;
    var FRONT_RIGHT = 1;
    var BACK_LEFT = 2;
    var BACK_RIGHT = 3;
    var wheelMeshes = [];
    var wheelDirectionCS0 = new Ammo.btVector3(0, -1, 0);
    var wheelAxleCS = new Ammo.btVector3(-1, 0, 0);

    function addWheel(isFront, pos, radius, width, index) {
      var wheelInfo = vehicle.addWheel(
        pos,
        wheelDirectionCS0,
        wheelAxleCS,
        suspensionRestLength,
        radius,
        tuning,
        isFront
      );

      wheelInfo.set_m_suspensionStiffness(suspensionStiffness);
      wheelInfo.set_m_wheelsDampingRelaxation(suspensionDamping);
      wheelInfo.set_m_wheelsDampingCompression(suspensionCompression);
      wheelInfo.set_m_frictionSlip(friction);
      wheelInfo.set_m_rollInfluence(rollInfluence);

      wheelMeshes[index] = createWheelMesh(radius, width, index);
    }

    addWheel(
      true,
      new Ammo.btVector3(
        wheelHalfTrackFront - 0.03,
        wheelAxisHeightFront,
        wheelAxisFrontPosition
      ),
      wheelRadiusFront,
      wheelWidthFront,
      FRONT_LEFT
    );
    addWheel(
      true,
      new Ammo.btVector3(
        -wheelHalfTrackFront + 0.08,
        wheelAxisHeightFront,
        wheelAxisFrontPosition
      ),
      wheelRadiusFront,
      wheelWidthFront,
      FRONT_RIGHT
    );
    addWheel(
      //BACK RIGHT
      false,
      new Ammo.btVector3(
        -wheelHalfTrackBack - 0.1,
        wheelAxisHeightBack,
        wheelAxisPositionBack
      ),
      wheelRadiusBack,
      wheelWidthBack,
      BACK_LEFT
    );
    addWheel(
      //BACK LEFT
      false,
      new Ammo.btVector3(
        wheelHalfTrackBack - 0.1,
        wheelAxisHeightBack,
        wheelAxisPositionBack
      ),
      wheelRadiusBack,
      wheelWidthBack,
      BACK_RIGHT
    );

    // Sync keybord actions and physics and graphics
    function sync(dt) {
      var speed = vehicle.getCurrentSpeedKmHour();

      speedometer.innerHTML =
        (speed < 0 ? "(R) " : "") + Math.abs(speed).toFixed(1) + " km/h";

      breakingForce = 0;
      engineForce = 0;

      if (actions.acceleration) {
        if (speed < -1) breakingForce = maxBreakingForce / 1.0;
        else if (speed > 120) engineForce = 30;
        else engineForce = maxEngineForce;
      }
      if (actions.braking) {
        if (speed > 1) breakingForce = maxBreakingForce;
        else engineForce = -maxEngineForce / 1.5;
      }
      if (actions.left) {
        if (vehicleSteering < steeringClamp)
          vehicleSteering += steeringIncrement;
      } else {
        if (actions.right) {
          if (vehicleSteering > -steeringClamp)
            vehicleSteering -= steeringIncrement;
        } else {
          if (vehicleSteering < -steeringIncrement)
            vehicleSteering += steeringIncrement;
          else {
            if (vehicleSteering > steeringIncrement)
              vehicleSteering -= steeringIncrement;
            else {
              vehicleSteering = 0;
            }
          }
        }
      }

      vehicle.applyEngineForce(engineForce / 1.6, BACK_LEFT);
      vehicle.applyEngineForce(engineForce / 1.6, BACK_RIGHT);
      vehicle.applyEngineForce(engineForce * 1.5, FRONT_LEFT);
      vehicle.applyEngineForce(engineForce * 1.5, FRONT_RIGHT);

      vehicle.setBrake(breakingForce / 1.6, FRONT_LEFT);
      vehicle.setBrake(breakingForce / 1.6, FRONT_RIGHT);
      vehicle.setBrake(breakingForce, BACK_LEFT);
      vehicle.setBrake(breakingForce, BACK_RIGHT);

      vehicle.setSteeringValue(vehicleSteering, FRONT_LEFT);
      vehicle.setSteeringValue(vehicleSteering, FRONT_RIGHT);

      afterimagePass.uniforms["damp"].value = 0.42 + Math.abs(speed) / 135 / 2;

      var tm, p, q, i;
      var n = vehicle.getNumWheels();
      for (i = 0; i < n; i++) {
        vehicle.updateWheelTransform(i, true);
        tm = vehicle.getWheelTransformWS(i);
        p = tm.getOrigin();
        q = tm.getRotation();
        wheelMeshes[i].position.set(p.x(), p.y(), p.z());
        wheelMeshes[i].quaternion.set(q.x(), q.y(), q.z(), q.w());
      }

      tm = vehicle.getChassisWorldTransform();
      p = tm.getOrigin();
      q = tm.getRotation();
      chassisMesh.position.set(p.x(), p.y(), p.z());
      chassisMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());

      //CAMERA HOVER IMPLEMENTATION
      const fw = vehicle.getForwardVector();
      const offset = 7;
      let cameraOff = new THREE.Vector3(-offset * fw.x(), 5, -offset * fw.z());

      checkCar(vehicle, new THREE.Vector3(195.5, 1.5, -233), 20);
      camera.position.x = p.x() + cameraOff.x;
      camera.position.y = p.y() + 5;
      camera.position.z = p.z() + cameraOff.z;
      camera.lookAt(
        new THREE.Vector3(p.x() - cameraOff.x / 2, p.y() + 2, p.z())
      );
    }

    syncList.push(sync);
    return vehicle;
  }
  const stepSize = 1;
  var markSize = 0.3;
  function checkCar(car, point, radius) {
    if (car) {
      const tm = car.getChassisWorldTransform();
      const p = tm.getOrigin();
      const dist = Math.sqrt(
        (point.x - p.x()) * (point.x - p.x()) +
          (point.z - p.z()) * (point.z - p.z())
      );
      if (dist < radius) return dist / radius;
      else return false;
      //console.log(dist < radius);
      //console.log(p.x(), p.y(), p.z());
    }
  }
  function createTurn(start, end, radius, direction) {
    const signMul = direction === "left" ? -1 : 1;
    const l = start.distanceTo(end) / 2;
    const s = radius - Math.sqrt(radius * radius - l * l);
    const midPoint = new THREE.Vector3(
      start.x + (end.x - start.x) / 2,
      start.y + (end.y - start.y) / 2,
      start.z + (end.z - start.z) / 2
    );

    const arcCenter = new THREE.Vector3(
      start.x < end.x
        ? midPoint.x + (radius - s) * 0.7071
        : midPoint.x - (radius - s) * 0.7071,
      midPoint.y + (radius - s) * 0.7071,
      midPoint.z - (radius - s) * 0.7071
    );
    const theta = 2 * Math.asin(l / radius),
      arcLength = theta * radius,
      lineNum = Math.round(arcLength / stepSize),
      deltaTheta = theta / lineNum;

    console.log("num:", lineNum);
    console.log("start:", start);

    var lastPos = new THREE.Vector3(0, 0, -200),
      lastQuat = new THREE.Quaternion(0, 0, 0, 1),
      goalQuat = new THREE.Quaternion();
    goalQuat.setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      -(signMul * Math.PI) / 2
    );
    const off = -3;
    for (let i = 0; i < lineNum; i++) {
      let z = radius * Math.sin(i * deltaTheta);
      const x = signMul * (-radius - off + radius * Math.cos(i * deltaTheta));

      console.log(x, z);
      const pos = new THREE.Vector3(x, 0, z);
      console.log("pos", i, " :", pos);
      createBox(
        pos,
        lastQuat.rotateTowards(goalQuat, deltaTheta), //.rotateTowards(goalQuat, 0.05),
        markSize / 5,
        markSize / 5,
        markSize,
        0
      );
    }
  }
  let textMesh = undefined;
  function createObjects() {
    const material = new THREE.MeshBasicMaterial();
    material.col;
    const materialTx = new THREE.MeshPhongMaterial({
      wireframe: false,
      map: importedTexture,
      emissiveMap: importedTexture,
      emissiveIntensity: 2,
      emissive: new THREE.Color(0xffff00),
    });
    materialTx.opacity = 0.1;
    createBox(
      new THREE.Vector3(0, -0.5, 0),
      ZERO_QUATERNION,
      500,
      1,
      500,
      0,
      2,
      materialTx
    );
    const vehicle = createVehicle(
      new THREE.Vector3(195.5, 1.5, -233),
      ZERO_QUATERNION
    );
    const tempGeometry = new THREE.TextGeometry("FIN POZDRAV!", {
      font: importedFont,
      size: 2,
      height: 0.1,
    });
    const tempMaterial = new THREE.MeshStandardMaterial({
      color: 0xfca400,
      transparent: true,
    });
    const textMesh = new THREE.Mesh(tempGeometry, tempMaterial);
    scene.add(textMesh);
    textMesh.position.set(200, -3, -203);
    textMesh.rotateY(Math.PI);
    const sync = function (dt) {
      const where_car = checkCar(
        vehicle,
        new THREE.Vector3(195.5, 1.5, -233),
        10
      );
      if (where_car) {
        textMesh.position.set(200, 6 - where_car * 8, -203);
        textMesh.material.opacity = 1 - where_car / 1;
      } else textMesh.position.set(200, -3, -203);
    };
    syncList.push(sync);
  }
  function loadGLTF(url) {
    return new Promise((resolve) => {
      new THREE.GLTFLoader().load(url, resolve);
    });
  }
  function loadSTL(url) {
    return new Promise((resolve) => {
      new THREE.STLLoader().load(url, resolve);
    });
  }
  function loadFBX(url) {
    return new Promise((resolve) => {
      new THREE.FBXLoader().load(url, resolve);
    });
  }
  function loadTexture(url) {
    return new Promise((resolve) => {
      new THREE.TextureLoader().load(url, resolve);
    });
  }
  function loadFont(url) {
    return new Promise((resolve) => {
      new THREE.FontLoader().load(url, resolve);
    });
  }

  function initAll() {
    // - Init -
    initGraphics();
    initPhysics();
    createObjects();
    tick();
  }

  function importAll() {
    let p1 = loadSTL("models/cyber_chassis.stl").then((geometry) => {
      cyber_chassis = geometry;
    });
    let p2 = loadSTL("models/cyber_wheel.stl").then((geometry) => {
      cyber_wheel_L = geometry;
    });
    let p3 = loadSTL("models/cyber_wheel.stl").then((geometry) => {
      cyber_wheel_R = geometry;
    });
    let p4 = loadTexture("textures/map.jpg").then((texture) => {
      importedTexture = texture;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      importedTexture.rotation = Math.PI;
    });
    let p5 = loadTexture("textures/cyber_uv.png").then((texture) => {
      chassisTexture = texture;
    });
    let p6 = loadFBX("models/cyber_chassis.fbx").then((object) => {
      cyber_mesh = object.children[0];
    });
    let p7 = loadFont("fonts/helvetiker_regular.typeface.json").then((font) => {
      importedFont = font;
    });
    //////////////////////////////
    Promise.all([p1, p2, p3, p4, p5, p6, p7]).then(() => {
      initAll();
    });
  }
  window.addEventListener("resize", onWindowResize, false);
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);

  importAll();
});
