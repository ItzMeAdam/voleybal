const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Side view constants
const GROUND_Y = canvas.height - 50;
const NET_X = canvas.width / 2;
const NET_HEIGHT = 120; // Lower net
const NET_WIDTH = 8;
const COURT_LEFT = 70;
const COURT_RIGHT = canvas.width - 70;
const COURT_TOP = GROUND_Y - 300;
const COURT_BOTTOM = GROUND_Y;

// Player and AI setup (side view positions)
const player = { x: 200, y: GROUND_Y, radius: 20, color: '#1976d2', dx: 0, dy: 0, speed: 4, vy: 0, onGround: true, jumping: false, action: null, glideVx: 0, actionTimer: 0 };
const teammate = { x: 300, y: GROUND_Y, radius: 20, color: '#64b5f6' };
const opponent1 = { x: 600, y: GROUND_Y, radius: 20, color: '#d32f2f' };
const opponent2 = { x: 700, y: GROUND_Y, radius: 20, color: '#e57373' };
const ball = { x: 350, y: GROUND_Y - 60, radius: 22, color: '#fff176', vx: 0, vy: 0 };

// Input state
const keys = {};

// Action state
let mouseDown = false;

let gameState = 'waitingForServe'; // 'waitingForServe', 'playing'

// Track touches for each bot
let teammateTouched = false;
let opponent1Touched = false;
let opponent2Touched = false;

// Team touch counters
let leftTeamTouches = 0;
let rightTeamTouches = 0;

let foulMessage = '';
let foul = false;

let isServe = false;

let lastTouchSide = null;

let outMessage = '';
let isOut = false;

let leftScore = 0;
let rightScore = 0;
let winMessage = '';

let scoreMessage = '';
let lastPlayerSpikeS = false;

let ballHasBounced = false;

// Remove ball from court until serve
const BallState = { OFF: 0, IN_PLAY: 1 };
let ballState = BallState.OFF;

// Add: Track which team serves next
let nextServeSide = 'left'; // 'left' (player) or 'right' (AI)
let aiServeTimeout = null;

// Set fixed positions for front and back bots
const OPP_FRONT_X = NET_X + 80;
const OPP_BACK_X = canvas.width - 120;

// Track last left team toucher: 'player' or 'teammate'
let lastLeftToucher = null;

// Track last right team toucher: 'opponent1' or 'opponent2'
let lastRightToucher = null;

// Add: Track if ball has crossed net after serve
let ballCrossedNetAfterServe = false;

// Define spike positions near the net
const LEFT_SPIKE_X = NET_X - 38;
const RIGHT_SPIKE_X = NET_X + 38;
const SPIKE_Y = GROUND_Y - NET_HEIGHT - 30;
const SPIKE_SET_Y = SPIKE_Y - 5; // Slightly above the net for bot spiker

// Add pause state
let isPaused = false;

// Add a flag to track if the player wants to spike
let wantToSpike = false;

function resetBotTouches() {
  teammateTouched = false;
  opponent1Touched = false;
  opponent2Touched = false;
}

function resetTeamTouches() {
  leftTeamTouches = 0;
  rightTeamTouches = 0;
  lastTouchSide = null;
}

function resetFoul() {
  foul = false;
  foulMessage = '';
  ball.color = '#fff176';
}

function resetOut() {
  isOut = false;
  outMessage = '';
  ball.color = '#fff176';
}

function resetScores() {
  leftScore = 0;
  rightScore = 0;
  winMessage = '';
}

function resetScoreMessage() {
  scoreMessage = '';
}

function drawServeMessage() {
  if (isOut) {
    ctx.font = '32px Arial';
    ctx.fillStyle = '#d32f2f';
    ctx.textAlign = 'center';
    ctx.fillText(outMessage, canvas.width / 2, GROUND_Y - 100);
    ctx.textAlign = 'start';
  } else if (foul) {
    ctx.font = '32px Arial';
    ctx.fillStyle = '#d32f2f';
    ctx.textAlign = 'center';
    ctx.fillText(foulMessage, canvas.width / 2, GROUND_Y - 100);
    ctx.textAlign = 'start';
  } else if (scoreMessage) {
    ctx.font = '32px Arial';
    ctx.fillStyle = '#388e3c';
    ctx.textAlign = 'center';
    ctx.fillText(scoreMessage, canvas.width / 2, GROUND_Y - 100);
    ctx.textAlign = 'start';
  } else if (gameState === 'waitingForServe') {
    ctx.font = '32px Arial';
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    if (nextServeSide === 'left') {
      ctx.fillText('Press G to serve', canvas.width / 2, 120);
    } else {
      ctx.fillText('Opponent is serving...', canvas.width / 2, 120);
    }
    ctx.textAlign = 'start';
  }
}

