// Zombie Survival Game - JavaScript with PNG Sprite Assets

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Variables
let gameRunning = true;
let startTime = Date.now();
let kills = 0;
let totalEnemiesDefeated = 0;

// Image assets (dynamically created PNG-style sprites)
let playerImage = null;
let zombieImage = null;
let bulletImage = null;
let backgroundTile = null;

// Player Object
const player = {
    x: 500,
    y: 350,
    width: 30,
    height: 40,
    health: 100,
    maxHealth: 100,
    speed: 5,
    angle: 0,
    ammo: 30,
    maxAmmo: 30,
    reloadTime: 0
};

// Arrays to store game entities
let enemies = [];
let bullets = [];
let particles = [];
let bloodSplats = [];

// Keyboard input
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    if (e.key === ' ' || e.key === 'Control') {
        e.preventDefault();
    }

    if (e.key.toLowerCase() === 'r') {
        reload();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Mouse input for aiming and shooting
document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
});

document.addEventListener('click', () => {
    shoot();
});

// Create Player Sprite (PNG-style)
function createPlayerSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 30;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    
    // Body armor
    ctx.fillStyle = '#3498db';
    ctx.fillRect(5, 10, 20, 25);
    
    // Armor details
    ctx.strokeStyle = '#2980b9';
    ctx.lineWidth = 1;
    ctx.strokeRect(7, 12, 16, 21);
    
    // Head
    ctx.fillStyle = '#e8b4a8';
    ctx.beginPath();
    ctx.arc(15, 8, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Helmet outline
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(15, 8, 5.5, 0, Math.PI * 2);
    ctx.stroke();
    
    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(11, 6, 2, 2);
    ctx.fillRect(17, 6, 2, 2);
    
    // Gun barrel
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(15, 15);
    ctx.lineTo(25, 15);
    ctx.stroke();
    
    // Muzzle
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(25, 15, 2, 0, Math.PI * 2);
    ctx.stroke();
    
    return canvas;
}

// Create Zombie Sprite (PNG-style)
function createZombieSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    // Body (rotting flesh)
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(4, 8, 16, 20);
    
    // Body decay spots
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(6, 10, 3, 3);
    ctx.fillRect(15, 12, 3, 3);
    ctx.fillRect(8, 20, 2, 2);
    ctx.fillRect(16, 18, 2, 2);
    
    // Head (rotting)
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.arc(12, 6, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Skull marks
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(12, 6, 5, 0, Math.PI * 2);
    ctx.stroke();
    
    // Empty eye sockets
    ctx.fillStyle = '#000';
    ctx.fillRect(9, 4, 2.5, 2.5);
    ctx.fillRect(14.5, 4, 2.5, 2.5);
    
    // Mouth opening
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(10, 8);
    ctx.quadraticCurveTo(12, 10, 14, 8);
    ctx.stroke();
    
    // Arms (reaching)
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(4, 12);
    ctx.lineTo(0, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(20, 12);
    ctx.lineTo(24, 10);
    ctx.stroke();
    
    // Fingers
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(-1, 11);
    ctx.stroke();
    
    return canvas;
}

// Create Bullet Sprite (PNG-style)
function createBulletSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    
    // Bullet casing
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(4, 4, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Bullet tip (gold)
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(4, 2.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Glow effect
    ctx.strokeStyle = 'rgba(243, 156, 18, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(4, 4, 4.5, 0, Math.PI * 2);
    ctx.stroke();
    
    return canvas;
}

// Create Background Tile (PNG-style)
function createBackgroundTile() {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    // Base ground
    ctx.fillStyle = '#34495e';
    ctx.fillRect(0, 0, 100, 100);
    
    // Concrete tiles
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 50, 50);
    ctx.strokeRect(50, 0, 50, 50);
    ctx.strokeRect(0, 50, 50, 50);
    ctx.strokeRect(50, 50, 50, 50);
    
    // Texture details
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let i = 0; i < 15; i++) {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const size = Math.random() * 3 + 1;
        ctx.fillRect(x, y, size, size);
    }
    
    // Concrete cracks
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 25);
    ctx.quadraticCurveTo(25, 30, 50, 25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(50, 75);
    ctx.quadraticCurveTo(75, 70, 100, 75);
    ctx.stroke();
    
    return canvas;
}

