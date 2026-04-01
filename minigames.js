/**
 * POU AR SOLO - Mini Games Module
 * Contains Sky Climber, Head Racing, and Food Fall games
 */

// ============================================
// Base MiniGame Class
// ============================================

class MiniGame {
    constructor(canvasId, gameId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.gameElement = document.getElementById(gameId);
        this.isRunning = false;
        this.score = 0;
        this.animationId = null;
        this.lastTime = 0;
        this.resizeHandler = this.resize.bind(this);
    }
    
    init() {
        if (!this.canvas) return;
        this.resize();
        window.addEventListener('resize', this.resizeHandler);
    }
    
    resize() {
        if (!this.canvas || !this.gameElement) return;
        const rect = this.gameElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }
    
    start() {
        this.isRunning = true;
        this.score = 0;
        this.lastTime = performance.now();
        this.loop();
    }
    
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    destroy() {
        window.removeEventListener('resize', this.resizeHandler);
        this.stop();
    }

    loop() {
        if (!this.isRunning) return;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.render();
        
        if (this.isRunning) {
            this.animationId = requestAnimationFrame(() => this.loop());
        }
    }
    
    update(deltaTime) {
        // Override in subclass
    }
    
    render() {
        // Override in subclass
    }
    
    addScore(points) {
        this.score += points;
        this.updateScoreDisplay();
    }
    
    updateScoreDisplay() {
        // Override in subclass
    }
}

// ============================================
// Game 1: Sky Climber
// ============================================

class SkyClimber extends MiniGame {
    constructor() {
        super('skyClimberCanvas', 'skyClimber');
        this.pou = {
            x: 0.5,
            y: 0.8,
            width: 50,
            height: 55,
            velocityY: 0,
            onPlatform: false,
            color: '#F4A460'
        };
        this.platforms = [];
        this.camera = { y: 0 };
        this.platformSpeed = 100;
        this.jumpPower = 0.8; // Normalized relative unit
        this.gravity = 1.5;   // Normalized relative unit
        this.spawnTimer = 0;
        this.maxPlatforms = 6;
        this.stars = [];
    }
    
    init() {
        super.init();
        this.generateStars();
        this.reset();
    }
    
    generateStars() {
        this.stars = [];
        for (let i = 0; i < 50; i++) {
            this.stars.push({
                x: Math.random(),
                y: Math.random(),
                size: Math.random() * 2 + 1,
                twinkle: Math.random() * Math.PI * 2
            });
        }
    }
    
    reset() {
        this.pou.x = 0.5;
        this.pou.y = 0.8;
        this.pou.velocityY = 0;
        this.camera.y = 0;
        this.platforms = [];
        this.score = 0;
        
        // Create initial platforms
        for (let i = 0; i < 5; i++) {
            this.platforms.push({
                x: 0.3 + Math.random() * 0.4,
                y: 0.9 - i * 0.2,
                width: 0.2,
                height: 10,
                type: 'normal'
            });
        }
    }
    
