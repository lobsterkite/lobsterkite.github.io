
// --------------------------------------------- //
// ------- 3D PONG built with Three.JS --------- //
// -------- Created by Nikhil Suresh ----------- //
// -------- Three.JS is by Mr. doob  ----------- //
// --------------------------------------------- //

// ------------------------------------- //
// ------- GLOBAL VARIABLES ------------ //
// ------------------------------------- //
//control/debug
let DRAW_PATHS = true;
let IDEAL_VEL = 0.0195;
let MAX_VEL = 0.03;
let NPC_SPEED = 0.01;
let GRENADE_CAST = 1.0;
let GRENADE_MOVE_DELAY = 0.5;
let GRENADE_RANGE = 130;

// scene object variables
var renderer, scene, camera, pointLight, spotLight, c;
//materials
var raiderMaterial, goblinMaterial, pallyMaterial, pallyBubbleMaterial;


// field variables
var fieldWidth = 500, fieldHeight = 250;

// paddle variables
var paddleWidth, paddleHeight, paddleDepth, paddleQuality;
var paddle1DirY = 0, paddle1DirX = 0, paddle2DirY = 0, paddleSpeed = 4;

var paddle1Material;

var bombMaterial, explosionMaterial;
var bombSpeed = 3;

// ball variables
var ball, paddle1, paddle2;
var ballDirX = 1, ballDirY = 1, ballSpeed = 2;

// game-related variables
var score1 = 0, score2 = 0;
// you can change this to any positive whole number
var maxScore = 7;

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

//var grenade, grenadePath;
//var velocity = new THREE.Vector3(0, .25, -.15);
var clock = new THREE.Clock();

var matrix = new THREE.Matrix4();
var up = new THREE.Vector3( -1, 1, 1 );
var axis = new THREE.Vector3( );
var pt, radians, axis, tangent;

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
		if(this.self.position.distanceTo(convergencePoint)<=GRENADE_RANGE){
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
		if(doCheck){
			if(this.grenadeTimeEllapsed>GRENADE_MOVE_DELAY && this.castingTimeEllapsed>GRENADE_CAST){
				return false;
			}
			return true;
		}
		return false;
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
		//figure out midpoint of paddle and grenade
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

	// add the camera to the scene
	//scene.add(camera);
	
	// set a default position for the camera
	// not doing this somehow messes up shadow rendering
	camera.position.z = 320;
	
	// start the renderer
	renderer.setSize(WIDTH, HEIGHT);

	// attach the render-supplied DOM element
	c.appendChild(renderer.domElement);

	raiderMaterial =
	  new THREE.MeshLambertMaterial(
		{
		  color: 0x4E2EEE
		});

	// create the paddle1's material
	paddle1Material =
	  new THREE.MeshLambertMaterial(
		{
		  color: 0x1B32C0
		});
	pallyBubbleMaterial = 
	new THREE.MeshLambertMaterial(
		{
		  color: 0xFAFAEB,
		  opacity: 0.1,
		  transparent: true
		});
	// create the pillar's material
	goblinMaterial =
	  new THREE.MeshLambertMaterial(
		{
		  color: 0x008000
		});
	pallyMaterial =
	  new THREE.MeshLambertMaterial(
		{
		  color: 0xF58CBA
		});

	// create the ground's material
	var groundMaterial =
	  new THREE.MeshLambertMaterial(
		{
		  color: 0x888888
		});
		
	// // create the sphere's material
	var sphereMaterial =
	  new THREE.MeshLambertMaterial(
		{
		  color: 0xD43001
		});
	
	// // set up the paddle vars
	paddleWidth = 10;
	paddleHeight = 30;
	paddleDepth = 10;
	paddleQuality = 1;
		
	paddle1 = new THREE.Mesh(

	  new THREE.CubeGeometry(
		paddleWidth,
		paddleHeight,
		paddleDepth,
		paddleQuality,
		paddleQuality,
		paddleQuality),

	  paddle1Material);

	// // add the sphere to the scene
	scene.add(paddle1);
	paddle1.receiveShadow = true;
    paddle1.castShadow = true;
	
	// set paddles on each side of the table
	paddle1.position.x = -fieldWidth/2 + paddleWidth;
	
	// lift paddles over playing surface
	paddle1.position.z = paddleDepth;

	//scene.add(new THREE.GridHelper(1000, 1000));	
	
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

	var loader = new THREE.FontLoader();
	var font;
	var text = "Hello World"
	var loader = new THREE.FontLoader();
	loader.load('fonts/mars_type.json', function (mars_type) {
	  font = mars_type;
	  var geometry = new THREE.TextGeometry(text, {
	    font: font,
	    size: 80,
	    height: 5,
	  });
	});

}

