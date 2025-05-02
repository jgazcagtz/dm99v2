// AudioContext Setup
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// Define which instruments should be mono
const monoInstruments = ['kick', 'bass1'];

// Sound URLs with higher quality samples where available
const sounds = {
    kick: 'https://cdn.freesound.org/previews/348/348054_6244580-lq.mp3',
    snare: 'https://cdn.freesound.org/previews/25/25666_48671-lq.mp3',
    hihatClosed: 'https://cdn.freesound.org/previews/638/638654_433684-lq.mp3',
    hihatOpened: 'https://cdn.freesound.org/previews/627/627344_13191763-lq.mp3',
    clap: 'https://cdn.freesound.org/previews/244/244568_165785-lq.mp3',
    bass1: 'https://cdn.freesound.org/previews/711/711469_15225418-lq.mp3',
    tom: 'https://cdn.freesound.org/previews/443/443181_6979693-lq.mp3',
    perc1: 'https://cdn.freesound.org/previews/724/724509_11990934-lq.mp3',
    perc2: 'https://cdn.freesound.org/previews/503/503788_9637845-lq.mp3',
    perc3: 'https://cdn.freesound.org/previews/503/503779_9637845-lq.mp3',
    perc4: 'https://cdn.freesound.org/previews/352/352280_1866366-lq.mp3',
    perc5: 'https://cdn.freesound.org/previews/638/638557_12672694-lq.mp3',
    perc6: 'https://cdn.freesound.org/previews/707/707194_6295857-lq.mp3',
    acid: 'https://cdn.freesound.org/previews/21/21998_45941-lq.mp3',
    synth: 'https://cdn.freesound.org/previews/315/315610_2050105-lq.mp3'
};

const buffers = {};
const loadingPromises = [];

// Improved sound loading with progress tracking
async function loadSounds() {
    const keys = Object.keys(sounds);
    
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const url = sounds[key];
        
        loadingPromises.push(
            fetch(url)
                .then(response => response.arrayBuffer())
                .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
                .then(audioBuffer => {
                    // Convert to mono if necessary
                    if (monoInstruments.includes(key)) {
                        const numChannels = audioBuffer.numberOfChannels;
                        const length = audioBuffer.length;
                        const sampleRate = audioBuffer.sampleRate;
                        const monoBuffer = audioCtx.createBuffer(1, length, sampleRate);
                        const monoData = monoBuffer.getChannelData(0);
                        
                        // Average all channels
                        for (let sample = 0; sample < length; sample++) {
                            let sum = 0;
                            for (let channel = 0; channel < numChannels; channel++) {
                                sum += audioBuffer.getChannelData(channel)[sample];
                            }
                            monoData[sample] = sum / numChannels;
                        }
                        buffers[key] = monoBuffer;
                    } else {
                        buffers[key] = audioBuffer;
                    }
                })
                .catch(error => {
                    console.error(`Error loading sound for ${key}:`, error);
                    // Fallback to silent buffer
                    const silentBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
                    buffers[key] = silentBuffer;
                })
        );
    }
    
    await Promise.all(loadingPromises);
}

// Variables
let currentInstrument = 'kick';
let isPlaying = false;
let currentNote = 0;
let tempo = 120;
let swing = 0;
let noteProbability = 100;
let timerID;
let swingOffset = 0;
let nextNoteTime = 0.0;
let currentScale = 'minor';

// Sequences with improved structure
const sequences = {
    kick: Array(32).fill(false),
    snare: Array(32).fill(false),
    hihatClosed: Array(32).fill(false),
    hihatOpened: Array(32).fill(false),
    clap: Array(32).fill(false),
    bass1: Array(32).fill().map(() => ({ active: false, pitch: 0, scale: 'minor' })),
    tom: Array(32).fill(false),
    perc1: Array(32).fill(false),
    perc2: Array(32).fill(false),
    perc3: Array(32).fill(false),
    perc4: Array(32).fill(false),
    perc5: Array(32).fill(false),
    perc6: Array(32).fill(false),
    acid: Array(32).fill(false),
    synth: Array(32).fill().map(() => ({ active: false, pitch: 0, scale: 'minor' }))
};

