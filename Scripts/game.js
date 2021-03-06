//control/debug
let DRAW_PATHS = true;
let IDEAL_VEL = 0.0195;
let MAX_VEL = 0.03;
let NPC_SPEED = 0.01;
let GRENADE_CAST = 1.0;
let GRENADE_MOVE_DELAY = 0.5;
let GRENADE_RANGE = 130;
let GRENADE_CD = 2;
let PLAYER_GRENADE_RANGE = 175;
let COUNTDOWN_START=5;
let CLICK_WINDOW = .40; //batching 
// scene object variables
var renderer, scene, camera, pointLight, spotLight, c, instrText,prompts, canvas,canvasPosition,boundingRec, begun=false, ended=false;
//materials
var raiderMaterial, goblinMaterial, pallyMaterial, pallyBubbleMaterial,mouseMaterialBad,mouseMaterialGood;


// field variables
var fieldWidth = 500, fieldHeight = 350;

var player, playerMaterial, playerSpeed = 4, mouseRectical;

var mouseVec = new THREE.Vector3();

var bombMaterial, explosionMaterial;
var bombSpeed = 3;

//this is the point where the paladin goes to stand and then enemies converge

//variables for the different actors
var charRadius = 5, charHeight=20, charSpeed =3;
var enemyYSpread = 15;
var enemyXSpread = 15;
var numEnemies = 10;

var numRaiders = 40;
var raiderYSpread = 15; //these actually should be half as it'll be +/- the value in either direction
var raiderXSpread = 15;

var convergencePoint = new THREE.Vector3(fieldHeight*0.50,0,charHeight/2);
var enemyStartPoint = new THREE.Vector3(fieldHeight,(charRadius/2)-((enemyYSpread-1) * numEnemies)/2,charHeight/2);
var raiderStartPoint = new THREE.Vector3(0,0,charHeight/2);

var enemies = [];
var grenades = [];
var raiders = [];
var pally;
var engageTimer = 0.0, countdown=COUNTDOWN_START, clickWindowElapsed=0.0;
//var grenade, grenadePath;
//var velocity = new THREE.Vector3(0, .25, -.15);
var clock = new THREE.Clock();

var Key = {
  _pressed: {},

  A: 65,
  W: 87,
  D: 68,
  S: 83,
  G: 71,
  SPACE: 32,
  
  isDown: function(keyCode) {
    return this._pressed[keyCode];
  },
  
  onKeydown: function(event) {
    this._pressed[event.keyCode] = true;
  },
  
  onKeyup: function(event) {
    delete this._pressed[event.keyCode];
  }
};

function getMidwayPoint(pointA, pointB, pct) {
    
    var dir = pointB.clone().sub(pointA);
    var len = dir.length();
    dir = dir.normalize().multiplyScalar(len*pct);
    return pointA.clone().add(dir);
       
}

function getRandInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function pctDiff(a, b) {
 return  ( a - b ) / ( (a+b)/2 );
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
};

