const replicateProxy = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";

let video;
let canvas;
let feedback;
let particles = [];
let isCasting = false;
let handPose;
let hands = [];
let bodyPose;
let poses = [];

let currentStep = 1; // 1: Name, 2: Wand, 3: Transformation
let myPlayerName = "Fairy";
let myFairyColor;
let wingColor;

let spellContainer;
let nameContainer;

let fairyFilterActive = false;
let prevHandX = null;
let handVelocity = 0;
let currentObjectTransformed = null;

function setup() {
  let cw = min(windowWidth - 40, 640);
  let ch = cw * 0.75;
  canvas = createCanvas(cw, ch);
  canvas.parent('p5-container');

  let controls = createDiv();
  controls.parent('controls-container');
  controls.style('display', 'flex');
  controls.style('flex-direction', 'column');
  controls.style('align-items', 'center');
  controls.style('gap', '15px');

  let inputRow = createDiv();
  inputRow.style('display', 'flex');
  inputRow.style('flex-wrap', 'wrap');
  inputRow.style('justify-content', 'center');
  inputRow.style('gap', '10px');
  inputRow.parent(controls);

  // --- PHASE 1: NAMING ---
  nameContainer = createDiv();
  nameContainer.style('display', 'flex');
  nameContainer.style('align-items', 'center');
  nameContainer.style('gap', '10px');
  nameContainer.parent(inputRow);

  let nameInput = createInput("Your Fairy Name");
  nameInput.style('padding', '10px 15px');
  nameInput.style('border-radius', '25px');
  nameInput.style('border', '2px solid #00ffff');
  nameInput.style('background', 'rgba(20,0,40,0.8)');
  nameInput.style('color', 'white');
  nameInput.parent(nameContainer);

  let nameBtn = createButton("✨ SET NAME ✨");
  nameBtn.style('padding', '10px 20px');
  nameBtn.style('border-radius', '30px');
  nameBtn.style('background', 'linear-gradient(90deg, #00ffff, #ff00ff)');
  nameBtn.style('cursor', 'pointer');
  nameBtn.parent(nameContainer);
  nameBtn.mousePressed(() => {
    if (currentStep === 1) {
      myPlayerName = nameInput.value();
      myFairyColor = hashStringToColor(myPlayerName);
      wingColor = myFairyColor;
      nextStep(2);
      nameContainer.style('display', 'none');
      spellContainer.style('display', 'flex');
    }
  });

  // --- PHASE 2: WAND ---
  spellContainer = createDiv();
  spellContainer.style('display', 'none');
  spellContainer.style('gap', '10px');
  spellContainer.parent(inputRow);

  let itemInput = createInput("A crystal flower");
  itemInput.style('padding', '10px 15px');
  itemInput.style('border-radius', '25px');
  itemInput.parent(spellContainer);

  let castBtn = createButton("✨ CREATE WAND ✨");
  castBtn.style('padding', '10px 20px');
  castBtn.style('border-radius', '30px');
  castBtn.style('background', 'linear-gradient(90deg, #ff00ff, #00ffff)');
  castBtn.parent(spellContainer);
  castBtn.mousePressed(() => {
    castRegionalSpell(itemInput.value());
  });

  feedback = createP("Enter your name to begin...");
  feedback.style('color', '#ffbaff');
  feedback.style('font-family', 'Quicksand');
  feedback.parent(controls);

  // Video Setup (Stability fix: Physical attachment)
  video = createCapture(VIDEO, () => {
    video.size(width, height);
    if (typeof ml5 !== 'undefined') {
      handPose = ml5.handPose({ maxHands: 1 }, () => {
        handPose.detectStart(video.elt, (results) => { hands = results; });
      });
      bodyPose = ml5.bodyPose(() => {
        bodyPose.detectStart(video.elt, (results) => { poses = results; });
      });
    }
  });

  video.parent('controls-container');
  video.elt.setAttribute('playsinline', '');
  video.elt.style.position = 'absolute';
  video.elt.style.top = '-9999px';
  video.elt.play().catch(e => console.log("Mirror failed:", e));

  myFairyColor = color(200, 100, 255, 120);
  wingColor = myFairyColor;
}

function hashStringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  let h = abs(hash % 360);
  push(); colorMode(HSL); let c = color(h, 80, 70, 0.5); pop();
  return c;
}

function nextStep(step) {
  if (step <= currentStep) return;
  let prev = document.getElementById('instr-' + currentStep);
  if (prev) prev.style.display = 'none';
  currentStep = step;
  let next = document.getElementById('instr-' + currentStep);
  if (next) {
    next.style.display = 'block';
    next.classList.add('fly-in');
  }
}