function drawTouches() {
  ctx.font = '24px Arial';
  ctx.fillStyle = '#222';
  ctx.textAlign = 'center';
  // Left team
  ctx.fillText(`Touches: ${leftTeamTouches}/3`, COURT_LEFT + 80, GROUND_Y - NET_HEIGHT - 30);
  // Right team
  ctx.fillText(`Touches: ${rightTeamTouches}/3`, COURT_RIGHT - 80, GROUND_Y - NET_HEIGHT - 30);
  ctx.textAlign = 'start';
}

function drawScores() {
  ctx.font = '32px Arial';
  ctx.fillStyle = '#222';
  ctx.textAlign = 'center';
  ctx.fillText(`${leftScore}`, COURT_LEFT + 80, GROUND_Y - NET_HEIGHT - 70);
  ctx.fillText(`${rightScore}`, COURT_RIGHT - 80, GROUND_Y - NET_HEIGHT - 70);
  ctx.textAlign = 'start';
  if (winMessage) {
    ctx.font = '40px Arial';
    ctx.fillStyle = '#1976d2';
    ctx.textAlign = 'center';
    ctx.fillText(winMessage, canvas.width / 2, 80);
    ctx.textAlign = 'start';
  }
}

function checkWin() {
  if (leftScore >= 25) {
    winMessage = 'Team 1 Wins!';
    gameState = 'waitingForServe';
  } else if (rightScore >= 25) {
    winMessage = 'Team 2 Wins!';
    gameState = 'waitingForServe';
  }
}

function assignSpikerRoles() {
  // Assign opponent1 as spiker, opponent2 as setter for now (could randomize)
  opponent1.role = 'spiker';
  opponent2.role = 'setter';
}