    update(deltaTime) {
        const gestures = window.Engine ? window.Engine.getGestures() : { headTilt: 0 };
        
        // Move Pou horizontally based on head tilt
        this.pou.x += gestures.headTilt * deltaTime * 1.5;
        this.pou.x = Math.max(0.1, Math.min(0.9, this.pou.x));
        
        // Apply gravity using relative units
        this.pou.velocityY += this.gravity * deltaTime;
        this.pou.y += this.pou.velocityY * deltaTime;
        
        // Auto-jump when on platform
        this.pou.onPlatform = false;
        for (const platform of this.platforms) {
            const pouBottom = this.pou.y + (this.pou.height / this.canvas.height) * 0.5;
            const platformTop = platform.y;
            const pouX = this.pou.x;
            
            if (pouBottom >= platformTop && 
                pouBottom <= platformTop + 0.05 &&
                pouX >= platform.x - platform.width / 2 &&
                pouX <= platform.x + platform.width / 2 &&
                this.pou.velocityY > 0) {
                
                this.pou.velocityY = -this.jumpPower;
                this.pou.onPlatform = true;
                this.addScore(10);
                
                // Create jump particles
                this.createParticles(this.pou.x * this.canvas.width, this.pou.y * this.canvas.height);
            }
        }
        
        // Game over if fell too far
        if (this.pou.y > this.camera.y + 1.2) {
            this.reset();
        }
        
        // Move camera up as Pou climbs
        const targetCameraY = Math.max(0, this.pou.y - 0.5);
        this.camera.y += (targetCameraY - this.camera.y) * deltaTime * 2;
        
        // Spawn new platforms
        this.spawnTimer += deltaTime;
        if (this.spawnTimer > 1.5 && this.platforms.length < this.maxPlatforms) {
            this.spawnTimer = 0;
            const highestPlatform = this.platforms.reduce((min, p) => Math.min(min, p.y), Infinity);
            this.platforms.push({
                x: 0.15 + Math.random() * 0.7,
                y: highestPlatform - 0.2 - Math.random() * 0.1,
                width: 0.15 + Math.random() * 0.1,
                height: 10,
                type: Math.random() > 0.8 ? 'moving' : 'normal'
            });
        }
        
        // Remove platforms below camera
        this.platforms = this.platforms.filter(p => p.y < this.camera.y + 1.2);
        
        // Update stars
        for (const star of this.stars) {
            star.twinkle += deltaTime * 3;
        }
        
        // Update score based on height
        this.score = Math.max(this.score, Math.floor((0.8 - this.pou.y) * 100));
        this.updateScoreDisplay();
    }
    
    createParticles(x, y) {
        // Simple particle effect - handled in render
    }
    
    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Clear
        ctx.fillStyle = '#1a1a3e';
        ctx.fillRect(0, 0, w, h);
        
        // Draw gradient sky
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, '#0f0c29');
        gradient.addColorStop(0.5, '#302b63');
        gradient.addColorStop(1, '#24243e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        
        // Draw stars
        ctx.save();
        for (const star of this.stars) {
            const alpha = 0.5 + Math.sin(star.twinkle) * 0.5;
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(star.x * w, (star.y - this.camera.y * 0.1) * h, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        
        // Draw platforms
        ctx.save();
        for (const platform of this.platforms) {
            const screenY = (platform.y - this.camera.y) * h;
            if (screenY > -50 && screenY < h + 50) {
                const x = platform.x * w;
                const pw = platform.width * w;
                
                // Platform glow
                ctx.shadowColor = '#4ECDC4';
                ctx.shadowBlur = 20;
                ctx.fillStyle = '#4ECDC4';
                ctx.fillRect(x - pw / 2, screenY, pw, platform.height);
                
                // Platform top
                ctx.fillStyle = '#7FDBDA';
                ctx.fillRect(x - pw / 2, screenY, pw, 3);
            }
        }
        ctx.restore();
        
        // Draw Pou
        const pouX = this.pou.x * w;
        const pouY = (this.pou.y - this.camera.y) * h;
        this.drawPou(ctx, pouX, pouY, this.pou.width, this.pou.height);
        
        // Draw height indicator
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '14px Outfit';
        ctx.textAlign = 'left';
        ctx.fillText(`Height: ${Math.max(0, Math.floor((0.8 - this.pou.y) * 100))}m`, 20, 30);
    }
    
    drawPou(ctx, x, y, w, h) {
        ctx.save();
        
        // Body
        ctx.fillStyle = this.pou.color;
        ctx.beginPath();
        ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x - w * 0.15, y - h * 0.2, w * 0.2, h * 0.15, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x - w * 0.2, y - h * 0.1, w * 0.15, 0, Math.PI * 2);
        ctx.arc(x + w * 0.2, y - h * 0.1, w * 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        // Pupils
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x - w * 0.2, y - h * 0.1, w * 0.07, 0, Math.PI * 2);
        ctx.arc(x + w * 0.2, y - h * 0.1, w * 0.07, 0, Math.PI * 2);
        ctx.fill();
        
        // Mouth
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y + h * 0.1, w * 0.15, 0, Math.PI);
        ctx.stroke();
        
        ctx.restore();
    }
    
    updateScoreDisplay() {
        const display = document.getElementById('skyScore');
        if (display) display.textContent = this.score;
    }
}

// ============================================
// Game 2: Head Racing
// ============================================