class Character{
	constructor(position, disposition){
		this.disposition=disposition;
		this.moving=false;
		this.atDest=false;
		this.self;
		this.t = 0.0;
		this.destPct = 1.0;
		this.bubbled=false;
		this.grenaded=false;
		this.casting=false;
		this.castingTimeEllapsed=0.0;
		this.grenadeTimeEllapsed=0.0; //wait to move for a second after grenading
		this.inGrenadeRange  =false;
		this.maxGrenadeRange = GRENADE_RANGE;

		let cylinder = new THREE.CylinderGeometry( charRadius, charRadius, charHeight,6,1);
		cylinder.rotateZ(Math.PI*.5);
		cylinder.rotateY(Math.PI*.5);
		let char;
		switch(disposition){
			case "pally":
				char = new THREE.Mesh(cylinder,pallyMaterial);
				break;
			case "raider":
				char = new THREE.Mesh(cylinder,raiderMaterial);
				//just for some variation change range for raiders
				this.maxGrenadeRange = Math.floor(getRandInRange(GRENADE_RANGE*1.25, GRENADE_RANGE*0.5));
				break;
			case "player":
				char = new THREE.Mesh(new THREE.CubeGeometry(15,	15,	15,1,1,	1),	  playerMaterial);
				break;
			default:
				//techies
				char = new THREE.Mesh(cylinder,goblinMaterial);
				this.destPct = 0.85;
		}
		char.position.copy(position);
		char.castShadow = true;
		char.receiveShadow = true;	
		scene.add(char);
		this.self = char;	
	}
	bubble(){
		if(!this.bubbled){
			let bubble = new THREE.Mesh(new THREE.SphereGeometry(((charRadius+charRadius+charHeight)/3)*1.25,6,6),
			  pallyBubbleMaterial);
			bubble.position.copy(this.self.position);
	    	scene.add(bubble);
    	}
	}
	setPath(destination){
		let path = new THREE.LineCurve3(this.self.position.clone(), destination.clone());
		this.path = path;
	}
	pulled(){
		//specific for pally
		return (this.moving || this.atDest);
	}
	getPos(){
		return this.self.position;
	}
	thrownGrenade(param){
		if(!!param){
			this.grenaded=param;
		}
		return this.grenaded;
	}
	grenadeable(){
		if(this.self.position.distanceTo(convergencePoint)<=this.maxGrenadeRange){
			this.casting=true;
			return true;
		}
		return false;
	}
	atDestination(){
		return this.atDest;
	}
	stuckWaiting(increment){
		//if GRENADE_MOVE_DELAY Has ellapsed, movement can begin
		if(this.moving && !this.casting){
			return false;
		}
		let doCheck = false;
		if(this.grenaded){
			this.grenadeTimeEllapsed+=increment;
			doCheck=true;
		}
		if(this.casting){
			this.castingTimeEllapsed+=increment;
			doCheck=true;
		}
		if(this.grenadeTimeEllapsed>=GRENADE_CD && this.disposition=="enemy"){
			this.resetGrenadeCD();
		}

		if(doCheck){
			if(this.grenadeTimeEllapsed>GRENADE_MOVE_DELAY && this.castingTimeEllapsed>GRENADE_CAST){
				return false;
			}
			return true;
		}
		return false;
	}
	resetGrenadeCD(){
		this.grenaded=false;
		this.casting=false;
		this.castingTimeEllapsed=0.0;
		this.grenadeTimeEllapsed=0.0; //wait to move for a second after grenading
	}
	doMovement(increment){
		if(!this.moving && !this.atDest){
			//initiate movement
			this.setPath(convergencePoint);
			this.moving=true;
			return true;
		}
		else if(this.moving){
			let t = this.t;
			let pt = this.path.getPoint(t);
			//pt.setZ(0); //2d path doesn't have a z axis, will disappear without this
	    	this.self.position.copy(pt);
	    	t+=NPC_SPEED;
  			if(t>=this.destPct){
		  		//reached destination, done moving (false=not moving)
		 		this.atDest=true;
		 		this.moving=false;
		 		//let them grenade again
		 		this.resetGrenadeCD();

		  		return false;
  			}
  			this.t=t;
		}
		return true;
	}
}