function doScene(){
	let delta = clock.getDelta();
	let paladinMoving = pally.pulled();
	if(Key.isDown(Key.SPACE)){
		//move paladin, once there initiate "aggro"
		paladinMoving = pally.doMovement();
	}
	
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
		}
		if(!enemiesMoving){
			//now the FUN can start
			//let ctx = c.getContext('2d');
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
	// draw THREE.JS scene
	renderer.render(scene, camera);
	// loop draw function call
	requestAnimationFrame(draw);
	doScene();
	//grenadeTrajectory();
	//ballPhysics();
	//paddlePhysics();
	cameraPhysics();
	handleKeyInput();
	//opponentPaddleMovement();
}



function createGrenades(origin, destination){
	grenade = new THREE.Mesh(new THREE.CylinderGeometry(2,2,6,5),bombMaterial);
	grenade.position.copy(origin);
	scene.add(grenade);
	//figure out midpoint of paddle and grenade
	//grenadePath;
	let midPoint = getMidwayPoint(destination, grenade.position, 0.5);
	//add some elevation
	midPoint.z+=50
	//let midPoint2 = getMidwayPoint(paddle2.position, midPoint1, 0.5);
	grenadePath = new THREE.QuadraticBezierCurve3(
		new THREE.Vector3(grenade.position.x, grenade.position.y, grenade.position.z), 
		new THREE.Vector3(midPoint.x, midPoint.y, midPoint.z),
		new THREE.Vector3(destination.x, destination.y, destination.z)
	);


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
    scene.add(line);

}
/*
class grenade{
	constructor(origin, destination){
		//create the grenade
		var grenade = new THREE.Mesh(new THREE.CylinderGeometry(2,2,6,5),bombMaterial);
		//launch the grenade, making it spin and stuff woooooo
		grenade.position = origin.position;


		//trajectory stuff
		let p_x = grenade.position.x;
		let p_y = grenade.position.y;
		let p_z = grenade.position.z;



		var sphereMaterial =
	  new THREE.MeshLambertMaterial(
		{
		  color: 0xD43001
		});
		
	// Create a ball with sphere geometry
	ball = new THREE.Mesh(

	  new THREE.SphereGeometry(
		radius,
		segments,
		rings),

	  sphereMaterial);
	}
} 
*/

function ballPhysics()
{
	// if ball goes off the 'left' side (Player's side)
	if (ball.position.x <= -fieldWidth/2)
	{	
		// CPU scores
		score2++;
		// update scoreboard HTML
		document.getElementById("scores").innerHTML = score1 + "-" + score2;
		// reset ball to center
		resetBall(2);
		matchScoreCheck();	
	}
	
	// if ball goes off the 'right' side (CPU's side)
	if (ball.position.x >= fieldWidth/2)
	{	
		// Player scores
		score1++;
		// update scoreboard HTML
		document.getElementById("scores").innerHTML = score1 + "-" + score2;
		// reset ball to center
		resetBall(1);
		matchScoreCheck();	
	}
	
	// if ball goes off the top side (side of table)
	if (ball.position.y <= -fieldHeight/2)
	{
		ballDirY = -ballDirY;
	}	
	// if ball goes off the bottom side (side of table)
	if (ball.position.y >= fieldHeight/2)
	{
		ballDirY = -ballDirY;
	}
	
	// update ball position over time
	ball.position.x += ballDirX * ballSpeed;
	ball.position.y += ballDirY * ballSpeed;
	
	// limit ball's y-speed to 2x the x-speed
	// this is so the ball doesn't speed from left to right super fast
	// keeps game playable for humans
	if (ballDirY > ballSpeed * 2)
	{
		ballDirY = ballSpeed * 2;
	}
	else if (ballDirY < -ballSpeed * 2)
	{
		ballDirY = -ballSpeed * 2;
	}
}

