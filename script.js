// ==========================================================================
// MODULAR CINEMATIC TRANSITION CONFIGURATION (Anime.js 4.5.0)
// Easily adjust any parameter here to tune timing, speed, and intensity
// ==========================================================================
const CONFIG = {
    cameraZoomScale: 1.08,          // Subtle cinematic push (around 1.08) keeping castle architecture visible
    cameraZoomDuration: 2400,       // Duration of camera push (ms)
    whirlpoolSpeed: 1.3,            // Swirl rotation & wave undulation speed multiplier
    whirlpoolIntensity: 1.0,        // Doorway energy glow multiplier
    particleAmount: 60,             // Golden stardust & ember density
    energyExpansionDuration: 1200,  // Duration of energy escape phase (ms)
    goldenTakeoverDuration: 1250    // Full-screen golden light expansion duration (ms)
};

document.addEventListener('DOMContentLoaded', () => {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    // --------------------------------------------------------------------------
    // DOM Elements
    // --------------------------------------------------------------------------
    const stage = document.getElementById('stage');
    const candleWrapper = document.getElementById('candleWrapper');
    const scrollLayer = document.getElementById('scrollLayer');
    const dogLeft = document.getElementById('dogLeft');
    const dogLeftCloud = document.getElementById('dogLeftCloud');
    const dogRight = document.getElementById('dogRight');

    const magicEnergyCanvas = document.getElementById('magicEnergyCanvas');
    const sparkleCanvas = document.getElementById('sparkleCanvas');
    const goldenLightTakeover = document.getElementById('goldenLightTakeover');

    const ctx = sparkleCanvas ? sparkleCanvas.getContext('2d') : null;
    const magicCtx = magicEnergyCanvas ? magicEnergyCanvas.getContext('2d') : null;

    let isLit = true;
    let isBlownOut = false;
    let transitionStarted = false;

    // Particle arrays
    let smokeParticles = [];
    let stardustParticles = [];
    let escapingEmbers = [];
    let escapingWisps = [];

    let currentSectionIndex = 0;
    let isScrollLocked = false;
    let wheelCooldownTimer = null;
    let lastWheelTime = 0;
    let touchStartY = 0;
    let touchStartX = 0;
    let sec6PlaybackObserver = null;
    let sec6PlaybackTimer = null;
    let sec6ActiveCardIndex = 0;
    let section7BalloonsInitialized = false;
    let section7ParticlesInitialized = false;
    let activeScrollAnimation = null;

    // Animation state driven by Anime.js
    const energyState = {
        intensity: 0,
        corePulse: 1,
        escapeFactor: 0
    };

    // Responsive Canvas Resize
    function resizeCanvas() {
        if (candleWrapper && sparkleCanvas) {
            sparkleCanvas.width = sparkleCanvas.clientWidth;
            sparkleCanvas.height = sparkleCanvas.clientHeight;
        }
        if (magicEnergyCanvas && stage) {
            magicEnergyCanvas.width = stage.clientWidth;
            magicEnergyCanvas.height = stage.clientHeight;
        }
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // --------------------------------------------------------------------------
    // Additive Background Preload for Next Section Images (Non-blocking)
    // --------------------------------------------------------------------------
    const preloadImage = new Image();
    preloadImage.src = 'assets/after_png_main_photo.png';
    preloadImage.decode?.().catch(() => {});

    const preloadBg = new Image();
    preloadBg.src = 'assets/scrolling_page_finally.png';
    preloadBg.decode?.().catch(() => {});

    let audioCtx = null;
    function getAudioCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playBlowSound() {
        try {
            const ac = getAudioCtx();
            const now = ac.currentTime;
            const bufferSize = ac.sampleRate * 0.35;
            const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = ac.createBufferSource();
            noise.buffer = buffer;
            const filter = ac.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(650, now);
            filter.frequency.exponentialRampToValueAtTime(120, now + 0.35);

            const gain = ac.createGain();
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.005, now + 0.35);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ac.destination);

            noise.start(now);
            noise.stop(now + 0.35);
        } catch (e) {}
    }

    // --------------------------------------------------------------------------
    // Interactive Candle Trigger
    // --------------------------------------------------------------------------
    candleWrapper.addEventListener('click', blowOutCandleAndStartTransition);
    candleWrapper.addEventListener('touchend', (e) => {
        if (!transitionStarted && !isBlownOut && isLit) {
            e.preventDefault();
            blowOutCandleAndStartTransition();
        }
    });
    candleWrapper.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            blowOutCandleAndStartTransition();
        }
    });

    // --------------------------------------------------------------------------
    // CINEMATIC 5-PHASE REVEAL TRANSITION SEQUENCE (5.0s Total - Anime.js Powered)
    // "She has passed through the magical golden gate and entered another world."
    // --------------------------------------------------------------------------
    let transitionState = {
        phase: 0,
        rayOpacity: 0,
        particleAlpha: 1
    };

    /* ===== SECOND FRONTEND BACKGROUND MUSIC — START ===== */
    /* ===== SECOND FRONTEND BACKGROUND MUSIC — START ===== */
    const secondFrontendMusic = {
        audio: null,
        gainNode: null,
        audioCtx: null,
        sourceNode: null,
        state: 'UNINITIALIZED',
        isPausedByVideo: false,
        byeByeRevealStarted: false,
        isPermanentlyStopped: false,
        boundVideoEvents: new WeakSet(),

        init() {
            if (this.isPermanentlyStopped || this.byeByeRevealStarted) return;
            if (this.audio) return;
            const audioEl = document.createElement('audio');
            audioEl.id = 'secondFrontendBgMusic';
            audioEl.src = 'assets/Second frontend.mp4';
            audioEl.loop = true;
            audioEl.preload = 'auto';
            audioEl.style.display = 'none';
            document.body.appendChild(audioEl);
            this.audio = audioEl;

            this.bindSection6VideoEvents();
        },

        setupAudioNodes() {
            if (this.isPermanentlyStopped || this.byeByeRevealStarted) return;
            if (this.gainNode || !this.audio) return;
            try {
                const ac = getAudioCtx();
                this.audioCtx = ac;
                this.sourceNode = ac.createMediaElementSource(this.audio);
                this.gainNode = ac.createGain();
                this.gainNode.gain.value = 2.0; // 200% volume gain multiplier
                this.sourceNode.connect(this.gainNode);
                this.gainNode.connect(ac.destination);
                this.audio.volume = 1.0;
            } catch (e) {
                this.audio.volume = 1.0;
            }
        },

        play() {
            if (this.isPermanentlyStopped || this.byeByeRevealStarted) return;
            this.init();
            if (this.isPausedByVideo) return;

            this.setupAudioNodes();
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            this.audio.loop = true;
            this.audio.play().then(() => {
                if (this.isPermanentlyStopped || this.byeByeRevealStarted) {
                    this.audio.pause();
                    this.audio.currentTime = 0;
                    return;
                }
                this.state = 'PLAYING';
            }).catch(err => {
                console.warn('Second Frontend bg music play postponed until user gesture:', err);
            });
        },

        pauseForVideo() {
            if (this.isPermanentlyStopped || this.byeByeRevealStarted) return;
            if (!this.audio) return;
            if (!this.audio.paused || this.state === 'PLAYING') {
                this.audio.pause();
            }
            this.isPausedByVideo = true;
            this.state = 'PAUSED_BY_VIDEO';
        },

        resumeFromVideo() {
            if (this.isPermanentlyStopped || this.byeByeRevealStarted) return;
            if (!this.audio) return;

            if (this.isAnySection6VideoPlaying()) {
                return;
            }

            this.isPausedByVideo = false;

            const memoryGarden = document.getElementById('memoryGardenSection');
            const isGardenActive = memoryGarden &&
                (memoryGarden.classList.contains('active') ||
                 (getComputedStyle(memoryGarden).display !== 'none' && parseFloat(getComputedStyle(memoryGarden).opacity) > 0.01));

            if (isGardenActive && (this.state === 'PAUSED_BY_VIDEO' || this.audio.paused)) {
                this.setupAudioNodes();
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
                this.audio.loop = true;
                this.audio.play().then(() => {
                    if (this.isPermanentlyStopped || this.byeByeRevealStarted) {
                        this.audio.pause();
                        this.audio.currentTime = 0;
                        return;
                    }
                    this.state = 'PLAYING';
                }).catch(() => {});
            }
        },

        stop() {
            if (!this.audio) return;
            this.audio.pause();
            this.audio.currentTime = 0;
            if (!this.isPermanentlyStopped) {
                this.state = 'STOPPED';
            }
            this.isPausedByVideo = false;
        },

        permanentlyStop() {
            this.byeByeRevealStarted = true;
            this.isPermanentlyStopped = true;
            this.state = 'PERMANENTLY_STOPPED';
            this.isPausedByVideo = false;

            if (this.audio) {
                this.audio.loop = false;
                this.audio.pause();
                this.audio.currentTime = 0;
            }
            if (this.gainNode) {
                try {
                    this.gainNode.gain.setValueAtTime(0, this.audioCtx ? this.audioCtx.currentTime : 0);
                } catch (e) {}
            }
        },

        isAnySection6VideoPlaying() {
            const videos = document.querySelectorAll('#sec6VideoOverlayVideo, video.sec6-card-video, #gardenSegment-6 video');
            for (const v of videos) {
                if (v && v.tagName === 'VIDEO' && !v.paused && !v.ended && v.readyState > 1) {
                    return true;
                }
            }
            return false;
        },

        bindSection6VideoEvents() {
            const bindVideo = (v) => {
                if (!v || v.tagName !== 'VIDEO' || this.boundVideoEvents.has(v)) return;
                this.boundVideoEvents.add(v);

                v.addEventListener('play', () => this.pauseForVideo());
                v.addEventListener('playing', () => this.pauseForVideo());
                v.addEventListener('pause', () => setTimeout(() => this.resumeFromVideo(), 50));
                v.addEventListener('ended', () => setTimeout(() => this.resumeFromVideo(), 50));
            };

            const videos = document.querySelectorAll('#sec6VideoOverlayVideo, video.sec6-card-video, #gardenSegment-6 video');
            videos.forEach(bindVideo);

            setInterval(() => {
                if (this.isPermanentlyStopped || this.byeByeRevealStarted) return;
                const currentVideos = document.querySelectorAll('#sec6VideoOverlayVideo, video.sec6-card-video, #gardenSegment-6 video');
                currentVideos.forEach(bindVideo);
            }, 1000);
        }
    };
    window.secondFrontendMusic = secondFrontendMusic;
    /* ===== SECOND FRONTEND BACKGROUND MUSIC — END ===== */

    // --------------------------------------------------------------------------
    // FIRST FRONTEND CONTINUOUS BACKGROUND MUSIC (500% Gain Web Audio API, Gapless Loop, Stop on Candle)
    // --------------------------------------------------------------------------
    const firstFrontendBgMusic = document.getElementById('firstFrontendBgMusic');
    let isFirstFrontendMusicStopped = false;
    let ffAudioCtx = null;
    let ffGainNode = null;
    let ffMediaSource = null;

    function initFirstFrontendWebAudio() {
        if (ffAudioCtx || !firstFrontendBgMusic) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            ffAudioCtx = new AudioContextClass();
            ffGainNode = ffAudioCtx.createGain();
            ffGainNode.gain.value = 5.0; // 500% volume amplification (5x signal gain)
            ffMediaSource = ffAudioCtx.createMediaElementSource(firstFrontendBgMusic);
            ffMediaSource.connect(ffGainNode);
            ffGainNode.connect(ffAudioCtx.destination);
        } catch (e) {
            console.warn('Web Audio API setup failed:', e);
        }
    }

    function initFirstFrontendBgMusic() {
        if (!firstFrontendBgMusic || isFirstFrontendMusicStopped) return;
        firstFrontendBgMusic.volume = 1.0;
        firstFrontendBgMusic.loop = true;

        if (!firstFrontendBgMusic.dataset.loopBound) {
            firstFrontendBgMusic.dataset.loopBound = 'true';
            firstFrontendBgMusic.addEventListener('ended', () => {
                if (!isFirstFrontendMusicStopped) {
                    firstFrontendBgMusic.currentTime = 0;
                    firstFrontendBgMusic.play().catch(() => {});
                }
            });
        }

        initFirstFrontendWebAudio();
        if (ffAudioCtx && ffAudioCtx.state === 'suspended') {
            ffAudioCtx.resume().catch(() => {});
        }
        firstFrontendBgMusic.play().catch(() => {});
    }

    initFirstFrontendBgMusic();

    function startMusicOnUserGesture() {
        if (!isFirstFrontendMusicStopped && firstFrontendBgMusic && !transitionStarted) {
            initFirstFrontendWebAudio();
            const playAudio = () => {
                if (firstFrontendBgMusic && firstFrontendBgMusic.paused && !isFirstFrontendMusicStopped && !transitionStarted) {
                    firstFrontendBgMusic.volume = 1.0;
                    firstFrontendBgMusic.loop = true;
                    firstFrontendBgMusic.play().catch(() => {});
                }
            };
            if (ffAudioCtx && ffAudioCtx.state === 'suspended') {
                ffAudioCtx.resume().then(playAudio).catch(() => {
                    playAudio();
                });
            } else {
                playAudio();
            }
        }
    }
    document.addEventListener('pointerdown', startMusicOnUserGesture, { passive: true });
    document.addEventListener('touchstart', startMusicOnUserGesture, { passive: true });
    document.addEventListener('click', startMusicOnUserGesture, { passive: true });
    document.addEventListener('keydown', startMusicOnUserGesture, { passive: true });

    // --------------------------------------------------------------------------
    // BIRTHDAY REVEAL PAGE CLAPPING AUDIO (500% Gain Web Audio API, Synchronized Fade-Out)
    // --------------------------------------------------------------------------
    const clappingAudio = document.getElementById('clappingAudio');
    let clappingAudioCtx = null;
    let clappingGainNode = null;
    let clappingMediaSource = null;

    function initClappingWebAudio() {
        if (clappingAudioCtx || !clappingAudio) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            clappingAudioCtx = new AudioContextClass();
            clappingGainNode = clappingAudioCtx.createGain();
            clappingGainNode.gain.value = 2.0; // 200% volume amplification (2x signal gain)
            clappingMediaSource = clappingAudioCtx.createMediaElementSource(clappingAudio);
            clappingMediaSource.connect(clappingGainNode);
            clappingGainNode.connect(clappingAudioCtx.destination);
        } catch (e) {
            console.warn('Clapping Web Audio API setup failed:', e);
        }
    }

    function playClappingAudio() {
        if (!clappingAudio) return;
        initClappingWebAudio();

        if (clappingAudioCtx && clappingAudioCtx.state === 'suspended') {
            clappingAudioCtx.resume().catch(() => {});
        }

        if (clappingGainNode && clappingAudioCtx) {
            const now = clappingAudioCtx.currentTime;
            clappingGainNode.gain.cancelScheduledValues(now);
            clappingGainNode.gain.setValueAtTime(2.0, now);
        }

        clappingAudio.volume = 1.0;
        clappingAudio.loop = false;
        clappingAudio.currentTime = 0;
        clappingAudio.play().catch(() => {});
    }

    function fadeAndStopClappingAudio(durationMs = 650) {
        if (!clappingAudio) return;

        if (clappingGainNode && clappingAudioCtx) {
            const now = clappingAudioCtx.currentTime;
            const durationSec = durationMs / 1000;
            clappingGainNode.gain.cancelScheduledValues(now);
            clappingGainNode.gain.setValueAtTime(clappingGainNode.gain.value, now);
            clappingGainNode.gain.linearRampToValueAtTime(0, now + durationSec);
        }

        setTimeout(() => {
            if (clappingAudio) {
                try {
                    clappingAudio.pause();
                    clappingAudio.currentTime = 0;
                } catch (e) {}
            }
            if (clappingGainNode && clappingAudioCtx) {
                const now = clappingAudioCtx.currentTime;
                clappingGainNode.gain.cancelScheduledValues(now);
                clappingGainNode.gain.setValueAtTime(0, now);
            }
        }, durationMs);
    }

    // --------------------------------------------------------------------------
    // FIRST FRONTEND THINKING CLOUD REPEATING FADE LOOP (Anime.js Powered)
    // --------------------------------------------------------------------------
    let dogLeftCloudFadeLoop = null;

    function initDogLeftCloudFadeLoop() {
        if (dogLeftCloudFadeLoop || transitionStarted || isBlownOut) return;

        const target = document.getElementById('dogLeftCloud') || dogLeftCloud;
        if (!target) return;

        const animeLib = window.anime;
        if (!animeLib) return;

        let isStopped = false;
        let activeAnim = null;

        function runCycle() {
            if (isStopped || transitionStarted || isBlownOut) return;
            target.style.opacity = '0';

            // Initial Wait (250ms)
            setTimeout(() => {
                if (isStopped || transitionStarted || isBlownOut) return;

                // Fade In (450ms)
                const fadeInCallback = () => {
                    if (isStopped || transitionStarted || isBlownOut) return;

                    // Visible Hold (3000ms)
                    setTimeout(() => {
                        if (isStopped || transitionStarted || isBlownOut) return;

                        // Fade Out (450ms)
                        const fadeOutCallback = () => {
                            if (isStopped || transitionStarted || isBlownOut) return;

                            // Invisible Wait (1200ms)
                            setTimeout(() => {
                                if (isStopped || transitionStarted || isBlownOut) return;
                                runCycle();
                            }, 1200);
                        };

                        if (animeLib && animeLib.animate) {
                            activeAnim = animeLib.animate(target, {
                                opacity: [1, 0],
                                duration: 450,
                                ease: 'inOutSine',
                                onComplete: fadeOutCallback
                            });
                        } else if (typeof animeLib === 'function') {
                            activeAnim = animeLib({
                                targets: target,
                                opacity: [1, 0],
                                duration: 450,
                                easing: 'easeInOutSine',
                                complete: fadeOutCallback
                            });
                        } else {
                            target.style.opacity = '0';
                            fadeOutCallback();
                        }

                    }, 3000);
                };

                if (animeLib && animeLib.animate) {
                    activeAnim = animeLib.animate(target, {
                        opacity: [0, 1],
                        duration: 450,
                        ease: 'inOutSine',
                        onComplete: fadeInCallback
                    });
                } else if (typeof animeLib === 'function') {
                    activeAnim = animeLib({
                        targets: target,
                        opacity: [0, 1],
                        duration: 450,
                        easing: 'easeInOutSine',
                        complete: fadeInCallback
                    });
                } else {
                    target.style.opacity = '1';
                    fadeInCallback();
                }

            }, 250);
        }

        dogLeftCloudFadeLoop = {
            stop: () => {
                isStopped = true;
                if (activeAnim) {
                    try { if (typeof activeAnim.pause === 'function') activeAnim.pause(); } catch (e) {}
                }
                if (target) target.style.opacity = '0';
            },
            pause: () => {
                isStopped = true;
                if (activeAnim) {
                    try { if (typeof activeAnim.pause === 'function') activeAnim.pause(); } catch (e) {}
                }
                if (target) target.style.opacity = '0';
            }
        };

        runCycle();
    }

    initDogLeftCloudFadeLoop();

    function blowOutCandleAndStartTransition() {
        if (transitionStarted || isBlownOut || !isLit) return; // Interaction lock

        transitionStarted = true;
        isBlownOut = true;
        isLit = false;

        // Stop First Frontend thinking cloud repeating fade loop immediately
        if (dogLeftCloudFadeLoop && typeof dogLeftCloudFadeLoop.stop === 'function') {
            try { dogLeftCloudFadeLoop.stop(); } catch (e) {}
        }

        // Stop First Frontend background music immediately when candle interaction starts
        isFirstFrontendMusicStopped = true;
        if (firstFrontendBgMusic) {
            try {
                firstFrontendBgMusic.pause();
                firstFrontendBgMusic.currentTime = 0;
            } catch (e) {}
        }
        if (ffAudioCtx && typeof ffAudioCtx.suspend === 'function') {
            ffAudioCtx.suspend().catch(() => {});
        }

        // Stop/pause central notepad video immediately when candle interaction starts
        const scrollVideo = document.getElementById('scrollVideo') || document.querySelector('#scrollLayer video');
        if (scrollVideo && typeof scrollVideo.pause === 'function') {
            scrollVideo.pause();
        }

        const animeLib = window.anime;
        const runAnime = (target, params) => {
            if (!animeLib || !target) return null;
            if (animeLib.animate) {
                return animeLib.animate(target, params);
            } else if (typeof animeLib === 'function') {
                const config = Object.assign({ targets: target }, params);
                if (config.ease && !config.easing) {
                    const easeMap = {
                        'outQuad': 'easeOutQuad',
                        'inQuad': 'easeInQuad',
                        'inOutQuad': 'easeInOutQuad',
                        'inOutCubic': 'easeInOutCubic',
                        'outCubic': 'easeOutCubic',
                        'inOutSine': 'easeInOutSine',
                        'inOutBack': 'easeInOutBack',
                        'outBack': 'easeOutBack',
                        'inBack': 'easeInBack'
                    };
                    config.easing = easeMap[config.ease] || config.ease;
                }
                if (config.onComplete && !config.complete) {
                    config.complete = config.onComplete;
                }
                return animeLib(config);
            }
            return null;
        };
        const memoryGarden = document.getElementById('memoryGardenSection');
        const sceneContainer = document.getElementById('sceneContainer');
        /* ===== GOLDEN BACKDROP BLINK FIX — START ===== */
        const goldenTransitionBackdrop = document.getElementById('goldenTransitionBackdrop');
        /* ===== GOLDEN BACKDROP BLINK FIX — END ===== */

        // 0.00–0.40s: Candle blowout sound & smoke puff
        playBlowSound();
        candleWrapper.classList.add('blowing');

        setTimeout(() => {
            candleWrapper.classList.remove('blowing');
            candleWrapper.classList.remove('lit');
            spawnSoftMistPuff(30);
        }, 120);

        // Intro foreground elements fade out gently (0.0s – 0.6s)
        if (animeLib && animeLib.animate) {
            animeLib.animate([scrollLayer, dogLeft, dogLeftCloud, dogRight, candleWrapper], {
                opacity: [1, 0],
                duration: 600,
                ease: 'outQuad',
                onComplete: () => {
                    [scrollLayer, dogLeft, dogLeftCloud, dogRight, candleWrapper].forEach(el => {
                        if (el) el.style.display = 'none';
                    });
                }
            });
        }

        // =========================================================================
        // PHASE 1 — GOLDEN LIGHT BUILDUP (0.0s → 1.5s)
        // Slowly and naturally intensify existing golden light from open gate.
        // User clearly notices golden glow growing, warm light spreading, floating dust,
        // soft light rays, and increasing bloom. First frontend remains visible.
        // =========================================================================
        transitionState.phase = 1;
        transitionState.particleAlpha = 1;

        if (animeLib && animeLib.animate) {
            // Camera subtle push-in over first 2.7s
            animeLib.animate(stage, {
                scale: [1, 1.08],
                duration: 2700,
                ease: 'inOutQuad'
            });

            // Doorway energy intensity builds up slowly (0 -> 0.65)
            animeLib.animate(energyState, {
                intensity: [0, 0.65],
                escapeFactor: [0, 0.45],
                duration: 1500,
                ease: 'inOutCubic'
            });

            // Golden light takeover expands slowly from gate center (scale 0.01 -> 1.8, opacity 0 -> 0.75)
            if (goldenLightTakeover) {
                animeLib.animate(goldenLightTakeover, {
                    scale: [0.01, 1.8],
                    opacity: [0, 0.75],
                    duration: 1500,
                    ease: 'inOutCubic'
                });
            }

            // Radial light rays gently grow
            animeLib.animate(transitionState, {
                rayOpacity: [0, 0.5],
                duration: 1500,
                ease: 'inOutQuad'
            });
        }

        startDoorwayStardust();
        startEscapingEnergyStream();
        spawnMagicalDustParticles(30);

        /* ===== BIRTHDAY REVEAL ASSET COMPOSITION START ===== */
        const birthdayRevealOverlay = document.getElementById('birthdayRevealOverlay');
        const royalCenterStack = document.getElementById('royalCenterStack');
        const royalCrownImg = document.getElementById('royalCrownImg');
        const birthdayTextBox = document.getElementById('birthdayTextBox');
        const birthdayTextImg = document.getElementById('birthdayTextImg');
        const royalCakeImg = document.getElementById('royalCakeImg');
        const decorItems = document.querySelectorAll('.decor-item');

        if (birthdayRevealOverlay && animeLib && animeLib.animate) {
            // ~1.5s: Reveal sequence starts as gate energy peaks
            setTimeout(() => {
                birthdayRevealOverlay.style.display = 'block';
                playClappingAudio();

                // 1. Royal Center Stack Entrance (soft fade & elegant scale)
                if (royalCenterStack) {
                    animeLib.animate(royalCenterStack, {
                        opacity: [0, 1],
                        scale: [0.92, 1.0],
                        duration: 700,
                        ease: 'outCubic'
                    });
                }

                // 2. Crown Stagger Entrance (floats down directly above text)
                if (royalCrownImg) {
                    animeLib.animate(royalCrownImg, {
                        opacity: [0, 1],
                        translateY: [-22, 0],
                        scale: [0.88, 1.0],
                        duration: 650,
                        delay: 120,
                        ease: 'outCubic',
                        onComplete: () => {
                            // Crown subtle shimmer float loop
                            animeLib.animate(royalCrownImg, {
                                translateY: [-3, 3],
                                scale: [1.0, 1.02, 1.0],
                                duration: 2400,
                                direction: 'alternate',
                                loop: true,
                                ease: 'inOutSine'
                            });
                        }
                    });
                }

                // 3. Birthday Text Artwork Entrance & Solid Hold (Exact Viewport Center)
                if (birthdayTextImg) {
                    animeLib.animate(birthdayTextImg, {
                        opacity: [0, 1],
                        scale: [0.95, 1.0],
                        duration: 700,
                        delay: 180,
                        ease: 'outCubic'
                    });
                }

                // 4. Cake Stagger Entrance (floats up directly below text)
                if (royalCakeImg) {
                    animeLib.animate(royalCakeImg, {
                        opacity: [0, 1],
                        translateY: [22, 0],
                        scale: [0.88, 1.0],
                        duration: 650,
                        delay: 260,
                        ease: 'outCubic',
                        onComplete: () => {
                            // Cake subtle float loop
                            animeLib.animate(royalCakeImg, {
                                translateY: [-3, 3],
                                duration: 2600,
                                direction: 'alternate',
                                loop: true,
                                ease: 'inOutSine'
                            });
                        }
                    });
                }

                // 5. Framing Balloons & Royal Assets Entrance & Floating Loops
                if (decorItems && decorItems.length > 0) {
                    decorItems.forEach((decor, index) => {
                        const staggerDelay = 80 + (index % 16) * 35;
                        const initialY = (index % 2 === 0) ? 22 : -18;
                        
                        // Entrance
                        animeLib.animate(decor, {
                            opacity: [0, 1],
                            translateY: [initialY, 0],
                            scale: [0.85, 1.0],
                            duration: 700,
                            delay: staggerDelay,
                            ease: 'outCubic',
                            onComplete: () => {
                                // Gentle, organic floating balloon loop
                                const floatDistance = 5 + (index % 5) * 2;
                                const floatDuration = 2400 + (index % 7) * 220;
                                const floatRot = (index % 2 === 0 ? 1 : -1) * (1.5 + (index % 4) * 0.5);
                                
                                animeLib.animate(decor, {
                                    translateY: [-floatDistance, floatDistance],
                                    rotate: [-floatRot, floatRot],
                                    duration: floatDuration,
                                    direction: 'alternate',
                                    loop: true,
                                    ease: 'inOutSine'
                                });
                            }
                        });
                    });
                }
            }, 1500);

            // ~4.5s - 5.2s: Exit sequence (Royal stack and balloon frame softly dissolve together)
            setTimeout(() => {
                fadeAndStopClappingAudio(700);
                if (birthdayRevealOverlay) {
                    animeLib.animate(birthdayRevealOverlay, {
                        opacity: [1, 0],
                        duration: 700,
                        ease: 'inQuad'
                    });
                }
                if (royalCenterStack) {
                    animeLib.animate(royalCenterStack, {
                        opacity: [1, 0],
                        scale: [1.0, 0.96],
                        duration: 700,
                        ease: 'inQuad'
                    });
                }

                if (decorItems && decorItems.length > 0) {
                    animeLib.animate(decorItems, {
                        opacity: [1, 0],
                        scale: [1.0, 0.94],
                        duration: 700,
                        ease: 'inQuad'
                    });
                }
            }, 4500);
        }
        /* ===== BIRTHDAY REVEAL ASSET COMPOSITION END ===== */

        // =========================================================================
        // PHASE 2 — MAGICAL ENERGY (1.5s → 2.7s)
        // Energy traveling through gate intensifies. Glowing particles, tiny sparkles,
        // golden dust, soft radial rays, and atmospheric glow build up smoothly.
        // =========================================================================
        setTimeout(() => {
            transitionState.phase = 2;
            spawnMagicalDustParticles(35);

            if (animeLib && animeLib.animate) {
                animeLib.animate(energyState, {
                    intensity: [0.65, 1.0],
                    escapeFactor: [0.45, 1.0],
                    duration: 1200,
                    ease: 'inOutQuad'
                });

                if (goldenLightTakeover) {
                    animeLib.animate(goldenLightTakeover, {
                        scale: [1.8, 3.2],
                        opacity: [0.75, 0.95],
                        duration: 1200,
                        ease: 'inOutQuad'
                    });
                }

                animeLib.animate(transitionState, {
                    rayOpacity: [0.5, 0.95],
                    duration: 1200,
                    ease: 'inOutQuad'
                });
            }
        }, 1500);

        // =========================================================================
        // PHASE 3 — GOLDEN FLASH (2.7s → 3.1s)
        // Short, elegant 0.4s golden bloom flash filling the screen with warm golden/cream light.
        // =========================================================================
        setTimeout(() => {
            transitionState.phase = 3;
            spawnMagicalDustParticles(25);

            if (animeLib && animeLib.animate) {
                if (goldenLightTakeover) {
                    animeLib.animate(goldenLightTakeover, {
                        scale: [3.2, 4.2],
                        opacity: [0.95, 1.0],
                        duration: 400,
                        ease: 'inQuad'
                    });
                }

                animeLib.animate(transitionState, {
                    rayOpacity: [0.95, 1.0],
                    duration: 400,
                    ease: 'inQuad'
                });
            }
        }, 2700);

        // =========================================================================
        // PHASE 4 — MAGICAL REVEAL (5.2s → 6.6s)
        // MOST IMPORTANT PART (1.4s duration):
        // 1. Immediately hide first frontend behind the opaque golden flash so it NEVER reappears.
        // 2. Second world emerges THROUGH the golden light (center pathway first via clipPath).
        // 3. Golden light overlay slowly dissolves from full opacity to 0 over the second world.
        // =========================================================================
        setTimeout(() => {
            transitionState.phase = 4;

            /* ===== Z-INDEX LAYERING HANDOFF — START ===== */
            if (memoryGarden) {
                memoryGarden.style.zIndex = '60'; // Temporarily place Frontend 2 above sceneContainer (50) & below goldenLightTakeover (100)
                memoryGarden.style.opacity = '0';
                memoryGarden.style.clipPath = 'circle(0% at 50% 40%)';
                memoryGarden.style.display = 'block';
                memoryGarden.style.visibility = 'visible';
                memoryGarden.classList.add('active');
            }
            if (goldenTransitionBackdrop) {
                goldenTransitionBackdrop.style.display = 'block';
            }

            // Immediately unlock scroll and initialize garden-mode state so scrollbar is present at exact reveal start
            document.body.classList.remove('lock-scroll');
            initMemorySegmentsSystem();
            /* ===== Z-INDEX LAYERING HANDOFF — END ===== */

            // Radial clip-path expansion: center pathway emerges first!
            const hideSceneContainer = () => {
                if (sceneContainer) {
                    sceneContainer.style.display = 'none';
                    sceneContainer.style.opacity = '0';
                    sceneContainer.style.visibility = 'hidden';
                    sceneContainer.style.pointerEvents = 'none';
                }
                if (goldenTransitionBackdrop) goldenTransitionBackdrop.style.display = 'none';
            };

            if (memoryGarden) {
                const animResult = runAnime(memoryGarden, {
                    clipPath: [
                        'circle(0% at 50% 40%)',
                        'circle(150% at 50% 40%)'
                    ],
                    opacity: [0, 1],
                    duration: 1400,
                    ease: 'outCubic',
                    onComplete: hideSceneContainer
                });

                if (!animResult) {
                    memoryGarden.style.opacity = '1';
                    memoryGarden.style.clipPath = 'circle(150% at 50% 40%)';
                }
            }

            // Dissolve golden light overlay slowly (1.0 -> 0) over the second world ONLY
            if (goldenLightTakeover) {
                runAnime(goldenLightTakeover, {
                    opacity: [1.0, 0],
                    duration: 1400,
                    ease: 'inQuad',
                    onComplete: () => {
                        if (goldenTransitionBackdrop) goldenTransitionBackdrop.style.display = 'none';
                    }
                });
            }

            // Softly fade radial light rays
            runAnime(transitionState, {
                rayOpacity: [1.0, 0],
                duration: 1400,
                ease: 'outQuad'
            });
        }, 5200);

        /* ===== HANDOFF LOADING SCREEN — START ===== */
        // Prepare and display opaque handoff loading screen before 5250ms scrollbar reflow
        setTimeout(() => {
            const handoffScreen = document.getElementById('handoffLoadingScreen');
            if (handoffScreen) {
                handoffScreen.classList.add('active');
                handoffScreen.style.display = 'flex';
                handoffScreen.style.opacity = '1';
                handoffScreen.style.visibility = 'visible';
            }
        }, 5150);
        /* ===== HANDOFF LOADING SCREEN — END ===== */

        // =========================================================================
        // PHASE 5 — SETTLE (6.6s → 7.1s)
        // Second frontend is fully visible.
        // Golden particles, rays, bloom, and transition haze slowly clear out.
        // Second frontend becomes active scrollable section.
        // =========================================================================
        setTimeout(() => {
            transitionState.phase = 5;

            if (memoryGarden) memoryGarden.style.zIndex = '';
            if (birthdayRevealOverlay) birthdayRevealOverlay.style.display = 'none';
            if (goldenLightTakeover) goldenLightTakeover.style.opacity = '0';
            if (sceneContainer) sceneContainer.style.display = 'none';
            /* ===== GOLDEN BACKDROP BLINK FIX — START ===== */
            if (goldenTransitionBackdrop) goldenTransitionBackdrop.style.display = 'none';
            /* ===== GOLDEN BACKDROP BLINK FIX — END ===== */

            // Unlock vertical page scrolling for memory garden
            document.body.classList.remove('lock-scroll');

            /* ===== HANDOFF LOADING SCREEN — START ===== */
            const dismissHandoffLoadingScreen = () => {
                const handoffScreen = document.getElementById('handoffLoadingScreen');
                const gardenBgImg = document.getElementById('gardenBgImg');
                
                const isGardenReady = memoryGarden && 
                    parseFloat(getComputedStyle(memoryGarden).opacity) >= 0.95 &&
                    getComputedStyle(memoryGarden).clipPath.includes('150%');

                const isImgLoaded = !gardenBgImg || (gardenBgImg.complete && gardenBgImg.naturalWidth > 0);

                if (isGardenReady && isImgLoaded) {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            if (handoffScreen) {
                                handoffScreen.style.opacity = '0';
                                setTimeout(() => {
                                    handoffScreen.classList.remove('active');
                                    handoffScreen.style.display = 'none';
                                    handoffScreen.style.visibility = 'hidden';
                                    secondFrontendMusic.play();
                                }, 400);
                            }
                        });
                    });
                } else {
                    requestAnimationFrame(dismissHandoffLoadingScreen);
                }
            };

            dismissHandoffLoadingScreen();
            /* ===== HANDOFF LOADING SCREEN — END ===== */

            // Slowly fade remaining floating particles over final 0.5s
            if (animeLib && animeLib.animate) {
                animeLib.animate(transitionState, {
                    particleAlpha: [1, 0],
                    duration: 500,
                    ease: 'outQuad',
                    onComplete: () => {
                        transitionState.phase = 0;
                        if (goldenTransitionBackdrop) goldenTransitionBackdrop.style.display = 'none';
                        if (typeof window.onGateTransitionComplete === 'function') {
                            window.onGateTransitionComplete();
                        }
                    }
                });
            } else {
                transitionState.phase = 0;
                if (goldenTransitionBackdrop) goldenTransitionBackdrop.style.display = 'none';
                document.body.classList.remove('lock-scroll');
                if (typeof window.onGateTransitionComplete === 'function') {
                    window.onGateTransitionComplete();
                }
            }
        }, 6600);
    }

    // --------------------------------------------------------------------------
    // Transition Complete Hook
    // --------------------------------------------------------------------------
    // Section-Specific Continuous Rope Positioning Architecture (Sections 2 to 14)
    // --------------------------------------------------------------------------
    const ROPE_POSITIONS = {
        2: 38,
        3: 38,
        4: 38,
        5: 38,
        6: 38,
        7: 38,
        8: 38
    };

    window.ROPE_POSITIONS = ROPE_POSITIONS;

    window.setSectionRopePosition = function(sectionNum, leftPercent) {
        if (sectionNum >= 2 && sectionNum <= 8) {
            ROPE_POSITIONS[sectionNum] = leftPercent;
            const segEl = document.getElementById(`gardenSegment-${sectionNum}`);
            if (segEl) {
                segEl.style.setProperty('--rope-x', `${leftPercent}%`);
            }
        }
    };

    // --------------------------------------------------------------------------
    // Data-Driven Memory Segments & Continuous Rope Architecture
    // --------------------------------------------------------------------------
    const MEMORY_SEGMENTS = [
        { id: 1, chapter: "", title: "", photo: "assets/after_png_main_photo.png", note: "", date: "", caption: "", ropeSide: "left" },
        { id: 2, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "right" },
        { id: 3, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "left" },
        { id: 4, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "right" },
        { id: 5, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "left" },
        { id: 6, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "right" },
        { id: 7, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "left" },
        { id: 8, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "right" }
    ];

    // --------------------------------------------------------------------------
    // Balloon & Video Assets Configuration
    // --------------------------------------------------------------------------
    const SECTION_BALLOONS = {
        2: {
            left1: 'assets/birthday_element/balloon_05_pastel_blue_heart.png',
            left2: 'assets/birthday_element/balloon_02_gold_round.png',
            rightCorner: 'assets/corner_balloon/balloon_03.png'
        },
        3: {
            left1: 'assets/birthday_element/balloon_09_blush_round.png',
            left2: 'assets/birthday_element/balloon_03_lavender_round.png',
            rightCorner: 'assets/corner_balloon/balloon_05.png'
        },
        4: {
            left1: 'assets/birthday_element/balloon_09_blush_round.png',
            left2: 'assets/birthday_element/balloon_10_gold_star.png',
            rightCorner: 'assets/corner_balloon/balloon_07.png'
        },
        5: {
            left1: 'assets/birthday_element/balloon_07_cream_round.png',
            left2: 'assets/birthday_element/balloon_06_peach_round.png',
            rightCorner: 'assets/corner_balloon/balloon_12.png'
        }
    };

    const SECTION_6_VIDEO_FILES = [
        'lv_0_20260903111644.mp4',
        'lv_0_20260905190537.mp4',
        'lv_7265175769041751298_20260905170139.mp4',
        'lv_7503953309502278965_20260905185812.mp4',
        'lv_7532382262227127613_20260905165325.mp4',
        'lv_7543967381010369853_20260905165859.mp4',
        'lv_7554306133251444021_20260905170256.mp4',
        'lv_7563568273841818885_20260905182334.mp4',
        'lv_7566202087344786741_20260905190640.mp4',
        'lv_7606729398334557457_20260905180441.mp4',
        'lv_7617465730862173493_20260905190057.mp4',
        'lv_7634563113672609041_20260905191312.mp4',
        'lv_7662357648163048725_20260905170420.mp4',
        'lv_7668657984754863380_20260905165222.mp4',
        'lv_7668737922501233927_20260905182054.mp4'
    ];

    window.updateBackgroundPosition = function(sectionIndex) {
        const bgImg = document.getElementById('gardenBgImg');
        if (!bgImg) return;

        const imgHeight = bgImg.getBoundingClientRect().height || bgImg.offsetHeight;
        const vh = window.innerHeight;
        const maxScroll = Math.max(0, imgHeight - vh);

        // Preserve exact current background distribution across Sections 1-8 without rescaling/redistributing
        const ORIGINAL_TOTAL_SECTIONS = 14;
        const progress = Math.max(0, Math.min(1, sectionIndex / (ORIGINAL_TOTAL_SECTIONS - 1)));
        const translateY = -progress * maxScroll;

        bgImg.style.transform = `translateY(${translateY.toFixed(2)}px) scale(1.02)`;
    };
    const updateBackgroundPosition = window.updateBackgroundPosition;

    window.scrollToSection = function(index, instant = false) {
        if (window.byeByeFinalState || window.isSection8RoseClicked) {
            if (index !== 7) return;
        }

        const segments = document.querySelectorAll('.garden-segment');
        if (!segments.length || index < 0 || index >= segments.length) return;

        currentSectionIndex = index;
        const targetSegment = segments[index];
        const targetTop = targetSegment.offsetTop;

        if (targetSegment && typeof window.triggerFrameEntranceAnimation === 'function') {
            window.triggerFrameEntranceAnimation(targetSegment);
        }

        updateBackgroundPosition(index);

        if (activeScrollAnimation) {
            try {
                if (typeof activeScrollAnimation.pause === 'function') {
                    activeScrollAnimation.pause();
                } else if (typeof activeScrollAnimation.cancel === 'function') {
                    activeScrollAnimation.cancel();
                }
            } catch (e) {}
            activeScrollAnimation = null;
        }

        const startY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

        window.scrollTo(0, targetTop);
        document.documentElement.scrollTop = targetTop;
        document.body.scrollTop = targetTop;

        if (typeof syncCardVideoPlayback === 'function') {
            syncCardVideoPlayback();
        }
    };
    const scrollToSection = window.scrollToSection;
    window.getCurrentSectionIndex = function() { return currentSectionIndex; };

    function unlockScrollAfterDelay(delay = 850) {
        if (window.byeByeFinalState || window.isSection8RoseClicked) {
            isScrollLocked = true;
            return;
        }
        clearTimeout(wheelCooldownTimer);
        wheelCooldownTimer = setTimeout(() => {
            if (window.byeByeFinalState || window.isSection8RoseClicked) {
                isScrollLocked = true;
                return;
            }
            isScrollLocked = false;
        }, delay);
    }

    window.isSecondFrontendActive = function() {
        const memoryGarden = document.getElementById('memoryGardenSection');
        return Boolean(memoryGarden && (
            memoryGarden.classList.contains('active') ||
            document.documentElement.classList.contains('garden-mode') ||
            document.body.classList.contains('garden-mode')
        ));
    };
    const isSecondFrontendActive = window.isSecondFrontendActive;

    function initSectionScrollController() {
        if (window.__sectionScrollControllerInitialized) return;
        window.__sectionScrollControllerInitialized = true;

        const TOTAL_SECTIONS = 8;

        // Handle Mouse Wheel & Trackpad Events
        window.addEventListener('wheel', (e) => {
            if (window.byeByeFinalState || window.isSection8RoseClicked) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (!isSecondFrontendActive()) return;

            // Prevent native continuous free scrolling
            e.preventDefault();

            const now = Date.now();
            if (isScrollLocked || (now - lastWheelTime < 800)) {
                return;
            }

            const delta = e.deltaY;
            if (Math.abs(delta) < 10) return;

            if (delta > 0) {
                // Scroll DOWN -> Next Section
                if (currentSectionIndex < TOTAL_SECTIONS - 1) {
                    isScrollLocked = true;
                    lastWheelTime = now;
                    scrollToSection(currentSectionIndex + 1, false);
                    unlockScrollAfterDelay(850);
                }
            } else if (delta < 0) {
                // Scroll UP -> Previous Section
                if (currentSectionIndex > 0) {
                    isScrollLocked = true;
                    lastWheelTime = now;
                    scrollToSection(currentSectionIndex - 1, false);
                    unlockScrollAfterDelay(850);
                }
            }
        }, { passive: false });

        // Handle Touch Events for Mobile / Tablet
        window.addEventListener('touchstart', (e) => {
            if (window.byeByeFinalState || window.isSection8RoseClicked) {
                return;
            }
            if (!isSecondFrontendActive() || !e.touches || !e.touches.length) return;
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (window.byeByeFinalState || window.isSection8RoseClicked) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (!isSecondFrontendActive()) return;
            e.preventDefault();
        }, { passive: false });

        window.addEventListener('touchend', (e) => {
            if (window.byeByeFinalState || window.isSection8RoseClicked) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (!isSecondFrontendActive() || !e.changedTouches || !e.changedTouches.length) return;
            if (isScrollLocked) return;

            const touchEndY = e.changedTouches[0].clientY;
            const touchEndX = e.changedTouches[0].clientX;
            const diffY = touchStartY - touchEndY;
            const diffX = touchStartX - touchEndX;

            if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 35) {
                if (diffY > 0) {
                    // Swipe UP -> Scroll DOWN
                    if (currentSectionIndex < TOTAL_SECTIONS - 1) {
                        isScrollLocked = true;
                        scrollToSection(currentSectionIndex + 1, false);
                        unlockScrollAfterDelay(650);
                    }
                } else {
                    // Swipe DOWN -> Scroll UP
                    if (currentSectionIndex > 0) {
                        isScrollLocked = true;
                        scrollToSection(currentSectionIndex - 1, false);
                        unlockScrollAfterDelay(650);
                    }
                }
            }
        }, { passive: true });

        // Handle Keyboard Navigation
        window.addEventListener('keydown', (e) => {
            if (window.byeByeFinalState || window.isSection8RoseClicked) {
                const navKeys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'ArrowLeft', 'ArrowRight'];
                if (navKeys.includes(e.key)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }
            if (!isSecondFrontendActive()) return;

            const navKeys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '];
            if (navKeys.includes(e.key)) {
                e.preventDefault();
            }

            if (isScrollLocked) return;

            if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
                if (currentSectionIndex < TOTAL_SECTIONS - 1) {
                    isScrollLocked = true;
                    scrollToSection(currentSectionIndex + 1, false);
                    unlockScrollAfterDelay(500);
                }
            } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
                if (currentSectionIndex > 0) {
                    isScrollLocked = true;
                    scrollToSection(currentSectionIndex - 1, false);
                    unlockScrollAfterDelay(500);
                }
            } else if (e.key === 'Home') {
                isScrollLocked = true;
                scrollToSection(0, false);
                unlockScrollAfterDelay(500);
            } else if (e.key === 'End') {
                isScrollLocked = true;
                scrollToSection(TOTAL_SECTIONS - 1, false);
                unlockScrollAfterDelay(500);
            }
        });
    }

    window.onGateTransitionComplete = function() {
        console.log("Cinematic transition complete: Magical Memory Garden active & scrollable.");
        window.__gateCallbackFired = true;
        const memoryGarden = document.getElementById('memoryGardenSection');
        const sceneContainer = document.getElementById('sceneContainer');
        if (memoryGarden) {
            memoryGarden.style.display = 'block';
            memoryGarden.style.visibility = 'visible';
            memoryGarden.style.opacity = '1';
            memoryGarden.style.clipPath = 'circle(150% at 50% 40%)';
            memoryGarden.classList.add('active');
        }
        document.body.classList.remove('lock-scroll');
        if (sceneContainer) sceneContainer.style.display = 'none';
        initMemorySegmentsSystem();
        secondFrontendMusic.play();
    };

    // Helper for direct garden preview testing via console or URL query (e.g. ?garden=true)
    window.revealGarden = function() {
        const memoryGarden = document.getElementById('memoryGardenSection');
        const sceneContainer = document.getElementById('sceneContainer');
        if (memoryGarden) {
            memoryGarden.style.display = 'block';
            memoryGarden.style.visibility = 'visible';
            memoryGarden.style.opacity = '1';
            memoryGarden.style.clipPath = 'circle(150% at 50% 40%)';
            memoryGarden.classList.add('active');
        }
        document.body.classList.remove('lock-scroll');
        if (sceneContainer) sceneContainer.style.display = 'none';
        initMemorySegmentsSystem();
        secondFrontendMusic.play();
    };

    if (window.location.search.includes('garden=true') || window.location.hash === '#garden') {
        window.revealGarden();
    }

    function resetGestureState() {
        clearTimeout(wheelInertiaTimer);
        clearTimeout(gestureMinDurationTimer);
        wheelInertiaTimer = null;
        gestureMinDurationTimer = null;
        isGestureActive = false;
        isNavigating = false;
    }

    window.addEventListener('resize', () => {
        updateBackgroundPosition(currentSectionIndex);
    });

    function unlockScrollAfterDelay(delay = 850) {
        clearTimeout(wheelCooldownTimer);
        wheelCooldownTimer = setTimeout(() => {
            isScrollLocked = false;
        }, delay);
    }



    function getSection6VideoPositions(count) {
        const basePositions = [
            // Upper Tier (above central heading)
            { top: '6%', left: '2.5%', rotate: '-4deg' },
            { top: '10%', left: '21.5%', rotate: '3deg' },
            { top: '5%', left: '43.5%', rotate: '-2deg' },
            { top: '10%', left: '63.5%', rotate: '4deg' },
            { top: '6%', left: '83.5%', rotate: '-3deg' },

            // Middle Tier (flanking central heading)
            { top: '40%', left: '1.5%', rotate: '4deg' },
            { top: '40%', left: '84.5%', rotate: '-4deg' },

            // Lower Tier 1 (below central heading)
            { top: '58%', left: '4.5%', rotate: '-3deg' },
            { top: '62%', left: '27.5%', rotate: '4deg' },
            { top: '62%', left: '56.5%', rotate: '-4deg' },
            { top: '58%', left: '79.5%', rotate: '3deg' },

            // Lower Tier 2 (bottom area)
            { top: '77%', left: '2.5%', rotate: '3deg' },
            { top: '81%', left: '23.5%', rotate: '-5deg' },
            { top: '81%', left: '60.5%', rotate: '4deg' },
            { top: '77%', left: '83.5%', rotate: '-2deg' }
        ];

        if (count <= basePositions.length) {
            return basePositions.slice(0, count);
        }

        const result = [];
        const rows = Math.ceil(Math.sqrt(count));
        const cols = Math.ceil(count / rows);
        const rowStep = (85 - 32) / Math.max(1, rows - 1);
        const colStep = (85 - 6) / Math.max(1, cols - 1);

        for (let i = 0; i < count; i++) {
            const r = Math.floor(i / cols);
            const c = i % cols;
            const top = 32 + r * rowStep + ((i % 2 === 0 ? 1 : -1) * 2);
            const left = 6 + c * colStep + ((i % 3 === 0 ? 1 : -1) * 2);
            const rot = (i % 2 === 0 ? 1 : -1) * (2 + (i % 4));
            result.push({
                top: `${top.toFixed(1)}%`,
                left: `${left.toFixed(1)}%`,
                rotate: `${rot}deg`
            });
        }
        return result;
    }

    function getSection6VideosHtml() {
        const count = SECTION_6_VIDEO_FILES.length;
        const positions = getSection6VideoPositions(count);

        return `
            <div class="sec6-videos-container" id="sec6VideosContainer">
                ${SECTION_6_VIDEO_FILES.map((filename, i) => {
                    const pos = positions[i] || { top: '50%', left: '50%', rotate: '0deg' };
                    const videoSrc = `assets/section6_videos/${filename}`;
                    const baseName = filename.substring(0, filename.lastIndexOf('.')) || filename;
                    const thumbSrc = `assets/section6_thumbnails/${baseName}.jpg`;
                    return `
                        <div class="sec6-video-card float-active" id="sec6VideoCard-${i + 1}" style="top: ${pos.top}; left: ${pos.left}; transform: rotate(${pos.rotate}); --card-rotate: ${pos.rotate};" data-video-src="${videoSrc}">
                            <img src="${thumbSrc}" class="sec6-card-video sec6-card-thumb" alt="Section 6 Memory Thumbnail" />
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    let isSec6Active = false;

    function pauseAllCardVideos() {
        if (sec6PlaybackTimer) {
            clearTimeout(sec6PlaybackTimer);
            sec6PlaybackTimer = null;
        }
    }

    function playAllSection6CardVideos() {
        // Card previews are now lightweight static thumbnails (3.0s frame captures).
        // Zero active video decoding/playback load while browsing cards.
    }

    function syncCardVideoPlayback() {
        // Card previews are static images.
    }

    function initSection6VideoEvents() {
        const overlay = document.getElementById('sec6VideoOverlay');
        const overlayVideo = document.getElementById('sec6VideoOverlayVideo');
        const closeBtn = document.getElementById('sec6VideoOverlayCloseBtn');
        const backdrop = document.getElementById('sec6VideoOverlayBackdrop');

        if (!overlay || !overlayVideo) return;

        function openOverlay(videoSrc) {
            isSec6Active = false;
            pauseAllCardVideos();

            if (typeof secondFrontendMusic !== 'undefined' && secondFrontendMusic.pauseForVideo) {
                secondFrontendMusic.pauseForVideo();
            }

            overlayVideo.src = videoSrc;
            overlayVideo.muted = true;
            overlayVideo.currentTime = 0;
            overlayVideo.play().catch(() => {});

            overlay.style.display = 'flex';
            void overlay.offsetWidth;
            overlay.classList.add('active');
        }

        function closeOverlay() {
            overlay.classList.remove('active');
            try { overlayVideo.pause(); } catch (e) {}
            try { overlayVideo.src = ''; } catch (e) {}
            setTimeout(() => {
                overlay.style.display = 'none';
                syncCardVideoPlayback();
            }, 350);

            if (typeof secondFrontendMusic !== 'undefined' && secondFrontendMusic.resumeFromVideo) {
                secondFrontendMusic.resumeFromVideo();
            }
        }

        const cards = document.querySelectorAll('.sec6-video-card');
        cards.forEach(card => {
            if (!card.dataset.eventsBound) {
                card.dataset.eventsBound = 'true';
                card.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const src = card.getAttribute('data-video-src');
                    if (src) openOverlay(src);
                });
            }
        });

        if (closeBtn && !closeBtn.dataset.eventsBound) {
            closeBtn.dataset.eventsBound = 'true';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeOverlay();
            });
        }

        if (backdrop && !backdrop.dataset.eventsBound) {
            backdrop.dataset.eventsBound = 'true';
            backdrop.addEventListener('click', (e) => {
                e.stopPropagation();
                closeOverlay();
            });
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('active')) {
                closeOverlay();
            }
        });

        // IntersectionObserver for Section 6 container
        const sec6Segment = document.getElementById('gardenSegment-6');
        if (sec6Segment && !sec6PlaybackObserver) {
            sec6PlaybackObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        syncCardVideoPlayback();
                    } else {
                        pauseAllCardVideos();
                    }
                });
            }, { threshold: 0.15 });

            sec6PlaybackObserver.observe(sec6Segment);
        }
    }

    function getSectionBalloonHtml(secId) {
        if (secId < 2 || secId > 5) return '';
        const b = SECTION_BALLOONS[secId];
        if (!b) return '';
        return `
            <!-- ===== SECTION ${secId} BALLOON DECORATIONS — START ===== -->
            <div class="section2-temp-balloon-container" aria-hidden="true">
                <img src="${b.left1}" class="section2-temp-balloon section2-temp-balloon-1" alt="Section ${secId} Left Balloon 1" />
                <img src="${b.left2}" class="section2-temp-balloon section2-temp-balloon-2" alt="Section ${secId} Left Balloon 2" />
            </div>
            <img src="${b.rightCorner}" class="section2-temp-right-corner-balloon" alt="Section ${secId} Right Corner Balloon" aria-hidden="true" />
            <!-- ===== SECTION ${secId} BALLOON DECORATIONS — END ===== -->
        `;
    }

    // SECTION 7 MASTER REPLACEABLE NOTE ASSET
    const SECTION_7_NOTE_ASSET = 'assets/Cute Birthday Wish Notepad.png';

    function renderMemorySegments() {
        const segmentsContainer = document.getElementById('segmentsContainer');
        if (!segmentsContainer) return;
        const existingSeg1 = document.getElementById('gardenSegment-1');

        MEMORY_SEGMENTS.forEach((seg, idx) => {
            if (document.getElementById(`gardenSegment-${seg.id}`)) return;

            const segEl = document.createElement('div');
            segEl.className = `garden-segment segment-side-${seg.ropeSide} ${seg.id === 1 ? 'segment-standalone' : ''}`;
            segEl.id = `gardenSegment-${seg.id}`;
            segEl.setAttribute('data-segment-index', idx);

            if (seg.id === 1 && seg.photo) {
                // SEGMENT 1: Standalone complete PNG artwork floating directly over garden background
                segEl.innerHTML = `
                    <div class="section1-balloons-container" aria-hidden="true">
                        <img src="assets/corner_balloon/balloon_01.png" class="section1-balloon section1-balloon-top-left-1" alt="Section 1 Upper Left Balloon 1" />
                        <img src="assets/corner_balloon/balloon_05.png" class="section1-balloon section1-balloon-top-left-2" alt="Section 1 Upper Left Balloon 2" />
                        <img src="assets/corner_balloon/balloon_09.png" class="section1-balloon section1-balloon-top-right-1" alt="Section 1 Upper Right Balloon 1" />
                        <img src="assets/corner_balloon/balloon_14.png" class="section1-balloon section1-balloon-top-right-2" alt="Section 1 Upper Right Balloon 2" />
                        <img src="assets/corner_balloon/balloon_04.png" class="section1-balloon section1-balloon-bottom-left" alt="Section 1 Bottom Left Balloon" />
                        <img src="assets/corner_balloon/balloon_11.png" class="section1-balloon section1-balloon-bottom-right" alt="Section 1 Bottom Right Balloon" />
                    </div>
                    <div class="rope-clip-anchor" aria-hidden="true">
                        <div class="rope-peg"></div>
                    </div>
                    <div class="segment-inner standalone-artwork-inner">
                        <div class="standalone-artwork-wrapper" id="artworkWrapper-1">
                            <img src="${seg.photo}" class="standalone-artwork-img" alt="Memory Artwork 1" />
                        </div>
                    </div>
                `;
            } else {
                const ropeX = ROPE_POSITIONS[seg.id] ?? 38;
                const ropeOffsetVh = (seg.id - 2) * 100;
                segEl.style.setProperty('--rope-x', `${ropeX}%`);

                // SECTION_2_MASTER_LAYOUT: Approved & Locked Master Reference
                let sectionContentHtml = '';
                if (seg.id === 2) {
                    sectionContentHtml = `
                        ${getSectionBalloonHtml(2)}
                        <div class="section2-frame-wrapper section2-frame-wrapper-1" style="left: var(--rope-x, ${ropeX}%);">
                            <img src="assets/Frame_image_0.png" class="section2-frame-img" alt="Frame Image 0" />
                        </div>
                        <div class="section2-frame-wrapper section2-frame-wrapper-2" style="left: var(--rope-x, ${ropeX}%);">
                            <img src="assets/Frame_image_14-removebg.png" class="section2-frame-img" alt="Frame Image 14" />
                        </div>
                        <img src="assets/teddy_test.png" class="section-teddy section-2-teddy" id="section2Teddy" alt="Section 2 Teddy Bear" />
                        <video src="assets/dog_7_final.webm" class="section-right-dog section-2-right-dog" id="section2RightDog" autoplay loop muted playsinline preload="auto"></video>
                        <img src="assets/Second section final.png" class="section-thinking-cloud section-2-thinking-cloud" id="section2ThinkingCloud" alt="Thinking Cloud Note" />
                    `;
                } else if (seg.id === 3) {
                    sectionContentHtml = `
                        ${getSectionBalloonHtml(3)}
                        <div class="section2-frame-wrapper section2-frame-wrapper-1" style="left: var(--rope-x, ${ropeX}%);">
                            <img src="assets/Frame_image_1-removebg.png" class="section2-frame-img" alt="Frame Image 1" />
                        </div>
                        <div class="section2-frame-wrapper section2-frame-wrapper-2" style="left: var(--rope-x, ${ropeX}%);">
                            <img src="assets/Frame_image_9-removebg.png" class="section2-frame-img" alt="Frame Image 9" />
                        </div>
                        <img src="assets/teddy_02.png" class="section-teddy section-3-teddy" id="section3Teddy" alt="Section 3 Teddy Bear" />
                        <video src="assets/dog_10.webm" class="section-right-dog section-3-right-dog" id="section3RightDog" autoplay loop muted playsinline preload="auto"></video>
                        <img src="assets/Third section text final.png" class="section-thinking-cloud section-3-thinking-cloud" id="section3ThinkingCloud" alt="Thinking Cloud Note" />
                    `;
                } else if (seg.id === 4) {
                    sectionContentHtml = `
                        ${getSectionBalloonHtml(4)}
                        <div class="section2-frame-wrapper section2-frame-wrapper-1" style="left: var(--rope-x, ${ropeX}%);">
                            <img src="assets/Frame_image_8-removebg.png" class="section2-frame-img" alt="Frame Image 8" />
                        </div>
                        <div class="section2-frame-wrapper section2-frame-wrapper-2" style="left: var(--rope-x, ${ropeX}%);">
                            <img src="assets/Frame_image_10-removebg.png" class="section2-frame-img" alt="Frame Image 10" />
                        </div>
                        <img src="assets/teddy_03.png" class="section-teddy section-4-teddy" id="section4Teddy" alt="Section 4 Teddy Bear" />
                        <video src="assets/dog_3_final.webm" class="section-right-dog section-4-right-dog" id="section4RightDog" autoplay loop muted playsinline preload="auto"></video>
                        <img src="assets/Fourth section text.png" class="section-thinking-cloud section-4-thinking-cloud" id="section4ThinkingCloud" alt="Section 4 Thinking Cloud Note" />
                    `;
                } else if (seg.id === 5) {
                    sectionContentHtml = `
                        ${getSectionBalloonHtml(5)}
                        <div class="section2-frame-wrapper section2-frame-wrapper-1" style="left: var(--rope-x, ${ropeX}%);">
                            <img src="assets/Frame_image_13-removebg.png" class="section2-frame-img" alt="Frame Image 13" />
                        </div>
                        <div class="section2-frame-wrapper section2-frame-wrapper-2" style="left: var(--rope-x, ${ropeX}%);">
                            <img src="assets/Frame_image_3-removebg.png" class="section2-frame-img" alt="Frame Image 3" />
                        </div>
                        <img src="assets/teddy_04.png" class="section-teddy section-5-teddy" id="section5Teddy" alt="Section 5 Teddy Bear" />
                        <video src="assets/dog_7_final.webm" class="section-right-dog section-5-right-dog" id="section5RightDog" autoplay loop muted playsinline preload="auto"></video>
                        <img src="assets/final_section_text.png" class="section-thinking-cloud section-5-thinking-cloud" id="section5ThinkingCloud" alt="Section 5 Thinking Cloud Note" />
                    `;
                } else if (seg.id === 6) {
                    sectionContentHtml = `
                        <div class="section6-heading-wrapper" aria-hidden="true">
                            <img src="assets/Heading Final.png" class="section6-heading-img" alt="Section 6 Heading" />
                        </div>
                        ${getSection6VideosHtml()}
                    `;
                } else if (seg.id === 7) {
                    sectionContentHtml = `
                        <div class="section7-container" id="section7Container">
                            <!-- DEDICATED MAGICAL FIREFLIES / PARTICLES LAYER -->
                            <div class="section7-particles-container" id="section7ParticlesContainer" aria-hidden="true"></div>

                            <!-- DEDICATED BALLOONS DECORATION LAYER -->
                            <div class="section7-balloons-container" id="section7BalloonsContainer" aria-hidden="true"></div>

                            <!-- HEADLINE IMAGE DIRECTLY ABOVE CAKE -->
                            <div class="section7-headline-placeholder" id="section7HeadlinePlaceholder" aria-label="Section 7 Headline Area">
                                <img src="assets/Birthday_cake_text.png" class="section7-headline-img" id="section7HeadlineImg" alt="Birthday Cake Text" />
                            </div>
                            
                            <!-- INDEPENDENT CAKE WRAPPER & IMAGE (CENTERED MAIN SUBJECT) -->
                            <div class="section7-cake-wrapper" id="section7CakeWrapper">
                                <div class="section7-cake-aura" id="section7CakeAura"></div>
                                <img src="assets/Cake.png" class="section7-cake-img" id="section7CakeImg" alt="Section 7 Birthday Cake" />
                            </div>

                            <!-- DEDICATED SECTION 7 FULL-SCREEN MAGICAL NOTE OVERLAY -->
                            <div class="section7-note-overlay" id="section7NoteOverlay" aria-hidden="true">
                                <div class="section7-note-backdrop" id="section7NoteBackdrop"></div>
                                <div class="section7-note-wrapper" id="section7NoteWrapper">
                                    <div class="section7-note-header-bar" id="section7NoteHeaderBar">
                                        <div class="section7-note-controls" id="section7NoteControls">
                                            <button class="section7-note-btn section7-note-zoom-out" id="section7NoteZoomOutBtn" title="Zoom Out (-)">-</button>
                                            <span class="section7-note-zoom-level" id="section7NoteZoomLevel">100%</span>
                                            <button class="section7-note-btn section7-note-zoom-in" id="section7NoteZoomInBtn" title="Zoom In (+)">+</button>
                                            <button class="section7-note-btn section7-note-zoom-reset" id="section7NoteZoomResetBtn" title="Reset Zoom">Reset</button>
                                        </div>
                                        <button class="section7-note-close-btn" id="section7NoteCloseBtn" aria-label="Close Note">&times;</button>
                                    </div>
                                    <div class="section7-note-scroll-viewer" id="section7NoteScrollViewer">
                                        <div class="section7-note-img-stage" id="section7NoteImgStage">
                                            <img src="${SECTION_7_NOTE_ASSET}" class="section7-note-img" id="section7NoteImg" alt="Cute Birthday Wish Notepad" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                } else if (seg.id === 8) {
                    sectionContentHtml = `
                        <div class="section8-container" id="section8Container">
                            <div class="section8-heading-wrapper" aria-label="Section 8 Heading Area">
                                <img src="assets/Final Text.png" class="section8-heading-img" id="section8HeadingImg" alt="Section 8 Heading" />
                            </div>
                            <div class="section8-rose-wrapper" id="section8RoseWrapper" aria-label="Section 8 Rose Subject">
                                <img src="assets/Rose.png" class="section8-rose-img" id="section8RoseImg" alt="Rose Subject" />
                            </div>
                            <div class="section8-text-wrapper" id="section8TextWrapper" aria-label="Section 8 Rose Text">
                                <img src="assets/Rose text.png" class="section8-text-img" id="section8TextImg" alt="Rose Text" />
                            </div>

                            <!-- REPLICATED MAGICAL PINK LIGHT TAKEOVER LAYER -->
                            <div class="section8-pink-light-takeover" id="section8PinkLightTakeover" aria-hidden="true"></div>
                            <div class="section8-pink-rays" id="section8PinkRays" aria-hidden="true"></div>

                            <!-- REPLICATED DESTINATION CONTENT REVEAL OVERLAY -->
                            <div class="section8-reveal-overlay" id="section8RevealOverlay" aria-hidden="true">
                                <div class="section8-pink-backdrop" id="section8PinkBackdrop"></div>
                                <div class="section8-funny-wrapper" id="section8FunnyWrapper">
                                    <img src="assets/Funny.jpeg" class="section8-funny-img" id="section8FunnyImg" alt="Funny Moment" />
                                    <div class="section8-last-text-wrapper" id="section8LastTextWrapper">
                                        <img src="assets/Last transition text.png" class="section8-last-text-img" id="section8LastTextImg" alt="Last Transition Text" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }

                const ropeAnchorHtml = (seg.id === 6 || seg.id === 7 || seg.id === 8) ? '' : `
                    <div class="segment-rope-anchor" aria-hidden="true" style="left: var(--rope-x, ${ropeX}%);">
                        <img src="assets/continuous_rope_section2_to_section14_14040px_CLEAN_TRANSPARENT.png" class="segment-rope-img" style="top: -${ropeOffsetVh}vh;" alt="" />
                    </div>
                    <div class="rope-clip-anchor" aria-hidden="true">
                        <div class="rope-peg"></div>
                    </div>
                `;

                segEl.innerHTML = `
                    ${ropeAnchorHtml}
                    ${sectionContentHtml}
                `;
            }

            segmentsContainer.appendChild(segEl);
        });

        // Bind hover & click float handlers for Section 2 frames
        const sec2Wrappers = document.querySelectorAll('.section2-frame-wrapper');
        sec2Wrappers.forEach(w => {
            if (!w.dataset.eventsBound) {
                w.dataset.eventsBound = 'true';
                w.addEventListener('mouseenter', () => {
                    w.classList.remove('is-entrance-animating');
                    w.classList.add('is-hovered');
                });
                w.addEventListener('mouseleave', () => {
                    w.classList.remove('is-hovered');
                });
                w.addEventListener('click', (e) => {
                    e.stopPropagation();
                    w.classList.add('is-hovered');
                    setTimeout(() => {
                        if (!w.matches(':hover')) {
                            w.classList.remove('is-hovered');
                        }
                    }, 2400);
                });
            }
        });

        initSegmentObserver();
        initSection6VideoEvents();
        initSection7CakeAnimation();
        initSection8RoseAnimation();
        initSection7Balloons();
        initSection7Particles();
    }

    let section7CakeAnimeInstance = null;
    let isSection7CakeClicked = false;

    let section8RoseAnimeInstance = null;

    let section8RoseTextAnimeLoop = null;

    function initSection8RoseTextFadeLoop() {
        if (section8RoseTextAnimeLoop) return;

        const target = document.getElementById('section8TextWrapper') || document.getElementById('section8TextImg');
        if (!target) return;

        const animeLib = window.anime;
        if (!animeLib) return;

        let isStopped = false;
        let activeAnim = null;

        function runCycle() {
            if (isStopped) return;
            target.style.opacity = '0';

            // Initial Wait (250ms)
            setTimeout(() => {
                if (isStopped) return;

                // Fade In (450ms)
                const fadeInCallback = () => {
                    if (isStopped) return;

                    // Visible Hold (3000ms)
                    setTimeout(() => {
                        if (isStopped) return;

                        // Fade Out (450ms)
                        const fadeOutCallback = () => {
                            if (isStopped) return;

                            // Invisible Wait (1200ms)
                            setTimeout(() => {
                                if (isStopped) return;
                                runCycle();
                            }, 1200);
                        };

                        if (animeLib && animeLib.animate) {
                            activeAnim = animeLib.animate(target, {
                                opacity: [1, 0],
                                duration: 450,
                                ease: 'inOutSine',
                                onComplete: fadeOutCallback
                            });
                        } else if (typeof animeLib === 'function') {
                            activeAnim = animeLib({
                                targets: target,
                                opacity: [1, 0],
                                duration: 450,
                                easing: 'easeInOutSine',
                                complete: fadeOutCallback
                            });
                        } else {
                            target.style.opacity = '0';
                            fadeOutCallback();
                        }

                    }, 3000);
                };

                if (animeLib && animeLib.animate) {
                    activeAnim = animeLib.animate(target, {
                        opacity: [0, 1],
                        duration: 450,
                        ease: 'inOutSine',
                        onComplete: fadeInCallback
                    });
                } else if (typeof animeLib === 'function') {
                    activeAnim = animeLib({
                        targets: target,
                        opacity: [0, 1],
                        duration: 450,
                        easing: 'easeInOutSine',
                        complete: fadeInCallback
                    });
                } else {
                    target.style.opacity = '1';
                    fadeInCallback();
                }

            }, 250);
        }

        section8RoseTextAnimeLoop = {
            stop: () => {
                isStopped = true;
                if (activeAnim) {
                    try { if (typeof activeAnim.pause === 'function') activeAnim.pause(); } catch (e) {}
                }
            }
        };

        runCycle();
    }

    let isSection8RoseClicked = false;
    let section8FaahAudio = null;
    let section8AudioCtx = null;
    let section8GainNode = null;
    let isSection8AudioPlayed = false;

    function playSection8FaahAudio() {
        if (isSection8AudioPlayed) return;
        isSection8AudioPlayed = true;

        try {
            if (!section8FaahAudio) {
                section8FaahAudio = new Audio('assets/Faah final.mp4');
            }

            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass && !section8AudioCtx) {
                section8AudioCtx = new AudioContextClass();
                const source = section8AudioCtx.createMediaElementSource(section8FaahAudio);
                section8GainNode = section8AudioCtx.createGain();
                section8GainNode.gain.value = 1.5;
                source.connect(section8GainNode);
                section8GainNode.connect(section8AudioCtx.destination);
            }

            if (section8AudioCtx && section8AudioCtx.state === 'suspended') {
                section8AudioCtx.resume();
            }

            section8FaahAudio.play().catch(err => {
                console.error('Section 8 Faah final.mp4 audio play error:', err);
            });
        } catch (err) {
            console.error('Section 8 Faah final.mp4 audio error:', err);
        }
    }

    function initSection8RoseAnimation() {
        const roseImg = document.getElementById('section8RoseImg');
        const roseWrapper = document.getElementById('section8RoseWrapper');

        initSection8RoseTextFadeLoop();

        if (!roseImg || !roseWrapper) return;

    function spawnSection8PinkMistPuff() {
        const roseWrapper = document.getElementById('section8RoseWrapper');
        if (!roseWrapper) return;
        const rect = roseWrapper.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        for (let i = 0; i < 25; i++) {
            const p = document.createElement('div');
            p.className = 'section8-pink-mist-particle';
            const size = Math.random() * 24 + 12;
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 60 + 10;
            const tx = Math.cos(angle) * dist;
            const ty = Math.sin(angle) * dist - 20;

            p.style.cssText = `
                position: fixed;
                left: ${centerX}px;
                top: ${centerY}px;
                width: ${size}px;
                height: ${size}px;
                background: radial-gradient(circle, rgba(255,182,193,0.85) 0%, rgba(255,105,180,0.4) 60%, rgba(255,105,180,0) 100%);
                border-radius: 50%;
                pointer-events: none;
                z-index: 120;
                transform: translate(-50%, -50%) scale(0.4);
                transition: transform 0.8s ease-out, opacity 0.8s ease-out;
                opacity: 0.9;
            `;
            document.body.appendChild(p);

            requestAnimationFrame(() => {
                p.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1.6)`;
                p.style.opacity = '0';
            });

            setTimeout(() => { if (p && p.parentNode) p.parentNode.removeChild(p); }, 850);
        }
    }

    // Rose Click/Touch Trigger: Replicated Candle-Click Magical Pink Reveal Sequence
    const handleRoseTrigger = (e) => {
        if (e) {
            try { e.preventDefault(); } catch (err) {}
            try { e.stopPropagation(); } catch (err) {}
        }
        if (isSection8RoseClicked) return; // Trigger ONLY ONCE
        isSection8RoseClicked = true;
        window.byeByeFinalState = true;
        isScrollLocked = true;
        document.body.classList.add('lock-scroll');

        if (typeof secondFrontendMusic !== 'undefined' && secondFrontendMusic.permanentlyStop) {
            secondFrontendMusic.permanentlyStop();
        }

        // Pre-create AudioContext during user gesture stack so browser allows unblocked audio playback on reveal completion
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass && !section8AudioCtx) {
                section8FaahAudio = new Audio('assets/Faah final.mp4');
                section8AudioCtx = new AudioContextClass();
                const source = section8AudioCtx.createMediaElementSource(section8FaahAudio);
                section8GainNode = section8AudioCtx.createGain();
                section8GainNode.gain.value = 1.5;
                source.connect(section8GainNode);
                section8GainNode.connect(section8AudioCtx.destination);
            }
            if (section8AudioCtx && section8AudioCtx.state === 'suspended') {
                section8AudioCtx.resume();
            }
        } catch (err) {}

        const animeLib = window.anime;

        // 1. Initial Mist Puff (t = 0.0s - 0.4s)
        spawnSection8PinkMistPuff();

        const pinkTakeover = document.getElementById('section8PinkLightTakeover');
        const pinkRays = document.getElementById('section8PinkRays');
        const revealOverlay = document.getElementById('section8RevealOverlay');
        const funnyWrapper = document.getElementById('section8FunnyWrapper');
        const pinkBackdrop = document.getElementById('section8PinkBackdrop');

        // 2. PHASE 1 — MAGICAL PINK LIGHT BUILDUP (0.0s -> 1.5s)
        // Replicates Candle Phase 1 Light Buildup (scale 0.01 -> 1.8, opacity 0 -> 0.85, 1500ms inOutCubic)
        if (animeLib && (typeof animeLib === 'function' || animeLib.animate)) {
            if (pinkTakeover) {
                if (typeof animeLib === 'function') {
                    animeLib({
                        targets: pinkTakeover,
                        scale: [0.01, 1.8],
                        opacity: [0, 0.85],
                        duration: 1500,
                        easing: 'easeInOutCubic'
                    });
                } else if (animeLib.animate) {
                    animeLib.animate(pinkTakeover, {
                        scale: [0.01, 1.8],
                        opacity: [0, 0.85],
                        duration: 1500,
                        ease: 'inOutCubic'
                    });
                }
            }

            if (pinkRays) {
                if (typeof animeLib === 'function') {
                    animeLib({
                        targets: pinkRays,
                        opacity: [0, 0.6],
                        duration: 1500,
                        easing: 'easeInOutQuad'
                    });
                } else if (animeLib.animate) {
                    animeLib.animate(pinkRays, {
                        opacity: [0, 0.6],
                        duration: 1500,
                        ease: 'inOutQuad'
                    });
                }
            }
        } else {
            if (pinkTakeover) {
                pinkTakeover.style.transform = 'translate(-50%, -50%) scale(1.8)';
                pinkTakeover.style.opacity = '0.85';
            }
        }

        // 3. PHASE 2 — CINEMATIC PHOTO DISSOLVE & DEPTH PRESENTATION (Starts seamlessly at 1.4s)
        setTimeout(() => {
            if (revealOverlay) {
                revealOverlay.classList.add('is-active');
                revealOverlay.setAttribute('aria-hidden', 'false');
            }
            if (pinkBackdrop) pinkBackdrop.style.opacity = '1';

            // Gentle opacity dissolve + subtle scale entrance (0.95 -> 1.00, 750ms, outCubic)
            if (funnyWrapper) {
                if (animeLib && (typeof animeLib === 'function' || animeLib.animate)) {
                    if (typeof animeLib === 'function') {
                        animeLib({
                            targets: funnyWrapper,
                            opacity: [0, 1],
                            scale: [0.95, 1.00],
                            duration: 750,
                            easing: 'easeOutCubic',
                            complete: () => {
                                playSection8FaahAudio();
                                // Subtle floating + breathing zoom depth loop
                                animeLib({
                                    targets: funnyWrapper,
                                    translateY: [-3, 3],
                                    scale: [1.000, 1.012, 1.000],
                                    duration: 2800,
                                    direction: 'alternate',
                                    loop: true,
                                    easing: 'easeInOutSine'
                                });
                            }
                        });
                    } else if (animeLib.animate) {
                        animeLib.animate(funnyWrapper, {
                            opacity: [0, 1],
                            scale: [0.95, 1.00],
                            duration: 750,
                            ease: 'outCubic',
                            onComplete: () => {
                                playSection8FaahAudio();
                                animeLib.animate(funnyWrapper, {
                                    translateY: [-3, 3],
                                    scale: [1.000, 1.012, 1.000],
                                    duration: 2800,
                                    direction: 'alternate',
                                    loop: true,
                                    ease: 'inOutSine'
                                });
                            }
                        });
                    }
                } else {
                    funnyWrapper.style.opacity = '1';
                    funnyWrapper.style.transform = 'scale(1)';
                    playSection8FaahAudio();
                }
            } else {
                playSection8FaahAudio();
            }
        }, 1400);
    };

        [roseWrapper, roseImg].forEach(el => {
            if (!el) return;
            el.style.cursor = 'pointer';
            el.addEventListener('click', handleRoseTrigger);
            el.addEventListener('touchend', handleRoseTrigger);
            el.addEventListener('pointerdown', handleRoseTrigger);
        });

        const animeLib = window.anime;

        // Continuous, subtle breathing/zoom animation (1.000 -> 1.012 -> 1.000)
        if (!section8RoseAnimeInstance && animeLib) {
            if (typeof animeLib === 'function') {
                section8RoseAnimeInstance = animeLib({
                    targets: roseImg,
                    scale: [1.000, 1.012],
                    duration: 700,
                    direction: 'alternate',
                    loop: true,
                    easing: 'easeInOutSine'
                });
            } else if (animeLib.animate) {
                section8RoseAnimeInstance = animeLib.animate(roseImg, {
                    scale: [1.000, 1.012],
                    duration: 700,
                    direction: 'alternate',
                    loop: true,
                    ease: 'inOutSine'
                });
            }
        }
    }

    function initSection7CakeAnimation() {
        const cakeImg = document.getElementById('section7CakeImg');
        const cakeWrapper = document.getElementById('section7CakeWrapper');
        const cakeAura = document.getElementById('section7CakeAura');
        if (!cakeImg || !cakeWrapper) return;

        cakeWrapper.style.cursor = 'pointer';

        const animeLib = window.anime;

        // Subtle continuous zoom-in / zoom-out animation (1.000 -> 1.018 -> 1.000)
        if (!section7CakeAnimeInstance && animeLib && !isSection7CakeClicked) {
            if (typeof animeLib === 'function') {
                section7CakeAnimeInstance = animeLib({
                    targets: cakeImg,
                    scale: [1.000, 1.018],
                    duration: 1100,
                    direction: 'alternate',
                    loop: true,
                    easing: 'easeInOutSine'
                });
                if (cakeAura) {
                    animeLib({
                        targets: cakeAura,
                        scale: [1.000, 1.030],
                        opacity: [0.75, 0.95],
                        duration: 1100,
                        direction: 'alternate',
                        loop: true,
                        easing: 'easeInOutSine'
                    });
                }
            } else if (animeLib.animate) {
                section7CakeAnimeInstance = animeLib.animate(cakeImg, {
                    scale: [1.000, 1.018],
                    duration: 1100,
                    direction: 'alternate',
                    loop: true,
                    ease: 'inOutSine'
                });
                if (cakeAura) {
                    animeLib.animate(cakeAura, {
                        scale: [1.000, 1.030],
                        opacity: [0.75, 0.95],
                        duration: 1100,
                        direction: 'alternate',
                        loop: true,
                        ease: 'inOutSine'
                    });
                }
            }
        }

        // Bind click-to-stop handler
        if (!cakeWrapper.dataset.clickBound) {
            cakeWrapper.dataset.clickBound = 'true';

            // Section 7 Note Viewer Zoom State & Controllers
            let section7NoteZoomFactor = 1.0;
            const MIN_SECTION7_NOTE_ZOOM = 0.75;
            const MAX_SECTION7_NOTE_ZOOM = 2.5;
            const SECTION7_NOTE_ZOOM_STEP = 0.15;

            function applySection7NoteZoom(newZoom) {
                section7NoteZoomFactor = Math.min(MAX_SECTION7_NOTE_ZOOM, Math.max(MIN_SECTION7_NOTE_ZOOM, newZoom));
                const stage = document.getElementById('section7NoteImgStage');
                const levelText = document.getElementById('section7NoteZoomLevel');
                const viewer = document.getElementById('section7NoteScrollViewer');

                if (stage) {
                    stage.style.transform = `scale(${section7NoteZoomFactor})`;
                }
                if (levelText) {
                    levelText.textContent = `${Math.round(section7NoteZoomFactor * 100)}%`;
                }
                if (viewer) {
                    if (section7NoteZoomFactor > 1.05) {
                        viewer.style.overflowX = 'auto';
                    } else {
                        viewer.style.overflowX = 'hidden';
                        viewer.scrollLeft = 0;
                    }
                }
            }

            function resetSection7NoteViewerState() {
                applySection7NoteZoom(1.0);
                const viewer = document.getElementById('section7NoteScrollViewer');
                if (viewer) {
                    viewer.scrollTop = 0;
                    viewer.scrollLeft = 0;
                }
            }

            cakeWrapper.addEventListener('click', (e) => {
                e.stopPropagation();
                isSection7CakeClicked = true;

                // Stop/pause continuous zoom animation immediately
                if (section7CakeAnimeInstance) {
                    if (typeof section7CakeAnimeInstance.pause === 'function') {
                        section7CakeAnimeInstance.pause();
                    }
                }

                // Reset zoom and scroll position to top when opening note
                resetSection7NoteViewerState();

                // Trigger full-screen magical note reveal
                const noteOverlay = document.getElementById('section7NoteOverlay');
                const noteWrapper = document.getElementById('section7NoteWrapper');
                if (noteOverlay && noteWrapper) {
                    noteOverlay.classList.add('is-active');
                    noteOverlay.setAttribute('aria-hidden', 'false');

                    if (animeLib && (typeof animeLib === 'function' || animeLib.animate)) {
                        if (typeof animeLib === 'function') {
                            animeLib({
                                targets: noteWrapper,
                                opacity: [0, 1],
                                scale: [0.94, 1.00],
                                duration: 600,
                                easing: 'easeOutCubic'
                            });
                        } else if (animeLib.animate) {
                            animeLib.animate(noteWrapper, {
                                opacity: [0, 1],
                                scale: [0.94, 1.00],
                                duration: 600,
                                ease: 'outCubic'
                            });
                        }
                    } else {
                        noteWrapper.style.opacity = '1';
                        noteWrapper.style.transform = 'scale(1)';
                    }
                }
            });

            // Bind overlay close listeners (close button & backdrop click)
            const closeBtn = document.getElementById('section7NoteCloseBtn');
            const backdrop = document.getElementById('section7NoteBackdrop');
            const zoomInBtn = document.getElementById('section7NoteZoomInBtn');
            const zoomOutBtn = document.getElementById('section7NoteZoomOutBtn');
            const zoomResetBtn = document.getElementById('section7NoteZoomResetBtn');
            const scrollViewer = document.getElementById('section7NoteScrollViewer');

            if (zoomInBtn) {
                zoomInBtn.onclick = (e) => {
                    e.stopPropagation();
                    applySection7NoteZoom(section7NoteZoomFactor + SECTION7_NOTE_ZOOM_STEP);
                };
            }
            if (zoomOutBtn) {
                zoomOutBtn.onclick = (e) => {
                    e.stopPropagation();
                    applySection7NoteZoom(section7NoteZoomFactor - SECTION7_NOTE_ZOOM_STEP);
                };
            }
            if (zoomResetBtn) {
                zoomResetBtn.onclick = (e) => {
                    e.stopPropagation();
                    applySection7NoteZoom(1.0);
                };
            }

            if (scrollViewer) {
                scrollViewer.addEventListener('wheel', (e) => {
                    e.stopPropagation();
                    if (e.ctrlKey) {
                        e.preventDefault();
                        const delta = e.deltaY < 0 ? SECTION7_NOTE_ZOOM_STEP : -SECTION7_NOTE_ZOOM_STEP;
                        applySection7NoteZoom(section7NoteZoomFactor + delta);
                    }
                }, { passive: false });

                scrollViewer.addEventListener('touchmove', (e) => {
                    e.stopPropagation();
                }, { passive: true });
            }
            
            function closeSection7NoteOverlay(e) {
                if (e) e.stopPropagation();
                const noteOverlay = document.getElementById('section7NoteOverlay');
                const noteWrapper = document.getElementById('section7NoteWrapper');
                if (!noteOverlay || !noteOverlay.classList.contains('is-active')) return;

                if (animeLib && (typeof animeLib === 'function' || animeLib.animate)) {
                    const animObj = {
                        opacity: [1, 0],
                        scale: [1.00, 0.94],
                        duration: 350,
                        easing: 'easeInQuad',
                        ease: 'inQuad',
                        onComplete: () => {
                            noteOverlay.classList.remove('is-active');
                            noteOverlay.setAttribute('aria-hidden', 'true');
                            resetSection7NoteViewerState();
                        }
                    };
                    if (typeof animeLib === 'function') {
                        animeLib({ targets: noteWrapper, ...animObj });
                    } else if (animeLib.animate) {
                        animeLib.animate(noteWrapper, animObj);
                    }
                } else {
                    noteOverlay.classList.remove('is-active');
                    noteOverlay.setAttribute('aria-hidden', 'true');
                    resetSection7NoteViewerState();
                }
            }

            if (closeBtn) closeBtn.onclick = closeSection7NoteOverlay;
            if (backdrop) backdrop.onclick = closeSection7NoteOverlay;
        }
    }

    function initSection7Balloons() {
        const container = document.getElementById('section7BalloonsContainer');
        if (!container || section7BalloonsInitialized) return;
        section7BalloonsInitialized = true;
        container.innerHTML = '';

        const balloonAssets = [
            'assets/balloon_01_pink_heart.png',
            'assets/balloon_02_gold_round.png',
            'assets/balloon_03_lavender_round.png',
            'assets/balloon_05_pastel_blue_heart.png',
            'assets/balloon_06_peach_round.png',
            'assets/balloon_07_cream_round.png',
            'assets/balloon_08_purple_teardrop.png',
            'assets/balloon_09_blush_round.png',
            'assets/balloon_10_gold_star.png'
        ];

        // Define 10 safe perimeter slot positions (organically staggered, generous central safe zone)
        const baseSlots = [
            // Upper-Left Outer Corner (Foreground depth accent)
            { top: '3%', left: '3.2%', baseRot: -7, sizeVw: 9.5, minPx: 92, maxPx: 160, isForeground: true },
            // Upper-Left Inner Offset
            { top: '17%', left: '13%', baseRot: 4, sizeVw: 8.2, minPx: 82, maxPx: 140 },
            
            // Upper-Right Outer Corner
            { top: '4.5%', right: '3.8%', baseRot: 8, sizeVw: 9.3, minPx: 90, maxPx: 156 },
            // Upper-Right Inner Offset
            { top: '18%', right: '12%', baseRot: -6, sizeVw: 8.0, minPx: 80, maxPx: 136 },

            // Middle-Left Outer Edge
            { top: '42%', left: '4%', baseRot: 9, sizeVw: 8.6, minPx: 86, maxPx: 144 },

            // Middle-Right Outer Edge
            { top: '38%', right: '4.8%', baseRot: -9, sizeVw: 8.9, minPx: 88, maxPx: 150 },

            // Lower-Left Outer Corner
            { bottom: '16%', left: '4.5%', baseRot: -5, sizeVw: 9.0, minPx: 88, maxPx: 150 },
            // Lower-Left Inner Offset
            { bottom: '5%', left: '15%', baseRot: 7, sizeVw: 8.2, minPx: 82, maxPx: 138 },

            // Lower-Right Outer Corner (Foreground depth accent)
            { bottom: '13.5%', right: '4%', baseRot: 6, sizeVw: 9.4, minPx: 92, maxPx: 156, isForeground: true },
            // Lower-Right Inner Offset
            { bottom: '4.5%', right: '14%', baseRot: -4, sizeVw: 8.0, minPx: 80, maxPx: 136 }
        ];

        // Shuffle balloon assets for random visual variety
        const shuffledAssets = [...balloonAssets].sort(() => Math.random() - 0.5);

        const animeLib = window.anime;

        baseSlots.forEach((slot, index) => {
            const asset = shuffledAssets[index % shuffledAssets.length];
            const item = document.createElement('div');
            item.className = 'section7-balloon-item' + (slot.isForeground ? ' is-foreground' : '');
            
            // Apply slight random position jitter for natural non-rigid scattering
            const jitterX = (Math.random() * 2 - 1).toFixed(1);
            const jitterY = (Math.random() * 2 - 1).toFixed(1);
            const rotJitter = (Math.random() * 4 - 2).toFixed(1);
            const finalRot = slot.baseRot + parseFloat(rotJitter);

            if (slot.top !== undefined) item.style.top = `calc(${slot.top} + ${jitterY}%)`;
            if (slot.bottom !== undefined) item.style.bottom = `calc(${slot.bottom} + ${jitterY}%)`;
            if (slot.left !== undefined) item.style.left = `calc(${slot.left} + ${jitterX}%)`;
            if (slot.right !== undefined) item.style.right = `calc(${slot.right} + ${jitterX}%)`;

            // 25-40% larger sizing within safe visual bounds
            const sizeVal = (slot.sizeVw + (Math.random() * 0.8 - 0.4)).toFixed(1);
            item.style.width = `clamp(${slot.minPx}px, ${sizeVal}vw, ${slot.maxPx}px)`;
            item.style.transform = `rotate(${finalRot}deg)`;

            const img = document.createElement('img');
            img.src = asset;
            img.className = 'section7-balloon-img';
            img.alt = 'Decorative Balloon';

            item.appendChild(img);
            container.appendChild(item);

            // Subtle gentle floating animation (continuous loop, unique timing & delay)
            const floatDuration = 2800 + Math.floor(Math.random() * 1400); // 2800ms - 4200ms
            const floatDelay = Math.floor(Math.random() * 1200);
            const floatY = 6 + Math.floor(Math.random() * 4); // 6px - 9px
            const floatX = 3 + Math.floor(Math.random() * 3); // 3px - 5px

            if (animeLib) {
                if (typeof animeLib === 'function') {
                    animeLib({
                        targets: item,
                        translateY: [-floatY, floatY],
                        translateX: [-floatX, floatX],
                        rotate: [finalRot - 3.5, finalRot + 3.5],
                        duration: floatDuration,
                        delay: floatDelay,
                        direction: 'alternate',
                        loop: true,
                        easing: 'easeInOutSine'
                    });
                } else if (animeLib.animate) {
                    animeLib.animate(item, {
                        translateY: [-floatY, floatY],
                        translateX: [-floatX, floatX],
                        rotate: [finalRot - 3.5, finalRot + 3.5],
                        duration: floatDuration,
                        delay: floatDelay,
                        direction: 'alternate',
                        loop: true,
                        ease: 'inOutSine'
                    });
                }
            }
        });
    }

    function initSection7Particles() {
        const container = document.getElementById('section7ParticlesContainer');
        if (!container || section7ParticlesInitialized) return;
        section7ParticlesInitialized = true;
        container.innerHTML = '';

        const animeLib = window.anime;
        const particleCount = 14;

        for (let i = 0; i < particleCount; i++) {
            const p = document.createElement('div');
            p.className = 'section7-firefly';
            
            const top = 10 + Math.random() * 75;
            const left = 8 + Math.random() * 84;
            const size = (3 + Math.random() * 3.5).toFixed(1);

            p.style.top = `${top}%`;
            p.style.left = `${left}%`;
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
            p.style.opacity = (0.2 + Math.random() * 0.4).toFixed(2);

            container.appendChild(p);

            const floatY = 12 + Math.floor(Math.random() * 15);
            const floatX = 8 + Math.floor(Math.random() * 10);
            const duration = 3200 + Math.floor(Math.random() * 2400);
            const delay = Math.floor(Math.random() * 1500);

            if (animeLib) {
                if (typeof animeLib === 'function') {
                    animeLib({
                        targets: p,
                        translateY: [-floatY, floatY],
                        translateX: [-floatX, floatX],
                        opacity: [0.15, 0.75, 0.20],
                        duration: duration,
                        delay: delay,
                        direction: 'alternate',
                        loop: true,
                        easing: 'easeInOutSine'
                    });
                } else if (animeLib.animate) {
                    animeLib.animate(p, {
                        translateY: [-floatY, floatY],
                        translateX: [-floatX, floatX],
                        opacity: [0.15, 0.75, 0.20],
                        duration: duration,
                        delay: delay,
                        direction: 'alternate',
                        loop: true,
                        ease: 'inOutSine'
                    });
                }
            }
        }
    }

    function triggerFrameEntranceAnimation(segmentEl) {
        if (!segmentEl) return;
        const segId = segmentEl.id;
        if (!['gardenSegment-2', 'gardenSegment-3', 'gardenSegment-4', 'gardenSegment-5'].includes(segId)) {
            return;
        }

        const wrapperTop = segmentEl.querySelector('.section2-frame-wrapper-1');
        const wrapperBottom = segmentEl.querySelector('.section2-frame-wrapper-2');
        const wrappers = segmentEl.querySelectorAll('.section2-frame-wrapper');
        if (!wrappers.length) return;

        cleanupFrameEntranceAnimation(segmentEl);

        const initialDelay = 250;
        const staggerDelay = 120; // Natural physical wave propagation down the hanging rope (~120ms)
        const activeDuration = 1600; // 1.6s polished single-pass entrance animation

        const timerId = setTimeout(() => {
            // 1. Top Frame Entrance (starts at t = 250ms)
            if (wrapperTop && !wrapperTop.matches(':hover')) {
                wrapperTop.classList.add('is-entrance-animating');
                const topTimer = setTimeout(() => {
                    wrapperTop.classList.remove('is-entrance-animating');
                }, activeDuration);
                wrapperTop.dataset.frameTimer = topTimer;
            }

            // 2. Bottom Frame Entrance (staggered ~120ms later for organic rope cascade)
            if (wrapperBottom) {
                const bottomStaggerTimer = setTimeout(() => {
                    if (!wrapperBottom.matches(':hover')) {
                        wrapperBottom.classList.add('is-entrance-animating');
                        const bottomTimer = setTimeout(() => {
                            wrapperBottom.classList.remove('is-entrance-animating');
                        }, activeDuration);
                        wrapperBottom.dataset.frameTimer = bottomTimer;
                    }
                }, staggerDelay);
                wrapperBottom.dataset.staggerTimer = bottomStaggerTimer;
            }

            const masterCleanupTimer = setTimeout(() => {
                delete segmentEl.dataset.entranceTimer;
            }, activeDuration + staggerDelay + 100);

            segmentEl.dataset.entranceTimer = masterCleanupTimer;
        }, initialDelay);

        segmentEl.dataset.entranceTimer = timerId;
    }

    function cleanupFrameEntranceAnimation(segmentEl) {
        if (!segmentEl) return;
        if (segmentEl.dataset.entranceTimer) {
            clearTimeout(parseInt(segmentEl.dataset.entranceTimer, 10));
            delete segmentEl.dataset.entranceTimer;
        }
        const wrappers = segmentEl.querySelectorAll('.section2-frame-wrapper');
        wrappers.forEach(w => {
            if (w.dataset.frameTimer) {
                clearTimeout(parseInt(w.dataset.frameTimer, 10));
                delete w.dataset.frameTimer;
            }
            if (w.dataset.staggerTimer) {
                clearTimeout(parseInt(w.dataset.staggerTimer, 10));
                delete w.dataset.staggerTimer;
            }
            w.classList.remove('is-entrance-animating');
        });
    }

    window.triggerFrameEntranceAnimation = triggerFrameEntranceAnimation;
    window.cleanupFrameEntranceAnimation = cleanupFrameEntranceAnimation;

    function initSegmentObserver() {
        const segments = document.querySelectorAll('.garden-segment');
        if (!segments.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const standaloneImg = entry.target.querySelector('.standalone-artwork-img');
                    const frame = entry.target.querySelector('.memory-photo-frame');
                    const note = entry.target.querySelector('.memory-note-card');
                    const animeLib = window.anime;

                    // Trigger automatic entrance animation for hanging photo frames in Sections 2–5
                    triggerFrameEntranceAnimation(entry.target);

                    // SECTION 7 CAKE ANIMATION HOOK
                    if (entry.target.id === 'gardenSegment-7') {
                        initSection7CakeAnimation();
                    }

                    // SECTION 8 ROSE ANIMATION HOOK
                    if (entry.target.id === 'gardenSegment-8') {
                        initSection8RoseAnimation();
                    }

                    if (animeLib && animeLib.animate && !entry.target.dataset.animated) {
                        entry.target.dataset.animated = 'true';
                        if (frame) {
                            animeLib.animate(frame, {
                                rotate: [-4, 0],
                                scale: [0.94, 1],
                                opacity: [0, 1],
                                duration: 1000,
                                ease: 'easeOutCubic'
                            });
                        }
                        if (note) {
                            animeLib.animate(note, {
                                translateY: [30, 0],
                                opacity: [0, 1],
                                duration: 900,
                                delay: 150,
                                ease: 'easeOutCubic'
                            });
                        }
                    }
                } else {
                    // Clean up entrance state when section is no longer active
                    cleanupFrameEntranceAnimation(entry.target);
                }
            });
        }, {
            threshold: 0.25
        });

        segments.forEach(seg => observer.observe(seg));
    }

    function initMemorySegmentsSystem() {
        document.documentElement.classList.add('garden-mode');
        document.body.classList.add('garden-mode');
        renderMemorySegments();
        initSectionScrollController();
        scrollToSection(0, true);
        requestAnimationFrame(() => {
            scrollToSection(0, true);
        });
    }
    window.initMemorySegmentsSystem = initMemorySegmentsSystem;
    window.renderMemorySegments = renderMemorySegments;
    window.initSection8RoseAnimation = initSection8RoseAnimation;

    // --------------------------------------------------------------------------
    // Particle Classes (Candle Smoke, Doorway Stardust, Escaping Embers)
    // --------------------------------------------------------------------------

    // Soft Mist Particle for Burnt Candle Wick Smoke
    class SoftMistParticle {
        constructor(cx, cy) {
            this.x = cx + (Math.random() - 0.5) * 6;
            this.y = cy;
            this.size = Math.random() * 4 + 3;
            this.maxSize = this.size + Math.random() * 14 + 10;
            this.vx = (Math.random() - 0.5) * 0.45;
            this.vy = -(Math.random() * 1.2 + 0.6);
            this.alpha = Math.random() * 0.35 + 0.3;
            this.decay = Math.random() * 0.007 + 0.005;
            this.driftOffset = Math.random() * 100;
            const greys = ['220, 220, 230', '235, 235, 245', '245, 240, 230'];
            this.rgb = greys[Math.floor(Math.random() * greys.length)];
        }

        update() {
            this.x += this.vx + Math.sin(this.y * 0.08 + this.driftOffset) * 0.3;
            this.y += this.vy;
            if (this.size < this.maxSize) this.size += 0.12;
            this.alpha -= this.decay;
        }

        draw(c) {
            if (this.alpha <= 0) return;
            c.save();
            c.globalAlpha = Math.max(0, this.alpha);
            const grad = c.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            grad.addColorStop(0, `rgba(${this.rgb}, 0.75)`);
            grad.addColorStop(0.4, `rgba(${this.rgb}, 0.35)`);
            grad.addColorStop(0.85, `rgba(${this.rgb}, 0.08)`);
            grad.addColorStop(1, `rgba(${this.rgb}, 0)`);
            c.fillStyle = grad;
            c.beginPath();
            c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
    }

    function spawnSoftMistPuff(count = 25) {
        if (!sparkleCanvas) return;
        const cx = sparkleCanvas.width * 0.5;
        const cy = sparkleCanvas.height * 0.20;
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                smokeParticles.push(new SoftMistParticle(cx, cy));
            }, i * 22);
        }
    }

    // Doorway Stardust Embers (Confined inside the doorway opening, dancing on the currents)
    class DoorwayStardustParticle {
        constructor(cx, cy, rx, ry) {
            this.cx = cx;
            this.cy = cy;
            this.rx = rx;
            this.ry = ry;
            this.dist = 0.15 + Math.random() * 0.85;
            this.speed = (0.7 + (1 - this.dist) * 1.5) * CONFIG.whirlpoolSpeed;
            this.direction = Math.random() > 0.2 ? 1 : -1;
            this.angle = Math.random() * Math.PI * 2;
            this.size = Math.random() * 1.6 + 0.8;
            this.alpha = 0.1;
            this.maxAlpha = Math.random() * 0.7 + 0.3;
            this.fadeIn = true;
            this.decay = Math.random() * 0.006 + 0.003;
            this.trail = [];
            const colors = ['#ffffff', '#fffbeb', '#fef08a', '#fde047', '#fbbf24'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
        }

        update() {
            this.angle += this.direction * (0.018 * this.speed);
            this.dist = Math.max(0.12, this.dist - 0.0018);

            const px = this.cx + Math.cos(this.angle) * (this.rx * this.dist);
            const py = this.cy + Math.sin(this.angle) * (this.ry * this.dist);

            this.trail.unshift({ x: px, y: py });
            if (this.trail.length > 5) this.trail.pop();

            if (this.fadeIn) {
                this.alpha += 0.04;
                if (this.alpha >= this.maxAlpha) this.fadeIn = false;
            } else {
                this.alpha -= this.decay;
            }
        }

        draw(c) {
            if (this.alpha <= 0 || this.trail.length === 0) return;
            c.save();
            const currAlpha = Math.max(0, this.alpha * energyState.intensity);
            c.globalAlpha = currAlpha;

            // Draw motion trail
            if (this.trail.length > 1) {
                c.strokeStyle = this.color;
                c.lineWidth = this.size * 0.85;
                c.lineCap = 'round';
                c.shadowColor = '#fbbf24';
                c.shadowBlur = 6;
                c.beginPath();
                c.moveTo(this.trail[0].x, this.trail[0].y);
                for (let i = 1; i < this.trail.length; i++) {
                    c.lineTo(this.trail[i].x, this.trail[i].y);
                }
                c.stroke();
            }

            // Head spark
            c.fillStyle = this.color;
            c.shadowColor = '#f59e0b';
            c.shadowBlur = 8;
            c.beginPath();
            c.arc(this.trail[0].x, this.trail[0].y, this.size, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
    }

    // Escaping Golden Embers (Breaks forward into courtyard toward viewer in 3D perspective)
    class EscapingGoldenEmber {
        constructor(cx, cy) {
            this.x = cx + (Math.random() - 0.5) * (magicEnergyCanvas ? magicEnergyCanvas.width * 0.07 : 50);
            this.y = cy + (Math.random() - 0.5) * (magicEnergyCanvas ? magicEnergyCanvas.height * 0.18 : 100);

            const angle = Math.atan2(this.y - cy, this.x - cx) + (Math.random() - 0.5) * 0.8;
            const speed = Math.random() * 1.6 + 0.8;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed + (Math.random() - 0.5) * 0.3;

            this.baseSize = Math.random() * 1.8 + 1.0;
            this.scale = 0.5;
            this.growth = Math.random() * 0.035 + 0.02;

            this.alpha = 0.1;
            this.maxAlpha = Math.random() * 0.65 + 0.35;
            this.fadeIn = true;
            this.decay = Math.random() * 0.008 + 0.004;

            const colors = ['#ffffff', '#fffdf0', '#fef08a', '#fde047', '#fbbf24'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.driftPhase = Math.random() * Math.PI * 2;
            this.driftSpeed = Math.random() * 0.05 + 0.02;
        }

        update() {
            this.scale += this.growth;
            this.x += this.vx * (1 + this.scale * 0.8);
            this.y += this.vy * (1 + this.scale * 0.8) + Math.sin(this.driftPhase) * 0.35;
            this.driftPhase += this.driftSpeed;

            if (this.fadeIn) {
                this.alpha += 0.05;
                if (this.alpha >= this.maxAlpha) this.fadeIn = false;
            } else {
                this.alpha -= this.decay;
            }
        }

        draw(c) {
            if (this.alpha <= 0) return;
            c.save();
            c.globalAlpha = Math.max(0, this.alpha);
            const r = this.baseSize * this.scale;
            c.fillStyle = this.color;
            c.shadowColor = '#fbbf24';
            c.shadowBlur = Math.min(20, 6 * this.scale);
            c.beginPath();
            c.arc(this.x, this.y, r, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
    }

    // Escaping Golden Wisp (Graceful luminous ribbon drifting outward)
    class EscapingGoldenWisp {
        constructor(cx, cy, rx, ry) {
            const startAngle = Math.random() * Math.PI * 2;
            this.x = cx + Math.cos(startAngle) * rx;
            this.y = cy + Math.sin(startAngle) * ry;
            this.points = [{ x: this.x, y: this.y }];
            this.maxPoints = Math.floor(Math.random() * 10 + 8);

            const speed = Math.random() * 1.8 + 1.0;
            this.vx = Math.cos(startAngle) * speed;
            this.vy = Math.sin(startAngle) * speed;
            this.curve = (Math.random() - 0.5) * 0.08;

            this.width = Math.random() * 2.0 + 1.2;
            this.scale = 0.6;
            this.alpha = 0.75;
            this.decay = Math.random() * 0.010 + 0.006;
            this.color = Math.random() > 0.4 ? '#fef08a' : '#ffffff';
        }

        update() {
            this.scale += 0.024;
            const vxNew = this.vx * Math.cos(this.curve) - this.vy * Math.sin(this.curve);
            const vyNew = this.vx * Math.sin(this.curve) + this.vy * Math.cos(this.curve);
            this.vx = vxNew;
            this.vy = vyNew;

            this.x += this.vx * (1 + this.scale * 0.7);
            this.y += this.vy * (1 + this.scale * 0.7);

            this.points.unshift({ x: this.x, y: this.y });
            if (this.points.length > this.maxPoints) {
                this.points.pop();
            }
            this.alpha -= this.decay;
        }

        draw(c) {
            if (this.alpha <= 0 || this.points.length < 2) return;
            c.save();
            c.globalAlpha = Math.max(0, this.alpha);
            c.strokeStyle = this.color;
            c.lineWidth = this.width * this.scale;
            c.lineCap = 'round';
            c.shadowColor = '#f59e0b';
            c.shadowBlur = 10;

            c.beginPath();
            c.moveTo(this.points[0].x, this.points[0].y);
            for (let i = 1; i < this.points.length; i++) {
                c.lineTo(this.points[i].x, this.points[i].y);
            }
            c.stroke();
            c.restore();
        }
    }

    // Stream generation loops
    let stardustActive = false;
    let escapingActive = false;

    function startDoorwayStardust() {
        stardustActive = true;
        const cx = magicEnergyCanvas.width * 0.50;
        const cy = magicEnergyCanvas.height * 0.49;
        const rx = magicEnergyCanvas.width * 0.052;
        const ry = magicEnergyCanvas.height * 0.22;

        const interval = setInterval(() => {
            if (!stardustActive) {
                clearInterval(interval);
                return;
            }
            if (stardustParticles.length < CONFIG.particleAmount) {
                stardustParticles.push(new DoorwayStardustParticle(cx, cy, rx, ry));
            }
        }, 65);
    }

    function startEscapingEnergyStream() {
        escapingActive = true;
        const cx = magicEnergyCanvas.width * 0.50;
        const cy = magicEnergyCanvas.height * 0.49;
        const rx = magicEnergyCanvas.width * 0.052;
        const ry = magicEnergyCanvas.height * 0.22;

        const interval = setInterval(() => {
            if (!escapingActive) {
                clearInterval(interval);
                return;
            }
            for (let i = 0; i < 3; i++) {
                escapingEmbers.push(new EscapingGoldenEmber(cx, cy));
            }
            if (Math.random() < 0.35) {
                escapingWisps.push(new EscapingGoldenWisp(cx, cy, rx, ry));
            }
        }, 65);

        setTimeout(() => {
            escapingActive = false;
        }, CONFIG.energyExpansionDuration);
    }

    // --------------------------------------------------------------------------
    // Render Organic Doorway Magical Energy (Volumetric Light Fields + Shimmer)
    // --------------------------------------------------------------------------
    let animTime = 0;
    function drawDoorwayEnergy(c) {
        if (energyState.intensity <= 0.01) return;

        const cx = magicEnergyCanvas.width * 0.50;
        const cy = magicEnergyCanvas.height * 0.49;
        // Confined inside the doorway opening between the open doors
        const rx = magicEnergyCanvas.width * 0.052;
        const ry = magicEnergyCanvas.height * 0.22;

        c.save();
        c.globalCompositeOperation = 'screen';

        const time = animTime * CONFIG.whirlpoolSpeed;
        const intensity = energyState.intensity;
        const escapeFactor = energyState.escapeFactor;

        // 1. Soft atmospheric volumetric golden light nebula inside doorway
        const glow = c.createRadialGradient(cx, cy + ry * 0.25, 0, cx, cy + ry * 0.25, ry * 0.85);
        glow.addColorStop(0, 'rgba(255, 245, 205, ' + (0.45 * intensity * energyState.corePulse) + ')');
        glow.addColorStop(0.35, 'rgba(254, 240, 138, ' + (0.25 * intensity) + ')');
        glow.addColorStop(0.70, 'rgba(245, 158, 11, ' + (0.08 * intensity) + ')');
        glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
        c.fillStyle = glow;
        c.beginPath();
        c.ellipse(cx, cy + ry * 0.2, rx * 1.5 * (1 + escapeFactor * 0.3), ry * 0.85, 0, 0, Math.PI * 2);
        c.fill();

        // 2. Soft shifting liquid golden light waves (undulating volume)
        for (let l = 0; l < 4; l++) {
            const a = time * (0.4 + l * 0.15) * (l % 2 === 0 ? 1 : -1) + l * 1.5;
            const rxCurr = rx * (1 + escapeFactor * 0.45);
            const ryCurr = ry * (1 + escapeFactor * 0.35);
            const lx = cx + Math.cos(a) * (rxCurr * 0.35);
            const ly = cy + Math.sin(a) * (ryCurr * 0.35);
            const lr = rx * (1.1 + Math.sin(time + l) * 0.2) * (1 + escapeFactor * 0.3);
            const lg = c.createRadialGradient(lx, ly, 0, lx, ly, lr);
            lg.addColorStop(0, 'rgba(255, 250, 220, ' + (0.35 * intensity) + ')');
            lg.addColorStop(0.4, 'rgba(254, 240, 138, ' + (0.18 * intensity) + ')');
            lg.addColorStop(1, 'rgba(245, 158, 11, 0)');
            c.fillStyle = lg;
            c.beginPath();
            c.ellipse(lx, ly, lr, lr * 1.2, 0, 0, Math.PI * 2);
            c.fill();
        }

        // 3. Warm golden light on the stone pathway threshold
        const pathLight = c.createRadialGradient(cx, cy + ry * 0.72, 0, cx, cy + ry * 0.72, rx * 1.8 * (1 + escapeFactor * 0.4));
        pathLight.addColorStop(0, 'rgba(255, 250, 220, ' + (0.55 * intensity * energyState.corePulse) + ')');
        pathLight.addColorStop(0.35, 'rgba(254, 240, 138, ' + (0.28 * intensity) + ')');
        pathLight.addColorStop(1, 'rgba(245, 158, 11, 0)');
        c.fillStyle = pathLight;
        c.beginPath();
        c.ellipse(cx, cy + ry * 0.75, rx * 1.8 * (1 + escapeFactor * 0.4), ry * 0.35 * (1 + escapeFactor * 0.3), 0, 0, Math.PI * 2);
        c.fill();

        c.restore();
    }

    // --------------------------------------------------------------------------
    // Radial Light Rays & Floating Golden Dust Particle Systems (Phase 2 & Phase 3)
    // --------------------------------------------------------------------------
    let magicalDustParticles = [];

    class FloatingMagicalDust {
        constructor(w, h) {
            this.reset(w, h);
        }
        reset(w, h) {
            this.x = (w || 800) * 0.5 + (Math.random() - 0.5) * (w || 800) * 0.5;
            this.y = (h || 600) * 0.49 + (Math.random() - 0.5) * (h || 600) * 0.4;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2.8 + 0.8;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed - 0.4;
            this.size = Math.random() * 2.5 + 1.0;
            this.alpha = 0;
            this.maxAlpha = Math.random() * 0.8 + 0.2;
            this.fadeIn = true;
            this.decay = Math.random() * 0.008 + 0.004;
            const colors = ['#ffffff', '#fffbe8', '#fef08a', '#fde047', '#fbbf24'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
        }
        update(w, h) {
            this.x += this.vx;
            this.y += this.vy;
            if (this.fadeIn) {
                this.alpha += 0.08;
                if (this.alpha >= this.maxAlpha) this.fadeIn = false;
            } else {
                this.alpha -= this.decay;
            }
        }
        draw(c) {
            if (this.alpha <= 0) return;
            c.save();
            c.globalAlpha = Math.max(0, this.alpha * transitionState.particleAlpha);
            c.fillStyle = this.color;
            c.shadowColor = '#fbbf24';
            c.shadowBlur = 10;
            c.beginPath();
            c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
    }

    function spawnMagicalDustParticles(count = 45) {
        if (!magicEnergyCanvas) return;
        const w = magicEnergyCanvas.width;
        const h = magicEnergyCanvas.height;
        for (let i = 0; i < count; i++) {
            magicalDustParticles.push(new FloatingMagicalDust(w, h));
        }
    }

    function drawRadialLightRays(c) {
        if (transitionState.rayOpacity <= 0.01 || !magicEnergyCanvas) return;
        const cx = magicEnergyCanvas.width * 0.50;
        const cy = magicEnergyCanvas.height * 0.49;
        const maxRadius = Math.max(magicEnergyCanvas.width, magicEnergyCanvas.height) * 1.3;
        const opacity = transitionState.rayOpacity;
        const rayCount = 14;

        c.save();
        c.globalCompositeOperation = 'screen';

        for (let i = 0; i < rayCount; i++) {
            const baseAngle = (i / rayCount) * Math.PI * 2 + animTime * 0.2;
            const widthAngle = 0.045 + Math.sin(animTime * 2.5 + i) * 0.015;

            const grad = c.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
            grad.addColorStop(0, 'rgba(255, 253, 240, ' + (0.65 * opacity) + ')');
            grad.addColorStop(0.3, 'rgba(254, 240, 138, ' + (0.4 * opacity) + ')');
            grad.addColorStop(0.7, 'rgba(251, 191, 36, ' + (0.15 * opacity) + ')');
            grad.addColorStop(1, 'rgba(245, 158, 11, 0)');

            c.fillStyle = grad;
            c.beginPath();
            c.moveTo(cx, cy);
            c.arc(cx, cy, maxRadius, baseAngle - widthAngle, baseAngle + widthAngle);
            c.closePath();
            c.fill();
        }

        c.restore();
    }

    // --------------------------------------------------------------------------
    // Main Animation Rendering Loop
    // --------------------------------------------------------------------------
    function animate() {
        animTime += 0.016;

        // 1. Render candle smoke particles
        if (ctx && sparkleCanvas) {
            ctx.clearRect(0, 0, sparkleCanvas.width, sparkleCanvas.height);
            for (let i = smokeParticles.length - 1; i >= 0; i--) {
                const p = smokeParticles[i];
                p.update();
                p.draw(ctx);
                if (p.alpha <= 0) {
                    smokeParticles.splice(i, 1);
                }
            }
        }

        // 2. Render organic golden doorway energy & radial rays on magicEnergyCanvas
        if (magicCtx && magicEnergyCanvas) {
            magicCtx.clearRect(0, 0, magicEnergyCanvas.width, magicEnergyCanvas.height);

            // A. Draw radial light rays emanating from gate
            drawRadialLightRays(magicCtx);

            // B. Draw the organic golden doorway energy
            drawDoorwayEnergy(magicCtx);

            // C. Draw subtle doorway stardust embers
            for (let i = stardustParticles.length - 1; i >= 0; i--) {
                const p = stardustParticles[i];
                p.update();
                p.draw(magicCtx);
                if (p.alpha <= 0) {
                    stardustParticles.splice(i, 1);
                }
            }

            // D. Draw escaping golden embers & wisps
            for (let i = escapingEmbers.length - 1; i >= 0; i--) {
                const p = escapingEmbers[i];
                p.update();
                p.draw(magicCtx);
                if (p.alpha <= 0) {
                    escapingEmbers.splice(i, 1);
                }
            }

            for (let i = escapingWisps.length - 1; i >= 0; i--) {
                const p = escapingWisps[i];
                p.update();
                p.draw(magicCtx);
                if (p.alpha <= 0) {
                    escapingWisps.splice(i, 1);
                }
            }

            // E. Draw magical dust particles (Flash & Reveal phases)
            for (let i = magicalDustParticles.length - 1; i >= 0; i--) {
                const p = magicalDustParticles[i];
                p.update(magicEnergyCanvas.width, magicEnergyCanvas.height);
                p.draw(magicCtx);
                if (p.alpha <= 0) {
                    magicalDustParticles.splice(i, 1);
                }
            }
        }

        requestAnimationFrame(animate);
    }

    animate();
});