function rallyReset() {
  // Reset positions, touches, bot states, ball, etc. (but NOT score or winMessage)
  player.x = 200;
  player.y = GROUND_Y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.jumping = false;
  player.action = null;
  player.glideVx = 0;
  teammate.x = 300;
  teammate.y = GROUND_Y;
  teammate.vy = 0;
  teammate.onGround = true;
  teammate.jumping = false;
  teammate.action = null;
  // Only reset opponent1 (spike bot) position if next serve is NOT Team 2
  if (nextServeSide !== 'right') {
    opponent1.x = 600;
    opponent1.y = GROUND_Y;
  }
  opponent1.vy = 0;
  opponent1.onGround = true;
  opponent1.jumping = false;
  opponent1.action = null;
  opponent2.x = 700;
  opponent2.y = GROUND_Y;
  opponent2.vy = 0;
  opponent2.onGround = true;
  opponent2.jumping = false;
  opponent2.action = null;
  ball.x = player.x + 30;
  ball.y = player.y - player.radius - ball.radius - 10;
  ball.vx = 0;
  ball.vy = 0;
  gameState = 'waitingForServe';
  resetBotTouches();
  resetTeamTouches();
  resetFoul();
  resetOut();
  isServe = false;
  lastTouchSide = null;
  ballHasBounced = false;
  ballState = BallState.OFF;
  // Clear any pending AI serve
  if (aiServeTimeout) {
    clearTimeout(aiServeTimeout);
    aiServeTimeout = null;
  }
  lastLeftToucher = null;
  lastRightToucher = null;
  ballCrossedNetAfterServe = false;
  lastPlayerSpikeS = false;
  assignSpikerRoles();
}

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  keys[key] = true;
  if (key === 'r') {
    // Reset to serve position
    player.x = 200;
    player.y = GROUND_Y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.jumping = false;
    player.action = null;
    player.glideVx = 0;
    // Reset AI
    teammate.x = 300;
    teammate.y = GROUND_Y;
    teammate.vy = 0;
    teammate.onGround = true;
    teammate.jumping = false;
    teammate.action = null;
    opponent1.x = 600;
    opponent1.y = GROUND_Y;
    opponent1.vy = 0;
    opponent1.onGround = true;
    opponent1.jumping = false;
    opponent1.action = null;
    opponent2.x = 700;
    opponent2.y = GROUND_Y;
    opponent2.vy = 0;
    opponent2.onGround = true;
    opponent2.jumping = false;
    opponent2.action = null;
    ball.x = player.x + 30;
    ball.y = player.y - player.radius - ball.radius - 10;
    ball.vx = 0;
    ball.vy = 0;
    gameState = 'waitingForServe';
    resetBotTouches();
    resetTeamTouches();
    resetFoul();
    resetOut();
    resetScores();
    isServe = false;
    nextServeSide = 'left';
    return;
  }
  if (gameState === 'waitingForServe' && key === 'g' && nextServeSide === 'left') {
    // Teleport player behind court for serve
    player.x = 60;
    player.y = GROUND_Y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.jumping = false;
    player.action = null;
    player.glideVx = 0;
    // Reset AI on serve
    teammate.x = 300;
    teammate.y = GROUND_Y;
    teammate.vy = 0;
    teammate.onGround = true;
    teammate.jumping = false;
    teammate.action = null;
    opponent1.x = 600;
    opponent1.y = GROUND_Y;
    opponent1.vy = 0;
    opponent1.onGround = true;
    opponent1.jumping = false;
    opponent1.action = null;
    opponent2.x = 700;
    opponent2.y = GROUND_Y;
    opponent2.vy = 0;
    opponent2.onGround = true;
    opponent2.jumping = false;
    opponent2.action = null;
    // Serve: check for W (tilt up)
    if (keys['w']) {
      ball.x = player.x + 30;
      ball.y = player.y - player.radius - ball.radius - 10;
      ball.vx = 0.5;
      ball.vy = -10;
    } else {
      ball.x = player.x + 30;
      ball.y = player.y - player.radius - ball.radius - 10;
      ball.vx = 0.2;
      ball.vy = -6.5;
    }
    ballState = BallState.IN_PLAY;
    gameState = 'playing';
    resetBotTouches();
    resetTeamTouches();
    resetFoul();
    resetOut();
    isServe = true;
    return;
  }
  if (foul || isOut || winMessage) return;
  if (gameState !== 'playing') return;
  if (key === ' ' && player.onGround) {
    // Jump (higher, but not too high)
    player.vy = -5.8;
    player.onGround = false;
    player.jumping = true;
    player.action = 'jump';
    // Set glide velocity for jump
    if (keys['d']) {
      player.glideVx = 2.2;
    } else {
      player.glideVx = 0;
    }
  }
  if (key === 'q') {
    // Dive: dash forward or backward (buffed)
    player.action = 'dive';
    if (keys['a']) {
      player.dx = -38;
    } else if (keys['d']) {
      player.dx = 38;
    } else {
      player.dx = 38; // Default dash right
    }
    // Apply dash
    player.x += player.dx;
    // Clamp to bounds
    player.x = Math.max(player.radius, Math.min(NET_X - player.radius, player.x));
  }
  if (key === 'e') {
    if (player.jumping) {
      // Block (jump + E)
      player.action = 'block';
      // TODO: Implement block effect
    } else {
      // Set
      player.action = 'set';
      // TODO: Implement set effect
    }
  }
  if (key === 'p') {
    isPaused = !isPaused;
    if (isPaused) {
      // Pause game
      gameStateBeforePause = gameState;
      gameState = 'paused';
    } else {
      // Resume game
      gameState = gameStateBeforePause || 'playing';
    }
    return;
  }
});

document.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
  if (gameState !== 'playing') return;
  if (e.key.toLowerCase() === 'q' || e.key.toLowerCase() === 'e') {
    player.action = null;
  }
});