// Blood Splat Class
class BloodSplat {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.life = 200;
        this.maxLife = 200;
        this.canvas = document.createElement('canvas');
        this.canvas.width = 50;
        this.canvas.height = 50;
        
        const ctx = this.canvas.getContext('2d');
        ctx.fillStyle = '#c0392b';
        
        // Draw blood splatter pattern
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            const distance = 15 + Math.random() * 5;
            const x = 25 + Math.cos(angle) * distance;
            const y = 25 + Math.sin(angle) * distance;
            const size = 5 + Math.random() * 3;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Center splash
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(25, 25, 8, 0, Math.PI * 2);
        ctx.fill();
    }

    draw() {
        ctx.globalAlpha = this.life / this.maxLife * 0.7;
        ctx.drawImage(this.canvas, this.x - 25, this.y - 25);
        ctx.globalAlpha = 1;
    }
}

// Enemy Class
class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 24;
        this.height = 32;
        this.health = 25;
        this.maxHealth = 25;
        this.speed = 2;
        this.damage = 15;
        this.attackCooldown = 0;
        this.animation = 0;
    }

    update() {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }

        if (this.attackCooldown > 0) this.attackCooldown--;
        this.animation += 0.1;
    }

    draw() {
        if (zombieImage) {
            ctx.save();
            // Add slight bobbing animation
            const bobOffset = Math.sin(this.animation) * 2;
            ctx.globalAlpha = Math.min(1, this.health / this.maxHealth);
            ctx.drawImage(zombieImage, 
                         this.x - this.width / 2, 
                         this.y - this.height / 2 + bobOffset, 
                         this.width, 
                         this.height);
            ctx.restore();
        }

        // Health bar
        const barWidth = 30;
        const barHeight = 3;
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(this.x - barWidth / 2, this.y - this.height / 2 - 10, barWidth, barHeight);
        
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barWidth / 2, this.y - this.height / 2 - 10, (this.health / this.maxHealth) * barWidth, barHeight);
    }

    takeDamage(damage) {
        this.health -= damage;
        return this.health <= 0;
    }
}

// Bullet Class
class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = 8;
        this.radius = 4;
        this.damage = 25;
        this.life = 250;
    }

    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.life--;
    }

    draw() {
        if (bulletImage) {
            ctx.drawImage(bulletImage, this.x - 4, this.y - 4, 8, 8);
        }
    }

    isOutOfBounds() {
        return this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height || this.life <= 0;
    }
}

// Particle Class
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 0.5) * 6;
        this.life = 25;
        this.maxLife = 25;
        this.color = color;
        this.size = 4;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.15;
        this.life--;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// Reload function
function reload() {
    if (player.ammo < player.maxAmmo) {
        player.reloadTime = 30;
        player.ammo = player.maxAmmo;
        updateHUD();
    }
}

// Shoot function
function shoot() {
    if (player.ammo > 0 && player.reloadTime <= 0) {
        bullets.push(new Bullet(
            player.x + Math.cos(player.angle) * 15, 
            player.y + Math.sin(player.angle) * 15, 
            player.angle
        ));
        player.ammo--;
        player.reloadTime = 3;

        if (player.ammo <= 0) {
            setTimeout(() => {
                player.ammo = player.maxAmmo;
            }, 2000);
        }

        updateHUD();
    }
}

// Update HUD
function updateHUD() {
    document.getElementById('healthValue').textContent = Math.max(0, Math.floor(player.health));
    document.getElementById('ammoValue').textContent = player.ammo;
    document.getElementById('killsValue').textContent = kills;
}

// Spawn enemies continuously
function spawnEnemies() {
    const maxEnemies = 3 + Math.floor(kills / 5);
    if (enemies.length < maxEnemies) {
        let x, y;
        if (Math.random() > 0.5) {
            x = Math.random() * canvas.width;
            y = Math.random() > 0.5 ? -20 : canvas.height + 20;
        } else {
            x = Math.random() > 0.5 ? -20 : canvas.width + 20;
            y = Math.random() * canvas.height;
        }
        enemies.push(new Enemy(x, y));
    }
}

