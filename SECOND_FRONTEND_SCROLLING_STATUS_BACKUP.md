# Second Frontend — Temporary Scrolling Status Snapshot

> **SAFETY REFERENCE ONLY — DO NOT IMPORT, EXECUTE, OR MODIFY.**
> This document records the exact, approved section-by-section scroll engine implementation of the Second Frontend (Magical Memory Garden) as of September 15, 2026.

---

## 1. Overview & Architectural Rules

- **Frontend 2 Section Count**: `14` independent full-screen sections (`#gardenSegment-1` through `#gardenSegment-14`).
- **Navigation Paradigm**: One physical gesture (mouse wheel, trackpad swipe, touch swipe, keypress) = **EXACTLY ONE SECTION ADVANCE** (`currentSectionIndex ± 1`).
- **Continuous Scrolling Prevention**: Native continuous browser scrolling is intercepted via `e.preventDefault()` inside a non-passive wheel listener (`{ passive: false }`).
- **Section Settling**: Every section navigation smoothly settles exactly at `targetSegment.offsetTop` using Anime.js (`duration: 450ms`, `ease: 'outCubic'`). Zero partial resting positions.
- **Gesture Inertia Protection**: Trailing momentum/inertia wheel events from trackpad gestures are consumed and ignored during an active gesture lock period (`isScrollLocked = true`, `850ms` delay window).

---

## 2. Key Parameter & Configuration Matrix

| Parameter / Variable | Exact Current Value | Description / Function |
| :--- | :--- | :--- |
| `TOTAL_SECTIONS` | `14` | Total number of full-screen sections in Second Frontend |
| `currentSectionIndex` | `0` to `13` | Active zero-indexed section tracker |
| Animation Duration | `450ms` | Transition movement duration between current and next section |
| Animation Easing | `outCubic` / `easeOutCubic` | Anime.js easing curve applied to scroll position |
| Wheel Cooldown / Lock | `850ms` (`unlockScrollAfterDelay(850)`) | Time window during which trailing wheel events are swallowed |
| Wheel Min Delta Threshold | `10` (`Math.abs(delta) < 10`) | Ignore micro noise wheel deltas below 10px |
| Wheel Trailing Window | `800ms` (`now - lastWheelTime < 800`) | Minimum spacing between separate physical wheel gestures |
| Touch Swipe Threshold | `35px` (`Math.abs(diffY) > 35`) | Minimum vertical distance required to trigger a swipe navigation |
| Touch Cooldown / Lock | `650ms` (`unlockScrollAfterDelay(650)`) | Lock duration after touch swipe navigation |
| Keyboard Cooldown / Lock| `500ms` (`unlockScrollAfterDelay(500)`) | Lock duration after keyboard navigation (`ArrowDown`, `ArrowUp`, etc.) |
| Section CSS Height | `100vh` (`min-height: 100vh; max-height: 100vh;`) | Each section occupies exactly one full viewport |

---

## 3. Continuous Rope Configuration (`ROPE_POSITIONS`)

```javascript
const ROPE_POSITIONS = {
    2: 38,
    3: 38,
    4: 38,
    5: 38,
    6: 38,
    7: 38,
    8: 38,
    9: 38,
    10: 38,
    11: 38,
    12: 38,
    13: 38,
    14: 38
};

window.ROPE_POSITIONS = ROPE_POSITIONS;

window.setSectionRopePosition = function(sectionNum, leftPercent) {
    if (sectionNum >= 2 && sectionNum <= 14) {
        ROPE_POSITIONS[sectionNum] = leftPercent;
        const segEl = document.getElementById(`gardenSegment-${sectionNum}`);
        if (segEl) {
            segEl.style.setProperty('--rope-x', `${leftPercent}%`);
        }
    }
};
```

---

## 4. Data-Driven Memory Segments (14 Independent Sections)

```javascript
const MEMORY_SEGMENTS = [
    { id: 1, chapter: "", title: "", photo: "assets/after_png_main_photo.png", note: "", date: "", caption: "", ropeSide: "left" },
    { id: 2, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "right" },
    { id: 3, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "left" },
    { id: 4, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "right" },
    { id: 5, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "left" },
    { id: 6, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "right" },
    { id: 7, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "left" },
    { id: 8, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "right" },
    { id: 9, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "left" },
    { id: 10, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "right" },
    { id: 11, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "left" },
    { id: 12, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "right" },
    { id: 13, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "left" },
    { id: 14, chapter: "", title: "", photo: "", note: "", date: "", caption: "", ropeSide: "right" }
];
```