// Mute and Solo States
const mutedInstruments = {};
const soloedInstruments = {};
Object.keys(sequences).forEach(inst => {
    mutedInstruments[inst] = false;
    soloedInstruments[inst] = false;
});

// Instrument Volumes
const instrumentVolumes = {
    kick: 0.8,
    snare: 0.7,
    hihatClosed: 0.6,
    hihatOpened: 0.6,
    clap: 0.7,
    bass1: 0.5,
    tom: 0.7,
    perc1: 0.6,
    perc2: 0.6,
    perc3: 0.6,
    perc4: 0.6,
    perc5: 0.6,
    perc6: 0.6,
    acid: 0.6,
    synth: 0.6
};

// ADSR Parameters with more options
const adsrParameters = {
    kick: { attack: 0.1, decay: 0.3, sustain: 0.7, release: 0.5 },
    hihatClosed: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.3 },
    hihatOpened: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.3 },
    bass1: { attack: 0.1, decay: 0.3, sustain: 0.7, release: 0.5 },
    synth: { attack: 0.1, decay: 0.3, sustain: 0.7, release: 0.5 }
};

// Master Volume Setup
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.8;

// Master Compressor
const masterCompressor = audioCtx.createDynamicsCompressor();
masterCompressor.threshold.setValueAtTime(-24, audioCtx.currentTime);
masterCompressor.knee.setValueAtTime(30, audioCtx.currentTime);
masterCompressor.ratio.setValueAtTime(12, audioCtx.currentTime);
masterCompressor.attack.setValueAtTime(0, audioCtx.currentTime);
masterCompressor.release.setValueAtTime(0.25, audioCtx.currentTime);

// Master Filters
const masterLowpass = audioCtx.createBiquadFilter();
masterLowpass.type = 'lowpass';
masterLowpass.frequency.value = 20000;

const masterHighpass = audioCtx.createBiquadFilter();
masterHighpass.type = 'highpass';
masterHighpass.frequency.value = 20;

// Equalizer Filters
const eqFilters = {
    low: audioCtx.createBiquadFilter(),
    mid: audioCtx.createBiquadFilter(),
    high: audioCtx.createBiquadFilter()
};

// Configure EQ Filters
eqFilters.low.type = 'lowshelf';
eqFilters.low.frequency.value = 320;
eqFilters.mid.type = 'peaking';
eqFilters.mid.frequency.value = 1000;
eqFilters.mid.Q.value = 1;
eqFilters.high.type = 'highshelf';
eqFilters.high.frequency.value = 3200;

// Bass EQ Filters
const bassEqFilters = {
    low: audioCtx.createBiquadFilter(),
    mid: audioCtx.createBiquadFilter(),
    high: audioCtx.createBiquadFilter()
};

// Configure Bass EQ Filters
bassEqFilters.low.type = 'lowshelf';
bassEqFilters.low.frequency.value = 80;
bassEqFilters.mid.type = 'peaking';
bassEqFilters.mid.frequency.value = 500;
bassEqFilters.mid.Q.value = 1;
bassEqFilters.high.type = 'highshelf';
bassEqFilters.high.frequency.value = 2000;

// Connect the audio nodes
masterGain.connect(eqFilters.low);
eqFilters.low.connect(eqFilters.mid);
eqFilters.mid.connect(eqFilters.high);
eqFilters.high.connect(masterHighpass);
masterHighpass.connect(masterLowpass);
masterLowpass.connect(masterCompressor);
masterCompressor.connect(audioCtx.destination);