// Update player position
function updatePlayer() {
    if (keys['w'] || keys['arrowup']) player.y -= player.speed;
    if (keys['s'] || keys['arrowdown']) player.y += player.speed;
    if (keys['a'] || keys['arrowleft']) player.x -= player.speed;
    if (keys['d'] || keys['arrowright']) player.x += player.speed;

    player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, player.x));
    player.y = Math.max(player.height / 2, Math.min(canvas.height - player.height / 2, player.y));

    if (player.reloadTime > 0) player.reloadTime--;
}

// Draw player
function drawPlayer() {
    if (playerImage) {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);
        ctx.drawImage(playerImage, -player.width / 2, -player.height / 2, player.width, player.height);
        ctx.restore();
    }

    // Health bar above player
    const barWidth = 50;
    const barHeight = 5;
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(player.x - barWidth / 2, player.y - player.height / 2 - 15, barWidth, barHeight);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(player.x - barWidth / 2, player.y - player.height / 2 - 15, (player.health / player.maxHealth) * barWidth, barHeight);
}

// Check collisions
function checkCollisions() {
    // Bullets hitting enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const dx = bullet.x - enemy.x;
            const dy = bullet.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < bullet.radius + enemy.width / 2) {
                if (enemy.takeDamage(bullet.damage)) {
                    enemies.splice(j, 1);
                    kills++;
                    totalEnemiesDefeated++;
                    bloodSplats.push(new BloodSplat(enemy.x, enemy.y));

                    for (let k = 0; k < 8; k++) {
                        particles.push(new Particle(enemy.x, enemy.y, '#e74c3c'));
                        particles.push(new Particle(enemy.x, enemy.y, '#c0392b'));
                    }
                }
                bullets.splice(i, 1);
                break;
            }
        }
    }

    // Enemies hitting player
    for (let enemy of enemies) {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < player.width / 2 + enemy.width / 2 && enemy.attackCooldown === 0) {
            player.health -= enemy.damage;
            enemy.attackCooldown = 40;
            
            for (let k = 0; k < 5; k++) {
                particles.push(new Particle(player.x, player.y, '#ff6b6b'));
            }
            
            updateHUD();

            if (player.health <= 0) {
                endGame();
            }
        }
    }
}

// End game
function endGame() {
    gameRunning = false;
    const gameOverScreen = document.getElementById('gameOverScreen');
    const survivalTime = Math.floor((Date.now() - startTime) / 1000);

    document.getElementById('finalKills').textContent = kills;
    document.getElementById('survivalTime').textContent = survivalTime;

    gameOverScreen.classList.add('active');
}

// Main game loop
function gameLoop() {
    if (!gameRunning) {
        requestAnimationFrame(gameLoop);
        return;
    }

    // Clear canvas with background tile
    if (backgroundTile) {
        for (let y = 0; y < canvas.height; y += 100) {
            for (let x = 0; x < canvas.width; x += 100) {
                ctx.drawImage(backgroundTile, x, y);
            }
        }
    } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw grid overlay
    ctx.strokeStyle = 'rgba(52, 152, 219, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }

    // Update and draw
    updatePlayer();
    spawnEnemies();
    
    // Draw blood splats
    for (let i = bloodSplats.length - 1; i >= 0; i--) {
        bloodSplats[i].draw();
        bloodSplats[i].life--;
        if (bloodSplats[i].life <= 0) {
            bloodSplats.splice(i, 1);
        }
    }

    // Draw and update bullets
    for (let bullet of bullets) {
        bullet.update();
        bullet.draw();
    }
    bullets = bullets.filter(b => !b.isOutOfBounds());

    // Draw and update enemies
    for (let enemy of enemies) {
        enemy.update();
        enemy.draw();
    }

    // Draw and update particles
    for (let particle of particles) {
        particle.update();
        particle.draw();
    }
    particles = particles.filter(p => p.life > 0);

    drawPlayer();
    checkCollisions();

    updateHUD();
    requestAnimationFrame(gameLoop);
}

// Initialize game
function initGame() {
    playerImage = createPlayerSprite();
    zombieImage = createZombieSprite();
    bulletImage = createBulletSprite();
    backgroundTile = createBackgroundTile();
    
    gameLoop();
}

// Start the game
initGame();