class HeadRacing extends MiniGame {
    constructor() {
        super('headRacingCanvas', 'headRacing');
        this.pou = {
            x: 0.5,
            y: 0.7,
            width: 50,
            height: 60,
            angle: 0,
            speed: 300,
            boostMultiplier: 1
        };
        this.track = {
            width: 0.8,
            laneCount: 3,
            scrollY: 0
        };
        this.obstacles = [];
        this.coins = [];
        this.particles = [];
        this.roadMarkers = [];
        this.boostActive = false;
        this.boostTimer = 0;
        this.accumulatedScore = 0;
    }
    
    init() {
        super.init();
        this.reset();
    }
    
    reset() {
        this.pou.x = 0.5;
        this.pou.speed = 300;
        this.pou.boostMultiplier = 1;
        this.obstacles = [];
        this.coins = [];
        this.particles = [];
        this.roadMarkers = [];
        this.score = 0;
        this.accumulatedScore = 0;
        this.boostActive = false;
        this.boostTimer = 0;
        
        // Initialize road markers
        for (let i = 0; i < 10; i++) {
            this.roadMarkers.push({ y: i * 0.15 });
        }
    }
    
    update(deltaTime) {
        const gestures = window.Engine ? window.Engine.getGestures() : { 
            nosePosition: { x: 0.5 },
            eyebrowRaise: 0 
        };
        
        // Steer with nose X position
        const targetX = gestures.nosePosition.x;
        this.pou.x += (targetX - this.pou.x) * deltaTime * 5;
        this.pou.x = Math.max(0.15, Math.min(0.85, this.pou.x));
        
        // Boost with eyebrow raise
        const wasBoosting = this.boostActive;
        this.boostActive = gestures.eyebrowRaise > 0.6;
        
        if (this.boostActive) {
            this.pou.boostMultiplier = 2;
            this.boostTimer += deltaTime;
            
            // Create boost particles
            if (Math.random() > 0.3) {
                this.particles.push({
                    x: this.pou.x + (Math.random() - 0.5) * 0.1,
                    y: this.pou.y + 0.1,
                    vx: (Math.random() - 0.5) * 0.1,
                    vy: 0.3 + Math.random() * 0.2,
                    life: 0.5,
                    color: '#FFD700'
                });
            }
            
            // Update UI
            const indicator = document.getElementById('boostIndicator');
            if (indicator) indicator.classList.add('active');
            
            // Trigger angry expression on Pou
            const pouElement = document.getElementById('pou');
            if (pouElement && !wasBoosting) {
                pouElement.classList.remove('normal', 'happy', 'sad', 'surprised', 'eating', 'sleeping');
                pouElement.classList.add('angry');
            }
        } else {
            this.pou.boostMultiplier = 1;
            this.boostTimer = 0;
            
            const indicator = document.getElementById('boostIndicator');
            if (indicator) indicator.classList.remove('active');
            
            // Reset expression
            const pouElement = document.getElementById('pou');
            if (pouElement && wasBoosting) {
                pouElement.classList.remove('angry');
                pouElement.classList.add('normal');
            }
        }
        
        // Move road
        const moveSpeed = this.pou.speed * this.pou.boostMultiplier * deltaTime / this.canvas.height;
        this.track.scrollY += moveSpeed;
        if (this.track.scrollY > 0.15) this.track.scrollY = 0;
        
        // Update road markers
        for (const marker of this.roadMarkers) {
            marker.y += moveSpeed;
            if (marker.y > 1) marker.y -= 1.5;
        }
        
        // Spawn obstacles
        if (Math.random() < 0.02 * this.pou.boostMultiplier) {
            const lane = Math.floor(Math.random() * 3);
            const laneWidth = this.track.width / 3;
            const x = 0.5 - this.track.width / 2 + laneWidth * (lane + 0.5);
            this.obstacles.push({
                x: x,
                y: -0.1,
                width: 0.08,
                height: 0.08,
                type: Math.random() > 0.5 ? 'rock' : 'cone'
            });
        }
        
        // Spawn coins
        if (Math.random() < 0.015) {
            const lane = Math.floor(Math.random() * 3);
            const laneWidth = this.track.width / 3;
            const x = 0.5 - this.track.width / 2 + laneWidth * (lane + 0.5);
            this.coins.push({
                x: x,
                y: -0.1,
                collected: false
            });
        }
        
        // Update obstacles
        for (const obstacle of this.obstacles) {
            obstacle.y += moveSpeed;
            
            // Check collision
            const dx = Math.abs(this.pou.x - obstacle.x);
            const dy = Math.abs(this.pou.y - obstacle.y);
            if (!obstacle.hit && dx < 0.06 && dy < 0.08) {
                // Hit obstacle - slow down
                obstacle.hit = true;
                this.pou.speed = Math.max(200, this.pou.speed - 50);
                this.createExplosion(obstacle.x, obstacle.y);
            }
        }
        
        // Update coins
        for (const coin of this.coins) {
            coin.y += moveSpeed;
            
            // Check collection
            const dx = Math.abs(this.pou.x - coin.x);
            const dy = Math.abs(this.pou.y - coin.y);
            if (!coin.collected && dx < 0.06 && dy < 0.08) {
                coin.collected = true;
                this.addScore(50);
                this.createSparkle(coin.x, coin.y);
            }
        }
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.life -= deltaTime;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        
        // Remove off-screen items
        this.obstacles = this.obstacles.filter(o => o.y < 1.2);
        this.coins = this.coins.filter(c => c.y < 1.2);
        
        // Increase score
        this.accumulatedScore += this.pou.speed * this.pou.boostMultiplier * deltaTime * 0.1;
        if (this.accumulatedScore >= 1) {
            const pointsToAdd = Math.floor(this.accumulatedScore);
            this.addScore(pointsToAdd);
            this.accumulatedScore -= pointsToAdd;
        }
    }
    