function draw() {
  background(0);
  if (!video || !video.elt || video.elt.readyState < 2) {
    fill(255); textAlign(CENTER); text("✨ AWAKENING THE MIRROR ✨", width/2, height/2);
    return;
  }

  push();
  translate(width, 0); scale(-1, 1);

  if (hands.length > 0) {
    let wrist = hands[0].keypoints[0];
    if (prevHandX !== null && currentObjectTransformed) {
      let speed = abs(wrist.x - prevHandX);
      handVelocity = lerp(handVelocity, speed, 0.4);
      if (handVelocity > 10) fairyFilterActive = true;
    }
    prevHandX = wrist.x;
  }

  image(video, 0, 0, width, height);

  if (currentObjectTransformed && fairyFilterActive) {
    fill(255, 180, 255, 40); rect(0, 0, width, height);
    applyFairyGlow();
  }
  pop();

  if (currentObjectTransformed) applyObjectTransformation();
  
  // Name Tag
  if (myPlayerName !== "Fairy") {
    let nx = width/2, ny = height/2;
    if (poses.length > 0 && poses[0].nose) {
      nx = width - poses[0].nose.x; ny = poses[0].nose.y;
    }
    push();
    drawingContext.shadowBlur = 8;
    drawingContext.shadowColor = myFairyColor;
    fill(255); textAlign(CENTER); textSize(32); textFont('Caveat');
    text(myPlayerName, nx, ny - 140);
    fill(myFairyColor); ellipse(nx, ny - 110, 10, 10);
    pop();
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(); particles[i].show();
    if (particles[i].finished()) particles.splice(i, 1);
  }
  if (particles.length > 300) particles.splice(0, particles.length - 300);

  drawWand();

  if (isCasting) {
    push(); translate(width/2, height/2); rotate(frameCount*0.1); noFill(); stroke(myFairyColor); strokeWeight(10); arc(0,0,100,100,0,PI); pop();
  }
}

async function castRegionalSpell(prompt) {
  isCasting = true; feedback.html("Crafting " + prompt + "...");
  let offscreen = createGraphics(width, height);
  offscreen.translate(width, 0); offscreen.scale(-1, 1);
  offscreen.image(video, 0, 0, width, height);
  
  let postData = {
    model: "google/nano-banana",
    input: { prompt: prompt + ". glowing magical item, fairy style, black background, isolated." }
  };

  try {
    const response = await fetch(replicateProxy, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(postData) });
    const result = await response.json();
    if (result.output) {
      loadImage(result.output, (img) => {
        currentObjectTransformed = img;
        isCasting = false; feedback.html("Success! Now SHAKE your hand!");
        spellContainer.style('display', 'none');
        nextStep(3);
      });
    }
  } catch (e) { isCasting = false; feedback.html("Try again!"); }
  offscreen.remove();
}

function applyObjectTransformation() {
  push(); blendMode(SCREEN); 
  let pos = {x: width/2, y: height/2};
  if (hands.length > 0) { pos.x = width - hands[0].keypoints[0].x; pos.y = hands[0].keypoints[0].y; }
  image(currentObjectTransformed, pos.x - 100, pos.y - 100, 200, 200);
  pop();
}

function drawWand() {
  if (hands.length > 0) {
    let tip = hands[0].keypoints[8];
    let x = width - tip.x, y = tip.y;
    fill(255, 255, 200); ellipse(x, y, 12, 12);
    if (frameCount % 2 === 0) particles.push(new Particle(x, y));
  }
}

function applyFairyGlow() {
  if (poses.length > 0) {
    let p = poses[0];
    if (p.left_shoulder && p.right_shoulder) {
      fill(wingColor); noStroke();
      ellipse(width - p.left_shoulder.x - 50, p.left_shoulder.y, 100, 200);
      ellipse(width - p.right_shoulder.x + 50, p.right_shoulder.y, 100, 200);
    }
  }
}

class Particle {
  constructor(x, y) {
    this.x = x; this.y = y; this.vx = random(-1, 1); this.vy = random(-1, 1);
    this.alpha = 255; this.color = wingColor || color(255);
  }
  finished() { return this.alpha < 0; }
  update() { this.x += this.vx; this.y += this.vy; this.alpha -= 5; }
  show() { noStroke(); fill(red(this.color), green(this.color), blue(this.color), this.alpha); ellipse(this.x, this.y, 3); }
}