// Create per-instrument gain nodes
const instrumentGainNodes = {};
Object.keys(instrumentVolumes).forEach(instrument => {
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = instrumentVolumes[instrument];
    
    if (instrument === 'bass1' || instrument === 'synth') {
        gainNode.connect(bassEqFilters.low);
        bassEqFilters.low.connect(bassEqFilters.mid);
        bassEqFilters.mid.connect(bassEqFilters.high);
        bassEqFilters.high.connect(masterGain);
    } else {
        gainNode.connect(masterGain);
    }
    
    instrumentGainNodes[instrument] = gainNode;
});

// Scale definitions
const scales = {
    minor: [0, 2, 3, 5, 7, 8, 10],       // E natural minor: E, F#, G, A, B, C, D
    phrygian: [0, 1, 3, 5, 7, 8, 10],     // E Phrygian: E, F, G, A, B, C, D
    major: [0, 2, 4, 5, 7, 9, 11],        // E Major: E, F#, G#, A, B, C#, D#
    dorian: [0, 2, 3, 5, 7, 9, 10],       // E Dorian: E, F#, G, A, B, C#, D
    pentatonic: [0, 3, 5, 7, 10],         // E Minor Pentatonic: E, G, A, B, D
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] // Chromatic scale
};

// Initialize the application
async function init() {
    await loadSounds();
    
    // DOM Elements
    const instrumentButtons = document.querySelectorAll('.instrument-button');
    const muteButtons = document.querySelectorAll('.mute-button');
    const soloButtons = document.querySelectorAll('.solo-button');
    const volumeSliders = document.querySelectorAll('.volume-slider');
    const drumMachine = document.getElementById('drum-machine');
    const playButton = document.getElementById('play');
    const stopButton = document.getElementById('stop');
    const randomBassButton = document.getElementById('random-bass');
    const randomSynthButton = document.getElementById('random-synth');
    const randomDrumsButton = document.getElementById('random-drums');
    const tempoSlider = document.getElementById('tempo');
    const bpmDisplay = document.getElementById('bpm-display');
    const swingSlider = document.getElementById('swing');
    const swingDisplay = document.getElementById('swing-display');
    const probabilitySlider = document.getElementById('probability');
    const probabilityDisplay = document.getElementById('probability-display');
    const lowpassSlider = document.getElementById('lowpass-filter');
    const lowpassDisplay = document.getElementById('lowpass-display');
    const highpassSlider = document.getElementById('highpass-filter');
    const highpassDisplay = document.getElementById('highpass-display');
    const eqLowSlider = document.getElementById('eq-low');
    const eqMidSlider = document.getElementById('eq-mid');
    const eqHighSlider = document.getElementById('eq-high');
    const eqLowDisplay = document.getElementById('eq-low-display');
    const eqMidDisplay = document.getElementById('eq-mid-display');
    const eqHighDisplay = document.getElementById('eq-high-display');
    const bassEqLowSlider = document.getElementById('bass-eq-low');
    const bassEqMidSlider = document.getElementById('bass-eq-mid');
    const bassEqHighSlider = document.getElementById('bass-eq-high');
    const bassEqLowDisplay = document.getElementById('bass-eq-low-display');
    const bassEqMidDisplay = document.getElementById('bass-eq-mid-display');
    const bassEqHighDisplay = document.getElementById('bass-eq-high-display');
    const showInstructionsButton = document.getElementById('show-instructions');
    const modal = document.getElementById('modal');
    const closeModalButton = document.getElementById('close-modal');
    const adsrToggle = document.getElementById('adsr-toggle');
    const adsrContent = document.getElementById('adsr-content');
    const masterVolumeSlider = document.getElementById('master-volume');
    const scaleSelect = document.getElementById('scale-select');
    const savePatternButton = document.getElementById('save-pattern');
    const loadPatternButton = document.getElementById('load-pattern');
    const clearPatternButton = document.getElementById('clear-pattern');
    const deletePatternButton = document.getElementById('delete-pattern');
    const patternSelect = document.getElementById('pattern-select');
    
    // Initialize displays
    swingDisplay.textContent = `${swing}%`;
    probabilityDisplay.textContent = `${noteProbability}%`;
    lowpassDisplay.textContent = `${lowpassSlider.value} Hz`;
    highpassDisplay.textContent = `${highpassSlider.value} Hz`;
    eqLowDisplay.textContent = `${eqLowSlider.value} dB`;
    eqMidDisplay.textContent = `${eqMidSlider.value} dB`;
    eqHighDisplay.textContent = `${eqHighSlider.value} dB`;
    bassEqLowDisplay.textContent = `${bassEqLowSlider.value} dB`;
    bassEqMidDisplay.textContent = `${bassEqMidSlider.value} dB`;
    bassEqHighDisplay.textContent = `${bassEqHighSlider.value} dB`;
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Set initial filter frequencies
    masterLowpass.frequency.value = parseInt(lowpassSlider.value);
    masterHighpass.frequency.value = parseInt(highpassSlider.value);
    
    // Generate initial pads
    generatePads();
    instrumentButtons[0].classList.add('active');
    updatePads();
    
    // Event Listeners
    instrumentButtons.forEach(button => {
        button.addEventListener('click', () => {
            instrumentButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentInstrument = button.dataset.instrument;
            generatePads();
        });
    });
    
    muteButtons.forEach(button => {
        button.addEventListener('click', () => {
            const instrument = button.dataset.instrument;
            mutedInstruments[instrument] = !mutedInstruments[instrument];
            button.classList.toggle('muted', mutedInstruments[instrument]);
            updateGainNodes();
        });
    });
    
    soloButtons.forEach(button => {
        button.addEventListener('click', () => {
            const instrument = button.dataset.instrument;
            soloedInstruments[instrument] = !soloedInstruments[instrument];
            button.classList.toggle('active', soloedInstruments[instrument]);
            updateGainNodes();
        });
    });
    
    volumeSliders.forEach(slider => {
        slider.addEventListener('input', () => {
            const instrument = slider.dataset.instrument;
            instrumentVolumes[instrument] = parseFloat(slider.value);
            instrumentGainNodes[instrument].gain.value = instrumentVolumes[instrument];
            updateGainNodes();
        });
    });
    
    masterVolumeSlider.addEventListener('input', () => {
        masterGain.gain.value = parseFloat(masterVolumeSlider.value) * 0.8;
    });
    
    // ADSR Sliders
    document.querySelectorAll('.adsr-slider').forEach(slider => {
        slider.addEventListener('input', () => {
            const instrument = slider.dataset.instrument;
            const param = slider.dataset.param;
            if (adsrParameters[instrument]) {
                adsrParameters[instrument][param] = parseFloat(slider.value);
            }
        });
    });
    
    // Filter Controls
    lowpassSlider.addEventListener('input', () => {
        const freq = parseInt(lowpassSlider.value);
        masterLowpass.frequency.value = freq;
        lowpassDisplay.textContent = `${freq} Hz`;
    });
    
    highpassSlider.addEventListener('input', () => {
        const freq = parseInt(highpassSlider.value);
        masterHighpass.frequency.value = freq;
        highpassDisplay.textContent = `${freq} Hz`;
    });
    
    // EQ Controls
    eqLowSlider.addEventListener('input', () => {
        const gain = parseInt(eqLowSlider.value);
        eqFilters.low.gain.value = gain;
        eqLowDisplay.textContent = `${gain} dB`;
    });
    
    eqMidSlider.addEventListener('input', () => {
        const gain = parseInt(eqMidSlider.value);
        eqFilters.mid.gain.value = gain;
        eqMidDisplay.textContent = `${gain} dB`;
    });
    
    eqHighSlider.addEventListener('input', () => {
        const gain = parseInt(eqHighSlider.value);
        eqFilters.high.gain.value = gain;
        eqHighDisplay.textContent = `${gain} dB`;
    });
    
    // Bass EQ Controls
    bassEqLowSlider.addEventListener('input', () => {
        const gain = parseInt(bassEqLowSlider.value);
        bassEqFilters.low.gain.value = gain;
        bassEqLowDisplay.textContent = `${gain} dB`;
    });
    
    bassEqMidSlider.addEventListener('input', () => {
        const gain = parseInt(bassEqMidSlider.value);
        bassEqFilters.mid.gain.value = gain;
        bassEqMidDisplay.textContent = `${gain} dB`;
    });
    
    bassEqHighSlider.addEventListener('input', () => {
        const gain = parseInt(bassEqHighSlider.value);
        bassEqFilters.high.gain.value = gain;
        bassEqHighDisplay.textContent = `${gain} dB`;
    });
    
    // Swing Control
    swingSlider.addEventListener('input', () => {
        swing = parseInt(swingSlider.value);
        swingDisplay.textContent = `${swing}%`;
        swingOffset = swing / 100 * (60 / tempo) / 2;
    });
    
    // Tempo Control
    tempoSlider.addEventListener('input', () => {
        tempo = parseInt(tempoSlider.value);
        bpmDisplay.textContent = `${tempo} BPM`;
        swingOffset = swing / 100 * (60 / tempo) / 2;
    });
    
    // Note Probability Control
    probabilitySlider.addEventListener('input', () => {
        noteProbability = parseInt(probabilitySlider.value);
        probabilityDisplay.textContent = `${noteProbability}%`;
    });
    
    // Scale Selector
    scaleSelect.addEventListener('change', () => {
        currentScale = scaleSelect.value;
        if (currentInstrument === 'bass1' || currentInstrument === 'synth') {
            // Update all steps to use the new scale
            sequences[currentInstrument].forEach(step => {
                if (step.active) {
                    step.scale = currentScale;
                    // Keep the pitch but make sure it's valid in the new scale
                    const scalePitches = scales[currentScale];
                    if (!scalePitches.includes(step.pitch)) {
                        step.pitch = scalePitches[0]; // Default to root note
                    }
                }
            });
            generatePads();
        }
    });
    
    // Play/Stop Controls
    playButton.addEventListener('click', async () => {
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }
        startPlaying();
    });
    
    stopButton.addEventListener('click', stopPlaying);
    
    // Random Pattern Generators
    randomBassButton.addEventListener('click', () => generateRandomSequence('bass1'));
    randomSynthButton.addEventListener('click', () => generateRandomSequence('synth'));
    randomDrumsButton.addEventListener('click', generateRandomDrums);
    
    // Pattern Management
    savePatternButton.addEventListener('click', savePattern);
    loadPatternButton.addEventListener('click', loadPattern);
    clearPatternButton.addEventListener('click', clearCurrentPattern);
    deletePatternButton.addEventListener('click', deletePattern);
    
    // ADSR Toggle
    adsrToggle.addEventListener('click', () => {
        adsrContent.style.display = adsrContent.style.display === 'block' ? 'none' : 'block';
        adsrToggle.textContent = adsrContent.style.display === 'block' ? 'ADSR CONTROLS ▲' : 'ADSR CONTROLS ▼';
    });
    
    // Instructions Modal
    showInstructionsButton.addEventListener('click', () => {
        modal.style.display = 'flex';
    });
    
    closeModalButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Space to play/stop
        if (e.code === 'Space') {
            e.preventDefault();
            if (isPlaying) {
                stopPlaying();
            } else {
                startPlaying();
            }
        }
        
        // Number keys to select instruments
        if (e.code >= 'Digit1' && e.code <= 'Digit9') {
            const index = parseInt(e.code.replace('Digit', '')) - 1;
            const buttons = document.querySelectorAll('.instrument-button');
            if (index < buttons.length) {
                buttons[index].click();
            }
        }
    });
}