    createExplosion(x, y) {
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                life: 0.5,
                color: '#FF6B6B'
            });
        }
    }
    
    createSparkle(x, y) {
        for (let i = 0; i < 5; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 0.2,
                vy: (Math.random() - 0.5) * 0.2,
                life: 0.3,
                color: '#FFD700'
            });
        }
    }
    
    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Clear
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(0, 0, w, h);
        
        // Draw grass
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(0, 0, w * 0.1, h);
        ctx.fillRect(w * 0.9, 0, w * 0.1, h);
        
        // Draw road
        const roadLeft = (0.5 - this.track.width / 2) * w;
        const roadWidth = this.track.width * w;
        ctx.fillStyle = '#34495e';
        ctx.fillRect(roadLeft, 0, roadWidth, h);
        
        // Draw road markings
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 3;
        ctx.setLineDash([20, 20]);
        
        // Lane dividers
        const laneWidth = roadWidth / 3;
        for (let i = 1; i < 3; i++) {
            const x = roadLeft + laneWidth * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        
        // Moving center line
        ctx.setLineDash([30, 30]);
        ctx.lineDashOffset = -this.track.scrollY * h;
        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, h);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw road markers
        ctx.fillStyle = '#ecf0f1';
        for (const marker of this.roadMarkers) {
            const my = marker.y * h;
            ctx.fillRect(roadLeft - 10, my, 10, 30);
            ctx.fillRect(roadLeft + roadWidth, my, 10, 30);
        }
        
        // Draw coins
        for (const coin of this.coins) {
            if (coin.collected) continue;
            const cx = coin.x * w;
            const cy = coin.y * h;
            
            ctx.save();
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(cx, cy, 15, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#FFA500';
            ctx.font = 'bold 16px Outfit';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', cx, cy);
            ctx.restore();
        }
        
        // Draw obstacles
        for (const obstacle of this.obstacles) {
            const ox = obstacle.x * w;
            const oy = obstacle.y * h;
            const ow = obstacle.width * w;
            const oh = obstacle.height * h;
            
            if (obstacle.type === 'rock') {
                ctx.fillStyle = '#7f8c8d';
                ctx.beginPath();
                ctx.ellipse(ox, oy, ow / 2, oh / 2, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Rock detail
                ctx.fillStyle = '#95a5a6';
                ctx.beginPath();
                ctx.ellipse(ox - 5, oy - 5, ow / 4, oh / 4, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Traffic cone
                ctx.fillStyle = '#e74c3c';
                ctx.beginPath();
                ctx.moveTo(ox, oy - oh / 2);
                ctx.lineTo(ox + ow / 3, oy + oh / 2);
                ctx.lineTo(ox - ow / 3, oy + oh / 2);
                ctx.closePath();
                ctx.fill();
                
                // White stripe
                ctx.fillStyle = '#fff';
                ctx.fillRect(ox - ow / 6, oy, ow / 3, 5);
            }
        }
        
        // Draw particles
        for (const p of this.particles) {
            const px = p.x * w;
            const py = p.y * h;
            const alpha = p.life / 0.5;
            
            ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            ctx.beginPath();
            ctx.arc(px, py, 5 * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw Pou (racing car style)
        this.drawRacingPou(ctx, this.pou.x * w, this.pou.y * h, this.pou.width, this.pou.height);
        
        // Speed indicator
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '14px Outfit';
        ctx.textAlign = 'left';
        ctx.fillText(`Speed: ${Math.floor(this.pou.speed * this.pou.boostMultiplier)} km/h`, 20, 30);
    }
    
    drawRacingPou(ctx, x, y, w, h) {
        ctx.save();
        
        // Boost glow
        if (this.boostActive) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 30;
        }
        
        // Body (car-like)
        ctx.fillStyle = this.boostActive ? '#C0392B' : '#F4A460';
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, w, h, 15);
        ctx.fill();
        
        // Windshield
        ctx.fillStyle = '#87CEEB';
        ctx.beginPath();
        ctx.roundRect(x - w * 0.35, y - h * 0.3, w * 0.7, h * 0.3, 8);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x - w * 0.15, y - h * 0.1, w * 0.12, 0, Math.PI * 2);
        ctx.arc(x + w * 0.15, y - h * 0.1, w * 0.12, 0, Math.PI * 2);
        ctx.fill();
        
        // Pupils
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x - w * 0.15, y - h * 0.1, w * 0.05, 0, Math.PI * 2);
        ctx.arc(x + w * 0.15, y - h * 0.1, w * 0.05, 0, Math.PI * 2);
        ctx.fill();
        
        // Wheels
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(x - w * 0.3, y + h * 0.35, w * 0.15, 0, Math.PI * 2);
        ctx.arc(x + w * 0.3, y + h * 0.35, w * 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        // Exhaust flames when boosting
        if (this.boostActive) {
            ctx.fillStyle = '#FF6B6B';
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(x - 10 + i * 10, y + h / 2);
                ctx.lineTo(x - 15 + i * 10, y + h / 2 + 20 + Math.random() * 10);
                ctx.lineTo(x - 5 + i * 10, y + h / 2 + 20 + Math.random() * 10);
                ctx.closePath();
                ctx.fill();
            }
        }
        
        ctx.restore();
    }
    
    updateScoreDisplay() {
        const display = document.getElementById('racingScore');
        if (display) display.textContent = this.score;
    }
}