canvas.addEventListener('mousedown', (e) => {
  if (gameState !== 'playing') return;
  mouseDown = true;
  wantToSpike = true;
  if (!player.jumping) {
    // If not jumping, treat as bump
    player.action = 'bump';
    player.actionTimer = 8;
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (gameState !== 'playing') return;
  mouseDown = false;
  wantToSpike = false;
  if (player.action === 'bump') {
    player.action = null;
  }
});

function updatePlayer() {
  if (isPaused) return;
  // Only allow left/right movement on ground
  player.dx = 0;
  if (player.onGround) {
    if (keys['a']) player.dx = -player.speed;
    if (keys['d']) player.dx = player.speed;
    player.x += player.dx;
    // Set glide velocity for jump
    if (keys['d'] && keys[' ']) {
      player.glideVx = 2.2;
    } else {
      player.glideVx = 0;
    }
  } else {
    // In air, glide forward if jump was with D
    player.x += player.glideVx || 0;
  }
  // Floaty jump physics
  if (!player.onGround) {
    if (player.vy < 0) {
      player.vy += 0.05;
    } else {
      player.vy += 0.10;
    }
    player.y += player.vy;
    if (player.y >= GROUND_Y) {
      player.y = GROUND_Y;
      player.vy = 0;
      player.onGround = true;
      player.jumping = false;
      player.glideVx = 0;
      if (player.action === 'jump' || player.action === 'block') player.action = null;
    }
  }
  // Clamp to side view bounds and prevent crossing the net
  if (player.x < NET_X) {
    player.x = Math.max(player.radius, Math.min(NET_X - player.radius, player.x));
  } else {
    player.x = Math.max(NET_X + player.radius, Math.min(canvas.width - player.radius, player.x));
  }
  player.y = Math.min(player.y, GROUND_Y);
  // Decrement actionTimer if active
  if (player.action && player.actionTimer > 0) {
    player.actionTimer--;
    if (player.actionTimer === 0) {
      player.action = null;
    }
  }
  // If player lands, reset spike intent
  if (player.y >= GROUND_Y) {
    wantToSpike = false;
  }
}

let prevBallSide = null;
function updateBall() {
  if (ballState !== BallState.IN_PLAY) return;
  // Floaty gravity
  if (ball.vy < 0) {
    ball.vy += 0.07;
  } else {
    ball.vy += 0.13;
  }
  ball.vx *= 0.99;

  ball.x += ball.vx;
  ball.y += ball.vy;

  // Clamp y before ground logic
  if (ball.y + ball.radius > GROUND_Y) {
    ball.y = GROUND_Y - ball.radius;
  }

  // Net crossing detection
  let currentBallSide = ball.x < NET_X ? 'left' : 'right';
  if (prevBallSide && currentBallSide !== prevBallSide) {
    if (currentBallSide === 'left') {
      leftTeamTouches = 0;
    } else {
      rightTeamTouches = 0;
    }
  }
  prevBallSide = currentBallSide;

  // Out detection
  if (!isOut && ball.y + ball.radius >= GROUND_Y) {
    if (ball.x < COURT_LEFT || ball.x > COURT_RIGHT) {
      isOut = true;
      ball.color = '#d32f2f';
      // Out of bounds: point to team that did NOT last touch
      if (lastTouchSide === 'left') {
        awardPoint('Out: Team 1 hit it out!', 'right');
      } else if (lastTouchSide === 'right') {
        awardPoint('Out: Team 2 hit it out!', 'left');
      } else if (isServe) {
        // No touch after serve: receiving team gets point
        if (nextServeSide === 'left') {
          awardPoint('Out: Team 2 missed serve!', 'left');
        } else {
          awardPoint('Out: Team 1 missed serve!', 'right');
        }
      } else {
        // Default: right gets point if out on left, left gets point if out on right
        if (ball.x < NET_X) {
          awardPoint('Out: Team 1 side!', 'right');
        } else {
          awardPoint('Out: Team 2 side!', 'left');
        }
      }
      return;
    }
  }

  // In-bounds ground collision: award point and show message (only once per rally)
  if (!isOut && !foul && !winMessage && !ballHasBounced && ball.y + ball.radius >= GROUND_Y && ball.x >= COURT_LEFT && ball.x <= COURT_RIGHT) {
    ballHasBounced = true;
    // Ball lands on left side
    if (ball.x < NET_X) {
      if (lastTouchSide === 'left') {
        awardPoint('Own-goal: Team 1 last touched!', 'right');
      } else if (lastTouchSide === 'right') {
        awardPoint('Attack: Team 2 scored!', 'right');
      } else if (isServe) {
        // No touch after serve: receiving team gets point
        if (nextServeSide === 'right') {
          awardPoint('Missed serve: Team 2 did not touch!', 'left');
        } else {
          awardPoint('Missed serve: Team 1 did not touch!', 'right');
        }
      } else {
        // Default: right gets point if ball lands on left
        awardPoint('Ball landed left, no touch!', 'right');
      }
    } else { // Ball lands on right side
      if (lastTouchSide === 'right') {
        awardPoint('Own-goal: Team 2 last touched!', 'left');
      } else if (lastTouchSide === 'left') {
        awardPoint('Attack: Team 1 scored!', 'left');
      } else if (isServe) {
        if (nextServeSide === 'left') {
          awardPoint('Missed serve: Team 1 did not touch!', 'right');
        } else {
          awardPoint('Missed serve: Team 2 did not touch!', 'left');
        }
      } else {
        awardPoint('Ball landed right, no touch!', 'left');
      }
    }
    return;
  }

  // Absolutely no bounce: if the ball is on the ground, stop it
  if (ball.y + ball.radius >= GROUND_Y) {
    ball.vy = 0;
    ball.vx = 0;
  }

  // Net collision (side view) - high bounce
  if (
    ball.x + ball.radius > NET_X - NET_WIDTH/2 &&
    ball.x - ball.radius < NET_X + NET_WIDTH/2 &&
    ball.y + ball.radius > GROUND_Y - NET_HEIGHT
  ) {
    // Hit the net horizontally
    if (ball.x < NET_X) {
      ball.x = NET_X - NET_WIDTH/2 - ball.radius;
    } else {
      ball.x = NET_X + NET_WIDTH/2 + ball.radius;
    }
    ball.vx *= -0.8;
  }
  // Net top collision
  if (
    ball.x > NET_X - NET_WIDTH/2 &&
    ball.x < NET_X + NET_WIDTH/2 &&
    ball.y + ball.radius > GROUND_Y - NET_HEIGHT
  ) {
    if (ball.y < GROUND_Y - NET_HEIGHT) {
      ball.y = GROUND_Y - NET_HEIGHT - ball.radius;
      ball.vy *= -0.8;
    }
  }

  // Wall collision
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.vx *= -0.8;
  }
  if (ball.x + ball.radius > canvas.width) {
    ball.x = canvas.width - ball.radius;
    ball.vx *= -0.8;
  }

  // Track if ball has crossed the net after serve
  if (isServe && !ballCrossedNetAfterServe) {
    if ((nextServeSide === 'left' && ball.x > NET_X) || (nextServeSide === 'right' && ball.x < NET_X)) {
      ballCrossedNetAfterServe = true;
    }
  }
}