// Generate Pads with improved UI
function generatePads() {
    const drumMachine = document.getElementById('drum-machine');
    drumMachine.innerHTML = '';
    
    for (let i = 0; i < 32; i++) {
        const pad = document.createElement('div');
        pad.classList.add('pad');
        pad.dataset.step = i + 1;
        pad.dataset.index = i;
        
        if (currentInstrument === 'bass1' || currentInstrument === 'synth') {
            // Create pitch knob for melodic instruments
            const knobContainer = document.createElement('div');
            knobContainer.classList.add('pitch-knob');
            pad.appendChild(knobContainer);
            
            const step = sequences[currentInstrument][i];
            const scalePitches = scales[step.scale || currentScale];
            const pitchIndex = scalePitches.indexOf(step.pitch);
            const knob = new Nexus.Dial(knobContainer, {
                size: [30, 30],
                min: 0,
                max: scalePitches.length - 1,
                step: 1,
                value: pitchIndex >= 0 ? pitchIndex : 0
            });
            
            knob.on('change', (v) => {
                const index = Math.round(v);
                sequences[currentInstrument][i].pitch = scales[step.scale || currentScale][index];
            });
            
            knob.colorize("fill", "#00e676");
            knob.colorize("accent", "#00e676");
            
            knobContainer.style.display = step.active ? 'block' : 'none';
            
            pad.addEventListener('click', () => {
                const step = sequences[currentInstrument][i];
                step.active = !step.active;
                if (step.active) {
                    step.scale = currentScale;
                    if (step.pitch === undefined || !scales[currentScale].includes(step.pitch)) {
                        step.pitch = scales[currentScale][0]; // Default to root note
                    }
                }
                pad.classList.toggle('active', step.active);
                knobContainer.style.display = step.active ? 'block' : 'none';
            });
        } else {
            // Regular pad for drums/percussion
            pad.addEventListener('click', () => {
                sequences[currentInstrument][i] = !sequences[currentInstrument][i];
                pad.classList.toggle('active', sequences[currentInstrument][i]);
            });
        }
        
        drumMachine.appendChild(pad);
    }
    
    updatePads();
}

