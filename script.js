var clicks = 0;
var size;
var auto = false;

function setup() {
  createCanvas(400, 400);
}

function draw() {
  background("beige");
  
  fill("pink");
  drawTitle();
  
  textSize(15);
  text("Current Count: " + clicks, 200, 200);
  
  setSize();
  drawCircle();
  fill("pink");
  drawAuto();
  
  if(auto && frameCount % 60 === 0){
    clicks += 2;   
  }
  
  textSize(20);
  fill("grey")
  text("<3", 200, 107);
}

function mouseClicked() {
 clicks ++; 
  var d = dist(mouseX, mouseY, 200, 250);
  if(d < 80 && clicks > 25 && !auto) {
     auto = true
    clicks -= 25
   }
}

function drawTitle() {
  textAlign("center");
  textSize(30);
  text("CLICK CLICK CLICK", 200, 30);
  }

function drawCircle() {
 noStroke();
  ellipse(200, 100, size, size); 
}

function setSize() {
  if (clicks > 100) {
  size = clicks;
  }
  else{
    size = 100
  }
}

function drawAuto() {
  noStroke();
  ellipse(200, 245, 200, 50);
  
  fill("grey");
  if(!auto) {
  text("Autoclicker: 25 clicks", 200, 250)
  }
  else {
    text("you bought /Autoclicker/!", 200, 250);
  }
}