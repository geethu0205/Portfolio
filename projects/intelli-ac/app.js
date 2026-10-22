document.addEventListener('DOMContentLoaded', () => {
    // 1. Elements
    const roomTabs = document.querySelectorAll('.room-tab');
    const activeRoomTitle = document.getElementById('activeRoomTitle');
    const activeRoomMeta = document.getElementById('activeRoomMeta');
    const resetRoomBtn = document.getElementById('resetRoomBtn');

    const autoModeToggle = document.getElementById('autoModeToggle');
    const occupancySlider = document.getElementById('occupancySlider');
    const outsideTempSlider = document.getElementById('outsideTempSlider');
    const setpointSlider = document.getElementById('setpointSlider');

    const occupancyVal = document.getElementById('occupancyVal');
    const outsideTempVal = document.getElementById('outsideTempVal');
    const setpointVal = document.getElementById('setpointVal');
    const occPills = document.querySelectorAll('.occ-pill');

    const acStatusChip = document.getElementById('acStatusChip');
    const currentRoomTemp = document.getElementById('currentRoomTemp');
    const tempDeltaNote = document.getElementById('tempDeltaNote');
    const currentPowerDraw = document.getElementById('currentPowerDraw');
    const powerSavingNote = document.getElementById('powerSavingNote');
    const compressorLoad = document.getElementById('compressorLoad');
    const compressorStatus = document.getElementById('compressorStatus');
    const acModeDisplay = document.getElementById('acModeDisplay');
    const unitsActiveNote = document.getElementById('unitsActiveNote');

    const inverterSpeed = document.getElementById('inverterSpeed');
    const compressorGaugeBar = document.getElementById('compressorGaugeBar');

    const advisoryBox = document.getElementById('advisoryBox');
    const advisoryIcon = document.getElementById('advisoryIcon');
    const advisoryTitle = document.getElementById('advisoryTitle');
    const advisoryDesc = document.getElementById('advisoryDesc');

    const terminalLog = document.getElementById('terminalLog');

    // Room Configurations
    const rooms = {
        "101": { name: "Lecture Hall 101", cap: 80, units: 4, baselineKw: 6.8 },
        "204": { name: "Cloud Computing Lab 204", cap: 50, units: 6, baselineKw: 8.5 },
        "302": { name: "Seminar Hall 302", cap: 120, units: 8, baselineKw: 14.2 }
    };

    let currentRoomId = "101";

    function logTerminal(component, message) {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        const line = document.createElement('div');
        line.className = 'term-line';
        line.innerHTML = `<span class="term-time">[${timeStr}]</span> [${component}] ${message}`;
        terminalLog.appendChild(line);
        terminalLog.scrollTop = terminalLog.scrollHeight;

        // Keep last 15 lines max
        while (terminalLog.children.length > 15) {
            terminalLog.removeChild(terminalLog.firstChild);
        }
    }

    // 2. Control Logic Engine (Java Daemon Simulation)
    function evaluateClimateEngine(logEvent = false) {
        const room = rooms[currentRoomId];
        const isAuto = autoModeToggle.checked;
        const occupants = parseInt(occupancySlider.value, 10);
        const outsideT = parseInt(outsideTempSlider.value, 10);
        const setpoint = parseFloat(setpointSlider.value);

        // Update Slider value displays
        occupancyVal.textContent = `${occupants} Students`;
        outsideTempVal.textContent = `${outsideT} °C`;
        setpointVal.textContent = `${setpoint.toFixed(1)} °C`;

        let loadPercent = 0;
        let actualKw = 0;
        let roomT = setpoint;
        let statusText = "COOLING";
        let statusBadgeHtml = '<span class="pulse-dot green"></span> Running &bull; Dynamic Cooling';
        let unitsActive = room.units;

        if (isAuto && occupants === 0) {
            // VACANCY DETECTED -> Transition to Standby
            loadPercent = 8;
            actualKw = 0.35 * (room.units / 4);
            roomT = Math.min(outsideT - 2, 28.5);
            statusText = "STANDBY (IDLE)";
            unitsActive = 0;
            statusBadgeHtml = '<span class="pulse-dot cyan"></span> Standby &bull; Zero Occupancy Sleep';

            compressorStatus.textContent = 'Compressors Off &bull; Fans 10%';
            unitsActiveNote.textContent = `0/${room.units} Active (Automated Sleep)`;
            advisoryTitle.textContent = "Automated Standby: Vacancy Power Cut";
            advisoryDesc.textContent = `Zero occupants detected for >10 minutes. Java controller reduced power to 0.4 kW (88% reduction), preventing phantom cooling losses.`;
            advisoryIcon.innerHTML = '<i class="fa-solid fa-moon"></i>';
            advisoryBox.style.background = 'rgba(6, 182, 212, 0.08)';

            if (logEvent) {
                logTerminal('PresenceSensorDaemon', `Vacancy confirmed in ${room.name} (0 occupants).`);
                logTerminal('ClassroomController', `Actuating power cut: Entering Standby (${actualKw.toFixed(1)} kW).`);
            }
        } else if (!isAuto) {
            // MANUAL OVERRIDE (Runs at full capacity regardless of headcount)
            loadPercent = 95;
            actualKw = room.baselineKw * 0.95;
            roomT = setpoint - 0.5;
            statusText = "MANUAL OVERRIDE";
            statusBadgeHtml = '<span class="pulse-dot blue"></span> Manual Mode Active';

            compressorStatus.textContent = 'Fixed High Inverter Load';
            unitsActiveNote.textContent = `${room.units}/${room.units} Units at 95%`;
            advisoryTitle.textContent = "Manual Override Mode";
            advisoryDesc.textContent = "Automated presence logic bypassed. Systems running at high continuous draw without occupancy optimization.";
            advisoryIcon.innerHTML = '<i class="fa-solid fa-hand"></i>';
            advisoryBox.style.background = 'rgba(245, 158, 11, 0.08)';

            if (logEvent) {
                logTerminal('ManualOverride', `Smart automation disabled by operator for ${room.name}.`);
            }
        } else {
            // SMART AUTOMATED INVERTER REGULATION
            // Heat load = occupants * 110W + deltaTemp * factor
            const occupancyRatio = occupants / room.cap;
            const tempDelta = Math.max(outsideT - setpoint, 0);
            const loadCalc = 35 + (occupancyRatio * 45) + (tempDelta * 2.2);
            loadPercent = Math.min(Math.max(Math.round(loadCalc), 25), 98);

            actualKw = (room.baselineKw * (loadPercent / 100)).toFixed(1);
            roomT = (setpoint + (loadPercent > 85 ? 0.3 : 0.0)).toFixed(1);
            statusText = "COOLING";

            compressorStatus.textContent = `Inverter Modulating (${Math.round(loadPercent * 0.58)} Hz)`;
            unitsActiveNote.textContent = `${room.units}/${room.units} Units Synchronized`;
            advisoryTitle.textContent = "Optimal Equilibrium Maintained";
            advisoryDesc.textContent = `${occupants} occupants detected. Thermal load balanced at ${loadPercent}% compressor capacity to preserve ${setpoint}°C comfort.`;
            advisoryIcon.innerHTML = '<i class="fa-solid fa-microchip"></i>';
            advisoryBox.style.background = 'rgba(16, 185, 129, 0.08)';

            if (logEvent) {
                logTerminal('ThermalOptimizer', `Headcount: ${occupants}, Ambient: ${outsideT}°C -> Modulating load to ${loadPercent}%.`);
                logTerminal('EnergyAuditLogger', `Current power: ${actualKw} kW (Optimized via inverter).`);
            }
        }

        // Update Telemetry Elements
        currentRoomTemp.textContent = roomT;
        tempDeltaNote.textContent = `${(roomT - setpoint).toFixed(1)}°C to Setpoint`;
        currentPowerDraw.textContent = typeof actualKw === 'number' ? actualKw.toFixed(1) : actualKw;

        const baseline = room.baselineKw;
        const currentKwhNum = parseFloat(actualKw);
        const percentSaved = Math.max(Math.round(((baseline - currentKwhNum) / baseline) * 100), 5);
        powerSavingNote.textContent = `${percentSaved}% vs Uncontrolled Standard`;

        compressorLoad.textContent = loadPercent;
        acModeDisplay.textContent = statusText;
        acStatusChip.innerHTML = statusBadgeHtml;

        inverterSpeed.textContent = `${loadPercent}% Capacity (${Math.round(loadPercent * 0.58)} Hz)`;
        compressorGaugeBar.style.width = `${loadPercent}%`;
    }

    // 3. Attach Event Handlers
    occupancySlider.addEventListener('input', () => evaluateClimateEngine(false));
    occupancySlider.addEventListener('change', () => evaluateClimateEngine(true));

    outsideTempSlider.addEventListener('input', () => evaluateClimateEngine(false));
    outsideTempSlider.addEventListener('change', () => evaluateClimateEngine(true));

    setpointSlider.addEventListener('input', () => evaluateClimateEngine(false));
    setpointSlider.addEventListener('change', () => evaluateClimateEngine(true));

    autoModeToggle.addEventListener('change', () => {
        evaluateClimateEngine(true);
    });

    // Quick Occupancy Pills
    occPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const targetVal = parseInt(pill.dataset.val, 10);
            const maxCap = rooms[currentRoomId].cap;
            occupancySlider.value = Math.min(targetVal, maxCap);
            evaluateClimateEngine(true);
        });
    });

    // Room Switcher Tabs
    roomTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            roomTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            currentRoomId = tab.dataset.room;
            const r = rooms[currentRoomId];
            activeRoomTitle.textContent = r.name;
            activeRoomMeta.textContent = `Capacity: ${r.cap} students \u2022 ${r.units} AC Units Installed`;

            // Adjust max on occupancy slider
            occupancySlider.max = r.cap;
            occupancySlider.value = Math.round(r.cap * 0.6);

            logTerminal('ClassroomController', `Context switched to ${r.name} (${r.units} AC nodes).`);
            evaluateClimateEngine(true);
        });
    });

    // Reset Defaults
    resetRoomBtn.addEventListener('click', () => {
        autoModeToggle.checked = true;
        occupancySlider.value = 45;
        outsideTempSlider.value = 34;
        setpointSlider.value = 23;
        logTerminal('ClassroomController', 'Parameters reset to default SRM campus baseline.');
        evaluateClimateEngine(true);
    });

    // Initial Run
    evaluateClimateEngine(true);
});