// Update Pads with current state
function updatePads() {
    const pads = document.querySelectorAll('.pad');
    pads.forEach((pad, index) => {
        if (currentInstrument === 'bass1' || currentInstrument === 'synth') {
            pad.classList.toggle('active', sequences[currentInstrument][index].active);
            const knobContainer = pad.querySelector('.pitch-knob');
            if (knobContainer) {
                knobContainer.style.display = sequences[currentInstrument][index].active ? 'block' : 'none';
            }
        } else {
            pad.classList.toggle('active', sequences[currentInstrument][index]);
        }
    });
}

// Update Gain Nodes based on mute/solo states
function updateGainNodes() {
    const isAnySoloed = isAnySoloedFunction();
    
    Object.keys(instrumentGainNodes).forEach(instrument => {
        if (isAnySoloed) {
            instrumentGainNodes[instrument].gain.value = soloedInstruments[instrument] ? 
                instrumentVolumes[instrument] : 0;
        } else {
            instrumentGainNodes[instrument].gain.value = mutedInstruments[instrument] ? 
                0 : instrumentVolumes[instrument];
        }
    });
}

// Check if any instrument is soloed
function isAnySoloedFunction() {
    return Object.values(soloedInstruments).some(val => val);
}

// Play Sound with ADSR Envelope and probability
function playSound(buffer, time, playbackRate = 1, duration = null, instrument = null, adsr = null) {
    // Apply note probability
    if (Math.random() * 100 > noteProbability) return null;
    
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    
    const gainNode = audioCtx.createGain();
    
    if (adsr) {
        const now = time;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(1, now + adsr.attack);
        gainNode.gain.linearRampToValueAtTime(adsr.sustain, now + adsr.attack + adsr.decay);
        gainNode.gain.setValueAtTime(adsr.sustain, now + adsr.attack + adsr.decay);
        
        if (duration) {
            gainNode.gain.setValueAtTime(adsr.sustain, now + duration);
            gainNode.gain.linearRampToValueAtTime(0, now + duration + adsr.release);
        } else {
            gainNode.gain.linearRampToValueAtTime(0, now + adsr.release);
        }
    }
    
    source.connect(gainNode);
    gainNode.connect(instrumentGainNodes[instrument]);
    source.start(time);
    
    if (duration) {
        source.stop(time + duration + (adsr ? adsr.release : 0));
    }
    
    return source;
}