class Grenade{
	constructor(origin, destination){
		this.t = 0.0;
		this.path;
		this.grenade;
		this.castingStart=0.0; //simulate casting

		let travelDistance = origin.distanceTo(destination);

		//randomize speed and rotation a little for a little realism
		//let velocity = getRandInRange(.005, .015);
		this.rX = getRandInRange(.01,.1);
		this.rY = getRandInRange(.01,.1);
		this.rZ = getRandInRange(.01,.1);

		let elevation = getRandInRange(travelDistance*0.5, travelDistance);
		//rough velocity based on arc
    	this.velocity = clamp((1+pctDiff(travelDistance*.75,elevation)) * IDEAL_VEL, 0.01, MAX_VEL);
		let grenade = new THREE.Mesh(new THREE.CylinderGeometry(2,2,6,5),bombMaterial);
		grenade.position.copy(origin);
		scene.add(grenade);
		this.grenade = grenade;
		//grenadePath;
		let midPoint = getMidwayPoint(destination, grenade.position, 0.5);
		//add some elevation
		midPoint.z+=elevation;
		//let midPoint2 = getMidwayPoint(paddle2.position, midPoint1, 0.5);
		let grenadePath = new THREE.QuadraticBezierCurve3(
			new THREE.Vector3(grenade.position.x, grenade.position.y, grenade.position.z), 
			new THREE.Vector3(midPoint.x, midPoint.y, midPoint.z),
			new THREE.Vector3(destination.x, destination.y, destination.z)
		);
		this.grenadePath = grenadePath;

		if(DRAW_PATHS){
		    var material = new THREE.LineBasicMaterial({
		        color: 0xff00f0,
		    });
			var geometry = new THREE.Geometry();
		    for(var i = 0; i < grenadePath.getPoints(100).length; i++){
		        geometry.vertices.push(grenadePath.getPoints(100)[i]);  
		    }


		    //grenade.setRotationFromEuler(new THREE.Euler(0.9, 0.1, 1.5));
		    //grenade.rotateOnAxis(up, 2.8);
		    var line = new THREE.Line(geometry, material);
		    this.line=line;
		    scene.add(line);
		}



	}
	updateTrajectory(increment){
		this.castingStart+=increment;
		if(this.castingStart>GRENADE_CAST){
			let t = this.t;
			let pt = this.grenadePath.getPoint(t);
	    	this.grenade.position.copy(pt);

	 		t+=this.velocity;
	  		if(t>=1){
		  		//reached destination, remove it (false = nothing to update)
		  		scene.remove(this.grenade);
		  		scene.remove(this.path);
		  		if(DRAW_PATHS){
		  			scene.remove(this.line);
		  		}
		  		return false;
	  		}
	  		this.t=t;
			this.grenade.rotateZ(this.rZ);
	    	this.grenade.rotateX(this.rX)
	    	this.grenade.rotateY(this.rY);
		}
    	return true;
	}
}

// ------------------------------------- //
// ------- GAME FUNCTIONS -------------- //
// ------------------------------------- //

function onMouseMove(event){
	/*var rect = renderer.domElement.getBoundingClientRect();
	mouse.x = ( ( event.clientX - rect.left ) / rect.width ) * 2 - 1;
	 mouse.y = - ( ( event.clientY - rect.top ) / rect.height ) * 2 + 1;
	console.log(mouse);*/
	mouseVec.set(
	    ( event.clientX / window.innerWidth ) * 2 - 1,
	    - ( event.clientY / window.innerHeight ) * 2 + 1,
	    0 );

	mouseVec.unproject( camera );

	mouseVec.sub( camera.position ).normalize();

	var distance = - camera.position.z / mouseVec.z;
	mouseRectical.position.copy( camera.position ).add( mouseVec.multiplyScalar( distance ) );
	mouseRectical.position.setZ(5);
}

function onMouseClick(event){
	//check timers and if the recticle is green - that's literally it
	if(begun && !ended){
		hideText();
		let playerDistance = player.self.position.distanceTo(convergencePoint);
		let clickedTooFast = (clickWindowElapsed==0);
		let clickedtooLate = (clickWindowElapsed>CLICK_WINDOW);
		let newGrenade = new Grenade(player.self.position.clone(), convergencePoint);
		grenades.push(newGrenade);

		if(playerDistance<PLAYER_GRENADE_RANGE){
			//now check timer...
			if(clickWindowElapsed<=CLICK_WINDOW){
				setWinState();
				return;
			}
		}
		setFailState(clickedTooFast, clickedtooLate);
	}
}

function setup()
{	
	// set up all the 3D objects in the scene	
	createScene();
	
	// and let's get cracking!
	draw();
}