// ============================================
// Game 3: Food Fall
// ============================================

class FoodFall extends MiniGame {
    constructor() {
        super('foodFallCanvas', 'foodFall');
        this.pou = {
            x: 0.5,
            y: 0.85,
            width: 70,
            height: 75,
            mouthOpen: 0,
            catchRadius: 0.08
        };
        this.fallingFood = [];
        this.foodTypes = ['🍎', '🍕', '🍦', '🍔', '🍇', '🍪', '🍩', '🍓'];
        this.spawnTimer = 0;
        this.spawnRate = 1.5;
        this.particles = [];
        this.combo = 0;
        this.comboTimer = 0;
    }
    
    init() {
        super.init();
        this.reset();
    }
    
    reset() {
        this.pou.x = 0.5;
        this.pou.mouthOpen = 0;
        this.fallingFood = [];
        this.particles = [];
        this.score = 0;
        this.combo = 0;
        this.comboTimer = 0;
        this.spawnRate = 1.5;
    }
    
    update(deltaTime) {
        const gestures = window.Engine ? window.Engine.getGestures() : { 
            nosePosition: { x: 0.5 },
            mouthOpen: 0 
        };
        
        // Move Pou with nose
        const targetX = gestures.nosePosition.x;
        this.pou.x += (targetX - this.pou.x) * deltaTime * 8;
        this.pou.x = Math.max(0.1, Math.min(0.9, this.pou.x));
        
        // Mouth open detection
        this.pou.mouthOpen = gestures.mouthOpen;
        this.pou.catchRadius = 0.08 + this.pou.mouthOpen * 0.06;
        
        // Update UI indicator
        const indicator = document.getElementById('catchIndicator');
        if (indicator) {
            if (this.pou.mouthOpen > 0.5) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        }
        
        // Update Pou expression based on mouth
        const pouElement = document.getElementById('pou');
        if (pouElement && window.Game && window.Game.currentMode === 'food') {
            if (this.pou.mouthOpen > 0.5) {
                pouElement.classList.remove('normal', 'happy', 'sad', 'surprised', 'angry', 'sleeping');
                pouElement.classList.add('eating');
            } else {
                pouElement.classList.remove('eating');
                pouElement.classList.add('happy');
            }
        }
        
        // Spawn food
        this.spawnTimer += deltaTime;
        if (this.spawnTimer > this.spawnRate) {
            this.spawnTimer = 0;
            this.spawnRate = Math.max(0.5, this.spawnRate - 0.02);
            
            this.fallingFood.push({
                x: 0.1 + Math.random() * 0.8,
                y: -0.1,
                type: this.foodTypes[Math.floor(Math.random() * this.foodTypes.length)],
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 2,
                speed: 0.2 + Math.random() * 0.2
            });
        }
        
        // Update falling food
        for (let i = this.fallingFood.length - 1; i >= 0; i--) {
            const food = this.fallingFood[i];
            food.y += food.speed * deltaTime;
            food.rotation += food.rotationSpeed * deltaTime;
            
            // Check catch
            const dx = Math.abs(food.x - this.pou.x);
            const dy = Math.abs(food.y - this.pou.y);
            
            if (dx < this.pou.catchRadius && dy < this.pou.catchRadius && food.y < this.pou.y + 0.1) {
                // Caught!
                this.fallingFood.splice(i, 1);
                this.combo++;
                this.comboTimer = 2;
                const points = 10 * (1 + Math.floor(this.combo / 5));
                this.addScore(points);
                this.createCatchParticles(food.x, food.y, food.type);
                continue;
            }
            
            // Missed
            if (food.y > 1) {
                this.fallingFood.splice(i, 1);
                this.combo = Math.max(0, this.combo - 1);
            }
        }
        
        // Update combo timer
        if (this.comboTimer > 0) {
            this.comboTimer -= deltaTime;
            if (this.comboTimer <= 0) {
                this.combo = 0;
            }
        }
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.vy += 0.5 * deltaTime; // gravity
            p.life -= deltaTime;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }
    