function playerBallAction() {
  if (ballState !== BallState.IN_PLAY) return;
  if (gameState !== 'playing' || foul || isOut || winMessage) return;
  const dx = ball.x - player.x;
  const dy = ball.y - (player.y - player.radius);
  const dist = Math.sqrt(dx*dx + dy*dy);
  const inHitbox = dist < player.radius + ball.radius + 18;
  if (inHitbox) {
    if (isServe) {
      isServe = false;
    }
    const validMoves = ['bump', 'set', 'spike', 'block', 'dive'];
    // If player is in the air, mouse is down, and wants to spike, treat as spike
    if (player.jumping && wantToSpike) {
      player.action = 'spike';
      player.actionTimer = 8;
    }
    if (player.action && validMoves.includes(player.action)) {
      if (lastTouchSide !== 'left') leftTeamTouches = 0;
      lastTouchSide = 'left';
      // Only handle player actions below
      switch (player.action) {
        case 'bump':
          ball.vx = (dx > 0 ? 4 : -4) + player.dx * 0.5;
          ball.vy = -4.2;
          lastPlayerSpikeS = false;
          break;
        case 'set':
          ball.vx = 0;
          ball.vy = -6.5;
          lastPlayerSpikeS = false;
          break;
        case 'spike':
          if (keys['s']) {
            if (dx > 0) {
              ball.vx = 7;
            } else {
              ball.vx = -7;
            }
            ball.vy = 10;
            lastPlayerSpikeS = true;
          } else if (keys['w']) {
            if (dx > 0) {
              ball.vx = 14;
            } else {
              ball.vx = -14;
            }
            ball.vy = 2.2;
            lastPlayerSpikeS = false;
          } else {
            if (dx > 0) {
              ball.vx = 14;
            } else {
              ball.vx = -14;
            }
            ball.vy = 7;
            lastPlayerSpikeS = false;
          }
          wantToSpike = false;
          break;
        case 'block':
          if (player.y < GROUND_Y - NET_HEIGHT + 30 && ball.y < player.y) {
            ball.vy *= -1.25;
            ball.vx *= 0.7;
          }
          lastPlayerSpikeS = false;
          break;
        case 'dive':
          ball.vx = (dx) * 0.04;
          ball.vy = -3.2;
          lastPlayerSpikeS = false;
          break;
      }
      player.action = null;
      player.actionTimer = 0;
    }
  }
}

function drawCourt() {
  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Out area (green) on both sides
  ctx.fillStyle = '#66bb6a';
  ctx.fillRect(0, GROUND_Y, 100, 30); // left out
  ctx.fillRect(canvas.width - 100, GROUND_Y, 100, 30); // right out
  // Court (grey floor)
  ctx.fillStyle = '#bdbdbd';
  ctx.fillRect(100, GROUND_Y, canvas.width - 200, 30);
  // Net (black)
  ctx.fillStyle = '#111';
  ctx.fillRect(NET_X - NET_WIDTH/2, GROUND_Y - NET_HEIGHT, NET_WIDTH, NET_HEIGHT);
}