// Scheduler with improved timing
function scheduler() {
    while (nextNoteTime < audioCtx.currentTime + 0.1) {
        scheduleNote(currentNote, nextNoteTime);
        nextNote();
    }
    
    timerID = setTimeout(scheduler, 25);
}

// Advance to next note
function nextNote() {
    const secondsPerBeat = 60.0 / tempo;
    nextNoteTime += 0.25 * secondsPerBeat;
    currentNote = (currentNote + 1) % 32;
}

// Schedule Note with Swing and visual feedback
function scheduleNote(beatNumber, time) {
    // Highlight the current step
    const pads = document.querySelectorAll('.pad');
    pads.forEach((pad, index) => {
        pad.classList.toggle('playing', index === beatNumber);
    });
    
    // Calculate swing offset for even beats
    let adjustedTime = time;
    if ((beatNumber % 2) === 1) {
        adjustedTime += swingOffset;
    }
    
    // Play sounds for all instruments
    Object.keys(sequences).forEach(instrument => {
        if (mutedInstruments[instrument] || (isAnySoloedFunction() && !soloedInstruments[instrument])) return;
        
        if (instrument === 'bass1' || instrument === 'synth') {
            const step = sequences[instrument][beatNumber];
            if (step.active) {
                const scalePitches = scales[step.scale || currentScale];
                const pitch = Math.pow(2, (step.pitch - 12) / 12);
                playSound(buffers[instrument], adjustedTime, pitch, null, instrument, adsrParameters[instrument]);
            }
        } else {
            if (sequences[instrument][beatNumber]) {
                playSound(buffers[instrument], adjustedTime, 1, null, instrument, adsrParameters[instrument]);
            }
        }
    });
}