---

## 5. Authoritative Scroll Engine Source Code (`script.js`)

### 5.1 Background Progression Tracker
```javascript
window.updateBackgroundPosition = function(sectionIndex) {
    const bgImg = document.getElementById('gardenBgImg');
    if (!bgImg) return;

    const imgHeight = bgImg.getBoundingClientRect().height || bgImg.offsetHeight;
    const vh = window.innerHeight;
    const maxScroll = Math.max(0, imgHeight - vh);

    const TOTAL_SECTIONS = 14;
    const progress = Math.max(0, Math.min(1, sectionIndex / (TOTAL_SECTIONS - 1)));
    const translateY = -progress * maxScroll;

    bgImg.style.transform = `translateY(${translateY.toFixed(2)}px) scale(1.02)`;
};
const updateBackgroundPosition = window.updateBackgroundPosition;
```

### 5.2 Section Navigation Animator (`scrollToSection`)
```javascript
window.scrollToSection = function(index, instant = false) {
    const segments = document.querySelectorAll('.garden-segment');
    if (!segments.length || index < 0 || index >= segments.length) return;

    currentSectionIndex = index;
    const targetSegment = segments[index];
    const targetTop = targetSegment.offsetTop;

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

    if (instant || Math.abs(startY - targetTop) < 2) {
        window.scrollTo(0, targetTop);
        document.documentElement.scrollTop = targetTop;
        document.body.scrollTop = targetTop;
    } else {
        const animeLib = window.anime;
        const scrollObj = { y: startY };

        if (animeLib) {
            if (typeof animeLib === 'function') {
                activeScrollAnimation = animeLib({
                    targets: scrollObj,
                    y: targetTop,
                    duration: 450,
                    easing: 'easeOutCubic',
                    update: () => {
                        window.scrollTo(0, scrollObj.y);
                        document.documentElement.scrollTop = scrollObj.y;
                        document.body.scrollTop = scrollObj.y;
                    }
                });
            } else if (animeLib.animate) {
                activeScrollAnimation = animeLib.animate(scrollObj, {
                    y: targetTop,
                    duration: 450,
                    ease: 'outCubic',
                    onUpdate: () => {
                        window.scrollTo(0, scrollObj.y);
                        document.documentElement.scrollTop = scrollObj.y;
                        document.body.scrollTop = scrollObj.y;
                    }
                });
            }
        } else {
            window.scrollTo(0, targetTop);
            document.documentElement.scrollTop = targetTop;
            document.body.scrollTop = targetTop;
        }
    }

    if (typeof syncCardVideoPlayback === 'function') {
        syncCardVideoPlayback();
    }
};
const scrollToSection = window.scrollToSection;
```

### 5.3 Cooldown & Active State Guards
```javascript
function unlockScrollAfterDelay(delay = 850) {
    clearTimeout(wheelCooldownTimer);
    wheelCooldownTimer = setTimeout(() => {
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
```

### 5.4 Gesture Interceptor (`initSectionScrollController`)
```javascript
function initSectionScrollController() {
    if (window.__sectionScrollControllerInitialized) return;
    window.__sectionScrollControllerInitialized = true;

    const TOTAL_SECTIONS = 14;

    // Handle Mouse Wheel & Trackpad Events
    window.addEventListener('wheel', (e) => {
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
        if (!isSecondFrontendActive() || !e.touches || !e.touches.length) return;
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!isSecondFrontendActive()) return;
        e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
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
```

---

## 6. Section CSS Layout Rules (`styles.css`)

```css
.garden-segment {
    position: relative;
    width: 100%;
    height: 100vh;
    min-height: 100vh;
    max-height: 100vh;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 4vw;
    overflow: hidden;
}

.memory-garden-section:not(.active) {
    display: none;
    pointer-events: none;
}
```

---

## 7. Restoration Procedure

If the Second Frontend scroll behavior ever degrades or becomes continuous/uncontrolled:
1. Re-verify that `window.addEventListener('wheel', ..., { passive: false })` has `{ passive: false }`.
2. Confirm `scrollToSection()` uses `duration: 450` with `ease: 'outCubic'` or `easing: 'easeOutCubic'`.
3. Ensure `unlockScrollAfterDelay(850)` is invoked upon section index increment/decrement.
4. Verify `MEMORY_SEGMENTS` renders exactly 14 `.garden-segment` divs with `height: 100vh`.