    createCatchParticles(x, y, foodType) {
        // Create sparkle particles
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -0.3 - Math.random() * 0.3,
                life: 0.8,
                type: 'sparkle',
                emoji: foodType
            });
        }
        
        // Create score popup
        this.particles.push({
            x: x,
            y: y - 0.1,
            vx: 0,
            vy: -0.2,
            life: 1,
            type: 'score',
            score: 10 * (1 + Math.floor(this.combo / 5))
        });
    }
    
    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Clear with gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#E0F6FF');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        
        // Draw clouds
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        for (let i = 0; i < 5; i++) {
            const cx = ((i * 0.25 + performance.now() * 0.0001) % 1.2 - 0.1) * w;
            const cy = (0.1 + i * 0.08) * h;
            ctx.beginPath();
            ctx.arc(cx, cy, 30, 0, Math.PI * 2);
            ctx.arc(cx + 25, cy - 10, 35, 0, Math.PI * 2);
            ctx.arc(cx + 50, cy, 30, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw catch radius indicator when mouth open
        if (this.pou.mouthOpen > 0.3) {
            ctx.save();
            ctx.strokeStyle = `rgba(78, 205, 196, ${0.3 + this.pou.mouthOpen * 0.4})`;
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(this.pou.x * w, this.pou.y * h, this.pou.catchRadius * w, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        
        // Draw falling food
        ctx.save();
        ctx.font = '40px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        for (const food of this.fallingFood) {
            ctx.save();
            ctx.translate(food.x * w, food.y * h);
            ctx.rotate(food.rotation);
            ctx.fillText(food.type, 0, 0);
            ctx.restore();
        }
        ctx.restore();
        
        // Draw Pou
        this.drawCatcherPou(ctx, this.pou.x * w, this.pou.y * h, this.pou.width, this.pou.height);
        
        // Draw particles
        ctx.save();
        for (const p of this.particles) {
            const px = p.x * w;
            const py = p.y * h;
            
            if (p.type === 'sparkle') {
                ctx.font = '20px Outfit';
                ctx.textAlign = 'center';
                ctx.globalAlpha = p.life;
                ctx.fillText('✨', px, py);
            } else if (p.type === 'score') {
                ctx.fillStyle = `rgba(78, 205, 196, ${p.life})`;
                ctx.font = 'bold 20px Outfit';
                ctx.textAlign = 'center';
                ctx.fillText(`+${p.score}`, px, py);
            }
        }
        ctx.restore();
        
        // Draw combo
        if (this.combo > 1) {
            ctx.save();
            ctx.fillStyle = '#FF6B6B';
            ctx.font = 'bold 36px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(`${this.combo}x COMBO!`, w / 2, h * 0.15);
            ctx.restore();
        }
    }
    
    drawCatcherPou(ctx, x, y, w, h) {
        ctx.save();
        
        // Body
        ctx.fillStyle = '#F4A460';
        ctx.beginPath();
        ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x - w * 0.15, y - h * 0.2, w * 0.2, h * 0.15, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes (look at falling food)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x - w * 0.2, y - h * 0.15, w * 0.15, 0, Math.PI * 2);
        ctx.arc(x + w * 0.2, y - h * 0.15, w * 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        // Pupils
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x - w * 0.2, y - h * 0.15, w * 0.07, 0, Math.PI * 2);
        ctx.arc(x + w * 0.2, y - h * 0.15, w * 0.07, 0, Math.PI * 2);
        ctx.fill();
        
        // Mouth (opens based on mouthOpen)
        const mouthHeight = 10 + this.pou.mouthOpen * 25;
        ctx.fillStyle = '#4a2c17';
        ctx.beginPath();
        ctx.ellipse(x, y + h * 0.15, 20, mouthHeight / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Tongue when mouth open
        if (this.pou.mouthOpen > 0.3) {
            ctx.fillStyle = '#FF6B6B';
            ctx.beginPath();
            ctx.ellipse(x, y + h * 0.15 + mouthHeight * 0.3, 15, mouthHeight * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Arms reaching up
        ctx.fillStyle = '#F4A460';
        ctx.beginPath();
        ctx.ellipse(x - w * 0.5, y - h * 0.1, w * 0.15, h * 0.25, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + w * 0.5, y - h * 0.1, w * 0.15, h * 0.25, 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    updateScoreDisplay() {
        const display = document.getElementById('foodScore');
        if (display) display.textContent = this.score;
    }
}

// ============================================
// Mini Games Manager
// ============================================

const MiniGames = {
    skyClimber: null,
    headRacing: null,
    foodFall: null,
    currentGame: null,
    
    init() {
        this.skyClimber = new SkyClimber();
        this.skyClimber.init();
        
        this.headRacing = new HeadRacing();
        this.headRacing.init();
        
        this.foodFall = new FoodFall();
        this.foodFall.init();
        
        console.log('✅ Mini games initialized');
    },
    
    start(gameName) {
        // Stop current game
        if (this.currentGame) {
            this.currentGame.stop();
        }
        
        // Start new game
        switch (gameName) {
            case 'sky':
                this.currentGame = this.skyClimber;
                break;
            case 'racing':
                this.currentGame = this.headRacing;
                break;
            case 'food':
                this.currentGame = this.foodFall;
                break;
            default:
                this.currentGame = null;
                return;
        }
        
        if (this.currentGame) {
            this.currentGame.reset();
            this.currentGame.start();
        }
    },
    
    stop() {
        if (this.currentGame) {
            this.currentGame.stop();
            this.currentGame = null;
        }
    },
    
    resize() {
        if (this.skyClimber) this.skyClimber.resize();
        if (this.headRacing) this.headRacing.resize();
        if (this.foodFall) this.foodFall.resize();
    }
};

// ============================================
// Export
// ============================================

window.MiniGames = MiniGames;