function drawPlayer(p) {
  ctx.beginPath();
  ctx.arc(p.x, p.y - p.radius, p.radius, 0, Math.PI * 2);
  ctx.fillStyle = p.color;
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.stroke();
  // Draw action text for player
  if (p === player && player.action) {
    ctx.font = '16px Arial';
    ctx.fillStyle = '#222';
    ctx.fillText(player.action.toUpperCase(), p.x - 25, p.y - p.radius - 10);
  }
}

function drawBall() {
  if (ballState !== BallState.IN_PLAY) return;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = ball.color;
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.stroke();
}

function aiUpdate(ai, side, touchedFlagName) {
  if (gameState !== 'playing' || foul || isOut || winMessage || isPaused) return;
  // During serve, bots stay at initial positions
  if (gameState === 'waitingForServe' || isServe) {
    if (ai === teammate) {
      ai.x = 300;
      ai.y = GROUND_Y;
    } else if (ai === opponent1) {
      if (!(isServe && nextServeSide === 'right')) {
        ai.x = 600;
        ai.y = GROUND_Y;
      }
      if (ai.locked) ai.x = canvas.width - 50;
    } else if (ai === opponent2) {
      ai.x = 700;
      ai.y = GROUND_Y;
    }
    ai.vy = 0;
    ai.onGround = true;
    ai.jumping = false;
    ai.action = null;
    return;
  }
  // After serve, bots should only react if the ball has crossed the net to their side
  if (isServe && !ballCrossedNetAfterServe) {
    // Ball hasn't crossed the net yet, bots stay at default positions
    if (ai === teammate) {
      ai.x = 300;
      ai.y = GROUND_Y;
    } else if (ai === opponent1) {
      if (!(isServe && nextServeSide === 'right')) {
        ai.x = 600;
        ai.y = GROUND_Y;
      }
      if (ai.locked) ai.x = canvas.width - 50;
    } else if (ai === opponent2) {
      ai.x = 700;
      ai.y = GROUND_Y;
    }
    ai.vy = 0;
    ai.onGround = true;
    ai.jumping = false;
    ai.action = null;
    return;
  }
  // Teammate logic: only move if ball is coming toward them or will land near them
  if (ai === teammate) {
    // Predict where the ball will land (if in air and on left side)
    let predictedX = null;
    if (ball.x < NET_X && ball.vy > 0 && ball.y < GROUND_Y - 10) {
      let t = (GROUND_Y - ball.y) / ball.vy;
      predictedX = ball.x + ball.vx * t;
      predictedX = Math.max(ai.radius, Math.min(NET_X - ai.radius, predictedX));
    }
    // Only move if ball is coming toward their area (within 100px of their default x)
    let shouldMove = false;
    if (predictedX !== null && Math.abs(predictedX - 300) < 100) {
      shouldMove = true;
    }
    // If should move, go to predictedX, else return to default
    let targetX = shouldMove ? predictedX : 300;
    if (Math.abs(ai.x - targetX) > 5) {
      if (ai.x < targetX) ai.x += 3.2;
      else ai.x -= 3.2;
    }
    ai.x = Math.max(ai.radius, Math.min(NET_X - ai.radius, ai.x));
    // AI teammate jumps to set if the ball is high and within reach
    if (
      !ai.jumping && ai.onGround &&
      Math.abs(ai.x - ball.x) < 60 &&
      ball.y < ai.y - 45 &&
      ball.y > COURT_TOP + 30
    ) {
      ai.vy = -5.8;
      ai.onGround = false;
      ai.jumping = true;
      ai.action = 'jump';
    }
    // Only allow set, never bump or spike
    if (ball.y > ai.y - 30 && Math.abs(ai.x - ball.x) < 60 && Math.abs(ball.vy) > 0) {
      if (lastLeftToucher !== 'teammate') {
        ai.action = 'set';
        ball.vx = 1.5;
        ball.vy = -6.5;
        teammateTouched = true;
        lastLeftToucher = 'teammate';
        leftTeamTouches++;
        if (leftTeamTouches > 3) {
          foul = true;
          foulMessage = 'Team 1 has fouled the touch rule!';
          ball.color = '#d32f2f';
          awardFoulPoint('left');
          return;
        }
      }
    }
    // Gravity for AI
    if (!ai.onGround) {
      if (ai.vy < 0) {
        ai.vy += 0.05;
      } else {
        ai.vy += 0.10;
      }
      ai.y += ai.vy;
      if (ai.y >= GROUND_Y) {
        ai.y = GROUND_Y;
        ai.vy = 0;
        ai.onGround = true;
        ai.jumping = false;
        ai.action = null;
      }
    }
    return;
  }
  // Spiker (opponent1): move to spike position and spike after set
  if (ai === opponent1) {
    let targetX = RIGHT_SPIKE_X;
    // Move to spike position if a set is coming (rightTeamTouches >= 2)
    let shouldMove = false;
    if (
      rightTeamTouches >= 2 &&
      ball.x > NET_X &&
      ball.y < GROUND_Y - NET_HEIGHT + 60
    ) {
      shouldMove = true;
    }
    if (shouldMove && Math.abs(ai.x - targetX) > 5) {
      if (ai.x < targetX) ai.x += 3.2;
      else ai.x -= 3.2;
    } else if (!shouldMove && Math.abs(ai.x - 600) > 5) {
      // Return to default position if not spiking
      if (ai.x < 600) ai.x += 3.2;
      else ai.x -= 3.2;
    }
    ai.x = Math.max(NET_X + ai.radius, Math.min(canvas.width - ai.radius, ai.x));
    // Jump for spike if set is coming
    if (
      rightTeamTouches >= 2 &&
      (lastRightToucher === 'opponent1' || lastRightToucher === 'opponent2') &&
      ai.onGround &&
      !ai.jumping &&
      ball.vx < 0 &&
      ball.y < GROUND_Y - NET_HEIGHT + 60
    ) {
      ai.vy = -5.8;
      ai.onGround = false;
      ai.jumping = true;
      ai.action = 'jump';
      ai.hasSpiked = false;
    }
    // Spike if in air and close to ball
    if (
      !ai.onGround &&
      !ai.hasSpiked &&
      Math.abs(ai.x - RIGHT_SPIKE_X) < 18 &&
      Math.abs(ball.x - RIGHT_SPIKE_X) < 18 &&
      Math.abs(ball.y - SPIKE_SET_Y) < 30 &&
      ball.vy > 0
    ) {
      ball.vx = -14;
      ball.vy = 7;
      ai.hasSpiked = true;
    }
    // Gravity
    if (!ai.onGround) {
      if (ai.vy < 0) {
        ai.vy += 0.05;
      } else {
        ai.vy += 0.10;
      }
      ai.y += ai.vy;
      if (ai.y >= GROUND_Y) {
        ai.y = GROUND_Y;
        ai.vy = 0;
        ai.onGround = true;
        ai.jumping = false;
        ai.action = null;
        ai.hasSpiked = false;
      }
    }
    return;
  }
  // Setter (opponent2): always set toward spiker when receiving, never bump
  if (ai === opponent2) {
    let minX = NET_X + 60;
    let maxX = canvas.width - ai.radius;
    // Predict where the ball will land (if in air and on right side)
    let predictedX = null;
    if (ball.x > NET_X && ball.vy > 0 && ball.y < GROUND_Y - 10) {
      let t = (GROUND_Y - ball.y) / ball.vy;
      predictedX = ball.x + ball.vx * t;
      predictedX = Math.max(minX, Math.min(maxX, predictedX));
    }
    // Only move if ball is coming toward their area (within 100px of their default x)
    let shouldMove = false;
    if (predictedX !== null && Math.abs(predictedX - 700) < 100) {
      shouldMove = true;
    }
    let targetX = shouldMove ? predictedX : 700;
    if (Math.abs(ai.x - targetX) > 5) {
      if (ai.x < targetX) ai.x += 3.2;
      else ai.x -= 3.2;
    }
    ai.x = Math.max(minX, Math.min(maxX, ai.x));
    // Always set if close to ball (never bump)
    if (ball.y > ai.y - 30 && Math.abs(ai.x - ball.x) < 60 && Math.abs(ball.vy) > 0) {
      if (lastRightToucher !== 'opponent2') {
        ai.action = 'set';
        // Set high and toward spiker
        let towardSpiker = opponent1.x - ai.x;
        ball.vx = towardSpiker * 0.08 + 1.5;
        ball.vy = -7.5; // higher set
        opponent2Touched = true;
        lastRightToucher = 'opponent2';
        rightTeamTouches++;
        if (rightTeamTouches > 3) {
          foul = true;
          foulMessage = 'Team 2 has fouled the touch rule!';
          ball.color = '#d32f2f';
          awardFoulPoint('right');
          return;
        }
      }
    }
    // Gravity
    if (!ai.onGround) {
      if (ai.vy < 0) {
        ai.vy += 0.05;
      } else {
        ai.vy += 0.10;
      }
      ai.y += ai.vy;
      if (ai.y >= GROUND_Y) {
        ai.y = GROUND_Y;
        ai.vy = 0;
        ai.onGround = true;
        ai.jumping = false;
        ai.action = null;
      }
    }
    return;
  }
}

