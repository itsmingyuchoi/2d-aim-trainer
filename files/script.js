document.addEventListener('DOMContentLoaded', () => {
    // 화면 요소
    const settingsScreen = document.getElementById('settings-screen');
    const gameScreen = document.getElementById('game-screen');
    const resultsScreen = document.getElementById('results-screen');

    // 설정 요소
    const gameModeRadios = document.querySelectorAll('input[name="game-mode"]');
    const crosshairSizeInput = document.getElementById('crosshair-size');
    const timeLimitInput = document.getElementById('time-limit');
    const targetSizeAInput = document.getElementById('target-size-a');
    const targetLifespanInput = document.getElementById('target-lifespan');
    const targetSizeBInput = document.getElementById('target-size-b');
    
    // 설정 값 표시
    const crosshairSizeValue = document.getElementById('crosshair-size-value');
    const timeLimitValue = document.getElementById('time-limit-value');
    const targetSizeAValue = document.getElementById('target-size-a-value');
    const targetLifespanValue = document.getElementById('target-lifespan-value');
    const targetSizeBValue = document.getElementById('target-size-b-value');

    // 버튼
    const startButton = document.getElementById('start-button');
    const backToMainButton = document.getElementById('back-to-main-button');

    // 결과 표시
    const resultText = document.getElementById('result-text');
    const highScoreText = document.getElementById('high-score-text');

    // 게임 캔버스 및 컨텍스트
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    // 게임 상태 변수
    let currentGame = null;
    let gameTimer;
    let remainingTime;
    let crosshairX, crosshairY;
    let gameLoopId;
    let settings = {};
    let particles = [];
    const SETTINGS_KEY = 'aimTrainerSettings';
    const HIGH_SCORE_KEY_A = 'aimTrainerHighScoreA';
    const HIGH_SCORE_KEY_B = 'aimTrainerHighScoreB';

    // --- 설정 저장/불러오기 로직 ---
    function saveSettings() {
        const settingsToSave = {
            crosshairSize: crosshairSizeInput.value,
            timeLimit: timeLimitInput.value,
            targetSizeA: targetSizeAInput.value,
            targetLifespan: targetLifespanInput.value,
            targetSizeB: targetSizeBInput.value,
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsToSave));
    }

    function loadSettings() {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
            const loaded = JSON.parse(savedSettings);
            
            crosshairSizeInput.value = loaded.crosshairSize;
            timeLimitInput.value = loaded.timeLimit;
            targetSizeAInput.value = loaded.targetSizeA;
            targetLifespanInput.value = loaded.targetLifespan;
            targetSizeBInput.value = loaded.targetSizeB;

            // Trigger change to update UI
            gameModeRadios.forEach(radio => radio.dispatchEvent(new Event('change')));
            document.querySelectorAll('input[type="range"]').forEach(input => input.dispatchEvent(new Event('input')));
        }
    }

    // --- 설정 화면 로직 ---
    const allInputs = document.querySelectorAll('input');
    allInputs.forEach(input => {
        input.addEventListener('change', saveSettings);
        input.addEventListener('input', saveSettings);
    });

    crosshairSizeInput.addEventListener('input', () => crosshairSizeValue.textContent = crosshairSizeInput.value);
    timeLimitInput.addEventListener('input', () => timeLimitValue.textContent = timeLimitInput.value);
    targetSizeAInput.addEventListener('input', () => targetSizeAValue.textContent = targetSizeAInput.value);
    targetLifespanInput.addEventListener('input', () => targetLifespanValue.textContent = targetLifespanInput.value);
    targetSizeBInput.addEventListener('input', () => targetSizeBValue.textContent = targetSizeBInput.value);

    gameModeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            document.getElementById('game-a-settings').style.display = (radio.value === 'A') ? 'block' : 'none';
            document.getElementById('game-b-settings').style.display = (radio.value === 'B') ? 'block' : 'none';
        });
    });

    // --- 화면 전환 및 ESC 키 로직 ---
    function showScreen(screen) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
    }

    function returnToMenu() {
        if (gameLoopId) cancelAnimationFrame(gameLoopId);
        if (gameTimer) clearInterval(gameTimer);
        gameLoopId = null;
        gameTimer = null;

        if (currentGame) {
            currentGame.cleanup();
            currentGame = null;
        }
        showScreen(settingsScreen);
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            returnToMenu();
        }
    });

    // --- 파티클 로직 ---
    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 3 + 1;
            this.speedX = Math.random() * 3 - 1.5;
            this.speedY = Math.random() * 3 - 1.5;
            this.life = 100;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.life -= 2;
        }

        draw() {
            ctx.fillStyle = `rgba(255, 0, 0, ${this.life / 100})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function handleParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].draw();
            if (particles[i].life < 0) {
                particles.splice(i, 1);
            }
        }
    }

    function createParticles(x, y) {
        for (let i = 0; i < 20; i++) {
            particles.push(new Particle(x, y));
        }
    }

    // --- 크로스헤어 로직 ---
    function drawCrosshair() {
        const size = settings.crosshairSize;
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(crosshairX - size / 2, crosshairY);
        ctx.lineTo(crosshairX + size / 2, crosshairY);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(crosshairX, crosshairY - size / 2);
        ctx.lineTo(crosshairX, crosshairY + size / 2);
        ctx.stroke();
    }

    window.addEventListener('mousemove', e => {
        crosshairX = e.clientX;
        crosshairY = e.clientY;
    });

    // --- 게임 시작 로직 ---
    startButton.addEventListener('click', () => {
        settings = {
            gameMode: document.querySelector('input[name="game-mode"]:checked').value,
            crosshairSize: parseInt(crosshairSizeInput.value),
            timeLimit: parseInt(timeLimitInput.value),
            targetSizeA: parseInt(targetSizeAInput.value),
            targetLifespan: parseFloat(targetLifespanInput.value) * 1000,
            targetSizeB: parseInt(targetSizeBInput.value),
        };

        initGame();
        showScreen(gameScreen);
        if (settings.gameMode === 'A') {
            currentGame = new GameA();
        } else {
            currentGame = new GameB();
        }
        currentGame.start();
    });

    // --- 게임 초기화 ---
    function initGame() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        remainingTime = settings.timeLimit;
        particles = [];
        document.getElementById('game-score').textContent = '점수: 0';
        document.getElementById('game-timer').textContent = formatTime(remainingTime);
    }

    // --- 게임 종료 로직 ---
    function endGame() {
        if (gameLoopId) cancelAnimationFrame(gameLoopId);
        if (gameTimer) clearInterval(gameTimer);
        gameLoopId = null;
        gameTimer = null;
        
        showScreen(resultsScreen);
        const result = currentGame.getResult();
        resultText.textContent = result.finalScoreText;
        highScoreText.textContent = result.highScoreText;

        currentGame.cleanup();
        currentGame = null;
    }

    // --- 유틸리티 함수 ---
    function formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    // --- 게임 클래스 ---
    class Game {
        constructor() {
            this.targets = [];
        }

        start() {
            gameTimer = setInterval(() => {
                remainingTime--;
                document.getElementById('game-timer').textContent = formatTime(remainingTime);
                if (remainingTime <= 0) {
                    endGame();
                }
            }, 1000);
            this.gameLoop();
        }

        gameLoop() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this.update();
            this.draw();
            handleParticles();
            drawCrosshair();
            gameLoopId = requestAnimationFrame(() => this.gameLoop());
        }

        update() {}
        draw() {}
        getResult() {}
        cleanup() {}
    }

    // 게임 A: 랜덤 에임
    class GameA extends Game {
        constructor() {
            super();
            this.score = 0;
            this.boundHandleClick = this.handleClick.bind(this);
        }

        start() {
            super.start();
            this.spawnTarget();
            canvas.addEventListener('click', this.boundHandleClick);
        }
        
        spawnTarget() {
            const size = settings.targetSizeA;
            const x = Math.random() * (canvas.width - size * 2) + size;
            const y = Math.random() * (canvas.height - size * 2) + size;
            this.targets = [{ x, y, size, createdAt: Date.now() }];
        }

        handleClick(e) {
            const target = this.targets[0];
            let hit = false;

            if (target) {
                const dist = Math.hypot(e.clientX - target.x, e.clientY - target.y);
                if (dist < target.size) {
                    hit = true;
                }
            }

            if (hit) {
                this.score++;
                createParticles(target.x, target.y);
                this.spawnTarget();
            } else {
                this.score--;
            }
            document.getElementById('game-score').textContent = `점수: ${this.score}`;
        }

        update() {
            const now = Date.now();
            const target = this.targets[0];
            if (target && (now - target.createdAt >= settings.targetLifespan)) {
                this.spawnTarget();
            }
        }

        draw() {
            this.targets.forEach(target => {
                ctx.fillStyle = 'red';
                ctx.beginPath();
                ctx.arc(target.x, target.y, target.size, 0, Math.PI * 2);
                ctx.fill();
            });
        }
        
        cleanup() {
            canvas.removeEventListener('click', this.boundHandleClick);
            this.targets = [];
        }

        getResult() {
            this.cleanup();
            const highScore = localStorage.getItem(HIGH_SCORE_KEY_A) || 0;
            let newHighScore = false;
            if (this.score > highScore) {
                localStorage.setItem(HIGH_SCORE_KEY_A, this.score);
                newHighScore = true;
            }
            
            return {
                finalScoreText: `최종 점수: ${this.score}점`,
                // highScoreText: newHighScore ? `신기록 달성!` : `최고 기록: ${highScore}점`
            };
        }
    }

    // 게임 B: 체이스
    class GameB extends Game {
        constructor() {
            super();
            this.target = null;
            this.hoverTime = 0;
            this.isHovering = false;
            this.lastHoverTime = 0;
        }

        start() {
            super.start();
            this.spawnTarget();
        }

        spawnTarget() {
            const size = settings.targetSizeB;
            const x = Math.random() * (canvas.width - size * 2) + size;
            const y = Math.random() * (canvas.height - size * 2) + size;
            this.target = { x, y, size, angle: Math.random() * Math.PI * 2 };
        }

        update() {
            if (!this.target) return;

            const speed = 2 + (settings.timeLimit - remainingTime) / 10;
            this.target.x += Math.cos(this.target.angle) * speed;
            this.target.y += Math.sin(this.target.angle) * speed;

            if (this.target.x < this.target.size || this.target.x > canvas.width - this.target.size) {
                this.target.angle = Math.PI - this.target.angle;
            }
            if (this.target.y < this.target.size || this.target.y > canvas.height - this.target.size) {
                this.target.angle = -this.target.angle;
            }
            
            if (Math.random() < 0.01) {
                 this.target.angle += (Math.random() - 0.5);
            }

            const dist = Math.hypot(crosshairX - this.target.x, crosshairY - this.target.y);
            if (dist < this.target.size) {
                if (!this.isHovering) {
                    this.isHovering = true;
                    this.lastHoverTime = performance.now();
                }
                this.hoverTime += performance.now() - this.lastHoverTime;
                this.lastHoverTime = performance.now();
            } else {
                this.isHovering = false;
            }
            document.getElementById('game-score').textContent = `추적 시간: ${(this.hoverTime / 1000).toFixed(2)}초`;
        }

        draw() {
            if (!this.target) return;
            ctx.fillStyle = this.isHovering ? 'blue' : 'yellow';
            ctx.beginPath();
            ctx.arc(this.target.x, this.target.y, this.target.size, 0, Math.PI * 2);
            ctx.fill();
        }

        cleanup() {
            this.target = null;
        }

        getResult() {
            this.cleanup();
            const finalTime = parseFloat((this.hoverTime / 1000).toFixed(2));
            const highScore = parseFloat(localStorage.getItem(HIGH_SCORE_KEY_B) || 0);
            let newHighScore = false;
            if (finalTime > highScore) {
                localStorage.setItem(HIGH_SCORE_KEY_B, finalTime);
                newHighScore = true;
            }

            return {
                finalScoreText: `총 추적 시간: ${finalTime}초`,
                // highScoreText: newHighScore ? `신기록 달성!` : `최고 기록: ${highScore.toFixed(2)}초`
            };
        }
    }

    // --- 결과 화면 로직 ---
    backToMainButton.addEventListener('click', returnToMenu);

    // 초기화
    loadSettings();
    // Ensure the correct settings view is shown on load
    document.querySelector('input[name="game-mode"]:checked').dispatchEvent(new Event('change'));
});