// Start Playing
function startPlaying() {
    if (!isPlaying) {
        isPlaying = true;
        currentNote = 0;
        nextNoteTime = audioCtx.currentTime + 0.05;
        scheduler();
        
        // Update play button state
        document.getElementById('play').classList.add('playing');
    }
}

// Stop Playing
function stopPlaying() {
    if (isPlaying) {
        isPlaying = false;
        clearTimeout(timerID);
        
        // Remove playing state from all pads
        const pads = document.querySelectorAll('.pad');
        pads.forEach(pad => pad.classList.remove('playing'));
        
        // Update play button state
        document.getElementById('play').classList.remove('playing');
    }
}

// Generate Random Sequence for melodic instruments
function generateRandomSequence(instrument) {
    const rhythmicPatterns = [
        // Common patterns
        [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
        [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
        [true, false, true, false, false, true, false, false, true, false, true, false, false, true, false, false],
        [false, true, false, true, false, false, true, false, true, false, false, true, false, true, false, false],
        [true, false, false, true, false, false, false, true, false, false, true, false, false, false, true, false],
        [true, true, false, true, true, false, true, true, false, true, true, false, true, true, false, true],
        [false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true],
        [true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, true],
        [true, false, true, false, true, false, false, true, false, true, false, true, false, true, false, false],
        [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false]
    ];
    
    // Randomly select a pattern
    const rhythm = rhythmicPatterns[Math.floor(Math.random() * rhythmicPatterns.length)];
    const selectedScale = currentScale;
    const scalePitches = scales[selectedScale];
    
    const pattern = rhythm.map((active, i) => {
        if (active) {
            let pitch;
            if (i === 0 || i === rhythm.length - 1) {
                pitch = 0; // Root note on first and last step
            } else {
                pitch = scalePitches[Math.floor(Math.random() * scalePitches.length)];
            }
            return { active: true, pitch, scale: selectedScale };
        }
        return { active: false, pitch: 0, scale: selectedScale };
    });
    
    // Repeat to fill 32 steps
    sequences[instrument] = [];
    for (let i = 0; i < 2; i++) {
        sequences[instrument] = sequences[instrument].concat([...pattern]);
    }
    
    if (currentInstrument === instrument) {
        generatePads();
    }
}

// Generate Random Drums
function generateRandomDrums() {
    const drumInstruments = ['kick', 'snare', 'hihatClosed', 'clap', 'tom'];
    
    drumInstruments.forEach(instrument => {
        // 30% chance of having a note on any given step
        sequences[instrument] = Array(32).fill().map(() => Math.random() < 0.3);
    });
    
    // Hi-hat is more likely to be active
    sequences.hihatClosed = Array(32).fill().map(() => Math.random() < 0.5);
    
    if (drumInstruments.includes(currentInstrument)) {
        generatePads();
    }
}

// Pattern Management
function savePattern() {
    const patternSelect = document.getElementById('pattern-select');
    const patternId = patternSelect.value;
    
    if (!patternId) {
        alert('Please select a pattern slot to save to');
        return;
    }
    
    // Save all sequences for this pattern
    const patternData = {
        sequences: JSON.parse(JSON.stringify(sequences)),
        tempo,
        swing,
        noteProbability,
        currentScale
    };
    
    localStorage.setItem(`dm99-pattern-${patternId}`, JSON.stringify(patternData));
    alert(`Pattern ${patternId} saved successfully!`);
}

function loadPattern() {
    const patternSelect = document.getElementById('pattern-select');
    const patternId = patternSelect.value;
    
    if (!patternId) {
        alert('Please select a pattern to load');
        return;
    }
    
    const patternData = JSON.parse(localStorage.getItem(`dm99-pattern-${patternId}`));
    
    if (!patternData) {
        alert(`No pattern found in slot ${patternId}`);
        return;
    }
    
    // Load all sequences
    Object.keys(patternData.sequences).forEach(instrument => {
        sequences[instrument] = [...patternData.sequences[instrument]];
    });
    
    // Load global settings
    tempo = patternData.tempo;
    document.getElementById('tempo').value = tempo;
    document.getElementById('bpm-display').textContent = `${tempo} BPM`;
    
    swing = patternData.swing;
    document.getElementById('swing').value = swing;
    document.getElementById('swing-display').textContent = `${swing}%`;
    swingOffset = swing / 100 * (60 / tempo) / 2;
    
    noteProbability = patternData.noteProbability || 100;
    document.getElementById('probability').value = noteProbability;
    document.getElementById('probability-display').textContent = `${noteProbability}%`;
    
    currentScale = patternData.currentScale || 'minor';
    document.getElementById('scale-select').value = currentScale;
    
    // Update UI
    if (currentInstrument === 'bass1' || currentInstrument === 'synth') {
        sequences[currentInstrument].forEach(step => {
            if (step.active) {
                step.scale = currentScale;
            }
        });
    }
    
    generatePads();
    alert(`Pattern ${patternId} loaded successfully!`);
}

function clearCurrentPattern() {
    if (confirm('Are you sure you want to clear the current pattern?')) {
        if (currentInstrument === 'bass1' || currentInstrument === 'synth') {
            sequences[currentInstrument] = Array(32).fill().map(() => ({ active: false, pitch: 0, scale: currentScale }));
        } else {
            sequences[currentInstrument] = Array(32).fill(false);
        }
        generatePads();
    }
}

function deletePattern() {
    const patternSelect = document.getElementById('pattern-select');
    const patternId = patternSelect.value;
    
    if (!patternId) {
        alert('Please select a pattern to delete');
        return;
    }
    
    if (confirm(`Are you sure you want to delete pattern ${patternId}?`)) {
        localStorage.removeItem(`dm99-pattern-${patternId}`);
        alert(`Pattern ${patternId} deleted successfully!`);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    init();
});