// AI serve logic: in gameLoop, if gameState === 'waitingForServe' and nextServeSide === 'right', trigger AI serve after a delay
function aiServe() {
  // Always pick the spike bot (opponent1) to serve
  let spiker = opponent1;
  // Teleport to grass area (right out-of-bounds, centered)
  spiker.x = canvas.width - 50; // Grass area is canvas.width - 100 to canvas.width
  spiker.y = GROUND_Y;
  spiker.onGround = true;
  spiker.jumping = false;
  spiker.locked = true; // Lock bot's x during serve
  // Place the ball in front of the spiker
  ball.x = spiker.x - 30;
  ball.y = spiker.y - spiker.radius - ball.radius - 10;
  // Bump the ball gently over the net
  // vx: leftward, vy: upward
  ball.vx = -5.5;
  ball.vy = -6.5;
  ballState = BallState.IN_PLAY;
  gameState = 'playing';
  resetBotTouches();
  resetTeamTouches();
  resetFoul();
  resetOut();
  isServe = false; // Ball is in play after bump
  // Mark touch for scoring
  opponent1Touched = true;
  rightTeamTouches = 1;
  lastTouchSide = 'right';
  lastRightToucher = 'opponent1';
  spiker.locked = false;
}

function drawPauseMenu() {
  if (!isPaused) return;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#222';
  ctx.fillRect(canvas.width / 2 - 180, canvas.height / 2 - 120, 360, 240);
  ctx.globalAlpha = 1.0;
  ctx.font = '36px Arial';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('Paused', canvas.width / 2, canvas.height / 2 - 40);
  ctx.font = '24px Arial';
  ctx.fillText(`Score: Team 1 ${leftScore} - ${rightScore} Team 2`, canvas.width / 2, canvas.height / 2 + 10);
  ctx.font = '20px Arial';
  ctx.fillText('Press P to Resume', canvas.width / 2, canvas.height / 2 + 60);
  ctx.restore();
}