function createScene()
{
	// set the scene size
	var WIDTH = window.innerWidth,
	  HEIGHT = window.innerHeight;

	// set some camera attributes
	var VIEW_ANGLE = 70,
	  ASPECT = WIDTH / HEIGHT,
	  NEAR = 0.1,
	  FAR = 10000;

	c = document.getElementById("gameCanvas");

	// create a WebGL renderer, camera
	// and a scene
	renderer = new THREE.WebGLRenderer();
	camera =
	  new THREE.PerspectiveCamera(
		VIEW_ANGLE,
		ASPECT,
		NEAR,
		FAR);

	scene = new THREE.Scene();
	
	// set a default position for the camera
	// not doing this somehow messes up shadow rendering
	camera.position.z = 320;
	
	// start the renderer
	renderer.setSize(WIDTH, HEIGHT);

	// attach the render-supplied DOM element
	c.appendChild(renderer.domElement);
	document.addEventListener("mousemove", onMouseMove, false);
	document.addEventListener("mousedown", onMouseClick, false);
	//movement
	window.addEventListener('keyup', function(event) { Key.onKeyup(event); }, false);
	window.addEventListener('keydown', function(event) { Key.onKeydown(event); }, false);

	raiderMaterial =
	  new THREE.MeshLambertMaterial(
		{
		  color: 0x4E2EEE
		});

	// create the player's material
	playerMaterial =new THREE.MeshLambertMaterial({color: 0x1B32C0});
	pallyBubbleMaterial = new THREE.MeshLambertMaterial({
		color: 0xFAFAEB, 
		opacity: 0.1,
		transparent: true
	});
	goblinMaterial = new THREE.MeshLambertMaterial({ color: 0x008000});
	pallyMaterial = new THREE.MeshLambertMaterial({ color: 0xF58CBA});
	// create the ground's material
	var groundMaterial = new THREE.MeshLambertMaterial({color: 0x888888});
		
		
	player = new Character(raiderStartPoint, "player");
	//scene.add(player);
	player.self.receiveShadow = true;
    player.self.castShadow = true;
	
	player.self.position.x = -100;
	
	// lift player over playing surface
	player.self.position.z = 5;
	
	// iterate to create techies
	for (var i = 0; i < numEnemies; i++)
	{
		let enemy = new Character(enemyStartPoint, "enemy");
		enemies.push(enemy);
		enemyStartPoint.y+=enemyYSpread;
	}

	//iterate to create raiders, create a s
	for (var i = 0; i < numRaiders-2; i++)
	{
		let originPoint = new THREE.Vector3(0,0,0);
		originPoint.copy(raiderStartPoint);
		let x = originPoint.x;
		let y = originPoint.y;
		//randomize it a little since people can't stack for shit
		originPoint.setX(Math.floor(getRandInRange(x-raiderXSpread,x+raiderXSpread)));
		originPoint.setY(Math.floor(getRandInRange(y-raiderXSpread,y+raiderXSpread)));

		let raider = new Character(originPoint, "raider");
		raiders.push(raider);
	}

	//create paladin
	let paladinOrigin = new THREE.Vector3(0,0,0);
	paladinOrigin.copy(raiderStartPoint);
	paladinOrigin.x+=25;
	pally = new Character(paladinOrigin, "pally");

	var ground = new THREE.Mesh(

	  new THREE.CubeGeometry( 
	  1000, 
	  1000, 
	  3, 
	  1, 
	  1,
	  1 ),

	  groundMaterial);
    // set ground to arbitrary z position to best show off shadowing
	ground.position.z = 0;
	ground.receiveShadow = true;	
	scene.add(ground);		
		
	// // create a point light
	pointLight =
	  new THREE.PointLight(0xF8D898);

	// set its position
	pointLight.position.x = -1000;
	pointLight.position.y = 0;
	pointLight.position.z = 1000;
	pointLight.intensity = 1.7;
	pointLight.distance = 10000;
	// add to the scene
	scene.add(pointLight);
		
	// add a spot light
	// this is important for casting shadows
    spotLight = new THREE.SpotLight(0xF8D898);
    spotLight.position.set(-150, -100, 200);
    spotLight.intensity = 1.3;
    spotLight.castShadow = true;
    scene.add(spotLight);
	
	// MAGIC SHADOW CREATOR DELUXE EDITION with Lights PackTM DLC
	renderer.shadowMapEnabled = true;		

	//set grenade texture
	bombMaterial = new THREE.MeshLambertMaterial(
		{
		  color: 0xA80000
		});
	explosionMaterial = new THREE.MeshLambertMaterial(
		{
		  color: 0xFFAA00
		});



	mouseMaterialBad = new THREE.MeshBasicMaterial( {color: 0xFF0000} );
	mouseMaterialGood = new THREE.MeshBasicMaterial( {color: 0x008000} );
	mouseRectical = new THREE.Mesh(new THREE.TorusGeometry(20, 1,8,25), mouseMaterialBad);
	mouseRectical.position.z=-50;  //start below
	mouseRectical.position.x=0;
	mouseRectical.position.y=0;

	mouseRectical.rotateZ(Math.PI*.5);
	//mouseRectical.rotateX(Math.PI*.5);
	//mouseRectical.rotateY(Math.PI*.5);
	scene.add(mouseRectical);

	prompts = document.getElementById('prompts');
	promptsHelper = document.getElementById('prompts-helper');
	instrText = document.getElementById('instructions');
	resultsHelper = document.getElementById('results-helper');
	results = document.getElementById('results');

}
function hideText(){
	prompts.style.display='none';
	promptsHelper.style.display='none';
	instrText.style.display='none';
	results.style.display='none';
	resultsHelper.style.display='none';
}
function updatePromptText(text){
	prompts.style.display='block';
	promptsHelper.style.display='block';
	prompts.innerText=text;
}