// Handles CPU paddle movement and logic
function opponentPaddleMovement()
{
	// Lerp towards the ball on the y plane
	paddle2DirY = (ball.position.y - paddle2.position.y) * difficulty;
	
	// in case the Lerp function produces a value above max paddle speed, we clamp it
	if (Math.abs(paddle2DirY) <= paddleSpeed)
	{	
		paddle2.position.y += paddle2DirY;
	}
	// if the lerp value is too high, we have to limit speed to paddleSpeed
	else
	{
		// if paddle is lerping in +ve direction
		if (paddle2DirY > paddleSpeed)
		{
			paddle2.position.y += paddleSpeed;
		}
		// if paddle is lerping in -ve direction
		else if (paddle2DirY < -paddleSpeed)
		{
			paddle2.position.y -= paddleSpeed;
		}
	}
	// We lerp the scale back to 1
	// this is done because we stretch the paddle at some points
	// stretching is done when paddle touches side of table and when paddle hits ball
	// by doing this here, we ensure paddle always comes back to default size
	paddle2.scale.y += (1 - paddle2.scale.y) * 0.2;	
}


// Handles player's paddle movement
function handleKeyInput()
{
	// move left
	if (Key.isDown(Key.A))		
	{
		// if paddle is not touching the side of table
		// we move
		if (paddle1.position.y < fieldHeight * 0.45)
		{
			paddle1DirY = paddleSpeed * 0.5;
		}
		// else we don't move and stretch the paddle
		// to indicate we can't move
		else
		{
			paddle1DirY = 0;
			paddle1.scale.z += (10 - paddle1.scale.z) * 0.2;
		}
	}	
	// move right
	else if (Key.isDown(Key.D))
	{
		// if paddle is not touching the side of table
		// we move
		if (paddle1.position.y > -fieldHeight * 0.45)
		{
			paddle1DirY = -paddleSpeed * 0.5;
		}
		// else we don't move and stretch the paddle
		// to indicate we can't move
		else
		{
			paddle1DirY = 0;
			paddle1.scale.z += (10 - paddle1.scale.z) * 0.2;
		}
	}
	else if (Key.isDown(Key.W))		
	{
		// if paddle is not touching the side of table
		// we move
		if (paddle1.position.x < fieldWidth * 0.45)
		{
			paddle1DirX = paddleSpeed * 0.5;
		}
		// else we don't move and stretch the paddle
		// to indicate we can't move
		else
		{
			paddle1DirX = 0;
			paddle1.scale.z += (10 - paddle1.scale.z) * 0.2;
		}
	}	
	// move right
	else if (Key.isDown(Key.S))
	{
		// if paddle is not touching the side of table
		// we move
		if (paddle1.position.x > -fieldWidth * 0.45)
		{
			paddle1DirX = -paddleSpeed * 0.5;
		}
		// else we don't move and stretch the paddle
		// to indicate we can't move
		else
		{
			paddle1DirX = 0;
			paddle1.scale.z += (10 - paddle1.scale.z) * 0.2;
		}
	}/*
	else if (Key.isDown(Key.SPACE))
	{
		// if paddle is not touching the side of table
		// we move
		if (paddle1.position.x > -fieldWidth * 0.45)
		{
			paddle1DirX = -paddleSpeed * 0.5;
		}
		// else we don't move and stretch the paddle
		// to indicate we can't move
		else
		{
			paddle1DirX = 0;
			paddle1.scale.z += (10 - paddle1.scale.z) * 0.2;
		}
	}*/
	// else don't move paddle
	else
	{
		// stop the paddle
		paddle1DirX = 0;
		paddle1DirY = 0;
	}
	
	paddle1.scale.y += (1 - paddle1.scale.y) * 0.2;	
	paddle1.scale.z += (1 - paddle1.scale.z) * 0.2;	
	paddle1.position.y += paddle1DirY;
	paddle1.position.x += paddle1DirX;
	//console.log(paddle1.position);
}

// Handles camera and lighting logic
function cameraPhysics()
{
	// we can easily notice shadows if we dynamically move lights during the game
	//spotLight.position.x = paddle1.position.x;
	//spotLight.position.y = paddle1.position.y;
	
	// move to behind the player's paddle
	camera.position.x = paddle1.position.x - 100;
	camera.position.y += (paddle1.position.y - camera.position.y) * 0.05;
	camera.position.z = paddle1.position.z + 100 + 0.04 * paddle1.position.x;
	



	// rotate to face towards the opponent
	camera.rotation.x = -0.01 * Math.PI/180;
	camera.rotation.y = -60 * Math.PI/180;
	camera.rotation.z = -90 * Math.PI/180;
}