// Draw scoreboard always at top
function drawScoreboard() {
  ctx.font = '32px Arial';
  ctx.fillStyle = '#1976d2';
  ctx.textAlign = 'center';
  ctx.fillText(`Team 1: ${leftScore}   |   Team 2: ${rightScore}`, canvas.width / 2, 48);
  ctx.textAlign = 'start';
}

function gameLoop() {
  drawCourt();
  updatePlayer();
  aiUpdate(teammate, 'left', 'teammateTouched');
  aiUpdate(opponent1, 'right', 'opponent1Touched');
  aiUpdate(opponent2, 'right', 'opponent2Touched');
  updateBall();
  playerBallAction();
  drawPlayer(player);
  drawPlayer(teammate);
  drawPlayer(opponent1);
  drawPlayer(opponent2);
  drawBall();
  drawServeMessage();
  drawTouches();
  drawScores();
  drawScoreboard();
  drawPauseMenu();
  if (gameState === 'waitingForServe' && nextServeSide === 'right' && !aiServeTimeout) {
    aiServeTimeout = setTimeout(() => {
      aiServe();
      aiServeTimeout = null;
    }, 1200 + Math.random() * 800);
  }
  if (!isPaused) requestAnimationFrame(gameLoop);
}

gameLoop(); 

// Centralized scoring function
function awardPoint(reason, side) {
  // side: 'left' or 'right' (the team that WON the point)
  // reason: string for debugging/UI
  if (side === 'left') {
    leftScore++;
    scoreMessage = reason || 'Team 1 scored!';
    nextServeSide = 'left';
  } else {
    rightScore++;
    scoreMessage = reason || 'Team 2 scored!';
    nextServeSide = 'right';
  }
  checkWin();
  gameState = 'waitingForServe';
  setTimeout(() => { rallyReset(); resetScoreMessage(); }, 1800);
  lastTouchSide = null;
}

// Foul logic: always award point to the OPPOSING team
function awardFoulPoint(foulingSide) {
  if (foulingSide === 'left') {
    awardPoint('Foul: Team 1!', 'right');
  } else {
    awardPoint('Foul: Team 2!', 'left');
  }
} 