function setFailState(fast, slow){
	hideText();
	let hahaFunnyStuff = ["Get good", "Don't try to blame the sim, it's pristine","Better hope we didn't wipe","You suck", "Loot banned", "Congrats you're gonna get raged on", "Try again", "Better luck next DMF"];
	let hahaFunnies = hahaFunnyStuff.length;
	let responseIdx = Math.floor(getRandInRange(0, hahaFunnies-1));
	results.style.display='block';
	resultsHelper.style.display='block';
	if(!!fast && fast){
		resultsHelper.innerText = 'Failure - way too fast';
	}
	else if(!!slow && slow){
		resultsHelper.innerText = 'Failure - way too fast';
	}
	else{
		resultsHelper.innerText='Failure - recticle will turn green if you are within range';
	}
	results.innerText=hahaFunnyStuff[responseIdx];
	ended=true;
}

function setWinState(){
	let hahaFunnyStuff = ["Ideal raider","You've unlocked an additional mechanic", "Several more packs to go don't get ahead of yourself", "GG", "Achievement unlocked: "];
	let hahaFunnies = hahaFunnyStuff.length;
	let responseIdx = Math.floor(getRandInRange(0, hahaFunnies-1));
	results.style.display='block';
	resultsHelper.style.display='block';
	resultsHelper.innerText='Success!';
	results.innerText=hahaFunnyStuff[responseIdx];
	ended=true;
}

function doScene(){
		let delta = clock.getDelta();
	if(!begun){
		return;
	}
	else if(ended){
		//still handle projectiles and movement till they're done for fun
		let i = grenades.length || 0;
		while (i--){
			let ret = grenades[i].updateTrajectory(delta);
			if(!ret){
				grenades.splice(i,1);
			}
		}
		for (var raider of raiders){
			let waiting = raider.stuckWaiting(delta);
			if(!waiting){
				raider.doMovement();
			}
			if(!raider.thrownGrenade() && raider.grenadeable()){
				//throw grenade
				let newGrenade = new Grenade(raider.getPos(), convergencePoint);
				grenades.push(newGrenade);
				raider.thrownGrenade(true);
			}
		}
		for (var enemy of enemies){
			let waiting = enemy.stuckWaiting(delta);
			if(!waiting){
				enemy.doMovement();
			}
		}
		return;
	}
	let paladinMoving = pally.pulled();
	
	if(paladinMoving){
		pally.doMovement();
	}
	if(pally.atDestination()){
		//initiate enemy ai (being generous)
		pally.bubble();	
		
		//launch grenades or move to enemy
		let enemiesMoving=false
		for (var enemy of enemies){
			if(!enemy.atDestination()){
				//check if they can begin their own movement
				let waiting = enemy.stuckWaiting(delta);
				if(!waiting){
					enemy.doMovement();
				}
				if(!enemy.thrownGrenade() && enemy.grenadeable()){
					//throw grenade
					let newGrenade = new Grenade(enemy.getPos(), convergencePoint);
					grenades.push(newGrenade);
					enemy.thrownGrenade(true);
				}
				enemiesMoving=true;
			}
			else{
				let waiting = enemy.stuckWaiting(delta);
				if(!waiting){
					enemy.doMovement();
				}
				let grenadeThrown=false;
				if(!enemy.thrownGrenade() && enemy.grenadeable()){
					grenadeThrown=true;
					//throw grenade
					let newGrenade = new Grenade(enemy.getPos(), convergencePoint);
					grenades.push(newGrenade);
					enemy.thrownGrenade(true);
				}
			}
		}
		if(!enemiesMoving){
			//now the FUN can start - start timer
			//only the first time
			if(countdown==5){
				updatePromptText(countdown);
			}
			engageTimer+=delta;
			if(engageTimer>1){
				engageTimer=0;
				countdown-=1;
				if(countdown>=0){
					updatePromptText(countdown);
				}
				else{
					updatePromptText(" GOOOO!!!!!");
				}
			}
			if(countdown==0){
				clickWindowElapsed+=delta;
				if(clickWindowElapsed>CLICK_WINDOW){
					ended=true;
					setFailState();
				}
				for (var raider of raiders){
					let waiting = raider.stuckWaiting(delta);
					if(!waiting){
						raider.doMovement();
					}
					if(!raider.thrownGrenade() && raider.grenadeable()){
						//throw grenade
						let newGrenade = new Grenade(raider.getPos(), convergencePoint);
						grenades.push(newGrenade);
						raider.thrownGrenade(true);
					}
				}
			}
		}

		//handle projectile paths and remove them if they reach their destination (returned true)
		let i = grenades.length || 0;
		while (i--){
			let ret = grenades[i].updateTrajectory(delta);
			if(!ret){
				grenades.splice(i,1);
			}
		}

	}
}