// Handles paddle collision logic
function paddlePhysics()
{
	// PLAYER PADDLE LOGIC
	
	// if ball is aligned with paddle1 on x plane
	// remember the position is the CENTER of the object
	// we only check between the front and the middle of the paddle (one-way collision)
	if (ball.position.x <= paddle1.position.x + paddleWidth
	&&  ball.position.x >= paddle1.position.x)
	{
		// and if ball is aligned with paddle1 on y plane
		if (ball.position.y <= paddle1.position.y + paddleHeight/2
		&&  ball.position.y >= paddle1.position.y - paddleHeight/2)
		{
			// and if ball is travelling towards player (-ve direction)
			if (ballDirX < 0)
			{
				// stretch the paddle to indicate a hit
				paddle1.scale.y = 15;
				// switch direction of ball travel to create bounce
				ballDirX = -ballDirX;
				// we impact ball angle when hitting it
				// this is not realistic physics, just spices up the gameplay
				// allows you to 'slice' the ball to beat the opponent
				ballDirY -= paddle1DirY * 0.7;
			}
		}
	}
	
	// OPPONENT PADDLE LOGIC	
	
	// if ball is aligned with paddle2 on x plane
	// remember the position is the CENTER of the object
	// we only check between the front and the middle of the paddle (one-way collision)
	if (ball.position.x <= paddle2.position.x + paddleWidth
	&&  ball.position.x >= paddle2.position.x)
	{
		// and if ball is aligned with paddle2 on y plane
		if (ball.position.y <= paddle2.position.y + paddleHeight/2
		&&  ball.position.y >= paddle2.position.y - paddleHeight/2)
		{
			// and if ball is travelling towards opponent (+ve direction)
			if (ballDirX > 0)
			{
				// stretch the paddle to indicate a hit
				paddle2.scale.y = 15;	
				// switch direction of ball travel to create bounce
				ballDirX = -ballDirX;
				// we impact ball angle when hitting it
				// this is not realistic physics, just spices up the gameplay
				// allows you to 'slice' the ball to beat the opponent
				ballDirY -= paddle2DirY * 0.7;
			}
		}
	}
}

function resetBall(loser)
{
	// position the ball in the center of the table
	ball.position.x = 0;
	ball.position.y = 0;
	paddle1Material.color = new THREE.Color(0xffffff);
	paddle1Material.emissive = new THREE.Color(0xbb99ff);
	paddle1Material.needsUpdate = true;

	// if player lost the last point, we send the ball to opponent
	if (loser == 1)
	{
		ballDirX = -1;
	}
	// else if opponent lost, we send ball to player
	else
	{
		ballDirX = 1;
	}
	
	// set the ball to move +ve in y plane (towards left from the camera)
	ballDirY = 1;
}

var bounceTime = 0;
// checks if either player or opponent has reached 7 points
function matchScoreCheck()
{
	// if player has 7 points
	if (score1 >= maxScore)
	{
		// stop the ball
		ballSpeed = 0;
		// write to the banner
		document.getElementById("scores").innerHTML = "Player wins!";		
		document.getElementById("winnerBoard").innerHTML = "Refresh to play again";
		// make paddle bounce up and down
		bounceTime++;
		paddle1.position.z = Math.sin(bounceTime * 0.1) * 10;
		// enlarge and squish paddle to emulate joy
		paddle1.scale.z = 2 + Math.abs(Math.sin(bounceTime * 0.1)) * 10;
		paddle1.scale.y = 2 + Math.abs(Math.sin(bounceTime * 0.05)) * 10;
	}
	// else if opponent has 7 points
	else if (score2 >= maxScore)
	{
		// stop the ball
		ballSpeed = 0;
		// write to the banner
		document.getElementById("scores").innerHTML = "CPU wins!";
		document.getElementById("winnerBoard").innerHTML = "Refresh to play again";
		// make paddle bounce up and down
		bounceTime++;
		paddle2.position.z = Math.sin(bounceTime * 0.1) * 10;
		// enlarge and squish paddle to emulate joy
		paddle2.scale.z = 2 + Math.abs(Math.sin(bounceTime * 0.1)) * 10;
		paddle2.scale.y = 2 + Math.abs(Math.sin(bounceTime * 0.05)) * 10;
	}
}