function draw()
{	
	renderer.render(scene, camera);
	requestAnimationFrame(draw);
	
	doScene();
	cameraPhysics();
	handleControlInput();
}


function handleControlInput()
{
	// move left
	if (Key.isDown(Key.A))		
	{
		if (player.self.position.y < fieldHeight * 0.45)
		{
			playerDirY = playerSpeed * 0.5;
		}
		else
		{
			playerDirY = 0;
			player.self.scale.z += (10 - player.self.scale.z) * 0.2;
		}
	}	
	// move right
	else if (Key.isDown(Key.D))
	{
		if (player.self.position.y > -fieldHeight * 0.45)
		{
			playerDirY = -playerSpeed * 0.5;
		}
		else
		{
			playerDirY = 0;
			player.self.scale.z += (10 - player.self.scale.z) * 0.2;
		}
	}
	else if (Key.isDown(Key.W))		
	{
		if (player.self.position.x < fieldWidth * 0.45)
		{
			playerDirX = playerSpeed * 0.5;
		}
		else
		{
			playerDirX = 0;
			player.self.scale.z += (10 - player.self.scale.z) * 0.2;
		}
	}	
	// move right
	else if (Key.isDown(Key.S))
	{
		if (player.self.position.x > -fieldWidth * 0.45)
		{
			playerDirX = -playerSpeed * 0.5;
		}
		else
		{
			playerDirX = 0;
			player.self.scale.z += (10 - player.self.scale.z) * 0.2;
		}
	}
	else if (Key.isDown(Key.SPACE))
	{
		if(!begun){
			begun=true;
			hideText();
			pally.doMovement();
		}
	}
	else
	{
		playerDirX = 0;
		playerDirY = 0;
	}
	
	player.self.scale.y += (1 - player.self.scale.y) * 0.2;	
	player.self.scale.z += (1 - player.self.scale.z) * 0.2;	
	player.self.position.y += playerDirY;
	player.self.position.x += playerDirX;
	//console.log(player.self.position);
	//check player range to update material color (in range or not)
	let mouseDistance = player.self.position.distanceTo(convergencePoint);
	if(mouseDistance<PLAYER_GRENADE_RANGE){
		mouseRectical.material = mouseMaterialGood;
	}
	else{
		mouseRectical.material = mouseMaterialBad;
	}
}

// Handles camera and lighting logic
function cameraPhysics()
{
	camera.position.x = player.self.position.x - 100;
	camera.position.y += (player.self.position.y - camera.position.y) * 0.05;
	camera.position.z = player.self.position.z + 100 + 0.04 * player.self.position.x;


	//rotate to face towards the techies
	camera.rotation.x = -0.01 * Math.PI/180;
	camera.rotation.y = -60 * Math.PI/180;
	camera.rotation.z = -90 * Math.PI/180;
}
